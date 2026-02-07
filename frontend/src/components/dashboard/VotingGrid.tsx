
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { useAccount, useSwitchChain, usePublicClient, useBalance, useReadContract, useWriteContract, useWatchContractEvent, useReadContracts } from 'wagmi';
import { keccak256, encodePacked, formatUnits, pad, toHex, erc20Abi } from 'viem';
import { ORACLE_POLL_ADDRESS, ORACLE_POLL_ABI, BASE_USDC_ADDRESS, STAKE_AMOUNT, TARGET_CHAIN_ID } from '../../constants';
import { cn } from '../../utils';

interface VoteRecord {
    pollId: number;
    optionIndex: number;
    voterAddress: string;
}

function getErrorMessage(error: unknown): string {
    const errorObj = error as { details?: string; shortMessage?: string; message?: string };
    const rawMessage = errorObj.details || errorObj.shortMessage || errorObj.message || '';

    // Map technical errors to user-friendly messages
    if (rawMessage.includes('insufficient funds') || rawMessage.includes('InsufficientBalance')) {
        return 'Not enough ETH for gas fees. Please add some ETH to your wallet.';
    }
    if (rawMessage.includes('user rejected') || rawMessage.includes('User denied')) {
        return 'Transaction was cancelled.';
    }
    if (rawMessage.includes('SafeERC20') || rawMessage.includes('transfer amount exceeds')) {
        return 'Not enough USDC balance. Please add funds to your wallet.';
    }
    if (rawMessage.includes('Commit phase ended')) {
        return 'Voting period has ended. You can no longer vote on this poll.';
    }
    if (rawMessage.includes('Already revealed')) {
        return 'This vote has already been revealed.';
    }
    if (rawMessage.includes('execution reverted')) {
        return 'Transaction failed. Please try again.';
    }
    if (rawMessage.includes('network') || rawMessage.includes('timeout')) {
        return 'Network error. Please check your connection and try again.';
    }

    return rawMessage || 'An unexpected error occurred. Please try again.';
}

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
            if (!res.ok) return;
            const data: VoteRecord[] = await res.json();
            const count = data.filter((v) => v.pollId === pollId).length;
            setUserVotes(count);
        } catch {
            // Failed to fetch user votes
        }
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
            if (!isMiniApp) {
                await switchChainAsync({ chainId: TARGET_CHAIN_ID });
            }

            if (ethBalance && ethBalance.value === 0n) {
                onError("No Gas", "You need some ETH on Base to pay for gas fees.");
                return;
            }

            setIsApproving(true);

            const hash = await writeContractAsync({
                address: BASE_USDC_ADDRESS,
                abi: erc20Abi,
                functionName: 'approve',
                args: [ORACLE_POLL_ADDRESS, STAKE_AMOUNT],
            });

            await publicClient.waitForTransactionReceipt({ hash });
            setOptimisticApproved(true);
            await refetchAllowance();
            setIsApproving(false);
            onSuccess("Approved!", "You can now submit your vote.");
        } catch (e: unknown) {
            setIsApproving(false);
            onError("Approval Failed", getErrorMessage(e));
        }
    };

    const handleVote = async () => {
        if (selected === null || !address || !publicClient) return;

        try {
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

            const hash = await writeContractAsync({
                address: ORACLE_POLL_ADDRESS,
                abi: ORACLE_POLL_ABI,
                functionName: 'commitVote',
                args: [BigInt(pollId), voteHash as `0x${string}`],
            });

            await publicClient.waitForTransactionReceipt({ hash });

            const resCount = await fetch(`${import.meta.env.VITE_API_URL}/api/votes/user/${address}`);
            const userHistory: VoteRecord[] = await resCount.json();
            const commitmentIndex = userHistory.filter((v) => v.pollId === Number(pollId)).length;

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
            }).catch(() => {});

            setIsCommitting(false);
            if (isPremium) {
                onSuccess("Vote Locked!", "Since you're a PRO member, we'll auto-reveal this for you! Sit back and relax.");
            } else {
                onSuccess("Vote Committed!", "Your prediction is locked in. Don't forget to come back and reveal it later!");
            }
            refetchBalance();
            refetchAllowance();
            fetchUserVotes();
            if (onVoteSuccess) onVoteSuccess();
        } catch (e: unknown) {
            setIsCommitting(false);
            onError("Vote Failed", getErrorMessage(e));
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

    useWatchContractEvent({
        address: ORACLE_POLL_ADDRESS,
        abi: ORACLE_POLL_ABI,
        eventName: 'VoteRevealed',
        onLogs() {
            refetchTallies();
        },
    });

    const totalRevealedStake = tallies?.reduce((acc, t) => acc + (t.result ? BigInt(String(t.result)) : 0n), 0n) || 0n;

    const hasVoted = userVotes > 0;

    if (options.length === 0) return <div className="p-8 text-center text-gray-400 dark:text-gray-500">No options available</div>;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="grid grid-cols-1 gap-4"
        >
            <div className="grid grid-cols-2 gap-3">
                {options.map((opt, idx) => {
                    const votes = tallies?.[idx]?.result ? BigInt(String(tallies[idx].result)) : 0n;
                    const percentage = totalRevealedStake > 0n ? Number((votes * 10000n) / totalRevealedStake) / 100 : 0;
                    const isWinner = totalRevealedStake > 0n && percentage > 0 && votes === (tallies?.reduce((max, t) => {
                        const val = t.result ? BigInt(String(t.result)) : 0n;
                        return val > max ? val : max;
                    }, 0n));

                    // Ensure option is a valid string, otherwise show fallback
                    const optionLabel = (typeof opt === 'string' && opt.trim().length > 0)
                        ? opt
                        : `Option ${idx + 1}`;

                    return (
                        <button
                            key={`${pollId}-option-${idx}`}
                            onClick={() => enabled && !hasVoted && setSelected(idx)}
                            disabled={!enabled || hasVoted}
                            className={cn(
                                "p-6 rounded-[2rem] text-left transition-all duration-200 relative overflow-hidden group border-2",
                                selected === idx
                                    ? "bg-candy-purple text-white shadow-xl shadow-candy-purple/30 scale-[1.02] border-transparent"
                                    : "bg-white dark:bg-card-dark text-gray-600 dark:text-gray-300 border-transparent",
                                (!enabled || hasVoted) && "opacity-80 cursor-not-allowed",
                                !hasVoted && enabled && selected !== idx && "hover:bg-gray-50 dark:hover:bg-surface-dark hover:border-gray-100 dark:hover:border-gray-700"
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
                                <span className="font-display font-bold text-lg block mb-1">{optionLabel}</span>
                                {/* Results Logic: Show if voting is disabled (aka REVEAL/RESULT phase) or if user voted */}
                                {!enabled && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-xs font-black bg-gray-100 dark:bg-surface-dark px-2 py-1 rounded-lg text-gray-500 dark:text-gray-400">
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

            <div className="bg-white dark:bg-card-dark rounded-[2.5rem] p-6 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-gray-200 dark:border-gray-700 mt-2">
                {hasVoted ? (
                    <div className="w-full py-5 rounded-3xl bg-gray-100 dark:bg-surface-dark text-gray-400 font-bold text-xl text-center cursor-not-allowed flex items-center justify-center gap-2">
                        <CheckCircle size={20} />
                        ALREADY VOTED
                    </div>
                ) : selected !== null ? (
                    <>
                        {needsApproval ? (
                            <button
                                onClick={handleApprove}
                                disabled={isApproving}
                                aria-label="Approve USDC spending"
                                className="w-full py-5 rounded-3xl bg-blue-600 text-white font-black text-xl shadow-xl hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 flex items-center justify-center gap-3"
                            >
                                {isApproving && (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                )}
                                {isApproving ? "APPROVING..." : "1. APPROVE USDC"}
                            </button>
                        ) : (
                            <button
                                onClick={handleVote}
                                disabled={isCommitting}
                                aria-label="Lock in your vote"
                                className="w-full py-5 rounded-3xl bg-gray-900 text-white font-black text-xl shadow-xl hover:bg-gray-800 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-offset-2 flex items-center justify-center gap-3"
                            >
                                {isCommitting && (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                )}
                                {isCommitting ? "LOCKING IN..." : "LOCK IT IN 🔒"}
                            </button>
                        )}
                        <p className="text-xs text-gray-400 text-center">
                            Stake: 0.001 USDC per vote
                        </p>
                    </>
                ) : (
                    <p className="text-gray-400 font-bold text-center">
                        {enabled ? "Select an option above, then lock in your prediction" : "Voting has ended. Results are being revealed."}
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
                            <div className="flex items-center gap-2 px-3 py-1 bg-yellow-50 dark:bg-yellow-900/20 rounded-full border border-yellow-200 dark:border-yellow-800">
                                <span className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400 uppercase">
                                    PRO: Auto-Reveal Enabled
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>

        </motion.div>
    );
}
