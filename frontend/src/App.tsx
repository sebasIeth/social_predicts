import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sdk } from '@farcaster/miniapp-sdk';
import { OpenfortButton, useSignOut, useUser } from "@openfort/react";
import { AuthContainer } from './components/auth/AuthContainer';
import { Sparkles, Trophy, Unlock, Zap, Wallet, CheckCircle, X, AlertCircle, Gavel, PartyPopper } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, usePublicClient, useSwitchChain, useBalance, useWatchContractEvent, useReadContracts } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { keccak256, encodePacked, formatUnits, type Hex, pad, toHex } from 'viem';
import { ORACLE_POLL_ADDRESS, ORACLE_POLL_ABI, BASE_USDC_ADDRESS } from './constants';
import { erc20Abi } from 'viem';
import { PremiumStatus } from './components/PremiumStatus';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// Simple toast/notification could be added here
const STAKE_AMOUNT = 1000n; // 0.001 USDC (6 decimals)

const formatTime = (seconds: number) => {
  if (seconds <= 0) return "Phase Ended";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

function Dashboard() {
  useEffect(() => {
    sdk.actions.ready();
  }, []);

  const [activeTab, setActiveTab] = useState<'VOTE' | 'REVEAL' | 'LEADERBOARD' | 'PROFILE'>('VOTE');
  const [feedbackModal, setFeedbackModal] = useState<{ isOpen: boolean; type: 'success' | 'error'; title: string; message: string } | null>(null);

  const { address, isConnected, connector } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { signOut } = useSignOut();


  const isMiniApp = connector?.id === 'farcaster';
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

function FeedbackModal({ type, title, message, onClose }: { type: 'success' | 'error', title: string, message: string, onClose: () => void }) {
  const isSuccess = type === 'success';
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 relative shadow-2xl flex flex-col items-center text-center"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-gray-800">
          <X size={24} />
        </button>

        <div className={cn(
          "w-20 h-20 rounded-full flex items-center justify-center mb-6",
          isSuccess ? "bg-green-100 text-green-500" : "bg-red-100 text-red-500"
        )}>
          {isSuccess ? <CheckCircle size={40} strokeWidth={3} /> : <AlertCircle size={40} strokeWidth={3} />}
        </div>

        <h3 className="text-2xl font-display font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-500 font-medium mb-8 leading-relaxed text-sm break-words w-full">
          {message}
        </p>

        <button
          onClick={onClose}
          className={cn(
            "w-full py-4 text-white font-black rounded-2xl shadow-xl hover:scale-[1.02] transition-transform",
            isSuccess ? "bg-gray-900" : "bg-red-500 shadow-red-500/30"
          )}
        >
          {isSuccess ? "AWESOME!" : "TRY AGAIN"}
        </button>
      </motion.div>
    </motion.div>
  )
}

function VotingGrid({ pollId, options, enabled, onSuccess, onError, onVoteSuccess }: { pollId: number, options: readonly string[], enabled: boolean, onSuccess: (t: string, m: string) => void, onError: (t: string, m: string) => void, onVoteSuccess?: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const { address, connector } = useAccount();
  const isMiniApp = connector?.id === 'farcaster';
  useSwitchChain();
  const [isApproving, setIsApproving] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const publicClient = usePublicClient();
  const { data: ethBalance } = useBalance({ address });
  const [userVotes, setUserVotes] = useState(0);

  // ... (existing fetchUserVotes)

  const fetchUserVotes = async () => {
    if (!address) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/votes/user/${address}`);
      const data = await res.json();
      const count = data.filter((v: any) => v.pollId === pollId).length;
      setUserVotes(count); // Only updates on fetch
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

  const needsApproval = !allowance || allowance < STAKE_AMOUNT;

  const { switchChainAsync } = useSwitchChain();

  const handleApprove = async () => {
    if (!address || !publicClient) return;

    try {
      console.log("Switching to Base...");
      if (!isMiniApp) {
        await switchChainAsync({ chainId: 8453 });
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
        await switchChainAsync({ chainId: 8453 });
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
  }, [pollId, refetchTallies]); // or trigger on prop change if passed

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

function RevealZone({ onSuccess, onError }: { onSuccess: (t: string, m: string) => void, onError: (t: string, m: string) => void }) {
  const [activeReveals, setActiveReveals] = useState<any[]>([]);
  const { address } = useAccount();
  const { writeContractAsync: writeReveal } = useWriteContract();
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const publicClient = usePublicClient();

  // Fetch active reveals from backend
  useEffect(() => {
    const fetchReveals = async () => {
      if (!address) return;
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/votes/${address}/active-reveals`);
        const data = await res.json();
        setActiveReveals(data);
      } catch (e) {
        console.error("Failed to fetch reveals", e);
      }
    };
    fetchReveals();
  }, [address]);

  const handleReveal = async (vote: any) => {
    if (!address || !publicClient) return;
    const revealKey = `${vote.pollId}-${vote.commitmentIndex}`;

    try {
      setRevealingId(revealKey);
      const hash = await writeReveal({
        address: ORACLE_POLL_ADDRESS,
        abi: ORACLE_POLL_ABI,
        functionName: 'revealVote',
        args: [
          BigInt(vote.pollId),
          BigInt(vote.commitmentIndex),
          BigInt(vote.optionIndex),
          vote.salt as `0x${string}`
        ]
      });

      console.log("Reveal Hash:", hash);
      await publicClient.waitForTransactionReceipt({ hash });

      setRevealingId(null);
      onSuccess("Vote Revealed!", "Your vote has been recorded on-chain.");

      // Remove from list locally
      setActiveReveals(prev => prev.filter(v => `${v.pollId}-${v.commitmentIndex}` !== revealKey));

    } catch (e: any) {
      console.error(e);
      setRevealingId(null);
      const msg = e.details || e.shortMessage || e.message || "An unexpected error occurred.";
      onError("Reveal Failed", msg);
    }
  };

  if (activeReveals.length === 0) {
    return (
      <div className="bg-white/50 rounded-[2.5rem] p-8 text-center border-2 border-dashed border-gray-200">
        <PartyPopper size={48} className="mx-auto mb-4 text-gray-300" />
        <p className="text-gray-400 font-bold">No votes to reveal right now.</p>
        <p className="text-xs text-gray-400 mt-2">Come back when a poll ends!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 p-4 rounded-3xl mb-4 flex items-center gap-3">
        <AlertCircle className="text-yellow-600" />
        <p className="text-xs font-bold text-yellow-700">these votes are ready to be revealed!</p>
      </div>

      {activeReveals.map((v) => {
        const revealKey = `${v.pollId}-${v.commitmentIndex}`;
        return (
          <div key={revealKey} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-gray-800">{v.pollTitle}</h4>
                <p className="text-xs text-gray-400 font-bold uppercase mt-1">You Voted: Option {Number(v.optionIndex) + 1}</p>
              </div>
            </div>

            <button
              onClick={() => handleReveal(v)}
              disabled={revealingId !== null}
              className="w-full py-3 bg-candy-yellow text-gray-900 font-black rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {revealingId === revealKey ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-gray-900 border-t-transparent rounded-full" />
                  REVEALING...
                </>
              ) : (
                <>
                  <Unlock size={16} />
                  REVEAL VOTE
                </>
              )}
            </button>
          </div>
        )
      })}
    </div>
  );
}



function ProfileView({ address, now, onSuccess, onError, onLogout }: { address: string | undefined, now: number, onSuccess: (t: string, m: string) => void, onError: (t: string, m: string) => void, onLogout?: () => void }) {
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

  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { writeContractAsync: writeReveal } = useWriteContract();
  const [revealingIndices, setRevealingIndices] = useState<Set<string>>(new Set());
  const publicClient = usePublicClient();

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
      // Hardcoded duration as requested: same as admin defaults (e.g. 24h commit, 1h reveal)
      // For now, let's use 24h (86400s) for commit and +1h (3600s) for reveal
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
                  <div className="w-full py-3 bg-green-100 text-green-600 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2 border border-green-200">
                    <CheckCircle size={14} /> REWARD CLAIMED
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function NavButton({ active, onClick, icon, label, color }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex flex-col items-center gap-1 p-3 rounded-3xl transition-all duration-300",
        active ? `${color} text-white shadow-lg scale-105` : "text-gray-400 hover:bg-gray-50"
      )}
    >
      <div className={cn("p-1", active && "animate-bounce-slow")}>
        {icon}
      </div>
      {active && <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>}
    </button>
  );
}


function LeaderboardView() {
  const { address } = useAccount();
  const [data, setData] = useState<{ leaderboard: any[], userRank: any | null }>({ leaderboard: [], userRank: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const query = address ? `?address=${address}` : '';
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/users/leaderboard${query}`);
        const result = await res.json();
        // Handle both old array format (fallback) and new object format
        if (Array.isArray(result)) {
          setData({ leaderboard: result, userRank: null });
        } else {
          setData(result);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, [address]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      <p className="text-gray-400 font-medium">Loading Rankings...</p>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4 relative pb-20"
    >
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-[2rem] p-8 text-white shadow-lg mb-6">
        <h2 className="text-3xl font-display font-black mb-2">Leaderboard 🏆</h2>
        <p className="text-purple-100 font-medium opacity-80">Top 10 Predictors</p>
      </div>

      <div className="space-y-3">
        {data.leaderboard.map((user, index) => (
          <LeaderboardRow key={user.address} user={user} index={index} />
        ))}

        {data.leaderboard.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Trophy size={48} className="mx-auto mb-3 opacity-20" />
            <p>No winners yet. Be the first!</p>
          </div>
        )}
      </div>

      {/* Sticky User Rank (if not in top 10) */}
      {data.userRank && (
        <div className="fixed bottom-24 left-0 right-0 px-6 z-40">
          <div className="bg-gray-900 p-4 rounded-3xl shadow-2xl border border-gray-700 flex items-center justify-between transform scale-105">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-2 bg-gray-800 text-white border-gray-600">
                #{data.userRank.rank}
              </div>
              <div>
                <p className="font-bold text-white text-sm">
                  You
                </p>
                <p className="text-xs text-gray-400 font-medium">
                  {data.userRank.gamesPlayed} games played
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="font-black text-white text-lg">{data.userRank.gamesWon} Wins</p>
              <div className="flex items-center justify-end space-x-1">
                <span className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded-full",
                  parseFloat(data.userRank.winRate) >= 50 ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-300"
                )}>
                  {data.userRank.winRate}% WR
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function LeaderboardRow({ user, index }: { user: any, index: number }) {
  return (
    <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-2",
          index === 0 ? "bg-yellow-100 text-yellow-600 border-yellow-200" :
            index === 1 ? "bg-gray-100 text-gray-500 border-gray-200" :
              index === 2 ? "bg-orange-100 text-orange-600 border-orange-200" :
                "bg-blue-50 text-blue-500 border-blue-100"
        )}>
          #{index + 1}
        </div>
        <div>
          <p className="font-bold text-gray-800 text-sm">
            {user.address.slice(0, 6)}...{user.address.slice(-4)}
            {index === 0 && " 👑"}
          </p>
          <p className="text-xs text-gray-400 font-medium">
            {user.gamesPlayed} games played
          </p>
        </div>
      </div>

      <div className="text-right">
        <p className="font-black text-gray-800 text-lg">{user.gamesWon} Wins</p>
        <div className="flex items-center justify-end space-x-1">
          <span className={cn(
            "text-xs font-bold px-2 py-0.5 rounded-full",
            parseFloat(user.winRate) >= 50 ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"
          )}>
            {user.winRate}% WR
          </span>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const { connector } = useAccount();
  const { user } = useUser();
  const isMiniApp = connector?.id === 'farcaster';
  const showApp = isMiniApp ? true : !!user;

  if (!showApp && !isMiniApp) {
    return <AuthContainer />;
  }
  return <Dashboard />;
}
