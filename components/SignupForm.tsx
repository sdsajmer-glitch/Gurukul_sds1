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
 * The component is now fully implemented with logic for account creation via Supabase.
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
            setError("Signup Failed: " + formatError(err));
            setLoading(false);
        }
    };

    return (
        <div className="bg-[#0C0D12]/40 backdrop-blur-[40px] p-8 sm:p-12 md:p-14 rounded-[3.5rem] border border-white/5 space-y-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] relative overflow-hidden ring-1 ring-white/10 font-sans group">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent animate-scanner-move pointer-events-none opacity-20"></div>

            <div className="text-center space-y-4 relative z-10">
                <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/5 mb-2 backdrop-blur-md">
                    <span className="text-xs font-semibold text-white/60 tracking-wider">Join Universepi</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-sans font-bold text-white tracking-tight">
                    Create Account
                </h2>
                <p className="text-text-tertiary text-base font-normal max-w-[280px] mx-auto mt-3">
                    Sign up to access the school portal.
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
                            className="peer block w-full h-14 pl-14 pr-6 bg-white/[0.03] border border-white/[0.08] rounded-xl text-base text-white placeholder-transparent focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all duration-300 font-sans shadow-sm"
                            placeholder="Full Name"
                            id="handle_input"
                        />
                        <label
                            htmlFor="handle_input"
                            className="absolute left-14 top-1/2 -translate-y-1/2 text-sm text-text-muted peer-placeholder-shown:text-text-tertiary peer-focus:-top-2 peer-focus:left-4 peer-focus:text-xs peer-focus:text-primary peer-focus:bg-[#0C0D12] peer-focus:px-2 rounded transition-all duration-300 pointer-events-none"
                        >
                            Full Name
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
                            className="peer block w-full h-14 pl-14 pr-6 bg-white/[0.03] border border-white/[0.08] rounded-xl text-base text-white placeholder-transparent focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all duration-300 font-sans shadow-sm"
                            placeholder="Email Address"
                            id="email_signup"
                        />
                        <label
                            htmlFor="email_signup"
                            className="absolute left-14 top-1/2 -translate-y-1/2 text-sm text-text-muted peer-placeholder-shown:text-text-tertiary peer-focus:-top-2 peer-focus:left-4 peer-focus:text-xs peer-focus:text-primary peer-focus:bg-[#0C0D12] peer-focus:px-2 rounded transition-all duration-300 pointer-events-none"
                        >
                            Email Address
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
                            className="peer block w-full h-14 pl-14 pr-12 bg-white/[0.03] border border-white/[0.08] rounded-xl text-base text-white placeholder-transparent focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all duration-300 font-sans shadow-sm"
                            placeholder="Password"
                            id="password_signup"
                        />
                        <label
                            htmlFor="password_signup"
                            className="absolute left-14 top-1/2 -translate-y-1/2 text-sm text-text-muted peer-placeholder-shown:text-text-tertiary peer-focus:-top-2 peer-focus:left-4 peer-focus:text-xs peer-focus:text-primary peer-focus:bg-[#0C0D12] peer-focus:px-2 rounded transition-all duration-300 pointer-events-none"
                        >
                            Password
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
                            className="w-full h-14 flex items-center justify-center rounded-xl shadow-md text-sm font-semibold text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-[#0C0D12] transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-70 disabled:hover:translate-y-0"
                        >
                            {loading ? <Spinner size="md" className="text-white" /> : 'Create Account'}
                        </button>
                    </div>
                </div>
            </form>

            <div className="text-center relative z-10 border-t border-white/[0.03] pt-10">
                <p className="text-sm font-medium text-text-tertiary hover:text-white transition-colors">
                    Already have an account?{' '}
                    <button type="button" onClick={onSwitchToLogin} className="text-primary hover:text-primary/80 transition-all ml-1 font-semibold">Sign In</button>
                </p>
            </div>
        </div>
    );
};

// FIX: Added missing default export to resolve the "no default export" error in AuthPage.tsx.
export default SignupForm;