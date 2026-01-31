
import { cn } from '../../utils';

interface NavButtonProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    color: string;
}

export function NavButton({ active, onClick, icon, label, color }: NavButtonProps) {
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
