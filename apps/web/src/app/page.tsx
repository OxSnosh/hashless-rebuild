"use client";
import { gql, useQuery } from "@apollo/client";

type Contract = { address: string; chain?: string; createdAt?: string };
type ContractsData = { contracts: Contract[] };
type ContractsVars = { chain?: string; search?: string; take?: number; skip?: number };

const CONTRACTS = gql`
  query Contracts($chain: String, $search: String, $take: Int, $skip: Int) {
    contracts(chain: $chain, search: $search, take: $take, skip: $skip) {
      address
      chain
      createdAt
    }
  }
`;

export default function Page() {
  const { data, loading, error } = useQuery<ContractsData, ContractsVars>(
    CONTRACTS,
    { variables: { take: 50, skip: 0 } }
  );

  if (loading) return <div>Loading…</div>;
  if (error) return <div>Error: {error.message}</div>;

  const items = data?.contracts ?? [];
  return (
    <ul>
      {items.map(c => (
        <li key={c.address}>{c.address}</li>
      ))}
    </ul>
  );
}
