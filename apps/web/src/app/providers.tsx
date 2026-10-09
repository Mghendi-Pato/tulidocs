'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { Toaster } from 'sonner';
import { ConfirmProvider } from '@/components/ui/confirm';
import { MuiProvider } from '@/components/ui/mui-provider';
import { ApiError } from '@/lib/api';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            refetchOnWindowFocus: true,
            retry: (count, err) => !(err instanceof ApiError && err.status > 0 && err.status < 500) && count < 2,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <MuiProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </MuiProvider>
      <Toaster
        position="bottom-center"
        toastOptions={{
          classNames: {
            toast: '!rounded-2xl !border-line !bg-ink !text-white !font-sans !shadow-[var(--shadow-pop)]',
            description: '!text-white/70',
          },
        }}
      />
    </QueryClientProvider>
  );
}
