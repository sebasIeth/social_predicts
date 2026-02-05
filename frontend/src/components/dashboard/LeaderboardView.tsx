
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { useAccount } from 'wagmi';
import { cn } from '../../utils';

export function LeaderboardView() {
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
            <div className="relative overflow-hidden bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] rounded-[2.5rem] p-8 text-white shadow-xl shadow-purple-500/20 mb-8 border border-white/10">
                {/* Decorative Background Elements */}
                <div className="absolute -right-10 -top-10 text-white/10 transform rotate-12">
                    <Trophy size={180} />
                </div>
                <div className="absolute top-1/2 right-10 w-32 h-32 bg-purple-400/30 blur-3xl rounded-full"></div>

                <div className="relative z-10">
                    <h2 className="text-4xl font-display font-black mb-2 flex items-center gap-3 drop-shadow-sm">
                        Leaderboard <Trophy className="text-yellow-400 drop-shadow-md fill-yellow-400/20" size={32} />
                    </h2>
                    <p className="text-purple-100 font-bold text-lg opacity-90 tracking-wide">Top 10 Predictors</p>
                </div>
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
                        {user.alias.startsWith('0x') ? `${user.alias.slice(0, 6)}...${user.alias.slice(-4)}` : user.alias}
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
