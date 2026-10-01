import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data lives in-process; there is no network to be flaky about.
      retry: false,
      staleTime: 5_000,
      refetchOnWindowFocus: false,
    },
  },
});
