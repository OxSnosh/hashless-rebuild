import "dotenv/config";
import express from "express";
import cors from "cors";
import { ApolloServer } from "apollo-server-express";
import { PrismaClient } from "@prisma/client";
// NOTE: when using ts-node ESM, import your TS module with a .js suffix.
import { typeDefs, resolvers } from "./schema.ts";

const prisma = new PrismaClient({ log: ["error", "warn"] });

process.on("uncaughtException", (err) => {
  console.error("🔥 Uncaught Exception:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("🔥 Unhandled Rejection:", reason);
});

async function main() {
  console.log("Booting API…");

  const app = express();
  app.use(cors());
  app.use(express.json());

  // simple health route to confirm Express is up even if Apollo fails
  app.get("/health", (_req, res) => res.status(200).send("ok"));

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: async () => ({ prisma })
  });

  await server.start();
  // @ts-ignore - apollo v3 types can be funky in ESM
  server.applyMiddleware({ app, path: "/graphql", cors: false });

  const PORT = Number(process.env.PORT || 4000);
  app.listen(PORT, () => {
    console.log(`API ready on http://localhost:${PORT}/graphql`);
  });
}

main().catch((e) => {
  console.error("🔥 Fatal boot error:", e);
  process.exit(1);
});