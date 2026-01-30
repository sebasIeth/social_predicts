import { useState, useEffect } from 'react';
import { useEmailAuth, useSignOut } from '@openfort/react';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

interface LoginFormProps {
    onForgotPassword: () => void;
    onSuccess: () => void;
}

export function LoginForm({ onForgotPassword, onSuccess }: LoginFormProps) {
    const { signInEmail, isLoading, user } = useEmailAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const { signOut } = useSignOut();

    // Remove auto-redirect useEffect to avoid confusion
    // Instead, if user is present, show a "Continue" or "Logout" prompt

    // ... (rest of simple handlers)

    if (user) {
        return (
            <div className="space-y-4 text-center">
                <div className="bg-green-50 text-green-700 p-4 rounded-2xl mb-4 border border-green-100">
                    <p className="font-bold text-sm">You are logged in as:</p>
                    <p className="font-black text-lg">{user.email}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={onSuccess}
                        className="w-full bg-gray-900 text-white font-black py-4 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        CONTINUE <ArrowRight className="inline ml-1" size={16} />
                    </button>
                    <button
                        onClick={() => signOut()}
                        className="w-full bg-white text-gray-500 font-bold py-4 rounded-2xl border-2 border-gray-100 hover:bg-gray-50 hover:text-red-500 transition-all"
                    >
                        LOGOUT
                    </button>
                </div>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        try {
            const result = await signInEmail({ email, password });

            if (result.error) {
                if (result.error.message?.toLowerCase().includes("already logged in")) {
                    console.log("Caught 'Already logged in' error, redirecting...");
                    onSuccess();
                    return;
                }
                setError(result.error.message || "Failed to login. Please check your credentials.");
                return;
            }

            if (result.requiresEmailVerification) {
                setError("Please verify your email address before logging in.");
                return;
            }

            onSuccess();
        } catch (err: any) {
            console.error(err);
            setError(err.message || "An unexpected error occurred.");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Email</label>
                <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-gray-800 font-bold outline-none focus:border-candy-purple transition-colors placeholder:text-gray-300"
                        placeholder="wizard@example.com"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Password</label>
                <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-gray-800 font-bold outline-none focus:border-candy-purple transition-colors placeholder:text-gray-300"
                        placeholder="••••••••"
                    />
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={onForgotPassword}
                    className="text-xs font-bold text-candy-purple hover:text-candy-purple/80"
                >
                    Forgot Password?
                </button>
            </div>

            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-red-50 text-red-500 rounded-xl text-sm font-bold flex items-center gap-2"
                >
                    <AlertCircle size={16} />
                    {error}
                </motion.div>
            )}

            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gray-900 text-white font-black py-4 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="animate-spin" />
                        LOGGING IN...
                    </>
                ) : (
                    <>
                        LOGIN <ArrowRight size={20} />
                    </>
                )}
            </button>
        </form>
    );
}
