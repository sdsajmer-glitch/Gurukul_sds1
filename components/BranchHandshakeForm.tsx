import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheckIcon } from './icons/ShieldCheckIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { LockIcon } from './icons/LockIcon';
import { MailIcon } from './icons/MailIcon';
import Spinner from './common/Spinner';
import { supabase, formatError } from '../services/supabase';

interface BranchHandshakeFormProps {
    onBack: () => void;
    onSuccess: (email: string, branchData: any) => void;
}

const BranchHandshakeForm: React.FC<BranchHandshakeFormProps> = ({ onBack, onSuccess }) => {
    const [step, setStep] = useState<'verify' | 'auth'>('verify');
    const [accessKey, setAccessKey] = useState('');
    const [email, setEmail] = useState(''); // Admin Email is required for handshake
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [branchData, setBranchData] = useState<any>(null);

    const handleVerifyKeys = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // CALL THE NEW RPC
            const { data, error } = await supabase.rpc('verify_branch_execution_node', {
                p_access_key: accessKey,
                p_admin_email: email
            });

            if (error) throw error;

            if (data && data.success) {
                setBranchData(data);
                setStep('auth');
            } else {
                setError(data?.message || 'Access Denied: Invalid Node Credentials.');
            }
        } catch (err: any) {
            console.error(err);
            setError(formatError(err) || 'Handshake Protocol Failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleAuthenticate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Try to Login first
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (signInError) {
                // If user not found, maybe we need to Provision/SignUp them?
                // But for security, let's assume specific error text or just fail strict.
                // However, "Join Institutional Hub" implies joining.
                // If generic "Invalid login credentials", we can't distinguish easy.
                // For now, Strict Login matches the prompt "User logs in...".
                // We assume the School Admin has invited them or they have an account.

                // FALLBACK: If "User not found" (error includes that text roughly), maybe Offer Signup?
                // For this strict environment, let's just show the error.
                throw signInError;
            }

            if (signInData.user) {
                // Determine if we need to force-link the role (RPC `auto_handshake_on_login` might handle this, but let's be safe)
                await supabase.rpc('auto_handshake_on_login');

                // Success
                window.location.reload(); // Reload to refresh profile context
            }

        } catch (err: any) {
            setError(formatError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-[#0d0f14]/80 backdrop-blur-3xl p-8 sm:p-12 md:p-16 rounded-[3.5rem] border border-white/10 space-y-8 shadow-[0_64px_128px_-32px_rgba(0,0,0,1)] relative overflow-hidden ring-1 ring-white/5 font-sans w-full max-w-[540px] mx-auto"
        >
            {/* Header */}
            <div className="text-center space-y-4 relative z-10">
                <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-2">
                    <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Satellite Node Protocol</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-serif font-black text-white tracking-tighter leading-none uppercase">
                    {step === 'verify' ? 'Join Institutional Hub.' : 'Authenticate Node.'}
                </h2>
                <p className="text-white/40 text-xs font-serif italic tracking-tight leading-relaxed max-w-xs mx-auto">
                    {step === 'verify'
                        ? 'Enter your unique Branch Access Key to synchronize with an established network.'
                        : `Verifying identity for ${branchData?.branch_name || 'Target Node'}. Enter credentials.`}
                </p>
            </div>

            <AnimatePresence mode="wait">
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest p-4 rounded-2xl text-center"
                    >
                        {error}
                    </motion.div>
                )}
            </AnimatePresence>

            {step === 'verify' ? (
                <form onSubmit={handleVerifyKeys} className="space-y-6 relative z-10">

                    <div className="space-y-3 group">
                        <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em] ml-1 group-focus-within:text-emerald-500 transition-colors">Admin Email Identifier</label>
                        <div className="relative">
                            <MailIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-emerald-500 transition-colors" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="ADMIN@BRANCH.SCHOOL"
                                className="block w-full h-[64px] pl-16 pr-6 bg-black/40 border border-white/5 rounded-2xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all font-mono tracking-wider shadow-inner placeholder:text-white/10"
                            />
                        </div>
                    </div>

                    <div className="space-y-3 group">
                        <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em] ml-1 group-focus-within:text-emerald-500 transition-colors">Node Access Key</label>
                        <div className="relative">
                            <LockIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-emerald-500 transition-colors" />
                            <input
                                type="text"
                                value={accessKey}
                                onChange={(e) => setAccessKey(e.target.value)}
                                required
                                placeholder="XXXX-XXXX-XXXX"
                                className="block w-full h-[64px] pl-16 pr-6 bg-black/40 border border-white/5 rounded-2xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all font-mono tracking-wider shadow-inner placeholder:text-white/10 uppercase"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-[72px] mt-4 flex items-center justify-center gap-3 rounded-[2rem] bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-[#08090a] border border-emerald-500/20 hover:border-emerald-500 transition-all duration-300 uppercase tracking-[0.3em] text-[11px] font-black group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Spinner size="sm" /> : <>Verify & Access Node <ChevronRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>}
                    </button>

                    <div className="text-center pt-2">
                        <button type="button" onClick={onBack} className="text-[10px] text-white/20 hover:text-white uppercase tracking-widest transition-colors">Return to Gateway</button>
                    </div>
                </form>
            ) : (
                <form onSubmit={handleAuthenticate} className="space-y-6 relative z-10">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 mb-6">
                        <div className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Target Node</div>
                        <div className="text-white font-serif text-lg">{branchData?.branch_name}</div>
                        <div className="text-xs text-emerald-500 font-mono mt-1">ID: {branchData?.branch_id}</div>
                    </div>

                    <div className="space-y-3 group">
                        <label className="block text-[10px] font-black text-white/20 uppercase tracking-[0.4em] ml-1 group-focus-within:text-emerald-500 transition-colors">Secure Passphrase</label>
                        <div className="relative">
                            <LockIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-emerald-500 transition-colors" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                className="block w-full h-[64px] pl-16 pr-6 bg-black/40 border border-white/5 rounded-2xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all font-mono tracking-wider shadow-inner placeholder:text-white/10"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-[72px] mt-4 flex items-center justify-center gap-3 rounded-[2rem] bg-emerald-500 hover:bg-emerald-400 text-[#08090a] transition-all duration-300 uppercase tracking-[0.3em] text-[11px] font-black group disabled:opacity-50 shadow-[0_20px_40px_-10px_rgba(16,185,129,0.3)]"
                    >
                        {loading ? <Spinner size="sm" className="text-black" /> : <>Initialize Session <ShieldCheckIcon className="w-4 h-4 group-hover:scale-110 transition-transform" /></>}
                    </button>

                    <div className="text-center pt-2">
                        <button type="button" onClick={() => setStep('verify')} className="text-[10px] text-white/20 hover:text-white uppercase tracking-widest transition-colors">Change Credentials</button>
                    </div>
                </form>
            )}
        </motion.div>
    );
};

export default BranchHandshakeForm;
