// File: providers/query-provider.tsx
"use client"; 

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  // สร้าง QueryClient instance เพียงครั้งเดียวต่อ request
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // ข้อมูลจะถือว่า "สดใหม่" (Fresh) เป็นเวลา 1 นาที
            staleTime: 60 * 1000,
            // จำนวนครั้งที่จะลองใหม่ถ้า Request ล้มเหลว
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
    </QueryClientProvider>
  );
}