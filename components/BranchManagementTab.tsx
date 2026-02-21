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
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={onEdit}
            className="group relative bg-[#13141B] border border-white/5 rounded-3xl p-6 h-[240px] flex flex-col transition-all duration-300 hover:border-primary/40 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] cursor-pointer overflow-hidden shadow-md"
        >
            {/* Minimal Status Strip */}
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl border transition-all duration-300 ${isLinked ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                    branch.is_main_branch ? 'bg-primary/10 border-primary/20 text-primary' :
                        'bg-white/5 border-white/10 text-white/30'
                    }`}>
                    <SchoolIcon className="w-5 h-5" />
                </div>

                <div className="flex flex-col items-end gap-1.5">
                    {isLinked ? (
                        <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[9px] font-bold uppercase tracking-wider border border-emerald-500/20">
                            Active
                        </div>
                    ) : branch.is_main_branch ? (
                        <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-wider border border-primary/20">
                            Admin
                        </div>
                    ) : (
                        <div className="px-3 py-1 rounded-full bg-white/5 text-white/30 text-[9px] font-bold uppercase tracking-wider border border-white/5">
                            Branch
                        </div>
                    )}
                </div>
            </div>

            {/* Branch Details */}
            <div className="space-y-1 mb-6">
                <h3 className="text-lg font-bold text-white tracking-tight truncate leading-none uppercase italic">{branch.name}</h3>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/20 uppercase tracking-widest truncate">
                    <LocationIcon className="w-3 h-3 opacity-30 shrink-0" />
                    {branch.city}, {branch.state}
                </div>
            </div>

            {/* Protocol Row */}
            <div className="mt-auto flex items-center justify-between gap-3">
                {isActive ? (
                    <div className="flex-grow flex items-center gap-2 bg-black/40 p-2.5 rounded-xl border border-white/5" onClick={e => e.stopPropagation()}>
                        <span className="flex-grow font-mono text-[10px] font-bold text-primary tracking-widest truncate pl-1">
                            {revealed ? invitation.code : '••••••••••••'}
                        </span>
                        <div className="flex items-center">
                            <button onClick={() => setRevealed(!revealed)} className="p-1.5 text-white/20 hover:text-white transition-colors">
                                {revealed ? <EyeOffIcon className="w-3.5 h-3.5" /> : <EyeIcon className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={handleCopy} className={`p-1.5 transition-colors ${copied ? 'text-emerald-500' : 'text-white/20 hover:text-white'}`}>
                                {copied ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={onRevoke} className="p-1.5 text-white/10 hover:text-red-500 transition-colors ml-1 border-l border-white/5" title="Revoke">
                                <XIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                ) : isLinked ? (
                    <div className="flex items-center gap-2 text-[10px] font-bold text-white/20 uppercase tracking-widest px-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                        System Sync Active
                    </div>
                ) : (
                    <button
                        onClick={e => { e.stopPropagation(); onGenerate(); }}
                        disabled={isGenerating}
                        className="bg-white/5 hover:bg-primary hover:text-white border border-white/10 hover:border-primary text-white/40 px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                        {isGenerating ? <Spinner size="sm" /> : 'Activate Branch'}
                    </button>
                )}

                {!isActive && (
                    <button
                        onClick={e => { e.stopPropagation(); onDelete(); }}
                        className="p-2.5 text-white/5 hover:text-red-500 transition-colors rounded-xl hover:bg-red-500/5 group/del"
                    >
                        <TrashIcon className="w-4.5 h-4.5" />
                    </button>
                )}
            </div>

            {/* Subtle Industrial Texture Background */}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-primary/[0.02] to-transparent pointer-events-none" />
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
    const coveragePercent = branches.length > 0 ? Math.round((activeSyncs / branches.length) * 100) : 0;

    return (
        <div className="max-w-[1440px] mx-auto space-y-8 animate-in fade-in duration-500 pb-40 px-4 md:px-8">
            {/* COMPACT HEADER SECTION */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-6">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black text-white tracking-tight uppercase italic flex items-center gap-3 text-white/90">
                        Institutional <span className="opacity-20 not-italic">Network</span>
                    </h2>
                    <p className="text-white/40 text-sm font-bold uppercase tracking-widest">
                        Manage school branches and system connectivity from one place.
                    </p>
                </div>

                {isHeadOfficeAdmin && (
                    <button
                        onClick={() => { setBranchToEdit(null); setIsCreateModalOpen(true); }}
                        className="px-8 py-3 bg-primary text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/10"
                    >
                        <PlusIcon className="w-4 h-4" />
                        Add Branch
                    </button>
                )}
            </header>

            {/* NETWORK HEALTH SUMMARY STRIP */}
            <div className="bg-[#13141B] border border-white/5 rounded-[32px] p-6 flex flex-wrap items-center gap-10 shadow-sm relative overflow-hidden group/summary">
                <div className="flex items-center gap-4 pr-10 border-r border-white/5">
                    <div className="p-2.5 rounded-xl bg-white/5 text-white/30">
                        <SchoolIcon className="w-4.5 h-4.5" />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Active Nodes</p>
                        <p className="text-xl font-bold text-white leading-none mt-1">{branches.length}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 pr-10 border-r border-white/5">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
                        <ClockIcon className="w-4.5 h-4.5" />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Pending Setup</p>
                        <p className="text-xl font-bold text-amber-500 leading-none mt-1">{branches.length - activeSyncs}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 pr-10 border-r border-white/5">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                        <ShieldCheckIcon className="w-4.5 h-4.5" />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">System Status</p>
                        <p className="text-xl font-bold text-emerald-500 leading-none mt-1 uppercase italic tracking-tighter">Secure</p>
                    </div>
                </div>

                <div className="flex-grow min-w-[240px] flex items-center gap-8">
                    <div className="flex-grow">
                        <div className="flex justify-between items-end mb-2.5">
                            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Network Coverage</p>
                            <p className="text-[10px] font-bold text-white">{coveragePercent}%</p>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${coveragePercent}%` }}
                                transition={{ duration: 1.2, ease: "circOut" }}
                                className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
                            />
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] text-white/10 font-black uppercase tracking-widest whitespace-nowrap">Status: Operational</p>
                    </div>
                </div>

                {/* Subtle Background Trace */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.01] to-transparent group-hover/summary:opacity-50 transition-opacity pointer-events-none"></div>
            </div>

            {/* NODES GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
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

                {/* ADD BRANCH EMPTY CARD */}
                {isHeadOfficeAdmin && (
                    <button
                        onClick={() => { setBranchToEdit(null); setIsCreateModalOpen(true); }}
                        className="group relative h-[240px] border border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.04] rounded-3xl transition-all duration-300 flex flex-col items-center justify-center gap-5 hover:border-primary/30 shadow-inner"
                    >
                        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-white/20 group-hover:text-primary transition-all duration-300 group-hover:bg-primary/5 group-hover:border-primary/20 hover:scale-105">
                            <PlusIcon className="w-6 h-6" />
                        </div>
                        <div className="text-center space-y-1">
                            <span className="font-bold text-sm text-white/40 group-hover:text-white transition-colors block uppercase tracking-tight">Add New Branch</span>
                            <span className="text-[9px] font-black text-white/10 uppercase tracking-[0.3em] block mt-1">Institutional Expansion</span>
                        </div>
                    </button>
                )}
            </div>

            {/* CONFIGURE NODE MODAL */}
            <AnimatePresence>
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 md:p-8" onClick={() => setIsCreateModalOpen(false)}>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/90 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98, y: 15 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-[#13141B] w-full max-w-4xl rounded-[32px] shadow-2xl border border-white/10 overflow-hidden flex flex-col relative z-10 max-h-[95vh] ring-1 ring-white/5"
                        >
                            <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                                <div>
                                    <h3 className="text-2xl font-black text-white tracking-tight uppercase italic text-white/90">Initialize <span className="text-white/20 not-italic">Node</span></h3>
                                    <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mt-1.5">Configure institutional campus identifier</p>
                                </div>
                                <button onClick={() => setIsCreateModalOpen(false)} className="p-3 rounded-xl hover:bg-white/5 text-white/20 hover:text-white transition-all border border-transparent hover:border-white/5">
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-8 overflow-y-auto custom-scrollbar flex-grow bg-black/20">
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
                title="Remove Branch"
                message={`Warning: Removing "${branchToDelete?.name}" will disconnect this campus from the central management network. This action is recorded and requires administrative clearance.`}
                confirmText="Confirm Removal"
                loading={false}
            />
        </div>
    );
};
