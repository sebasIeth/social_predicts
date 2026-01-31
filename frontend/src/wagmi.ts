import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { injected, coinbaseWallet } from 'wagmi/connectors';

export const config = createConfig({
    chains: [base],
    transports: {
        [base.id]: http("https://base-mainnet.g.alchemy.com/v2/TRylDDMm2LeRFKSeETLtD")
    },
    connectors: [
        farcasterMiniApp(),
        injected(),
        coinbaseWallet({
            appName: "Social Market",
        }),
    ],
});
