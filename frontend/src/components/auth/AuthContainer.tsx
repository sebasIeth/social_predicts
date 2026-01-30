import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useUI } from '@openfort/react';

export function AuthContainer() {
    const { open } = useUI();

    const handleStart = () => {
        // Trigger the Openfort wallet modal
        open();
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-200">
            <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border-[10px] border-white relative"
            >
                {/* Decorative Background */}
                <div className="absolute top-0 left-0 w-full h-48 bg-candy-purple/10 -skew-y-6 origin-top-left translate-y-[-20%]" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-candy-yellow/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                <div className="relative px-8 pt-12 pb-12">
                    {/* Header */}
                    <div className="text-center mb-10">
                        <div className="w-20 h-20 bg-candy-purple rounded-3xl rotate-3 flex items-center justify-center shadow-xl shadow-candy-purple/20 mx-auto mb-6">
                            <Sparkles className="text-white w-10 h-10" />
                        </div>
                        <h1 className="text-4xl font-display font-black text-gray-800 tracking-tight mb-2">
                            Social Predicts
                        </h1>
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                            Join the future of prediction
                        </p>
                    </div>

                    <div className="flex flex-col items-center gap-6">
                        <button
                            onClick={handleStart}
                            className="w-full py-5 text-xl bg-gray-900 text-white font-black rounded-3xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 relative overflow-hidden group"
                        >
                            <span className="relative z-10">START</span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
