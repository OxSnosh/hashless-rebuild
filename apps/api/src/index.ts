import "dotenv/config";
import express from "express";
import cors from "cors";
import { ApolloServer } from "apollo-server-express";
import { typeDefs } from "./schema";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const resolvers = {
  Query: {
    health: () => "ok",
    contract: async (_: any, { address }: { address: string }) =>
      prisma.contract.findUnique({ where: { address: address.toLowerCase() } }),
    contracts: async (_: any, args: any) => {
      const where: any = {};
      if (args.chain) where.chain = args.chain;
      if (args.search) where.address = { contains: args.search.toLowerCase() };
      return prisma.contract.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: args.take,
        skip: args.skip
      });
    },
    transactions: async (_: any, { chain, address, take = 50, skip = 0 }: any) => {
      const where: any = {};
      if (chain) where.chain = chain;
      if (address) where.OR = [{ from: address.toLowerCase() }, { to: address.toLowerCase() }];
      return prisma.transaction.findMany({
        where,
        orderBy: { blockNumber: "desc" },
        take, skip
      });
    }
  }
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

start().catch(err => { console.error(err); process.exit(1); });