
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, DollarSign, Clock, ExternalLink, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';
import { useAccount, useReadContracts, usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';
import { ORACLE_POLL_ADDRESS, ORACLE_POLL_ABI } from '../../constants';
import { cn } from '../../utils';

const ITEMS_PER_PAGE = 5;

export function MyPollsView() {
    const { address } = useAccount();
    const [polls, setPolls] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const fetchMyPolls = async () => {
            if (!address) return;
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/polls?type=mypolls&creator=${address}`);
                const data = await res.json();
                setPolls(data);
            } catch (error) {
                console.error("Failed to fetch my polls", error);
            } finally {
                setLoading(false);
            }
        };
        fetchMyPolls();
    }, [address]);

    // Batch fetch on-chain data for ALL polls to calc total earnings
    const { data: pollsOnChain } = useReadContracts({
        contracts: polls.map(p => ({
            address: ORACLE_POLL_ADDRESS as `0x${string}`,
            abi: ORACLE_POLL_ABI,
            functionName: 'polls',
            args: [BigInt(p.contractPollId)],
        })),
        query: { enabled: polls.length > 0 }
    });

    // Calculate Stats
    let totalEarnings = 0;
    if (pollsOnChain) {
        pollsOnChain.forEach(result => {
            if (result.status === 'success') {
                const data: any = result.result;
                const stake = Number(formatUnits(data[4], 6)); // totalStake
                totalEarnings += (stake * 0.25);
            }
        });
    }

    // Pagination Logic
    const totalPages = Math.ceil(polls.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentPolls = polls.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="text-gray-400 font-medium">Loading your polls...</p>
        </div>
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6 pb-20"
        >
            {/* Stats Banner */}
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-[2.5rem] p-6 text-white shadow-xl shadow-green-500/20 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 text-white/10 transform rotate-12">
                    <TrendingUp size={180} />
                </div>

                <div className="relative z-10">
                    <h2 className="text-3xl font-display font-black mb-6 flex items-center gap-2">
                        Creator Dashboard
                    </h2>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                            <div className="flex items-center gap-2 text-green-100 mb-1 text-xs font-bold uppercase tracking-wider">
                                <BarChart3 size={14} /> Total Polls
                            </div>
                            <div className="text-2xl font-black">{polls.length}</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                            <div className="flex items-center gap-2 text-green-100 mb-1 text-xs font-bold uppercase tracking-wider">
                                <DollarSign size={14} /> Total Earnings
                            </div>
                            <div className="text-2xl font-black">{totalEarnings.toFixed(4)} <span className="text-sm opacity-70">USDC</span></div>
                        </div>
                    </div>
                </div>
            </div>

            {polls.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <p>You haven't created any polls yet.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {currentPolls.map((poll, index) => {
                        // Pass the corresponding on-chain data if available
                        const onChainData = pollsOnChain && pollsOnChain[startIndex + index]?.status === 'success'
                            ? pollsOnChain[startIndex + index].result
                            : null;

                        return <MyPollCard key={poll._id} poll={poll} initialOnChainData={onChainData} />;
                    })}
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-xl bg-white text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm font-bold text-gray-500">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-xl bg-white text-gray-600 disabled:opacity-30 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}
        </motion.div>
    );
}

function MyPollCard({ poll, initialOnChainData }: { poll: any, initialOnChainData?: any }) {
    const publicClient = usePublicClient();
    const [payoutTx, setPayoutTx] = useState<string | null>(null);

    // Use passed data if available, otherwise 0n
    const totalStake = initialOnChainData ? initialOnChainData[4] : 0n;
    const resolved = initialOnChainData ? initialOnChainData[5] : false;

    // Calculate Earnings (25% of Total Stake)
    const earnings = Number(formatUnits(BigInt(totalStake), 6)) * 0.25;

    // Fetch Payout TX if resolved
    useEffect(() => {
        const fetchPayoutTx = async () => {
            if (resolved && publicClient) {
                try {
                    const logs = await publicClient.getContractEvents({
                        address: ORACLE_POLL_ADDRESS,
                        abi: ORACLE_POLL_ABI,
                        eventName: 'PollResolved',
                        args: { pollId: BigInt(poll.contractPollId) },
                        fromBlock: 'earliest'
                    } as any);

                    if (logs && logs.length > 0) {
                        setPayoutTx(logs[0].transactionHash);
                    }
                } catch (err) {
                    console.error("Failed to fetch payout tx", err);
                }
            }
        };
        fetchPayoutTx();
    }, [resolved, publicClient, poll.contractPollId]);

    const isEnded = Date.now() / 1000 > poll.revealEndTime;
    const isActive = !isEnded;

    return (
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 transition-all hover:scale-[1.01]">
            <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-gray-800 line-clamp-2">{poll.title}</h3>
                <span className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                    resolved ? "bg-purple-100 text-purple-600" :
                        (isActive ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500")
                )}>
                    {resolved ? "Paid Out" : (isActive ? "Active" : "Closed")}
                </span>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 mt-4">
                <div className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>{new Date(poll.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-400">Earnings (25%):</span>
                        <span className="font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                            {earnings > 0 ? `+${earnings.toFixed(4)} USDC` : '0.0000 USDC'}
                        </span>
                    </div>

                    {payoutTx && (
                        <a
                            href={`https://sepolia.basescan.org/tx/${payoutTx}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:underline"
                        >
                            View TX <ExternalLink size={10} />
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
