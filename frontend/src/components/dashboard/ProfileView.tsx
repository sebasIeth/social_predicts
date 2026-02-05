
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Trophy, Gavel, CheckCircle } from 'lucide-react';
import { useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { type Hex } from 'viem';
import { ORACLE_POLL_ADDRESS, ORACLE_POLL_ABI } from '../../constants';
import { cn } from '../../utils';
import { PremiumStatus } from '../PremiumStatus';
import { CreatePollModal } from './CreatePollModal';

interface ProfileViewProps {
    address: string | undefined;
    now: number;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
    onLogout?: () => void;
}

export function ProfileView({ address, now, onSuccess, onError, onLogout }: ProfileViewProps) {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { writeContractAsync: writeReveal } = useWriteContract();
    const [revealingIndices, setRevealingIndices] = useState<Set<string>>(new Set());
    const publicClient = usePublicClient();

    // Filters & Pagination
    const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'REVEAL' | 'RESOLVED' | 'WON' | 'LOST'>('ALL');
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    const filteredHistory = history.filter(item => {
        const poll = item.pollInfo;
        if (!poll) return false;

        const isOpen = now < poll.commitEndTime;

        const isRevealPhase = now >= poll.commitEndTime && now < poll.revealEndTime;
        // const hasEnded = now >= poll.revealEndTime;
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
        try {
            // 1. Check on-chain status first
            const onChainPoll = await publicClient.readContract({
                address: ORACLE_POLL_ADDRESS,
                abi: ORACLE_POLL_ABI,
                functionName: 'polls', // [id, question, commitEnd, revealEnd, totalStake, resolved, winner]
                args: [BigInt(pId)]
            });

            const isResolvedOnChain = onChainPoll[5];
            const winningOptionIndex = Number(onChainPoll[6]);

            // Helper to update local state immediately
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
                // Background sync
                fetch(`${import.meta.env.VITE_API_URL}/api/polls/sync`, { method: 'POST' }).catch(console.error).then(() => fetchHistory());
                return;
            }

            const hash = await writeReveal({
                address: ORACLE_POLL_ADDRESS,
                abi: ORACLE_POLL_ABI,
                functionName: 'resolvePoll',
                args: [BigInt(pId)]
            });
            console.log("Resolve Hash:", hash);
            await publicClient.waitForTransactionReceipt({ hash });

            onSuccess("Poll Resolved!", "Computing winners...");

            // We need to re-fetch the winner from chain to know who won
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

            // Background sync
            fetch(`${import.meta.env.VITE_API_URL}/api/polls/sync`, { method: 'POST' }).catch(console.error).then(() => fetchHistory());

        } catch (e: any) {
            console.error(e);
            const msg = e.details || e.shortMessage || e.message || "Unknown error";
            if (msg.includes("Resolution time not reached")) {
                onError("Cannot Resolve", "Reveal phase not fully ended on-chain.");
            } else {
                onError("Resolve Failed", msg);
            }
        }
    };


    const fetchHistory = async () => {
        if (!address) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/votes/user/${address}`);
            const data = await res.json();
            setHistory(data);
            verifyStuckPolls(data);
        } catch (err) {
            console.error(err);
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



    const verifyStuckPolls = async (items: any[]) => {
        if (!publicClient) return;

        const pollsToCheck = items.filter(item => {
            const poll = item.pollInfo;
            if (!poll) return false;

            // Check if stuck (ended but not resolved) OR won (need to check claim status)
            const stuck = (now >= poll.revealEndTime && !poll.resolved);
            const won = (poll.resolved && poll.winningOptionIndex === item.optionIndex);
            // Also check if in reveal phase but not marked as revealed
            const revealPhase = (now >= poll.commitEndTime && now < poll.revealEndTime && !item.revealed);
            return stuck || won || revealPhase;
        });

        if (pollsToCheck.length === 0) return;

        console.log(`Verifying ${pollsToCheck.length} polls for resolution/claim/reveal status...`);

        for (const item of pollsToCheck) {
            // Add throttling to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));

            try {
                const pId = item.pollInfo.contractPollId;

                // 1. Check Poll State
                const onChainPoll = await publicClient.readContract({
                    address: ORACLE_POLL_ADDRESS,
                    abi: ORACLE_POLL_ABI,
                    functionName: 'polls',
                    args: [BigInt(pId)]
                });

                const isResolved = onChainPoll[5];
                const winner = Number(onChainPoll[6]);

                // 2. Check Claim Status (if winner)
                let isClaimed = item.claimed;
                if (isResolved && winner === item.optionIndex) {
                    try {
                        isClaimed = await publicClient.readContract({
                            address: ORACLE_POLL_ADDRESS,
                            abi: ORACLE_POLL_ABI,
                            functionName: 'rewardClaimed',
                            args: [BigInt(pId), address as `0x${string}`, BigInt(item.commitmentIndex)]
                        });
                    } catch (e) {
                        console.warn("Failed to check claim status", e);
                    }
                }

                // 3. Check Reveal Status (if in reveal phase and not revealed)
                let isRevealed = item.revealed;
                if (!isRevealed && now >= item.pollInfo.commitEndTime && now < item.pollInfo.revealEndTime) {
                    try {
                        // Use the optimized View function from the contract
                        const hasRevealedOnChain = await publicClient.readContract({
                            address: ORACLE_POLL_ADDRESS,
                            abi: ORACLE_POLL_ABI,
                            functionName: 'hasRevealed',
                            args: [BigInt(pId), address as `0x${string}`, BigInt(item.commitmentIndex)]
                        });

                        if (hasRevealedOnChain) {
                            console.log(`Verified reveal via hasRevealed():`, item.commitmentIndex);
                            isRevealed = true;
                        }
                    } catch (e) {
                        console.warn("Failed to check hasRevealed status", e);
                    }
                }

                if (isResolved || isClaimed !== item.claimed || isRevealed !== item.revealed) {
                    console.log(`Updating poll ${pId}: Resolved=${isResolved}, Claimed=${isClaimed}, Revealed=${isRevealed}`);

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

                    // Trigger backend sync silently if meaningful change
                    if (isResolved || isRevealed) {
                        fetch(`${import.meta.env.VITE_API_URL}/api/polls/sync`, { method: 'POST' }).catch(() => { });
                    }
                }
            } catch (e) {
                console.error("Failed to verify poll", item.pollInfo.contractPollId, e);
            }
        }
    };

    const handleReveal = async (pId: number, backendVote: any) => {
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

            onSuccess("Vote Revealed!", "Vote Revealed on-chain!");
            fetchHistory();
        } catch (e: any) {
            console.error(e);
            const msg = e.details || e.shortMessage || e.message || "An unexpected error occurred.";
            onError("Reveal Failed", msg);
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
        try {
            // 1. Check if already claimed on-chain
            const isClaimedOnChain = await publicClient.readContract({
                address: ORACLE_POLL_ADDRESS,
                abi: ORACLE_POLL_ABI,
                functionName: 'rewardClaimed',
                args: [BigInt(pId), address as `0x${string}`, BigInt(commitmentIndex)]
            });

            if (isClaimedOnChain) {
                onSuccess("Already Claimed", "You have already claimed this reward! ✅");
                // Update local state immediately
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

            // Update local state immediately
            setHistory(prev => prev.map(item => {
                if (item.pollInfo.contractPollId === pId) {
                    return { ...item, claimed: true };
                }
                return item;
            }));

            // Record win in backend
            try {
                await fetch(`${import.meta.env.VITE_API_URL}/api/users/record-win`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ walletAddress: address })
                });
            } catch (err) {
                console.error("Failed to record win:", err);
            }

        } catch (e: any) {
            console.error(e);
            const msg = e.details || e.shortMessage || e.message || "An unexpected error occurred.";
            onError("Claim Failed", msg);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [address]);

    if (!address) return <div className="p-8 text-center font-bold text-gray-400">Please connect your wallet to view your profile.</div>;
    if (loading) return <div className="p-8 text-center text-gray-400">Loading History...</div>;

    const totalWon = history.length * 0.001; // Mock calculation based on stake

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

            <h3 className="text-lg font-display font-bold text-gray-800 px-2">Voting History</h3>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto px-2 pb-2 scrollbar-hide">
                {(['ALL', 'OPEN', 'REVEAL', 'RESOLVED', 'WON', 'LOST'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => { setFilter(f); setPage(1); }}
                        className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold transition-colors whitespace-nowrap",
                            filter === f ? "bg-black text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                        )}
                    >
                        {f}
                    </button>
                ))}
            </div>

            <div className="space-y-4">
                {paginatedHistory.length === 0 && (
                    <p className="text-center py-10 text-gray-400 font-bold">
                        {history.length === 0 ? "No votes recorded yet." : "No votes match filter."}
                    </p>
                )}
                {paginatedHistory.map((item, idx) => {
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
                                            {isResolved ? (isWinner ? "WON!" : "LOST") :
                                                (isOpen ? "OPEN" :
                                                    (isRevealPhase ? "REVEAL PHASE" : "PENDING RESOLUTION"))}
                                        </span>
                                    </div>
                                    {isResolved && (
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
                                        className="w-full py-3 bg-candy-yellow text-white rounded-xl text-xs font-bold shadow-lg shadow-candy-yellow/20 hover:scale-[1.02] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isRevealing ? "REVEALING..." : "REVEAL VOTE"}
                                    </button>
                                )}
                                {isRevealPhase && item.revealed && (
                                    <div className="w-full py-3 bg-gray-100 text-gray-400 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2">
                                        <CheckCircle size={14} /> REVEALED
                                    </div>
                                )}

                                {/* Show Resolve Button if ended but not resolved */}
                                {hasEnded && !isResolved && (
                                    <button
                                        onClick={() => handleResolve(poll.contractPollId)}
                                        className="w-full py-3 bg-gray-900 text-white rounded-xl text-xs font-bold shadow-lg hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                                    >
                                        <Gavel size={14} /> RESOLVE POLL
                                    </button>
                                )}

                                {isWinner && !item.claimed && (
                                    <button
                                        onClick={() => handleClaim(poll.contractPollId, item.commitmentIndex)}
                                        className="w-full py-3 bg-candy-mint text-white rounded-xl text-xs font-bold shadow-lg shadow-candy-mint/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                                    >
                                        <Trophy size={14} /> CLAIM REWARD
                                    </button>
                                )}

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
                {totalPages > 1 && (
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
        </motion.div>
    );
}
