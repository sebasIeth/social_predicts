import React from "react";
import {
  AuthProvider,
  OpenfortProvider,
  getDefaultConfig,
} from "@openfort/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig } from "wagmi";
import { baseSepolia, sepolia } from "viem/chains";

const config = createConfig(
  getDefaultConfig({
    appName: "Openfort Demo App",
    chains: [baseSepolia, sepolia],
    ssr: true,
  })
);

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OpenfortProvider
          publishableKey={"YOUR_OPENFORT_PUBLISHABLE_KEY"}


        >
          {children}
        </OpenfortProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
