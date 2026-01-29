import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sdk } from '@farcaster/miniapp-sdk';
import { Sparkles, Trophy, Unlock, Zap, Wallet, CheckCircle, X, AlertCircle, Gavel, Eye, EyeOff } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, usePublicClient, useSwitchChain, useBalance, useWatchContractEvent, useReadContracts } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { keccak256, encodePacked, formatUnits, type Hex, pad, toHex } from 'viem';
import { ORACLE_POLL_ADDRESS, ORACLE_POLL_ABI, BASE_USDC_ADDRESS } from './constants';
import { erc20Abi } from 'viem';

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

export default function App() {
  useEffect(() => {
    sdk.actions.ready();
  }, []);

  const [activeTab, setActiveTab] = useState<'VOTE' | 'REVEAL' | 'LEADERBOARD' | 'PROFILE'>('VOTE');
  const [feedbackModal, setFeedbackModal] = useState<{ isOpen: boolean; type: 'success' | 'error'; title: string; message: string } | null>(null);

  const { address, isConnected, connector } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const isMiniApp = connector?.id === 'farcaster';

  // 1. Get Poll ID
  const { data: nextPollId } = useReadContract({
    address: ORACLE_POLL_ADDRESS,
    abi: ORACLE_POLL_ABI,
    functionName: 'nextPollId',
  });

  const currentPollId = nextPollId ? Number(nextPollId) - 1 : 0;

  // 2. Get Poll Data
  const { data: pollData, refetch: refetchPoll } = useReadContract({
    address: ORACLE_POLL_ADDRESS,
    abi: ORACLE_POLL_ABI,
    functionName: 'polls',
    args: [BigInt(currentPollId)],
    query: {
      enabled: nextPollId !== undefined,
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

  const { data: options } = useReadContract({
    address: ORACLE_POLL_ADDRESS,
    abi: ORACLE_POLL_ABI,
    functionName: 'getPollOptions',
    args: [BigInt(currentPollId)],
    query: {
      enabled: nextPollId !== undefined,
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
    if (pollData && pollData[1] && options && lastSyncedId.current !== currentPollId) {
      lastSyncedId.current = currentPollId;
      fetch(`${import.meta.env.VITE_API_URL}/api/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractPollId: currentPollId,
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
  }, [currentPollId, pollData, options]);

  const { writeContractAsync } = useWriteContract();

  const handleCreatePoll = async () => {
    try {
      if (!address) return;
      const title = "Will Bitcoin hit $100k in 2026? 🚀";
      const options = ["Yes", "No", "Maybe"];
      const commitDuration = 600; // 10 mins
      const revealDuration = 600; // 10 mins

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

              {!isConnected ? (
                <button
                  onClick={() => connect({ connector: injected() })}
                  className="px-4 py-2 bg-black text-white rounded-2xl text-xs font-bold hover:scale-95 transition-transform flex items-center gap-2"
                >
                  <Wallet size={14} /> Connect
                </button>
              ) : (
                <button
                  onClick={() => !isMiniApp && disconnect()}
                  disabled={isMiniApp}
                  className={cn(
                    "px-4 py-2 bg-white border-2 border-gray-100 rounded-2xl text-xs font-bold text-gray-500 transition-colors",
                    !isMiniApp ? "hover:bg-gray-50 cursor-pointer" : "cursor-default"
                  )}
                >
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </button>
              )}

              {/* Debug: Create Poll Button (Dev Only) */}
              {import.meta.env.DEV && isConnected && (
                <button
                  onClick={handleCreatePoll}
                  className="px-3 py-2 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 ml-2"
                >
                  + Poll
                </button>
              )}
            </header>

            {/* Main Grid Layout */}
            <main className="px-4 space-y-4">

              {/* Hero Card: The Question */}
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

              {/* Action Area */}
              <AnimatePresence mode="wait">
                {activeTab === 'VOTE' && (
                  <VotingGrid
                    key="vote"
                    pollId={currentPollId}
                    options={options || []}
                    enabled={phase === 'COMMIT'}
                    onSuccess={showSuccess}
                    onError={showError}
                    onVoteSuccess={() => {
                      refetchPoll();
                    }}
                  />
                )}
                {activeTab === 'REVEAL' && (
                  <RevealZone
                    key="reveal"
                    pollId={currentPollId}
                    options={options || []}
                    onSuccess={showSuccess}
                    onError={showError}
                    phase={phase}
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
                  />
                )}
              </AnimatePresence>

            </main>
          </div>
        </div>

        {/* Floating Bottom Nav */}
        <nav className="absolute bottom-6 left-6 right-6 p-2 bg-white/90 backdrop-blur-md rounded-[2rem] shadow-[0_20px_40px_-5px_rgba(0,0,0,0.1)] border border-white/50 flex justify-between items-center z-50">
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
  const { address } = useAccount();
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
      await switchChainAsync({ chainId: 8453 });

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
      await switchChainAsync({ chainId: 8453 });

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
      onSuccess("Vote Committed!", "Your prediction is locked in. Don't forget to come back and reveal it later!");
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
          <div className="flex items-center gap-2 px-4 py-2 bg-candy-mint/10 rounded-full border border-candy-mint/20">
            <CheckCircle size={14} className="text-candy-mint" />
            <span className="text-xs font-black text-candy-mint uppercase">
              You Have {userVotes} {userVotes === 1 ? 'Vote' : 'Votes'} in This Poll
            </span>
          </div>
        )}
      </div>

    </motion.div>
  );
}

function RevealZone({ pollId, options, onSuccess, onError, phase }: { pollId: number, options: readonly string[], onSuccess: (t: string, m: string) => void, onError: (t: string, m: string) => void, phase: string }) {
  const [localVotes, setLocalVotes] = useState<any[]>([]);
  const { address } = useAccount();
  const { writeContractAsync: writeReveal } = useWriteContract();
  const [revealingIndex, setRevealingIndex] = useState<number | null>(null);
  const [visibleVotes, setVisibleVotes] = useState<Set<number>>(new Set());

  const toggleVisibility = (index: number) => {
    setVisibleVotes(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  useEffect(() => {
    const syncVotes = async () => {
      // ... same logic
      if (!address) return;
      const storageKey = `oracle_poll_votes_${pollId}_${address}`;
      let saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/votes/user/${address}`);
        const dbVotes = await res.json();
        const relevant = dbVotes.filter((v: any) => v.pollId === pollId);
        if (relevant.length > 0) {
          const formatted = relevant.map((rv: any) => ({
            vote: rv.optionIndex,
            salt: rv.salt,
            commitmentIndex: rv.commitmentIndex
          }));
          setLocalVotes(formatted);
          localStorage.setItem(storageKey, JSON.stringify(formatted));
        } else {
          setLocalVotes(saved);
        }
      } catch (e) {
        setLocalVotes(saved);
      }
    };
    syncVotes();
  }, [address, pollId]);

  /* New Hook for publicClient */
  const publicClient = usePublicClient();

  useEffect(() => {
    const verifyRevealed = async () => {
      if (!publicClient || localVotes.length === 0) return;

      // Filter votes that are NOT yet marked as revealed locally
      const toCheck = localVotes.filter(v => !v.revealed);
      if (toCheck.length === 0) return;

      console.log(`Verifying ${toCheck.length} votes for reveal status...`);
      let updates: any = {};

      for (const v of toCheck) {
        // Throttle to avoid 429
        await new Promise(r => setTimeout(r, 1000));

        try {
          // 1. First check the public mapping 'votes'
          // ABI: votes(pollId, voter, commitmentIndex) -> optionIndex
          const recordedOption = await publicClient.readContract({
            address: ORACLE_POLL_ADDRESS,
            abi: ORACLE_POLL_ABI,
            functionName: 'votes',
            args: [BigInt(pollId), address as `0x${string}`, BigInt(v.commitmentIndex)]
          });

          // If recorded option matches our local vote, it is confirmed revealed
          // Note: Option 0 is ambiguous if default is 0, so we skip optimizaton for 0 unless we are sure.
          // But for now, if it matches, we assume revealed.
          // Wait, if I voted 0, and it returns 0 (default), it's ambiguous.
          // If I voted 1, and it returns 1, it's definitely revealed.

          if (Number(recordedOption) === v.vote && v.vote !== 0) {
            console.log("Verified reveal via view:", v.commitmentIndex);
            updates[v.commitmentIndex] = true;
            continue;
          }

          // 2. Fallback: Simulate the reveal transaction
          // If it succeeds, it means we CAN reveal => Not revealed yet.
          // If it fails, it means we CANNOT reveal => Likely already revealed.
          await publicClient.simulateContract({
            address: ORACLE_POLL_ADDRESS,
            abi: ORACLE_POLL_ABI,
            functionName: 'revealVote',
            args: [
              BigInt(pollId),
              BigInt(v.commitmentIndex),
              BigInt(v.vote),
              v.salt as Hex
            ],
            account: address as `0x${string}`
          });
          // If we get here, it succeeded, so it is NOT revealed.

        } catch (e: any) {
          // Simulation failed. 
          // Either invalid params (unlikely if locally stored) or ALREADY REVEALED.
          // We assume already revealed to be safe and hide the button.
          console.log("Simulation failed (likely revealed):", v.commitmentIndex);
          updates[v.commitmentIndex] = true;
        }
      }

      if (Object.keys(updates).length > 0) {
        setLocalVotes(prev => prev.map(p => {
          if (updates[p.commitmentIndex]) {
            return { ...p, revealed: true };
          }
          return p;
        }));
      }
    };

    verifyRevealed();
  }, [publicClient, localVotes.length, pollId, address]);

  const handleReveal = async (v: any, index: number) => {
    if (!address || !publicClient) return;

    try {
      setRevealingIndex(index);
      const hash = await writeReveal({
        address: ORACLE_POLL_ADDRESS,
        abi: ORACLE_POLL_ABI,
        functionName: 'revealVote',
        args: [
          BigInt(pollId),
          BigInt(v.commitmentIndex),
          BigInt(v.vote),
          v.salt as Hex
        ]
      });

      console.log("Reveal Hash:", hash);
      await publicClient.waitForTransactionReceipt({ hash });

      setRevealingIndex(null);
      onSuccess("Vote Revealed!", "Your vote has been recorded on-chain.");

      // Mark as revealed in UI instead of removing?
      // User requested "lo conto y la visual lo pone para poder revelarlo nuevamente"
      // So we should keep it but mark REVEALED.
      setLocalVotes((prev) => {
        const next = prev.map((item, i) => i === index ? { ...item, revealed: true } : item);
        const storageKey = `oracle_poll_votes_${pollId}_${address}`;
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });

    } catch (e: any) {
      console.error(e);
      setRevealingIndex(null);
      const msg = e.details || e.shortMessage || e.message || "An unexpected error occurred.";
      onError("Reveal Failed", msg);
    }
  };

  const isRevealPhase = phase === 'REVEAL';

  if (localVotes.length === 0) {
    return (
      <div className="bg-white/50 rounded-[2.5rem] p-8 text-center border-2 border-dashed border-gray-200">
        <p className="text-gray-400 font-bold">No saved votes found on this device.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {localVotes.map((v, i) => {
        const isVisible = visibleVotes.has(i);
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-3xl p-5 flex items-center justify-between shadow-sm border border-gray-100"
          >
            <div className="text-left">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">
                Vote #{i + 1}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-gray-800 text-lg">
                  {isVisible ? (options[v.vote] || `Option ${v.vote}`) : '••••••••'}
                </span>
                <button onClick={() => toggleVisibility(i)} className="text-gray-400 hover:text-gray-600">
                  {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {!isRevealPhase ? (
              <div className="px-4 py-2 bg-gray-100 text-gray-500 font-bold text-xs rounded-xl flex items-center gap-2">
                <Unlock size={12} className="text-gray-400" />
                LOCKED
              </div>
            ) : (
              v.revealed ? (
                <div className="px-4 py-2 bg-green-100 text-green-600 font-bold text-xs rounded-xl flex items-center gap-2 border border-green-200">
                  <CheckCircle size={14} /> REVEALED
                </div>
              ) : (
                <button
                  onClick={() => handleReveal(v, i)}
                  disabled={revealingIndex !== null}
                  className="px-6 py-3 bg-candy-yellow text-gray-900 font-black rounded-2xl shadow-lg hover:scale-[1.05] active:scale-95 transition-all disabled:opacity-50"
                >
                  {revealingIndex === i ? "REVEALING..." : "REVEAL"}
                </button>
              )
            )}
          </motion.div>
        )
      })}
    </div>
  );
}

function LeaderboardView() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white p-4 rounded-3xl flex items-center gap-4 shadow-sm border border-gray-50">
          <span className="font-black text-gray-300 text-lg mx-2">#{i}</span>
          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i * 32}`} className="w-12 h-12 rounded-full bg-gray-100" />
          <div>
            <h4 className="font-bold text-gray-800">CryptoWizard</h4>
            <p className="text-xs font-bold text-candy-mint">98% Accuracy</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function ProfileView({ address, now, onSuccess, onError }: { address: string | undefined, now: number, onSuccess: (t: string, m: string) => void, onError: (t: string, m: string) => void }) {
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

  const verifyStuckPolls = async (items: any[]) => {
    if (!publicClient) return;

    const pollsToCheck = items.filter(item => {
      const poll = item.pollInfo;
      // Check if stuck (ended but not resolved) OR won (need to check claim status)
      const stuck = (now >= poll.revealEndTime && !poll.resolved);
      const won = (poll.resolved && poll.winningOptionIndex === item.optionIndex);
      return stuck || won;
    });

    if (pollsToCheck.length === 0) return;

    console.log(`Verifying ${pollsToCheck.length} polls for resolution/claim status...`);

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

        if (isResolved || isClaimed !== item.claimed) {
          console.log(`Updating poll ${pId}: Resolved=${isResolved}, Claimed=${isClaimed}`);

          setHistory(prev => prev.map(pi => {
            if (pi.pollInfo.contractPollId === pId) {
              const updated = { ...pi };
              updated.pollInfo = { ...pi.pollInfo, resolved: true, winningOptionIndex: winner };
              if (isClaimed) updated.claimed = true;
              return updated;
            }
            return pi;
          }));

          // Trigger backend sync silently if meaningful change
          if (isResolved) {
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
        args: [BigInt(pId), BigInt(commitmentIndex)]
      });
      onSuccess("Reward Claimed!", "Funds sent to your wallet.");

      // Update local state immediately
      setHistory(prev => prev.map(item => {
        if (item.pollInfo.contractPollId === pId) {
          return { ...item, claimed: true };
        }
        return item;
      }));

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
    <div className="space-y-6">
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
                      isOpen ? "bg-green-100 text-green-600" :
                        (isRevealPhase ? "bg-yellow-100 text-yellow-600" :
                          (isResolved ? (isWinner ? "bg-green-500 text-white" : "bg-red-100 text-red-600") : "bg-gray-200 text-gray-500"))
                    )}>
                      {isOpen ? "OPEN" :
                        (isRevealPhase ? "REVEAL PHASE" :
                          (isResolved ? (isWinner ? "WINNER!" : "LOST") : "PENDING RESOLUTION"))}
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
    </div>
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
