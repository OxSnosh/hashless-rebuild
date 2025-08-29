import { gql } from "apollo-server-express";

export const typeDefs = gql`
  scalar DateTime

  type Contract {
    id: ID!
    address: String!
    chain: String!
    createdAt: DateTime!
    txs(take: Int = 100, skip: Int = 0): [Transaction!]!
  }

  type Transaction {
    id: ID!
    hash: String!
    chain: String!
    blockNumber: Int!
    timestamp: DateTime!
    fromAddress: String!
    toAddress: String
    valueWei: String
    contractId: ID
    contract: Contract
  }

  type Query {
    health: String!

    # NEW: list contracts (optionally filter/paginate)
    contracts(chain: String, search: String, take: Int = 50, skip: Int = 0): [Contract!]!

    # Fetch one contract by composite key
    contract(chain: String!, address: String!): Contract

    # Existing single tx by composite key
    transaction(chain: String!, hash: String!): Transaction

    # Optional helper: list txs (by chain and/or by contract address)
    transactions(chain: String, address: String, take: Int = 50, skip: Int = 0): [Transaction!]!
  }
`;

type Ctx = { prisma: import("@prisma/client").PrismaClient };

export const resolvers = {
  Query: {
    health: () => "ok",

    contracts: async (
      _parent: unknown,
      args: { chain?: string; search?: string; take?: number; skip?: number },
      { prisma }: Ctx
    ) => {
      const where: any = {};
      if (args.chain) where.chain = args.chain;
      if (args.search) where.address = { contains: args.search.toLowerCase() };
      return prisma.contract.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: args.take ?? 50,
        skip: args.skip ?? 0,
      });
    },

    contract: async (
      _parent: unknown,
      { chain, address }: { chain: string; address: string },
      { prisma }: Ctx
    ) => {
      return prisma.contract.findUnique({
        where: {
          chain_address_unique: { chain, address: address.toLowerCase() },
        },
      });
    },

    transaction: async (
      _parent: unknown,
      { chain, hash }: { chain: string; hash: string },
      { prisma }: Ctx
    ) => {
      return prisma.transaction.findUnique({
        where: { chain_hash_unique: { chain, hash } },
        include: { contract: true },
      });
    },

    transactions: async (
      _parent: unknown,
      { chain, address, take, skip }: { chain?: string; address?: string; take?: number; skip?: number },
      { prisma }: Ctx
    ) => {
      const where: any = {};
      if (chain) where.chain = chain;

      if (address) {
        // find the contract by address (and chain if provided)
        const contract = await prisma.contract.findFirst({
          where: { address: address.toLowerCase(), ...(chain ? { chain } : {}) },
        });
        if (!contract) return [];
        where.contractId = contract.id;
      }

      return prisma.transaction.findMany({
        where,
        orderBy: { blockNumber: "desc" },
        take: take ?? 50,
        skip: skip ?? 0,
      });
    },
  },

  Contract: {
    txs: async (
      parent: { id: string },
      args: { take?: number; skip?: number },
      { prisma }: Ctx
    ) => {
      return prisma.transaction.findMany({
        where: { contractId: parent.id },
        orderBy: { blockNumber: "desc" },
        take: args.take ?? 100,
        skip: args.skip ?? 0,
      });
    },
  },
};
