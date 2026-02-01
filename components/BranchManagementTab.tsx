import React, { useState, useEffect, useCallback } from 'react';
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
        <div
            onClick={onEdit}
            className="group relative bg-[#0a0a0b] border border-white/5 rounded-[24px] p-7 min-h-[400px] flex flex-col transition-all duration-200 ease-out hover:-translate-y-1 hover:ring-1 hover:ring-white/10 hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.5)] cursor-pointer"
        >
            {/* Header / Status */}
            <div className="flex justify-between items-start mb-10">
                <div className={`p-3.5 rounded-xl border transition-colors duration-200 ${isLinked ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-500' :
                        branch.is_main_branch ? 'bg-primary/5 border-primary/10 text-primary' :
                            'bg-white/5 border-white/5 text-white/20'
                    }`}>
                    <SchoolIcon className="w-5 h-5" />
                </div>

                <div className="flex flex-col items-end gap-1.5">
                    {isLinked ? (
                        <div className="px-2.5 py-1 rounded-full bg-emerald-500/5 text-emerald-500 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                            Node Active
                        </div>
                    ) : branch.is_main_branch ? (
                        <div className="px-2.5 py-1 rounded-full bg-primary/5 text-primary text-[9px] font-black uppercase tracking-wider">
                            Admin Node
                        </div>
                    ) : (
                        <div className="px-2.5 py-1 rounded-full bg-white/5 text-white/30 text-[9px] font-black uppercase tracking-wider">
                            Branch Node
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="space-y-2 mb-8">
                <h3 className="text-xl font-bold text-white tracking-tight leading-tight">{branch.name}</h3>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-white/30 truncate">
                    <LocationIcon className="w-3.5 h-3.5 opacity-30" />
                    {branch.city}, {branch.state}
                </div>
            </div>

            {/* Protocol Vault Section */}
            <div className="mt-auto bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
                {isActive ? (
                    <div className="space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Access Protocol</span>
                            <span className="text-[9px] font-bold text-amber-500/60 uppercase">Pending Link</span>
                        </div>
                        <div className="flex items-center gap-2 bg-black/40 p-3 rounded-xl border border-white/10">
                            <span className="flex-grow font-mono text-xs font-bold text-primary tracking-widest truncate">
                                {revealed ? invitation.code : '••••••••••••'}
                            </span>
                            <button onClick={() => setRevealed(!revealed)} className="p-1.5 text-white/20 hover:text-white/60 transition-colors">
                                {revealed ? <EyeOffIcon className="w-3.5 h-3.5" /> : <EyeIcon className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={handleCopy} className={`p-1.5 transition-colors ${copied ? 'text-emerald-500' : 'text-white/20 hover:text-white/60'}`}>
                                {copied ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                        <button onClick={onRevoke} className="w-full text-[9px] font-black text-red-500/40 hover:text-red-500 uppercase tracking-widest transition-colors">Revoke Key</button>
                    </div>
                ) : isLinked ? (
                    <div className="py-4 flex flex-col items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/5 flex items-center justify-center text-emerald-500/40 ring-1 ring-emerald-500/10">
                            <ShieldCheckIcon className="w-5 h-5" />
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-black text-white/80 uppercase tracking-widest">Protocol Secured</p>
                            <p className="text-[9px] text-white/20 font-medium mt-1">Institutional Data Sync Active</p>
                        </div>
                    </div>
                ) : (
                    <div className="py-2 flex flex-col items-center gap-4">
                        <button
                            onClick={e => { e.stopPropagation(); onGenerate(); }}
                            disabled={isGenerating}
                            className="bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                        >
                            {isGenerating ? <Spinner size="sm" /> : 'Provision Node'}
                        </button>
                        <span className="text-[8px] font-bold text-white/10 uppercase tracking-[0.3em]">Hardware ID Verified</span>
                    </div>
                )}
            </div>

            {/* Actions Footer */}
            <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button
                        onClick={e => { e.stopPropagation(); onDelete(); }}
                        className="p-2 text-white/20 hover:text-red-500 transition-colors"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-black text-white/20 uppercase tracking-widest">
                    Manage <EditIcon className="w-3.5 h-3.5" />
                </div>
            </div>
        </div>
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
        <div className="space-y-12 animate-in fade-in duration-300 pb-40">
            {/* HERO CARD - THE CONTROL HUB */}
            <div className="relative bg-[#0a0a0b] border border-white/10 rounded-[32px] p-10 md:p-12 shadow-xl overflow-hidden group/hero transition-all duration-300 hover:shadow-2xl">
                {/* Background Texture */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.02] to-transparent pointer-events-none" />
                <div className="absolute -right-20 -top-20 opacity-[0.03] pointer-events-none group-hover/hero:scale-110 transition-transform duration-1000 rotate-12">
                    <ShieldCheckIcon className="w-80 h-80 text-white" />
                </div>

                <div className="relative z-10 space-y-10">
                    <div className="space-y-4">
                        <h2 className="text-4xl md:text-5xl font-sans font-black text-white tracking-tight uppercase leading-none italic">
                            Institutional <span className="text-white/20 not-italic">Network</span>
                        </h2>
                        <p className="text-white/40 text-sm md:text-base font-medium max-w-2xl leading-relaxed border-l-2 border-white/5 pl-6">
                            Secure configuration and deployment of institutional nodes. Monitor synchronization status and manage cryptographic entry protocols for distributed campuses.
                        </p>
                    </div>

                    {/* Metric Chips Area */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="bg-white/5 px-4 py-2.5 rounded-xl border border-white/5 flex items-center gap-3">
                            <SchoolIcon className="w-3.5 h-3.5 text-primary opacity-60" />
                            <span className="text-white/20 text-[9px] font-black uppercase tracking-widest">Active Nodes:</span>
                            <span className="text-white text-xs font-bold leading-none">{branches.length}</span>
                        </div>
                        <div className="bg-white/5 px-4 py-2.5 rounded-xl border border-white/5 flex items-center gap-3">
                            <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500 opacity-60" />
                            <span className="text-white/20 text-[9px] font-black uppercase tracking-widest">Synced:</span>
                            <span className="text-white text-xs font-bold leading-none">{activeSyncs}</span>
                        </div>
                        <div className="bg-white/5 px-4 py-2.5 rounded-xl border border-white/5 flex items-center gap-3">
                            <ShieldCheckIcon className="w-3.5 h-3.5 text-white/20" />
                            <span className="text-white/10 text-[9px] font-black uppercase tracking-widest">Status:</span>
                            <span className="text-emerald-500 text-[9px] font-black uppercase tracking-widest">Protected</span>
                        </div>
                    </div>

                    {isHeadOfficeAdmin && (
                        <div className="pt-6">
                            <button
                                onClick={() => { setBranchToEdit(null); setIsCreateModalOpen(true); }}
                                className="w-full md:w-auto px-10 py-4 bg-primary text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg hover:shadow-primary/5 transition-all duration-200 transform active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                <PlusIcon className="w-5 h-5" />
                                Expand Network
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* SECONDARY ACTION BAR */}
            <div className="flex justify-between items-center px-4">
                <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Node Registry</span>
                <button className="flex items-center gap-3 text-white/30 hover:text-white transition-all group font-black text-[9px] uppercase tracking-widest">
                    Finalize Architecture
                    <CheckCircleIcon className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                </button>
            </div>

            {/* NODES GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
                        className="group relative h-full min-h-[400px] border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] rounded-[24px] transition-all duration-200 flex flex-col items-center justify-center gap-6 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:ring-1 hover:ring-white/10"
                    >
                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-white/10 group-hover:text-primary transition-all duration-200 group-hover:bg-primary/5 group-hover:border-primary/20">
                            <PlusIcon className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                            <span className="font-bold text-[9px] uppercase tracking-widest text-white/10 group-hover:text-primary transition-colors block mb-1">Available Slot</span>
                            <span className="font-bold text-xs uppercase tracking-wide text-white/30 group-hover:text-white transition-colors">Expand Network</span>
                        </div>
                    </button>
                )}
            </div>

            {/* CONFIGURE NODE MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-[300] flex items-center justify-center p-6 animate-in fade-in duration-200" onClick={() => setIsCreateModalOpen(false)}>
                    <div className="bg-[#0a0a0b] w-full max-w-4xl rounded-[24px] shadow-2xl border border-white/10 overflow-hidden flex flex-col mt-[-5vh] relative" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="px-7 py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <div>
                                <h3 className="text-xl font-bold text-white tracking-tight uppercase">Initialize Node</h3>
                                <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] mt-1">Configure Hardware Identity & Admin Access</p>
                            </div>
                            <button onClick={() => setIsCreateModalOpen(false)} className="p-2 rounded-full hover:bg-white/5 text-white/20 hover:text-white transition-all">
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                        {/* Modal Body */}
                        <div className="p-6 md:p-8 overflow-y-auto max-h-[75vh] custom-scrollbar">
                            <BranchCreationPage
                                hideHero
                                profile={branchToEdit ? undefined : (schoolProfile?.user_id ? { id: schoolProfile.user_id } as any : undefined)}
                                onNext={() => { setIsCreateModalOpen(false); onBranchUpdate(); }}
                            />
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={!!branchToDelete}
                onClose={() => setBranchToDelete(null)}
                onConfirm={handleDelete}
                title="Decommission Node"
                message={`Warning: You are about to decommission the "${branchToDelete?.name}" node. This action terminates all synchronized data pipelines for this campus.`}
                confirmText="Confirm Decommission"
                loading={false}
            />
        </div>
    );
};