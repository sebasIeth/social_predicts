
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sdk } from '@farcaster/miniapp-sdk';
import { OpenfortButton, useSignOut } from "@openfort/react";
import { Sparkles, Trophy, Unlock, Zap, Wallet, CheckCircle, Ghost, Crown, LayoutDashboard, HelpCircle } from 'lucide-react';
import { useAccount, useConnect, useDisconnect, useReadContract, useWatchContractEvent } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { formatUnits } from 'viem';

import { ORACLE_POLL_ADDRESS, ORACLE_POLL_ABI } from '../constants';
import { cn, formatTime } from '../utils';

// Components
import { FeedbackModal } from '../components/ui/FeedbackModal';
import { NavButton } from '../components/ui/NavButton';
import { OnboardingModal } from '../components/ui/OnboardingModal';
import { VotingGrid } from '../components/dashboard/VotingGrid';
import { RevealZone } from '../components/dashboard/RevealZone';
import { LeaderboardView } from '../components/dashboard/LeaderboardView';
import { ProfileView } from '../components/dashboard/ProfileView';
import { CreatePollModal } from '../components/dashboard/CreatePollModal';
import { MyPollsView } from '../components/dashboard/MyPollsView';


export function Dashboard() {
    const [activeTab, setActiveTab] = useState<'VOTE' | 'REVEAL' | 'LEADERBOARD' | 'PROFILE' | 'MYPOLLS'>('VOTE');
    const { address, isConnected, connector } = useAccount();
    const [isMiniApp, setIsMiniApp] = useState(connector?.id === 'farcaster');
    const [username, setUsername] = useState<string | null>(null);
    const { connect } = useConnect();
    const { disconnect } = useDisconnect();
    const { signOut } = useSignOut();

    const [feedbackModal, setFeedbackModal] = useState<{ type: 'success' | 'error', title: string, message: string, isOpen: boolean } | null>(null);

    // Onboarding state
    const [showOnboarding, setShowOnboarding] = useState(false);

    // Check if first time user on mount
    useEffect(() => {
        const hasSeenOnboarding = localStorage.getItem('oracle_polls_onboarding_complete');
        if (!hasSeenOnboarding) {
            // Small delay to let the app load first
            const timer = setTimeout(() => setShowOnboarding(true), 500);
            return () => clearTimeout(timer);
        }
    }, []);

    useEffect(() => {
        if (connector?.id === 'farcaster') {
            setIsMiniApp(true);
        }

        const init = async () => {
            // Check if running in Farcaster
            try {
                // Always attempt to initialize SDK in case we are in a frame
                await sdk.actions.ready();
                const context = await sdk.context;
                if (context?.user) {
                    const name = context.user.displayName || context.user.username || null;
                    setUsername(name);
                    setIsMiniApp(true);

                    // Sync Alias to Backend if we have an address
                    if (address && name) {
                        fetch(`${import.meta.env.VITE_API_URL}/api/users/update`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ walletAddress: address, alias: name })
                        }).catch(() => {});
                    }
                }
            } catch {
                // Not in Farcaster frame
            }
        };
        init();
    }, [connector]);

    const handleLogout = async () => {
        try {
            await signOut();
            disconnect();
        } catch {
            // Logout failed
        }
    };

    interface PollListItem {
        contractPollId: number;
        title: string;
        options: string[];
        commitEndTime: number;
        revealEndTime: number;
        isCommunity: boolean;
        creator?: string;
    }

    const [pollType, setPollType] = useState<'official' | 'community'>('official');
    const [pollsList, setPollsList] = useState<PollListItem[]>([]);
    const [isLoadingList, setIsLoadingList] = useState(true);
    const [selectedPollId, setSelectedPollId] = useState<number | null>(null);

    // Filter & Pagination State
    const [communityFilter, setCommunityFilter] = useState<'ALL' | 'LIVE' | 'REVEALING' | 'ENDED'>('ALL');
    const [communityPage, setCommunityPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    // Create Poll Modal State
    const [isCreatePollModalOpen, setIsCreatePollModalOpen] = useState(false);

    // Derived Logic for Community Polls
    const filteredCommunityPolls = pollsList.filter(p => {
        if (pollType !== 'community') return false;
        const nowSec = Date.now() / 1000;
        if (communityFilter === 'ALL') return true;
        if (communityFilter === 'LIVE') return nowSec < p.commitEndTime; // Voting
        if (communityFilter === 'REVEALING') return nowSec >= p.commitEndTime && nowSec < p.revealEndTime;
        if (communityFilter === 'ENDED') return nowSec >= p.revealEndTime;
        return true;
    });
    const totalPages = Math.ceil(filteredCommunityPolls.length / ITEMS_PER_PAGE);
    const paginatedCommunityPolls = filteredCommunityPolls.slice(
        (communityPage - 1) * ITEMS_PER_PAGE,
        communityPage * ITEMS_PER_PAGE
    );

    const [historyPage, setHistoryPage] = useState(1);
    const HISTORY_PER_PAGE = 3;

    useEffect(() => {
        const fetchPolls = async () => {
            setIsLoadingList(true);
            try {
                // Minimum loading time for smooth transition
                const minLoadTime = new Promise(resolve => setTimeout(resolve, 800));
                const fetchPromise = fetch(`${import.meta.env.VITE_API_URL}/api/polls?type=${pollType}`);

                const [res] = await Promise.all([fetchPromise, minLoadTime]);

                if (!res.ok) return;
                const data: PollListItem[] = await res.json();
                setPollsList(data);
            } catch {
                // Failed to fetch polls
            } finally {
                setIsLoadingList(false);
            }
        };
        fetchPolls();
    }, [pollType, selectedPollId]);

    let activePollId = -1;
    if (selectedPollId !== null) {
        activePollId = selectedPollId;
    } else if (pollType === 'official' && pollsList.length > 0 && pollsList[0].isCommunity === false) {
        activePollId = pollsList[0].contractPollId;
    }

    const historyPolls = pollsList.filter(p => !p.isCommunity && p.contractPollId !== activePollId);
    const totalHistoryPages = Math.ceil(historyPolls.length / HISTORY_PER_PAGE);
    const paginatedHistoryPolls = historyPolls.slice(
        (historyPage - 1) * HISTORY_PER_PAGE,
        historyPage * HISTORY_PER_PAGE
    );

    // --- DATA FOR DISPLAY ---
    const { data: pollData, refetch: refetchPoll } = useReadContract({
        address: ORACLE_POLL_ADDRESS,
        abi: ORACLE_POLL_ABI,
        functionName: 'polls',
        args: [BigInt(activePollId >= 0 ? activePollId : 0)], // Safe fallback if -1
        query: { enabled: activePollId >= 0 }
    });

    const { data: contractOptions } = useReadContract({
        address: ORACLE_POLL_ADDRESS,
        abi: ORACLE_POLL_ABI,
        functionName: 'getPollOptions',
        args: [BigInt(activePollId >= 0 ? activePollId : 0)],
        query: { enabled: activePollId >= 0 }
    });

    // Use contract options if available, otherwise fallback to database options
    const activePollFromDb = pollsList.find(p => p.contractPollId === activePollId);

    // Validate that options are non-empty strings, otherwise fallback to DB
    const hasValidContractOptions = contractOptions &&
        contractOptions.length > 0 &&
        contractOptions.every(opt => typeof opt === 'string' && opt.trim().length > 0);

    const options = hasValidContractOptions
        ? contractOptions
        : (activePollFromDb?.options || []);

    useReadContract({
        address: ORACLE_POLL_ADDRESS,
        abi: ORACLE_POLL_ABI,
        functionName: 'admin',
    });

    const { data: isPremium } = useReadContract({
        address: ORACLE_POLL_ADDRESS,
        abi: ORACLE_POLL_ABI,
        functionName: 'isPremium',
        args: [address as `0x${string}`],
        query: { enabled: !!address }
    });

    // --- DATA FOR SYNCING (Head of Chain) ---


    useWatchContractEvent({
        address: ORACLE_POLL_ADDRESS,
        abi: ORACLE_POLL_ABI,
        eventName: 'VoteCommitted',
        onLogs() {
            refetchPoll();
        },
    });

    useWatchContractEvent({
        address: ORACLE_POLL_ADDRESS,
        abi: ORACLE_POLL_ABI,
        eventName: 'VoteRevealed',
        onLogs() {
            refetchPoll();
        },
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



    const handleCreatePoll = () => {
        setIsCreatePollModalOpen(true);
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
                                {/* Help Button */}
                                <button
                                    onClick={() => setShowOnboarding(true)}
                                    className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                                    aria-label="Show help"
                                >
                                    <HelpCircle size={18} className="text-gray-500" />
                                </button>

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
                                            className={cn(
                                                "px-4 py-2 bg-white border-2 border-gray-100 rounded-2xl text-xs font-bold text-gray-500 transition-colors",
                                                "cursor-default"
                                            )}
                                        >
                                            {username ? `@${username}` : (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected')}
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

                            {/* Skeleton Loader when switching between poll types */}
                            {activeTab === 'VOTE' && isLoadingList && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="space-y-4"
                                >
                                    {/* Hero Skeleton */}
                                    <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border-b-8 border-gray-100 animate-pulse">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="h-6 w-24 bg-gray-200 rounded-full"></div>
                                            <div className="h-4 w-20 bg-gray-100 rounded"></div>
                                        </div>
                                        <div className="h-8 w-3/4 bg-gray-200 rounded-lg mb-4"></div>
                                        <div className="h-6 w-1/2 bg-gray-100 rounded-lg"></div>
                                    </div>

                                    {/* Options Skeleton */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {[1, 2].map((i) => (
                                            <div key={i} className="bg-white p-6 rounded-[2rem] border-2 border-gray-100 animate-pulse">
                                                <div className="h-6 w-full bg-gray-200 rounded mb-2"></div>
                                                <div className="h-4 w-1/2 bg-gray-100 rounded"></div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* Hero Card: The Question */}
                            {activeTab !== 'LEADERBOARD' && activeTab !== 'PROFILE' && activeTab !== 'MYPOLLS' && !(pollType === 'community' && selectedPollId === null) && activePollId >= 0 && !isLoadingList && pollData && (
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
                                            {phase === 'COMMIT' ? 'VOTING OPEN' : phase === 'REVEAL' ? 'REVEALING VOTES' : 'FINAL RESULTS'}
                                        </span>
                                        <span className="text-xs font-bold text-gray-400">
                                            {pollData && phase === 'COMMIT' && `Ends in ${formatTime(Number(pollData[2]) - now)}`}
                                            {pollData && phase === 'REVEAL' && `Ends in ${formatTime(Number(pollData[3]) - now)}`}
                                        </span>
                                    </div>

                                    <h2 className="text-3xl font-display font-bold leading-tight mb-6 text-gray-800">
                                        {(typeof pollData[1] === 'string' && pollData[1].trim())
                                            ? pollData[1]
                                            : (activePollFromDb?.title || "Loading...")}
                                    </h2>

                                    {/* Show Winner if RESULT phase and poll is resolved */}
                                    {phase === 'RESULT' && pollData && pollData[5] && options.length > 0 && (
                                        <div className="mb-4 p-4 bg-green-50 border-2 border-green-200 rounded-2xl">
                                            <div className="flex items-center gap-2">
                                                <span className="text-green-600 font-black text-sm uppercase">Winner:</span>
                                                <span className="text-green-800 font-bold text-lg">{options[Number(pollData[6])]}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Stake Info */}
                                    <div className="flex flex-col items-start gap-3 mb-8">
                                        <div className="px-3 py-1 bg-gray-50 rounded-lg text-xs font-bold text-gray-500">
                                            Total Stake: {pollData ? formatUnits(pollData[4], 6) : '0'} USDC
                                        </div>

                                        {pollData && pollData[4] && Number(pollData[4]) > 0 && (
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
                                {activeTab === 'MYPOLLS' && (
                                    <motion.div
                                        key="mypolls"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="min-h-full"
                                    >
                                        <MyPollsView />
                                    </motion.div>
                                )}

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
                                                onClick={() => { setPollType('official'); setSelectedPollId(null); setPollsList([]); }}
                                                className={cn(
                                                    "flex-1 py-3 rounded-xl font-bold text-sm transition-all",
                                                    pollType === 'official' ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600"
                                                )}
                                            >
                                                OFFICIAL
                                            </button>
                                            <button
                                                onClick={() => { setPollType('community'); setSelectedPollId(null); setPollsList([]); }}
                                                className={cn(
                                                    "flex-1 py-3 rounded-xl font-bold text-sm transition-all",
                                                    pollType === 'community' ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600"
                                                )}
                                            >
                                                COMMUNITY
                                            </button>
                                        </div>

                                        {/* If Community Tab and No Poll Selected, Show List */}
                                        {pollType === 'community' && selectedPollId === null ? (
                                            <div className="space-y-4">
                                                {/* Filter Toggles */}
                                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                                    {(['ALL', 'LIVE', 'REVEALING', 'ENDED'] as const).map((f) => (
                                                        <button
                                                            key={f}
                                                            onClick={() => { setCommunityFilter(f); setCommunityPage(1); }}
                                                            className={cn(
                                                                "px-3 py-1 rounded-full text-[10px] font-bold transition-colors whitespace-nowrap",
                                                                communityFilter === f ? "bg-black text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                                                            )}
                                                        >
                                                            {f}
                                                        </button>
                                                    ))}
                                                </div>

                                                {isLoadingList && (
                                                    <div className="space-y-3">
                                                        {[1, 2, 3].map((i) => (
                                                            <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 animate-pulse">
                                                                <div className="flex justify-between items-start mb-3">
                                                                    <div className="h-4 w-16 bg-gray-200 rounded"></div>
                                                                    <div className="h-5 w-20 bg-gray-100 rounded-lg"></div>
                                                                </div>
                                                                <div className="h-6 w-3/4 bg-gray-200 rounded mb-2"></div>
                                                                <div className="h-4 w-1/2 bg-gray-100 rounded"></div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {!isLoadingList && paginatedCommunityPolls.length === 0 && (
                                                    <>
                                                        {communityFilter === 'ALL' ? (
                                                            <>
                                                                {isPremium ? (
                                                                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-[2.5rem] p-8 border-2 border-purple-100 flex flex-col items-center justify-center text-center mt-4 relative overflow-hidden">
                                                                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                                                                        <div className="w-16 h-16 bg-gradient-to-br from-purple-200 to-pink-400 rounded-2xl rotate-3 flex items-center justify-center mb-6 shadow-lg shadow-purple-200">
                                                                            <Zap className="w-8 h-8 text-white" />
                                                                        </div>
                                                                        <h3 className="text-2xl font-display font-black text-purple-900 mb-2">
                                                                            You are a Creator
                                                                        </h3>
                                                                        <p className="text-purple-700/80 text-sm font-bold mb-8 max-w-[240px] leading-relaxed">
                                                                            Ready to launch your next prediction market? The community is waiting.
                                                                        </p>
                                                                        <button
                                                                            onClick={() => setIsCreatePollModalOpen(true)}
                                                                            className="w-full py-4 bg-[#8B5CF6] text-white rounded-2xl font-black text-lg shadow-[0_8px_0_rgb(109,40,217)] hover:shadow-[0_4px_0_rgb(109,40,217)] hover:translate-y-[4px] active:shadow-none active:translate-y-[8px] transition-all flex items-center justify-center gap-3 uppercase font-display tracking-wider"
                                                                        >
                                                                            <Sparkles className="w-5 h-5 text-white" />
                                                                            Create Community Poll
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-[2.5rem] p-8 border-2 border-amber-100 flex flex-col items-center justify-center text-center mt-4 relative overflow-hidden">
                                                                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                                                                        <div className="w-16 h-16 bg-gradient-to-br from-amber-200 to-yellow-400 rounded-2xl rotate-6 flex items-center justify-center mb-6 shadow-lg shadow-amber-200">
                                                                            <Crown className="w-8 h-8 text-white" />
                                                                        </div>
                                                                        <h3 className="text-2xl font-display font-black text-amber-900 mb-2">
                                                                            Become a Poll Creator
                                                                        </h3>
                                                                        <p className="text-amber-700/80 text-sm font-bold mb-8 max-w-[240px] leading-relaxed">
                                                                            Upgrade to PRO to create your own prediction polls and let the community vote on them.
                                                                        </p>
                                                                        <button
                                                                            onClick={() => setActiveTab('PROFILE')}
                                                                            className="px-8 py-4 bg-black text-white rounded-2xl font-bold shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                                                                        >
                                                                            <Sparkles className="w-4 h-4 text-yellow-300" />
                                                                            Upgrade to PRO
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div className="border-4 border-dashed border-gray-200 rounded-[2.5rem] p-10 flex flex-col items-center justify-center bg-gray-50/50 mt-4">
                                                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                                                    <Ghost className="w-8 h-8 text-gray-400" />
                                                                </div>
                                                                <h3 className="text-xl font-display font-bold text-gray-800 mb-2">
                                                                    No polls match filter
                                                                </h3>
                                                                <p className="text-gray-400 text-sm font-bold mb-6 max-w-[200px] leading-relaxed text-center">
                                                                    Try changing the filter to see more results.
                                                                </p>
                                                                <button
                                                                    onClick={() => { setCommunityFilter('ALL'); setCommunityPage(1); }}
                                                                    className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:border-gray-300 hover:text-gray-800 transition-colors"
                                                                >
                                                                    Clear Filters
                                                                </button>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                                {paginatedCommunityPolls.map((p) => {
                                                    const nowSec = Date.now() / 1000;
                                                    let phaseLabel = "Voting";
                                                    let phaseColor = "bg-green-100 text-green-600 animate-pulse";

                                                    if (nowSec >= p.revealEndTime) {
                                                        phaseLabel = "Ended";
                                                        phaseColor = "bg-gray-100 text-gray-400";
                                                    } else if (nowSec >= p.commitEndTime) {
                                                        phaseLabel = "Revealing";
                                                        phaseColor = "bg-candy-yellow/20 text-yellow-600 animate-pulse";
                                                    }

                                                    return (
                                                        <div
                                                            key={p.contractPollId}
                                                            onClick={() => setSelectedPollId(p.contractPollId)}
                                                            className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 cursor-pointer hover:scale-[1.02] transition-transform active:scale-95 group relative overflow-hidden"
                                                        >
                                                            <div className="flex justify-between items-start mb-2">
                                                                <span className="px-2 py-1 bg-gray-50 rounded-lg text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                                                    #{p.contractPollId}
                                                                </span>
                                                                <span className={cn(
                                                                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                                                                    phaseColor
                                                                )}>
                                                                    {phaseLabel}
                                                                </span>
                                                            </div>
                                                            <h3 className="font-display font-bold text-xl text-gray-800 mb-4 group-hover:text-candy-purple transition-colors">
                                                                {p.title}
                                                            </h3>
                                                            <div className="flex justify-between items-center text-xs font-bold text-gray-400">
                                                                <span className="flex items-center gap-1">
                                                                    Community Poll
                                                                </span>
                                                                <div className="flex items-center gap-1 text-candy-purple group-hover:translate-x-1 transition-transform">
                                                                    View Poll <div className="i-lucide-arrow-right w-3 h-3" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* Pagination Controls */}
                                                {totalPages > 1 && (
                                                    <div className="flex justify-center items-center gap-4 py-4">
                                                        <button
                                                            disabled={communityPage === 1}
                                                            onClick={() => setCommunityPage(p => Math.max(1, p - 1))}
                                                            className="text-xs font-bold text-gray-400 disabled:opacity-30 hover:text-gray-800"
                                                        >
                                                            Previous
                                                        </button>
                                                        <span className="text-xs font-black text-gray-300">
                                                            P. {communityPage} / {totalPages}
                                                        </span>
                                                        <button
                                                            disabled={communityPage === totalPages}
                                                            onClick={() => setCommunityPage(p => Math.min(totalPages, p + 1))}
                                                            className="text-xs font-bold text-gray-400 disabled:opacity-30 hover:text-gray-800"
                                                        >
                                                            Next
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                {/* Back Button for Official Polls (if viewing history) */}
                                                {pollType === 'official' && selectedPollId !== null && (
                                                    <button
                                                        onClick={() => setSelectedPollId(null)}
                                                        className="mb-2 text-xs font-bold text-gray-400 hover:text-gray-600 flex items-center gap-1"
                                                    >
                                                        ← Back to Latest
                                                    </button>
                                                )}

                                                {/* Back Button for Community Polls */}
                                                {pollType === 'community' && (
                                                    <button
                                                        onClick={() => setSelectedPollId(null)}
                                                        className="mb-2 text-xs font-bold text-gray-400 hover:text-gray-600 flex items-center gap-1"
                                                    >
                                                        ← Back to List
                                                    </button>
                                                )}

                                                {/* Active Poll Card */}
                                                {pollData ? (
                                                    <>
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

                                                        {/* History / Past Polls List (Official Only) */}
                                                        {pollType === 'official' && (
                                                            <div className="mt-8 space-y-4">
                                                                <div className="flex items-center gap-2 px-2 mb-4">
                                                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                                                        <Sparkles className="w-4 h-4 text-gray-400" />
                                                                    </div>
                                                                    <h3 className="font-display font-bold text-gray-800 text-lg">More Polls</h3>
                                                                </div>

                                                                {paginatedHistoryPolls.map((p) => {
                                                                    const isExpired = (Date.now() / 1000) > p.revealEndTime;
                                                                    return (
                                                                        <div
                                                                            key={p.contractPollId}
                                                                            onClick={() => setSelectedPollId(p.contractPollId)}
                                                                            className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-gray-100 cursor-pointer hover:scale-[1.01] transition-all active:scale-95 group relative overflow-hidden"
                                                                        >
                                                                            <div className="flex justify-between items-start mb-2">
                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 px-2 py-1 rounded-lg">
                                                                                    #{p.contractPollId}
                                                                                </span>
                                                                                {isExpired ? (
                                                                                    <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase bg-gray-100 px-2 py-1 rounded-lg">
                                                                                        <CheckCircle size={10} /> Ended
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 uppercase bg-green-100 px-2 py-1 rounded-lg animate-pulse">
                                                                                        <Zap size={10} /> Live
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex justify-between items-center gap-4">
                                                                                <h4 className="font-bold text-gray-800 line-clamp-1 group-hover:text-candy-purple transition-colors text-sm">
                                                                                    {p.title}
                                                                                </h4>
                                                                                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-candy-purple group-hover:text-white transition-colors shrink-0">
                                                                                    <div className="i-lucide-arrow-right w-4 h-4" />
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}

                                                                {paginatedHistoryPolls.length === 0 && (
                                                                    <p className="text-center text-gray-400 font-bold text-xs py-4">No other polls yet.</p>
                                                                )}

                                                                {/* History Pagination */}
                                                                {totalHistoryPages > 1 && (
                                                                    <div className="flex justify-center items-center gap-4 py-4">
                                                                        <button
                                                                            disabled={historyPage === 1}
                                                                            onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                                                            className="text-xs font-bold text-gray-400 disabled:opacity-30 hover:text-gray-800"
                                                                        >
                                                                            Prev
                                                                        </button>
                                                                        <span className="text-xs font-black text-gray-300">
                                                                            {historyPage} / {totalHistoryPages}
                                                                        </span>
                                                                        <button
                                                                            disabled={historyPage === totalHistoryPages}
                                                                            onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                                                                            className="text-xs font-bold text-gray-400 disabled:opacity-30 hover:text-gray-800"
                                                                        >
                                                                            Next
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="py-4">
                                                        {isLoadingList ? (
                                                            <div className="space-y-4">
                                                                {/* Voting Grid Skeleton */}
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    {[1, 2].map((i) => (
                                                                        <div key={i} className="bg-white p-6 rounded-[2rem] border-2 border-gray-100 animate-pulse">
                                                                            <div className="h-6 w-full bg-gray-200 rounded mb-3"></div>
                                                                            <div className="h-4 w-1/2 bg-gray-100 rounded"></div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                {/* Button Skeleton */}
                                                                <div className="h-14 w-full bg-gray-200 rounded-2xl animate-pulse"></div>
                                                            </div>
                                                        ) : (
                                                            <div className="border-4 border-dashed border-gray-200 rounded-[2.5rem] p-10 flex flex-col items-center justify-center bg-gray-50/50">
                                                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                                                    <Ghost className="w-8 h-8 text-gray-400" />
                                                                </div>
                                                                <h3 className="text-xl font-display font-bold text-gray-800 mb-2">
                                                                    No polls found
                                                                </h3>
                                                                <p className="text-gray-400 text-sm font-bold mb-6 max-w-[200px] leading-relaxed">
                                                                    There are no official polls active right now.
                                                                </p>
                                                                <button
                                                                    onClick={() => { setPollType('community'); setSelectedPollId(null); }}
                                                                    className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:border-gray-300 hover:text-gray-800 transition-colors"
                                                                >
                                                                    Check Community Polls
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
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
                    {isPremium && (
                        <NavButton
                            active={activeTab === 'MYPOLLS'}
                            onClick={() => setActiveTab('MYPOLLS')}
                            icon={<LayoutDashboard />}
                            label="Create"
                            color="bg-emerald-500"
                        />
                    )}
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

                {/* Create Poll Modal */}
                <CreatePollModal
                    isOpen={isCreatePollModalOpen}
                    onClose={() => setIsCreatePollModalOpen(false)}
                    onSuccess={(t, m) => showSuccess(t, m)}
                    onError={(t, m) => showError(t, m)}
                />

                {/* Onboarding Modal for First-Time Users */}
                <OnboardingModal
                    isOpen={showOnboarding}
                    onClose={() => setShowOnboarding(false)}
                />
            </div>
        </div >
    );
}
