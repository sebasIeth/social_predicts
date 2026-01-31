
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Trophy, Gavel, CheckCircle, X } from 'lucide-react';
import { useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { type Hex } from 'viem';
import { ORACLE_POLL_ADDRESS, ORACLE_POLL_ABI } from '../../constants';
import { cn } from '../../utils';
import { PremiumStatus } from '../PremiumStatus';

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
    const [newPollTitle, setNewPollTitle] = useState('');
    const [newPollOptions, setNewPollOptions] = useState(['Yes', 'No', 'Maybe', 'Impossible']);
    const [isCreating, setIsCreating] = useState(false);
    const { writeContractAsync: writeCreatePoll } = useWriteContract();

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

    const handleCreatePoll = async () => {
        if (!address || !newPollTitle || newPollOptions.some(o => !o)) {
            onError("Invalid Input", "Please fill in all fields.");
            return;
        }
        setIsCreating(true);
        try {
            const commitDuration = 86400;
            const revealDuration = 3600;

            // 1. Create on-chain
            const hash = await writeCreatePoll({
                address: ORACLE_POLL_ADDRESS,
                abi: ORACLE_POLL_ABI,
                functionName: 'createPoll',
                args: [
                    newPollTitle,
                    newPollOptions,
                    BigInt(commitDuration),
                    BigInt(revealDuration)
                ]
            });
            onSuccess("Poll Created!", "Transaction sent. Waiting for confirmation...");
            await publicClient?.waitForTransactionReceipt({ hash });

            // 2. Fetch new poll ID to save metadata
            const nextId = await publicClient?.readContract({
                address: ORACLE_POLL_ADDRESS,
                abi: ORACLE_POLL_ABI,
                functionName: 'nextPollId',
            });
            const createdId = Number(nextId) - 1;

            // 3. Save to Backend with isCommunity: true
            const now = Math.floor(Date.now() / 1000);
            await fetch(`${import.meta.env.VITE_API_URL}/api/polls`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractPollId: createdId,
                    title: newPollTitle,
                    options: newPollOptions,
                    commitEndTime: now + commitDuration,
                    revealEndTime: now + commitDuration + revealDuration,
                    isCommunity: true
                })
            });

            onSuccess("Success!", "Community Poll Created Successfully!");
            setIsCreateModalOpen(false);
            setNewPollTitle('');
        } catch (e: any) {
            console.error("Create Poll Failed:", e);
            onError("Create Failed", e.message || "Unknown error");
        } finally {
            setIsCreating(false);
        }
    };

    const verifyStuckPolls = async (items: any[]) => {
        if (!publicClient) return;

        const pollsToCheck = items.filter(item => {
            const poll = item.pollInfo;
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
            <AnimatePresence>
                {isCreateModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white rounded-[2rem] p-6 w-full max-w-md shadow-2xl space-y-4"
                        >
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-display font-black text-gray-800">Create Poll</h3>
                                <button onClick={() => setIsCreateModalOpen(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                                    <X size={20} className="text-gray-500" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase ml-1">Title / Question</label>
                                    <input
                                        type="text"
                                        value={newPollTitle}
                                        onChange={(e) => setNewPollTitle(e.target.value)}
                                        placeholder="Who will win..."
                                        className="w-full p-4 bg-gray-50 rounded-xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase ml-1">Options (Max 4)</label>
                                    {newPollOptions.map((opt, idx) => (
                                        <input
                                            key={idx}
                                            type="text"
                                            value={opt}
                                            onChange={(e) => {
                                                const newOpts = [...newPollOptions];
                                                newOpts[idx] = e.target.value;
                                                setNewPollOptions(newOpts);
                                            }}
                                            className="w-full p-3 bg-gray-50 rounded-xl font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                                            placeholder={`Option ${idx + 1}`}
                                        />
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleCreatePoll}
                                disabled={isCreating}
                                className="w-full py-4 bg-gray-900 text-white rounded-xl font-black text-lg disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isCreating ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : "LAUNCH POLL 🚀"}
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
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

            <div className="space-y-4">
                {history.length === 0 && <p className="text-center py-10 text-gray-400 font-bold">No votes recorded yet.</p>}
                {history.map((item, idx) => {
                    const poll = item.pollInfo;
                    const isOpen = now < poll.commitEndTime;
                    const isRevealPhase = now >= poll.commitEndTime && now < poll.revealEndTime;
                    const hasEnded = now >= poll.revealEndTime;
                    const isResolved = poll.resolved;
                    const isWinner = isResolved && poll.winningOptionIndex === item.optionIndex;

                    const revealKey = `${poll.contractPollId}-${item.commitmentIndex}`;
                    const isRevealing = revealingIndices.has(revealKey);

                    return (
                        <div key={idx} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col gap-4">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <h4 className="font-bold text-gray-800 leading-tight mb-2 line-clamp-2">
                                        {poll.title}
                                    </h4>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-black text-gray-500 uppercase">
                                            Voted: {poll.options[item.optionIndex]}
                                        </span>
                                        <span className={cn(
                                            "text-[10px] font-black uppercase px-2 py-0.5 rounded",
                                            isResolved ? (isWinner ? "bg-green-500 text-white" : "bg-red-100 text-red-600") :
                                                (isOpen ? "bg-green-100 text-green-600" :
                                                    (isRevealPhase ? "bg-yellow-100 text-yellow-600" : "bg-gray-200 text-gray-500"))
                                        )}>
                                            {isResolved ? (isWinner ? "WINNER!" : "LOST") :
                                                (isOpen ? "OPEN" :
                                                    (isRevealPhase ? "REVEAL PHASE" : "PENDING RESOLUTION"))}
                                        </span>
                                    </div>
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
            </div>
        </motion.div>
    );
}
