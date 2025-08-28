// apps/web/src/components/ContractsList.tsx
'use client';
import { gql, useQuery } from '@apollo/client';

const CONTRACTS = gql`
  query Contracts($take: Int!, $skip: Int!) {
    contracts(take: $take, skip: $skip) {
      address
      chain
      createdAt
    }
  }
`;

type Contract = { address: string; chain: string; createdAt: string };
type ContractsData = { contracts: Contract[] };
type ContractsVars = { take: number; skip: number };

export default function ContractsList() {
  const { data, loading, error } = useQuery<ContractsData, ContractsVars>(CONTRACTS, {
    variables: { take: 50, skip: 0 },
  });

  if (loading) return <div>Loading…</div>;
  if (error) return <div>Error: {String(error.message || error)}</div>;

  return (
    <ul>
      {(data?.contracts ?? []).map(c => (
        <li key={c.address}>
          {c.address} · {c.chain} · {new Date(c.createdAt).toLocaleString()}
        </li>
      ))}
    </ul>
  );
}
