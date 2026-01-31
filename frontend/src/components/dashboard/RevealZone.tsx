
import { useState, useEffect } from 'react';
import { PartyPopper, AlertCircle, Unlock } from 'lucide-react';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { ORACLE_POLL_ADDRESS, ORACLE_POLL_ABI } from '../../constants';

interface RevealZoneProps {
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

export function RevealZone({ onSuccess, onError }: RevealZoneProps) {
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
