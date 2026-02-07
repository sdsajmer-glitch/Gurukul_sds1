
import React from 'react';
import { AdmissionApplication } from '../../types';
import { DocumentTextIcon } from '../icons/DocumentTextIcon';
import { GraduationCapIcon } from '../icons/GraduationCapIcon';
import { EditIcon } from '../icons/EditIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import PremiumAvatar from '../common/PremiumAvatar';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import clsx from 'clsx';

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
        if (s === 'Enrolled') return 100;
        if (s === 'Approved') return 90;
        if (s === 'Verified') return 75;
        if (s === 'Pending Review') return 45;
        if (s === 'Registered') return 20;
        return 10;
    };

    const progress = getProgress();
    const isVerified = progress >= 90;
    const isEnrolled = child.status === 'Enrolled';

    const getStatusLabel = () => {
        const s = child.status?.toUpperCase();
        if (s === 'ENROLLED') return 'ENROLLED';
        if (s === 'REGISTERED') return 'ENQUIRY_RECEIVED';
        if (s === 'PENDING REVIEW') return 'UNDER_PROTOCOL_REVIEW';
        if (s === 'APPROVED') return 'ADMISSION_APPROVED';
        if (s === 'ENQUIRY') return 'ENQUIRY_CONTACTED';
        return s || 'IDENTITY_PENDING';
    };

    const statusLabel = getStatusLabel();

    return (
        <div className={clsx(
            "group relative bg-[#0c0e12] rounded-[2.5rem] transition-all duration-700 h-full flex flex-col overflow-hidden",
            "border border-white/5 hover:border-primary/30",
            "shadow-[0_4px_30px_rgba(0,0,0,0.5)] hover:shadow-primary/5 hover:-translate-y-2",
            "ring-1 ring-inset ring-white/[0.02]"
        )}>
            {/* Contextual Glow */}
            <div className={clsx(
                "absolute -top-20 -right-20 w-40 h-40 rounded-full blur-[80px] opacity-0 group-hover:opacity-10 transition-opacity duration-1000",
                isVerified ? "bg-emerald-500" : "bg-primary"
            )}></div>

            <div className="p-8 md:p-10 flex-grow relative z-10">
                {/* Identity Header */}
                <div className="flex items-start gap-6 mb-10">
                    <div className="relative shrink-0">
                        <div className={clsx(
                            "absolute -inset-2 rounded-full blur-xl opacity-0 group-hover:opacity-30 transition-all duration-1000 scale-75 group-hover:scale-110",
                            isVerified ? "bg-emerald-500" : "bg-primary"
                        )}></div>
                        <PremiumAvatar
                            src={child.profile_photo_url}
                            name={child.applicant_name}
                            size="md"
                            className="w-20 h-20 md:w-24 md:h-24 rounded-full ring-4 ring-[#0a0a0c] shadow-2xl relative z-10 grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700"
                        />
                    </div>

                    <div className="flex-1 min-w-0 pt-2">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em]">Node Protocol</span>
                            <div className={clsx(
                                "h-1.5 w-1.5 rounded-full",
                                isVerified ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-[#7c3aed] shadow-[0_0_8px_#7c3aed]"
                            )}></div>
                        </div>

                        <h3 className="text-3xl font-serif font-black text-white tracking-tight leading-none truncate mb-4 uppercase">
                            {child.applicant_name}
                        </h3>

                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">
                                {child.class_name ? child.class_name : `Grade ${child.grade} Block`}
                            </span>
                            <div className="flex">
                                <span className={clsx(
                                    "text-[8px] font-black px-3 py-1 rounded-lg border uppercase tracking-[0.2em]",
                                    isEnrolled
                                        ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/20"
                                        : "text-[#7c3aed] bg-[#7c3aed]/5 border-[#7c3aed]/20"
                                )}>
                                    {statusLabel}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Integrity & Compliance Section */}
                <div className="bg-black/60 p-7 rounded-[2.5rem] border border-white/5 relative overflow-hidden group/meta shadow-inner">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover/meta:opacity-100 transition-opacity"></div>

                    <div className="flex justify-between items-end mb-6 relative z-10">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em] leading-none">Integrity Index</p>
                                <ShieldCheckIcon className="w-3.5 h-3.5 text-white/10" />
                            </div>
                            <p className="text-[11px] text-white/40 font-medium italic tracking-tight">
                                {isEnrolled ? "Verified Institutional Asset" : "Node alignment in progress..."}
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="flex items-baseline justify-end">
                                <span className={clsx(
                                    "text-4xl font-serif font-black tracking-tighter leading-none",
                                    isVerified ? "text-emerald-500" : "text-white/90"
                                )}>
                                    {progress}
                                </span>
                                <span className="text-[12px] font-black text-white/20 ml-1">%</span>
                            </div>
                        </div>
                    </div>

                    <div className="relative h-2 w-full bg-white/[0.03] rounded-full overflow-hidden p-[1px] border border-white/5 z-10">
                        <div
                            className={clsx(
                                "h-full rounded-full transition-all duration-[2000ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
                                isVerified ? "bg-emerald-500 shadow-[0_0_15px_#10b981]" : "bg-[#7c3aed] shadow-[0_0_15px_#7c3aed]"
                            )}
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Action Matrix */}
            <div className="px-8 md:px-10 pb-10 flex items-center justify-between gap-4 relative z-10">
                <button
                    onClick={onManageDocuments}
                    className="flex-1 h-16 flex flex-col items-center justify-center gap-1 rounded-2xl bg-black/40 hover:bg-black/60 border border-white/5 transition-all group/btn active:scale-95"
                >
                    <DocumentTextIcon className="w-4 h-4 text-white/20 group-hover/btn:text-white transition-all duration-500" />
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 group-hover/btn:text-white">vault.</span>
                </button>

                <button
                    onClick={onNavigateDashboard}
                    disabled={!isEnrolled}
                    className={clsx(
                        "flex-1 h-16 flex flex-col items-center justify-center gap-1 rounded-2xl border transition-all group/btn active:scale-95",
                        isEnrolled
                            ? "bg-black/40 hover:bg-black/60 border-white/5 cursor-pointer"
                            : "bg-black/20 border-transparent cursor-not-allowed opacity-20"
                    )}
                >
                    <GraduationCapIcon className={clsx(
                        "w-4 h-4 transition-all duration-500",
                        isEnrolled ? "text-white/20 group-hover/btn:text-white" : "text-white/5"
                    )} />
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 group-hover/btn:text-white">portal.</span>
                </button>

                <button
                    onClick={onEdit}
                    className="w-16 h-16 flex items-center justify-center rounded-2xl bg-black/40 hover:bg-black/60 border border-white/5 transition-all group/btn active:scale-95"
                >
                    <EditIcon className="w-4 h-4 text-white/10 group-hover/btn:text-white transition-all duration-500" />
                </button>
            </div>
        </div>
    );
};

export default ChildProfileCard;
