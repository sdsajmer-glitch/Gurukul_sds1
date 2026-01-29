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
    const [handshakeStep, setHandshakeStep] = useState<HandshakeStatus>(
        (branch.status === 'Linked' && branch.access_key) ? 'VERIFIED' : 'PENDING'
    );

    const isLinked = handshakeStep === 'VERIFIED';

    const handleGenerateKey = (e: React.MouseEvent) => {
        e.stopPropagation();
        setHandshakeStep('KEY_READY');
    };

    const handleFinalizeVerification = (e: React.MouseEvent) => {
        e.stopPropagation();
        setHandshakeStep('SYNCHRONIZING');
        // Simulate high-security decryption/verification sequence
        setTimeout(() => setHandshakeStep('VERIFIED'), 3200);
    };

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (branch.access_key) {
            navigator.clipboard.writeText(branch.access_key);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.8, ease: "easeOut" }}
            className={`
                relative w-full min-h-[860px] flex flex-col justify-between 
                p-8 rounded-[32px] overflow-hidden transition-all duration-500
                border border-white/5 bg-[#0A0A0A] group
                ${branch.is_main_branch ? 'shadow-[0_0_80px_-20px_rgba(var(--primary),0.3)]' : 'hover:bg-white/[0.02]'}
            `}
        >
            {/* --- Background Ambience --- */}
            <div className="absolute inset-0 pointer-events-none">
                <div className={`absolute -top-32 -left-32 w-96 h-96 rounded-full blur-[128px] transition-opacity duration-1000 ${branch.is_main_branch ? 'bg-primary/20 opacity-100' : 'bg-white/5 opacity-0 group-hover:opacity-100'}`} />
                <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />
            </div>

            {/* --- 1. Header: Meta & Status --- */}
            <div className="relative z-10 flex flex-row items-center justify-between w-full h-12">
                {/* ID Tag */}
                <div className="flex flex-row items-center gap-3">
                    <div className="w-8 h-[1px] bg-white/20" />
                    <span className="text-[10px] font-bold tracking-[0.25em] text-white/40 uppercase">
                        NODE 0{index + 1}
                    </span>
                </div>

                {/* Status Badge */}
                <div className={`
                    flex flex-row items-center gap-3 px-4 py-2 rounded-full border backdrop-blur-md
                    ${branch.is_main_branch
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-white/5 border-white/10 text-white/60'}
                `}>
                    <div className={`w-1.5 h-1.5 rounded-full ${branch.is_main_branch ? 'bg-emerald-500 animate-pulse' : 'bg-white/40'}`} />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em]">
                        {branch.is_main_branch ? 'Command Node' : 'Satellite'}
                    </span>
                </div>
            </div>

            {/* --- 2. Identity Block (Icon & Name) --- */}
            <div className="relative z-10 flex flex-col items-center gap-8 py-8 flex-grow justify-center">
                {/* Icon Container */}
                <div className="relative flex items-center justify-center w-28 h-28 rounded-full bg-white/[0.02] border border-white/5 shadow-2xl group-hover:scale-110 transition-transform duration-700">
                    <SchoolIcon className={`w-12 h-12 ${branch.is_main_branch ? 'text-primary' : 'text-white/40 group-hover:text-white'} transition-colors duration-500`} />
                    {branch.is_main_branch && <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping opacity-20" />}
                </div>

                {/* Title Group */}
                <div className="flex flex-col items-center gap-3 text-center">
                    <h3 className="font-serif text-4xl text-white">
                        {branch.name}
                    </h3>

                    {/* Location Badge */}
                    <div className="flex flex-row items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10">
                        <LocationIcon className="w-3 h-3 text-white/40" />
                        <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
                            {branch.city}, {branch.country}
                        </span>
                    </div>
                </div>
            </div>

            {/* --- 3. Telemetry Grid --- */}
            <div className="relative z-10 grid grid-cols-3 gap-3 w-full mb-8">
                {[
                    { label: 'PROTOCOL', value: 'AES-256', color: 'text-primary' },
                    { label: 'STATUS', value: 'ACTIVE', color: 'text-emerald-500' },
                    { label: 'SYNC', value: 'REAL-TIME', color: 'text-white/40' }
                ].map((stat, i) => (
                    <div key={i} className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                        <span className="text-[7px] font-bold text-white/20 uppercase tracking-[0.2em]">{stat.label}</span>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${stat.color}`}>{stat.value}</span>
                    </div>
                ))}
            </div>

            {/* --- 4. Security Vault (Footer) --- */}
            <div className="relative z-10 w-full flex flex-col gap-4">
                {/* Vault Container */}
                <div className={`
                    flex flex-col w-full p-2 rounded-3xl border transition-colors duration-500
                    ${isLinked ? 'bg-emerald-950/10 border-emerald-500/10' : 'bg-white/[0.02] border-white/5'}
                `}>
                    {/* Vault Header */}
                    <div className="flex flex-row items-center justify-between px-6 py-4 border-b border-white/5">
                        <div className="flex flex-row items-center gap-3">
                            <ShieldCheckIcon className={`w-4 h-4 ${isLinked ? 'text-emerald-500' : 'text-primary animate-pulse'}`} />
                            <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">
                                ACCESS PROTOCOL VAULT
                            </span>
                        </div>
                        <div className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${isLinked ? 'text-emerald-500 bg-emerald-500/10' : 'text-white/20 bg-white/5'}`}>
                            {isLinked ? 'VERIFIED' : handshakeStep === 'PENDING' ? 'LOCKED' : 'PROVISIONING'}
                        </div>
                    </div>

                    {/* Vault Content Swapper */}
                    <div className="p-6 min-h-[160px] flex items-center justify-center">
                        <AnimatePresence mode="wait">
                            {handshakeStep === 'PENDING' && (
                                <motion.div
                                    key="pending"
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                                    className="flex flex-col items-center w-full"
                                >
                                    <button
                                        onClick={handleGenerateKey}
                                        className="h-16 px-8 rounded-2xl bg-primary text-white text-[11px] font-black uppercase tracking-[0.3em] shadow-[0_20px_40px_-10px_rgba(var(--primary),0.3)] hover:shadow-[0_25px_50px_-10px_rgba(var(--primary),0.4)] transition-all w-full flex items-center justify-center gap-3"
                                    >
                                        <KeyIcon className="w-5 h-5" />
                                        Initialize Handshake
                                    </button>
                                </motion.div>
                            )}

                            {handshakeStep === 'KEY_READY' && (
                                <motion.div
                                    key="key-ready"
                                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                    className="flex flex-col w-full gap-6"
                                >
                                    {/* Key Display Block */}
                                    <div className="space-y-3">
                                        <span className="text-[8px] font-black text-white/20 uppercase tracking-widest block text-center">Encrypted Node Access Code</span>
                                        <div className="flex flex-row items-center gap-2 p-4 rounded-2xl bg-black/60 border border-white/10 w-full shadow-inner ring-1 ring-white/5">
                                            <code className="flex-grow text-center font-mono text-lg text-primary tracking-[0.4em] font-black">
                                                {revealed ? branch.access_key : '••••-••••-••••'}
                                            </code>
                                            <div className="flex items-center gap-2">
                                                <button onClick={handleCopy} className="p-3 rounded-xl bg-white/5 text-white/40 hover:text-white transition-all relative">
                                                    <CopyIcon className="w-4 h-4" />
                                                    {copied && (
                                                        <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[7px] font-black px-2 py-1 rounded-lg uppercase tracking-widest whitespace-nowrap">COPIED</span>
                                                    )}
                                                </button>
                                                <button onClick={() => setRevealed(!revealed)} className="p-3 rounded-xl bg-white/5 text-white/40 hover:text-white transition-all">
                                                    {revealed ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Operator Guidelines (User Guide) */}
                                    <div className="flex flex-col gap-3 p-5 rounded-2xl bg-white/[0.03] border border-white/5 text-left">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                            <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">Operator Directive</span>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[8px] text-white/30 uppercase font-black leading-relaxed tracking-wider">
                                                1. SECURE THE <span className="text-primary">ACCESS KEY</span> DISPLAYED ABOVE.
                                            </p>
                                            <p className="text-[8px] text-white/30 uppercase font-black leading-relaxed tracking-wider">
                                                2. RELAY CODE TO <span className="text-white/60">{branch.name}</span> ADMINISTRATOR.
                                            </p>
                                            <p className="text-[8px] text-white/30 uppercase font-black leading-relaxed tracking-wider">
                                                3. EXECUTE <span className="text-primary">VERIFICATION PROTOCOL</span> ONCE LINKED.
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleFinalizeVerification}
                                        className="h-14 rounded-2xl bg-white text-black text-[11px] font-black uppercase tracking-[0.2em] hover:bg-white/90 transition-all flex justify-center items-center gap-3 shadow-[0_20px_40px_-10px_rgba(255,255,255,0.2)]"
                                    >
                                        Verify Node Connection
                                    </button>
                                </motion.div>
                            )}

                            {handshakeStep === 'SYNCHRONIZING' && (
                                <motion.div
                                    key="syncing"
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    className="flex flex-col items-center gap-6 w-full py-4"
                                >
                                    <div className="relative w-24 h-24 flex items-center justify-center">
                                        <Spinner size="lg" className="text-primary" />
                                        <ShieldCheckIcon className="absolute w-8 h-8 text-primary opacity-40 animate-pulse" />
                                    </div>
                                    <div className="flex flex-col items-center gap-2">
                                        <span className="text-[12px] font-black text-white uppercase tracking-[0.5em] animate-pulse">Synchronizing Matrix</span>
                                        <span className="text-[8px] font-mono text-primary uppercase">Validating Handshake Protocol...</span>
                                    </div>
                                </motion.div>
                            )}

                            {handshakeStep === 'VERIFIED' && (
                                <motion.div
                                    key="verified"
                                    initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }}
                                    className="flex flex-col items-center gap-4 py-4"
                                >
                                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.3)]">
                                        <CheckCircleIcon className="w-8 h-8" />
                                    </div>
                                    <div className="flex flex-col items-center gap-1">
                                        <p className="text-lg font-black text-white uppercase tracking-tight">Handshake Secured</p>
                                        <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.4em]">Encrypted Link Established</p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* --- 5. Hover Actions (Floating) --- */}
            <div className="absolute top-6 right-6 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                <button onClick={onEdit} className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-all">
                    <EditIcon className="w-4 h-4" />
                </button>
                {!branch.is_main_branch && (
                    <button onClick={onDelete} className="w-10 h-10 rounded-full bg-red-500/10 backdrop-blur-md flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                )}
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
        <div className="flex flex-col gap-12 pb-40 px-6 sm:px-8 max-w-[1600px] mx-auto w-full">

            {/* --- 1. Master Command Header --- */}
            <div className="relative w-full overflow-hidden rounded-[40px] border border-white/5 bg-[#050505]">
                {/* Background FX */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/4" />

                <div className="relative z-10 flex flex-col p-10 md:p-14 gap-12">
                    {/* Top Row: Meta & Lang */}
                    <div className="flex flex-row items-start justify-between w-full">
                        <div className="flex flex-row items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-primary text-[10px] font-bold uppercase tracking-[0.3em] backdrop-blur-md">
                            <ShieldCheckIcon className="w-4 h-4" />
                            <span>Institutional Governance Layer</span>
                        </div>

                        {/* Language Switcher */}
                        <div className="flex flex-row items-center p-1 rounded-xl bg-black/40 border border-white/10">
                            {(['EN', 'HI'] as Language[]).map((lang) => (
                                <button
                                    key={lang}
                                    onClick={() => setLanguage(lang)}
                                    className={`
                                        px-4 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all
                                        ${language === lang ? 'bg-primary text-white shadow-lg' : 'text-white/20 hover:text-white/40'}
                                    `}
                                >
                                    {lang === 'EN' ? 'ENG' : 'HIN'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Middle Row: Title & Actions */}
                    <div className="flex flex-col xl:flex-row items-end justify-between gap-10">
                        <div className="flex flex-col gap-6 max-w-4xl">
                            <h2 className="text-5xl md:text-7xl lg:text-8xl font-serif text-white tracking-tighter leading-[0.9]">
                                {language === 'EN' ? 'INSTITUTIONAL' : 'संस्थागत'} <br />
                                <span className="text-white/20 italic">
                                    {language === 'EN' ? 'NETWORK REGISTRY.' : 'नेटवर्क रजिस्ट्री।'}
                                </span>
                            </h2>
                            <p className="text-lg md:text-xl text-white/30 max-w-2xl leading-relaxed font-light">
                                Managed telemetry and encrypted protocol synchronization for distributed satellite campus nodes.
                            </p>
                        </div>

                        {isHeadOfficeAdmin && (
                            <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => { setSelectedBranch(null); setDrawerMode('SYNC'); }}
                                    className="h-14 px-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-500 text-[11px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-colors min-w-[200px]"
                                >
                                    <RefreshCwIcon className="w-4 h-4" />
                                    <span>Sync Status</span>
                                </motion.button>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => { setSelectedBranch(null); setDrawerMode('CREATE'); }}
                                    className="h-14 px-10 rounded-2xl bg-white text-black hover:bg-white/90 text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] min-w-[240px]"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                    <span>Init New Node</span>
                                </motion.button>
                            </div>
                        )}
                    </div>

                    {/* Bottom Row: Stats Matrix */}
                    <div className="w-full h-px bg-white/5" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-bold uppercase text-white/20 tracking-[0.2em]">Active Nodes</span>
                            <span className="text-3xl font-serif text-white">{branches.length} <span className="text-lg text-white/20 italic">/ 10</span></span>
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-bold uppercase text-white/20 tracking-[0.2em]">Verified Links</span>
                            <div className="flex items-center gap-3">
                                <span className={`text-3xl font-serif ${authenticatedNodes > 0 ? 'text-emerald-500' : 'text-white/20'}`}>{authenticatedNodes}</span>
                                {authenticatedNodes > 0 && <CheckCircleIcon className="w-5 h-5 text-emerald-500" />}
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-bold uppercase text-white/20 tracking-[0.2em]">Security Protocol</span>
                            <span className="text-3xl font-mono text-primary tracking-tighter">256-BIT</span>
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-bold uppercase text-white/20 tracking-[0.2em]">System Status</span>
                            <span className="text-3xl font-serif text-emerald-500">Online</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- 2. Registry Grid --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
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

                {isHeadOfficeAdmin && (
                    <motion.button
                        whileHover={{ scale: 0.99, borderColor: 'rgba(255,255,255,0.1)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { setSelectedBranch(null); setDrawerMode('CREATE'); }}
                        className="
                            relative flex flex-col items-center justify-center gap-6 min-h-[720px] 
                            rounded-[32px] border border-dashed border-white/5 bg-transparent 
                            hover:bg-white/[0.01] transition-all group
                        "
                    >
                        <div className="w-20 h-20 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center group-hover:bg-primary/10 group-hover:border-primary/20 transition-all duration-500">
                            <PlusIcon className="w-8 h-8 text-white/20 group-hover:text-primary transition-colors" />
                        </div>
                        <div className="flex flex-col items-center gap-2 text-center">
                            <span className="text-lg font-serif text-white/20 group-hover:text-white/60 transition-colors italic">Expansion Protocol</span>
                            <span className="text-[9px] font-bold uppercase tracking-[0.4em] text-white/10 group-hover:text-white/40">Initialize Satellite Node</span>
                        </div>
                    </motion.button>
                )}
            </div>

            {/* --- Drawers & Modals --- */}
            <BranchSideDrawer
                isOpen={!!drawerMode}
                onClose={() => { setDrawerMode(null); setSelectedBranch(null); }}
                title={
                    drawerMode === 'CREATE' ? 'Initialize Node' :
                        drawerMode === 'SYNC' ? 'Handshake Protocol' :
                            drawerMode === 'EDIT' ? 'Edit Configuration' :
                                'Node Details'
                }
                subtitle="INSTITUTIONAL REGISTRY V4.0"
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
                        <div className="p-8 rounded-[2rem] border border-primary/20 bg-primary/5 flex flex-col gap-6">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Identity Integrity</p>
                                    <p className="text-[9px] text-white/30 font-mono">HASH: {selectedBranch.access_key}</p>
                                </div>
                                <div className="px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-widest">
                                    Encrypted & Live
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