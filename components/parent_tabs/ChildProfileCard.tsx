import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AdmissionApplication } from '../../types';
import { DocumentTextIcon } from '../icons/DocumentTextIcon';
import { GraduationCapIcon } from '../icons/GraduationCapIcon';
import { EditIcon } from '../icons/EditIcon';
import { CreditCardIcon } from '../icons/CreditCardIcon';
import PremiumAvatar from '../common/PremiumAvatar';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import Tooltip from '../common/Tooltip';
import clsx from 'clsx';
import { motion } from 'framer-motion';

interface ChildProfileCardProps {
    child: AdmissionApplication;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onEdit: () => void;
    onManageDocuments: () => void;
    onViewFinance?: () => void;
    onNavigateDashboard: () => void;
    index?: number;
}

const ChildProfileCard: React.FC<ChildProfileCardProps> = ({ child, onEdit, onManageDocuments, onViewFinance, onNavigateDashboard }) => {
    const navigate = useNavigate();

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
        if (s === 'ENROLLED') return 'Enrolled';
        if (s === 'REGISTERED') return 'Enquiry Sent';
        if (s === 'PENDING REVIEW') return 'Under Review';
        if (s === 'APPROVED') return 'Approved';
        if (s === 'ENQUIRY') return 'Enquiry';
        return s || 'Pending';
    };

    const statusLabel = getStatusLabel();

    const getStatusColor = () => {
        if (isEnrolled) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
        if (child.status === 'Approved') return "text-blue-400 bg-blue-500/10 border-blue-500/20";
        if (child.status === 'Rejected') return "text-red-400 bg-red-500/10 border-red-500/20";
        return "text-purple-400 bg-purple-500/10 border-purple-500/20";
    };

    const handlePortalClick = () => {
        if (!isEnrolled) return;
        navigate('/student'); // Correct route for student portal based on context
    };

    return (
        <motion.div
            whileHover={{ y: -5 }}
            className={clsx(
                "group relative bg-[#0c0e12] rounded-[2rem] transition-all duration-500 h-full flex flex-col overflow-hidden",
                "border border-white/5 hover:border-primary/30",
                "shadow-lg hover:shadow-primary/5",
                "ring-1 ring-inset ring-white/[0.02]"
            )}
        >
            {/* Contextual Glow */}
            <div className={clsx(
                "absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[100px] opacity-0 group-hover:opacity-20 transition-opacity duration-1000 pointer-events-none",
                isVerified ? "bg-emerald-500" : "bg-primary"
            )}></div>

            <div className="p-6 md:p-8 flex-grow relative z-10 flex flex-col">
                {/* Header Section */}
                <div className="flex items-start justify-between mb-6">
                    <div className="relative group/avatar">
                        <div className={clsx(
                            "absolute -inset-1 rounded-full blur-md opacity-0 group-hover/avatar:opacity-40 transition-all duration-700",
                            isVerified ? "bg-emerald-500" : "bg-primary"
                        )}></div>
                        <PremiumAvatar
                            src={child.profile_photo_url}
                            name={child.applicant_name}
                            size="md"
                            className="w-16 h-16 md:w-20 md:h-20 rounded-full ring-2 ring-[#0a0a0c] shadow-xl relative z-10 transition-transform duration-500 group-hover/avatar:scale-105"
                        />
                        <div className={clsx(
                            "absolute bottom-0 right-0 h-5 w-5 rounded-full border-2 border-[#0c0e12] z-20 flex items-center justify-center",
                            isVerified ? "bg-emerald-500" : "bg-amber-500"
                        )}>
                            {isVerified && <CheckCircleIcon className="w-3 h-3 text-black" />}
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        <span className={clsx(
                            "text-[10px] font-bold px-3 py-1 rounded-full border uppercase tracking-wider mb-1",
                            getStatusColor()
                        )}>
                            {statusLabel}
                        </span>
                        {child.student_id_number && (
                            <span className="text-[10px] font-mono text-white/40 tracking-wider">
                                {child.student_id_number}
                            </span>
                        )}
                    </div>
                </div>

                {/* Identity Info */}
                <div className="mb-6">
                    <h3 className="text-xl md:text-2xl font-serif font-bold text-white tracking-tight text-shadow-sm mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                        {child.applicant_name}
                    </h3>

                    <div className="flex flex-col gap-0.5 mb-4">
                        <p className="text-sm font-medium text-white/60">
                            {child.class_name ? child.class_name : `Grade ${child.grade}`}
                        </p>
                        {child.school_name && (
                            <p className="text-xs text-white/30 uppercase tracking-wide truncate max-w-[200px]">
                                {child.school_name}
                            </p>
                        )}
                    </div>

                    {/* Profile Completion Bar */}
                    <div className="space-y-1.5 mt-auto">
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] uppercase tracking-wider text-white/30 font-bold">Profile Completion</span>
                            <span className={clsx("text-xs font-bold", isVerified ? "text-emerald-400" : "text-primary")}>{progress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                className={clsx("h-full rounded-full", isVerified ? "bg-emerald-500" : "bg-primary")}
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                            />
                        </div>
                    </div>
                </div>

                {/* Actions Footer */}
                <div className="mt-auto grid grid-cols-4 gap-2 border-t border-white/5 pt-6">
                    <span className="text-[9px] font-bold uppercase tracking-wider">Documents</span>

                    <Tooltip content="Financial Status & Fees">
                        <button
                            onClick={onViewFinance}
                            className="w-full h-full flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] hover:text-white text-white/40 transition-all active:scale-95 group/btn"
                        >
                            <CreditCardIcon className="w-5 h-5 group-hover/btn:text-emerald-400 transition-colors" />
                            <span className="text-[9px] font-bold uppercase tracking-wider">Fees</span>
                        </button>
                    </Tooltip>

                    <Tooltip content={isEnrolled ? "Access Student Portal" : "Enrollment Required for Portal Access"}>
                        <div className="relative w-full h-full"> {/* Wrapper for tooltip on disabled button */}
                            <button
                                onClick={handlePortalClick}
                                disabled={!isEnrolled}
                                className={clsx(
                                    "w-full h-full flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all active:scale-95 group/btn border",
                                    isEnrolled
                                        ? "bg-primary/10 border-primary/20 hover:bg-primary/20 text-primary hover:text-white cursor-pointer"
                                        : "bg-white/[0.02] border-transparent text-white/10 cursor-not-allowed opacity-50"
                                )}
                            >
                                <GraduationCapIcon className={clsx("w-5 h-5", isEnrolled ? "group-hover/btn:text-white" : "opacity-50")} />
                                <span className="text-[9px] font-bold uppercase tracking-wider">Portal</span>
                            </button>
                        </div>
                    </Tooltip>

                    <Tooltip content="Edit Personal Details">
                        <button
                            onClick={onEdit}
                            className="w-full h-full flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] hover:text-white text-white/40 transition-all active:scale-95 group/btn"
                        >
                            <EditIcon className="w-5 h-5 group-hover/btn:text-amber-400 transition-colors" />
                            <span className="text-[9px] font-bold uppercase tracking-wider">Edit</span>
                        </button>
                    </Tooltip>
                </div>
            </div>
        </motion.div>
    );
};

export default ChildProfileCard;
