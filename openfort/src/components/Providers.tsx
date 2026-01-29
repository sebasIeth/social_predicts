// src/components/Providers.tsx
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
    chains: [baseSepolia, sepolia], // add all the chains you want to support
    ssr: true,
  })
);

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OpenfortProvider
          // Set the publishable key of your Openfort account. This field is required.
          publishableKey={"YOUR_OPENFORT_PUBLISHABLE_KEY"}


        >
          {children}
        </OpenfortProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
