
import { motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '../../utils';

interface FeedbackModalProps {
    type: 'success' | 'error';
    title: string;
    message: string;
    onClose: () => void;
}

export function FeedbackModal({ type, title, message, onClose }: FeedbackModalProps) {
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
