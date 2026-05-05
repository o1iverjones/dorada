import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: (failureCount, error) => {
        if ((error as { status?: number }).status === 401) return false;
        return failureCount < 2;
      },
    },
  },
});
