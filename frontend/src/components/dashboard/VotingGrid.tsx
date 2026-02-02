
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Sparkles } from 'lucide-react';
import { useAccount, useSwitchChain, usePublicClient, useBalance, useReadContract, useWriteContract, useWatchContractEvent, useReadContracts } from 'wagmi';
import { keccak256, encodePacked, formatUnits, pad, toHex, erc20Abi } from 'viem';
import { ORACLE_POLL_ADDRESS, ORACLE_POLL_ABI, BASE_USDC_ADDRESS, STAKE_AMOUNT, TARGET_CHAIN_ID } from '../../constants';
import { cn } from '../../utils';

interface VotingGridProps {
    pollId: number;
    options: readonly string[];
    enabled: boolean;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
    onVoteSuccess?: () => void;
}

export function VotingGrid({ pollId, options, enabled, onSuccess, onError, onVoteSuccess }: VotingGridProps) {
    const [selected, setSelected] = useState<number | null>(null);
    const { address, connector } = useAccount();
    const isMiniApp = connector?.id === 'farcaster';
    const { switchChainAsync } = useSwitchChain();
    const [isApproving, setIsApproving] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    const publicClient = usePublicClient();
    const { data: ethBalance } = useBalance({ address });
    const [userVotes, setUserVotes] = useState(0);
    const [optimisticApproved, setOptimisticApproved] = useState(false);

    const fetchUserVotes = async () => {
        if (!address) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/votes/user/${address}`);
            const data = await res.json();
            const count = data.filter((v: any) => v.pollId === pollId).length;
            setUserVotes(count);
        } catch (e) { console.error(e) }
    };

    // Check if Premium
    const { data: isPremium } = useReadContract({
        address: ORACLE_POLL_ADDRESS,
        abi: ORACLE_POLL_ABI,
        functionName: 'isPremium',
        args: [address!],
        query: { enabled: !!address }
    });

    useEffect(() => {
        fetchUserVotes();
    }, [address, pollId]);

    // Contract Writes
    const { writeContractAsync } = useWriteContract();

    // Check Allowance
    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: BASE_USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address!, ORACLE_POLL_ADDRESS],
        query: {
            enabled: !!address,
        }
    });

    // Check Balance
    const { data: balance, refetch: refetchBalance } = useReadContract({
        address: BASE_USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address!],
        query: {
            enabled: !!address,
        }
    });

    const needsApproval = (!allowance || allowance < STAKE_AMOUNT) && !optimisticApproved;

    const handleApprove = async () => {
        if (!address || !publicClient) return;

        try {
            console.log("Switching to Base...");
            if (!isMiniApp) {
                await switchChainAsync({ chainId: TARGET_CHAIN_ID });
            }

            if (ethBalance && ethBalance.value === 0n) {
                onError("No Gas", "You need some ETH on Base to pay for gas fees.");
                return;
            }

            setIsApproving(true);
            console.log("Initiating Approval...");

            const hash = await writeContractAsync({
                address: BASE_USDC_ADDRESS,
                abi: erc20Abi,
                functionName: 'approve',
                args: [ORACLE_POLL_ADDRESS, STAKE_AMOUNT],
            });

            console.log("Approval Hash Sent:", hash);
            await publicClient.waitForTransactionReceipt({ hash });
            setOptimisticApproved(true);
            await refetchAllowance();
            setIsApproving(false);
            onSuccess("Approved!", "You can now submit your vote.");
        } catch (e: any) {
            console.error("Approval Error:", e);
            setIsApproving(false);
            const msg = e.details || e.shortMessage || e.message || "Could not approve USDC";
            onError("Approval Failed", msg);
        }
    };

    const handleVote = async () => {
        if (selected === null || !address || !publicClient) return;

        try {
            console.log("Switching to Base for Vote...");
            if (!isMiniApp) {
                await switchChainAsync({ chainId: TARGET_CHAIN_ID });
            }

            if (needsApproval) {
                onError("Allowance Needed", "Please approve USDC first.");
                return;
            }

            if (!balance || balance < STAKE_AMOUNT) {
                onError("Insufficient Balance", "You need at least 0.001 USDC on Base to vote.");
                return;
            }

            setIsCommitting(true);

            const salt = pad(toHex(Math.floor(Math.random() * 1000000)), { size: 32 });
            const voteHash = keccak256(encodePacked(['uint256', 'bytes32'], [BigInt(selected), salt]));

            console.log("Sending commitVote to Poll:", pollId, "Hash:", voteHash);

            const hash = await writeContractAsync({
                address: ORACLE_POLL_ADDRESS,
                abi: ORACLE_POLL_ABI,
                functionName: 'commitVote',
                args: [BigInt(pollId), voteHash as `0x${string}`],
            });

            console.log("Tx Sent successfully:", hash);
            await publicClient.waitForTransactionReceipt({ hash }); // Wait for confirmation before success

            // 0. Get next commitment index from backend
            const resCount = await fetch(`${import.meta.env.VITE_API_URL}/api/votes/user/${address}`);
            const userHistory = await resCount.json();
            const commitmentIndex = userHistory.filter((v: any) => v.pollId === Number(pollId)).length;

            // Store in array-based localStorage
            const storageKey = `oracle_poll_votes_${pollId}_${address}`;
            const existingVotes = JSON.parse(localStorage.getItem(storageKey) || '[]');
            existingVotes.push({ salt, vote: selected, commitmentIndex });
            localStorage.setItem(storageKey, JSON.stringify(existingVotes));

            await fetch(`${import.meta.env.VITE_API_URL}/api/votes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pollId: Number(pollId),
                    voterAddress: address,
                    optionIndex: selected,
                    commitmentIndex: commitmentIndex,
                    salt: salt
                })
            }).catch(console.error);

            setIsCommitting(false);
            if (isPremium) {
                onSuccess("Vote Locked! 🔒", "Since you're a PRO member, we'll auto-reveal this for you! Sit back and relax.");
            } else {
                onSuccess("Vote Committed!", "Your prediction is locked in. Don't forget to come back and reveal it later!");
            }
            refetchBalance();
            refetchAllowance();
            fetchUserVotes();
            if (onVoteSuccess) onVoteSuccess();
        } catch (e: any) {
            console.error("Commit Failed Full Error:", e);
            setIsCommitting(false);
            const msg = e.details || e.shortMessage || e.message || "An unexpected error occurred.";
            onError("Transaction Failed", msg);
        }
    };

    /* New: Fetch Tallies */
    const { data: tallies, refetch: refetchTallies } = useReadContracts({
        contracts: options.map((_, idx) => ({
            address: ORACLE_POLL_ADDRESS as `0x${string}`,
            abi: ORACLE_POLL_ABI,
            functionName: 'optionTallies',
            args: [BigInt(pollId), BigInt(idx)]
        })),
        query: {
            enabled: options.length > 0
        }
    });

    // Re-fetch tallies when parent updates (which happens on events)
    useEffect(() => {
        refetchTallies();
    }, [pollId, refetchTallies]);

    // Real-time listener for new votes being revealed
    useWatchContractEvent({
        address: ORACLE_POLL_ADDRESS,
        abi: ORACLE_POLL_ABI,
        eventName: 'VoteRevealed',
        onLogs() {
            console.log('Vote revealed (real-time)! Refetching tallies...');
            refetchTallies();
        },
    });

    // Calculate totals
    const totalRevealedStake = tallies?.reduce((acc, t) => acc + (t.result ? BigInt(t.result as any) : 0n), 0n) || 0n;

    const hasVoted = userVotes > 0;

    if (options.length === 0) return <div className="p-8 text-center text-gray-400">No options available</div>;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="grid grid-cols-1 gap-4"
        >
            <div className="grid grid-cols-2 gap-3">
                {options.map((opt, idx) => {
                    const votes = tallies?.[idx]?.result ? BigInt(tallies[idx].result as any) : 0n;
                    const percentage = totalRevealedStake > 0n ? Number((votes * 10000n) / totalRevealedStake) / 100 : 0;
                    const isWinner = totalRevealedStake > 0n && percentage > 0 && votes === (tallies?.reduce((max, t) => {
                        const val = t.result ? BigInt(t.result as any) : 0n;
                        return val > max ? val : max;
                    }, 0n));

                    return (
                        <button
                            key={opt}
                            onClick={() => enabled && !hasVoted && setSelected(idx)}
                            disabled={!enabled || hasVoted}
                            className={cn(
                                "p-6 rounded-[2rem] text-left transition-all duration-200 relative overflow-hidden group border-2",
                                selected === idx
                                    ? "bg-candy-purple text-white shadow-xl shadow-candy-purple/30 scale-[1.02] border-transparent"
                                    : "bg-white text-gray-600 border-transparent",
                                (!enabled || hasVoted) && "opacity-80 cursor-not-allowed",
                                !hasVoted && enabled && selected !== idx && "hover:bg-gray-50 hover:border-gray-100"
                            )}
                        >
                            {/* Progress Bar Background */}
                            {!enabled && (
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percentage}%` }}
                                    className={cn(
                                        "absolute top-0 bottom-0 left-0 opacity-10 transition-all duration-1000",
                                        isWinner ? "bg-green-500" : "bg-gray-900"
                                    )}
                                />
                            )}

                            <div className="relative z-10">
                                <span className="font-display font-bold text-lg block mb-1">{opt}</span>
                                {/* Results Logic: Show if voting is disabled (aka REVEAL/RESULT phase) or if user voted */}
                                {!enabled && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-xs font-black bg-gray-100 px-2 py-1 rounded-lg text-gray-500">
                                            {formatUnits(votes, 6)} USDC
                                        </span>
                                        <span className="text-xs font-bold text-gray-400">
                                            {percentage.toFixed(1)}%
                                        </span>
                                    </div>
                                )}
                            </div>

                            {selected === idx && (
                                <motion.div
                                    layoutId="selection-ring"
                                    className="absolute inset-0 border-[6px] border-white/20 rounded-[2rem] z-20"
                                />
                            )}
                        </button>
                    )
                })}
            </div>

            <div className="bg-white rounded-[2.5rem] p-6 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-gray-200 mt-2">
                {hasVoted ? (
                    <div className="w-full py-5 rounded-3xl bg-gray-100 text-gray-400 font-bold text-xl text-center cursor-not-allowed">
                        ALREADY VOTED
                    </div>
                ) : selected !== null ? (
                    <>
                        {needsApproval ? (
                            <button
                                onClick={handleApprove}
                                disabled={isApproving}
                                className="w-full py-5 rounded-3xl bg-blue-600 text-white font-black text-xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isApproving ? "APPROVING USDC..." : "1. APPROVE USDC"}
                            </button>
                        ) : (
                            <button
                                onClick={handleVote}
                                disabled={isCommitting}
                                className="w-full py-5 rounded-3xl bg-gray-900 text-white font-black text-xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isCommitting ? "COMMITTING..." : "2. LOCK IT IN 🔒"}
                            </button>
                        )}
                    </>
                ) : (
                    <p className="text-gray-400 font-bold text-center">
                        {enabled ? "Tap an option above to predict!" : "Results will appear as they are revealed."}
                    </p>
                )}

                {hasVoted && (
                    <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-2 px-4 py-2 bg-candy-mint/10 rounded-full border border-candy-mint/20">
                            <CheckCircle size={14} className="text-candy-mint" />
                            <span className="text-xs font-black text-candy-mint uppercase">
                                You Have {userVotes} {userVotes === 1 ? 'Vote' : 'Votes'} in This Poll
                            </span>
                        </div>
                        {isPremium && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-yellow-50 rounded-full border border-yellow-200">
                                <Sparkles size={12} className="text-yellow-600" />
                                <span className="text-[10px] font-bold text-yellow-700 uppercase">
                                    Auto-Pilot Active
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>

        </motion.div>
    );
}
