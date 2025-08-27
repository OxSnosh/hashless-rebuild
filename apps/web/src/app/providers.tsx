"use client";

import { ApolloProvider, ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";
import fetch from "cross-fetch";

const client = new ApolloClient({
  // change this to your API URL (or use NEXT_PUBLIC_GRAPHQL_URL)
  link: new HttpLink({ uri: "/api/graphql", fetch }),
  cache: new InMemoryCache(),
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
