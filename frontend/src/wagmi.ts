import { http, createConfig } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { injected, coinbaseWallet } from 'wagmi/connectors';

export const config = createConfig({
    chains: [base, baseSepolia],
    transports: {
        [base.id]: http("https://base-mainnet.g.alchemy.com/v2/TRylDDMm2LeRFKSeETLtD"),
        [baseSepolia.id]: http(),
    },
    connectors: [
        farcasterMiniApp(),
        injected(),
        coinbaseWallet({
            appName: "Social Market",
        }),
    ],
});
