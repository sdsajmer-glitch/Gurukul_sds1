import React, { useState } from 'react';
import { supabase, formatError } from '../services/supabase';
import Spinner from './common/Spinner';
import { MailIcon } from './icons/MailIcon';
import { LockIcon } from './icons/LockIcon';
import { EyeIcon } from './icons/EyeIcon';
import { EyeOffIcon } from './icons/EyeOffIcon';
// Fix: Added missing ChevronRightIcon import to resolve compiler error on line 123.
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { motion, AnimatePresence } from 'framer-motion';

interface LoginFormProps {
    onSwitchToSignup: () => void;
    onForgotPassword: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToSignup, onForgotPassword }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
            if (signInError) {
                setError(formatError(signInError));
                setLoading(false);
                return;
            }
        } catch (err: any) {
            setError("Connection Failed: " + formatError(err));
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0D0F14]/70 backdrop-blur-[60px] p-8 sm:p-10 md:p-12 rounded-[3.5rem] border border-white/10 space-y-10 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] relative overflow-hidden ring-1 ring-white/10 font-sans w-full max-w-[480px] mx-auto group"
        >
            {/* Animated Scanning Line (Subtle) */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent animate-scanner-move pointer-events-none opacity-30"></div>

            {/* Background Ambient Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-primary/20 transition-colors duration-1000"></div>

            <div className="text-center space-y-4 relative z-10">
                <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/5 mb-2 backdrop-blur-md">
                    <div className="relative">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping opacity-75"></div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Secure Node Access</span>
                </div>
                <h2 className="text-3xl font-sans font-bold text-white tracking-tight">
                    Sign In
                </h2>
                <p className="text-white/40 text-sm font-medium">
                    Authenticate your identity to continue to <span className="text-white">Universepi OS</span>.
                </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6 relative z-10">
                <AnimatePresence mode="wait">
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold p-4 rounded-2xl flex items-start gap-3 shadow-lg"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0"></div>
                            <span className="flex-1 leading-relaxed">{error}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="space-y-4">
                    {/* Email Input */}
                    <div className="group relative">
                        <div className="absolute top-1/2 -translate-y-1/2 left-6 flex items-center pointer-events-none text-white/10 group-focus-within:text-primary transition-all duration-500 z-10">
                            <MailIcon className="h-5 w-5" />
                        </div>
                        <input
                            type="email"
                            required
                            name="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="peer block w-full h-16 pl-14 pr-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-base text-white placeholder-transparent focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all duration-300 font-sans shadow-sm group-hover:bg-white/[0.05]"
                            placeholder="Email Address"
                            id="email_input"
                        />
                        <label
                            htmlFor="email_input"
                            className="absolute left-14 top-1/2 -translate-y-1/2 text-sm text-white/30 peer-placeholder-shown:text-white/30 peer-focus:-top-2 peer-focus:left-4 peer-focus:text-xs peer-focus:text-primary peer-focus:bg-[#0D0F14] peer-focus:px-2 rounded transition-all duration-300 pointer-events-none"
                        >
                            Institutional Email
                        </label>
                    </div>

                    {/* Password Input */}
                    <div className="group relative">
                        <div className="absolute top-1/2 -translate-y-1/2 left-6 flex items-center pointer-events-none text-white/10 group-focus-within:text-primary transition-all duration-500 z-10">
                            <LockIcon className="h-5 w-5" />
                        </div>
                        <input
                            type={showPassword ? "text" : "password"}
                            required
                            name="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="peer block w-full h-16 pl-14 pr-12 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-base text-white placeholder-transparent focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all duration-300 font-sans shadow-sm group-hover:bg-white/[0.05]"
                            placeholder="Password"
                            id="password_input"
                        />
                        <label
                            htmlFor="password_input"
                            className="absolute left-14 top-1/2 -translate-y-1/2 text-sm text-white/30 peer-placeholder-shown:text-white/30 peer-focus:-top-2 peer-focus:left-4 peer-focus:text-xs peer-focus:text-primary peer-focus:bg-[#0D0F14] peer-focus:px-2 rounded transition-all duration-300 pointer-events-none"
                        >
                            Secure Password
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute top-1/2 -translate-y-1/2 right-6 flex items-center text-white/10 hover:text-white transition-all p-2 hover:bg-white/5 rounded-lg active:scale-90"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        </button>
                    </div>

                    <div className="flex justify-end pt-1">
                        <button
                            type="button"
                            onClick={onForgotPassword}
                            className="text-xs font-bold uppercase tracking-widest text-primary/60 hover:text-primary transition-colors"
                        >
                            Reset Password?
                        </button>
                    </div>
                </div>

                <div className="pt-4 space-y-6">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-14 flex items-center justify-center rounded-2xl shadow-xl text-xs font-black uppercase tracking-[0.2em] text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-[#0C0D12] transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-70 disabled:hover:translate-y-0"
                    >
                        {loading ? (
                            <Spinner size="md" className="text-white" />
                        ) : (
                            <span className="flex items-center gap-2">
                                Authenticate Access
                            </span>
                        )}
                    </button>

                    <div className="flex items-center justify-center gap-3 opacity-10 group-hover:opacity-30 transition-opacity duration-700">
                        <div className="h-px w-12 bg-white/50"></div>
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white">Encrypted Connection</span>
                        <div className="h-px w-12 bg-white/50"></div>
                    </div>
                </div>
            </form>

            <div className="text-center relative z-10 border-t border-white/5 pt-10">
                <button
                    onClick={onSwitchToSignup}
                    className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-colors"
                >
                    Create Managed account
                </button>
            </div>
        </motion.div>
    );
};

export default LoginForm;