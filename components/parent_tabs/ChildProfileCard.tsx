
import React from 'react';
import { AdmissionApplication } from '../../types';
import { DocumentTextIcon } from '../icons/DocumentTextIcon';
import { GraduationCapIcon } from '../icons/GraduationCapIcon';
import { EditIcon } from '../icons/EditIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { motion } from 'framer-motion';
import PremiumAvatar from '../common/PremiumAvatar';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';

interface ChildProfileCardProps {
    child: AdmissionApplication;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onEdit: () => void;
    onManageDocuments: () => void;
    onNavigateDashboard: () => void;
    index?: number;
}

const ChildProfileCard: React.FC<ChildProfileCardProps> = ({ child, onEdit, onManageDocuments, onNavigateDashboard }) => {
    const getProgress = () => {
        const s = child.status;
        if (s === 'Enrolled' || s === 'Approved') return 100;
        if (s === 'Verified') return 75;
        if (s === 'Pending Review') return 45;
        return 20;
    };

    const progress = getProgress();
    const isEnrolled = child.status === 'Enrolled';
    const isPending = !isEnrolled && child.status !== 'Approved';

    return (
        <div className="group relative bg-[#0d0e12] border border-white/5 rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] transition-all duration-700 hover:border-primary/30 hover:-translate-y-2 flex flex-col h-full overflow-hidden ring-1 ring-white/5">
            {/* Cinematic Background Glow */}
            <div className={`absolute -right-20 -top-20 w-64 h-64 blur-[100px] rounded-full transition-all duration-1000 opacity-20 group-hover:opacity-40 pointer-events-none ${isEnrolled ? 'bg-emerald-500' : 'bg-primary'}`}></div>

            <div className="p-8 pb-6 flex-grow relative z-10 space-y-8">
                <div className="flex items-center gap-6">
                    <div className="relative shrink-0">
                        <div className={`absolute -inset-2 rounded-2xl blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-1000 ${isEnrolled ? 'bg-emerald-500' : 'bg-primary'}`}></div>
                        <PremiumAvatar
                            src={child.profile_photo_url}
                            name={child.applicant_name}
                            size="sm"
                            className="shadow-2xl border-2 border-[#0d0e12] w-20 h-20 rounded-2xl"
                        />
                        <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-lg border-2 border-[#0d0e12] flex items-center justify-center shadow-lg z-20 ${isEnrolled ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-black'}`}>
                            {isEnrolled ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <div className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />}
                        </div>
                    </div>

                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[9px] font-black text-white/10 uppercase tracking-[0.4em]">Node Protocol</span>
                            <div className={`h-1 w-4 rounded-full ${isEnrolled ? 'bg-emerald-500' : 'bg-primary/40'}`} />
                        </div>
                        <h3 className="text-2xl font-serif font-black text-white tracking-tighter uppercase leading-tight truncate">
                            {child.applicant_name.split(' ')[0]} <span className="text-white/20 italic font-normal">{child.applicant_name.split(' ')[1] || ''}</span>
                        </h3>
                        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                            <GraduationCapIcon className="w-3 h-3 text-primary/40" />
                            {child.grade ? `Grade ${child.grade} Block` : 'Identity Provisioning'}
                        </p>
                    </div>
                </div>

                {/* Performance Metrics */}
                <div className="bg-white/[0.02] p-6 rounded-3xl border border-white/[0.03] shadow-inner relative overflow-hidden group/metric">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover/metric:opacity-100 transition-opacity duration-700" />

                    <div className="flex justify-between items-end mb-5 relative z-10">
                        <div className="space-y-1">
                            <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em]">Integrity Index</p>
                            <span className={`text-[11px] font-black tracking-widest uppercase flex items-center gap-2 ${isEnrolled ? 'text-emerald-500' : 'text-primary'}`}>
                                {child.status.replace(/_/g, ' ')}
                                {isEnrolled && <ShieldCheckIcon className="w-4 h-4" />}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className={`text-3xl font-serif font-black tracking-tighter ${isEnrolled ? 'text-emerald-500' : 'text-white'}`}>
                                {progress}<span className="text-[10px] opacity-20 ml-1">%</span>
                            </span>
                        </div>
                    </div>

                    <div className="h-1.5 w-full bg-white/[0.02] rounded-full overflow-hidden border border-white/[0.05] relative">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1.5, ease: [0.23, 1, 0.32, 1] }}
                            className={`h-full rounded-full relative ${isEnrolled ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]'}`}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]" />
                        </motion.div>
                    </div>
                </div>
            </div>

            <div className="px-8 pb-8 flex items-center justify-between gap-4 relative z-10">
                <button
                    onClick={onManageDocuments}
                    className="flex-1 h-14 flex items-center justify-center gap-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] transition-all group/btn active:scale-95"
                >
                    <DocumentTextIcon className="w-4 h-4 text-white/20 group-hover/btn:text-primary transition-colors" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 group-hover/btn:text-white">Vault</span>
                </button>

                <button
                    onClick={onNavigateDashboard}
                    disabled={!isEnrolled}
                    className={`flex-1 h-14 flex items-center justify-center gap-3 rounded-2xl border transition-all group/btn active:scale-95
                        ${isEnrolled ? 'bg-primary/10 border-primary/20 hover:bg-primary/20 cursor-pointer' : 'bg-white/[0.01] border-transparent cursor-not-allowed opacity-20'}`}
                >
                    <GraduationCapIcon className={`w-5 h-5 transition-colors ${isEnrolled ? 'text-primary' : 'text-white/20'}`} />
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isEnrolled ? 'text-white' : 'text-white/10'}`}>Portal</span>
                </button>

                <button
                    onClick={onEdit}
                    className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] transition-all group/btn active:scale-95"
                    title="Edit Node"
                >
                    <EditIcon className="w-5 h-5 text-white/20 group-hover/btn:text-white transition-colors" />
                </button>
            </div>
        </div>
    );
};

export default ChildProfileCard;
