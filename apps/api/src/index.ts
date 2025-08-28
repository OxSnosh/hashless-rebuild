import "dotenv/config";
import express from "express";
import cors from "cors";
import { ApolloServer } from "apollo-server-express";
import { typeDefs } from "./schema";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

/** ------------ Types for GraphQL args ------------ **/
type QueryContractArgs = { address: string };
type QueryContractsArgs = { chain?: string; search?: string; take?: number; skip?: number };
type QueryTransactionsArgs = { chain?: string; address?: string; take?: number; skip?: number };

/** ------------ Resolvers ------------ **/
const resolvers = {
  Query: {
    health: () => "ok",

    contract: async (_: unknown, { address }: QueryContractArgs) =>
      prisma.contract.findUnique({ where: { address: address.toLowerCase() } }),

    contracts: async (_: unknown, args: QueryContractsArgs) => {
      const where: Prisma.ContractWhereInput = {
        ...(args.chain ? { chain: args.chain } : {}),
        ...(args.search
          ? {
              OR: [
                { address: { contains: args.search.toLowerCase() } },
                { name: { contains: args.search } },
              ],
            }
          : {}),
      };

      const rows = await prisma.contract.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: args.take ?? 25,
        skip: args.skip ?? 0,
      });

      // Convert Date -> ISO for GraphQL String fields
      return rows.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      }));
    },

    transactions: async (
      _: unknown,
      { chain, address, take = 50, skip = 0 }: QueryTransactionsArgs
    ) => {
      const addr = address?.toLowerCase();

      // Build OR inline and lock the type so TS never infers `never[]`
      const orFilters =
        addr
          ? ([{ fromAddress: addr }, { toAddress: addr }] satisfies Prisma.TransactionWhereInput[])
          : undefined;

      // Chain lives on related Contract
      const where: Prisma.TransactionWhereInput = {
        ...(orFilters ? { OR: orFilters } : {}),
        ...(chain ? { contract: { is: { chain } } } : {}),
      };

      const txs = await prisma.transaction.findMany({
        where,
        orderBy: { blockNumber: "desc" }, // blockNumber is Int in your schema
        take,
        skip,
        include: { contract: true },
      });

      // Convert Date -> ISO for GraphQL String fields
      return txs.map((t) => ({
        ...t,
        timestamp: t.timestamp.toISOString(),
        contract: t.contract
          ? { ...t.contract, createdAt: t.contract.createdAt.toISOString() }
          : null,
      }));
    },
  },
};

async function start() {
  const app = express();
  app.use(cors());

  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  server.applyMiddleware({ app, path: "/graphql" });

  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`API on http://localhost:${port}${server.graphqlPath}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
