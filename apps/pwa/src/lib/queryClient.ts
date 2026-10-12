import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: (failureCount, error) => {
        if ((error as any)?.status === 401) return false;
        return failureCount < 2;
      },
    },
  },
});
