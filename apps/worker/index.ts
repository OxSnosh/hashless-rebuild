import "dotenv/config";
import { createPublicClient, http, parseAbiItem } from "viem";
import { mainnet, base } from "viem/chains";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL!);

type ChainSpec = { name: "ethereum"|"base", chain: any, rpc: string, start: bigint };
const CHAINS: ChainSpec[] = [
  { name: "ethereum", chain: mainnet, rpc: process.env.RPC_ETHEREUM!, start: BigInt(process.env.START_BLOCK_ETHEREUM || "0") },
  { name: "base", chain: base, rpc: process.env.RPC_BASE!, start: BigInt(process.env.START_BLOCK_BASE || "0") }
];

const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

async function backfill() {
  for (const cfg of CHAINS) {
    const client = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpc) });
    const latest = await client.getBlockNumber();
    let fromBlock = cfg.start;

    while (fromBlock <= latest) {
      const toBlock = fromBlock + 5_000n > latest ? latest : fromBlock + 5_000n;
      console.log(`[${cfg.name}] ${fromBlock} -> ${toBlock}`);

      const logs = await client.getLogs({
        fromBlock, toBlock,
        event: TRANSFER_EVENT
      });

      const txs = await Promise.all(logs.map(async (l) => {
        const tx = await client.getTransaction({ hash: l.transactionHash });
        const tsBlock = await client.getBlock({ blockNumber: l.blockNumber });
        return {
          hash: l.transactionHash,
          blockNumber: l.blockNumber,
          from: l.args.from as `0x${string}`,
          to: l.args.to as `0x${string}`,
          token: l.address as `0x${string}`,
          amount: (l.args.value as bigint).toString(),
          timestamp: new Date(Number(tsBlock.timestamp) * 1000),
          chain: cfg.name
        };
      }));

      // upsert
      for (const t of txs) {
        await prisma.transaction.upsert({
          where: { hash: t.hash },
          update: {},
          create: {
            hash: t.hash,
            blockNumber: t.blockNumber,
            from: t.from.toLowerCase(),
            to: t.to.toLowerCase(),
            token: t.token?.toLowerCase(),
            amount: t.amount,
            timestamp: t.timestamp,
            chain: t.chain
          }
        });
      }

      await redis.set(`tip:${cfg.name}`, toBlock.toString());
      fromBlock = toBlock + 1n;
    }
  }
}

backfill().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
