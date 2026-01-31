
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sdk } from '@farcaster/miniapp-sdk';
import { OpenfortButton, useSignOut } from "@openfort/react";
import { Sparkles, Trophy, Unlock, Zap, Wallet } from 'lucide-react';
import { useAccount, useConnect, useDisconnect, useReadContract, useWatchContractEvent, useWriteContract } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { formatUnits } from 'viem';

import { ORACLE_POLL_ADDRESS, ORACLE_POLL_ABI } from '../constants';
import { cn, formatTime } from '../utils';

// Components
import { FeedbackModal } from '../components/ui/FeedbackModal';
import { NavButton } from '../components/ui/NavButton';
import { VotingGrid } from '../components/dashboard/VotingGrid';
import { RevealZone } from '../components/dashboard/RevealZone';
import { LeaderboardView } from '../components/dashboard/LeaderboardView';
import { ProfileView } from '../components/dashboard/ProfileView';

export function Dashboard() {
    const [activeTab, setActiveTab] = useState<'VOTE' | 'REVEAL' | 'LEADERBOARD' | 'PROFILE'>('VOTE');
    const { address, isConnected, connector } = useAccount();
    const [isMiniApp, setIsMiniApp] = useState(connector?.id === 'farcaster');
    const { connect } = useConnect();
    const { disconnect } = useDisconnect();
    const { signOut } = useSignOut();

    const [feedbackModal, setFeedbackModal] = useState<{ type: 'success' | 'error', title: string, message: string, isOpen: boolean } | null>(null);

    useEffect(() => {
        if (connector?.id === 'farcaster') {
            setIsMiniApp(true);
        }

        const init = async () => {
            // Check if running in Farcaster
            if (typeof window !== 'undefined' && (window as any).farcaster) {
                setIsMiniApp(true);
                try {
                    await sdk.actions.ready();
                } catch (e) {
                    console.error("Farcaster SDK Error:", e);
                }
            }
        };
        init();
    }, [connector]);

    const handleLogout = async () => {
        try {
            await signOut();
            disconnect();
        } catch (err) {
            console.error("Logout failed", err);
        }
    };

    const [pollType, setPollType] = useState<'official' | 'community'>('official');
    const [pollsList, setPollsList] = useState<any[]>([]);
    const [selectedPollId, setSelectedPollId] = useState<number | null>(null);

    // Fetch Polls List
    useEffect(() => {
        const fetchPolls = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/polls?type=${pollType}`);
                const data = await res.json();
                setPollsList(data);
                // Default to latest official poll if on official tab and nothing selected
                if (pollType === 'official' && data.length > 0 && selectedPollId === null) {
                    setSelectedPollId(data[0].contractPollId);
                }
            } catch (err) {
                console.error("Failed to fetch polls", err);
            }
        };
        fetchPolls();
    }, [pollType, selectedPollId]); // Add selectedPollId dependency only if we want auto-select behavior

    // 1. Get Poll ID (Used for bounds, but we rely on selectedPollId now)
    const { data: nextPollId } = useReadContract({
        address: ORACLE_POLL_ADDRESS,
        abi: ORACLE_POLL_ABI,
        functionName: 'nextPollId',
    });

    const activePollId = selectedPollId !== null ? selectedPollId : (nextPollId ? Number(nextPollId) - 1 : 0);

    // 2. Get Poll Data specific to selected/active poll
    const { data: pollData, refetch: refetchPoll } = useReadContract({
        address: ORACLE_POLL_ADDRESS,
        abi: ORACLE_POLL_ABI,
        functionName: 'polls',
        args: [BigInt(activePollId)],
        query: {
            enabled: activePollId >= 0,
        }
    });

    useWatchContractEvent({
        address: ORACLE_POLL_ADDRESS,
        abi: ORACLE_POLL_ABI,
        eventName: 'VoteCommitted',
        onLogs() {
            console.log('Vote committed! Refetching poll data...');
            refetchPoll();
        },
    });

    useWatchContractEvent({
        address: ORACLE_POLL_ADDRESS,
        abi: ORACLE_POLL_ABI,
        eventName: 'VoteRevealed',
        onLogs() {
            console.log('Vote revealed! Refetching poll data...');
            refetchPoll();
        },
    });

    /* 3. Get Options for Active Poll */
    const { data: options } = useReadContract({
        address: ORACLE_POLL_ADDRESS,
        abi: ORACLE_POLL_ABI,
        functionName: 'getPollOptions',
        args: [BigInt(activePollId)],
        query: {
            enabled: activePollId >= 0,
        }
    });

    // Ticker for countdowns
    const [now, setNow] = useState(Math.floor(Date.now() / 1000));
    useEffect(() => {
        const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
        return () => clearInterval(timer);
    }, []);

    let phase: 'COMMIT' | 'REVEAL' | 'RESULT' = 'COMMIT';

    if (pollData) {
        const commitEnd = Number(pollData[2]);
        const revealEnd = Number(pollData[3]);
        if (now < commitEnd) phase = 'COMMIT';
        else if (now < revealEnd) phase = 'REVEAL';
        else phase = 'RESULT';
    }

    // Sync poll with backend
    const lastSyncedId = useRef<number | null>(null);
    useEffect(() => {
        if (pollData && pollData[1] && options && lastSyncedId.current !== activePollId) {
            lastSyncedId.current = activePollId;
            fetch(`${import.meta.env.VITE_API_URL}/api/polls`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contractPollId: activePollId,
                    title: pollData[1],
                    options: options || [],
                    commitEndTime: Number(pollData[2]),
                    revealEndTime: Number(pollData[3])
                })
            }).catch(err => {
                console.error("Sync Error:", err);
                lastSyncedId.current = null; // Allow retry on error
            });
        }
    }, [activePollId, pollData, options]);

    // Dev only create poll
    const { writeContractAsync } = useWriteContract();
    const handleCreatePoll = async () => {
        try {
            if (!address) return;
            const title = "Will Bitcoin hit $100k in 2026? 🚀";
            const options = ["Yes", "No", "Maybe"];
            const commitDuration = 120; // 2 mins
            const revealDuration = 120; // 2 mins

            await writeContractAsync({
                address: ORACLE_POLL_ADDRESS,
                abi: ORACLE_POLL_ABI,
                functionName: 'createPoll',
                args: [
                    title,
                    options,
                    BigInt(commitDuration),
                    BigInt(revealDuration)
                ]
            });
            alert("Poll Created! Refresh in a few seconds.");
        } catch (e) {
            console.error(e);
            alert("Failed to create poll");
        }
    };

    const showSuccess = (title: string, message: string) => {
        setFeedbackModal({ isOpen: true, type: 'success', title, message });
    };

    const showError = (title: string, message: string) => {
        setFeedbackModal({ isOpen: true, type: 'error', title, message });
    };

    return (
        <div className="md:flex md:items-center md:justify-center md:min-h-screen md:bg-zinc-200">
            <div className="w-full h-full md:w-[414px] md:h-[860px] md:rounded-[3rem] md:border-[10px] md:border-zinc-900 md:shadow-2xl md:overflow-hidden bg-paper relative">
                <div className="h-full overflow-y-auto scrollbar-hide">
                    <div className="min-h-full pb-40 font-sans text-orange-950 selection:bg-candy-yellow/30">
                        {/* Playful Header */}
                        <header className="px-6 pt-12 pb-6 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-candy-purple rounded-2xl rotate-3 flex items-center justify-center shadow-lg">
                                    <Sparkles className="text-white w-6 h-6" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-display font-black text-gray-800 tracking-tight">Oracle</h1>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Polls</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {!isMiniApp ? (
                                    <div className="scale-90">
                                        <OpenfortButton />
                                    </div>
                                ) : (
                                    !isConnected ? (
                                        <button
                                            onClick={() => connect({ connector: injected() })}
                                            className="px-4 py-2 bg-black text-white rounded-2xl text-xs font-bold hover:scale-95 transition-transform flex items-center gap-2"
                                        >
                                            <Wallet size={14} /> Connect
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => disconnect()}
                                            className={cn(
                                                "px-4 py-2 bg-white border-2 border-gray-100 rounded-2xl text-xs font-bold text-gray-500 transition-colors",
                                                "hover:bg-gray-50 cursor-pointer"
                                            )}
                                        >
                                            {address?.slice(0, 6)}...{address?.slice(-4)}
                                        </button>
                                    ))}
                            </div>

                            {/* Debug: Create Poll Button (Dev Only) */}
                            {import.meta.env.DEV && isConnected && (
                                <button
                                    onClick={handleCreatePoll}
                                    className="px-3 py-2 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 ml-2 hidden md:block"
                                >
                                    + Poll
                                </button>
                            )}
                        </header>

                        {/* Main Grid Layout */}
                        <main className="px-4 space-y-4">

                            {/* Hero Card: The Question */}
                            {activeTab !== 'LEADERBOARD' && activeTab !== 'PROFILE' && (
                                <motion.div
                                    layout
                                    className="bg-white rounded-[2.5rem] p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border-b-8 border-gray-100 relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-candy-yellow/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />

                                    <div className="flex items-center gap-2 mb-4">
                                        <span className={cn(
                                            "px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider",
                                            phase === 'COMMIT' ? "bg-candy-mint/20 text-candy-mint" :
                                                phase === 'REVEAL' ? "bg-candy-yellow/20 text-yellow-600" :
                                                    "bg-gray-100 text-gray-400"
                                        )}>
                                            {phase} PHASE
                                        </span>
                                        <span className="text-xs font-bold text-gray-400">
                                            {pollData && phase === 'COMMIT' && `Ends in ${formatTime(Number(pollData[2]) - now)}`}
                                            {pollData && phase === 'REVEAL' && `Ends in ${formatTime(Number(pollData[3]) - now)}`}
                                        </span>
                                    </div>

                                    <h2 className="text-3xl font-display font-bold leading-tight mb-6 text-gray-800">
                                        {pollData ? pollData[1] : "Loading Poll..."}
                                    </h2>

                                    {/* Stake Info */}
                                    <div className="flex flex-col items-start gap-3 mb-8">
                                        <div className="px-3 py-1 bg-gray-50 rounded-lg text-xs font-bold text-gray-500">
                                            Total Stake: {pollData ? formatUnits(pollData[4], 6) : '0'} USDC
                                        </div>

                                        {pollData && Number(pollData[4]) > 0 && (
                                            <div className="flex items-center gap-2">
                                                <div className="flex -space-x-3">
                                                    {[1, 2, 3].map((i) => (
                                                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 overflow-hidden">
                                                            <img
                                                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${(Number(pollData[4]) + i) * 123}`}
                                                                alt="Voter"
                                                                className="w-full h-full"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                                <span className="text-xs font-bold text-gray-500">
                                                    +{(Number(pollData[4]) / 1000).toString()} Voters
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {/* Action Area */}
                            <AnimatePresence mode="wait">
                                {activeTab === 'VOTE' && (
                                    <motion.div
                                        key="vote"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-6"
                                    >

                                        {/* Community / Official Toggle */}
                                        <div className="flex p-1 bg-gray-100 rounded-2xl mb-4">
                                            <button
                                                onClick={() => { setPollType('official'); setSelectedPollId(null); }}
                                                className={cn(
                                                    "flex-1 py-3 rounded-xl font-bold text-sm transition-all",
                                                    pollType === 'official' ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600"
                                                )}
                                            >
                                                OFFICIAL
                                            </button>
                                            <button
                                                onClick={() => { setPollType('community'); setSelectedPollId(null); }}
                                                className={cn(
                                                    "flex-1 py-3 rounded-xl font-bold text-sm transition-all",
                                                    pollType === 'community' ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600"
                                                )}
                                            >
                                                Here Community
                                            </button>
                                        </div>

                                        {/* If Community Tab and No Poll Selected, Show List */}
                                        {pollType === 'community' && selectedPollId === null ? (
                                            <div className="space-y-4">
                                                {pollsList.length === 0 && (
                                                    <div className="text-center py-10 text-gray-400 font-bold">
                                                        No community polls yet. be the first!
                                                    </div>
                                                )}
                                                {pollsList.map((p) => (
                                                    <div
                                                        key={p.contractPollId}
                                                        onClick={() => setSelectedPollId(p.contractPollId)}
                                                        className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 cursor-pointer hover:scale-[1.02] transition-transform active:scale-95"
                                                    >
                                                        <h3 className="font-bold text-lg text-gray-800 mb-2">{p.title}</h3>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-xs font-bold text-gray-400 uppercase">Ends in {formatTime(p.commitEndTime - (Date.now() / 1000))}</span>
                                                            <button className="px-4 py-2 bg-candy-purple text-white rounded-xl text-xs font-bold">Vote</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <>
                                                {/* Back Button for Community Polls */}
                                                {pollType === 'community' && (
                                                    <button
                                                        onClick={() => setSelectedPollId(null)}
                                                        className="mb-2 text-xs font-bold text-gray-400 hover:text-gray-600 flex items-center gap-1"
                                                    >
                                                        ← Back to List
                                                    </button>
                                                )}

                                                {/* Existing Poll Card Logic but using pollData (which is now dynamic) */}
                                                {pollData ? (
                                                    <VotingGrid
                                                        key="vote"
                                                        pollId={activePollId}
                                                        options={options || []}
                                                        enabled={phase === 'COMMIT'}
                                                        onSuccess={showSuccess}
                                                        onError={showError}
                                                        onVoteSuccess={() => {
                                                            refetchPoll();
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="text-center py-20 text-gray-400">Loading Poll...</div>
                                                )}
                                            </>
                                        )}

                                    </motion.div>
                                )}
                                {activeTab === 'REVEAL' && (
                                    <RevealZone
                                        key="reveal"
                                        onSuccess={showSuccess}
                                        onError={showError}
                                    />
                                )}
                                {activeTab === 'LEADERBOARD' && <LeaderboardView key="leader" />}
                                {activeTab === 'PROFILE' && (
                                    <ProfileView
                                        key="profile"
                                        address={address}
                                        now={now}
                                        onSuccess={showSuccess}
                                        onError={showError}
                                        onLogout={handleLogout}
                                    />
                                )}
                            </AnimatePresence>

                        </main>
                    </div>
                </div>

                {/* Floating Bottom Nav */}
                <nav className={cn(
                    "bg-white/90 backdrop-blur-md flex justify-between items-center z-50 transition-all",
                    isMiniApp
                        ? "fixed bottom-0 left-0 right-0 px-8 py-5 pb-8 rounded-t-[2.5rem] border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]"
                        : "absolute bottom-6 left-6 right-6 p-2 rounded-[2rem] shadow-[0_20px_40px_-5px_rgba(0,0,0,0.1)] border border-white/50 bg-white/90"
                )}>
                    <NavButton
                        active={activeTab === 'VOTE'}
                        onClick={() => setActiveTab('VOTE')}
                        icon={<Zap />}
                        label="Vote"
                        color="bg-candy-pink"
                    />
                    <NavButton
                        active={activeTab === 'REVEAL'}
                        onClick={() => setActiveTab('REVEAL')}
                        icon={<Unlock />}
                        label="Reveal"
                        color="bg-candy-yellow"
                    />
                    <NavButton
                        active={activeTab === 'LEADERBOARD'}
                        onClick={() => setActiveTab('LEADERBOARD')}
                        icon={<Trophy />}
                        label="Ranks"
                        color="bg-candy-purple"
                    />
                    <NavButton
                        active={activeTab === 'PROFILE'}
                        onClick={() => setActiveTab('PROFILE')}
                        icon={<Wallet />}
                        label="Profile"
                        color="bg-zinc-800"
                    />
                </nav>

                {/* Feedback Modal */}
                <AnimatePresence>
                    {feedbackModal && feedbackModal.isOpen && (
                        <FeedbackModal
                            type={feedbackModal.type}
                            title={feedbackModal.title}
                            message={feedbackModal.message}
                            onClose={() => setFeedbackModal(null)}
                        />
                    )}
                </AnimatePresence>
            </div>
        </div >
    );
}
