import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { ShieldCheckIcon } from './icons/ShieldCheckIcon';
import { XIcon } from './icons/XIcon';
import { LocationIcon } from './icons/LocationIcon';
import { BranchCreationPage } from './BranchCreationPage';
import ConfirmationModal from './common/ConfirmationModal';

interface BranchInvitation {
    code: string;
    expires_at: string;
    is_revoked: boolean;
}

const BranchCard: React.FC<{
    branch: SchoolBranch,
    invitation?: BranchInvitation,
    isGenerating: boolean,
    onEdit: () => void,
    onDelete: () => void,
    onGenerate: () => void,
    onRevoke: () => void
}> = ({ branch, invitation, isGenerating, onEdit, onDelete, onGenerate, onRevoke }) => {
    const [copied, setCopied] = useState(false);
    const [revealed, setRevealed] = useState(false);

    const isExpired = invitation ? new Date(invitation.expires_at) < new Date() : false;
    const isActive = invitation && !invitation.is_revoked && !isExpired;
    const isLinked = branch.status === 'Linked' || branch.status === 'Active';

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!invitation) return;
        navigator.clipboard.writeText(invitation.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onEdit}
            className="group relative bg-[#0D0F14]/80 backdrop-blur-3xl border border-white/5 rounded-[40px] p-8 min-h-[460px] flex flex-col transition-all duration-500 hover:border-primary/30 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] cursor-pointer ring-1 ring-white/5 overflow-hidden"
        >
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

            {/* Active Node Scanning Effect */}
            {isLinked && (
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent animate-scanner-move pointer-events-none"></div>
            )}

            {/* Header / Status */}
            <div className="flex justify-between items-start mb-12 relative z-10">
                <div className={`p-5 rounded-2xl border-2 transition-all duration-500 ${isLinked ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]' :
                    branch.is_main_branch ? 'bg-primary/5 border-primary/20 text-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]' :
                        'bg-white/5 border-white/10 text-white/10 group-hover:text-white/30'
                    }`}>
                    <SchoolIcon className="w-6 h-6" />
                </div>

                <div className="flex flex-col items-end gap-2">
                    {isLinked ? (
                        <div className="px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-[0.2em] border border-emerald-500/20 shadow-lg backdrop-blur-md flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></div>
                            Node Synced
                        </div>
                    ) : branch.is_main_branch ? (
                        <div className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em] border border-primary/20 shadow-lg backdrop-blur-md">
                            Identity Root
                        </div>
                    ) : (
                        <div className="px-4 py-1.5 rounded-full bg-white/5 text-white/20 text-[10px] font-black uppercase tracking-[0.2em] border border-white/5">
                            Sub-Node
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="space-y-3 mb-10 relative z-10">
                <h3 className="text-2xl font-black text-white tracking-tighter leading-none group-hover:text-primary transition-colors duration-300">{branch.name}</h3>
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-white/20">
                    <LocationIcon className="w-4 h-4 opacity-40 shrink-0" />
                    {branch.city}, {branch.state}
                </div>
            </div>

            {/* Protocol Vault Section */}
            <div className="mt-auto bg-[#08090a]/60 backdrop-blur-2xl border border-white/5 rounded-[30px] p-6 space-y-5 relative z-10 ring-1 ring-white/5">
                {isActive ? (
                    <div className="space-y-5" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Encryption Key</span>
                            <span className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest animate-pulse">Awaiting Sync</span>
                        </div>
                        <div className="flex items-center gap-3 bg-black/60 p-4 rounded-2xl border border-white/10 shadow-inner group/code overflow-hidden relative">
                            <div className="absolute inset-y-0 left-0 w-[2px] bg-primary/40"></div>
                            <span className="flex-grow font-mono text-sm font-black text-primary tracking-[0.3em] truncate">
                                {revealed ? invitation.code : '••••••••••••'}
                            </span>
                            <button onClick={() => setRevealed(!revealed)} className="p-2 text-white/20 hover:text-white transition-all hover:bg-white/5 rounded-lg">
                                {revealed ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                            </button>
                            <button onClick={handleCopy} className={`p-2 rounded-lg transition-all ${copied ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'text-white/20 hover:text-white hover:bg-white/5'}`}>
                                {copied ? <CheckCircleIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                            </button>
                        </div>
                        <button onClick={onRevoke} className="w-full text-[10px] font-black text-red-500/40 hover:text-red-500 uppercase tracking-[0.4em] transition-all hover:scale-105">Revoke Protocol</button>
                    </div>
                ) : isLinked ? (
                    <div className="py-8 flex flex-col items-center gap-5">
                        <div className="w-14 h-14 rounded-full bg-emerald-500/5 flex items-center justify-center text-emerald-500/30 ring-2 ring-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.1)] relative">
                            <ShieldCheckIcon className="w-7 h-7" />
                            <div className="absolute inset-0 rounded-full animate-ping bg-emerald-500/10 opacity-20"></div>
                        </div>
                        <div className="text-center">
                            <p className="text-[12px] font-black text-white uppercase tracking-[0.3em]">Communication Secure</p>
                            <p className="text-[10px] text-white/20 font-medium mt-2 uppercase tracking-widest">Real-time Telemetry Active</p>
                        </div>
                    </div>
                ) : (
                    <div className="py-4 flex flex-col items-center gap-6">
                        <button
                            onClick={e => { e.stopPropagation(); onGenerate(); }}
                            disabled={isGenerating}
                            className="w-full group/btn bg-primary/10 hover:bg-primary border border-primary/30 text-primary hover:text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300 shadow-lg disabled:opacity-50 relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700"></div>
                            {isGenerating ? <Spinner size="sm" /> : (
                                <span className="flex items-center justify-center gap-3">
                                    Provision Node <PlusIcon className="w-4 h-4" />
                                </span>
                            )}
                        </button>
                        <span className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em] group-hover:text-white/20 transition-colors">OS Layer: Verified</span>
                    </div>
                )}
            </div>

            {/* Actions Footer */}
            <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                    <button
                        onClick={e => { e.stopPropagation(); onDelete(); }}
                        className="p-3 text-white/10 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                    >
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex items-center gap-3 px-5 py-2.5 bg-white/5 rounded-2xl border border-white/5 text-[10px] font-black text-white/30 uppercase tracking-[0.3em] hover:text-white transition-all group-hover:border-white/20">
                    Control Hub <EditIcon className="w-4 h-4 text-primary" />
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
    const [invitations, setInvitations] = useState<Record<number, BranchInvitation>>({});
    const [generatingMap, setGeneratingMap] = useState<Record<number, boolean>>({});
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [branchToEdit, setBranchToEdit] = useState<SchoolBranch | null>(null);
    const [branchToDelete, setBranchToDelete] = useState<SchoolBranch | null>(null);

    const fetchInvitations = useCallback(async () => {
        const { data, error } = await supabase
            .from('school_branch_invitations')
            .select('branch_id, code, expires_at, is_revoked')
            .eq('is_revoked', false)
            .is('redeemed_at', null);

        if (!error && data) {
            const map: Record<number, BranchInvitation> = {};
            data.forEach(inv => map[inv.branch_id] = inv);
            setInvitations(map);
        }
    }, []);

    useEffect(() => {
        fetchInvitations();
    }, [fetchInvitations, branches]);

    const handleGenerateKey = async (branchId: number) => {
        setGeneratingMap(prev => ({ ...prev, [branchId]: true }));
        try {
            const { data, error } = await supabase.rpc('generate_branch_access_key', { p_branch_id: branchId });
            if (error) throw error;
            if (data && data.success) {
                await fetchInvitations();
                onBranchUpdate();
            }
        } catch (e: any) {
            console.error(e);
        } finally {
            setGeneratingMap(prev => ({ ...prev, [branchId]: false }));
        }
    };

    const handleRevokeKey = async (branchId: number) => {
        try {
            const { error } = await supabase.rpc('revoke_branch_access_key', { p_branch_id: branchId });
            if (error) throw error;
            await fetchInvitations();
            onBranchUpdate();
        } catch (e: any) {
            console.error(e);
        }
    };

    const handleDelete = async () => {
        if (!branchToDelete) return;
        try {
            const { error } = await supabase.rpc('delete_school_branch', { p_branch_id: branchToDelete.id });
            if (error) throw error;
            onBranchUpdate(branchToDelete, true);
            setBranchToDelete(null);
        } catch (e: any) {
            console.error(e);
        }
    };

    const activeSyncs = branches.filter(b => b.status === 'Linked' || b.status === 'Active').length;

    return (
        <div className="space-y-20 animate-in fade-in duration-700 pb-40">
            {/* HERO CARD - THE CONTROL HUB */}
            <div className="relative bg-[#0D0F14] border border-white/10 rounded-[60px] p-12 md:p-20 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] overflow-hidden group/hero transition-all duration-700 ring-1 ring-white/10">
                {/* Background Textures & Glows */}
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/[0.03] to-transparent pointer-events-none" />
                <div className="absolute -right-40 -top-40 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none group-hover/hero:bg-primary/10 transition-colors duration-1000"></div>
                <div className="absolute -left-40 -bottom-40 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none group-hover/hero:bg-indigo-500/10 transition-colors duration-1000"></div>

                {/* Large Background Icon */}
                <div className="absolute right-10 top-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none group-hover/hero:scale-110 group-hover/hero:rotate-12 transition-all duration-1000">
                    <ShieldCheckIcon className="w-[500px] h-[500px] text-white" />
                </div>

                <div className="relative z-10 space-y-16">
                    <div className="space-y-6">
                        <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-white/5 border border-white/10 mb-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981] animate-pulse"></div>
                            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/40">Secure Network Layer Layer </span>
                        </div>
                        <h2 className="text-5xl md:text-8xl font-black text-white tracking-tighter uppercase leading-[0.85] italic drop-shadow-2xl">
                            Institutional <br /> <span className="text-white/20 not-italic">Network.</span>
                        </h2>
                        <p className="text-white/40 text-lg md:text-xl font-medium max-w-2xl leading-relaxed border-l-2 border-primary/40 pl-10 py-2">
                            Global configuration and deployment of institutional nodes. Monitor synchronization health and manage cryptographic provisioning protocols for a unified campus ecosystem.
                        </p>
                    </div>

                    {/* Metric Chips Area */}
                    <div className="flex flex-wrap items-center gap-6">
                        <div className="bg-white/5 px-8 py-5 rounded-[2rem] border border-white/5 flex flex-col gap-2 backdrop-blur-xl hover:bg-white/[0.08] transition-all group/stat">
                            <span className="text-white/20 text-[10px] font-black uppercase tracking-[0.4em]">Active Nodes</span>
                            <div className="flex items-center gap-4">
                                <span className="text-4xl font-black text-white tracking-tighter">{branches.length}</span>
                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                    <SchoolIcon className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white/5 px-8 py-5 rounded-[2rem] border border-white/5 flex flex-col gap-2 backdrop-blur-xl hover:bg-white/[0.08] transition-all group/stat">
                            <span className="text-white/20 text-[10px] font-black uppercase tracking-[0.4em]">Synced Clusters</span>
                            <div className="flex items-center gap-4">
                                <span className="text-4xl font-black text-emerald-500 tracking-tighter">{activeSyncs}</span>
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                                    <CheckCircleIcon className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {isHeadOfficeAdmin && (
                        <div className="pt-8">
                            <button
                                onClick={() => { setBranchToEdit(null); setIsCreateModalOpen(true); }}
                                className="group relative px-14 py-6 bg-primary text-white font-black text-sm uppercase tracking-[0.4em] rounded-[2rem] shadow-[0_20px_40px_-10px_rgba(var(--primary-rgb),0.5)] hover:shadow-[0_25px_50px_-12px_rgba(var(--primary-rgb),0.6)] transition-all duration-300 transform active:scale-[0.95] flex items-center gap-4 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                <PlusIcon className="w-6 h-6" />
                                Add Institutional Node
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* SECONDARY ACTION BAR */}
            <div className="flex justify-between items-center px-8">
                <div className="flex items-center gap-6">
                    <span className="text-[11px] font-black text-white/20 uppercase tracking-[0.6em]">Node Registry History</span>
                    <div className="h-px w-24 bg-white/5"></div>
                </div>
                <button className="flex items-center gap-4 text-white/40 hover:text-white transition-all group font-black text-[10px] uppercase tracking-[0.4em] scale-90 hover:scale-100">
                    Finalize Architecture
                    <div className="p-2 rounded-lg bg-white/5">
                        <CheckCircleIcon className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:text-primary transition-all" />
                    </div>
                </button>
            </div>

            {/* NODES GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 px-2 lg:px-0">
                {branches.map(branch => (
                    <BranchCard
                        key={branch.id}
                        branch={branch}
                        invitation={invitations[branch.id]}
                        isGenerating={!!generatingMap[branch.id]}
                        onEdit={() => { setBranchToEdit(branch); setIsCreateModalOpen(true); }}
                        onDelete={() => setBranchToDelete(branch)}
                        onGenerate={() => handleGenerateKey(branch.id)}
                        onRevoke={() => handleRevokeKey(branch.id)}
                    />
                ))}

                {/* EXPAND NETWORK EMPTY CARD */}
                {isHeadOfficeAdmin && (
                    <button
                        onClick={() => { setBranchToEdit(null); setIsCreateModalOpen(true); }}
                        className="group relative h-full min-h-[460px] border-2 border-dashed border-white/5 bg-white/[0.01] hover:bg-white/[0.03] rounded-[40px] transition-all duration-500 flex flex-col items-center justify-center gap-8 shadow-sm hover:shadow-2xl hover:-translate-y-2 hover:border-primary/20"
                    >
                        <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/10 group-hover:text-primary transition-all duration-500 group-hover:bg-primary/5 group-hover:border-primary/20 group-hover:scale-110 shadow-inner">
                            <PlusIcon className="w-10 h-10" />
                        </div>
                        <div className="text-center space-y-3">
                            <span className="font-black text-[10px] uppercase tracking-[0.5em] text-white/10 group-hover:text-primary transition-colors block">Available Cluster</span>
                            <span className="font-black text-lg uppercase tracking-widest text-white/40 group-hover:text-white transition-colors">Expand Network</span>
                        </div>

                        {/* Background Subtle Pattern */}
                        <div className="absolute inset-0 opacity-[0.02] pointer-events-none group-hover:opacity-[0.04] transition-opacity overflow-hidden rounded-[40px]">
                            <div className="grid grid-cols-8 gap-4 p-8">
                                {Array.from({ length: 32 }).map((_, i) => (
                                    <div key={i} className="h-12 border border-white rounded-lg"></div>
                                ))}
                            </div>
                        </div>
                    </button>
                )}
            </div>

            {/* CONFIGURE NODE MODAL */}
            <AnimatePresence>
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 sm:p-12 overflow-hidden" onClick={() => setIsCreateModalOpen(false)}>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-2xl"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-[#0D0F14] w-full max-w-5xl rounded-[50px] shadow-[0_100px_200px_-50px_rgba(0,0,0,0.9)] border border-white/10 overflow-hidden flex flex-col relative z-10 max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="px-12 py-10 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                                <div>
                                    <h3 className="text-3xl font-black text-white tracking-tighter uppercase leading-none italic">Provision <span className="text-white/20 not-italic">Node.</span></h3>
                                    <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mt-3">Hardware configuration & identity mapping protocol</p>
                                </div>
                                <button onClick={() => setIsCreateModalOpen(false)} className="p-4 rounded-2xl hover:bg-white/5 text-white/20 hover:text-white transition-all border border-white/5 hover:border-white/20">
                                    <XIcon className="w-6 h-6" />
                                </button>
                            </div>
                            {/* Modal Body */}
                            <div className="p-12 md:p-16 overflow-y-auto custom-scrollbar flex-grow">
                                <BranchCreationPage
                                    hideHero
                                    initialBranch={branchToEdit}
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
                message={`CRITICAL ACTION: You are about to decommission the "${branchToDelete?.name}" node. This operation terminates all active data synchronization pipelines and revokes existing cryptographic identities for this campus cluster. Proceed with operational caution.`}
                confirmText="Confirm Decommission"
                loading={false}
            />
        </div>
    );
};
