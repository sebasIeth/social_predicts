
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../utils';

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    const options = [
        { value: 'light' as const, icon: Sun, label: 'Light' },
        { value: 'dark' as const, icon: Moon, label: 'Dark' },
        { value: 'system' as const, icon: Monitor, label: 'System' },
    ];

    return (
        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-surface-dark rounded-xl">
            {options.map(({ value, icon: Icon, label }) => (
                <button
                    key={value}
                    onClick={() => setTheme(value)}
                    aria-label={`Set ${label} theme`}
                    className={cn(
                        "p-2 rounded-lg transition-all",
                        theme === value
                            ? "bg-white dark:bg-card-dark text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    )}
                >
                    <Icon size={16} />
                </button>
            ))}
        </div>
    );
}
