
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: Theme;
    actualTheme: 'light' | 'dark';
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'oracle_polls_theme';

function getSystemTheme(): 'light' | 'dark' {
    if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
            return stored || 'system';
        }
        return 'system';
    });

    const [actualTheme, setActualTheme] = useState<'light' | 'dark'>(() => {
        const storedTheme = typeof window !== 'undefined'
            ? localStorage.getItem(STORAGE_KEY) as Theme | null
            : null;
        const currentTheme = storedTheme || 'system';

        if (currentTheme === 'system') {
            return getSystemTheme();
        }
        return currentTheme as 'light' | 'dark';
    });

    // Apply theme class immediately on mount and on change
    useEffect(() => {
        const root = document.documentElement;

        let newActualTheme: 'light' | 'dark';
        if (theme === 'system') {
            newActualTheme = getSystemTheme();
        } else {
            newActualTheme = theme;
        }

        setActualTheme(newActualTheme);

        // Remove both classes first, then add the correct one
        root.classList.remove('light', 'dark');
        root.classList.add(newActualTheme);

        localStorage.setItem(STORAGE_KEY, theme);
    }, [theme]);

    // Listen for system theme changes
    useEffect(() => {
        if (theme !== 'system') return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = (e: MediaQueryListEvent) => {
            setActualTheme(e.matches ? 'dark' : 'light');
            document.documentElement.classList.toggle('dark', e.matches);
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, actualTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
