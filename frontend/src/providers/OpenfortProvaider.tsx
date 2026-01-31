import { OpenfortProvider } from "@openfort/react";
import React from "react";

export function OpenfortProviderWrapper({ children }: { children: React.ReactNode }) {
    const key = import.meta.env.VITE_OPENFORT_PUBLIC_KEY;
    const shieldKey = import.meta.env.VITE_OPENFORT_SHIELD_PUBLIC_KEY;

    if (!key) {
        console.warn("Openfort Publishable Key is missing! Please set VITE_OPENFORT_PUBLIC_KEY in your .env file.");
    }

    return (
        <OpenfortProvider
            publishableKey={key || "pk_test_placeholder_key"}
            walletConfig={{
                shieldPublishableKey: shieldKey || undefined,
                recoverWalletAutomaticallyAfterAuth: true
            }}
        >
            {children}
        </OpenfortProvider>
    );
}