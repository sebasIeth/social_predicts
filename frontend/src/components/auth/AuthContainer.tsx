import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, User, LogIn, Ghost } from 'lucide-react';
import { LoginForm } from './LoginForm';
import { SignUpForm } from './SignUpForm';
import { ResetPasswordForm } from './ResetPasswordForm';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

type AuthView = 'LOGIN' | 'SIGNUP' | 'RESET';

interface AuthContainerProps {
    onSuccess: () => void;
    onGuest: () => void;
}

export function AuthContainer({ onSuccess, onGuest }: AuthContainerProps) {
    const [view, setView] = useState<AuthView>('LOGIN');

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

                <div className="relative px-8 pt-12 pb-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-candy-purple rounded-2xl rotate-3 flex items-center justify-center shadow-lg mx-auto mb-4">
                            <Sparkles className="text-white w-8 h-8" />
                        </div>
                        <h1 className="text-3xl font-display font-black text-gray-800 tracking-tight mb-1">
                            Social Predicts
                        </h1>
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                            Join the future of prediction
                        </p>
                    </div>

                    <AnimatePresence mode="wait">
                        {view === 'LOGIN' && (
                            <motion.div
                                key="login"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                            >
                                <div className="flex bg-gray-100 p-1 rounded-2xl mb-6">
                                    <button
                                        onClick={() => setView('LOGIN')}
                                        className="flex-1 py-3 rounded-xl text-sm font-black transition-all bg-white text-gray-800 shadow-sm"
                                    >
                                        LOGIN
                                    </button>
                                    <button
                                        onClick={() => setView('SIGNUP')}
                                        className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-400 hover:text-gray-600 transition-all"
                                    >
                                        SIGN UP
                                    </button>
                                </div>

                                <div className="mb-6">
                                    <h2 className="text-xl font-display font-bold text-gray-800 mb-4">Welcome Back!</h2>
                                    <LoginForm
                                        onForgotPassword={() => setView('RESET')}
                                        onSuccess={onSuccess}
                                    />
                                </div>
                            </motion.div>
                        )}

                        {view === 'SIGNUP' && (
                            <motion.div
                                key="signup"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <div className="flex bg-gray-100 p-1 rounded-2xl mb-6">
                                    <button
                                        onClick={() => setView('LOGIN')}
                                        className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-400 hover:text-gray-600 transition-all"
                                    >
                                        LOGIN
                                    </button>
                                    <button
                                        onClick={() => setView('SIGNUP')}
                                        className="flex-1 py-3 rounded-xl text-sm font-black transition-all bg-white text-gray-800 shadow-sm"
                                    >
                                        SIGN UP
                                    </button>
                                </div>

                                <div className="mb-6">
                                    <h2 className="text-xl font-display font-bold text-gray-800 mb-4">Create Account</h2>
                                    <SignUpForm onSuccess={onSuccess} />
                                </div>
                            </motion.div>
                        )}

                        {view === 'RESET' && (
                            <motion.div
                                key="reset"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <ResetPasswordForm
                                    onBack={() => setView('LOGIN')}
                                    onSuccess={() => setView('LOGIN')}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Guest Login Divider */}
                    {view !== 'RESET' && (
                        <>
                            <div className="relative flex py-5 items-center">
                                <div className="flex-grow border-t-2 border-gray-100"></div>
                                <span className="flex-shrink-0 mx-4 text-xs font-bold text-gray-300 uppercase">Or continue with</span>
                                <div className="flex-grow border-t-2 border-gray-100"></div>
                            </div>

                            <button
                                onClick={onGuest}
                                className="w-full py-4 border-2 border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 hover:text-gray-800 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
                            >
                                <Ghost size={20} />
                                CONTINUE AS GUEST
                            </button>
                        </>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
