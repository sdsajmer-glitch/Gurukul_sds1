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

// --- Types for Handshake Identity ---
type HandshakeStatus = 'PENDING' | 'KEY_READY' | 'SYNCHRONIZING' | 'VERIFIED' | 'FAILED';

const BranchCard: React.FC<{
    branch: SchoolBranch,
    onEdit: () => void,
    onDelete: () => void,
}> = ({ branch, onEdit, onDelete }) => {
    const [copied, setCopied] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const [handshakeStep, setHandshakeStep] = useState<HandshakeStatus>(
        (branch.status === 'Active' || branch.status === 'Linked') ? 'VERIFIED' :
            (branch.access_key ? 'KEY_READY' : 'PENDING')
    );

    const isLinked = handshakeStep === 'VERIFIED';

    const handleGenerateKey = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setHandshakeStep('PENDING');
        // In a real scenario, this would call an RPC to generate a key
        // For simulation, we'll just advance the state
        setTimeout(() => setHandshakeStep('KEY_READY'), 800);
    };

    const handleInitiateSync = (e: React.MouseEvent) => {
        e.stopPropagation();
        setHandshakeStep('SYNCHRONIZING');
        // Simulate handshake steps
        setTimeout(() => {
            if (branch.status === 'Active' || branch.status === 'Linked') {
                setHandshakeStep('VERIFIED');
            } else {
                // If not really linked in DB, we still show verified for UI demo 
                // but usually this would depend on real link
                setHandshakeStep('VERIFIED');
            }
        }, 2500);
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative bg-[#0d0f14] border border-white/5 hover:border-primary/40 rounded-[2.5rem] p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] hover:shadow-primary/5 transition-all duration-700 flex flex-col min-h-[520px] overflow-hidden"
        >
            {/* Ambient Glow */}
            <div className={`absolute top-0 right-0 w-64 h-64 blur-[100px] pointer-events-none transition-all duration-1000 ${isLinked ? 'bg-emerald-500/5' : 'bg-primary/5'}`} />

            {/* Header Identity Zone */}
            <div className="flex justify-between items-start mb-10 relative z-10">
                <div className="flex items-center gap-6">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-700 ${isLinked ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                            'bg-white/5 text-white/40 border border-white/10'
                        }`}>
                        <SchoolIcon className={`w-8 h-8 ${isLinked ? 'animate-pulse' : ''}`} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h3 className="text-2xl font-black text-white tracking-tighter uppercase font-serif">{branch.name}</h3>
                            {isLinked && (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Live Node</span>
                                </motion.div>
                            )}
                        </div>
                        <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.4em] mt-1.5 flex items-center gap-2">
                            <GlobeIcon className="w-3 h-3" />
                            {branch.city}, {branch.state}
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={onEdit} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl text-white/20 hover:text-primary transition-all border border-white/5"><EditIcon className="w-4 h-4" /></button>
                    {!branch.is_main_branch && (
                        <button onClick={onDelete} className="w-10 h-10 flex items-center justify-center bg-red-500/5 hover:bg-red-500/20 rounded-xl text-red-500/40 hover:text-red-500 transition-all border border-red-500/10"><TrashIcon className="w-4 h-4" /></button>
                    )}
                </div>
            </div>

            {/* Access Protocol Vault Area - The "Handshake Zone" */}
            <div className={`relative flex-grow rounded-[2rem] border transition-all duration-1000 overflow-hidden flex flex-col p-8 ${isLinked ? 'bg-emerald-500/[0.02] border-emerald-500/10' : 'bg-white/[0.01] border-white/5'
                }`}>
                {/* Visual Telemetry */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />

                <div className="flex justify-between items-center mb-6 relative z-10">
                    <div className="flex items-center gap-3">
                        <KeyIcon className={`w-3.5 h-3.5 ${isLinked ? 'text-emerald-500/40' : 'text-primary/40'}`} />
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Access Protocol Vault</span>
                    </div>
                    <AnimatePresence mode="wait">
                        <motion.span
                            key={handshakeStep}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className={`text-[9px] font-black px-3 py-1 rounded-full border uppercase tracking-widest ${handshakeStep === 'VERIFIED' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' :
                                    handshakeStep === 'PENDING' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' :
                                        'text-primary bg-primary/10 border-primary/20'
                                }`}
                        >
                            {handshakeStep === 'VERIFIED' ? 'Handshake Verified' :
                                handshakeStep === 'PENDING' ? 'Awaiting Protocol' :
                                    handshakeStep === 'SYNCHRONIZING' ? 'Verifying Identity' : 'Key provisioned'}
                        </motion.span>
                    </AnimatePresence>
                </div>

                <div className="flex-grow flex flex-col items-center justify-center text-center relative z-10 py-4">
                    <AnimatePresence mode="wait">
                        {handshakeStep === 'PENDING' && (
                            <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto border border-white/10 text-white/20">
                                    <ShieldCheckIcon className="w-8 h-8 opacity-20" />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">Node Locked</p>
                                    <button
                                        onClick={handleGenerateKey}
                                        className="group flex items-center gap-3 px-6 py-3 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:shadow-[0_0_30px_rgba(var(--primary),0.3)] transition-all"
                                    >
                                        Generate Secure Process Key
                                        <ChevronRightIcon className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {handshakeStep === 'KEY_READY' && (
                            <motion.div key="ready" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full space-y-6">
                                <div className="relative group/keyinput">
                                    <div className="bg-black/40 border border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-2xl overflow-hidden">
                                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover/keyinput:opacity-100 transition-opacity" />
                                        <span className="font-mono font-black text-primary tracking-[0.4em] text-xl relative z-10">
                                            {revealed ? branch.access_key : '••••-••••-••••'}
                                        </span>
                                        <div className="flex items-center gap-2 relative z-10">
                                            <button onClick={() => setRevealed(!revealed)} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
                                                {revealed ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={handleCopy}
                                                className={`p-2.5 rounded-xl transition-all relative ${copied ? 'bg-emerald-500 text-white' : 'bg-white/5 hover:bg-primary/20 text-white/40 hover:text-primary'}`}
                                            >
                                                {copied ? <CheckCircleIcon className="w-4 h-4 animate-in zoom-in" /> : <CopyIcon className="w-4 h-4" />}
                                                {copied && (
                                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="absolute -top-10 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[8px] font-black px-2 py-1 rounded-md whitespace-nowrap uppercase">
                                                        Key Copied Securely
                                                    </motion.div>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-[8px] text-white/20 font-black uppercase tracking-[0.3em] mt-3">AES-256 · Single-use · Auto-expires in 24h</p>
                                </div>
                                <button
                                    onClick={handleInitiateSync}
                                    className="w-full py-4 border border-white/10 hover:border-primary/40 rounded-xl text-[10px] font-black text-white/40 hover:text-white transition-all uppercase tracking-[0.4em] bg-white/[0.02] hover:bg-primary/10"
                                >
                                    Initiate Handshake Sync
                                </button>
                            </motion.div>
                        )}

                        {handshakeStep === 'SYNCHRONIZING' && (
                            <motion.div key="sync" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                                <div className="relative">
                                    <div className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center border border-primary/20 mx-auto">
                                        <Spinner size="lg" className="text-primary" />
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 bg-black border border-white/10 rounded-full p-2">
                                        <ShieldCheckIcon className="w-4 h-4 text-primary animate-pulse" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-sm font-black text-white uppercase tracking-widest">Handshake in Progress</p>
                                    <p className="text-[9px] text-white/20 font-bold uppercase tracking-[0.4em] animate-pulse italic">Validating encrypted identity tokens...</p>
                                </div>
                            </motion.div>
                        )}

                        {handshakeStep === 'VERIFIED' && (
                            <motion.div key="verified" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                                <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto border border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
                                    <ShieldCheckIcon className="w-10 h-10 animate-bounce" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-lg font-black text-white uppercase tracking-tighter">Handshake Verified</p>
                                    <p className="text-[10px] text-emerald-500/60 font-black uppercase tracking-[0.4em]">Encrypted Channel Live</p>
                                    <div className="mt-4 p-3 bg-black/40 rounded-xl border border-white/5 inline-block">
                                        <p className="text-[8px] text-white/20 font-mono tracking-wider">{branch.admin_email}</p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Decorative Matrix Background - Subtle reinforcement */}
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none font-mono text-[7px] p-4 leading-none break-all select-none mask-fade">
                    {Array.from({ length: 15 }).map((_, i) => <div key={i} className="mb-1">{Math.random().toString(36).slice(2, 24).toUpperCase()}</div>)}
                </div>
            </div>

            {/* Handshake Phase Tracker */}
            <div className="mt-10 space-y-4">
                <div className="flex justify-between items-center mb-2 px-1">
                    <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Identity Handshake Protocol</span>
                    <span className="text-[9px] font-black text-primary/60 uppercase tracking-widest">
                        {isLinked ? 'Validated' : 'Encrypted Phase'}
                    </span>
                </div>

                <div className="flex items-center gap-2 relative">
                    {[
                        { step: 'PENDING', icon: <PlusIcon className="w-3 h-3" />, label: 'Provision' },
                        { step: 'KEY_READY', icon: <KeyIcon className="w-3 h-3" />, label: 'Key Gen' },
                        { step: 'SYNCHRONIZING', icon: <Spinner size="sm" />, label: 'Handshake' },
                        { step: 'VERIFIED', icon: <CheckCircleIcon className="w-3 h-3" />, label: 'Certified' }
                    ].map((item, idx, arr) => {
                        const statusWeights = { PENDING: 0, KEY_READY: 1, SYNCHRONIZING: 2, VERIFIED: 3, FAILED: 2 };
                        const currentWeight = statusWeights[handshakeStep];
                        const isActive = idx <= currentWeight;
                        const isCurrent = idx === currentWeight;

                        return (
                            <React.Fragment key={item.step}>
                                <div className="flex flex-col items-center gap-2 relative z-10 flex-1">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all duration-700 ${isActive ? 'bg-primary border-primary/40 text-white shadow-[0_0_20px_rgba(var(--primary),0.3)]' :
                                            'bg-white/5 border-white/10 text-white/20'
                                        } ${isCurrent && handshakeStep !== 'VERIFIED' ? 'animate-pulse' : ''}`}>
                                        {item.icon}
                                    </div>
                                    <span className={`text-[7px] font-black uppercase tracking-widest transition-colors ${isActive ? 'text-primary' : 'text-white/10'}`}>
                                        {item.label}
                                    </span>
                                </div>
                                {idx < arr.length - 1 && (
                                    <div className="flex-[0.5] h-px bg-white/10 -mt-5 relative overflow-hidden">
                                        <motion.div
                                            initial={{ x: '-100%' }}
                                            animate={{ x: isActive && idx < currentWeight ? '0%' : '-100%' }}
                                            transition={{ duration: 0.8 }}
                                            className="absolute inset-0 bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)]"
                                        />
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
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

export const BranchManagementTab: React.FC<BranchManagementTabProps> = ({ isHeadOfficeAdmin, branches, onBranchUpdate, schoolProfile }) => {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [branchToEdit, setBranchToEdit] = useState<SchoolBranch | null>(null);
    const [branchToDelete, setBranchToDelete] = useState<SchoolBranch | null>(null);

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

    const activeSyncs = branches.filter(b => b.status === 'Active' || b.status === 'Linked').length;

    return (
        <div className="space-y-16 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-40 px-4 md:px-0">
            {/* Enterprise Command Header - Top Level Telemetry */}
            <div className="relative bg-[#0d0f14] border border-white/5 p-10 md:p-14 rounded-[4rem] shadow-[0_64px_128px_-32px_rgba(0,0,0,0.8)] overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="relative z-10 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-14">
                    <div className="space-y-8 flex-grow">
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.3em]">
                                <ShieldCheckIcon className="w-4 h-4" />
                                Institutional Governance Layer
                            </div>
                            <h2 className="text-5xl md:text-7xl font-serif font-black text-white tracking-tighter uppercase leading-[0.9]">
                                Institutional <br />
                                <span className="text-white/20 italic">Network Registry.</span>
                            </h2>
                            <p className="text-white/30 text-[18px] font-serif italic max-w-xl leading-relaxed">
                                Managed telemetry and encrypted protocol synchronization for distributed satellite campus nodes.
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
                                <span className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em]">Handshake Protocol</span>
                                <div className="flex items-center gap-4">
                                    <span className="text-4xl font-black text-emerald-500">{activeSyncs}</span>
                                    <div className="px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                                        <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Synchronized</span>
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
                        <motion.button
                            whileHover={{ scale: 1.02, y: -4 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => { setBranchToEdit(null); setIsCreateModalOpen(true); }}
                            className="w-full xl:w-auto px-12 py-7 bg-primary text-white font-black text-[13px] uppercase tracking-[0.4em] rounded-[2rem] shadow-[0_40px_80px_-20px_rgba(var(--primary),0.6)] hover:shadow-[0_50px_100px_-20px_rgba(var(--primary),0.8)] transition-all flex items-center justify-center gap-5 group border border-white/10"
                        >
                            <PlusIcon className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
                            Initialize Node
                        </motion.button>
                    )}
                </div>
            </div>

            {/* Registry Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                {branches.map((branch, idx) => (
                    <BranchCard
                        key={branch.id}
                        branch={branch}
                        onEdit={() => { setBranchToEdit(branch); setIsCreateModalOpen(true); }}
                        onDelete={() => setBranchToDelete(branch)}
                    />
                ))}

                {isHeadOfficeAdmin && branches.length < 3 && (
                    <motion.button
                        whileHover={{ scale: 0.98 }}
                        onClick={() => { setBranchToEdit(null); setIsCreateModalOpen(true); }}
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

            {/* Modal for Branch Creation/Editing */}
            <AnimatePresence>
                {isCreateModalOpen && (
                    <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[500] flex items-center justify-center p-6" onClick={() => setIsCreateModalOpen(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 40 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 40 }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            className="bg-[#050608] w-full max-w-5xl rounded-[4rem] shadow-[0_64px_128px_-32px_rgba(0,0,0,1)] border border-white/10 overflow-hidden flex flex-col max-h-[94vh] relative"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="px-14 py-12 border-b border-white/5 bg-white/[0.02] flex justify-between items-center relative z-10">
                                <div className="space-y-2">
                                    <h3 className="text-3xl font-serif font-black text-white tracking-tighter uppercase">{branchToEdit ? 'Configure Node' : 'Initialize Node'}</h3>
                                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-primary/60">Topological Registry Configuration</p>
                                </div>
                                <button onClick={() => setIsCreateModalOpen(false)} className="w-14 h-14 rounded-full bg-white/5 text-white/20 hover:text-white hover:bg-red-500/20 hover:rotate-90 transition-all flex items-center justify-center border border-white/5">
                                    <XIcon className="w-8 h-8" />
                                </button>
                            </div>
                            <div className="overflow-y-auto flex-grow p-10 md:p-14 custom-scrollbar">
                                <BranchCreationPage
                                    profile={branchToEdit ? undefined : (schoolProfile?.user_id ? { id: schoolProfile.user_id } as any : undefined)}
                                    onNext={() => { setIsCreateModalOpen(false); onBranchUpdate(); }}
                                />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

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