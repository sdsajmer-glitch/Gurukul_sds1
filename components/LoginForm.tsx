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
            className="bg-[#0c0d12]/60 backdrop-blur-2xl p-8 sm:p-12 md:p-16 rounded-[2.5rem] border border-white/5 space-y-12 shadow-2xl relative overflow-hidden ring-1 ring-white/5 font-sans w-full max-w-[500px] mx-auto"
        >
            {/* Animated Scanning Line */}
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-scanner-move pointer-events-none opacity-30"></div>

            <div className="text-center space-y-6 relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 mb-2 backdrop-blur-md">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest">Secure Gateway</span>
                </div>
                <h2 className="text-4xl sm:text-5xl md:text-5xl font-serif font-black text-white tracking-tight leading-none">INITIALIZE.</h2>
                <p className="text-white/40 text-xs sm:text-sm font-medium tracking-wide leading-relaxed max-w-xs mx-auto">
                    Access the core institutional cluster through your verified credentials node.
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

                <div className="space-y-4">
                    {/* Email Input */}
                    <div className="group relative">
                        <div className="absolute top-1/2 -translate-y-1/2 left-5 flex items-center pointer-events-none text-white/20 group-focus-within:text-primary transition-all duration-300 z-10">
                            <MailIcon className="h-5 w-5" />
                        </div>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="peer block w-full h-16 sm:h-[72px] pl-14 pr-6 bg-white/5 border border-white/10 rounded-2xl text-base text-white placeholder-transparent focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 focus:bg-white/10 transition-all duration-300 font-sans tracking-wide shadow-sm"
                            placeholder="Email Address"
                            id="email_input"
                        />
                        <label
                            htmlFor="email_input"
                            className="absolute left-14 -top-2.5 bg-[#0e0f14] px-2 text-[10px] font-bold text-white/40 uppercase tracking-widest peer-placeholder-shown:text-base peer-placeholder-shown:text-white/20 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-focus:-top-2.5 peer-focus:text-[10px] peer-focus:text-primary peer-focus:translate-y-0 transition-all duration-300 pointer-events-none rounded-md"
                        >
                            Identity Identifier
                        </label>
                    </div>

                    {/* Password Input */}
                    <div className="group relative">
                        <div className="absolute top-1/2 -translate-y-1/2 left-5 flex items-center pointer-events-none text-white/20 group-focus-within:text-primary transition-all duration-300 z-10">
                            <LockIcon className="h-5 w-5" />
                        </div>
                        <input
                            type={showPassword ? "text" : "password"}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="peer block w-full h-16 sm:h-[72px] pl-14 pr-14 bg-white/5 border border-white/10 rounded-2xl text-base text-white placeholder-transparent focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 focus:bg-white/10 transition-all duration-300 font-sans tracking-wider shadow-sm"
                            placeholder="Password"
                            id="password_input"
                        />
                        <label
                            htmlFor="password_input"
                            className="absolute left-14 -top-2.5 bg-[#0e0f14] px-2 text-[10px] font-bold text-white/40 uppercase tracking-widest peer-placeholder-shown:text-base peer-placeholder-shown:text-white/20 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-focus:-top-2.5 peer-focus:text-[10px] peer-focus:text-primary peer-focus:translate-y-0 transition-all duration-300 pointer-events-none rounded-md"
                        >
                            Access Cipher
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute top-1/2 -translate-y-1/2 right-5 flex items-center text-white/20 hover:text-white transition-colors p-1"
                        >
                            {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        </button>
                    </div>

                    <div className="flex justify-end">
                        <button type="button" onClick={onForgotPassword} className="text-[11px] font-medium text-white/30 hover:text-primary transition-colors tracking-wide">
                            Lost your access key?
                        </button>
                    </div>
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-16 sm:h-[72px] flex items-center justify-center rounded-2xl shadow-lg shadow-primary/20 text-xs font-black text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 uppercase tracking-[0.2em] relative overflow-hidden group"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                        {loading ? <Spinner size="md" className="text-white" /> : <span className="flex items-center gap-2">Confirm Identity Node</span>}
                    </button>
                </div>
            </form>

            <div className="text-center relative z-10 border-t border-white/5 pt-8">
                <button onClick={onSwitchToSignup} className="text-xs font-medium text-white/40 hover:text-white transition-colors tracking-widest uppercase opacity-70 hover:opacity-100">
                    Provision Access
                </button>
            </div>
        </motion.div>
    );
};

export default LoginForm;