import { gql } from "apollo-server-express";

export const typeDefs = gql`
  scalar BigInt
  scalar DateTime

  type Contract {
    id: ID!
    address: String!
    chain: String!
    name: String
    createdAt: DateTime!
  }

  type Transaction {
    id: ID!
    hash: String!
    blockNumber: String!
    from: String!
    to: String!
    token: String
    amount: String!
    timestamp: DateTime!
    chain: String!
    contractId: ID
  }

  type Query {
    health: String!
    contract(address: String!): Contract
    contracts(chain: String, search: String, take: Int = 25, skip: Int = 0): [Contract!]!
    transactions(chain: String, address: String, take: Int = 50, skip: Int = 0): [Transaction!]!
  }
`;
