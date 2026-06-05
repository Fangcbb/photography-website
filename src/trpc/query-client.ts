import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import superjson from "superjson";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
      },
      dehydrate: {
        serializeData: superjson.serialize,
        // Only dehydrate queries that are already in success state
        // Do NOT dehydrate pending queries — let client fetch fresh data
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) &&
          query.state.status === "success",
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}
