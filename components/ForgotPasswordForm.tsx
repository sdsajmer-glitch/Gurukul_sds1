import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import Spinner from './common/Spinner';
import { MailIcon } from './icons/MailIcon';
import { motion, AnimatePresence } from 'framer-motion';

interface ForgotPasswordFormProps {
    onBack: () => void;
}

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onBack }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            setError('Please enter your email address.');
            return;
        }
        setLoading(true);
        setError(null);

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
        });

        setLoading(false);

        if (resetError) {
            setError(resetError.message);
        } else {
            setSuccess(true);
        }
    };

    if (success) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#0C0D12]/40 backdrop-blur-[40px] p-10 sm:p-14 rounded-[3.5rem] border border-white/5 text-center shadow-3xl relative overflow-hidden ring-1 ring-white/10"
            >
                <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner border border-primary/20">
                    <MailIcon className="w-10 h-10" />
                </div>
                <h3 className="text-3xl font-sans font-bold text-white mb-4 tracking-tight">Email Sent</h3>
                <p className="text-white/50 mb-10 text-base leading-relaxed font-sans max-w-[280px] mx-auto">
                    A password reset link has been sent to <strong className="text-white">{email}</strong>.
                </p>
                <button
                    onClick={onBack}
                    className="w-full h-12 flex items-center justify-center py-3 px-6 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-all transform active:scale-95 shadow-md hover:shadow-lg"
                >
                    Back to Sign In
                </button>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0C0D12]/40 backdrop-blur-[40px] p-8 sm:p-12 md:p-14 rounded-[3.5rem] border border-white/5 space-y-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] relative overflow-hidden ring-1 ring-white/10 font-sans group"
        >
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent animate-scanner-move pointer-events-none opacity-20"></div>

            <div className="text-center space-y-4 relative z-10">
                <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/5 mb-2 backdrop-blur-md">
                    <span className="text-xs font-semibold text-white/60 tracking-wider">Account Recovery</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-sans font-bold text-white tracking-tight">
                    Forgot Password
                </h2>
                <p className="text-text-tertiary text-base font-normal max-w-[280px] mx-auto mt-3">
                    Enter your email to reset your password.
                </p>
            </div>

            <form onSubmit={handleReset} className="space-y-8 relative z-10">
                <AnimatePresence mode="wait">
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-[0.1em] p-4 rounded-xl flex items-center gap-3 shadow-lg"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0"></div>
                            <span className="flex-1 leading-relaxed">{error}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

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
                        id="reset_email"
                    />
                    <label
                        htmlFor="reset_email"
                        className="absolute left-14 top-1/2 -translate-y-1/2 text-sm text-text-muted peer-placeholder-shown:text-text-tertiary peer-focus:-top-2 peer-focus:left-4 peer-focus:text-xs peer-focus:text-primary peer-focus:bg-[#0C0D12] peer-focus:px-2 rounded transition-all duration-300 pointer-events-none"
                    >
                        Email Address
                    </label>
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-14 flex items-center justify-center rounded-xl shadow-md text-sm font-semibold text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-[#0C0D12] transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-70 disabled:hover:translate-y-0"
                    >
                        {loading ? <Spinner size="md" className="text-white" /> : 'Reset Password'}
                    </button>
                </div>
            </form>

            <div className="text-center relative z-10 border-t border-white/[0.03] pt-10">
                <button
                    type="button"
                    onClick={onBack}
                    className="text-sm font-medium text-text-tertiary hover:text-white transition-colors"
                >
                    Back to Sign In
                </button>
            </div>
        </motion.div>
    );
};

export default ForgotPasswordForm;