"use client";
import React from "react";

// --- Adjust this to your API endpoint ---
// Example: NEXT_PUBLIC_HASHLESS_API_URL=https://localhost:4000/graphql
const API_URL = process.env.NEXT_PUBLIC_HASHLESS_API_URL || "http://localhost:4000/graphql";

// If your REST is mounted at the same origin as GraphQL, we'll infer it by stripping the trailing /graphql
const API_BASE = API_URL.replace(/\/?graphql$/, "");

// ----------------- Types -----------------

type Chain = "ethereum" | "base";

type Contract = {
  id: string;
  address: string;
  chain?: Chain;
  name?: string | null;
  createdAt?: string | null;
  verified?: boolean | null;
};

type Transaction = {
  id: string;
  hash: string;
  blockNumber: number;
  timestamp: string; // ISO string
  fromAddress: string;
  toAddress?: string | null;
  valueWei?: string | null;
  contractId?: string | null;
  contract?: Contract | null;
};

// ----------------- GraphQL -----------------

const GQL_TX_BY_HASH = /* GraphQL */ `
  query TxByHash($hash: String!) {
    transaction(hash: $hash) {
      id
      hash
      blockNumber
      timestamp
      fromAddress
      toAddress
      valueWei
      contractId
      contract { id address chain name verified createdAt }
    }
  }
`;

const GQL_CONTRACT_BY_ADDRESS = /* GraphQL */ `
  query Contract($address: String!) {
    contract(address: $address) {
      id
      address
      chain
      name
      verified
      createdAt
    }
  }
`;

const GQL_RECENT_TXS = /* GraphQL */ `
  query Recent($chain: String, $take: Int!, $skip: Int!) {
    transactions(chain: $chain, take: $take, skip: $skip) {
      id
      hash
      blockNumber
      timestamp
      fromAddress
      toAddress
      valueWei
    }
  }
`;

async function fetchGraphQL<T>(query: string, variables: Record<string, any>): Promise<T> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    // Important for Next.js caching behavior
    cache: "no-store",
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message || "GraphQL error");
  return json.data as T;
}

// ----------------- Helpers -----------------

function isHexMatch(s: string, len: number) {
  return /^0x[0-9a-fA-F]+$/.test(s) && s.length === 2 + len;
}
function isTxHash(s: string) { return isHexMatch(s.trim(), 64); }
function isAddress(s: string) { return isHexMatch(s.trim(), 40); }

function formatWeiToEth(wei?: string | null) {
  if (!wei) return "0";
  try {
    const big = BigInt(wei);
    const ethInt = big / 10n ** 18n;
    const ethDec = (big % 10n ** 18n).toString().padStart(18, "0").slice(0, 6);
    return `${ethInt.toString()}.${ethDec}`.replace(/\.0+$/, "");
  } catch {
    return wei;
  }
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = Math.max(0, Date.now() - d.getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ----------------- UI -----------------

export default function ExplorerSearch() {
  const [input, setInput] = React.useState("");
  const [mode, setMode] = React.useState<"auto" | "tx" | "contract">("auto");
  const [chain, setChain] = React.useState<Chain>("base");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [tx, setTx] = React.useState<Transaction | null>(null);
  const [contract, setContract] = React.useState<Contract | null>(null);

  const [recent, setRecent] = React.useState<Transaction[]>([]);
  const [skip, setSkip] = React.useState(0);
  const TAKE = 25;

  React.useEffect(() => {
    // Load initial recent txs
    void loadRecent(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain]);

  async function loadRecent(reset = false) {
    try {
      setError(null);
      const nextSkip = reset ? 0 : skip;
      const data = await fetchGraphQL<{ transactions: Transaction[] }>(GQL_RECENT_TXS, {
        chain,
        take: TAKE,
        skip: nextSkip,
      });
      setRecent(reset ? data.transactions : [...recent, ...data.transactions]);
      setSkip(nextSkip + TAKE);
    } catch (e: any) {
      setError(e.message);
    }
  }

  function decideMode(raw: string): "tx" | "contract" | null {
    const s = raw.trim();
    if (isTxHash(s)) return "tx";
    if (isAddress(s)) return "contract";
    return null;
  }

  async function onSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setTx(null); setContract(null); setError(null);

    const chosen = mode === "auto" ? decideMode(input) : mode;
    if (!chosen) {
      setError("Enter a 0x…64 tx hash or 0x…40 contract address");
      return;
    }

    setLoading(true);
    try {
      if (chosen === "tx") {
        // Try GraphQL first
        try {
          const data = await fetchGraphQL<{ transaction: Transaction | null }>(GQL_TX_BY_HASH, { hash: input.trim() });
          if (!data.transaction) throw new Error("Not found");
          setTx(data.transaction);
        } catch (gqlErr) {
          // Fallback to REST if available: GET /transaction/:hash
          const res = await fetch(`${API_BASE}/transaction/${input.trim()}`, { cache: "no-store" });
          if (!res.ok) throw new Error("Transaction not found");
          const json = (await res.json()) as Transaction;
          setTx(json);
        }
      } else {
        const data = await fetchGraphQL<{ contract: Contract | null }>(GQL_CONTRACT_BY_ADDRESS, { address: input.trim().toLowerCase() });
        if (!data.contract) throw new Error("Contract not found");
        setContract(data.contract);
      }
    } catch (e: any) {
      setError(e.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] w-full px-4 py-8 md:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-col gap-2">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Hashless Explorer</h1>
          <p className="text-sm text-gray-500">Search a transaction from the last 5,000 indexed blocks or look up any contract.</p>
        </header>

        <form onSubmit={onSearch} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste tx hash (0x…64) or contract (0x…40)"
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 outline-none ring-0 focus:border-gray-400"
            />
            <button
              type="submit"
              className="mt-2 w-full rounded-xl bg-black px-5 py-3 text-white md:mt-0 md:w-auto"
              disabled={loading}
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Mode:</span>
              <div className="inline-flex overflow-hidden rounded-xl border">
                {(["auto", "tx", "contract"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`px-3 py-1.5 ${mode === m ? "bg-gray-900 text-white" : "bg-white"}`}
                  >{m}</button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-500">Chain:</span>
              <div className="inline-flex overflow-hidden rounded-xl border">
                {(["base", "ethereum"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChain(c)}
                    className={`px-3 py-1.5 capitalize ${chain === c ? "bg-gray-900 text-white" : "bg-white"}`}
                  >{c}</button>
                ))}
              </div>
            </div>

            <span className="text-gray-400">Results reflect your indexer's last ~5,000 blocks.</span>
          </div>
        </form>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>
        )}

        {/* Results */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {tx && (
            <div className="rounded-2xl border p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-medium">Transaction</h2>
                <code className="rounded bg-gray-100 px-2 py-1 text-xs">{tx.hash.slice(0, 10)}…</code>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <LabelValue label="Block" value={`#${tx.blockNumber}`} />
                <LabelValue label="When" value={timeAgo(tx.timestamp)} />
                <LabelValue label="From" value={tx.fromAddress} mono />
                <LabelValue label="To" value={tx.toAddress || "—"} mono />
                <LabelValue label="Value" value={`${formatWeiToEth(tx.valueWei)} ETH`} />
                {tx.contractId && (<LabelValue label="Contract ID" value={tx.contractId} mono />)}
              </div>
            </div>
          )}

          {contract && (
            <div className="rounded-2xl border p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-medium">Contract</h2>
                <code className="rounded bg-gray-100 px-2 py-1 text-xs">{contract.address.slice(0, 10)}…</code>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <LabelValue label="Address" value={contract.address} mono />
                <LabelValue label="Chain" value={contract.chain || "—"} />
                <LabelValue label="Name" value={contract.name || "—"} />
                <LabelValue label="Verified" value={String(contract.verified ?? "—")} />
                <LabelValue label="Created" value={contract.createdAt ? timeAgo(contract.createdAt) : "—"} />
              </div>
            </div>
          )}
        </div>

        {/* Recent */}
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">Recent transactions</h3>
            <button onClick={() => loadRecent(true)} className="text-sm underline">Refresh</button>
          </div>
          <div className="grid gap-3">
            {recent.map((r) => (
              <button key={r.id}
                onClick={() => { setInput(r.hash); setMode("tx"); void onSearch(); }}
                className="group flex w-full items-center justify-between rounded-xl border bg-white p-3 text-left hover:shadow-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-lg border px-2 py-1 text-xs">#{r.blockNumber}</div>
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs text-gray-800">{r.hash}</div>
                    <div className="text-xs text-gray-500">{timeAgo(r.timestamp)} • {formatWeiToEth(r.valueWei)} ETH</div>
                  </div>
                </div>
                <div className="hidden shrink-0 text-xs text-gray-500 sm:block">From {short(r.fromAddress)} → {short(r.toAddress || "—")}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-center">
            <button onClick={() => loadRecent(false)} className="rounded-xl border px-4 py-2 text-sm">Load more</button>
          </div>
        </section>
      </div>
    </div>
  );
}

function short(v: string) {
  return v.length > 12 ? `${v.slice(0, 6)}…${v.slice(-4)}` : v;
}

function LabelValue({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border bg-gray-50 p-3">
      <div className="text-[11px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`${mono ? "font-mono" : ""} text-sm text-gray-900 break-all`}>{value}</div>
    </div>
  );
}
