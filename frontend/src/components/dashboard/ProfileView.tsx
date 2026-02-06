
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Trophy, Gavel, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { type Hex } from 'viem';
import { ORACLE_POLL_ADDRESS, ORACLE_POLL_ABI } from '../../constants';
import { cn } from '../../utils';
import { PremiumStatus } from '../PremiumStatus';
import { CreatePollModal } from './CreatePollModal';

function getErrorMessage(error: unknown): string {
    const errorObj = error as { details?: string; shortMessage?: string; message?: string };
    const rawMessage = errorObj.details || errorObj.shortMessage || errorObj.message || '';

    if (rawMessage.includes('insufficient funds') || rawMessage.includes('InsufficientBalance')) {
        return 'Not enough ETH for gas fees. Please add some ETH to your wallet.';
    }
    if (rawMessage.includes('user rejected') || rawMessage.includes('User denied')) {
        return 'Transaction was cancelled.';
    }
    if (rawMessage.includes('Resolution time not reached')) {
        return 'The reveal phase has not ended yet. Please wait until all votes can be revealed.';
    }
    if (rawMessage.includes('Already revealed')) {
        return 'This vote has already been revealed.';
    }
    if (rawMessage.includes('Already claimed')) {
        return 'You have already claimed this reward.';
    }
    if (rawMessage.includes('No votes')) {
        return 'Cannot resolve poll with no votes.';
    }
    if (rawMessage.includes('execution reverted')) {
        return 'Transaction failed. Please try again.';
    }
    if (rawMessage.includes('network') || rawMessage.includes('timeout')) {
        return 'Network error. Please check your connection and try again.';
    }

    return rawMessage || 'An unexpected error occurred. Please try again.';
}

interface ProfileViewProps {
    address: string | undefined;
    now: number;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
    onLogout?: () => void;
}

interface VoteHistoryItem {
    pollId: number;
    optionIndex: number;
    commitmentIndex: number;
    salt: string;
    revealed?: boolean;
    claimed?: boolean;
    createdAt?: string;
    pollInfo: {
        contractPollId: number;
        title: string;
        options: string[];
        commitEndTime: number;
        revealEndTime: number;
        resolved?: boolean;
        winningOptionIndex?: number;
    };
}

export function ProfileView({ address, now, onSuccess, onError, onLogout }: ProfileViewProps) {
    const [history, setHistory] = useState<VoteHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [verifying, setVerifying] = useState(false);
    const { writeContractAsync: writeReveal } = useWriteContract();
    const [revealingIndices, setRevealingIndices] = useState<Set<string>>(new Set());
    const [resolvingPolls, setResolvingPolls] = useState<Set<number>>(new Set());
    const [claimingIndices, setClaimingIndices] = useState<Set<string>>(new Set());
    const [confirmResolve, setConfirmResolve] = useState<{ pollId: number; title: string } | null>(null);
    const publicClient = usePublicClient();

    // Combined loading state - show skeleton while fetching OR verifying
    const isFullyLoaded = !loading && !verifying;

    // Filters & Pagination
    const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'REVEAL' | 'RESOLVED' | 'WON' | 'LOST'>('ALL');
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    const filteredHistory = history.filter(item => {
        const poll = item.pollInfo;
        if (!poll) return false;

        const isOpen = now < poll.commitEndTime;

        const isRevealPhase = now >= poll.commitEndTime && now < poll.revealEndTime;
        const isResolved = poll.resolved;
        const isWinner = isResolved && poll.winningOptionIndex === item.optionIndex;

        if (filter === 'ALL') return true;
        if (filter === 'OPEN') return isOpen;
        if (filter === 'REVEAL') return isRevealPhase;
        if (filter === 'RESOLVED') return isResolved;
        if (filter === 'WON') return isWinner;
        if (filter === 'LOST') return isResolved && !isWinner;
        return true;
    });

    const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
    const paginatedHistory = filteredHistory.slice(
        (page - 1) * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE
    );

    const handleResolve = async (pId: number) => {
        if (!address || !publicClient) return;

        setResolvingPolls(prev => new Set(prev).add(pId));

        try {
            const onChainPoll = await publicClient.readContract({
                address: ORACLE_POLL_ADDRESS,
                abi: ORACLE_POLL_ABI,
                functionName: 'polls',
                args: [BigInt(pId)]
            });

            const isResolvedOnChain = onChainPoll[5];
            const winningOptionIndex = Number(onChainPoll[6]);

            const updateLocalState = () => {
                setHistory(prev => prev.map(item => {
                    if (item.pollInfo.contractPollId === pId) {
                        return {
                            ...item,
                            pollInfo: {
                                ...item.pollInfo,
                                resolved: true,
                                winningOptionIndex: winningOptionIndex
                            }
                        };
                    }
                    return item;
                }));
            };

            if (isResolvedOnChain) {
                onSuccess("Already Resolved", "Poll is already resolved on-chain! Updating view...");
                updateLocalState();
                syncAndRefetch();
                return;
            }

            const hash = await writeReveal({
                address: ORACLE_POLL_ADDRESS,
                abi: ORACLE_POLL_ABI,
                functionName: 'resolvePoll',
                args: [BigInt(pId)]
            });
            await publicClient.waitForTransactionReceipt({ hash });

            onSuccess("Poll Resolved!", "Computing winners...");

            const updatedPoll = await publicClient.readContract({
                address: ORACLE_POLL_ADDRESS,
                abi: ORACLE_POLL_ABI,
                functionName: 'polls',
                args: [BigInt(pId)]
            });
            const winner = Number(updatedPoll[6]);

            setHistory(prev => prev.map(item => {
                if (item.pollInfo.contractPollId === pId) {
                    return {
                        ...item,
                        pollInfo: {
                            ...item.pollInfo,
                            resolved: true,
                            winningOptionIndex: winner
                        }
                    };
                }
                return item;
            }));

            syncAndRefetch();

        } catch (e: unknown) {
            onError("Resolve Failed", getErrorMessage(e));
        } finally {
            setResolvingPolls(prev => {
                const next = new Set(prev);
                next.delete(pId);
                return next;
            });
        }
    };


    const syncAndRefetch = () => {
        fetch(`${import.meta.env.VITE_API_URL}/api/polls/sync`, { method: 'POST' })
            .catch(() => {})
            .then(() => fetchHistory());
    };

    const fetchHistory = async () => {
        if (!address) return;

        // Minimum loading time of 3 seconds for smooth UX
        const minLoadTime = new Promise(resolve => setTimeout(resolve, 3000));

        try {
            const [res] = await Promise.all([
                fetch(`${import.meta.env.VITE_API_URL}/api/votes/user/${address}`),
                minLoadTime
            ]);

            if (!res.ok) return;
            const data: VoteHistoryItem[] = await res.json();
            setHistory(data);
            verifyStuckPolls(data);
        } catch {
            // Failed to fetch history
        } finally {
            setLoading(false);
        }
    };

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Check Premium Status
    const { data: isPremium } = useReadContract({
        address: ORACLE_POLL_ADDRESS,
        abi: ORACLE_POLL_ABI,
        functionName: 'isPremium',
        args: [address as `0x${string}`],
        query: {
            enabled: !!address
        }
    });



    const verifyStuckPolls = async (items: VoteHistoryItem[]) => {
        if (!publicClient) {
            setVerifying(false);
            return;
        }

        const pollsToCheck = items.filter(item => {
            const poll = item.pollInfo;
            if (!poll) return false;

            const stuck = (now >= poll.revealEndTime && !poll.resolved);
            const won = (poll.resolved && poll.winningOptionIndex === item.optionIndex);
            const revealPhase = (now >= poll.commitEndTime && now < poll.revealEndTime && !item.revealed);
            return stuck || won || revealPhase;
        });

        if (pollsToCheck.length === 0) {
            setVerifying(false);
            return;
        }

        setVerifying(true);

        for (const item of pollsToCheck) {
            await new Promise(resolve => setTimeout(resolve, 1000));

            try {
                const pId = item.pollInfo.contractPollId;

                const onChainPoll = await publicClient.readContract({
                    address: ORACLE_POLL_ADDRESS,
                    abi: ORACLE_POLL_ABI,
                    functionName: 'polls',
                    args: [BigInt(pId)]
                });

                const isResolved = onChainPoll[5];
                const winner = Number(onChainPoll[6]);

                let isClaimed = item.claimed;
                if (isResolved && winner === item.optionIndex) {
                    try {
                        isClaimed = await publicClient.readContract({
                            address: ORACLE_POLL_ADDRESS,
                            abi: ORACLE_POLL_ABI,
                            functionName: 'rewardClaimed',
                            args: [BigInt(pId), address as `0x${string}`, BigInt(item.commitmentIndex)]
                        }) as boolean;
                    } catch {
                        // Failed to check claim status
                    }
                }

                let isRevealed = item.revealed;
                if (!isRevealed && now >= item.pollInfo.commitEndTime && now < item.pollInfo.revealEndTime) {
                    try {
                        const hasRevealedOnChain = await publicClient.readContract({
                            address: ORACLE_POLL_ADDRESS,
                            abi: ORACLE_POLL_ABI,
                            functionName: 'hasRevealed',
                            args: [BigInt(pId), address as `0x${string}`, BigInt(item.commitmentIndex)]
                        });

                        if (hasRevealedOnChain) {
                            isRevealed = true;
                        }
                    } catch {
                        // Failed to check hasRevealed status
                    }
                }

                if (isResolved || isClaimed !== item.claimed || isRevealed !== item.revealed) {
                    setHistory(prev => prev.map(pi => {
                        if (pi.pollInfo.contractPollId === pId) {
                            const updated = { ...pi };
                            updated.pollInfo = { ...pi.pollInfo, resolved: true, winningOptionIndex: winner };
                            if (isClaimed) updated.claimed = true;
                            if (isRevealed) updated.revealed = true;
                            return updated;
                        }
                        return pi;
                    }));

                    if (isResolved || isRevealed) {
                        fetch(`${import.meta.env.VITE_API_URL}/api/polls/sync`, { method: 'POST' }).catch(() => {});
                    }
                }
            } catch {
                // Failed to verify poll
            }
        }

        setVerifying(false);
    };

    const handleReveal = async (pId: number, backendVote: VoteHistoryItem) => {
        if (!address) return;
        const salt = backendVote.salt;
        if (!salt) {
            onError("No Salt Found", "No salt found on server for this vote.");
            return;
        }

        try {
            const revealKey = `${pId}-${backendVote.commitmentIndex}`;
            setRevealingIndices(prev => new Set(prev).add(revealKey));

            await writeReveal({
                address: ORACLE_POLL_ADDRESS,
                abi: ORACLE_POLL_ABI,
                functionName: 'revealVote',
                args: [
                    BigInt(pId),
                    BigInt(backendVote.commitmentIndex),
                    BigInt(backendVote.optionIndex),
                    salt as Hex
                ]
            });

            onSuccess("Vote Revealed!", "Your vote is now visible on-chain!");
            fetchHistory();
        } catch (e: unknown) {
            onError("Reveal Failed", getErrorMessage(e));
        } finally {
            const revealKey = `${pId}-${backendVote.commitmentIndex}`;
            setRevealingIndices(prev => {
                const next = new Set(prev);
                next.delete(revealKey);
                return next;
            });
        }
    };

    const handleClaim = async (pId: number, commitmentIndex: number) => {
        if (!address || !publicClient) return;

        const claimKey = `${pId}-${commitmentIndex}`;
        setClaimingIndices(prev => new Set(prev).add(claimKey));

        try {
            const isClaimedOnChain = await publicClient.readContract({
                address: ORACLE_POLL_ADDRESS,
                abi: ORACLE_POLL_ABI,
                functionName: 'rewardClaimed',
                args: [BigInt(pId), address as `0x${string}`, BigInt(commitmentIndex)]
            });

            if (isClaimedOnChain) {
                onSuccess("Already Claimed", "You have already claimed this reward!");
                setHistory(prev => prev.map(item => {
                    if (item.pollInfo.contractPollId === pId) {
                        return { ...item, claimed: true };
                    }
                    return item;
                }));
                return;
            }

            await writeReveal({
                address: ORACLE_POLL_ADDRESS,
                abi: ORACLE_POLL_ABI,
                functionName: 'claimReward',
                args: [BigInt(pId), BigInt(commitmentIndex)],
                gas: 300000n
            });
            onSuccess("Reward Claimed!", "Funds sent to your wallet.");

            setHistory(prev => prev.map(item => {
                if (item.pollInfo.contractPollId === pId) {
                    return { ...item, claimed: true };
                }
                return item;
            }));

            await fetch(`${import.meta.env.VITE_API_URL}/api/users/record-win`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: address })
            }).catch(() => {});

        } catch (e: unknown) {
            onError("Claim Failed", getErrorMessage(e));
        } finally {
            setClaimingIndices(prev => {
                const next = new Set(prev);
                next.delete(claimKey);
                return next;
            });
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [address]);

    if (!address) return <div className="p-8 text-center font-bold text-gray-400">Please connect your wallet to view your profile.</div>;

    const totalWon = history.length * 0.001; // Mock calculation based on stake

    // Skeleton component for vote history cards
    const VoteHistorySkeleton = () => (
        <div className="space-y-4">
            {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 animate-pulse">
                    {/* Header skeleton */}
                    <div className="flex justify-between items-center mb-4">
                        <div className="h-3 w-16 bg-gray-200 rounded"></div>
                        <div className="h-3 w-24 bg-gray-200 rounded"></div>
                    </div>
                    {/* Title skeleton */}
                    <div className="h-5 w-3/4 bg-gray-200 rounded mb-3"></div>
                    {/* Tags skeleton */}
                    <div className="flex gap-2 mb-4">
                        <div className="h-5 w-20 bg-gray-100 rounded"></div>
                        <div className="h-5 w-24 bg-gray-100 rounded"></div>
                        <div className="h-5 w-16 bg-gray-100 rounded"></div>
                    </div>
                    {/* Button skeleton */}
                    <div className="h-12 w-full bg-gray-200 rounded-xl"></div>
                </div>
            ))}
        </div>
    );

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            <div className="flex items-center justify-between px-2">
                <div>
                    <h2 className="text-2xl font-display font-black text-gray-800">Your Profile</h2>
                    <p className="text-gray-400 font-bold text-xs uppercase tracking-wider">Stats & History</p>
                </div>
                <PremiumStatus />
            </div>

            {/* Create Poll Button for Premium Users */}
            {isPremium && (
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl shadow-xl shadow-purple-500/20 font-black text-lg transform transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                    <Sparkles className="animate-pulse" />
                    CREATE COMMUNITY POLL
                </button>
            )}

            {/* Create Poll Modal */}
            <CreatePollModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={(t, m) => onSuccess(t, m)}
                onError={(t, m) => onError(t, m)}
            />
            {/* Stats Card */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 grid grid-cols-2 gap-4">
                <div className="text-center">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total Votes</p>
                    <p className="text-3xl font-display font-black text-gray-800">{history.length}</p>
                </div>
                <div className="text-center">
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Est. Won</p>
                    <p className="text-3xl font-display font-black text-candy-mint">{totalWon.toFixed(3)} USDC</p>
                </div>
                {onLogout && (
                    <div className="col-span-2 pt-4 border-t border-gray-100 mt-2">
                        <button
                            onClick={onLogout}
                            className="w-full py-3 bg-gray-100 text-gray-400 font-bold rounded-xl hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center gap-2"
                        >
                            LOGOUT
                        </button>
                    </div>
                )}
            </div>

            <h3 className="text-lg font-display font-bold text-gray-800 px-2">
                Voting History
                {verifying && (
                    <span className="ml-2 text-xs font-normal text-gray-400">(syncing...)</span>
                )}
            </h3>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto px-2 pb-2 scrollbar-hide">
                {([
                    { key: 'ALL', label: 'All' },
                    { key: 'OPEN', label: 'Voting' },
                    { key: 'REVEAL', label: 'Revealing' },
                    { key: 'RESOLVED', label: 'Finished' },
                    { key: 'WON', label: 'Won' },
                    { key: 'LOST', label: 'Lost' }
                ] as const).map((f) => (
                    <button
                        key={f.key}
                        onClick={() => { setFilter(f.key); setPage(1); }}
                        className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold transition-colors whitespace-nowrap",
                            filter === f.key ? "bg-black text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                        )}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="space-y-4">
                {/* Show skeleton while loading or verifying */}
                {!isFullyLoaded ? (
                    <VoteHistorySkeleton />
                ) : paginatedHistory.length === 0 ? (
                    <p className="text-center py-10 text-gray-400 font-bold">
                        {history.length === 0 ? "No votes recorded yet." : "No votes match filter."}
                    </p>
                ) : null}

                {/* Show actual vote cards only when fully loaded */}
                {isFullyLoaded && paginatedHistory.map((item, idx) => {
                    const poll = item.pollInfo;
                    const isOpen = now < poll.commitEndTime;
                    const isRevealPhase = now >= poll.commitEndTime && now < poll.revealEndTime;
                    const hasEnded = now >= poll.revealEndTime;
                    const isResolved = poll.resolved;
                    const isWinner = isResolved && poll.winningOptionIndex === item.optionIndex;

                    const revealKey = `${poll.contractPollId}-${item.commitmentIndex}`;
                    const isRevealing = revealingIndices.has(revealKey);

                    // Format Date
                    const voteDate = new Date(item.createdAt || Date.now());
                    const dateStr = voteDate.toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    });

                    return (
                        <div key={idx} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col gap-4">

                            {/* Header: ID + Time */}
                            <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                <span>POLL #{poll.contractPollId}</span>
                                <span>{dateStr}</span>
                            </div>

                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <h4 className="font-bold text-gray-800 leading-tight mb-2 line-clamp-2">
                                        {poll.title}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-black text-gray-500 uppercase">
                                            Your Pick: {poll.options[item.optionIndex]}
                                        </span>
                                        <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-black text-gray-500 uppercase">
                                            Stake: 1000 USDC
                                        </span>
                                        <span className={cn(
                                            "text-[10px] font-black uppercase px-2 py-0.5 rounded",
                                            isResolved ? (isWinner ? "bg-green-500 text-white" : "bg-red-100 text-red-600") :
                                                (isOpen ? "bg-green-100 text-green-600" :
                                                    (isRevealPhase ? "bg-yellow-100 text-yellow-600" : "bg-gray-200 text-gray-500"))
                                        )}>
                                            {isResolved ? (isWinner ? "YOU WON!" : "YOU LOST") :
                                                (isOpen ? "VOTING OPEN" :
                                                    (isRevealPhase ? "REVEAL YOUR VOTE" : "AWAITING RESULTS"))}
                                        </span>
                                    </div>
                                    {isResolved && poll.winningOptionIndex !== undefined && (
                                        <div className="mt-2 text-[10px] font-bold text-gray-400">
                                            Winner: <span className="text-gray-600">{poll.options[poll.winningOptionIndex]}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                                {/* VOTE AGAIN Removed as requested */}

                                {isRevealPhase && !item.revealed && (
                                    <button
                                        onClick={() => handleReveal(poll.contractPollId, item)}
                                        disabled={isRevealing}
                                        aria-label="Reveal your vote"
                                        className="w-full py-3 bg-candy-yellow text-white rounded-xl text-xs font-bold shadow-lg shadow-candy-yellow/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-candy-yellow focus:ring-offset-2 flex items-center justify-center gap-2"
                                    >
                                        {isRevealing && (
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        )}
                                        {isRevealing ? "REVEALING..." : "REVEAL VOTE"}
                                    </button>
                                )}
                                {isRevealPhase && item.revealed && (
                                    <div className="w-full py-3 bg-gray-100 text-gray-400 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2">
                                        <CheckCircle size={14} /> REVEALED
                                    </div>
                                )}

                                {/* Show Resolve Button if ended but not resolved */}
                                {hasEnded && !isResolved && (() => {
                                    const isResolving = resolvingPolls.has(poll.contractPollId);
                                    return (
                                        <button
                                            onClick={() => setConfirmResolve({ pollId: poll.contractPollId, title: poll.title })}
                                            disabled={isResolving}
                                            aria-label="Resolve poll and determine winner"
                                            className="w-full py-3 bg-gray-900 text-white rounded-xl text-xs font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-offset-2 flex items-center justify-center gap-2"
                                        >
                                            {isResolving && (
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            )}
                                            <Gavel size={14} /> {isResolving ? "RESOLVING..." : "RESOLVE POLL"}
                                        </button>
                                    );
                                })()}

                                {isWinner && !item.claimed && (() => {
                                    const claimKey = `${poll.contractPollId}-${item.commitmentIndex}`;
                                    const isClaiming = claimingIndices.has(claimKey);
                                    return (
                                        <button
                                            onClick={() => handleClaim(poll.contractPollId, item.commitmentIndex)}
                                            disabled={isClaiming}
                                            aria-label="Claim your reward"
                                            className="w-full py-3 bg-candy-mint text-white rounded-xl text-xs font-bold shadow-lg shadow-candy-mint/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-candy-mint focus:ring-offset-2 flex items-center justify-center gap-2"
                                        >
                                            {isClaiming && (
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            )}
                                            <Trophy size={14} /> {isClaiming ? "CLAIMING..." : "CLAIM REWARD"}
                                        </button>
                                    );
                                })()}

                                {isWinner && item.claimed && (
                                    <button disabled className="w-full py-3 bg-green-100 text-green-600 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2 border border-green-200">
                                        <CheckCircle size={14} /> REWARD CLAIMED
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Pagination Controls */}
                {isFullyLoaded && totalPages > 1 && (
                    <div className="flex justify-center items-center gap-4 py-4">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="text-xs font-bold text-gray-400 disabled:opacity-30 hover:text-gray-800"
                        >
                            Previous
                        </button>
                        <span className="text-xs font-black text-gray-300">
                            P. {page} / {totalPages}
                        </span>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            className="text-xs font-bold text-gray-400 disabled:opacity-30 hover:text-gray-800"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>

            {/* Confirmation Modal for Resolving Poll */}
            <AnimatePresence>
                {confirmResolve && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setConfirmResolve(null)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl relative z-10"
                        >
                            <button
                                onClick={() => setConfirmResolve(null)}
                                className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                                aria-label="Close"
                            >
                                <X size={16} className="text-gray-500" />
                            </button>

                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="p-4 bg-yellow-100 rounded-full">
                                    <AlertTriangle size={32} className="text-yellow-600" />
                                </div>

                                <div>
                                    <h3 className="text-xl font-black text-gray-800 mb-2">Resolve Poll?</h3>
                                    <p className="text-sm text-gray-500 mb-1">
                                        You are about to finalize results for:
                                    </p>
                                    <p className="text-sm font-bold text-gray-700 line-clamp-2">
                                        "{confirmResolve.title}"
                                    </p>
                                </div>

                                <p className="text-xs text-gray-400">
                                    This action will calculate the winning option based on revealed votes. This cannot be undone.
                                </p>

                                <div className="flex gap-3 w-full mt-2">
                                    <button
                                        onClick={() => setConfirmResolve(null)}
                                        className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                                    >
                                        CANCEL
                                    </button>
                                    <button
                                        onClick={() => {
                                            const pollId = confirmResolve.pollId;
                                            setConfirmResolve(null);
                                            handleResolve(pollId);
                                        }}
                                        className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-offset-2 flex items-center justify-center gap-2"
                                    >
                                        <Gavel size={14} /> RESOLVE
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
