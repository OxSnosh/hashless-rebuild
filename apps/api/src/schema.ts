import { gql } from "apollo-server-express";

export const typeDefs = gql`
  scalar DateTime

  type Contract {
    id: ID!
    address: String!
    chain: String!
    createdAt: DateTime!
    txs: [Transaction!]!
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
    transaction(chain: String!, hash: String!): Transaction
  }
`;

export const resolvers = {
  Query: {
    health: () => "ok",
    transaction: async (
      _: unknown,
      { chain, hash }: { chain: string; hash: string },
      { prisma }: { prisma: import("@prisma/client").PrismaClient }
    ) => {
      return prisma.transaction.findUnique({
        where: { chain_hash_unique: { chain, hash } },
        include: { contract: true },
      });
    },
  },
  Contract: {
    txs: (parent: any, _args: any, { prisma }: any) =>
      prisma.transaction.findMany({
        where: { contractId: parent.id },
        orderBy: { blockNumber: "desc" },
        take: 100,
      }),
  },
};
