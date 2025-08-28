'use client';

import { ApolloClient, InMemoryCache, HttpLink, ApolloProvider } from '@apollo/client';

const client = new ApolloClient({
  link: new HttpLink({
    uri: process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql',
    fetchOptions: { cache: 'no-store' },
  }),
  cache: new InMemoryCache(),
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
