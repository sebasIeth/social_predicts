
import { useSwitchChain } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { AlertTriangle } from 'lucide-react';

export function WrongNetworkAlert() {
    const { switchChain, isPending } = useSwitchChain();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border-4 border-red-100">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>

                <h2 className="text-2xl font-black text-gray-800 mb-2">Wrong Network</h2>
                <p className="text-gray-500 font-medium mb-8">
                    Please switch your wallet to Base network to use this application.
                </p>

                <div className="space-y-3">
                    <button
                        onClick={() => switchChain({ chainId: base.id })}
                        disabled={isPending}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPending ? 'Switching...' : 'Switch to Base'}
                    </button>

                    {import.meta.env.DEV && (
                        <button
                            onClick={() => switchChain({ chainId: baseSepolia.id })}
                            disabled={isPending}
                            className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-bold transition-all text-xs"
                        >
                            Switch to Base Sepolia (Dev)
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
