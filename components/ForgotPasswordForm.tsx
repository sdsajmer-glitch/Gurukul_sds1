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
            setError('Verification Target Required: Please specify identity uplink.');
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
                <h3 className="text-3xl font-serif font-black text-white mb-4 tracking-tighter uppercase leading-none">Cipher Dispatched.</h3>
                <p className="text-white/50 mb-10 text-sm leading-relaxed font-serif italic max-w-[280px] mx-auto">
                    A recovery cipher has been transmitted to <strong className="text-white">{email}</strong>.
                </p>
                <button
                    onClick={onBack}
                    className="w-full h-14 flex items-center justify-center py-3.5 px-8 rounded-2xl text-[10px] font-black text-white bg-primary hover:bg-primary/90 transition-all transform active:scale-95 uppercase tracking-[0.4em] shadow-xl shadow-primary/20"
                >
                    Return to Terminal
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
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Identity Recovery</span>
                </div>
                <h2 className="text-[2.75rem] sm:text-5xl font-serif font-black text-white tracking-[-0.02em] leading-none uppercase">
                    Recovery<span className="text-primary italic">.</span>
                </h2>
                <p className="text-text-tertiary text-sm font-medium tracking-tight leading-relaxed max-w-[280px] mx-auto italic font-serif opacity-80">
                    Initiate a <span className="text-white/60">credential bypass protocol</span> for your node.
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
                        className="peer block w-full h-[72px] pl-16 pr-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl text-base text-white placeholder-transparent focus:outline-none focus:ring-[3px] focus:ring-primary/20 focus:border-primary/40 focus:bg-white/[0.06] transition-all duration-500 font-sans tracking-wide shadow-inner"
                        placeholder="Communication Uplink"
                        id="reset_email"
                    />
                    <label
                        htmlFor="reset_email"
                        className="absolute left-16 top-1/2 -translate-y-1/2 text-sm font-medium text-white/25 uppercase tracking-[0.1em] peer-placeholder-shown:text-white/20 peer-focus:-top-2 peer-focus:left-6 peer-focus:text-[10px] peer-focus:text-primary peer-focus:font-black peer-focus:tracking-[0.2em] peer-focus:bg-[#12131A] peer-focus:px-2 peer-focus:rounded-md peer-focus:translate-y-0 transition-all duration-500 pointer-events-none"
                    >
                        Verified Email
                    </label>
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-[72px] flex items-center justify-center rounded-2xl shadow-[0_20px_40px_-10px_rgba(139,92,246,0.3)] text-xs font-black text-white bg-primary hover:bg-[#9D5BF0] focus:outline-none focus:ring-[6px] focus:ring-primary/10 transition-all transform hover:-translate-y-1 active:scale-[0.97] disabled:opacity-50 uppercase tracking-[0.4em] relative overflow-hidden group"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000"></div>
                        {loading ? <Spinner size="md" className="text-white" /> : 'Transmit Recovery Cipher'}
                    </button>
                </div>
            </form>

            <div className="text-center relative z-10 border-t border-white/[0.03] pt-10">
                <button
                    type="button"
                    onClick={onBack}
                    className="text-[10px] font-black text-white/25 hover:text-white transition-all tracking-[0.25em] uppercase hover:tracking-[0.35em]"
                >
                    Return to Console
                </button>
            </div>
        </motion.div>
    );
};

export default ForgotPasswordForm;