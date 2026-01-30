import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { injected, coinbaseWallet } from 'wagmi/connectors';

export const config = createConfig({
    chains: [base],
    transports: {
        [base.id]: http(),
    },
    connectors: [
        farcasterMiniApp(),
        injected(),
        coinbaseWallet({
            appName: "Social Market",
        }),
    ],
});
