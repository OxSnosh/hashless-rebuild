// Make ALL of Apollo's public API visible while React 19 types catch up
declare module "@apollo/client" {
    // core & cache
    export * from "@apollo/client/core";
    export * from "@apollo/client/cache";
  
    // links (http, core)
    export * from "@apollo/client/link/core";
    export * from "@apollo/client/link/http";
  
    // react
    export * from "@apollo/client/react";
    export * from "@apollo/client/react/hooks";
  }
  