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
            setError("Connectivity Protocol Failure: " + formatError(err));
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0C0D12]/40 backdrop-blur-[40px] p-8 sm:p-12 md:p-14 rounded-[3.5rem] border border-white/5 space-y-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] relative overflow-hidden ring-1 ring-white/10 font-sans w-full max-w-[500px] mx-auto group"
        >
            {/* Animated Scanning Line (Subtle) */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent animate-scanner-move pointer-events-none opacity-20"></div>

            {/* Background Ambient Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-primary/10 transition-colors duration-1000"></div>

            <div className="text-center space-y-8 relative z-10">
                <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/5 mb-2 backdrop-blur-md">
                    <div className="relative">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75"></div>
                    </div>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Institutional Gateway</span>
                </div>
                <h2 className="text-[2.75rem] sm:text-5xl font-serif font-black text-white tracking-[-0.02em] leading-none uppercase">
                    Initialize<span className="text-primary italic">.</span>
                </h2>
                <p className="text-text-tertiary text-sm font-medium tracking-tight leading-relaxed max-w-[280px] mx-auto italic font-serif opacity-80">
                    Access the administrative cluster via your <span className="text-white/60">verified credential node</span>.
                </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6 relative z-10">
                <AnimatePresence mode="wait">
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium p-4 rounded-xl flex items-start gap-3 shadow-lg"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0"></div>
                            <span className="flex-1 leading-relaxed">{error}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="space-y-6">
                    {/* Email Input */}
                    <div className="group relative">
                        <div className="absolute top-1/2 -translate-y-1/2 left-6 flex items-center pointer-events-none text-white/20 group-focus-within:text-white transition-all duration-500 z-10">
                            <MailIcon className="h-5.5 w-5.5" />
                        </div>
                        <input
                            type="email"
                            required
                            name="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="peer block w-full h-[72px] pl-16 pr-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-base text-white placeholder-transparent focus:outline-none focus:ring-[3px] focus:ring-primary/20 focus:border-primary/40 focus:bg-white/[0.06] transition-all duration-500 font-sans tracking-wide shadow-inner"
                            placeholder="Institutional Identity"
                            id="email_input"
                        />
                        <label
                            htmlFor="email_input"
                            className="absolute left-16 top-1/2 -translate-y-1/2 text-sm font-medium text-white/25 uppercase tracking-[0.1em] peer-placeholder-shown:text-white/20 peer-focus:-top-2 peer-focus:left-6 peer-focus:text-[10px] peer-focus:text-primary peer-focus:font-black peer-focus:tracking-[0.2em] peer-focus:bg-[#12131A] peer-focus:px-2 peer-focus:rounded-md peer-focus:translate-y-0 transition-all duration-500 pointer-events-none"
                        >
                            Email Address
                        </label>
                        {/* Terminology clarification helper */}
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 peer-focus:opacity-100 transition-opacity duration-300 pointer-events-none hidden sm:block">
                            <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest">Identity Node</span>
                        </div>
                    </div>

                    {/* Password Input */}
                    <div className="group relative">
                        <div className="absolute top-1/2 -translate-y-1/2 left-6 flex items-center pointer-events-none text-white/20 group-focus-within:text-white transition-all duration-500 z-10">
                            <LockIcon className="h-5.5 w-5.5" />
                        </div>
                        <input
                            type={showPassword ? "text" : "password"}
                            required
                            name="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="peer block w-full h-[72px] pl-16 pr-16 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-base text-white placeholder-transparent focus:outline-none focus:ring-[3px] focus:ring-primary/20 focus:border-primary/40 focus:bg-white/[0.06] transition-all duration-500 font-sans tracking-widest shadow-inner"
                            placeholder="Access Cipher"
                            id="password_input"
                        />
                        <label
                            htmlFor="password_input"
                            className="absolute left-16 top-1/2 -translate-y-1/2 text-sm font-medium text-white/25 uppercase tracking-[0.1em] peer-placeholder-shown:text-white/20 peer-focus:-top-2 peer-focus:left-6 peer-focus:text-[10px] peer-focus:text-primary peer-focus:font-black peer-focus:tracking-[0.2em] peer-focus:bg-[#12131A] peer-focus:px-2 peer-focus:rounded-md peer-focus:translate-y-0 transition-all duration-500 pointer-events-none"
                        >
                            Access Key
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute top-1/2 -translate-y-1/2 right-6 flex items-center text-white/20 hover:text-white transition-all p-1.5 hover:bg-white/5 rounded-lg active:scale-90"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        </button>
                    </div>

                    <div className="flex justify-end pr-2">
                        <button
                            type="button"
                            onClick={onForgotPassword}
                            className="text-[10px] font-black text-white/30 hover:text-primary transition-all tracking-[0.15em] uppercase"
                        >
                            Lost Access Key?
                        </button>
                    </div>
                </div>

                <div className="pt-4 space-y-6">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-[72px] flex items-center justify-center rounded-2xl shadow-[0_20px_40px_-10px_rgba(139,92,246,0.3)] text-xs font-black text-white bg-primary hover:bg-[#9D5BF0] focus:outline-none focus:ring-[6px] focus:ring-primary/10 transition-all transform hover:-translate-y-1 active:scale-[0.97] disabled:opacity-50 uppercase tracking-[0.4em] relative overflow-hidden group"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000"></div>
                        {loading ? (
                            <Spinner size="md" className="text-white" />
                        ) : (
                            <span className="flex items-center gap-4">
                                <LockIcon className="h-4 w-4 opacity-40" />
                                Confirm Identity Node
                            </span>
                        )}
                    </button>

                    <div className="flex items-center justify-center gap-3 opacity-30 group-hover:opacity-50 transition-opacity duration-700">
                        <div className="h-px w-8 bg-white/20"></div>
                        <span className="text-[8px] font-black uppercase tracking-[0.5em] whitespace-nowrap">AES-256 Encrypted & Audited</span>
                        <div className="h-px w-8 bg-white/20"></div>
                    </div>
                </div>
            </form>

            <div className="text-center relative z-10 border-t border-white/[0.03] pt-10">
                <button
                    onClick={onSwitchToSignup}
                    className="text-[10px] font-black text-white/25 hover:text-white transition-all tracking-[0.25em] uppercase hover:tracking-[0.35em]"
                >
                    Provision New Access
                </button>
            </div>
        </motion.div>
    );
};

export default LoginForm;