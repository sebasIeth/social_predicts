
import { motion } from 'framer-motion';
import { cn } from '../../utils';

type EmptyStateType = 'no-polls' | 'no-votes' | 'no-reveals' | 'no-results' | 'error' | 'no-community';

interface EmptyStateProps {
    type: EmptyStateType;
    title?: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

const illustrations: Record<EmptyStateType, React.ReactNode> = {
    'no-polls': (
        <svg viewBox="0 0 200 200" className="w-32 h-32">
            <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#f472b6" stopOpacity="0.3" />
                </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="80" fill="url(#grad1)" />
            <rect x="60" y="50" width="80" height="20" rx="4" fill="#a78bfa" opacity="0.6" />
            <rect x="60" y="80" width="80" height="12" rx="3" fill="#e5e7eb" />
            <rect x="60" y="100" width="60" height="12" rx="3" fill="#e5e7eb" />
            <circle cx="100" cy="140" r="15" fill="#f472b6" opacity="0.8" />
            <path d="M95 140 L100 145 L110 135" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    'no-votes': (
        <svg viewBox="0 0 200 200" className="w-32 h-32">
            <defs>
                <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.3" />
                </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="80" fill="url(#grad2)" />
            <path d="M70 100 L130 100" stroke="#9ca3af" strokeWidth="8" strokeLinecap="round" />
            <path d="M100 70 L100 130" stroke="#9ca3af" strokeWidth="8" strokeLinecap="round" />
            <circle cx="70" cy="70" r="8" fill="#34d399" opacity="0.6">
                <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="130" cy="130" r="8" fill="#60a5fa" opacity="0.6">
                <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" begin="0.5s" />
            </circle>
        </svg>
    ),
    'no-reveals': (
        <svg viewBox="0 0 200 200" className="w-32 h-32">
            <defs>
                <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0.3" />
                </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="80" fill="url(#grad3)" />
            <circle cx="100" cy="90" r="35" fill="none" stroke="#fbbf24" strokeWidth="6" />
            <circle cx="100" cy="90" r="15" fill="#fbbf24" opacity="0.8" />
            <rect x="95" y="130" width="10" height="30" rx="5" fill="#fbbf24" opacity="0.8" />
        </svg>
    ),
    'no-results': (
        <svg viewBox="0 0 200 200" className="w-32 h-32">
            <defs>
                <linearGradient id="grad4" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#ec4899" stopOpacity="0.3" />
                </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="80" fill="url(#grad4)" />
            <rect x="60" y="140" width="20" height="30" rx="4" fill="#8b5cf6" opacity="0.6" />
            <rect x="90" y="110" width="20" height="60" rx="4" fill="#a78bfa" opacity="0.8" />
            <rect x="120" y="80" width="20" height="90" rx="4" fill="#c4b5fd" />
            <circle cx="100" cy="55" r="12" fill="#fbbf24" />
        </svg>
    ),
    'error': (
        <svg viewBox="0 0 200 200" className="w-32 h-32">
            <defs>
                <linearGradient id="grad5" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0.3" />
                </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="80" fill="url(#grad5)" />
            <circle cx="100" cy="100" r="40" fill="none" stroke="#ef4444" strokeWidth="6" opacity="0.8" />
            <path d="M80 80 L120 120" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" />
            <path d="M120 80 L80 120" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" />
        </svg>
    ),
    'no-community': (
        <svg viewBox="0 0 200 200" className="w-32 h-32">
            <defs>
                <linearGradient id="grad6" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.3" />
                </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="80" fill="url(#grad6)" />
            <circle cx="80" cy="80" r="20" fill="#6366f1" opacity="0.6" />
            <circle cx="120" cy="80" r="20" fill="#8b5cf6" opacity="0.6" />
            <circle cx="100" cy="120" r="20" fill="#a78bfa" opacity="0.6" />
            <path d="M80 80 L100 120 L120 80" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
        </svg>
    ),
};

const defaultContent: Record<EmptyStateType, { title: string; description: string }> = {
    'no-polls': {
        title: 'No Polls Yet',
        description: 'Check back soon for new prediction polls!',
    },
    'no-votes': {
        title: 'No Votes Yet',
        description: "You haven't voted on any polls yet. Start making predictions!",
    },
    'no-reveals': {
        title: 'Nothing to Reveal',
        description: 'All your votes are revealed or still in voting phase.',
    },
    'no-results': {
        title: 'No Results Yet',
        description: 'Results will appear once polls are resolved.',
    },
    'error': {
        title: 'Something Went Wrong',
        description: 'We encountered an error. Please try again.',
    },
    'no-community': {
        title: 'No Community Polls',
        description: 'Be the first to create a community poll!',
    },
};

export function EmptyState({ type, title, description, action, className }: EmptyStateProps) {
    const content = defaultContent[type];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "flex flex-col items-center justify-center py-12 px-6 text-center",
                className
            )}
        >
            <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            >
                {illustrations[type]}
            </motion.div>

            <h3 className="text-xl font-display font-bold text-gray-800 dark:text-white mt-6 mb-2">
                {title || content.title}
            </h3>

            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[250px] leading-relaxed">
                {description || content.description}
            </p>

            {action && (
                <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    onClick={action.onClick}
                    className="mt-6 px-6 py-3 bg-candy-purple text-white font-bold rounded-xl shadow-lg shadow-candy-purple/30 hover:scale-105 active:scale-95 transition-transform"
                >
                    {action.label}
                </motion.button>
            )}
        </motion.div>
    );
}
