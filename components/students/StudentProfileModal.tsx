
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase, formatError } from '../../services/supabase';
import { StudentForAdmin, SchoolClass, Course, SchoolAdminProfileData } from '../../types';
import Spinner from '../common/Spinner';
import { XIcon } from '../icons/XIcon';
import { UserIcon } from '../icons/UserIcon';
import { MailIcon } from '../icons/MailIcon';
import { PhoneIcon } from '../icons/PhoneIcon';
import { GraduationCapIcon } from '../icons/GraduationCapIcon';
import { FileTextIcon } from '../icons/FileTextIcon';
import { CreditCardIcon } from '../icons/CreditCardIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { EditIcon } from '../icons/EditIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { SchoolIcon } from '../icons/SchoolIcon';
import { ChartBarIcon } from '../icons/ChartBarIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { LocationIcon } from '../icons/LocationIcon';
import { BookIcon } from '../icons/BookIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { PrinterIcon } from '../icons/PrinterIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { InfoIcon } from '../icons/InfoIcon';
import { SettingsIcon } from '../icons/SettingsIcon';
import { MenuIcon } from '../icons/MenuIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { EyeIcon } from '../icons/EyeIcon';
import { LockIcon } from '../icons/LockIcon';
import { KeyIcon } from '../icons/KeyIcon';
import { RefreshIcon } from '../icons/RefreshIcon';
import { XCircleIcon } from '../icons/XCircleIcon';
import { ReceiptIcon } from '../icons/ReceiptIcon';
import { DollarSignIcon } from '../icons/DollarSignIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { ArrowRightIcon } from '../icons/ArrowRightIcon';
import { TeacherIcon } from '../icons/TeacherIcon';
import CustomSelect from '../common/CustomSelect';
import RecordPaymentModal from '../finance/RecordPaymentModal';
import { StorageService, BUCKETS } from '../../services/storage';
import PremiumAvatar from '../common/PremiumAvatar';
import { CopyIcon } from '../icons/CopyIcon';
import EditStudentDetailsModal from './EditStudentDetailsModal';

interface StudentProfileModalProps {
    student: StudentForAdmin;
    onClose: () => void;
    onUpdate: () => void;
    initialTab?: TabType;
}

type TabType = 'overview' | 'parents' | 'academic' | 'documents' | 'fees' | 'history';
type LifecycleStatus = 'REGISTERED' | 'VERIFIED' | 'PLACEMENT_PENDING' | 'ACTIVE' | 'ARCHIVED';

// --- SUB-COMPONENTS ---

const TabButton: React.FC<{
    id: TabType;
    label: string;
    icon: React.ReactNode;
    active: boolean;
    onClick: (id: TabType) => void;
}> = ({ id, label, icon, active, onClick }) => (
    <button
        onClick={() => onClick(id)}
        className={`
            w-full flex items-center gap-4 px-6 py-4 rounded-xl 
            transition-all duration-300 group relative overflow-hidden
            ${active
                ? 'bg-indigo-500/10 text-white shadow-[0_0_20px_-5px_rgba(99,102,241,0.3)] border border-indigo-500/30'
                : 'text-white/40 hover:text-white/90 hover:bg-white/5 border border-transparent hover:border-white/5'
            }
        `}
        aria-current={active ? 'page' : undefined}
    >
        {/* Active Indicator & Glow */}
        {active && (
            <>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-indigo-500 rounded-r-lg shadow-[0_0_15px_rgba(99,102,241,0.8)]"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent pointer-events-none" />
            </>
        )}

        {/* Icon Container */}
        <div className={`
            relative z-10 p-1 transition-all duration-300
            ${active ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)] scale-110' : 'text-white/40 group-hover:text-white group-hover:scale-110'}
        `}>
            {icon}
        </div>

        {/* Label */}
        <span className={`
            relative z-10 text-xs font-black tracking-[0.15em] uppercase transition-all duration-300
            ${active ? 'text-white translate-x-1' : 'text-white/50 group-hover:text-white group-hover:translate-x-1'}
        `}>
            {label}
        </span>

        {/* Hover Shine Effect */}
        {!active && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
        )}
    </button>
);

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0
    }).format(amount || 0);
};

const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copied to clipboard`);
};

// Fix: Added missing InfoRow component for profile detail rendering.
const InfoRow: React.FC<{ label: string; value: string | null | undefined; icon: React.ReactNode; onEdit?: () => void }> = ({ label, value, icon, onEdit }) => (
    <div
        className={`flex items-center gap-5 py-5 border-b border-white/5 last:border-0 group transition-all rounded-2xl relative overflow-hidden px-4 ${onEdit ? 'cursor-pointer hover:bg-white/5' : ''}`}
        onClick={onEdit}
    >
        <div className="absolute inset-0 bg-indigo-500/5 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500"></div>
        <div className="p-3 bg-white/5 rounded-xl text-white/40 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-all duration-500 group-hover:scale-110 relative z-10 border border-white/5 group-hover:border-indigo-500/20">
            {icon}
        </div>
        <div className="relative z-10 flex-grow">
            <p className="text-[9px] font-black uppercase text-white/30 tracking-[0.2em] mb-1 group-hover:text-indigo-400/50 transition-colors">{label}</p>
            <div className="flex items-center gap-3">
                <p className={`text-sm font-bold tracking-tight ${!value || value === '—' ? 'text-white/20' : 'text-white'}`}>
                    {value || '—'}
                </p>
                {onEdit && (!value || value === '—') && (
                    <span className="text-[9px] font-black text-indigo-400/40 uppercase tracking-widest bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity">
                        Fix Protocol
                    </span>
                )}
            </div>
        </div>
        {onEdit && (
            <div className="relative z-10 opacity-0 group-hover:opacity-40 transition-opacity">
                <ChevronRightIcon className="w-4 h-4 text-white" />
            </div>
        )}
    </div>
);

// Fix: Added missing DigitalIdCard component to visualize student identity node.
const DigitalIdCard: React.FC<{ student: StudentForAdmin; onNavigate?: (tab: TabType) => void }> = ({ student, onNavigate }) => (
    <div className="relative group overflow-hidden rounded-[2.5rem] bg-[#0c0e12] border border-white/10 transition-all duration-500 hover:shadow-[0_0_40px_-10px_rgba(99,102,241,0.3)] hover:border-indigo-500/30">
        {/* Holographic Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-700"></div>

        {/* Animated Grid / Scanlines */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
        <div className="absolute top-0 right-0 w-full h-full bg-[linear-gradient(transparent_0%,rgba(99,102,241,0.05)_50%,transparent_100%)] bg-[length:100%_4px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

        {/* Floating Logo Watermark */}
        <div className="absolute -top-10 -right-10 p-10 opacity-[0.05] group-hover:opacity-[0.1] group-hover:rotate-12 transition-all duration-1000">
            <SchoolIcon className="w-64 h-64 text-indigo-100" />
        </div>

        <div className="relative z-10 p-8 space-y-8">
            <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <span className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_10px_#6366f1]"></span>
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Digital Identity Node</span>
                </span>
                <ShieldCheckIcon className="w-5 h-5 text-indigo-500 opacity-60 drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
            </div>

            <div className="flex items-center gap-8">
                <div className="relative shrink-0">
                    <PremiumAvatar
                        src={student.profile_photo_url}
                        name={student.display_name}
                        size="md"
                        className="rounded-2xl border-2 border-indigo-500/30 p-1 shadow-2xl shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow duration-500"
                    />
                    <div className="absolute -bottom-2 -right-2 bg-[#0c0e12] p-1.5 rounded-full border border-white/10">
                        <CheckCircleIcon className="w-5 h-5 text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)] rounded-full" />
                    </div>
                </div>

                <div className="space-y-2">
                    <h4 className="text-3xl font-black text-white uppercase tracking-tight leading-none group-hover:text-indigo-100 transition-colors">
                        {student.display_name}
                    </h4>
                    <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-white/50 tracking-wider">
                            UID: {student.student_id_number || 'PENDING'}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-mono text-indigo-300 tracking-wider">
                            STUDENT
                        </span>
                    </div>
                </div>
            </div>

            <div className="pt-6 grid grid-cols-2 gap-8">
                <div className="space-y-1.5">
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.25em]">Temporal Block</p>
                    <p className="text-sm font-bold text-white/80 uppercase font-mono">Session 2024-25</p>
                </div>
                <div className="space-y-1.5 text-right">
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.25em]">Registry Node</p>
                    {student.assigned_class_name ? (
                        <p className="text-sm font-bold text-white/80 uppercase tracking-tight">{student.assigned_class_name}</p>
                    ) : (
                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                            Placement Required
                        </span>
                    )}
                </div>
            </div>
        </div>

        {/* Bottom Bar Gradient */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-50"></div>
    </div>
);

// Fix: Added missing CoreInfoCard component for key academic metrics.
const CoreInfoCard: React.FC<{ label: string; value?: string | null; icon: React.ReactNode }> = ({ label, value, icon }) => (
    <div className="p-6 bg-[#0c0e12] border border-white/5 rounded-[2rem] flex items-center gap-5 group hover:border-indigo-500/30 transition-all shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="p-3.5 bg-indigo-500/10 rounded-2xl text-indigo-400 group-hover:scale-110 group-hover:rotate-6 transition-transform shadow-inner border border-indigo-500/20 relative z-10">
            {icon}
        </div>
        <div className="relative z-10">
            <p className="text-[10px] font-black uppercase text-white/30 tracking-[0.25em] mb-1 group-hover:text-indigo-400/50 transition-colors">{label}</p>
            <p className="text-xl font-black text-white tracking-tight leading-none">{value || 'Standby'}</p>
        </div>
    </div>
);

const DocumentCard: React.FC<{
    doc: any,
    onVerify: (id: number) => void,
    onReject: (id: number) => void,
    onView: (path: string) => void
}> = ({
    doc,
    onVerify,
    onReject,
    onView
}) => {
        const status = doc.status || 'Pending';
        const file = doc.admission_documents?.[0];

        const getStatusStyle = (s: string) => {
            switch (s) {
                case 'Verified': return 'text-accent-success bg-accent-success/5 border-accent-success/10 shadow-[0_0_15px_rgba(var(--accent-success),0.1)]';
                case 'Submitted': return 'text-accent-info bg-accent-info/5 border-accent-info/10';
                case 'Rejected': return 'text-accent-error bg-accent-error/5 border-accent-error/10';
                default: return 'text-accent-warning bg-accent-warning/5 border-accent-warning/10';
            }
        };

        return (
            <div className="group relative bg-card border border-border/40 rounded-3xl p-6 hover:border-primary/30 transition-all duration-500 hover:shadow-2xl hover:shadow-black/20 flex flex-col h-full overflow-hidden">
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none transition-opacity group-hover:opacity-100 ${status === 'Verified' ? 'from-emerald-500/10' : 'from-blue-500/10'}`}></div>

                <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="p-3 rounded-xl bg-[#1a1d23] text-white/50 group-hover:text-white group-hover:bg-[#252830] transition-colors border border-white/5 shadow-inner">
                        <FileTextIcon className="w-6 h-6" />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${getStatusStyle(status)} backdrop-blur-sm`}>
                        {status}
                    </span>
                </div>

                <div className="flex-grow relative z-10">
                    <h4 className="font-bold text-white text-sm line-clamp-1 leading-relaxed" title={doc.document_name}>{doc.document_name}</h4>
                    {file ? (
                        <p className="text-[11px] text-white/40 mt-1 font-mono flex items-center gap-1.5">
                            <ClockIcon className="w-3.5 h-3.5" /> {new Date(file.uploaded_at).toLocaleDateString()}
                        </p>
                    ) : (
                        <p className="text-[11px] text-white/20 mt-1 italic">Pending Upload</p>
                    )}
                    {doc.rejection_reason && (
                        <p className="text-[10px] text-red-400 mt-2 bg-red-500/5 border border-red-500/10 p-2 rounded-lg">
                            Reason: {doc.rejection_reason}
                        </p>
                    )}
                </div>

                {file && (
                    <div className="mt-5 pt-4 border-t border-white/5 flex items-center gap-2 relative z-10">
                        <button
                            onClick={() => onView(file.storage_path)}
                            className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white transition-all flex items-center justify-center gap-2 border border-transparent hover:border-white/10"
                        >
                            <EyeIcon className="w-3.5 h-3.5" /> View
                        </button>

                        {status !== 'Verified' && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onVerify(doc.id)}
                                    className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all hover:scale-105 active:scale-95"
                                    title="Verify Document"
                                >
                                    <CheckCircleIcon className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onReject(doc.id)}
                                    className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 transition-all hover:scale-105 active:scale-95"
                                    title="Reject Document"
                                >
                                    <XCircleIcon className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

const GuardianCard: React.FC<{
    title: string;
    data: any;
    isPrimary?: boolean;
    onEdit: () => void;
    readOnly?: boolean;
}> = ({ title, data, isPrimary, onEdit, readOnly }) => (
    <div className={`
        relative overflow-hidden group flex flex-col h-full
        rounded-[2.5rem] p-8 
        transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
        ${isPrimary
            ? 'bg-gradient-to-br from-[#1a1d28] to-[#13151b] border-2 border-indigo-500/20 shadow-2xl shadow-indigo-500/10'
            : 'bg-[#13151b] border border-white/10 shadow-xl'
        }
        hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]
        ${isPrimary ? 'hover:border-indigo-500/40 hover:-translate-y-1' : 'hover:border-white/20 hover:-translate-y-1'}
    `}>
        {/* Subtle Background Glow */}
        <div className={`absolute -top-24 -right-24 w-64 h-64 blur-[100px] pointer-events-none transition-opacity duration-700 opacity-0 group-hover:opacity-20 ${isPrimary ? 'bg-indigo-500' : 'bg-white'}`}></div>

        {/* Header Section */}
        <div className="flex justify-between items-start mb-8 z-10 relative">
            <div className="flex items-center gap-4">
                <div className={`
                    p-4 rounded-[1.25rem] transition-all duration-500
                    ${isPrimary
                        ? 'bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20 group-hover:bg-indigo-500/20'
                        : 'bg-white/5 text-white/40 ring-1 ring-white/10 group-hover:bg-white/10'
                    }
                    group-hover:scale-110 group-hover:rotate-3
                `}>
                    <UsersIcon className="w-6 h-6" />
                </div>
                <div>
                    <div className="flex items-center gap-2.5">
                        <h4 className="font-bold text-white text-lg tracking-tight">{title}</h4>
                        {isPrimary && (
                            <span className="px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 text-[9px] font-black uppercase tracking-[0.2em] rounded-lg border border-indigo-500/20">
                                Primary
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${data ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-red-400/50'}`}></div>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${data ? (data.is_unlinked ? 'text-amber-500' : 'text-emerald-400/80') : 'text-red-500/60'}`}>
                            {data ? (data.is_unlinked ? 'Draft Profile' : 'Verified Identity') : 'Not Linked'}
                        </p>
                    </div>
                </div>
            </div>
            {data && !readOnly && (
                <button
                    onClick={onEdit}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-white/40 hover:text-white transition-all duration-300 hover:scale-110 active:scale-90 ring-1 ring-white/10 shadow-lg"
                    aria-label={`Edit ${title}`}
                >
                    <EditIcon className="w-4 h-4" />
                </button>
            )}
        </div>

        {/* Registry Source Badge */}
        {data && data.is_unlinked && (
            <div className="absolute top-8 right-24 animate-in fade-in slide-in-from-right-4 duration-700 z-20">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 shadow-lg shadow-amber-500/5">
                    <div className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-[7px] font-black text-amber-500 uppercase tracking-widest whitespace-nowrap">
                        Registry: Admission
                    </span>
                </div>
            </div>
        )}

        {/* Content Section */}
        {data ? (
            <div className="space-y-8 relative z-10 flex-grow">
                {/* Full Name */}
                <div className="group/item">
                    <p className="text-[9px] font-black uppercase text-white/20 tracking-[0.25em] mb-2 group-hover/item:text-indigo-400/50 transition-colors">Legal Identity</p>
                    <p className="text-lg font-bold text-white leading-tight tracking-tight">{data.name}</p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <div className="group/item">
                        <p className="text-[9px] font-black uppercase text-white/20 tracking-[0.25em] mb-2 group-hover/item:text-indigo-400/50 transition-colors">Relationship Status</p>
                        <div className="inline-flex items-center px-3 py-1.5 bg-white/5 text-white/80 text-[11px] font-bold rounded-[0.75rem] border border-white/10 group-hover:border-white/20 transition-all">
                            {data.relationship || 'Guardian'}
                        </div>
                    </div>

                    <div className="group/item">
                        <p className="text-[9px] font-black uppercase text-white/20 tracking-[0.25em] mb-3 group-hover/item:text-indigo-400/50 transition-colors">Digital Contact Protocols</p>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3.5 group/contact cursor-pointer">
                                <div className="p-2 bg-white/5 rounded-xl text-white/30 group-hover/contact:bg-indigo-500/10 group-hover/contact:text-indigo-400 transition-all border border-white/5">
                                    <MailIcon className="w-4 h-4" />
                                </div>
                                <p className="text-sm text-white/60 font-medium group-hover/contact:text-white transition-colors uppercase tracking-tight">{data.email || 'PROTOCOL_MISSING'}</p>
                            </div>
                            <div className="flex items-center gap-3.5 group/contact cursor-pointer">
                                <div className="p-2 bg-white/5 rounded-xl text-white/30 group-hover/contact:bg-indigo-500/10 group-hover/contact:text-indigo-400 transition-all border border-white/5">
                                    <PhoneIcon className="w-4 h-4" />
                                </div>
                                <p className="text-sm text-white/60 font-medium group-hover/contact:text-white transition-colors">{data.phone || 'COMMS_NODE_OFFLINE'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Enhanced Address View */}
                    {(data.address || data.city) && (
                        <div className="group/item pt-4 border-t border-white/5">
                            <p className="text-[9px] font-black uppercase text-white/20 tracking-[0.25em] mb-3 group-hover/item:text-indigo-400/50 transition-colors">Residential Address</p>
                            <div className="flex items-start gap-3.5">
                                <div className="p-2 bg-white/5 rounded-xl text-white/30 border border-white/5 mt-0.5">
                                    <LocationIcon className="w-4 h-4" />
                                </div>
                                <p className="text-xs text-white/50 leading-relaxed font-medium">
                                    {data.address}
                                    {data.city && `, ${data.city}`}
                                    {data.state && `, ${data.state}`}
                                    {data.pin_code && ` - ${data.pin_code}`}
                                </p>
                            </div>
                        </div>
                    )}
                </div >
            </div >
        ) : (
            /* Premium Empty State - Institutional Design */
            <div className="flex-grow flex flex-col items-center justify-center text-center py-12 px-6 relative z-10">
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-white/5 rounded-full blur-3xl opacity-20 animate-pulse"></div>
                    <div className="relative p-8 bg-white/5 rounded-[2.5rem] border border-white/10 group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 shadow-2xl">
                        <UsersIcon className="w-16 h-16 text-white/10 group-hover:text-white/30 transition-colors" />
                    </div>
                </div>
                <h5 className="text-xl font-black text-white/60 mb-3 tracking-tight">No Guardian Linked</h5>
                <p className="text-[11px] text-white/30 leading-relaxed max-w-[240px] mb-10 font-bold uppercase tracking-wider">
                    {isPrimary
                        ? 'Initialize primary contact protocols to enable emergency broadcasting and academic node updates.'
                        : 'Add a secondary guardian for redundant contact links and improved institutional safety.'
                    }
                </p>
                {!readOnly && (
                    <button
                        onClick={onEdit}
                        className={`
                            px-10 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.25em]
                            transition-all duration-500 hover:scale-105 active:scale-95
                            flex items-center gap-4 group/btn relative overflow-hidden
                            ${isPrimary
                                ? 'bg-indigo-600 text-white shadow-[0_15px_40px_-10px_rgba(79,70,229,0.5)]'
                                : 'bg-white/5 text-white/80 border border-white/10 hover:bg-white/10 shadow-xl'
                            }
                        `}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000"></div>
                        <PlusIcon className="w-4 h-4 text-indigo-400" />
                        Initialize Link
                    </button>
                )}
            </div>
        )}

        {/* Interaction Indicator */}
        <div className="absolute bottom-4 right-8 opacity-0 group-hover:opacity-40 transition-opacity duration-500">
            <ChevronRightIcon className="w-4 h-4 text-white" />
        </div>
    </div >
);

const GuardianEditModal: React.FC<{
    type: 'primary' | 'secondary';
    initialData: any;
    parentId?: string;
    onClose: () => void;
    onSave: () => void;
}> = ({ type, initialData, parentId, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        email: initialData?.email || '',
        phone: initialData?.phone || '',
        relationship: initialData?.relationship || '',
        address: initialData?.address || '',
        city: initialData?.city || '',
        state: initialData?.state || '',
        pin_code: initialData?.pin_code || ''
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (type === 'primary' && parentId) {
                // Update Profile
                const { error: pError } = await supabase.from('profiles').update({
                    display_name: formData.name,
                    email: formData.email,
                    phone: formData.phone
                }).eq('id', parentId);
                if (pError) throw pError;

                // Update Parent Profile (including shared address)
                const { error: ppError } = await supabase.from('parent_profiles').update({
                    relationship_to_student: formData.relationship,
                    address: formData.address,
                    city: formData.city,
                    state: formData.state,
                    pin_code: formData.pin_code
                }).eq('user_id', parentId);
                if (ppError) throw ppError;

            } else if (type === 'secondary' && parentId) {
                // Update Secondary Fields (plus shared address if modified)
                const { error } = await supabase.from('parent_profiles').update({
                    secondary_parent_name: formData.name,
                    secondary_parent_email: formData.email,
                    secondary_parent_phone: formData.phone,
                    secondary_parent_relationship: formData.relationship,
                    address: formData.address,
                    city: formData.city,
                    state: formData.state,
                    pin_code: formData.pin_code
                }).eq('user_id', parentId);
                if (error) throw error;
            }
            onSave();
        } catch (err: any) {
            alert("Error updating guardian: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={onClose}>
            <div
                className="bg-[#0f1115] w-full max-w-2xl rounded-[3rem] shadow-2xl border border-white/10 p-12 relative overflow-hidden group"
                onClick={e => e.stopPropagation()}
            >
                {/* Decorative Background Element */}
                <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none transition-opacity duration-500 group-hover:opacity-[0.05]">
                    <UsersIcon className="w-56 h-56" />
                </div>
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>

                {/* Header */}
                <div className="flex justify-between items-start mb-12 relative z-10">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                                <EditIcon className="w-5 h-5" />
                            </div>
                            <h3 className="font-black text-2xl text-white tracking-tight uppercase">
                                {type === 'primary' ? 'Primary' : 'Secondary'} Guardian Registry
                            </h3>
                        </div>
                        <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.2em] ml-1">
                            Update spatial registry and contact protocols
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all duration-300 hover:rotate-90 border border-white/5"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-8 relative z-10 max-h-[60vh] overflow-y-auto custom-scrollbar pr-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2 group/field">
                            <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] ml-2 group-focus-within/field:text-indigo-400 transition-colors">
                                Legal Full Name
                            </label>
                            <input
                                className="w-full px-6 py-5 rounded-[1.5rem] border border-white/5 bg-[#16181d] text-sm text-white placeholder-white/10 focus:border-indigo-500/30 focus:bg-[#1a1d24] focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all duration-300 font-bold shadow-inner"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Dr. Rajesh Kumar"
                                required
                            />
                        </div>

                        <div className="space-y-2 group/field">
                            <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] ml-2 group-focus-within/field:text-indigo-400 transition-colors">
                                Relationship Node
                            </label>
                            <input
                                className="w-full px-6 py-5 rounded-[1.5rem] border border-white/5 bg-[#16181d] text-sm text-white placeholder-white/10 focus:border-indigo-500/30 focus:bg-[#1a1d24] focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all duration-300 font-bold shadow-inner"
                                value={formData.relationship}
                                onChange={e => setFormData({ ...formData, relationship: e.target.value })}
                                placeholder="e.g. Father"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2 group/field">
                            <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] ml-2 group-focus-within/field:text-indigo-400 transition-colors">
                                Communication Email
                            </label>
                            <input
                                className="w-full px-6 py-5 rounded-[1.5rem] border border-white/5 bg-[#16181d] text-sm text-white placeholder-white/10 focus:border-indigo-500/30 focus:bg-[#1a1d24] focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all duration-300 font-bold shadow-inner"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                placeholder="name@example.com"
                                type="email"
                            />
                        </div>
                        <div className="space-y-2 group/field">
                            <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] ml-2 group-focus-within/field:text-indigo-400 transition-colors">
                                Mobile Contact link
                            </label>
                            <input
                                className="w-full px-6 py-5 rounded-[1.5rem] border border-white/5 bg-[#16181d] text-sm text-white placeholder-white/10 focus:border-indigo-500/30 focus:bg-[#1a1d24] focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all duration-300 font-bold shadow-inner"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="+91 98765 43210"
                                required
                            />
                        </div>
                    </div>

                    {/* Shared Address Section */}
                    <div className="space-y-6 pt-6 border-t border-white/5">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">Spatial Identity (Shared Address)</h4>
                        </div>

                        <div className="space-y-2 group/field">
                            <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] ml-2 group-focus-within/field:text-indigo-400 transition-colors">
                                Residential Address
                            </label>
                            <textarea
                                className="w-full px-6 py-5 rounded-[1.5rem] border border-white/5 bg-[#16181d] text-sm text-white placeholder-white/10 focus:border-indigo-500/30 focus:bg-[#1a1d24] focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all duration-300 font-bold shadow-inner h-28 resize-none"
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                placeholder="House no, Street Name..."
                            />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                            <div className="space-y-2 group/field">
                                <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] ml-2 group-focus-within/field:text-indigo-400 transition-colors">City</label>
                                <input
                                    className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#16181d] text-xs text-white placeholder-white/10 focus:border-indigo-500/30 focus:bg-[#1a1d24] outline-none transition-all font-bold shadow-inner"
                                    value={formData.city}
                                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                                    placeholder="City"
                                />
                            </div>
                            <div className="space-y-2 group/field">
                                <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] ml-2 group-focus-within/field:text-indigo-400 transition-colors">State</label>
                                <input
                                    className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#16181d] text-xs text-white placeholder-white/10 focus:border-indigo-500/30 focus:bg-[#1a1d24] outline-none transition-all font-bold shadow-inner"
                                    value={formData.state}
                                    onChange={e => setFormData({ ...formData, state: e.target.value })}
                                    placeholder="State"
                                />
                            </div>
                            <div className="space-y-2 group/field">
                                <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] ml-2 group-focus-within/field:text-indigo-400 transition-colors">PIN Code</label>
                                <input
                                    className="w-full px-5 py-4 rounded-2xl border border-white/5 bg-[#16181d] text-xs text-white placeholder-white/10 focus:border-indigo-500/30 focus:bg-[#1a1d24] outline-none transition-all font-bold shadow-inner"
                                    value={formData.pin_code}
                                    onChange={e => setFormData({ ...formData, pin_code: e.target.value })}
                                    placeholder="Pincode"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-5 mt-12 pt-8 border-t border-white/5 sticky bottom-0 bg-[#0f1115] pb-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-8 py-4 text-[10px] font-black text-white/30 hover:text-white hover:bg-white/5 rounded-2xl transition-all uppercase tracking-[0.3em]"
                        >
                            Abrot
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.5rem] text-[11px] font-black shadow-2xl shadow-indigo-600/20 hover:shadow-indigo-600/40 flex items-center gap-3 transition-all uppercase tracking-[0.3em] hover:-translate-y-1 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                            {loading ? <Spinner size="sm" className="text-white" /> : <><CheckCircleIcon className="w-4 h-4" /> Finalize Registry</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const AssignClassModal: React.FC<{ student: StudentForAdmin, onClose: () => void, onSuccess: (updatedData: { class_id: number; class_name: string; grade?: string; academic_year?: string; enrollment_status?: string }) => void }> = ({ student, onClose, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState<React.ReactNode | null>(null);

    const selectedClass = useMemo(() => classes.find(c => c.id.toString() === selectedClassId), [classes, selectedClassId]);

    const fetchClasses = useCallback(async () => {
        setFetching(true);
        setError(null);
        try {
            const currentGrade = String(student.grade || '').trim();
            const studentGradeNum = parseInt(currentGrade.replace(/\D/g, '')) || null;

            const { data: profileBranch } = await supabase.from('student_profiles').select('branch_id').eq('user_id', student.id).maybeSingle();

            console.log('[AssignClass] Fetching classes. Grade:', currentGrade, 'Branch:', profileBranch?.branch_id);

            // Try with p_branch_id first, fallback to no-param version if it fails
            let data: any = null;
            let fetchError: any = null;

            const result1 = await supabase.rpc('get_all_classes_for_admin', {
                p_branch_id: profileBranch?.branch_id || null
            });

            if (result1.error) {
                console.warn('[AssignClass] RPC with p_branch_id failed, trying without:', result1.error.message);
                // Fallback: call without parameters (original function signature)
                const result2 = await supabase.rpc('get_all_classes_for_admin');
                data = result2.data;
                fetchError = result2.error;
            } else {
                data = result1.data;
                fetchError = result1.error;
            }

            if (fetchError) throw fetchError;

            console.log('[AssignClass] Raw classes fetched:', (data || []).length);

            const matchedClasses = (data || []).filter((c: any) => {
                const cGradeRaw = String(c.grade_level || '').trim();
                if (cGradeRaw.toLowerCase() === currentGrade.toLowerCase()) return true;
                const cGradeNum = parseInt(cGradeRaw.replace(/\D/g, '')) || null;
                if (studentGradeNum !== null && cGradeNum !== null && studentGradeNum === cGradeNum) {
                    return true;
                }
                return cGradeRaw.toLowerCase().includes(currentGrade.toLowerCase()) || currentGrade.toLowerCase().includes(cGradeRaw.toLowerCase());
            });

            console.log('[AssignClass] Matched classes for grade', currentGrade, ':', matchedClasses.length);

            if (matchedClasses.length === 0) {
                setError(<div className="space-y-3"><p className="text-white/80 text-sm">No active sections found for Grade {student.grade}.</p></div>);
                setClasses([]);
            } else {
                setClasses(matchedClasses);
                if (matchedClasses.length === 1) {
                    setSelectedClassId(matchedClasses[0].id.toString());
                }
            }
        } catch (err: any) {
            console.error("[AssignClass] Fetch Classes Error:", err);
            setError(`System failed to retrieve academic structure: ${formatError(err)}`);
        } finally {
            setFetching(false);
        }
    }, [student.grade, student.id]);

    useEffect(() => { fetchClasses(); }, [fetchClasses]);

    const handleAssign = async () => {
        if (!selectedClassId) {
            alert("Please select a class section first.");
            return;
        }

        const targetClass = selectedClass || classes.find(c => c.id.toString() === selectedClassId);

        if (!targetClass) {
            alert("Selected class data is invalid. Please re-select.");
            return;
        }

        if (!student || !student.id) {
            alert("Critical Error: Student identity missing. Cannot process assignment.");
            return;
        }

        setLoading(true);
        try {
            const classId = parseInt(selectedClassId);
            const branchId = student.branch_id || (targetClass as any).branch_id || null;

            console.log('[AssignClass] Starting assignment:', {
                student_id: student.id, class_id: classId, branch_id: branchId,
                class_name: targetClass.name, grade: (targetClass as any).grade_level
            });

            let rpcSuccess = false;
            let rpcData: any = null;

            // Strategy 1: Try the RPC function first
            try {
                const { data: rawData, error: rpcError } = await supabase.rpc('admin_assign_student_class', {
                    p_student_id: student.id,
                    p_class_id: classId,
                    p_branch_id: branchId
                });

                console.log('[AssignClass] RPC response:', { rawData, rpcError });

                if (!rpcError) {
                    const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
                    if (parsed && parsed.success === true) {
                        rpcSuccess = true;
                        rpcData = parsed;
                        console.log('[AssignClass] RPC succeeded:', parsed);
                    } else {
                        console.warn('[AssignClass] RPC returned non-success:', parsed);
                    }
                } else {
                    console.warn('[AssignClass] RPC error (will use direct update):', rpcError.message);
                }
            } catch (rpcErr: any) {
                console.warn('[AssignClass] RPC call failed (will use direct update):', rpcErr.message);
            }

            // Strategy 2: Direct table update (always run to guarantee persistence)
            if (!rpcSuccess) {
                console.log('[AssignClass] Using direct table UPDATE fallback...');

                const { error: updateError } = await supabase
                    .from('student_profiles')
                    .update({
                        assigned_class_id: classId,
                        grade: (targetClass as any).grade_level || student.grade,
                        enrollment_status: 'Active',
                        branch_id: branchId
                    })
                    .eq('user_id', student.id);

                if (updateError) {
                    console.error('[AssignClass] Direct UPDATE failed:', updateError);
                    throw new Error(`Failed to save class assignment: ${updateError.message}`);
                }

                console.log('[AssignClass] Direct UPDATE succeeded');
            }

            // Strategy 3: VERIFY persistence by reading back
            const { data: verifyRow, error: verifyError } = await supabase
                .from('student_profiles')
                .select('assigned_class_id, enrollment_status, grade')
                .eq('user_id', student.id)
                .maybeSingle();

            console.log('[AssignClass] Verification read:', { verifyRow, verifyError });

            if (verifyError || !verifyRow?.assigned_class_id) {
                throw new Error('Assignment verification failed — the database may not have saved the change. Please try again.');
            }

            if (verifyRow.assigned_class_id !== classId) {
                throw new Error(`Persistence mismatch: expected class ${classId}, got ${verifyRow.assigned_class_id}`);
            }

            console.log('[AssignClass] ✅ VERIFIED! Class assignment persisted. Calling onSuccess.');

            onSuccess({
                class_id: classId,
                class_name: rpcData?.class_name || targetClass.name,
                grade: rpcData?.grade || (targetClass as any).grade_level || student.grade,
                academic_year: rpcData?.academic_year || (targetClass as any).academic_year,
                enrollment_status: 'Active'
            });
        } catch (err: any) {
            console.error("[AssignClass] Assignment error:", err);
            alert("Enrollment Failed: " + (err.message || "Unknown error"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-[#0f1115] w-full max-w-md rounded-3xl shadow-2xl border border-white/10 flex flex-col relative overflow-hidden scale-100 font-serif" onClick={e => e.stopPropagation()}>
                <div className="px-6 pt-6 pb-4 flex justify-between items-center z-10"><div className="flex items-center gap-3"><div className="p-2 bg-white/5 rounded-2xl text-white shadow-inner border border-white/10"><UsersIcon className="w-5 h-5" /></div><h3 className="text-lg font-bold text-white tracking-tight">Guided Enrollment</h3></div><button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/50 hover:text-white"><XIcon className="w-5 h-5" /></button></div>
                <div className="px-6 pb-8 pt-2 flex-grow flex-col min-h-[350px]">
                    {step === 1 ? (
                        <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-500">
                            <div className="mb-6"><span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.25em] mb-2 block">Step 1: Placement</span><h4 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-none mb-2">Select<br />Class Section</h4></div>
                            <div className="space-y-6 flex-grow relative z-20"><div className="relative z-50"><label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-3 ml-1">Available Sections</label>{fetching ? <div className="h-[58px] bg-white/5 rounded-xl animate-pulse border border-white/10"></div> : error ? <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs font-bold text-red-400 leading-relaxed shadow-sm">{error}</div> : <CustomSelect value={selectedClassId} onChange={setSelectedClassId} placeholder="Choose a section..." options={classes.map(c => ({ value: c.id.toString(), label: c.name }))} icon={<SchoolIcon className="w-4 h-4" />} searchable className="relative z-50 font-sans" />}</div></div>
                            <div className="mt-auto pt-6 relative z-10"><button type="button" onClick={() => selectedClassId && setStep(2)} disabled={!selectedClassId || fetching || !!error} className={`w-full py-4 rounded-[1.5rem] font-black text-sm flex items-center justify-center gap-3 transition-all duration-300 pointer-events-auto font-sans uppercase tracking-widest ${!selectedClassId || fetching || !!error ? 'bg-white/5 text-white/30 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/20 hover:-translate-y-0.5'}`}>Continue <ChevronRightIcon className="w-4 h-4" /></button></div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-500">
                            <div className="mb-8"><span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.25em] mb-2 block">Step 2: Confirmation</span><h4 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-none mb-4">Confirm<br />Assignment</h4><div className="p-5 bg-white/5 rounded-[1.5rem] border border-white/10"><p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Target Section</p><p className="text-xl font-bold text-white flex items-center gap-2">{selectedClass?.name} <CheckCircleIcon className="w-5 h-5 text-emerald-500" /></p></div></div>
                            <div className="mt-auto flex flex-col gap-3"><button onClick={handleAssign} disabled={loading} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">{loading ? <Spinner size="sm" className="text-white" /> : <>FINALIZE ENROLLMENT <CheckCircleIcon className="w-4 h-4" /></>}</button><button onClick={() => setStep(1)} className="w-full py-3 text-[10px] font-black text-white/30 hover:text-white uppercase tracking-widest transition-colors">BACK</button></div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const StudentProfileModal: React.FC<StudentProfileModalProps> = ({ student, onClose, onUpdate, initialTab = 'overview' }) => {
    const [activeTab, setActiveTab] = useState<TabType>(initialTab);
    const [isEditing, setIsEditing] = useState(false);

    // --- Data States ---
    const [loading, setLoading] = useState(true);
    const [syncedStudent, setSyncedStudent] = useState<StudentForAdmin>(student);
    const [parentData, setParentData] = useState<any>(null);
    const [guardianData, setGuardianData] = useState<any>(null);
    const [docs, setDocs] = useState<any[]>([]);
    const [feesSummary, setFeesSummary] = useState<any>(null);
    const [activityLog, setActivityLog] = useState<any[]>([]);
    const [admissionRecord, setAdmissionRecord] = useState<any>(null);
    const [enquiryRecord, setEnquiryRecord] = useState<any>(null);
    const [lifecycleError, setLifecycleError] = useState<string | null>(null);

    // --- Modal States ---
    const [showGuardianEdit, setShowGuardianEdit] = useState<'primary' | 'secondary' | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showAssignClass, setShowAssignClass] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [docViewerUrl, setDocViewerUrl] = useState<string | null>(null);

    // --- Role Context ---
    const [userRole, setUserRole] = useState<string | null>(null);
    useEffect(() => {
        const resolveUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                setUserRole(data?.role || null);
            }
        };
        resolveUser();
    }, []);

    const isSchoolAdmin = userRole === 'School Administration' || userRole === 'School Administrator';

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Fetch Student Profile with RSL links
            const { data: profileRaw, error: profileError } = await supabase
                .from('student_profiles')
                .select(`
                    *,
                    profiles!inner(phone, email, display_name, profile_photo_url),
                    school_classes:assigned_class_id (name, grade_level, academic_year),
                    admissions:admission_id (
                        id, enquiry_id, application_number, status, submitted_at, grade, applicant_name
                    )
                `)
                .eq('user_id', student.id)
                .maybeSingle();

            if (profileError) console.error("Profile Fetch Error:", profileError);

            // 2. Identify Upstream IDs
            const admissionId = profileRaw?.admission_id;
            const enquiryId = profileRaw?.enquiry_id || profileRaw?.admissions?.enquiry_id;

            // 3. Parallel Fetch of Related Data
            const [
                { data: parentRes },
                { data: admissionRes },
                { data: enquiryRes },
                { data: feeData }
            ] = await Promise.all([
                supabase.rpc('get_linked_parent_for_student', { p_student_id: student.id }),
                admissionId ? supabase.from('admissions').select('*').eq('id', admissionId).maybeSingle() : Promise.resolve({ data: null }),
                enquiryId ? supabase.from('enquiries').select('*').eq('id', enquiryId).maybeSingle() : Promise.resolve({ data: null }),
                supabase.rpc('get_student_fee_summary', { p_student_id: student.id })
            ]);

            // 4. Update State
            const activeAdmission = admissionRes;
            const activeEnquiry = enquiryRes;
            const profileData = profileRaw; // Use the single object directly, not an array wrapper

            setAdmissionRecord(activeAdmission);
            setEnquiryRecord(activeEnquiry);

            // Log access to audit trails
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('audit_logs').insert({
                    user_id: user.id,
                    action: 'IDENTITY_ACCESS',
                    module: 'Student Profile',
                    details: {
                        student_id: student.id,
                        student_name: student.display_name,
                        rsl_status: activeAdmission ? 'LINKED' : 'ORPHAN'
                    },
                    severity: activeAdmission ? 'info' : 'warning'
                });
            }

            // Check for RSL integrity
            if (!activeAdmission && !activeEnquiry) {
                const msg = "CRITICAL: LIFECYCLE_LINK_MISSING. Identity Node appears orphaned.";
                setLifecycleError(msg);
                console.error(msg);
            }

            const admissionResData = activeAdmission;
            const enquiryResData = activeEnquiry;

            // --- 1. Resolve Parent/Guardian Identifier Data ---
            let combinedParentData: any = null;
            let combinedGuardianData: any = null;

            if (parentRes && parentRes.found) {
                // Strategy A: Direct Link Found via RPC (Enhanced with Secondary Fields)
                const baseInfo = {
                    parent_id: parentRes.parent_id,
                    address: parentRes.address,
                    city: parentRes.city,
                    state: parentRes.state,
                    country: parentRes.country,
                    pin_code: parentRes.pin_code
                };

                combinedParentData = {
                    ...baseInfo,
                    name: parentRes.name,
                    email: parentRes.email,
                    phone: parentRes.phone,
                    relationship: parentRes.relationship,
                    is_unlinked: !!parentRes.is_unlinked,
                    source: parentRes.source || 'Institutional Registry'
                };

                // Secondary Parent Handling - Use fields from RPC
                if (parentRes.secondary_parent_name) {
                    combinedGuardianData = {
                        ...baseInfo,
                        name: parentRes.secondary_parent_name,
                        email: parentRes.secondary_parent_email,
                        phone: parentRes.secondary_parent_phone,
                        relationship: parentRes.secondary_parent_relationship,
                        is_unlinked: !!parentRes.is_unlinked
                    };
                }
            } else {
                // Strategy B: Fallback to Admission/Enquiry Data
                // Prioritize Admission over Enquiry
                const source = activeAdmission || activeEnquiry;

                if (source) {
                    // Extract parent info if available
                    if (source.parent_name || source.parent_phone || source.father_name || source.mother_name) {
                        const pName = source.parent_name || source.father_name || source.mother_name || 'Unlinked Parent';
                        const pEmail = source.parent_email || source.email; // Fallback to main email if specific parent email missing
                        const pPhone = source.parent_phone || source.phone; // Fallback to main phone

                        combinedParentData = {
                            name: pName,
                            email: pEmail,
                            phone: pPhone,
                            relationship: 'Parent',
                            address: source.address,
                            parent_id: (source as any).parent_id || null,
                            is_unlinked: true
                        };
                    }
                }
                else if (profileData?.parent_guardian_details && profileData?.parent_guardian_details !== '0') {
                    // Strategy C: Fallback to Identity Registry (Student Profile)
                    // Matches "Name (Relationship)" or "Name (Phone)"
                    const raw = profileData.parent_guardian_details;
                    const namePart = raw.split(' (')[0];
                    const phoneMatch = raw.match(/\(([^)]+)\)/);

                    combinedParentData = {
                        name: namePart,
                        phone: phoneMatch ? phoneMatch[1] : '',
                        relationship: (phoneMatch && isNaN(parseInt(phoneMatch[1]))) ? phoneMatch[1] : 'Parent',
                        address: profileData.address,
                        is_unlinked: true,
                        source: 'Registry'
                    };
                }
            }

            setParentData(combinedParentData);
            setGuardianData(combinedGuardianData);

            // --- 2. Sync Student Identity Context ---
            const sanitize = (val: any) => (val === '0' || val === 0) ? null : val;

            const bestDisplayName = sanitize(
                (profileData?.profiles?.display_name && profileData?.profiles?.display_name !== 'Academic Identity') ? profileData.profiles.display_name :
                    (profileData?.display_name && profileData?.display_name !== 'Academic Identity') ? profileData.display_name :
                        (student.display_name && student.display_name !== 'Academic Identity') ? student.display_name :
                            (activeAdmission?.applicant_name || activeEnquiry?.applicant_name || student.display_name)
            ) || student.display_name;

            const bestPhone = sanitize(profileData?.phone) ||
                sanitize(profileData?.profiles?.phone) ||
                sanitize(activeAdmission?.student_phone) ||
                sanitize(student.phone) ||
                sanitize(combinedParentData?.phone) ||
                sanitize(activeAdmission?.parent_phone) ||
                sanitize(activeEnquiry?.parent_phone);

            const bestAddress = sanitize(profileData?.address) ||
                sanitize(activeAdmission?.address) ||
                sanitize(activeEnquiry?.address) ||
                sanitize(combinedParentData?.address) ||
                sanitize(student.address);

            const bestDob = sanitize(profileData?.date_of_birth) || sanitize(student.date_of_birth) || sanitize(activeAdmission?.date_of_birth);
            const bestGender = sanitize(profileData?.gender) || sanitize(student.gender) || sanitize(activeAdmission?.gender);
            const bestPhoto = profileData?.profiles?.profile_photo_url || profileData?.profile_photo_url || student.profile_photo_url || activeAdmission?.profile_photo_url || activeEnquiry?.profile_photo_url;
            const bestGrade = profileData?.grade || student.grade || activeAdmission?.grade || activeEnquiry?.grade;

            setSyncedStudent(prev => ({
                ...prev,
                display_name: bestDisplayName,
                phone: bestPhone,
                address: bestAddress,
                date_of_birth: bestDob,
                gender: bestGender,
                profile_photo_url: bestPhoto,
                grade: bestGrade,
                enrollment_status: profileData?.enrollment_status || prev.enrollment_status,
                // Class assignment: DB is AUTHORITATIVE - do NOT fall back to prev state
                // If DB says null, the assignment was never saved or was rolled back
                assigned_class_id: profileData?.assigned_class_id || undefined,
                assigned_class_name: (profileData?.school_classes as any)?.name || undefined,
                academic_year: (profileData?.school_classes as any)?.academic_year || prev.academic_year
            }));

            // --- 3. Additional Data (Documents & Fees) ---
            if (activeAdmission) {
                const { data: docList } = await supabase
                    .from('document_requirements')
                    .select('*, admission_documents(*)')
                    .eq('admission_id', activeAdmission.id);
                setDocs(docList || []);
            }

            setFeesSummary(feeData);

            // --- 4. Activity Log ---
            setActivityLog([
                { id: 1, action: 'Profile Synced', date: new Date().toISOString(), user: 'System' },
                { id: 2, action: 'Identity Verified', date: new Date().toISOString(), user: 'System' },
            ]);

        } catch (err) {
            console.error("Profile Fetch Error:", err);
        } finally {
            setLoading(false);
        }
    }, [student.id, student]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDocVerify = async (docId: number) => {
        await supabase.from('document_requirements').update({ status: 'Verified' }).eq('id', docId);
        fetchData();
    };

    const handleDocReject = async (docId: number) => {
        const reason = prompt("Reason for rejection:");
        if (reason) {
            await supabase.from('document_requirements').update({ status: 'Rejected', rejection_reason: reason }).eq('id', docId);
            fetchData();
        }
    };

    const handleDocView = async (path: string) => {
        const url = await StorageService.getSignedUrl(BUCKETS.DOCUMENTS, path);
        window.open(url, '_blank');
    };

    const hasClass = !!(syncedStudent.assigned_class_id && syncedStudent.assigned_class_name);

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[150] flex items-center justify-center p-0 md:p-6 overflow-hidden">
            <div className="bg-[#08090a] w-full max-w-[1400px] h-full md:h-[92vh] md:rounded-[3rem] shadow-2xl border border-white/10 flex flex-col overflow-hidden relative ring-1 ring-white/5 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>

                <div className="px-8 py-6 border-b border-white/5 bg-gradient-to-r from-[#0a0b0f] via-[#0f1115] to-[#0a0b0f] flex justify-between items-center shrink-0 z-20 backdrop-blur-xl relative">
                    <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                    <div className="flex items-center gap-6">
                        {/* Profile Photo */}
                        <div className="relative group/photo">
                            <div className="absolute -inset-1 bg-gradient-to-br from-indigo-500/30 to-indigo-600/20 rounded-2xl opacity-60 group-hover/photo:opacity-100 blur-sm transition-opacity duration-300"></div>
                            <PremiumAvatar
                                src={syncedStudent.profile_photo_url}
                                name={syncedStudent.display_name}
                                size="lg"
                                className="relative shadow-xl border-2 border-white/10 rounded-2xl"
                            />
                        </div>

                        {/* Student Info */}
                        <div>
                            <h1 className="text-3xl font-bold text-white tracking-tight leading-none mb-2.5">
                                {syncedStudent.display_name}
                            </h1>
                            <div className="flex items-center gap-3">
                                {/* Student ID */}
                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider font-mono px-2.5 py-1 bg-white/5 rounded-lg border border-white/5">
                                    ID: {syncedStudent.student_id_number || 'Pending'}
                                </span>

                                <div className="w-1 h-1 rounded-full bg-white/20"></div>

                                {/* Status Badge */}
                                <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${syncedStudent.enrollment_status === 'Active' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : (syncedStudent.enrollment_status === 'Inactive' || syncedStudent.enrollment_status === 'Withdrawn' ? 'bg-red-400' : 'bg-amber-400')} animate-pulse`}></div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${syncedStudent.enrollment_status === 'Active' ? 'text-emerald-400/90' : (syncedStudent.enrollment_status === 'Inactive' || syncedStudent.enrollment_status === 'Withdrawn' ? 'text-red-400/90' : 'text-amber-400/90')}`}>
                                        {syncedStudent.enrollment_status || (syncedStudent.is_active ? 'Active' : 'Inactive')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsEditing(true)}
                            className="hidden md:flex items-center gap-2.5 px-6 py-3 bg-white text-black hover:bg-white/90 font-bold text-xs rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 uppercase tracking-wide"
                        >
                            <EditIcon className="w-4 h-4" />
                            {isSchoolAdmin ? 'Record Maintenance' : 'Edit Profile'}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all border border-white/5"
                            aria-label="Close"
                        >
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row flex-grow overflow-hidden">
                    {/* Sidebar Nav */}
                    <div className="w-full md:w-72 bg-[#0a0b0f] border-r border-white/5 flex-shrink-0 flex flex-col relative z-10">
                        <div className="p-6 space-y-1.5 overflow-y-auto custom-scrollbar flex-grow">
                            {/* Core Registry Section */}
                            <p className="px-6 text-[9px] font-black text-indigo-400/80 uppercase tracking-[0.2em] mb-4 pb-2 border-b border-indigo-500/10 flex items-center gap-2">
                                <span className="w-1 h-3 bg-indigo-500 rounded-full"></span>
                                Game Registry
                            </p>
                            <div className="space-y-1.5 px-2">
                                <TabButton id="overview" label="Overview" icon={<ActivityIcon className="w-5 h-5" />} active={activeTab === 'overview'} onClick={setActiveTab} />
                                <TabButton id="parents" label="Guardians" icon={<UsersIcon className="w-5 h-5" />} active={activeTab === 'parents'} onClick={setActiveTab} />
                                <TabButton id="academic" label="Academics" icon={<GraduationCapIcon className="w-5 h-5" />} active={activeTab === 'academic'} onClick={setActiveTab} />
                            </div>

                            {/* Administration Section */}
                            <p className="px-4 text-[9px] font-bold text-white/25 uppercase tracking-[0.2em] mt-8 mb-4 pb-2 border-b border-white/5">
                                Administration
                            </p>
                            <div className="space-y-1">
                                <TabButton id="documents" label="Documents" icon={<FileTextIcon className="w-5 h-5" />} active={activeTab === 'documents'} onClick={setActiveTab} />
                                <TabButton id="fees" label="Financials" icon={<CreditCardIcon className="w-5 h-5" />} active={activeTab === 'fees'} onClick={setActiveTab} />
                                <TabButton id="history" label="Audit Log" icon={<ClockIcon className="w-5 h-5" />} active={activeTab === 'history'} onClick={setActiveTab} />
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-grow bg-[#08090a] overflow-y-auto custom-scrollbar p-8 md:p-12 relative">
                        {loading ? (
                            <div className="h-full flex items-center justify-center">
                                <Spinner size="lg" className="text-primary" />
                            </div>
                        ) : (
                            <>
                                {activeTab === 'overview' && (
                                    <div className="space-y-12 max-w-5xl animate-in fade-in slide-in-from-right-4 duration-700">
                                        {/* Quick Stats Grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                            {/* Placement Card */}
                                            <div className="p-8 rounded-[2rem] bg-[#0c0e12] border border-white/5 flex flex-col justify-between h-48 group hover:border-indigo-500/30 transition-all duration-500 shadow-xl shadow-black/20 hover:shadow-indigo-500/10 hover:-translate-y-1 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-[50px] group-hover:bg-indigo-500/10 transition-colors"></div>
                                                <div className="flex justify-between items-start relative z-10">
                                                    <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 border border-indigo-500/20">
                                                        <SchoolIcon className="w-6 h-6" />
                                                    </div>
                                                    <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.25em] group-hover:text-indigo-400/50 transition-colors">Placement</span>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    {syncedStudent.assigned_class_name ? (
                                                        <p className="text-2xl font-black text-white uppercase tracking-tight leading-none group-hover:text-indigo-100 transition-colors">
                                                            {syncedStudent.assigned_class_name}
                                                        </p>
                                                    ) : (
                                                        <button
                                                            onClick={() => setActiveTab('academic')}
                                                            className="flex items-center gap-2 text-sm font-black text-amber-500 hover:text-amber-400 uppercase tracking-wider transition-all hover:translate-x-1"
                                                        >
                                                            Assign Class <ArrowRightIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]">Current Class</p>
                                                </div>
                                            </div>

                                            {/* Attendance Card */}
                                            <div className="p-8 rounded-[2rem] bg-[#0c0e12] border border-white/5 flex flex-col justify-between h-48 group hover:border-emerald-500/30 transition-all duration-500 shadow-xl shadow-black/20 hover:shadow-emerald-500/10 hover:-translate-y-1 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-[50px] group-hover:bg-emerald-500/10 transition-colors"></div>
                                                <div className="flex justify-between items-start relative z-10">
                                                    <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 border border-emerald-500/20">
                                                        <CheckCircleIcon className="w-6 h-6" />
                                                    </div>
                                                    <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.25em] group-hover:text-emerald-400/50 transition-colors">Attendance</span>
                                                </div>
                                                <div className="relative z-10">
                                                    <p className="text-2xl font-black text-white tracking-tight leading-none mb-2 group-hover:text-emerald-100 transition-colors">
                                                        94% <span className="text-sm font-black text-emerald-500/50 uppercase tracking-widest ml-1">Avg</span>
                                                    </p>
                                                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]">Participation</p>
                                                </div>
                                            </div>

                                            {/* Balance Card */}
                                            <div className="p-8 rounded-[2rem] bg-[#0c0e12] border border-white/5 flex flex-col justify-between h-48 group hover:border-amber-500/30 transition-all duration-500 shadow-xl shadow-black/20 hover:shadow-amber-500/10 hover:-translate-y-1 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-[50px] group-hover:bg-amber-500/10 transition-colors"></div>
                                                <div className="flex justify-between items-start relative z-10">
                                                    <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 border border-amber-500/20">
                                                        <DollarSignIcon className="w-6 h-6" />
                                                    </div>
                                                    <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.25em] group-hover:text-amber-500/50 transition-colors">Balance</span>
                                                </div>
                                                <div className="relative z-10">
                                                    <p className={`text-2xl font-black tracking-tight leading-none mb-2 ${feesSummary?.outstanding_balance > 0 ? 'text-amber-500' : 'text-emerald-400'}`}>
                                                        {formatCurrency(feesSummary?.outstanding_balance || 0)}
                                                    </p>
                                                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]">Outstanding Dues</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                                            <div className="space-y-8">
                                                <div className="pb-4">
                                                    <h3 className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em] flex items-center gap-4">
                                                        Personal Details <div className="h-px bg-white/5 flex-grow"></div>
                                                    </h3>
                                                </div>
                                                <div className="space-y-2">
                                                    <InfoRow label="Legal Name" value={syncedStudent.display_name} icon={<UserIcon className="w-5 h-5" />} onEdit={isSchoolAdmin ? undefined : () => setIsEditing(true)} />
                                                    <InfoRow label="Gender" value={syncedStudent.gender} icon={<UserIcon className="w-5 h-5" />} onEdit={isSchoolAdmin ? undefined : () => setIsEditing(true)} />
                                                    <InfoRow label="Date of Birth" value={syncedStudent.date_of_birth ? new Date(syncedStudent.date_of_birth).toLocaleDateString() : null} icon={<CalendarIcon className="w-5 h-5" />} onEdit={isSchoolAdmin ? undefined : () => setIsEditing(true)} />
                                                    <InfoRow label="Address" value={syncedStudent.address} icon={<LocationIcon className="w-5 h-5" />} onEdit={isSchoolAdmin ? undefined : () => setIsEditing(true)} />
                                                </div>
                                            </div>
                                            <div className="space-y-8">
                                                <div className="pb-4">
                                                    <h3 className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em] flex items-center gap-4">
                                                        Contact Information <div className="h-px bg-white/5 flex-grow"></div>
                                                    </h3>
                                                </div>
                                                <div className="space-y-2">
                                                    <InfoRow label="Primary Email" value={syncedStudent.email} icon={<MailIcon className="w-5 h-5" />} onEdit={isSchoolAdmin ? undefined : () => setIsEditing(true)} />
                                                    <InfoRow label="Student Phone" value={syncedStudent.phone} icon={<PhoneIcon className="w-5 h-5" />} onEdit={isSchoolAdmin ? undefined : () => setIsEditing(true)} />
                                                    <InfoRow label="Parent Contact" value={parentData?.phone || parentData?.parent_phone || syncedStudent.phone} icon={<PhoneIcon className="w-5 h-5" />} onEdit={isSchoolAdmin ? undefined : () => setIsEditing(true)} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* --- GUIDED ENROLLMENT PROGRESS & USER GUIDE --- */}
                                        {!syncedStudent.assigned_class_id && (
                                            <div className="pt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                                <div className="flex items-center gap-4 mb-8">
                                                    <div className="h-px bg-white/5 flex-grow"></div>
                                                    <h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Managed Enrollment Protocol</h3>
                                                    <div className="h-px bg-white/5 flex-grow"></div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                                    <div className="md:col-span-2 p-10 rounded-[2.5rem] bg-gradient-to-br from-[#0c0e12] to-transparent border border-white/5 relative overflow-hidden group">
                                                        <div className="absolute top-0 right-0 p-10 opacity-[0.02] group-hover:scale-110 transition-transform duration-1000">
                                                            <ShieldCheckIcon className="w-48 h-48" />
                                                        </div>
                                                        <div className="relative z-10">
                                                            <div className="flex items-center gap-3 mb-6">
                                                                <div className="p-2.5 bg-indigo-500/20 rounded-xl text-indigo-400">
                                                                    <GraduationCapIcon className="w-5 h-5" />
                                                                </div>
                                                                <h4 className="font-bold text-white text-lg tracking-tight">Guided Enrollment Checklist</h4>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                {[
                                                                    { label: 'Identity Protocol', status: 'complete', desc: 'Demographic synchronization secured' },
                                                                    { label: 'Admission Link', status: admissionRecord ? 'complete' : 'pending', desc: 'Vault registration record' },
                                                                    { label: 'Document Portfolio', status: docs.length > 0 ? (docs.every((d: any) => d.status === 'Verified') ? 'complete' : 'warning') : 'pending', desc: 'Verification of credentials' },
                                                                    { label: 'Academic Placement', status: syncedStudent.assigned_class_id ? 'complete' : 'pending', desc: 'Final segment assignment' }
                                                                ].map((step, idx) => (
                                                                    <div key={idx} className={`p-5 rounded-2xl border transition-all duration-300 ${step.status === 'complete' ? 'bg-emerald-500/5 border-emerald-500/10' :
                                                                        step.status === 'warning' ? 'bg-amber-500/5 border-amber-500/10' :
                                                                            'bg-white/5 border-white/5 opacity-50'
                                                                        }`}>
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <span className={`text-[9px] font-black uppercase tracking-widest ${step.status === 'complete' ? 'text-emerald-400' :
                                                                                step.status === 'warning' ? 'text-amber-400' :
                                                                                    'text-white/40'
                                                                                }`}>{step.label}</span>
                                                                            {step.status === 'complete' && <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" />}
                                                                            {step.status === 'warning' && <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-500" />}
                                                                        </div>
                                                                        <p className="text-[10px] text-white/30 font-medium">{step.desc}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="p-8 rounded-[2.5rem] bg-[#0c0e12] border border-white/5 flex flex-col justify-center gap-6 relative overflow-hidden group">
                                                        <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                                                        <div className="relative z-10">
                                                            <h5 className="text-[11px] font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                                                <InfoIcon className="w-4 h-4 text-indigo-400" /> User Guide
                                                            </h5>
                                                            <div className="space-y-4">
                                                                <div className="flex gap-3">
                                                                    <div className="w-1 h-6 bg-indigo-500 rounded-full shrink-0"></div>
                                                                    <p className="text-[10px] text-white/50 leading-relaxed">
                                                                        To finalize enrollment, ensure all <span className="text-white font-bold">Mandatory Documents</span> are uploaded and verified by the administration.
                                                                    </p>
                                                                </div>
                                                                <div className="flex gap-3">
                                                                    <div className="w-1 h-6 bg-purple-500 rounded-full shrink-0"></div>
                                                                    <p className="text-[10px] text-white/50 leading-relaxed">
                                                                        Student must have an <span className="text-white font-bold">Active Admission Record</span> linked to their profile before class placement.
                                                                    </p>
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        setActiveTab('academic');
                                                                        setShowAssignClass(true);
                                                                    }}
                                                                    className="w-full mt-4 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 active:scale-95"
                                                                >
                                                                    Start Enrollment <ArrowRightIcon className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}


                                        {/* --- INSTITUTIONAL LIFECYCLE SECTION --- */}
                                        <div className="pt-12 border-t border-white/5">
                                            <div className="flex items-center justify-between mb-8">
                                                <h3 className="text-[12px] font-black text-indigo-400 uppercase tracking-[0.4em] flex items-center gap-4">
                                                    Institutional Lifecycle Transparency
                                                </h3>
                                                {lifecycleError && (
                                                    <div className="px-4 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full flex items-center gap-2 animate-pulse">
                                                        <AlertTriangleIcon className="w-3.5 h-3.5 text-red-500" />
                                                        <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">{lifecycleError}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                {/* Enquiry Card */}
                                                <div className="relative group p-8 rounded-[2.5rem] bg-[#0c0e12] border border-white/5 transition-all duration-500 hover:border-indigo-500/20 overflow-hidden">
                                                    <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:scale-110 transition-transform duration-700">
                                                        <MailIcon className="w-48 h-48" />
                                                    </div>
                                                    <div className="relative z-10">
                                                        <div className="flex items-center gap-3 mb-6">
                                                            <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 text-white/40">
                                                                <InfoIcon className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-black text-white text-sm uppercase tracking-widest">Enquiry Information</h4>
                                                                <p className="text-[9px] text-white/20 font-bold uppercase tracking-[0.2em]">Lifecycle Step 01</p>
                                                            </div>
                                                        </div>

                                                        {enquiryRecord ? (
                                                            <div className="space-y-4">
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div>
                                                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Enquiry ID</p>
                                                                        <p className="text-sm font-bold text-white font-mono truncate">{enquiryRecord.enquiry_code || enquiryRecord.id.split('-')[0]}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Receipt Date</p>
                                                                        <p className="text-sm font-bold text-white">{new Date(enquiryRecord.created_at || enquiryRecord.received_at).toLocaleDateString()}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div>
                                                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Initial Grade</p>
                                                                        <p className="text-sm font-bold text-white uppercase">{enquiryRecord.grade}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Sync Status</p>
                                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded border border-emerald-500/20">
                                                                            <CheckCircleIcon className="w-3 h-3" /> Converted
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Source Context:</p>
                                                                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest italic">{enquiryRecord.source || enquiryRecord.source_type || 'Organic Walk-in'}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="py-8 flex flex-col items-center justify-center text-center">
                                                                <div className="p-4 bg-white/5 rounded-2xl mb-4">
                                                                    <AlertTriangleIcon className="w-8 h-8 text-white/10" />
                                                                </div>
                                                                <p className="text-xs font-bold text-white/30 italic uppercase tracking-widest leading-relaxed">
                                                                    This student was admitted<br />without a recorded enquiry.
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Admission Card */}
                                                <div className="relative group p-8 rounded-[2.5rem] bg-[#0c0e12] border border-white/5 transition-all duration-500 hover:border-purple-500/20 overflow-hidden">
                                                    <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:scale-110 transition-transform duration-700">
                                                        <FileTextIcon className="w-48 h-48" />
                                                    </div>
                                                    <div className="relative z-10">
                                                        <div className="flex items-center gap-3 mb-6">
                                                            <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 text-white/40">
                                                                <GraduationCapIcon className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-black text-white text-sm uppercase tracking-widest">Admission Information</h4>
                                                                <p className="text-[9px] text-white/20 font-bold uppercase tracking-[0.2em]">Lifecycle Step 02</p>
                                                            </div>
                                                        </div>

                                                        {admissionRecord ? (
                                                            <div className="space-y-4">
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div>
                                                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Admission ID</p>
                                                                        <p className="text-sm font-bold text-white font-mono truncate">{admissionRecord.application_number || admissionRecord.id.split('-')[0]}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Approval Date</p>
                                                                        <p className="text-sm font-bold text-white">{new Date(admissionRecord.submitted_at).toLocaleDateString()}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div>
                                                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Academic Year</p>
                                                                        <p className="text-sm font-bold text-white uppercase">{admissionRecord.academic_year || '2025-26'}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Admission Status</p>
                                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded border border-indigo-500/20">
                                                                            <ShieldCheckIcon className="w-3 h-3" /> {admissionRecord.status || 'Enrolled'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Registrar Seal:</p>
                                                                        <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest italic">{admissionRecord.grade} (Confirmed)</p>
                                                                    </div>
                                                                    {!enquiryRecord && (
                                                                        <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                                                                            <AlertTriangleIcon className="w-2.5 h-2.5 text-amber-500" />
                                                                            <span className="text-[7px] font-black text-amber-500 uppercase tracking-widest">Enquiry Missing</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="py-8 flex flex-col items-center justify-center text-center">
                                                                <div className="p-4 bg-white/5 rounded-2xl mb-4 animate-bounce">
                                                                    <AlertTriangleIcon className="w-8 h-8 text-red-500/40" />
                                                                </div>
                                                                <p className="text-xs font-bold text-red-400/60 uppercase tracking-widest leading-relaxed">
                                                                    Lifecycle Link Missing:<br />No Admission Record.
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}


                                {activeTab === 'parents' && (
                                    <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-700 max-w-6xl">
                                        {/* Section Header */}
                                        <div className="relative p-10 bg-gradient-to-br from-[#1a1d28]/60 to-transparent border border-white/5 rounded-[3rem] overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.05] group-hover:scale-110 transition-all duration-1000">
                                                <UsersIcon className="w-56 h-56" />
                                            </div>

                                            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                                                <div className="max-w-xl">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                                                            <ShieldCheckIcon className="w-5 h-5" />
                                                        </div>
                                                        <h2 className="text-3xl font-black text-white tracking-tight">Guardian Management</h2>
                                                    </div>
                                                    <p className="text-sm text-white/40 leading-relaxed font-medium">
                                                        Centralized control for student guardianship protocols. Manage primary contacts, backup emergency links, and synchronize household identification data.
                                                    </p>
                                                </div>

                                                <div className="flex flex-col items-end gap-3 shrink-0">
                                                    <div className="flex items-center gap-2.5 px-4 py-2 bg-[#0c0e12] text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl border border-emerald-500/20 shadow-xl shadow-black/20">
                                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,1)]"></span>
                                                        {(parentData || guardianData) ? 'Records Synchronized' : 'Setup Incomplete'}
                                                    </div>

                                                    {parentData && !isSchoolAdmin && (
                                                        <button
                                                            onClick={async () => {
                                                                if (parentData) {
                                                                    // Construct parent details string for internal registry
                                                                    const parentDetailsStr = parentData.name ? `${parentData.name} (${parentData.relationship || 'Guardian'})` : '';

                                                                    await supabase.rpc('update_student_details_admin', {
                                                                        p_student_id: student.id,
                                                                        p_address: parentData.address,
                                                                        p_phone: parentData.phone,
                                                                        p_parent_details: parentDetailsStr
                                                                    });

                                                                    // Trigger a local refresh
                                                                    await fetchData();
                                                                    console.log('Identity Protocol Synchronized');
                                                                }
                                                            }}
                                                            className="group flex items-center gap-3 px-6 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/20 transition-all duration-300"
                                                        >
                                                            <RefreshIcon className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" />
                                                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sync Identity Protocol</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Guardian Cards Grid */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                            <GuardianCard
                                                title="Primary Guardian"
                                                data={parentData}
                                                isPrimary
                                                onEdit={() => setShowGuardianEdit('primary')}
                                                readOnly={isSchoolAdmin}
                                            />
                                            <GuardianCard
                                                title="Secondary Guardian"
                                                data={guardianData}
                                                onEdit={() => setShowGuardianEdit('secondary')}
                                                readOnly={isSchoolAdmin}
                                            />
                                        </div>

                                        {/* Informational/Warning Footer */}
                                        <div className="relative mt-8 p-8 bg-[#0c0e12] border border-white/5 rounded-[2.5rem] overflow-hidden group">
                                            {(!parentData && !guardianData) ? (
                                                <div className="relative z-10 flex items-start gap-6 animate-pulse">
                                                    <div className="p-4 bg-amber-500/20 rounded-2xl ring-1 ring-amber-500/40">
                                                        <AlertTriangleIcon className="w-6 h-6 text-amber-500" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-amber-500 tracking-[0.05em] mb-2 uppercase">Action Required</p>
                                                        <p className="text-xs text-white/50 leading-relaxed font-medium max-w-2xl">
                                                            Please link at least one guardian to ensure student safety and communication. Guardian information is used for emergency notifications and academic updates.
                                                            Initialize a primary link to resolve this warning.
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.03] to-transparent pointer-events-none"></div>
                                                    <div className="relative z-10 flex items-start gap-6">
                                                        <div className="p-4 bg-emerald-500/10 rounded-2xl ring-1 ring-emerald-500/20">
                                                            <ShieldCheckIcon className="w-6 h-6 text-emerald-500" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-white tracking-[0.05em] mb-2 uppercase">Integrity Verification</p>
                                                            <p className="text-xs text-white/30 leading-relaxed font-medium max-w-2xl">
                                                                Guardian data is leveraged for emergency broadcasting, financial settlement, and academic reporting.
                                                                Accuracy in residential indexing ensures seamless coordination between campus and household units.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'academic' && (
                                    <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500 max-w-5xl">
                                        {/* Academic Placement Card */}
                                        <div className="relative bg-gradient-to-br from-[#0c0e12] via-[#0f1115] to-[#0c0e12] border border-white/5 rounded-[2.5rem] p-8 md:p-10 overflow-hidden group">
                                            {/* Animated Background Elements */}
                                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[100px] group-hover:bg-indigo-500/10 transition-all duration-1000"></div>
                                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full blur-[80px] group-hover:bg-purple-500/10 transition-all duration-1000"></div>
                                            <div className="absolute top-0 right-0 p-10 opacity-[0.02] group-hover:opacity-[0.04] transition-opacity duration-700">
                                                <SchoolIcon className="w-56 h-56" />
                                            </div>

                                            {/* Header */}
                                            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                                                <div className="flex items-start gap-4">
                                                    <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                                                        <GraduationCapIcon className="w-7 h-7 text-indigo-400" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-3xl font-black text-white tracking-tight leading-none mb-2">Academic Placement</h3>
                                                        <p className="text-sm text-white/40 font-medium">Class assignment and enrollment status</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setShowAssignClass(true)}
                                                    className="group/btn relative px-8 py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl shadow-indigo-600/20 transition-all active:scale-95 hover:-translate-y-0.5 overflow-hidden"
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000"></div>
                                                    <span className="relative z-10 flex items-center gap-2">
                                                        {hasClass ? (
                                                            <>
                                                                <RefreshIcon className="w-4 h-4" />
                                                                Reassign Class
                                                            </>
                                                        ) : (
                                                            <>
                                                                <PlusIcon className="w-4 h-4" />
                                                                Enroll in Class
                                                            </>
                                                        )}
                                                    </span>
                                                </button>
                                            </div>

                                            {/* Success State - Class Assigned */}
                                            {hasClass ? (
                                                <div className="relative z-10 space-y-8">
                                                    {/* Success Banner */}
                                                    <div className="relative p-6 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 rounded-2xl overflow-hidden group/success">
                                                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent opacity-0 group-hover/success:opacity-100 transition-opacity duration-500"></div>
                                                        <div className="relative z-10 flex items-center gap-4">
                                                            <div className="p-3 bg-emerald-500/20 rounded-xl ring-1 ring-emerald-500/30">
                                                                <ShieldCheckIcon className="w-6 h-6 text-emerald-400" />
                                                            </div>
                                                            <div className="flex-grow">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <p className="text-sm font-black text-emerald-400 uppercase tracking-wider">Academic Placement Active</p>
                                                                    <span className="px-2 py-0.5 bg-emerald-500/20 rounded-md text-[8px] font-black text-emerald-400 uppercase tracking-widest border border-emerald-500/30">Enrollment Initialized</span>
                                                                </div>
                                                                <p className="text-xs text-white/50 font-medium">Student identity node successfully localized and academically active</p>
                                                            </div>
                                                            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,1)]"></span>
                                                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Verified State</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Placement Details Grid */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        {/* Current Grade Card */}
                                                        <div className="group/card relative p-6 bg-[#0a0b0f] border border-white/5 rounded-2xl hover:border-indigo-500/30 transition-all duration-500 overflow-hidden">
                                                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-[60px] group-hover/card:bg-indigo-500/10 transition-colors duration-500"></div>
                                                            <div className="relative z-10">
                                                                <div className="flex items-center gap-3 mb-4">
                                                                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                                                                        <GraduationCapIcon className="w-5 h-5 text-indigo-400" />
                                                                    </div>
                                                                    <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Current Grade</span>
                                                                </div>
                                                                <p className="text-2xl font-black text-white tracking-tight">Grade {syncedStudent.grade}</p>
                                                                <p className="text-xs text-white/40 mt-2 font-medium">Academic Year {(syncedStudent as any).academic_year || '2025-26'}</p>
                                                            </div>
                                                        </div>

                                                        {/* Assigned Section Card */}
                                                        <div className="group/card relative p-6 bg-[#0a0b0f] border border-white/5 rounded-2xl hover:border-purple-500/30 transition-all duration-500 overflow-hidden">
                                                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-[60px] group-hover/card:bg-purple-500/10 transition-colors duration-500"></div>
                                                            <div className="relative z-10">
                                                                <div className="flex items-center gap-3 mb-4">
                                                                    <div className="p-2 bg-purple-500/10 rounded-lg">
                                                                        <SchoolIcon className="w-5 h-5 text-purple-400" />
                                                                    </div>
                                                                    <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Assigned Section</span>
                                                                </div>
                                                                <p className="text-2xl font-black text-white tracking-tight">{syncedStudent.assigned_class_name}</p>
                                                                <p className="text-xs text-white/40 mt-2 font-medium">Primary Classroom</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Additional Info */}
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                                                            <p className="text-[9px] font-black text-white/30 uppercase tracking-wider mb-2">Class Teacher</p>
                                                            <p className="text-sm font-bold text-white/70">To be assigned</p>
                                                        </div>
                                                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                                                            <p className="text-[9px] font-black text-white/30 uppercase tracking-wider mb-2">Total Students</p>
                                                            <p className="text-sm font-bold text-white/70">--</p>
                                                        </div>
                                                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                                                            <p className="text-[9px] font-black text-white/30 uppercase tracking-wider mb-2">Enrollment Date</p>
                                                            <p className="text-sm font-bold text-white/70">
                                                                {(syncedStudent as any).updated_at ? new Date((syncedStudent as any).updated_at).toLocaleDateString() : new Date().toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="relative z-10">
                                                    <div className="p-8 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-[2rem] text-center relative overflow-hidden group/empty">
                                                        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[80px] group-hover/empty:bg-amber-500/10 transition-all duration-1000"></div>

                                                        <div className="relative z-10 flex flex-col items-center">
                                                            <div className="inline-flex p-5 bg-amber-500/10 rounded-2xl mb-6 ring-1 ring-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.1)] group-hover/empty:scale-110 transition-transform duration-500">
                                                                <div className="relative">
                                                                    <SchoolIcon className="w-10 h-10 text-amber-500" />
                                                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-[#1a1d28] flex items-center justify-center">
                                                                        <span className="text-[10px] font-black text-[#1a1d28]">!</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <h4 className="text-2xl font-black text-white tracking-tight mb-3">Placement Required</h4>
                                                            <p className="text-sm text-white/50 max-w-lg mx-auto mb-8 leading-relaxed">
                                                                This student profile is active but lacks an academic anchor.
                                                                Assigning a class section unlocks grade tracking, attendance monitoring, and curriculum management.
                                                            </p>

                                                            {/* Step Indicator */}
                                                            <div className="flex items-center gap-4 mb-8 opacity-60">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-[10px] font-black border border-emerald-500/20"><CheckCircleIcon className="w-3 h-3" /></div>
                                                                    <span className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-wider">Profile</span>
                                                                </div>
                                                                <div className="w-8 h-px bg-white/10"></div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border ${parentData || guardianData ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'}`}>
                                                                        {parentData || guardianData ? <CheckCircleIcon className="w-3 h-3" /> : '2'}
                                                                    </div>
                                                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${parentData || guardianData ? 'text-emerald-500/80' : 'text-amber-500/80'}`}>Guardian</span>
                                                                </div>
                                                                <div className="w-8 h-px bg-white/10"></div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-6 h-6 rounded-full bg-amber-500 text-[#0c0e12] flex items-center justify-center text-[10px] font-black shadow-[0_0_10px_rgba(245,158,11,0.4)] animate-pulse">3</div>
                                                                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Placement</span>
                                                                </div>
                                                            </div>

                                                            <button
                                                                onClick={() => setShowAssignClass(true)}
                                                                className="group/act relative px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#0c0e12] rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(245,158,11,0.2)] hover:shadow-[0_15px_40px_rgba(245,158,11,0.3)] transition-all transform hover:-translate-y-1 active:translate-y-0 overflow-hidden"
                                                            >
                                                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/act:translate-y-0 transition-transform duration-500"></div>
                                                                <span className="relative z-10 flex items-center gap-3">
                                                                    Initialize Enrollment <ChevronRightIcon className="w-4 h-4" />
                                                                </span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Subject Performance Section */}
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-xl font-black text-white tracking-tight mb-1">Subject Performance</h3>
                                                    <p className="text-xs text-white/40 font-medium">Academic progress and grade tracking</p>
                                                </div>
                                                <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black text-white/50 hover:text-white uppercase tracking-wider transition-all">
                                                    View Full Report
                                                </button>
                                            </div>

                                            <div className="relative">
                                                {/* Locked Overlay for Unassigned Students */}
                                                {!hasClass && (
                                                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center backdrop-blur-sm bg-[#08090a]/60 rounded-[2rem] border border-white/5">
                                                        <div className="p-4 bg-white/5 rounded-full mb-4 ring-1 ring-white/10 shadow-2xl">
                                                            <LockIcon className="w-8 h-8 text-white/40" />
                                                        </div>
                                                        <h4 className="text-lg font-black text-white tracking-tight mb-2">Curriculum Locked</h4>
                                                        <p className="text-xs text-white/40 font-medium max-w-xs text-center leading-relaxed">
                                                            Academic performance modules are disabled until class placement is finalized.
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Performance Cards - Enhanced */}
                                                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-500 ${!hasClass ? 'blur-sm opacity-50 pointer-events-none select-none grayscale-[0.5]' : ''}`}>
                                                    {[
                                                        { subject: 'Mathematics', grade: 'A', percentage: 92, color: 'blue', teacher: 'Dr. R. Gupta', trend: 'up' },
                                                        { subject: 'Science', grade: 'A-', percentage: 88, color: 'green', teacher: 'Mrs. S. Kaur', trend: 'up' },
                                                        { subject: 'English', grade: 'B+', percentage: 85, color: 'purple', teacher: 'Mr. J. Smith', trend: 'flat' },
                                                        { subject: 'Social Studies', grade: 'A', percentage: 90, color: 'amber', teacher: 'Ms. P. Sharma', trend: 'up' },
                                                        { subject: 'Hindi', grade: 'B', percentage: 82, color: 'pink', teacher: 'Mrs. A. Verma', trend: 'down' },
                                                        { subject: 'Computer Science', grade: 'A+', percentage: 95, color: 'cyan', teacher: 'Mr. T. Rogers', trend: 'up' },
                                                    ].map((subject, idx) => (
                                                        <div key={idx} className="group/subject relative p-6 bg-[#0c0e12] border border-white/5 rounded-[2rem] hover:border-white/10 transition-all duration-500 overflow-hidden hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50">
                                                            {/* Dynamic Gradient Background */}
                                                            <div className={`absolute top-0 right-0 w-32 h-32 bg-${subject.color}-500/5 rounded-full blur-[60px] group-hover/subject:bg-${subject.color}-500/10 transition-colors duration-500`}></div>

                                                            <div className="relative z-10 flex flex-col h-full justify-between">
                                                                <div>
                                                                    <div className="flex items-start justify-between mb-6">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={`p-2.5 rounded-xl bg-${subject.color}-500/10 text-${subject.color}-400 border border-${subject.color}-500/10`}>
                                                                                <BookIcon className="w-5 h-5" />
                                                                            </div>
                                                                            <div>
                                                                                <h4 className="text-sm font-black text-white tracking-tight">{subject.subject}</h4>
                                                                                <p className="text-[9px] text-white/30 font-bold uppercase tracking-wider">{subject.teacher}</p>
                                                                            </div>
                                                                        </div>

                                                                        <div className={`flex flex-col items-end`}>
                                                                            <div className={`px-3 py-1 bg-${subject.color}-500/10 border border-${subject.color}-500/20 rounded-lg mb-1`}>
                                                                                <span className={`text-sm font-black text-${subject.color}-400`}>{subject.grade}</span>
                                                                            </div>
                                                                            {subject.trend === 'up' && <span className="text-[9px] font-bold text-emerald-500 flex items-center gap-1">▲ Rising</span>}
                                                                            {subject.trend === 'down' && <span className="text-[9px] font-bold text-rose-500 flex items-center gap-1">▼ Falling</span>}
                                                                            {subject.trend === 'flat' && <span className="text-[9px] font-bold text-white/30 flex items-center gap-1">• Stable</span>}
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-3 mb-4">
                                                                        <div className="flex items-center justify-between text-xs">
                                                                            <span className="text-white/40 font-medium text-[10px] uppercase tracking-wider">Performance</span>
                                                                            <span className="text-white font-black">{subject.percentage}%</span>
                                                                        </div>
                                                                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                                            <div
                                                                                className={`h-full bg-gradient-to-r from-${subject.color}-600 to-${subject.color}-400 rounded-full transition-all duration-1000 group-hover/subject:shadow-[0_0_10px_rgba(255,255,255,0.3)]`}
                                                                                style={{ width: `${subject.percentage}%` }}
                                                                            ></div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                                                                    <span className="text-[10px] text-white/20 font-medium">Last assessed 2 days ago</span>
                                                                    <button className="p-2 rounded-full hover:bg-white/5 text-white/30 hover:text-white transition-colors">
                                                                        <ChevronRightIcon className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Coming Soon Notice */}
                                            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                                                <p className="text-xs text-white/30 font-medium">
                                                    <span className="inline-flex items-center gap-2">
                                                        <ChartBarIcon className="w-4 h-4" />
                                                        Detailed grade analytics and performance trends coming soon
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'documents' && (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-lg font-bold text-white">Digital Vault</h3>
                                            <button className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-2">
                                                <PlusIcon className="w-4 h-4" /> Request Document
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                            {docs.map(doc => (
                                                <DocumentCard
                                                    key={doc.id}
                                                    doc={doc}
                                                    onVerify={handleDocVerify}
                                                    onReject={handleDocReject}
                                                    onView={handleDocView}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'fees' && (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 max-w-5xl">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="p-6 bg-[#0c0e12] border border-white/5 rounded-[2rem] text-center">
                                                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em]">Total Billed</p>
                                                <p className="text-2xl font-mono font-black text-white mt-1">{formatCurrency(feesSummary?.total_billed)}</p>
                                            </div>
                                            <div className="p-6 bg-[#0c0e12] border border-white/5 rounded-[2rem] text-center">
                                                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em]">Collected</p>
                                                <p className="text-2xl font-mono font-black text-emerald-500 mt-1">{formatCurrency(feesSummary?.total_paid)}</p>
                                            </div>
                                            <div className="p-6 bg-[#0c0e12] border border-white/5 rounded-[2rem] text-center">
                                                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.25em]">Due Balance</p>
                                                <p className="text-2xl font-mono font-black text-red-500 mt-1">{formatCurrency(feesSummary?.outstanding_balance)}</p>
                                            </div>
                                        </div>

                                        <div className="flex justify-end">
                                            <button
                                                onClick={() => setShowPayment(true)}
                                                className="px-8 py-3 bg-primary text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl shadow-lg hover:bg-primary/90 transition-all flex items-center gap-2"
                                            >
                                                <ReceiptIcon className="w-4 h-4" /> Record Manual Payment
                                            </button>
                                        </div>

                                        <div className="border border-white/5 rounded-[2rem] overflow-hidden bg-[#0c0e12]">
                                            <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                                                <h4 className="font-bold text-white text-sm uppercase tracking-wide">Transaction History</h4>
                                            </div>
                                            <div className="p-8 text-center text-white/20 text-sm italic">
                                                Full ledger details available in Finance Module.
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'history' && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 max-w-3xl">
                                        <h3 className="text-xs font-black text-white/30 uppercase tracking-[0.25em]">Audit Trail</h3>
                                        <div className="relative border-l border-white/10 ml-3 space-y-8 py-2">
                                            {activityLog.map((log, i) => (
                                                <div key={i} className="relative pl-8 group">
                                                    <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#1a1d23] border border-white/20 group-hover:border-primary group-hover:bg-primary transition-colors"></div>
                                                    <p className="text-sm font-bold text-white">{log.action}</p>
                                                    <p className="text-xs text-white/40 mt-0.5">
                                                        {new Date(log.date).toLocaleString()} • by <span className="text-primary">{log.user}</span>
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div >

            {/* Sub-Modals */}
            {
                isEditing && (
                    <EditStudentDetailsModal
                        student={syncedStudent}
                        onClose={() => setIsEditing(false)}
                        onSave={() => { setIsEditing(false); fetchData(); onUpdate(); }}
                    />
                )
            }
            {
                showGuardianEdit && (
                    <GuardianEditModal
                        type={showGuardianEdit}
                        initialData={showGuardianEdit === 'primary' ? parentData : guardianData}
                        parentId={parentData?.parent_id}
                        onClose={() => setShowGuardianEdit(null)}
                        onSave={() => { setShowGuardianEdit(null); fetchData(); onUpdate(); }}
                    />
                )
            }
            {
                showAssignClass && (
                    <AssignClassModal
                        student={syncedStudent}
                        onClose={() => setShowAssignClass(false)}
                        onSuccess={async (updatedData: any) => {
                            console.log('[ProfileModal] onSuccess received:', updatedData);

                            // Step 1: Immediately update UI for instant feedback
                            setSyncedStudent(prev => ({
                                ...prev,
                                assigned_class_id: updatedData.class_id,
                                assigned_class_name: updatedData.class_name,
                                grade: updatedData.grade || prev.grade,
                                enrollment_status: updatedData.enrollment_status || 'Active',
                                academic_year: updatedData.academic_year || prev.academic_year
                            }));
                            setShowAssignClass(false);

                            // Step 2: Verify persistence by re-reading from DB
                            try {
                                const { data: verifyData, error: verifyError } = await supabase
                                    .from('student_profiles')
                                    .select('assigned_class_id, enrollment_status, grade, school_classes:assigned_class_id(name, academic_year)')
                                    .eq('user_id', student.id)
                                    .maybeSingle();

                                console.log('[ProfileModal] Persistence verification:', { verifyData, verifyError });

                                if (verifyError) {
                                    console.error('[ProfileModal] Verification query failed:', verifyError);
                                } else if (!verifyData?.assigned_class_id || verifyData.assigned_class_id !== updatedData.class_id) {
                                    // DB does NOT reflect the assignment - the RPC likely rolled back
                                    console.error('[ProfileModal] PERSISTENCE FAILURE DETECTED!', {
                                        expected: updatedData.class_id,
                                        actual: verifyData?.assigned_class_id
                                    });
                                    alert(
                                        'WARNING: The class assignment may not have been saved permanently. ' +
                                        'Please check the Supabase SQL Editor and run the FIX_ACADEMIC_PLACEMENT_ULTIMATE.sql script. ' +
                                        'Then try assigning the class again.'
                                    );
                                    // Revert optimistic update to reflect true DB state
                                    setSyncedStudent(prev => ({
                                        ...prev,
                                        assigned_class_id: verifyData?.assigned_class_id || undefined,
                                        assigned_class_name: (verifyData?.school_classes as any)?.name || undefined,
                                        enrollment_status: verifyData?.enrollment_status || prev.enrollment_status,
                                        academic_year: (verifyData?.school_classes as any)?.academic_year || prev.academic_year
                                    }));
                                } else {
                                    console.log('[ProfileModal] Persistence VERIFIED. Class assignment is permanent.');
                                    // Refresh all data to ensure full consistency
                                    fetchData();
                                }
                            } catch (verifyErr) {
                                console.error('[ProfileModal] Verification check failed:', verifyErr);
                                // Still try a full refresh as fallback
                                fetchData();
                            }

                            onUpdate();
                        }}
                    />
                )
            }
            {
                showPayment && (
                    <RecordPaymentModal
                        studentId={student.id}
                        studentName={student.display_name}
                        onClose={() => setShowPayment(false)}
                        onSuccess={() => { setShowPayment(false); fetchData(); onUpdate(); }}
                    />
                )
            }
        </div >
    );
};

export default StudentProfileModal;
