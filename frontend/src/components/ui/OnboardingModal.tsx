
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, ChevronRight, ChevronLeft, Sparkles, Zap, Unlock, Trophy,
    Wallet, Crown, Shield, Vote, Eye, Gift, CheckCircle
} from 'lucide-react';
import { cn } from '../../utils';

interface OnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface OnboardingStep {
    id: number;
    title: string;
    subtitle: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    bgGradient: string;
    features?: { icon: React.ReactNode; text: string }[];
}

const ONBOARDING_STEPS: OnboardingStep[] = [
    {
        id: 1,
        title: "Welcome to Oracle Polls",
        subtitle: "Predict. Stake. Win.",
        description: "Oracle Polls is a decentralized prediction market where you can vote on outcomes, stake USDC, and earn rewards for correct predictions.",
        icon: <Sparkles size={48} />,
        color: "text-purple-600",
        bgGradient: "from-purple-500 to-indigo-600",
        features: [
            { icon: <Vote size={16} />, text: "Vote on real-world events" },
            { icon: <Shield size={16} />, text: "Secure blockchain voting" },
            { icon: <Gift size={16} />, text: "Earn rewards for winning" },
        ]
    },
    {
        id: 2,
        title: "How Voting Works",
        subtitle: "Commit-Reveal System",
        description: "We use a fair commit-reveal system to prevent manipulation. Your vote is hidden until the reveal phase begins.",
        icon: <Shield size={48} />,
        color: "text-blue-600",
        bgGradient: "from-blue-500 to-cyan-600",
        features: [
            { icon: <Zap size={16} />, text: "Phase 1: Vote & lock your prediction" },
            { icon: <Eye size={16} />, text: "Phase 2: Reveal your vote" },
            { icon: <Trophy size={16} />, text: "Phase 3: Winners get rewards" },
        ]
    },
    {
        id: 3,
        title: "The Vote Tab",
        subtitle: "Make Your Predictions",
        description: "Browse official and community polls. Select your prediction, stake 0.001 USDC, and lock in your vote before time runs out.",
        icon: <Zap size={48} />,
        color: "text-pink-600",
        bgGradient: "from-pink-500 to-rose-600",
        features: [
            { icon: <CheckCircle size={16} />, text: "Official polls by the platform" },
            { icon: <Sparkles size={16} />, text: "Community polls by PRO users" },
            { icon: <Vote size={16} />, text: "Stake 0.001 USDC per vote" },
        ]
    },
    {
        id: 4,
        title: "The Reveal Tab",
        subtitle: "Reveal Your Votes",
        description: "After voting ends, you must reveal your vote during the reveal phase. Don't forget - unrevealed votes lose their stake!",
        icon: <Unlock size={48} />,
        color: "text-yellow-600",
        bgGradient: "from-yellow-500 to-orange-600",
        features: [
            { icon: <Eye size={16} />, text: "Reveal before time expires" },
            { icon: <Crown size={16} />, text: "PRO users get auto-reveal" },
            { icon: <Shield size={16} />, text: "Your vote becomes public" },
        ]
    },
    {
        id: 5,
        title: "The Leaderboard",
        subtitle: "Compete & Climb",
        description: "See how you rank against other predictors. Top performers are displayed on the leaderboard with their win count.",
        icon: <Trophy size={48} />,
        color: "text-amber-600",
        bgGradient: "from-amber-500 to-yellow-600",
        features: [
            { icon: <Trophy size={16} />, text: "Track your ranking" },
            { icon: <Sparkles size={16} />, text: "See top predictors" },
            { icon: <Gift size={16} />, text: "Compete for the top spot" },
        ]
    },
    {
        id: 6,
        title: "Your Profile",
        subtitle: "Track & Claim",
        description: "View your voting history, see pending reveals, and claim rewards for winning predictions. All your activity in one place.",
        icon: <Wallet size={48} />,
        color: "text-gray-700",
        bgGradient: "from-gray-700 to-gray-900",
        features: [
            { icon: <Vote size={16} />, text: "View voting history" },
            { icon: <Gift size={16} />, text: "Claim your rewards" },
            { icon: <Eye size={16} />, text: "Track pending reveals" },
        ]
    },
    {
        id: 7,
        title: "Go PRO",
        subtitle: "Unlock Premium Features",
        description: "Upgrade to PRO to create your own community polls, get automatic vote reveals, and earn 25% of stakes from your polls.",
        icon: <Crown size={48} />,
        color: "text-yellow-500",
        bgGradient: "from-yellow-400 to-amber-500",
        features: [
            { icon: <Sparkles size={16} />, text: "Create unlimited polls" },
            { icon: <Unlock size={16} />, text: "Auto-reveal your votes" },
            { icon: <Gift size={16} />, text: "Earn from poll stakes" },
        ]
    },
    {
        id: 8,
        title: "You're Ready!",
        subtitle: "Start Predicting",
        description: "You now know everything you need to start making predictions. Connect your wallet, find a poll you like, and make your first vote!",
        icon: <CheckCircle size={48} />,
        color: "text-green-600",
        bgGradient: "from-green-500 to-emerald-600",
        features: [
            { icon: <Wallet size={16} />, text: "Connect your wallet" },
            { icon: <Zap size={16} />, text: "Find a poll" },
            { icon: <Vote size={16} />, text: "Make your prediction!" },
        ]
    },
];

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const step = ONBOARDING_STEPS[currentStep];

    const handleNext = () => {
        if (currentStep < ONBOARDING_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleComplete = () => {
        localStorage.setItem('oracle_polls_onboarding_complete', 'true');
        setCurrentStep(0);
        onClose();
    };

    const handleSkip = () => {
        localStorage.setItem('oracle_polls_onboarding_complete', 'true');
        setCurrentStep(0);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center px-4 font-sans">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white rounded-[2.5rem] w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl relative z-10"
            >
                {/* Skip Button */}
                <button
                    onClick={handleSkip}
                    className="absolute top-4 right-4 z-20 p-2 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/40 transition-colors"
                    aria-label="Skip onboarding"
                >
                    <X size={20} className="text-white" />
                </button>

                {/* Content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step.id}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.3 }}
                    >
                        {/* Header with gradient */}
                        <div className={cn(
                            "bg-gradient-to-br p-8 pb-12 text-white relative overflow-hidden",
                            step.bgGradient
                        )}>
                            <div className="absolute -right-8 -top-8 opacity-20">
                                {step.icon}
                            </div>
                            <div className="relative z-10">
                                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4">
                                    {step.icon}
                                </div>
                                <p className="text-white/80 text-sm font-bold uppercase tracking-wider mb-1">
                                    {step.subtitle}
                                </p>
                                <h2 className="text-2xl font-display font-black">
                                    {step.title}
                                </h2>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-6">
                            <p className="text-gray-600 leading-relaxed">
                                {step.description}
                            </p>

                            {/* Features */}
                            {step.features && (
                                <div className="space-y-3">
                                    {step.features.map((feature, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                                        >
                                            <div className={cn("p-2 rounded-lg bg-gray-100", step.color)}>
                                                {feature.icon}
                                            </div>
                                            <span className="font-medium text-gray-700 text-sm">
                                                {feature.text}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>

                {/* Footer */}
                <div className="p-6 pt-0 space-y-4">
                    {/* Progress Dots */}
                    <div className="flex justify-center gap-2">
                        {ONBOARDING_STEPS.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentStep(idx)}
                                className={cn(
                                    "w-2 h-2 rounded-full transition-all",
                                    idx === currentStep
                                        ? "bg-gray-800 w-6"
                                        : "bg-gray-300 hover:bg-gray-400"
                                )}
                                aria-label={`Go to step ${idx + 1}`}
                            />
                        ))}
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex gap-3">
                        {currentStep > 0 && (
                            <button
                                onClick={handlePrev}
                                className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
                            >
                                <ChevronLeft size={20} /> Back
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            className={cn(
                                "flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95",
                                currentStep === ONBOARDING_STEPS.length - 1
                                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30"
                                    : "bg-gray-900 text-white"
                            )}
                        >
                            {currentStep === ONBOARDING_STEPS.length - 1 ? (
                                <>Let's Go! <Sparkles size={20} /></>
                            ) : (
                                <>Next <ChevronRight size={20} /></>
                            )}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
