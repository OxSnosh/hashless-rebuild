import "dotenv/config";
import { createPublicClient, http, parseAbiItem } from "viem";
import { mainnet, base } from "viem/chains";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

// --- clients ---
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL!);

// --- chain config ---
type ChainSpec = { name: "ethereum" | "base"; chain: any; rpc: string };
const CHAINS: ChainSpec[] = [
  { name: "ethereum", chain: mainnet, rpc: process.env.RPC_ETHEREUM! },
  { name: "base", chain: base, rpc: process.env.RPC_BASE! },
];

// --- events ---
const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

// --- helper: retry wrapper ---
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 800): Promise<T> {
  let err: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      err = e;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw err;
}

// --- helper: safe getLogs with adaptive splitting ---
type GetLogsParams = {
  fromBlock: bigint;
  toBlock: bigint;
  event: ReturnType<typeof parseAbiItem>;
  address?: `0x${string}` | `0x${string}`[];
};

async function getLogsSafe(client: any, params: GetLogsParams): Promise<any[]> {
  let ranges: Array<{ from: bigint; to: bigint }> = [{ from: params.fromBlock, to: params.toBlock }];
  const all: any[] = [];

  while (ranges.length) {
    const { from, to } = ranges.pop()!;
    try {
      const logs = await client.getLogs({
        fromBlock: from,
        toBlock: to,
        event: params.event,
        // address: params.address, // uncomment if narrowing by token
      });
      all.push(...logs);
    } catch (e: any) {
      const isLimit = e?.code === -32005 || /more than 10000 results/i.test(e?.message || "");
      if (!isLimit) throw e;

      const suggestHex: string | undefined = e?.data?.to;
      const splitTo = suggestHex ? BigInt(suggestHex) : (from + to) >> 1n;
      if (splitTo <= from || splitTo >= to) {
        // fallback split in half
        const mid = (from + to) >> 1n;
        if (mid === from || mid === to) throw e;
        ranges.push({ from, to: mid }, { from: mid + 1n, to });
      } else {
        ranges.push({ from, to: splitTo }, { from: splitTo + 1n, to });
      }
    }
  }

  return all;
}

// --- main backfill ---
async function backfillLast5000() {
  for (const cfg of CHAINS) {
    const client = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpc) });
    const latest = await client.getBlockNumber();
    const startBlock = latest > 4999n ? latest - 4999n : 0n;

    console.log(`[${cfg.name}] Scanning last 5000 blocks: ${startBlock} -> ${latest}`);

    let fromBlock = startBlock;
    const chunkSize = 1000n; // initial step size (will split more if Infura complains)

    while (fromBlock <= latest) {
      const toBlock = fromBlock + chunkSize - 1n > latest ? latest : fromBlock + chunkSize - 1n;
      process.stdout.write(`[${cfg.name}] ${fromBlock} -> ${toBlock} ... `);

      const logs = await withRetry(() =>
        getLogsSafe(client, { fromBlock, toBlock, event: TRANSFER_EVENT })
      );

      console.log(`(${logs.length} logs)`);

      if (logs.length > 0) {
        // get block timestamps (unique per block)
        const uniqueBlocks = Array.from(new Set(logs.map(l => l.blockNumber)));
        const blockTimeMap = new Map<bigint, Date>();
        for (const bn of uniqueBlocks) {
          const block = await withRetry(() => client.getBlock({ blockNumber: bn }));
          blockTimeMap.set(bn, new Date(Number(block.timestamp) * 1000));
        }

        // prepare tx rows
        const txs = logs.map(l => ({
          hash: l.transactionHash,
          blockNumber: l.blockNumber,
          from: (l.args?.from as `0x${string}`) ?? "0x0000000000000000000000000000000000000000",
          to: (l.args?.to as `0x${string}`) ?? "0x0000000000000000000000000000000000000000",
          token: l.address as `0x${string}`,
          amount: (l.args?.value as bigint | undefined)?.toString() ?? "0",
          timestamp: blockTimeMap.get(l.blockNumber)!,
          chain: cfg.name,
        }));

        

        // upsert into Prisma
        for (const tx of txs) {
          await prisma.transaction.create({
            data: {
              hash: tx.hash,
              chain: cfg.name, // Add the missing chain property
              blockNumber: Number(tx.blockNumber),
              timestamp: tx.timestamp,
              // keep these only if your schema includes them; otherwise remove:
              fromAddress: tx.from?.toLowerCase() ?? null,
              toAddress: tx.to?.toLowerCase() ?? null,
              valueWei: tx.amount ?? null,
          
              contract: {
                connectOrCreate: {
                  where: { chain_address_unique: { chain: cfg.name, address: tx.token.toLowerCase() } },
                  create: { address: tx.token.toLowerCase(), chain: cfg.name },
                },
              },
            },
          });
        }
      }

      await redis.set(`tip:${cfg.name}`, toBlock.toString());
      fromBlock = toBlock + 1n;
    }

    console.log(`[${cfg.name}] Done. Tip at ${await redis.get(`tip:${cfg.name}`)}`);
  }
}

// --- run ---
backfillLast5000()
  .then(() => {
    console.log("Backfill complete.");
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
