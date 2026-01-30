import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { ORACLE_POLL_ADDRESS, ORACLE_POLL_ABI, BASE_USDC_ADDRESS } from '../constants';
import { erc20Abi } from 'viem';
import { Crown, Loader2 } from 'lucide-react';

export function PremiumStatus() {
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();
    const [isBuying, setIsBuying] = useState(false);

    // Read Premium Cost
    const { data: membershipCost } = useReadContract({
        address: ORACLE_POLL_ADDRESS,
        abi: ORACLE_POLL_ABI,
        functionName: 'MEMBERSHIP_COST',
    });

    // Check if Premium
    const { data: isPremium, refetch: refetchPremium } = useReadContract({
        address: ORACLE_POLL_ADDRESS,
        abi: ORACLE_POLL_ABI,
        functionName: 'isPremium',
        args: [address!],
        query: { enabled: !!address }
    });

    // Check Allowance for Premium
    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: BASE_USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address!, ORACLE_POLL_ADDRESS],
        query: { enabled: !!address }
    });

    const [showModal, setShowModal] = useState(false);

    const handleBuyPremium = async () => {
        if (!address || !publicClient || !membershipCost) return;
        setIsBuying(true);
        try {
            // 1. Approve if needed
            if (!allowance || allowance < membershipCost) {
                console.log("Approving USDC for Premium...");
                const hash = await writeContractAsync({
                    address: BASE_USDC_ADDRESS,
                    abi: erc20Abi,
                    functionName: 'approve',
                    args: [ORACLE_POLL_ADDRESS, membershipCost]
                });
                await publicClient.waitForTransactionReceipt({ hash });
                await refetchAllowance();
            }

            // 2. Buy Premium
            console.log("Buying Premium...");
            const hash = await writeContractAsync({
                address: ORACLE_POLL_ADDRESS,
                abi: ORACLE_POLL_ABI,
                functionName: 'buyPremium'
            });
            await publicClient.waitForTransactionReceipt({ hash });
            await refetchPremium();
            setShowModal(false); // Close modal on success

        } catch (e) {
            console.error("Premium Purchase Failed:", e);
            alert("Failed to buy premium. Check console.");
        } finally {
            setIsBuying(false);
        }
    };

    if (!isConnected) return null;

    if (isPremium) {
        return (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-yellow-100 border border-yellow-200 rounded-xl text-yellow-700">
                <Crown size={14} className="fill-yellow-500 text-yellow-600" />
                <span className="text-[10px] font-black uppercase tracking-wide">PRO</span>
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
                    GO PRO $0.0001
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
                            Unlock the full potential of Oracle Polls with these exclusive features:
                        </p>

                        <div className="space-y-3 w-full mb-8 text-left">
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                                <span className="bg-yellow-100 p-2 rounded-xl text-yellow-600">⚡️</span>
                                <div>
                                    <p className="font-bold text-gray-800 text-sm">Auto-Reveal Votes</p>
                                    <p className="text-[10px] text-gray-500 font-bold">Never miss the reveal window again.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                                <span className="bg-green-100 p-2 rounded-xl text-green-600">💸</span>
                                <div>
                                    <p className="font-bold text-gray-800 text-sm">Auto-Claim Rewards</p>
                                    <p className="text-[10px] text-gray-500 font-bold">Winnings sent directly to your wallet.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                                <span className="bg-purple-100 p-2 rounded-xl text-purple-600">🗳️</span>
                                <div>
                                    <p className="font-bold text-gray-800 text-sm">Create Polls</p>
                                    <p className="text-[10px] text-gray-500 font-bold">Host your own prediction markets.</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 w-full mt-auto">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 py-4 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBuyPremium}
                                disabled={isBuying}
                                className="flex-[2] py-4 bg-gray-900 text-white font-black rounded-2xl shadow-xl hover:scale-[1.02] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isBuying ? <Loader2 size={16} className="animate-spin" /> : "Purchase for $0.0001"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
