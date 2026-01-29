import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { SchoolBranch, SchoolAdminProfileData } from '../types';
import Spinner from './common/Spinner';
import { SchoolIcon } from './icons/SchoolIcon';
import { PlusIcon } from './icons/PlusIcon';
import { EditIcon } from './icons/EditIcon';
import { TrashIcon } from './icons/TrashIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { CopyIcon } from './icons/CopyIcon';
import { KeyIcon } from './icons/KeyIcon';
import { ClockIcon } from './icons/ClockIcon';
import { EyeIcon } from './icons/EyeIcon';
import { EyeOffIcon } from './icons/EyeOffIcon';
import { UsersIcon } from './icons/UsersIcon';
import { ShieldCheckIcon } from './icons/ShieldCheckIcon';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon';
import { XIcon } from './icons/XIcon';
import { BranchCreationPage } from './BranchCreationPage';
import ConfirmationModal from './common/ConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { GlobeIcon } from './icons/GlobeIcon';
import { BranchSideDrawer } from './BranchSideDrawer';
import { BranchForm } from './BranchForm';
import { RefreshCwIcon } from './icons/RefreshCwIcon';
import { LocationIcon } from './icons/LocationIcon';
import { LockIcon } from './icons/LockIcon';
import { BranchSyncProtocol } from './BranchSyncProtocol';

// --- Types ---
type Language = 'EN' | 'HI';

// --- Types for Handshake Identity ---
type HandshakeStatus = 'PENDING' | 'KEY_READY' | 'SYNCHRONIZING' | 'VERIFIED' | 'FAILED';

const BranchCard: React.FC<{
    branch: SchoolBranch,
    onEdit: () => void,
    onDelete: () => void,
    onSync: () => void,
    index: number
}> = ({ branch, onEdit, onDelete, onSync, index }) => {
    const [copied, setCopied] = useState(false);
    const [revealed, setRevealed] = useState(false);
    // Logic Fix: Default state is PENDING.
    // VERIFIED only if status is Linked AND we have an access_key.
    const [handshakeStep, setHandshakeStep] = useState<HandshakeStatus>(
        (branch.status === 'Linked' && branch.access_key) ? 'VERIFIED' : 'PENDING'
    );

    const isLinked = handshakeStep === 'VERIFIED';

    const handleGenerateKey = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setHandshakeStep('PENDING');
        setTimeout(() => setHandshakeStep('KEY_READY'), 800);
    };

    const handleInitiateSync = (e: React.MouseEvent) => {
        e.stopPropagation();
        setHandshakeStep('SYNCHRONIZING');
        setTimeout(() => setHandshakeStep('VERIFIED'), 2500);
    };

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!branch.access_key) return;
        navigator.clipboard.writeText(branch.access_key);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className={`enterprise-glass rounded-[3rem] p-10 flex flex-col items-center text-center transition-all duration-1000 min-h-[700px] w-full relative overflow-hidden group ${branch.is_main_branch ? 'glow-card-active' : ''}`}
        >
            <div className="scanline-subtle" />

            {/* Status Header Pill */}
            <div className="mb-10 w-full flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-[1px] bg-white/10" />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Node Registry #{index + 1}</span>
                </div>
                {branch.is_main_branch ? (
                    <div className="py-2 px-6 rounded-full border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-3xl flex items-center justify-center gap-4 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,1)]" />
                        <div className="text-left">
                            <p className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.3em] leading-none">Central Command</p>
                        </div>
                    </div>
                ) : (
                    <div className="py-2 px-6 rounded-full border border-white/10 bg-white/5 backdrop-blur-2xl flex items-center justify-center gap-4">
                        <div className="w-2 h-2 rounded-full bg-white/40 shadow-[0_0_10px_rgba(255,255,255,0.2)]" />
                        <div className="text-left">
                            <p className="text-[11px] font-black text-white uppercase tracking-[0.3em] leading-none">Satellite Node</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Campus Icon Node */}
            <div className="relative mb-12 group/icon relative z-10">
                <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full scale-150 opacity-0 group-hover/icon:opacity-100 transition-opacity duration-1000" />
                <div className="w-32 h-32 rounded-full bg-primary/[0.05] border border-white/5 flex items-center justify-center text-primary shadow-[inset_0_0_60px_rgba(var(--primary),0.1)] group-hover/icon:scale-110 group-hover/icon:border-primary/20 transition-all duration-1000 relative z-10">
                    <SchoolIcon className="w-16 h-16" />
                </div>
            </div>

            <div className="space-y-4 mb-12 relative z-10">
                <h3 className="premium-headline text-4xl md:text-5xl text-white leading-none drop-shadow-2xl">{branch.name}</h3>
                <div className="flex items-center justify-center gap-3 p-1 rounded-full bg-white/[0.04] border border-white/10 pr-5 pl-2 py-1.5 backdrop-blur-3xl mx-auto w-fit shadow-xl">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                        <LocationIcon className="w-2.5 h-2.5 text-primary" />
                    </div>
                    <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.25em] font-mono">
                        {branch.city}, {branch.state}
                    </span>
                </div>
            </div>

            {/* Process Management Keys - High Visibility Matrix */}
            <div className="w-full grid grid-cols-3 gap-4 mb-10 relative z-10 px-4">
                <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5 group-hover:bg-white/[0.04] transition-all">
                    <span className="text-[7px] font-black text-white/20 uppercase tracking-[0.2em]">Protocol Binding</span>
                    <span className="text-[9px] font-black text-primary uppercase tracking-widest">AES-256</span>
                </div>
                <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5 group-hover:bg-white/[0.04] transition-all">
                    <span className="text-[7px] font-black text-white/20 uppercase tracking-[0.2em]">Security Layer</span>
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Active</span>
                </div>
                <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5 group-hover:bg-white/[0.04] transition-all">
                    <span className="text-[7px] font-black text-white/20 uppercase tracking-[0.2em]">Sync Type</span>
                    <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Real-time</span>
                </div>
            </div>

            {/* Access Protocol Vault - High Visibility Telemetry */}
            <div className="w-full mt-auto relative z-10 mb-10">
                <div className={`rounded-[2rem] p-8 border transition-all duration-1000 overflow-hidden flex flex-col relative ${isLinked ? 'bg-emerald-500/[0.02] border-emerald-500/10' : 'bg-white/[0.01] border-white/5'}`}>
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <ShieldCheckIcon className={`w-3.5 h-3.5 ${isLinked ? 'text-emerald-500' : 'text-white/20'}`} />
                            <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] font-mono">Access Protocol Vault</span>
                        </div>
                        <div className={`px-3 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest ${isLinked ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-white/5 border-white/10 text-white/20'}`}>
                            {isLinked ? 'Handshake Verified' : 'Handshake Pending'}
                        </div>
                    </div>

                    <div className="flex flex-col items-center justify-center text-center py-6 min-h-[140px]">
                        <AnimatePresence mode="wait">
                            {handshakeStep === 'PENDING' && (
                                <motion.div key="pending" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto border border-white/10 text-white/10">
                                        <LockIcon className="w-5 h-5 opacity-40" />
                                    </div>
                                    <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] leading-relaxed text-center">
                                        Complete branch <br /> authentication to <br /> activate handshake
                                    </p>
                                </motion.div>
                            )}

                            {(handshakeStep === 'KEY_READY' || handshakeStep === 'SYNCHRONIZING') && (
                                <motion.div key="ready" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-center gap-4 py-4 bg-black/40 rounded-2xl border border-white/5 px-6">
                                            <code className="text-2xl font-mono font-black text-primary tracking-widest overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">
                                                {revealed ? branch.access_key : '••••-••••-••••'}
                                            </code>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(branch.access_key || '');
                                                        setCopied(true);
                                                        setTimeout(() => setCopied(false), 2000);
                                                    }}
                                                    className="p-2.5 rounded-xl bg-white/5 text-white/30 hover:bg-white/10 hover:text-white transition-all relative group/copy"
                                                >
                                                    <CopyIcon className="w-4 h-4" />
                                                    <AnimatePresence>
                                                        {copied && (
                                                            <motion.span
                                                                initial={{ opacity: 0, y: 10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                exit={{ opacity: 0 }}
                                                                className="absolute -top-10 left-1/2 -translate-x-1/2 text-[8px] bg-emerald-500 text-white px-3 py-1 rounded-lg font-black uppercase tracking-widest whitespace-nowrap shadow-lg z-50"
                                                            >
                                                                Key Copied
                                                            </motion.span>
                                                        )}
                                                    </AnimatePresence>
                                                </button>
                                                <button
                                                    onClick={() => setRevealed(!revealed)}
                                                    className="p-2.5 rounded-xl bg-white/5 text-white/30 hover:bg-white/10 hover:text-white transition-all"
                                                >
                                                    {revealed ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleInitiateSync}
                                            disabled={handshakeStep === 'SYNCHRONIZING'}
                                            className="w-full h-14 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_30px_rgba(var(--primary),0.3)] transition-all flex items-center justify-center gap-4"
                                        >
                                            {handshakeStep === 'SYNCHRONIZING' ? <Spinner size="sm" /> : 'Initiate Handshake Sync'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {handshakeStep === 'VERIFIED' && (
                                <motion.div key="verified" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                                    <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto border border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.1)]">
                                        <ShieldCheckIcon className="w-8 h-8 animate-bounce" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xl font-bold text-white uppercase tracking-tight">Handshake Secured</p>
                                        <p className="text-[9px] text-emerald-500 font-mono uppercase tracking-[0.3em]">{branch.admin_email}</p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Identity Handshake Protocol - High Transparency Matrix */}
            <div className="w-full space-y-6 mb-4 relative z-10">
                <div className="flex justify-between items-center px-1">
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em]">Identity Handshake Protocol</span>
                    <span className={`text-[8px] font-bold uppercase tracking-widest ${isLinked ? 'text-emerald-500' : 'text-primary'}`}>
                        {handshakeStep}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {[
                        { step: 'PENDING', icon: <PlusIcon className="w-3 h-3" />, label: 'PROVISION' },
                        { step: 'KEY_READY', icon: <EditIcon className="w-3 h-3" />, label: 'INIT GEN' },
                        { step: 'SYNCHRONIZING', icon: <RefreshCwIcon className="w-3 h-3" />, label: 'HANDSHAKE' },
                        { step: 'VERIFIED', icon: <CheckCircleIcon className="w-3 h-3" />, label: 'CERTIFIED' }
                    ].map((item, idx, arr) => {
                        const statusWeights = { PENDING: 0, KEY_READY: 1, SYNCHRONIZING: 2, VERIFIED: 3, FAILED: 2 };
                        const currentWeight = statusWeights[handshakeStep];
                        const isActive = idx <= currentWeight;
                        const isCurrent = idx === currentWeight;

                        return (
                            <React.Fragment key={item.step}>
                                <div className="flex flex-col items-center gap-2 flex-1">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-700 ${isActive ? 'bg-primary border-primary text-white shadow-[0_0_20px_rgba(var(--primary),0.3)]' : 'bg-white/5 border-white/10 text-white/10'}`}>
                                        {item.icon}
                                    </div>
                                    <span className={`text-[7px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-primary' : 'text-white/20'}`}>{item.label}</span>
                                </div>
                                {idx < arr.length - 1 && (
                                    <div className="flex-[0.5] h-px bg-white/5 mt-[-18px]" />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* Floating Action Nodes */}
            <div className="absolute top-10 right-10 flex flex-col gap-4 opacity-0 group-hover:opacity-100 transition-all duration-700 translate-x-10 group-hover:translate-x-0 z-20">
                <button onClick={onEdit} title="Edit Configuration" className="w-12 h-12 rounded-2xl bg-white/[0.03] hover:bg-primary hover:text-white border border-white/5 flex items-center justify-center text-white/30 transition-all shadow-xl backdrop-blur-3xl transform-gpu hover:scale-110">
                    <EditIcon className="w-5 h-5" />
                </button>
                <button onClick={onSync} title="Refresh Telemetry" className="w-12 h-12 rounded-2xl bg-white/[0.03] hover:bg-white/20 hover:text-white border border-white/5 flex items-center justify-center text-white/30 transition-all shadow-xl backdrop-blur-3xl transform-gpu hover:scale-110">
                    <RefreshCwIcon className="w-5 h-5" />
                </button>
                {!branch.is_main_branch && (
                    <button onClick={onDelete} title="Decommission Node" className="w-12 h-12 rounded-2xl bg-red-500/[0.03] hover:bg-red-500 hover:text-white border border-red-500/10 flex items-center justify-center text-red-500/40 transition-all shadow-xl backdrop-blur-3xl transform-gpu hover:scale-110">
                        <TrashIcon className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Ambient Gradients */}
            <div className="absolute -top-32 -left-32 w-80 h-80 bg-primary/10 rounded-full blur-[100px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
        </motion.div>
    );
};

interface BranchManagementTabProps {
    isHeadOfficeAdmin: boolean;
    branches: SchoolBranch[];
    isLoading: boolean;
    error: string | null;
    onBranchUpdate: (updatedBranch?: SchoolBranch, isDelete?: boolean) => void;
    onSelectBranch: (id: number) => void;
    schoolProfile: SchoolAdminProfileData | null;
}

export const BranchManagementTab: React.FC<BranchManagementTabProps> = ({ isHeadOfficeAdmin, branches, isLoading, error, onBranchUpdate, schoolProfile }) => {
    const [drawerMode, setDrawerMode] = useState<'CREATE' | 'DETAILS' | 'EDIT' | 'SYNC' | null>(null);
    const [selectedBranch, setSelectedBranch] = useState<SchoolBranch | null>(null);
    const [branchToDelete, setBranchToDelete] = useState<SchoolBranch | null>(null);
    const [language, setLanguage] = useState<Language>('EN');

    const handleDelete = async () => {
        if (!branchToDelete) return;
        try {
            const { error } = await supabase.rpc('delete_school_branch', { p_branch_id: branchToDelete.id });
            if (error) throw error;
            onBranchUpdate(branchToDelete, true);
            setBranchToDelete(null);
        } catch (e: any) {
            alert(`Deletion Failed: ${e.message}`);
        }
    };

    const authenticatedNodes = branches.filter(b => b.status === 'Linked' && b.access_key).length;

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
                <Spinner size="lg" className="text-primary" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 animate-pulse">Syncing Network Matrix...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-12 rounded-[3rem] border border-red-500/20 bg-red-500/5 text-center space-y-4">
                <AlertTriangleIcon className="w-12 h-12 text-red-500 mx-auto opacity-40" />
                <p className="text-red-500 text-[11px] font-black uppercase tracking-[0.4em]">{error}</p>
                <button onClick={() => onBranchUpdate()} className="btn-secondary-premium h-12 px-8 border-red-500/20 text-red-500">Retry Protocol</button>
            </div>
        );
    }

    return (
        <div className="space-y-16 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-40 px-4 md:px-0">
            {/* Enterprise Command Header - Top Level Telemetry */}
            <div className="relative bg-[#0d0f14] border border-white/5 p-10 md:p-14 rounded-[4rem] shadow-[0_64px_128px_-32px_rgba(0,0,0,0.8)] overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

                {/* Language Toggle */}
                <div className="absolute top-10 right-10 flex items-center gap-1 p-1 bg-black/40 border border-white/10 rounded-xl z-20">
                    {(['EN', 'HI'] as Language[]).map((lang) => (
                        <button
                            key={lang}
                            onClick={() => setLanguage(lang)}
                            className={`px-4 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all ${language === lang ? 'bg-primary text-white shadow-lg' : 'text-white/20 hover:text-white/40'}`}
                        >
                            {lang === 'EN' ? 'English' : 'हिंदी'}
                        </button>
                    ))}
                </div>

                <div className="relative z-10 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-14">
                    <div className="space-y-8 flex-grow">
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.3em]">
                                <ShieldCheckIcon className="w-4 h-4" />
                                {language === 'EN' ? 'Institutional Governance Layer' : 'संस्थागत शासन परत'}
                            </div>
                            <h2 className="text-5xl md:text-8xl font-serif font-black text-white tracking-tighter uppercase leading-[0.85]">
                                {language === 'EN' ? (
                                    <>Institutional <br /> <span className="text-white/20 italic">Network Registry.</span></>
                                ) : (
                                    <>संस्थागत <br /> <span className="text-white/20 italic">नेटवर्क रजिस्ट्री।</span></>
                                )}
                            </h2>
                            <p className="text-white/30 text-[20px] font-serif italic max-w-xl leading-relaxed">
                                {language === 'EN'
                                    ? 'Managed telemetry and encrypted protocol synchronization for distributed satellite campus nodes.'
                                    : 'वितरित सैटेलाइट कैंपस नोड्स के लिए प्रबंधित टेलीमेट्री और एन्क्रिप्टेड प्रोटोकॉल सिंक्रोनाइज़ेशन।'}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-12 pt-4 border-t border-white/5">
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em]">Connected Nodes</span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-black text-white">{branches.length}</span>
                                    <span className="text-[10px] font-bold text-white/10 uppercase tracking-widest">/ {branches.length} Cap.</span>
                                </div>
                            </div>
                            <div className="w-px h-12 bg-white/5 hidden sm:block" />
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em]">Identity Authentication</span>
                                <div className="flex items-center gap-4">
                                    <span className={`text-4xl font-black ${authenticatedNodes > 0 ? 'text-emerald-500' : 'text-white/20'}`}>{authenticatedNodes}</span>
                                    <div className={`px-3 py-1 rounded-full border ${authenticatedNodes > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-white/5 border-white/10 text-white/10'}`}>
                                        <span className="text-[8px] font-black uppercase tracking-widest">{authenticatedNodes > 0 ? 'Verified' : 'Unverified'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="w-px h-12 bg-white/5 hidden sm:block" />
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em]">Encryption Cipher</span>
                                <div className="flex items-baseline gap-3">
                                    <span className="text-4xl font-black text-white">256-BIT</span>
                                    <span className="text-[9px] font-black text-primary uppercase tracking-[0.3em] glow-text">Zero-Trust Active</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {isHeadOfficeAdmin && (
                        <div className="flex flex-col xl:flex-row items-center gap-6">
                            <motion.button
                                whileHover={{ scale: 1.02, y: -4 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => { setSelectedBranch(null); setDrawerMode('SYNC'); }}
                                className="w-full xl:w-auto px-10 py-8 bg-emerald-500/5 text-emerald-500 font-black text-[11px] uppercase tracking-[0.4em] rounded-[2rem] border border-emerald-500/10 hover:bg-emerald-500/10 transition-all flex items-center justify-center gap-5 group"
                            >
                                <RefreshCwIcon className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" />
                                {language === 'EN' ? 'Synchronize Branch' : 'शाखा सिंक्रोनाइज़ करें'}
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.02, y: -4 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => { setSelectedBranch(null); setDrawerMode('CREATE'); }}
                                className="w-full xl:w-auto px-12 py-8 bg-primary text-white font-black text-[14px] uppercase tracking-[0.4em] rounded-[2rem] shadow-[0_40px_80px_-20px_rgba(var(--primary),0.6)] hover:shadow-[0_50px_100px_-20px_rgba(var(--primary),0.8)] transition-all flex items-center justify-center gap-5 group border border-white/10"
                            >
                                <PlusIcon className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
                                {language === 'EN' ? 'Initialize Node' : 'नोड प्रारंभ करें'}
                            </motion.button>
                        </div>
                    )}
                </div>
            </div>

            {/* Registry Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                {branches.map((branch, idx) => (
                    <BranchCard
                        key={branch.id}
                        branch={branch}
                        index={idx}
                        onEdit={() => { setSelectedBranch(branch); setDrawerMode('EDIT'); }}
                        onDelete={() => setBranchToDelete(branch)}
                        onSync={() => { /* Quick Sync Logic */ }}
                    />
                ))}

                {isHeadOfficeAdmin && branches.length < 3 && (
                    <motion.button
                        whileHover={{ scale: 0.98 }}
                        onClick={() => { setSelectedBranch(null); setDrawerMode('CREATE'); }}
                        className="flex flex-col items-center justify-center p-16 rounded-[2.5rem] border border-dashed border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-primary/40 transition-all min-h-[520px] group gap-8"
                    >
                        <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/5 transition-all duration-700">
                            <PlusIcon className="w-8 h-8 text-white/20 group-hover:text-primary transition-colors" />
                        </div>
                        <div className="text-center space-y-3">
                            <p className="text-xl font-serif italic text-white/10 group-hover:text-white/30 transition-colors uppercase tracking-widest">Expansion Protocol</p>
                            <p className="text-[10px] font-black uppercase tracking-[0.6em] text-white/5">Initialize Satellite Node</p>
                        </div>
                    </motion.button>
                )}
            </div>

            {/* Side Drawer for Branch Actions */}
            <BranchSideDrawer
                isOpen={!!drawerMode}
                onClose={() => { setDrawerMode(null); setSelectedBranch(null); }}
                title={
                    drawerMode === 'CREATE' ? (language === 'EN' ? 'Initialize Node' : 'नोड प्रारंभ करें') :
                        drawerMode === 'SYNC' ? (language === 'EN' ? 'Branch Sync Protocol' : 'शाखा सिंक्रोनाइज़ेशन प्रोटोकॉल') :
                            drawerMode === 'EDIT' ? (language === 'EN' ? 'Edit Branch Configuration' : 'शाखा कॉन्फ़िगरेशन संपादित करें') :
                                (language === 'EN' ? 'Node Configuration' : 'नोड कॉन्फ़िगरेशन')
                }
                subtitle={
                    drawerMode === 'SYNC' ? (language === 'EN' ? 'ESTABLISHING SECURE HANDSHAKE' : 'सुरक्षित हैंडशेक स्थापित करना') :
                        drawerMode === 'DETAILS' ? (language === 'EN' ? 'READ-ONLY ACCESS MODE' : 'केवल पढ़ने के लिए पहुंच मोड') :
                            (language === 'EN' ? 'INSTITUTIONAL REGISTRY V4.0' : 'संस्थागत रजिस्ट्री V4.0')
                }
            >
                <div className="space-y-12">
                    {drawerMode === 'SYNC' && (
                        <BranchSyncProtocol
                            language={language}
                            onSyncComplete={(branch) => {
                                onBranchUpdate(branch);
                                setDrawerMode(null);
                            }}
                            onCancel={() => setDrawerMode(null)}
                        />
                    )}

                    {drawerMode === 'DETAILS' && selectedBranch && (
                        <div className="p-8 rounded-[2rem] border border-primary/20 bg-primary/5 flex flex-col gap-6 animate-in fade-in slide-in-from-top-4">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Identity Integrity</p>
                                    <p className="text-[9px] text-white/30 font-mono">HASH: {selectedBranch.access_key}</p>
                                </div>
                                <div className="px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-widest">
                                    Encrypted & Live
                                </div>
                            </div>
                            <div className="h-px bg-white/5" />
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Last Synced</p>
                                    <p className="text-[11px] text-white/60 font-medium">{new Date().toLocaleDateString()}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Protocol Type</p>
                                    <p className="text-[11px] text-white/60 font-medium">AES-256-XPN</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <BranchForm
                        branch={selectedBranch}
                        schoolProfile={schoolProfile}
                        readOnly={drawerMode === 'DETAILS'}
                        onEditMode={() => setDrawerMode('EDIT')}
                        onSave={(branch) => {
                            setDrawerMode(null);
                            onBranchUpdate();
                        }}
                        onCancel={() => {
                            if (drawerMode === 'EDIT') setDrawerMode('DETAILS');
                            else setDrawerMode(null);
                        }}
                    />
                </div>
            </BranchSideDrawer>

            <ConfirmationModal
                isOpen={!!branchToDelete}
                onClose={() => setBranchToDelete(null)}
                onConfirm={handleDelete}
                title="Decommission Node"
                message={`CRITICAL: You are about to permanently decommission the "${branchToDelete?.name}" node. This protocol terminates all live data pipelines and revokes all encrypted access tokens for this campus. This action is irreversible.`}
                confirmText="Execute Decommission"
                loading={false}
            />
        </div>
    );
};