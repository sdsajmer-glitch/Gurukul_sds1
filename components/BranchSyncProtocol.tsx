import React, { useState } from 'react';
import { supabase, formatError } from '../services/supabase';
import { SchoolBranch } from '../types';
import Spinner from './common/Spinner';
import { ShieldCheckIcon as ShieldIcon } from './icons/ShieldCheckIcon';
import { RefreshCwIcon } from './icons/RefreshCwIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon';
import { KeyIcon } from './icons/KeyIcon';
import { motion, AnimatePresence } from 'framer-motion';

interface BranchSyncProtocolProps {
    onSyncComplete: (branch: SchoolBranch) => void;
    onCancel: () => void;
    language: 'EN' | 'HI';
}

type SyncStep = 'INPUT' | 'VERIFYING' | 'CONFIRM' | 'SYNCING' | 'SUCCESS';

export const BranchSyncProtocol: React.FC<BranchSyncProtocolProps> = ({ onSyncComplete, onCancel, language }) => {
    const [step, setStep] = useState<SyncStep>('INPUT');
    const [accessKey, setAccessKey] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [verifiedBranch, setVerifiedBranch] = useState<SchoolBranch | null>(null);

    const handleVerify = async () => {
        if (!accessKey.trim()) return;
        setStep('VERIFYING');
        setError(null);

        try {
            // Find branch by access key
            const { data, error: fetchError } = await supabase
                .from('school_branches')
                .select('*')
                .eq('access_key', accessKey.trim())
                .single();

            if (fetchError || !data) {
                throw new Error(language === 'EN' ? 'Invalid Access Key. Synchronization aborted.' : 'अमान्य एक्सेस कुंजी। सिंक्रोनाइज़ेशन रद्द कर दिया गया।');
            }

            setVerifiedBranch(data);
            setTimeout(() => setStep('CONFIRM'), 800); // Aesthetic delay
        } catch (err: any) {
            setError(err.message || formatError(err));
            setStep('INPUT');
        }
    };

    const handleConfirmSync = async () => {
        if (!verifiedBranch) return;
        setStep('SYNCING');

        try {
            // Irreversible sync logic - update status to 'Linked' or 'Active'
            const { data, error: syncError } = await supabase
                .from('school_branches')
                .update({ status: 'Linked', updated_at: new Date().toISOString() })
                .eq('id', verifiedBranch.id)
                .select()
                .single();

            if (syncError) throw syncError;

            setTimeout(() => {
                setStep('SUCCESS');
                setTimeout(() => onSyncComplete(data), 2000);
            }, 1500); // Cinematic sync delay
        } catch (err: any) {
            setError(formatError(err));
            setStep('CONFIRM');
        }
    };

    return (
        <div className="space-y-12 py-6">
            <AnimatePresence mode="wait">
                {step === 'INPUT' && (
                    <motion.div key="input" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-10">
                        <div className="flex flex-col items-center justify-center text-center space-y-4">
                            <div className="w-20 h-20 rounded-[2rem] bg-primary/5 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_40px_rgba(var(--primary),0.1)]">
                                <KeyIcon className="w-10 h-10" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-white uppercase tracking-tight">Authorization Required</h3>
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Enter the unique branch access key to begin handshake</p>
                            </div>
                        </div>

                        <div className="relative group">
                            <div className="absolute top-1/2 -translate-y-1/2 left-6 text-white/10 group-focus-within:text-primary transition-all duration-500 z-10">
                                <ShieldIcon className="w-6 h-6" />
                            </div>
                            <input
                                type="text"
                                value={accessKey}
                                onChange={(e) => setAccessKey(e.target.value.toUpperCase())}
                                placeholder="NODE-XXXX-XXXX"
                                className="w-full h-20 bg-white/[0.02] border border-white/10 rounded-[1.5rem] px-16 text-xl font-mono font-black tracking-[0.3em] text-primary focus:border-primary/50 focus:ring-8 focus:ring-primary/5 transition-all outline-none text-center uppercase"
                            />
                        </div>

                        {error && (
                            <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-center gap-4 animate-shake">
                                <AlertTriangleIcon className="w-5 h-5 text-red-500" />
                                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest leading-relaxed">{error}</span>
                            </div>
                        )}

                        <div className="flex gap-4 pt-6">
                            <button onClick={onCancel} className="flex-1 py-6 rounded-2xl border border-white/5 text-[10px] font-black uppercase tracking-[0.3em] text-white/20 hover:bg-white/5 transition-all">Cancel</button>
                            <button
                                onClick={handleVerify}
                                disabled={!accessKey || accessKey.length < 4}
                                className="flex-[2] py-6 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-[0.3em] shadow-xl hover:shadow-primary/20 transition-all disabled:opacity-50"
                            >
                                Verify Access Key
                            </button>
                        </div>
                    </motion.div>
                )}

                {step === 'VERIFYING' && (
                    <motion.div key="verifying" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20 gap-8">
                        <Spinner size="lg" className="text-primary" />
                        <div className="text-center space-y-2">
                            <p className="text-[12px] font-black text-white uppercase tracking-[0.5em] animate-pulse">Authenticating Protocol</p>
                            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">Querying institutional ledger...</p>
                        </div>
                    </motion.div>
                )}

                {step === 'CONFIRM' && verifiedBranch && (
                    <motion.div key="confirm" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-10">
                        <div className="p-8 rounded-[2.5rem] border border-emerald-500/20 bg-emerald-500/5 space-y-8">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                    <CheckCircleIcon className="w-8 h-8" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-lg font-black text-white uppercase tracking-tight">Identity Verified</h4>
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest italic">Ready for synchronization</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                                    <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Target Node</p>
                                    <p className="text-xs font-black text-white uppercase tracking-tight">{verifiedBranch.name}</p>
                                </div>
                                <div className="p-6 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                                    <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Protocol Level</p>
                                    <p className="text-xs font-black text-primary uppercase tracking-tight">Enterprise A-1</p>
                                </div>
                                <div className="p-6 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                                    <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Inherited Security</p>
                                    <p className="text-xs font-black text-emerald-500 uppercase tracking-tight">Zero-Trust V2</p>
                                </div>
                                <div className="p-6 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                                    <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Handshake Data</p>
                                    <p className="text-xs font-mono font-black text-white/40">{verifiedBranch.access_key?.slice(0, 4)}-****</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => setStep('INPUT')} className="flex-1 py-6 rounded-2xl border border-white/5 text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Back</button>
                            <button
                                onClick={handleConfirmSync}
                                className="flex-[2] py-6 rounded-2xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-[0.3em] shadow-xl hover:shadow-emerald-500/20 transition-all"
                            >
                                Confirm & Synchronize
                            </button>
                        </div>
                    </motion.div>
                )}

                {step === 'SYNCING' && (
                    <motion.div key="syncing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 gap-12">
                        <div className="relative">
                            <RefreshCwIcon className="w-16 h-16 text-primary animate-spin" />
                            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
                        </div>
                        <div className="text-center space-y-4">
                            <p className="text-[14px] font-black text-white uppercase tracking-[0.6em] animate-pulse">Establishing Mesh Handshake</p>
                            <div className="w-64 h-1 bg-white/5 rounded-full overflow-hidden mx-auto">
                                <motion.div
                                    initial={{ x: '-100%' }}
                                    animate={{ x: '100%' }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                                    className="w-full h-full bg-primary"
                                />
                            </div>
                            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">Binding Node Identity to Registry...</p>
                        </div>
                    </motion.div>
                )}

                {step === 'SUCCESS' && (
                    <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-12 gap-8">
                        <div className="w-24 h-24 rounded-[2.5rem] bg-emerald-500 flex items-center justify-center text-white shadow-[0_0_50px_rgba(16,185,129,0.3)]">
                            <ShieldIcon className="w-12 h-12" />
                        </div>
                        <div className="text-center space-y-3">
                            <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Sync Completed</h3>
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em]">Branch Successfully Synchronized</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
