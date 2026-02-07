
import { cn } from '../../utils';

interface NavButtonProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    color: string;
    badge?: number;
    urgent?: boolean;
}

export function NavButton({ active, onClick, icon, label, color, badge, urgent }: NavButtonProps) {
    return (
        <button
            onClick={onClick}
            aria-label={badge ? `${label} (${badge} pending)` : label}
            aria-current={active ? 'page' : undefined}
            className={cn(
                "flex-1 flex flex-col items-center gap-1 p-3 rounded-3xl transition-all duration-300 relative",
                "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500",
                active ? `${color} text-white shadow-lg scale-105` : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95"
            )}
        >
            <div className={cn("p-1 relative", active && "animate-bounce-slow")}>
                {icon}
                {/* Badge */}
                {badge !== undefined && badge > 0 && (
                    <span
                        className={cn(
                            "absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center",
                            "text-[10px] font-black text-white rounded-full px-1",
                            urgent
                                ? "bg-red-500 animate-pulse shadow-lg shadow-red-500/50"
                                : "bg-candy-pink shadow-md"
                        )}
                    >
                        {badge > 99 ? '99+' : badge}
                    </span>
                )}
            </div>
            {active && <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>}
        </button>
    );
}
