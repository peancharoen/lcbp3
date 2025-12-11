import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Creates a wrapper with QueryClient for testing hooks
 * @returns Object with wrapper component and queryClient instance
 */
export function createTestQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { wrapper, queryClient };
}

/**
 * Wait for all pending operations in React Query
 */
export async function waitForQueryClient(queryClient: QueryClient) {
  await queryClient.getQueryCache().clear();
  await queryClient.getMutationCache().clear();
}
