
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Rocket, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWriteContract, usePublicClient, useAccount } from 'wagmi';
import { parseEventLogs } from 'viem';
import { ORACLE_POLL_ADDRESS, ORACLE_POLL_ABI } from '../../constants';
import { cn } from '../../utils';

interface CreatePollModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (title: string, message: string) => void;
    onError: (title: string, message: string) => void;
}

export function CreatePollModal({ isOpen, onClose, onSuccess, onError }: CreatePollModalProps) {
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    const [title, setTitle] = useState('');
    const [options, setOptions] = useState<string[]>(['Yes', 'No']); // Default options
    const [commitDuration, setCommitDuration] = useState(60); // Minutes
    const [revealDuration, setRevealDuration] = useState(60); // Minutes
    const [isSubmitting, setIsSubmitting] = useState(false);

    const resetForm = () => {
        setTitle('');
        setOptions(['Yes', 'No']);
        setCommitDuration(60);
        setRevealDuration(60);
    };

    const handleAddOption = () => {
        if (options.length < 5) {
            setOptions([...options, '']);
        }
    };

    const handleRemoveOption = (index: number) => {
        if (options.length > 2) {
            const newOptions = [...options];
            newOptions.splice(index, 1);
            setOptions(newOptions);
        }
    };

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const handleSubmit = async () => {
        if (!title.trim()) return onError("Validation Error", "Please enter a question.");
        if (options.some(o => !o.trim())) return onError("Validation Error", "All options must be filled.");
        if (!address || !publicClient) return onError("Connection Error", "Please connect your wallet.");

        setIsSubmitting(true);
        try {
            // Convert durations to seconds
            const commitSeconds = BigInt(commitDuration * 60);
            const revealSeconds = BigInt(revealDuration * 60);

            // 1. Send Tx
            const hash = await writeContractAsync({
                address: ORACLE_POLL_ADDRESS,
                abi: ORACLE_POLL_ABI,
                functionName: 'createPoll',
                args: [
                    title,
                    options,
                    commitSeconds,
                    revealSeconds
                ]
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            const logs = parseEventLogs({
                abi: ORACLE_POLL_ABI,
                eventName: 'PollCreated',
                logs: receipt.logs
            });

            if (logs.length > 0) {
                const pollId = logs[0].args.pollId;
                const isCommunity = true;
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/polls`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contractPollId: Number(pollId),
                        title: title,
                        options: options,
                        commitEndTime: Math.floor(Date.now() / 1000) + Number(commitSeconds),
                        revealEndTime: Math.floor(Date.now() / 1000) + Number(commitSeconds) + Number(revealSeconds),
                        isCommunity: isCommunity,
                        creator: address
                    })
                });

                if (res.ok) {
                    onSuccess("Success!", "Poll created successfully.");
                    resetForm();
                    onClose();
                    window.location.reload(); // Force refresh to show new poll
                } else {
                    onError("DB Error", "Blockchain tx success, but failed to save to database.");
                }
            } else {
                onError("Event Error", "Could not find PollCreated event.");
            }

        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : "Unknown error occurred.";
            onError("Creation Failed", errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Use Portal to render at document root
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 font-sans">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white rounded-[2.5rem] w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl relative z-10"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 pb-4 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-sm z-20">
                            <h2 className="text-2xl font-display font-black text-gray-800">Create Poll</h2>
                            <button
                                onClick={onClose}
                                className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                            >
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Title */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label htmlFor="poll-title" className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        Title / Question <span className="text-red-400">*</span>
                                    </label>
                                    <span className="text-[10px] text-gray-300">{title.length}/200</span>
                                </div>
                                <input
                                    id="poll-title"
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value.slice(0, 200))}
                                    placeholder="Who will win..."
                                    maxLength={200}
                                    required
                                    aria-required="true"
                                    className={cn(
                                        "w-full p-4 bg-gray-50 rounded-2xl border-2 font-bold text-gray-800 placeholder:text-gray-300 focus:outline-none transition-all",
                                        title.length === 0 ? "border-gray-100 focus:border-candy-purple" : "border-green-200 focus:border-green-400"
                                    )}
                                />
                            </div>

                            {/* Options */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        Options (Max 5)
                                    </label>
                                    {options.length < 5 && (
                                        <button
                                            onClick={handleAddOption}
                                            className="px-3 py-1 bg-gray-100 rounded-lg text-[10px] font-bold text-gray-600 hover:bg-gray-200 flex items-center gap-1 transition-colors"
                                        >
                                            <Plus size={12} /> ADD OPTION
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {options.map((opt, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={opt}
                                                onChange={(e) => handleOptionChange(idx, e.target.value)}
                                                placeholder={`Option ${idx + 1}`}
                                                className="flex-1 p-3 bg-gray-50 rounded-xl border-2 border-gray-100 font-medium text-gray-700 focus:outline-none focus:border-candy-purple transition-all"
                                            />
                                            {options.length > 2 && (
                                                <button
                                                    onClick={() => handleRemoveOption(idx)}
                                                    className="p-3 bg-red-50 text-red-400 rounded-xl hover:bg-red-100 transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Durations */}
                            <div className="grid grid-cols-1 gap-6">
                                {/* Voting Duration */}
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                            Voting Duration
                                        </label>
                                        <span className="text-xs font-bold text-candy-purple">
                                            {commitDuration} mins <span className="text-gray-300">{(commitDuration / 60).toFixed(1)}h</span>
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="5"
                                        max="1440" // 24h
                                        step="5"
                                        value={commitDuration}
                                        onChange={(e) => setCommitDuration(Number(e.target.value))}
                                        className="w-full accent-candy-purple h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[10px] text-gray-300 font-bold">
                                        <span>5m</span>
                                        <span>24h</span>
                                    </div>
                                </div>

                                {/* Reveal Duration */}
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                            Reveal Duration
                                        </label>
                                        <span className="text-xs font-bold text-candy-yellow">
                                            {revealDuration} mins <span className="text-gray-300">{(revealDuration / 60).toFixed(1)}h</span>
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="5"
                                        max="1440"
                                        step="5"
                                        value={revealDuration}
                                        onChange={(e) => setRevealDuration(Number(e.target.value))}
                                        className="w-full accent-candy-yellow h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[10px] text-gray-300 font-bold">
                                        <span>5m</span>
                                        <span>24h</span>
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-black text-lg shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="animate-spin" /> Creating...
                                    </>
                                ) : (
                                    <>
                                        LAUNCH POLL <Rocket />
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
