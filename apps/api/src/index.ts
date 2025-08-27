import { PrismaClient, Prisma } from "@prisma/client";
const prisma = new PrismaClient();

/** GraphQL arg shapes */
type ContractArgs = { address: string };
type ContractsArgs = { chain?: string; search?: string; take?: number; skip?: number };
type TransactionsArgs = { chain?: string; address?: string; take?: number; skip?: number };

const resolvers = {
  Query: {

    health: () => "ok",
    
    contract: async (_: unknown, { address }: ContractArgs) =>
        prisma.contract.findUnique({
          where: { address: address.toLowerCase() },
        }),
  
      contracts: async (_: unknown, args: ContractsArgs) => {
        const where: Prisma.ContractWhereInput = {};
        if (args.chain) where.chain = args.chain;
        if (args.search)
          where.address = { contains: args.search.toLowerCase() };
  
        return prisma.contract.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: args.take,
          skip: args.skip,
        });
      },

    transactions: async (
      _: unknown,
      { chain, address, take = 50, skip = 0 }: TransactionsArgs
    ) => {
      const where: Prisma.TransactionWhereInput = {};
      const contractWhere: Prisma.ContractWhereInput = {};

      if (chain) contractWhere.chain = chain;
      if (address) contractWhere.address = address.toLowerCase();

      // Only add relation filter if we set at least one field
      if (Object.keys(contractWhere).length > 0) {
        // For a 1:many relation, you can pass ContractWhereInput directly
        where.contract = contractWhere;
        // (Prisma accepts XOR<ContractRelationFilter, ContractWhereInput>)
      }

      return prisma.transaction.findMany({
        where,
        orderBy: { blockNumber: "desc" },
        take,
        skip,
        include: { contract: true }, // if you want contract data in the result
      });
    },
  },
};

export default resolvers;
