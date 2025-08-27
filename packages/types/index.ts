export type ChainName = "ethereum" | "base" | "arbitrum";

export interface Contract {
  address: `0x${string}`;
  chain: ChainName;
  name?: string | null;
  createdAt: Date;
}

export interface Transfer {
  hash: `0x${string}`;
  blockNumber: bigint;
  from: `0x${string}`;
  to: `0x${string}`;
  token?: `0x${string}` | null; // native if null
  amount: string; // bigint string
  timestamp: Date;
  chain: ChainName;
}