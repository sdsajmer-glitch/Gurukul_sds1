import React, { useState } from 'react';
import { supabase, formatError } from '../services/supabase';
import Spinner from './common/Spinner';
import { MailIcon } from './icons/MailIcon';
import { LockIcon } from './icons/LockIcon';
import { UserIcon } from './icons/UserIcon';
import { EyeIcon } from './icons/EyeIcon';
import { EyeOffIcon } from './icons/EyeOffIcon';
import { motion } from 'framer-motion';

interface SignupFormProps {
    onSuccess: (email: string) => void;
    onSwitchToLogin: () => void;
}

/**
 * FIX: Use 'SignupFormProps' as the generic type for React.FC instead of 'SignupForm' 
 * to resolve the "refers to a value, but is being used as a type" error.
 * The component is now fully implemented with logic for identity provisioning via Supabase.
 */
const SignupForm: React.FC<SignupFormProps> = ({ onSuccess, onSwitchToLogin }) => {
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        display_name: displayName,
                    }
                }
            });

            if (signUpError) {
                setError(formatError(signUpError));
                setLoading(false);
                return;
            }

            onSuccess(email);
        } catch (err: any) {
            setError("Provisioning Protocol Failure: " + formatError(err));
            setLoading(false);
        }
    };

    return (
        <div className="bg-[#0C0D12]/40 backdrop-blur-[40px] p-8 sm:p-12 md:p-14 rounded-[3.5rem] border border-white/5 space-y-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] relative overflow-hidden ring-1 ring-white/10 font-sans group">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent animate-scanner-move pointer-events-none opacity-20"></div>

            <div className="text-center space-y-4 relative z-10">
                <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/5 mb-2 backdrop-blur-md">
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Identity Provisioning</span>
                </div>
                <h2 className="text-[2.75rem] sm:text-5xl font-serif font-black text-white tracking-[-0.02em] leading-none uppercase">
                    Provision<span className="text-primary italic">.</span>
                </h2>
                <p className="text-text-tertiary text-sm font-medium tracking-tight leading-relaxed max-w-[280px] mx-auto italic font-serif opacity-80">
                    Initialize your <span className="text-white/60">institutional identity node</span> on the registry.
                </p>
            </div>

            <form onSubmit={handleSignup} className="space-y-6 md:space-y-8 relative z-10">
                {error && (
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest p-4 rounded-2xl flex items-center gap-3"
                    >
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                        <span className="flex-1">{error}</span>
                    </motion.div>
                )}

                <div className="space-y-6 md:space-y-8">
                    <div className="group relative">
                        <div className="absolute top-1/2 -translate-y-1/2 left-6 flex items-center pointer-events-none text-white/20 group-focus-within:text-white transition-all duration-500 z-10">
                            <UserIcon className="h-5.5 w-5.5" />
                        </div>
                        <input
                            type="text"
                            required
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="peer block w-full h-[72px] pl-16 pr-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-base text-white placeholder-transparent focus:outline-none focus:ring-[3px] focus:ring-primary/20 focus:border-primary/40 focus:bg-white/[0.06] transition-all duration-500 font-sans tracking-wide shadow-inner"
                            placeholder="Legal Handle"
                            id="handle_input"
                        />
                        <label
                            htmlFor="handle_input"
                            className="absolute left-16 top-1/2 -translate-y-1/2 text-sm font-medium text-white/25 uppercase tracking-[0.1em] peer-placeholder-shown:text-white/20 peer-focus:-top-2 peer-focus:left-6 peer-focus:text-[10px] peer-focus:text-primary peer-focus:font-black peer-focus:tracking-[0.2em] peer-focus:bg-[#12131A] peer-focus:px-2 peer-focus:rounded-md peer-focus:translate-y-0 transition-all duration-500 pointer-events-none"
                        >
                            Full Identity Name
                        </label>
                    </div>

                    <div className="group relative">
                        <div className="absolute top-1/2 -translate-y-1/2 left-6 flex items-center pointer-events-none text-white/20 group-focus-within:text-white transition-all duration-500 z-10">
                            <MailIcon className="h-5.5 w-5.5" />
                        </div>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="peer block w-full h-[72px] pl-16 pr-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-base text-white placeholder-transparent focus:outline-none focus:ring-[3px] focus:ring-primary/20 focus:border-primary/40 focus:bg-white/[0.06] transition-all duration-500 font-sans tracking-wide shadow-inner"
                            placeholder="Communication Uplink"
                            id="email_signup"
                        />
                        <label
                            htmlFor="email_signup"
                            className="absolute left-16 top-1/2 -translate-y-1/2 text-sm font-medium text-white/25 uppercase tracking-[0.1em] peer-placeholder-shown:text-white/20 peer-focus:-top-2 peer-focus:left-6 peer-focus:text-[10px] peer-focus:text-primary peer-focus:font-black peer-focus:tracking-[0.2em] peer-focus:bg-[#12131A] peer-focus:px-2 peer-focus:rounded-md peer-focus:translate-y-0 transition-all duration-500 pointer-events-none"
                        >
                            Institutional Email
                        </label>
                    </div>

                    <div className="group relative">
                        <div className="absolute top-1/2 -translate-y-1/2 left-6 flex items-center pointer-events-none text-white/20 group-focus-within:text-white transition-all duration-500 z-10">
                            <LockIcon className="h-5.5 w-5.5" />
                        </div>
                        <input
                            type={showPassword ? "text" : "password"}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="peer block w-full h-[72px] pl-16 pr-16 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-base text-white placeholder-transparent focus:outline-none focus:ring-[3px] focus:ring-primary/20 focus:border-primary/40 focus:bg-white/[0.06] transition-all duration-500 font-sans tracking-widest shadow-inner"
                            placeholder="Cipher Key"
                            id="password_signup"
                        />
                        <label
                            htmlFor="password_signup"
                            className="absolute left-16 top-1/2 -translate-y-1/2 text-sm font-medium text-white/25 uppercase tracking-[0.1em] peer-placeholder-shown:text-white/20 peer-focus:-top-2 peer-focus:left-6 peer-focus:text-[10px] peer-focus:text-primary peer-focus:font-black peer-focus:tracking-[0.2em] peer-focus:bg-[#12131A] peer-focus:px-2 peer-focus:rounded-md peer-focus:translate-y-0 transition-all duration-500 pointer-events-none"
                        >
                            Provision Key
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute top-1/2 -translate-y-1/2 right-6 flex items-center text-white/20 hover:text-white transition-all p-1.5 hover:bg-white/5 rounded-lg active:scale-90"
                        >
                            {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        </button>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-[72px] flex items-center justify-center py-3.5 px-8 rounded-2xl shadow-[0_20px_40px_-10px_rgba(139,92,246,0.3)] text-xs font-black text-white bg-primary hover:bg-[#9D5BF0] focus:outline-none focus:ring-[6px] focus:ring-primary/10 transition-all transform hover:-translate-y-1 active:scale-[0.97] disabled:opacity-50 uppercase tracking-[0.4em] relative overflow-hidden group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000"></div>
                            {loading ? <Spinner size="md" className="text-white" /> : 'Request Initialization'}
                        </button>
                    </div>
                </div>
            </form>

            <div className="text-center relative z-10 border-t border-white/[0.03] pt-10">
                <p className="text-[10px] text-white/25 font-black uppercase tracking-[0.2em]">
                    Existing Node?{' '}
                    <button onClick={onSwitchToLogin} className="text-primary hover:text-[#9D5BF0] transition-all ml-2 underline underline-offset-8">Access Console</button>
                </p>
            </div>
        </div>
    );
};

// FIX: Added missing default export to resolve the "no default export" error in AuthPage.tsx.
export default SignupForm;