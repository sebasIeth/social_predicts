import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from './wagmi'
import './index.css'

// Fix for BigInt serialization
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
import App from './App.tsx'
import { OpenfortProviderWrapper } from "./providers/OpenfortProvider.tsx"

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OpenfortProviderWrapper>
          <App />
        </OpenfortProviderWrapper>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
