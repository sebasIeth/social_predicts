import { http, createConfig } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { injected, coinbaseWallet } from 'wagmi/connectors';

const chains = [base, ...(import.meta.env.DEV ? [baseSepolia] : [])] as const;

export const config = createConfig({
    chains: chains,
    transports: {
        [base.id]: http("https://base-mainnet.g.alchemy.com/v2/TRylDDMm2LeRFKSeETLtD"),
        [baseSepolia.id]: http("https://base-sepolia.g.alchemy.com/v2/TRylDDMm2LeRFKSeETLtD")
    },
    connectors: [
        farcasterMiniApp(),
        injected(),
        coinbaseWallet({
            appName: "Social Market",
        }),
    ],
});
