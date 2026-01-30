import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, usePublicClient, useWatchContractEvent } from 'wagmi';
import { ORACLE_POLL_ADDRESS, ORACLE_POLL_ABI, BASE_USDC_ADDRESS } from '../constants';
import { erc20Abi } from 'viem';
import { Crown, Loader2, Clock } from 'lucide-react';

export function PremiumStatus() {
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();
    const [isBuying, setIsBuying] = useState(false);

    // Check Expiry
    const { data: premiumExpiry, refetch: refetchPremium } = useReadContract({
        address: ORACLE_POLL_ADDRESS,
        abi: ORACLE_POLL_ABI,
        functionName: 'premiumExpiry',
        args: [address!],
        query: { enabled: !!address }
    });

    // Real-time Event Listener
    useWatchContractEvent({
        address: ORACLE_POLL_ADDRESS,
        abi: ORACLE_POLL_ABI,
        eventName: 'PremiumPurchased',
        onLogs(logs) {
            const log = logs[0] as any;
            // Check if it's for current user
            if (log.args.user?.toLowerCase() === address?.toLowerCase()) {
                console.log("Subscription detected!");
                refetchPremium();
                setShowModal(false);
            }
        },
    });

    const isPremium = premiumExpiry ? Number(premiumExpiry) > Math.floor(Date.now() / 1000) : false;

    // Calculate Days Left
    const getDaysLeft = () => {
        if (!premiumExpiry) return 0;
        const secondsLeft = Number(premiumExpiry) - Math.floor(Date.now() / 1000);
        return Math.ceil(secondsLeft / (60 * 60 * 24));
    };

    const [showModal, setShowModal] = useState(false);

    // Costs
    const COST_7_DAYS = 100n;
    const COST_30_DAYS = 300n;

    const handleBuyPremium = async (days: number) => {
        if (!address || !publicClient) return;

        const cost = days === 7 ? COST_7_DAYS : COST_30_DAYS;

        setIsBuying(true);
        try {
            // 1. Approve if needed
            const allowance = await publicClient.readContract({
                address: BASE_USDC_ADDRESS,
                abi: erc20Abi,
                functionName: 'allowance',
                args: [address, ORACLE_POLL_ADDRESS]
            });

            if (allowance < cost) {
                console.log("Approving USDC...");
                const hash = await writeContractAsync({
                    address: BASE_USDC_ADDRESS,
                    abi: erc20Abi,
                    functionName: 'approve',
                    args: [ORACLE_POLL_ADDRESS, cost],
                    gas: 60000n
                });
                await publicClient.waitForTransactionReceipt({ hash });
            }

            // 2. Buy Subscription
            console.log(`Buying ${days} Days...`);
            const hash = await writeContractAsync({
                address: ORACLE_POLL_ADDRESS,
                abi: ORACLE_POLL_ABI,
                functionName: 'buyPremium',
                args: [BigInt(days)],
                gas: 500000n
            });
            // We wait for receipt, but the Event Listener will also handle UI update
            await publicClient.waitForTransactionReceipt({ hash });
            await refetchPremium();

        } catch (e) {
            console.error("Purchase Failed:", e);
            alert("Failed to buy. Check console.");
        } finally {
            setIsBuying(false);
        }
    };

    if (!isConnected) return null;

    if (isPremium) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 border border-yellow-200 rounded-xl text-yellow-700 font-bold">
                <Crown size={14} className="fill-yellow-500 text-yellow-600" />
                <span className="text-[10px] uppercase tracking-wide">PRO</span>
                <div className="w-px h-3 bg-yellow-300 mx-1"></div>
                <Clock size={12} className="text-yellow-600" />
                <span className="text-[10px]">{getDaysLeft()} Days Left</span>
            </div>
        );
    }

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
            >
                <Crown size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wide">
                    GO PRO
                </span>
            </button>

            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 relative shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in duration-200 my-auto max-h-[90vh] overflow-y-auto">
                        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4 flex-shrink-0">
                            <Crown size={32} className="text-yellow-600 fill-yellow-500" />
                        </div>

                        <h3 className="text-2xl font-display font-black text-gray-800 mb-2">Upgrade to Pro</h3>
                        <p className="text-gray-500 font-medium mb-6 text-sm">
                            Unlock exclusive tools for serious pollsters.
                        </p>

                        <div className="space-y-3 w-full mb-8 text-left">
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                                <span className="bg-yellow-100 p-2 rounded-xl text-yellow-600">⚡️</span>
                                <div><p className="font-bold text-gray-800 text-sm">Auto-Reveal</p></div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                                <span className="bg-green-100 p-2 rounded-xl text-green-600">💸</span>
                                <div><p className="font-bold text-gray-800 text-sm">Auto-Claim</p></div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                                <span className="bg-purple-100 p-2 rounded-xl text-purple-600">🗳️</span>
                                <div><p className="font-bold text-gray-800 text-sm">Create Polls</p></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 w-full mt-auto">
                            <button
                                onClick={() => handleBuyPremium(7)}
                                disabled={isBuying}
                                className="py-4 bg-white border-2 border-gray-100 hover:border-gray-900 text-gray-900 font-black rounded-2xl shadow-sm hover:scale-[1.02] transition-all disabled:opacity-50"
                            >
                                {isBuying ? <Loader2 size={16} className="animate-spin mx-auto" /> : (
                                    <>
                                        <div className="text-xs text-gray-400">7 Days</div>
                                        <div className="text-lg">$0.0001</div>
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => handleBuyPremium(30)}
                                disabled={isBuying}
                                className="py-4 bg-gray-900 text-white font-black rounded-2xl shadow-xl hover:scale-[1.02] transition-transform disabled:opacity-50"
                            >
                                {isBuying ? <Loader2 size={16} className="animate-spin mx-auto" /> : (
                                    <>
                                        <div className="text-xs text-gray-400">1 Month</div>
                                        <div className="text-lg">$0.0003</div>
                                    </>
                                )}
                            </button>
                        </div>
                        <button onClick={() => setShowModal(false)} className="mt-4 text-gray-400 text-sm font-bold hover:text-gray-600">Cancel</button>
                    </div>
                </div>
            )}
        </>
    );
}
