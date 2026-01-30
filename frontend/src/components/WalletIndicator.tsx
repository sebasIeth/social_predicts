import { useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useWallets } from '@openfort/react';
import { LogOut, Copy, Check, ChevronDown, Wallet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WalletIndicatorProps {
    onConnect?: () => void;
}

export function WalletIndicator({ onConnect }: WalletIndicatorProps) {
    const { address: wagmiAddress } = useAccount();
    const { disconnect } = useDisconnect();
    // Get Openfort wallet directly
    const { wallets } = useWallets();
    const openfortAddress = wallets?.[0]?.address; // Adjust based on actual Openfort wallet object structure

    // Use wagmi address or Openfort address. Prefer wagmi if connected, otherwise Openfort.
    // Note: Openfort address might be available even if wagmi isn't "connected" in the traditional sense yet.
    const address = wagmiAddress || openfortAddress;

    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    // If ANY address is present, show the indicator.
    if (!address) {
        if (onConnect) {
            return (
                <button
                    onClick={onConnect}
                    className="flex items-center gap-2 bg-gray-900 text-white rounded-full pl-3 pr-4 py-2 shadow-lg hover:scale-105 transition-all active:scale-95"
                >
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                        <Wallet size={14} className="text-white" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider">
                        Connect
                    </span>
                </button>
            );
        }
        return null;
    }

    const truncateAddress = (addr: string) => {
        if (!addr) return "";
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const copyAddress = async () => {
        await navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleLogout = () => {
        disconnect();
        // Manual cleanup to ensure Openfort session is also cleared if needed
        localStorage.removeItem('openfort-session');
        localStorage.clear();
        window.location.reload();
    };

    return (
        <div className="relative z-50">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-white rounded-full pl-2 pr-4 py-2 shadow-sm border border-gray-100 hover:shadow-md transition-all active:scale-95"
            >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-candy-purple to-candy-pink flex items-center justify-center text-white">
                    <Wallet size={16} />
                </div>
                <div className="flex flex-col items-start">
                    <span className="text-xs font-bold text-gray-800 leading-none">
                        {truncateAddress(address)}
                    </span>
                    <span className="text-[10px] font-bold text-green-500 leading-none mt-1">
                        Connected
                    </span>
                </div>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 z-50 flex flex-col gap-1"
                        >
                            <button
                                onClick={copyAddress}
                                className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors text-left group"
                            >
                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-white border border-transparent group-hover:border-gray-200 transition-all">
                                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-500" />}
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">Address</span>
                                    <span className="text-sm font-bold text-gray-800">
                                        {copied ? "Copied!" : "Copy Address"}
                                    </span>
                                </div>
                            </button>

                            <div className="h-px bg-gray-100 my-1" />

                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-3 w-full px-4 py-3 hover:bg-red-50 rounded-xl transition-colors text-left group"
                            >
                                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-all">
                                    <LogOut size={14} className="text-red-500" />
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-red-300 block uppercase tracking-wider">Session</span>
                                    <span className="text-sm font-bold text-red-500">Disconnect</span>
                                </div>
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
