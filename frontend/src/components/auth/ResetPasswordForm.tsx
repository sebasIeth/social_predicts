import { useState } from 'react';
import { useEmailAuth } from '@openfort/react';
import { motion } from 'framer-motion';
import { Mail, ArrowRight, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';

interface ResetPasswordFormProps {
    onBack: () => void;
    onSuccess: () => void;
}

export function ResetPasswordForm({ onBack, onSuccess }: ResetPasswordFormProps) {
    const { requestResetPassword, isLoading } = useEmailAuth();
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        try {
            const result = await requestResetPassword({ email, emailVerificationRedirectTo: window.location.origin });

            if (result.error) {
                setError(result.error.message || "Failed to request password reset.");
                return;
            }

            setSent(true);
            // onSuccess(); // Optionally close or show success message
        } catch (err: any) {
            console.error(err);
            setError(err.message || "An unexpected error occurred.");
        }
    };

    if (sent) {
        return (
            <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-500">
                    <Mail size={40} />
                </div>
                <h3 className="text-2xl font-display font-bold text-gray-800">Check your inbox!</h3>
                <p className="text-gray-500 font-medium leading-relaxed">
                    We sent a password reset link to <br /><span className="font-bold text-gray-800">{email}</span>
                </p>
                <button
                    onClick={onBack}
                    className="w-full bg-gray-900 text-white font-black py-4 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                >
                    BACK TO LOGIN
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
                <button
                    type="button"
                    onClick={onBack}
                    className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-800 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <h3 className="text-xl font-display font-bold text-gray-800">Reset Password</h3>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Email</label>
                <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-gray-800 font-bold outline-none focus:border-candy-mint transition-colors placeholder:text-gray-300"
                        placeholder="wizard@example.com"
                    />
                </div>
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
                className="w-full bg-candy-mint text-white font-black py-4 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="animate-spin" />
                        SENDING...
                    </>
                ) : (
                    <>
                        SEND RESET LINK <ArrowRight size={20} />
                    </>
                )}
            </button>
        </form>
    );
}
