import gql from "graphql-tag";

export const typeDefs = gql`
  type Contract {
    id: ID!
    address: String!
    chain: String!
    name: String
    createdAt: String!
  }

  type Transaction {
    id: ID!
    hash: String!
    blockNumber: Int!
    timestamp: String!
    fromAddress: String!
    toAddress: String
    valueWei: String
    contractId: ID!
    contract: Contract
  }

  type Query {
    health: String!
    contract(address: String!): Contract
    contracts(chain: String, search: String, take: Int = 25, skip: Int = 0): [Contract!]!
    transactions(chain: String, address: String, take: Int = 50, skip: Int = 0): [Transaction!]!
  }
`;
