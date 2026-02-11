import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TeacherExtended, TeacherDocument, SchoolClass, Course, TeacherSubjectMapping } from '../types';
import { supabase, formatError } from '../services/supabase';
import Spinner from './common/Spinner';
import { XIcon } from './icons/XIcon';
import { UserIcon } from './icons/UserIcon';
import { MailIcon } from './icons/MailIcon';
import { PhoneIcon } from './icons/PhoneIcon';
import { BriefcaseIcon } from './icons/BriefcaseIcon';
import { BookIcon } from './icons/BookIcon';
import { FileTextIcon } from './icons/FileTextIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { XCircleIcon } from './icons/XCircleIcon';
import { ClockIcon } from './icons/ClockIcon';
// Fix: Added missing CalendarIcon import to resolve "Cannot find name" errors in InfoRow usage.
import { CalendarIcon } from './icons/CalendarIcon';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { ShieldCheckIcon } from './icons/ShieldCheckIcon';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon';
import ConfirmationModal from './common/ConfirmationModal';
import { TimetableIcon } from './icons/TimetableIcon';
import { CommunicationIcon } from './icons/CommunicationIcon';
import { EditIcon } from './icons/EditIcon';
import { SaveIcon } from './icons/SaveIcon';
import OffboardingModal from './teachers/OffboardingModal';
// Fix: Removed duplicate ClockIcon import to resolve "Duplicate identifier" compiler error.
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { UsersIcon } from './icons/UsersIcon';
import { GridIcon } from './icons/GridIcon';
import { InfoIcon } from './icons/InfoIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { ActivityIcon } from './icons/ActivityIcon';
import { ShieldAlertIcon } from './icons/ShieldAlertIcon';
import { KeyIcon } from './icons/KeyIcon';
import AssignSubjectModal from './teachers/AssignSubjectModal';

interface TeacherDetailModalProps {
    teacher: TeacherExtended;
    onClose: () => void;
    onUpdate: () => void;
}

type TabType = 'personal' | 'employment' | 'academics' | 'timetable' | 'documents' | 'attendance' | 'performance' | 'account';

const generateEmployeeId = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `EMP-${year}-${random}`;
};

const TabButton: React.FC<{ label: string; id: TabType; activeId: TabType; onClick: (id: TabType) => void; icon: React.ReactNode }> = ({ label, id, activeId, onClick, icon }) => (
    <button
        onClick={() => onClick(id)}
        className={`flex items-center gap-4 px-8 py-5 text-[11px] font-black uppercase tracking-widest border-l-4 transition-all whitespace-nowrap relative group ${activeId === id
            ? 'border-primary text-white bg-white/[0.03] shadow-inner'
            : 'border-transparent text-white/30 hover:text-white hover:bg-white/[0.01]'
            }`}
    >
        {activeId === id && (
            <motion.div
                layoutId="activeTabGlow"
                className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent"
                initial={false}
            />
        )}
        <span className={`transition-colors relative z-10 ${activeId === id ? 'text-primary' : 'text-white/10 group-hover:text-white/40'}`}>{icon}</span>
        <span className="relative z-10">{label}</span>
    </button>
);

const InfoRow: React.FC<{
    label: string;
    value?: string | number | null;
    fullWidth?: boolean;
    isEditing?: boolean;
    readOnly?: boolean;
    onChange?: (val: string) => void;
    type?: string;
    options?: string[];
    icon?: React.ReactNode;
    required?: boolean;
}> = ({ label, value, fullWidth, isEditing, readOnly, onChange, type = "text", options, icon, required }) => (
    <div className={`py-6 border-b border-white/5 last:border-0 ${fullWidth ? 'col-span-full' : ''} group`}>
        <div className="flex items-center gap-3 mb-3">
            {icon && <span className={`transition-all duration-500 ${isEditing ? 'text-primary scale-110' : 'text-white/10 group-hover:text-white/30 group-hover:scale-110'}`}>{icon}</span>}
            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">{label}</p>
            {required && isEditing && <span className="text-primary text-[10px] font-black">*</span>}
        </div>
        {isEditing && !readOnly && onChange ? (
            options ? (
                <select
                    value={value?.toString() || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full p-4 rounded-2xl border border-white/5 bg-black/40 text-sm font-bold text-white focus:ring-[12px] focus:ring-primary/5 focus:border-primary/40 outline-none transition-all appearance-none cursor-pointer"
                >
                    <option value="" className="bg-[#0d0f14]">Select Protocol...</option>
                    {options.map(opt => <option key={opt} value={opt} className="bg-[#0d0f14]">{opt.toUpperCase()}</option>)}
                </select>
            ) : (
                <input
                    type={type}
                    value={value?.toString() || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full p-4 rounded-2xl border border-white/5 bg-black/40 text-sm font-bold text-white focus:ring-[12px] focus:ring-primary/5 focus:border-primary/40 outline-none transition-all placeholder:text-white/5"
                    placeholder={`Enter ${label}...`}
                />
            )
        ) : (
            <div className="flex items-center gap-3">
                <p className={`text-lg font-serif font-black text-white tracking-tight pl-1 ${!value ? 'opacity-10' : ''}`}>
                    {value || 'DATA_SILENT'}
                </p>
                {readOnly && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-primary/5 text-[8px] font-black text-primary/40 uppercase tracking-widest border border-primary/10">CORE_SYSTEM</span>
                )}
                {!value && !isEditing && (
                    <span className="text-[8px] font-black text-amber-500/30 uppercase tracking-[0.2em] border border-amber-500/10 px-2 py-0.5 rounded-lg">SYNC_NEEDED</span>
                )}
            </div>
        )}
    </div>
);

const SectionTitle: React.FC<{ title: string, icon?: React.ReactNode, action?: React.ReactNode }> = ({ title, icon, action }) => (
    <div className="flex justify-between items-center mb-10 pb-6 border-b border-white/5">
        <h3 className="text-2xl font-serif font-black text-white flex items-center gap-4 tracking-tighter uppercase">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-2xl ring-1 ring-primary/20">
                {icon}
            </div>
            {title}
        </h3>
        {action}
    </div>
);

const TeacherDetailModal: React.FC<TeacherDetailModalProps> = ({ teacher, onClose, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<TabType>('personal');
    const [isEditing, setIsEditing] = useState(false);
    const [processingAction, setProcessingAction] = useState(false);
    const [isOffboarding, setIsOffboarding] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [confirmationAction, setConfirmationAction] = useState<{ type: 'reset_password' | 'toggle_active' | 'unmap_subject', title: string, message: string, targetId?: number } | null>(null);

    const [formData, setFormData] = useState({
        display_name: teacher.display_name,
        phone: teacher.phone || '',
        email: teacher.email,
        bio: teacher.details?.bio || '',
        gender: teacher.details?.gender || '',
        date_of_birth: teacher.details?.date_of_birth || '',
        department: teacher.details?.department || '',
        designation: teacher.details?.designation || '',
        employee_id: teacher.details?.employee_id || '',
        employment_type: teacher.details?.employment_type || '',
        employment_status: teacher.details?.employment_status || 'Active',
        date_of_joining: teacher.details?.date_of_joining || '',
        qualification: teacher.details?.qualification || '',
        specializations: teacher.details?.specializations || '',
        subject: teacher.details?.subject || '',
        workload_limit: teacher.details?.workload_limit || 30
    });

    const [docs, setDocs] = useState<TeacherDocument[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [mappings, setMappings] = useState<TeacherSubjectMapping[]>([]);
    const [loadingMappings, setLoadingMappings] = useState(false);

    // Mock Security Data
    const securityLogs = [
        { id: 1, action: 'Successful Login', location: 'Jaipur, India', device: 'Chrome / Windows', time: '2 hours ago' },
        { id: 2, action: 'Profile Updated', location: 'Jaipur, India', device: 'Chrome / Windows', time: 'Yesterday' },
        { id: 3, action: 'Password Changed', location: 'Admin Console', device: 'System Process', time: '3 days ago' },
    ];

    useEffect(() => {
        if (!formData.employee_id) {
            setFormData(prev => ({ ...prev, employee_id: generateEmployeeId() }));
        }
    }, [formData.employee_id]);

    const fetchDocs = useCallback(async () => {
        setLoadingDocs(true);
        const { data, error } = await supabase.rpc('get_teacher_documents', { p_teacher_id: teacher.id });
        if (!error && data) setDocs(data);
        setLoadingDocs(false);
    }, [teacher.id]);

    const fetchMappings = useCallback(async () => {
        setLoadingMappings(true);
        const { data: mappingData, error } = await supabase
            .from('class_subjects')
            .select(`
                id, class_id, subject_id,
                school_classes(name, academic_year, section, grade_level),
                courses(title, credits, category)
            `)
            .eq('teacher_id', teacher.id);

        if (!error && mappingData) {
            setMappings(mappingData.map((m: any) => ({
                id: m.id,
                teacher_id: teacher.id,
                subject_id: m.subject_id,
                class_id: m.class_id,
                academic_year: m.school_classes?.academic_year || 'Not Set',
                class_name: m.school_classes?.name,
                subject_name: m.courses?.title,
                credits: m.courses?.credits,
                category: m.courses?.category
            })));
        }
        setLoadingMappings(false);
    }, [teacher.id]);

    useEffect(() => {
        if (activeTab === 'documents') fetchDocs();
        if (activeTab === 'academics') fetchMappings();
    }, [activeTab, fetchDocs, fetchMappings]);

    // Workload Calculation for Analytics & Stewardship
    const workloadHours = useMemo(() => {
        // Calculation based on course credits/frequency
        return mappings.reduce((acc, m: any) => acc + (m.credits || 4), 0);
    }, [mappings]);

    const maxLoad = formData.workload_limit || 30;
    const loadPercentage = Math.min((workloadHours / maxLoad) * 100, 100);

    const handleSaveProfile = async () => {
        if (!formData.display_name.trim()) {
            alert("Full Name is a mandatory field.");
            return;
        }

        setIsSavingProfile(true);
        try {
            const { error: pError } = await supabase.from('profiles').update({
                display_name: formData.display_name,
                phone: formData.phone
            }).eq('id', teacher.id);
            if (pError) throw pError;

            const { error: tpError } = await supabase.from('teacher_profiles').update({
                bio: formData.bio,
                gender: formData.gender,
                date_of_birth: formData.date_of_birth || null,
                department: formData.department,
                designation: formData.designation,
                employee_id: formData.employee_id,
                employment_type: formData.employment_type,
                employment_status: formData.employment_status,
                date_of_joining: formData.date_of_joining || null,
                qualification: formData.qualification,
                specializations: formData.specializations,
                subject: formData.subject,
                workload_limit: formData.workload_limit
            }).eq('user_id', teacher.id);
            if (tpError) throw tpError;

            setIsEditing(false);
            onUpdate();
        } catch (err: any) {
            alert(`Save failed: ${formatError(err)}`);
        } finally {
            setIsSavingProfile(false);
        }
    };

    const executeAccountAction = async () => {
        if (!confirmationAction) return;
        setProcessingAction(true);
        try {
            if (confirmationAction.type === 'reset_password') {
                const { error } = await supabase.auth.resetPasswordForEmail(teacher.email, { redirectTo: window.location.origin });
                if (error) throw error;
                alert("Security reset instructions have been dispatched to their email.");
            } else if (confirmationAction.type === 'toggle_active') {
                const { error } = await supabase.from('profiles').update({ is_active: !teacher.is_active }).eq('id', teacher.id);
                if (error) throw error;
                onUpdate();
            } else if (confirmationAction.type === 'unmap_subject' && confirmationAction.targetId) {
                const { error } = await supabase.from('class_subjects').update({ teacher_id: null }).eq('id', confirmationAction.targetId);
                if (error) throw error;
                fetchMappings();
                onUpdate();
            }
            setConfirmationAction(null);
        } catch (err: any) {
            alert(formatError(err));
        } finally {
            setProcessingAction(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-background w-full max-w-6xl h-[92vh] rounded-[2.5rem] shadow-2xl border border-white/10 flex flex-col overflow-hidden relative ring-1 ring-black/5" onClick={e => e.stopPropagation()}>

                {/* Header Profile Section */}
                <div className="p-10 border-b border-white/5 bg-white/[0.01] backdrop-blur-3xl flex flex-col md:flex-row justify-between items-center gap-10 flex-shrink-0 z-10 relative overflow-hidden">
                    <div className="absolute -top-20 -right-20 w-80 h-80 bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>

                    <div className="flex items-center gap-10 relative z-10">
                        <div className="relative group">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="w-32 h-32 rounded-[3rem] bg-gradient-to-br from-[#12141c] to-[#1a1d26] flex items-center justify-center text-white text-5xl font-black shadow-[0_32px_64px_-16px_rgba(0,0,0,1)] border-4 border-white/5 overflow-hidden transform group-hover:rotate-2 transition-transform duration-700"
                            >
                                {teacher.details?.profile_picture_url ? (
                                    <img src={teacher.details.profile_picture_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={teacher.display_name} />
                                ) : (
                                    <span className="opacity-20 font-serif italic">{teacher.display_name.charAt(0)}</span>
                                )}
                            </motion.div>
                            <div className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-full border-4 border-[#0d0f14] flex items-center justify-center shadow-2xl z-20 ${teacher.is_active ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : 'bg-red-500 shadow-[0_0_15px_#ef4444]'}`}>
                                {teacher.is_active ? <CheckCircleIcon className="w-5 h-5 text-white" /> : <XCircleIcon className="w-5 h-5 text-white" />}
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-4 mb-3">
                                <h2 className="text-4xl font-serif font-black text-white uppercase tracking-tighter">{teacher.display_name}</h2>
                                <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border backdrop-blur-md shadow-2xl ${teacher.details?.employment_status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    }`}>
                                    {teacher.details?.employment_status || 'OFFLINE_NODE'}
                                </span>
                            </div>
                            <p className="text-sm font-black text-white/40 uppercase tracking-[0.4em] flex items-center gap-3">
                                <BriefcaseIcon className="w-5 h-5 text-primary/40" />
                                {teacher.details?.designation || 'FACULTY_NODE'} <span className="text-white/10">—</span> <span className="text-white/60">{teacher.details?.department || 'UNALLOCATED_DEPT'}</span>
                            </p>
                            <div className="flex flex-wrap items-center gap-6 mt-6">
                                <span className="flex items-center gap-2.5 text-[11px] font-black text-white/20 uppercase tracking-widest hover:text-white transition-colors cursor-pointer"><MailIcon className="w-4 h-4 opacity-40" /> {teacher.email}</span>
                                <span className="flex items-center gap-2.5 text-[11px] font-black text-white/20 uppercase tracking-widest hover:text-white transition-colors cursor-pointer"><PhoneIcon className="w-4 h-4 opacity-40" /> {teacher.phone || 'NO_UPLINK'}</span>
                                <span className="px-4 py-1.5 rounded-xl bg-white/5 text-white/40 font-mono text-[10px] font-bold border border-white/5 shadow-inner">ID__{formData.employee_id || '---'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => alert('Feature coming soon: Live Chat Integration')} className="px-6 py-3 bg-primary text-primary-foreground font-black text-sm rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2 transform active:scale-95">
                            <CommunicationIcon className="w-4 h-4" /> Message
                        </button>
                        <button onClick={onClose} className="p-3 rounded-2xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border"><XIcon className="w-6 h-6" /></button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row flex-grow overflow-hidden">
                    {/* Navigation Sidebar */}
                    <div className="w-full md:w-80 bg-black/20 border-r border-white/5 flex-shrink-0 overflow-y-auto custom-scrollbar">
                        <nav className="p-6 space-y-2">
                            <p className="px-5 py-6 text-[9px] font-black text-white/10 uppercase tracking-[0.4em]">Registry Profile</p>
                            <TabButton id="personal" label="Personal Matrix" activeId={activeTab} onClick={setActiveTab} icon={<UserIcon className="w-5 h-5" />} />
                            <TabButton id="employment" label="Compliance Node" activeId={activeTab} onClick={setActiveTab} icon={<BriefcaseIcon className="w-5 h-5" />} />

                            <p className="px-5 py-6 mt-8 text-[9px] font-black text-white/10 uppercase tracking-[0.4em]">Academic Control</p>
                            <TabButton id="academics" label="Subject Mapping" activeId={activeTab} onClick={setActiveTab} icon={<BookIcon className="w-5 h-5" />} />
                            <TabButton id="timetable" label="Live Timetable" activeId={activeTab} onClick={setActiveTab} icon={<TimetableIcon className="w-5 h-5" />} />
                            <TabButton id="performance" label="Workload Core" activeId={activeTab} onClick={setActiveTab} icon={<ChartBarIcon className="w-5 h-5" />} />

                            <p className="px-5 py-6 mt-8 text-[9px] font-black text-white/10 uppercase tracking-[0.4em]">Archives & Vault</p>
                            <TabButton id="documents" label="Document Safe" activeId={activeTab} onClick={setActiveTab} icon={<FileTextIcon className="w-5 h-5" />} />
                            <TabButton id="account" label="Security Protocol" activeId={activeTab} onClick={setActiveTab} icon={<ShieldCheckIcon className="w-5 h-5" />} />
                        </nav>
                    </div>

                    {/* Content Viewport */}
                    <div className="flex-grow overflow-y-auto p-12 bg-[#0d0f14] relative custom-scrollbar">
                        <AnimatePresence mode="wait">

                            {/* Tab-Specific Editing Controls */}
                            {['personal', 'employment'].includes(activeTab) && (
                                <div className="absolute top-10 right-10 z-10">
                                    {isEditing ? (
                                        <div className="flex gap-2">
                                            <button onClick={() => setIsEditing(false)} className="px-5 py-2.5 bg-muted text-muted-foreground rounded-xl text-xs font-black hover:bg-muted/80 transition-colors">Discard</button>
                                            <button onClick={handleSaveProfile} disabled={isSavingProfile} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2">
                                                {isSavingProfile ? <Spinner size="sm" className="text-current" /> : <><SaveIcon className="w-4 h-4" /> Commit Changes</>}
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={() => setIsEditing(true)} className="px-5 py-2.5 bg-card hover:bg-muted text-foreground rounded-xl text-xs font-black flex items-center gap-2 border border-border shadow-sm transition-all hover:-translate-y-0.5">
                                            <EditIcon className="w-4 h-4" /> Edit Information
                                        </button>
                                    )}
                                </div>
                            )}

                            {activeTab === 'personal' && (
                                <motion.div
                                    key="personal"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="max-w-4xl space-y-12"
                                >
                                    <SectionTitle title="Personal Information" icon={<UserIcon className="w-6 h-6" />} />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4">
                                        <InfoRow label="Full Name" value={formData.display_name} isEditing={isEditing} required={true} onChange={v => setFormData({ ...formData, display_name: v })} icon={<UserIcon className="w-4 h-4" />} />
                                        <InfoRow label="Gender" value={formData.gender} isEditing={isEditing} onChange={v => setFormData({ ...formData, gender: v })} options={['Male', 'Female', 'Other']} icon={<UserIcon className="w-4 h-4" />} />
                                        <InfoRow label="Date of Birth" value={formData.date_of_birth} isEditing={isEditing} onChange={v => setFormData({ ...formData, date_of_birth: v })} type="date" icon={<CalendarIcon className="w-4 h-4" />} />
                                        <InfoRow label="Contact Phone" value={formData.phone} isEditing={isEditing} onChange={v => setFormData({ ...formData, phone: v })} icon={<PhoneIcon className="w-4 h-4" />} />
                                        <InfoRow label="Email Address" value={formData.email} readOnly={true} icon={<MailIcon className="w-4 h-4" />} />
                                        <InfoRow label="Primary Qualification" value={formData.qualification} isEditing={isEditing} onChange={v => setFormData({ ...formData, qualification: v })} icon={<BookIcon className="w-4 h-4" />} />

                                        <div className="col-span-full pt-12">
                                            <div className="flex items-center gap-4 mb-6 ml-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_#3b82f6]"></div>
                                                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em]">Professional Biography</p>
                                            </div>
                                            {isEditing ? (
                                                <textarea
                                                    value={formData.bio}
                                                    onChange={e => setFormData({ ...formData, bio: e.target.value })}
                                                    className="w-full p-8 bg-black/40 rounded-[2.5rem] border border-white/5 text-sm font-bold text-white focus:ring-[16px] focus:ring-primary/5 transition-all h-48 resize-none outline-none leading-relaxed placeholder:text-white/5 shadow-inner"
                                                    placeholder="Curate faculty introduction..."
                                                />
                                            ) : (
                                                <div className="p-10 bg-[#0d0f14] rounded-[2.5rem] border border-white/5 shadow-2xl text-lg leading-loose text-white/40 font-medium font-serif italic relative overflow-hidden group">
                                                    <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:scale-110 transition-transform duration-1000">
                                                        <FileTextIcon className="w-32 h-32" />
                                                    </div>
                                                    {formData.bio || "DATA_MISSING: Biography has not been archived."}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'employment' && (
                                <motion.div
                                    key="employment"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="max-w-4xl space-y-12"
                                >
                                    <SectionTitle title="Work & Compliance" icon={<BriefcaseIcon className="w-6 h-6" />} />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-4">
                                        <InfoRow label="Employee ID" value={formData.employee_id} isEditing={isEditing} readOnly={true} icon={<div className="w-4 h-4 text-[10px] font-black border border-current rounded flex items-center justify-center">ID</div>} />
                                        <InfoRow label="Department" value={formData.department} isEditing={isEditing} onChange={v => setFormData({ ...formData, department: v })} icon={<GridIcon className="w-4 h-4" />} />
                                        <InfoRow label="Designation" value={formData.designation} isEditing={isEditing} onChange={v => setFormData({ ...formData, designation: v })} icon={<CheckCircleIcon className="w-4 h-4" />} />
                                        <InfoRow label="Joining Date" value={formData.date_of_joining} isEditing={isEditing} onChange={v => setFormData({ ...formData, date_of_joining: v })} type="date" icon={<CalendarIcon className="w-4 h-4" />} />
                                        <InfoRow label="Employment Type" value={formData.employment_type} isEditing={isEditing} onChange={v => setFormData({ ...formData, employment_type: v })} options={['Full-time', 'Part-time', 'Contract']} icon={<ClockIcon className="w-4 h-4" />} />
                                        <InfoRow label="Contract Status" value={formData.employment_status} isEditing={isEditing} onChange={v => setFormData({ ...formData, employment_status: v })} options={['Active', 'Pending Verification', 'On Leave', 'Inactive']} icon={<ShieldCheckIcon className="w-4 h-4" />} />
                                    </div>
                                    <div className="p-8 bg-primary/[0.02] border border-primary/10 rounded-[2.5rem] flex items-start gap-6 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:rotate-12 transition-transform duration-1000"><ShieldCheckIcon className="w-24 h-24" /></div>
                                        <div className="p-4 bg-primary/10 rounded-2xl text-primary shadow-2xl relative z-10">
                                            <InfoIcon className="w-6 h-6" />
                                        </div>
                                        <div className="relative z-10">
                                            <p className="text-xs font-black text-white/60 uppercase tracking-widest mb-1">Institutional Notice</p>
                                            <p className="text-sm text-white/30 leading-relaxed max-w-md">Financial data and background check renewals are managed in the HR & Compliance module by authorized personnel only.</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'academics' && (
                                <motion.div
                                    key="academics"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="max-w-4xl space-y-10"
                                >
                                    {/* Stewardship Summary Header */}
                                    <div className="p-10 bg-[#0d0f14] border border-white/5 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,1)] relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-10 opacity-[0.02] group-hover:scale-110 transition-transform duration-1000"><BookIcon className="w-40 h-40" /></div>
                                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-10">
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center gap-3 opacity-30">
                                                    <div className="w-6 h-[1px] bg-primary"></div>
                                                    <span className="text-[9px] font-black uppercase tracking-[0.4em]">Stewardship Matrix</span>
                                                </div>
                                                <h4 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Academic Control</h4>
                                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mt-1">Managing teaching loads and specialized assignments.</p>
                                                <div className="flex gap-10 mt-8">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black uppercase text-white/10 tracking-[0.2em] mb-1">Active Groups</span>
                                                        <span className="text-3xl font-black text-primary drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">{mappings.length}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black uppercase text-white/10 tracking-[0.2em] mb-1">Weekly Load</span>
                                                        <span className={`text-3xl font-black ${loadPercentage > 90 ? 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'text-white'}`}>{workloadHours} / {maxLoad} <span className="text-xs text-white/20 ml-1 font-serif italic tracking-normal">Hrs</span></span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setIsAssignModalOpen(true)}
                                                className="px-10 py-5 bg-primary text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-primary/30 hover:bg-primary/90 transition-all flex items-center gap-3 transform hover:-translate-y-1 active:scale-95 group"
                                            >
                                                <PlusIcon className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" /> Map New Subject
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {loadingMappings ? <div className="col-span-full flex justify-center py-20"><Spinner size="lg" /></div> : mappings.length === 0 ? (
                                            <div className="col-span-full p-24 text-center text-white/10 border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.01] flex flex-col items-center group hover:bg-white/[0.02] transition-colors">
                                                <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner ring-1 ring-white/5">
                                                    <BookIcon className="w-10 h-10 opacity-10 group-hover:scale-110 transition-transform duration-700" />
                                                </div>
                                                <h4 className="text-xl font-serif font-black text-white/40 uppercase tracking-tighter mb-4">No subjects mapped.</h4>
                                                <p className="text-[10px] font-black uppercase tracking-[0.3em] max-w-xs mx-auto leading-relaxed">
                                                    THIS NODE HAS NOT BEEN LINKED TO ANY ACTIVE REGISTRIES.
                                                </p>
                                            </div>
                                        ) : (
                                            mappings.map(map => (
                                                <div key={map.id} className="flex items-center gap-6 p-8 bg-[#12141c] border border-white/5 rounded-[2.5rem] shadow-2xl hover:border-primary/30 transition-all group overflow-hidden relative">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                    <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-500/10 text-indigo-400 flex flex-col items-center justify-center font-black border border-indigo-500/20 shadow-inner group-hover:scale-105 transition-all duration-500 shrink-0 relative z-10">
                                                        <span className="text-[9px] uppercase opacity-40 font-bold leading-none mb-1 tracking-tighter">GRD</span>
                                                        <span className="text-2xl font-serif italic leading-none">{map.class_name?.match(/\d+/)?.[0] || 'C'}</span>
                                                    </div>
                                                    <div className="flex-grow min-w-0 relative z-10">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <h4 className="font-serif font-black text-white text-xl tracking-tighter uppercase truncate">{map.subject_name}</h4>
                                                            <span className="text-[8px] font-black uppercase px-2.5 py-1 rounded-lg bg-white/5 text-white/30 border border-white/5 shrink-0 ml-3 tracking-widest">{map.category || 'CORE'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                                                                <GridIcon className="w-3.5 h-3.5 text-primary/40" /> {map.class_name}
                                                            </p>
                                                            <span className="w-1 h-1 rounded-full bg-white/10"></span>
                                                            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] flex items-center gap-2">
                                                                <ClockIcon className="w-4 h-4 opacity-30" /> {map.credits || 4} HR_LOAD
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 relative z-10">
                                                        <button
                                                            onClick={() => setConfirmationAction({
                                                                type: 'unmap_subject',
                                                                title: 'UNLINK PROTOCOL',
                                                                message: `Are you sure you want to unassign ${teacher.display_name} from ${map.subject_name} (${map.class_name})?`,
                                                                targetId: map.id
                                                            })}
                                                            className="p-3.5 rounded-2xl hover:bg-red-500/10 text-white/20 hover:text-red-500 transition-all border border-transparent hover:border-red-500/20"
                                                            title="Unmap Subject"
                                                        >
                                                            <TrashIcon className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'performance' && (
                                <motion.div
                                    key="performance"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="max-w-4xl space-y-12"
                                >
                                    <SectionTitle title="Workload Analysis" icon={<ChartBarIcon className="w-6 h-6" />} />

                                    <div className="p-12 bg-[#0d0f14] border border-white/5 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,1)] relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover:scale-110 transition-transform duration-1000"><UsersIcon className="w-48 h-48" /></div>
                                        <div className="flex justify-between items-end mb-10 relative z-10">
                                            <div>
                                                <h4 className="text-2xl font-serif font-black text-white uppercase tracking-tighter">Weekly Teaching Load</h4>
                                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mt-1">Analyzed against institutional standard of <span className="font-bold text-primary">{maxLoad} Hr_Protocol</span>.</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-[9px] font-black uppercase px-5 py-2.5 rounded-2xl shadow-inner border backdrop-blur-3xl ${loadPercentage > 90 ? 'bg-red-500/10 text-red-500 border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]'}`}>
                                                    {loadPercentage > 90 ? 'CRITICAL_OVERLOAD' : 'BALANCED_STABILITY'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="relative h-5 w-full bg-black/40 rounded-full overflow-hidden shadow-inner ring-1 ring-white/5 mb-6">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${loadPercentage}%` }}
                                                transition={{ duration: 1.5, ease: [0.23, 1, 0.32, 1] }}
                                                className={`h-full rounded-full shadow-2xl relative ${loadPercentage > 90 ? 'bg-red-500' : 'bg-gradient-to-r from-primary to-indigo-600'}`}
                                            >
                                                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.1)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.1)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[shine_3s_linear_infinite]"></div>
                                            </motion.div>
                                        </div>

                                        <div className="flex justify-between text-[9px] font-black text-white/10 uppercase tracking-[0.4em]">
                                            <span>00:00 HR</span>
                                            <span className="text-primary text-lg font-black tracking-normal opacity-100">{workloadHours} / {maxLoad} TOTAL_NODE_HR</span>
                                            <span>MAX_CAPACITY</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="p-10 bg-white/[0.01] border border-white/5 rounded-[2.5rem] text-center group hover:bg-white/[0.03] transition-all shadow-2xl border-dashed">
                                            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mb-4">Groups Handled</p>
                                            <p className="text-6xl font-serif font-black text-white group-hover:text-primary transition-all duration-500 group-hover:scale-110">{mappings.length}</p>
                                        </div>
                                        <div className="p-10 bg-white/[0.01] border border-white/5 rounded-[2.5rem] text-center group hover:bg-white/[0.03] transition-all shadow-2xl border-dashed">
                                            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mb-4">Student Reach</p>
                                            <p className="text-6xl font-serif font-black text-white group-hover:text-primary transition-all duration-500 group-hover:scale-110">~{mappings.length * 28}</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'documents' && (
                                <motion.div
                                    key="documents"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="max-w-4xl space-y-12"
                                >
                                    <SectionTitle
                                        title="Document Safe"
                                        icon={<FileTextIcon className="w-6 h-6" />}
                                        action={<button className="px-8 py-4 bg-primary text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-primary/30 hover:bg-primary/90 flex items-center gap-3 transition-all active:scale-95 transform hover:-translate-y-0.5"><PlusIcon className="w-5 h-5" /> Archive New File</button>}
                                    />

                                    {loadingDocs ? <div className="flex justify-center py-20"><Spinner size="lg" /></div> : docs.length === 0 ? (
                                        <div className="p-32 border-2 border-dashed border-white/5 rounded-[4rem] bg-white/[0.01] flex flex-col items-center group hover:bg-white/[0.02] transition-colors">
                                            <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mb-10 shadow-inner ring-1 ring-white/10">
                                                <FileTextIcon className="w-10 h-10 opacity-10 group-hover:scale-110 transition-transform duration-700" />
                                            </div>
                                            <h4 className="text-xl font-serif font-black text-white/40 uppercase tracking-tighter mb-4">Secure Vault is Empty</h4>
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] max-w-xs text-center leading-relaxed text-white/20">NO COMPLIANCE RECORDS OR CREDENTIALS HAVE BEEN ARCHIVED.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {docs.map(doc => (
                                                <div key={doc.id} className="bg-[#12141c] border border-white/5 rounded-[3rem] p-10 shadow-2xl hover:border-primary/30 transition-all group overflow-hidden relative">
                                                    <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000"><FileTextIcon className="w-32 h-32" /></div>
                                                    <div className="flex justify-between items-start mb-8 relative z-10">
                                                        <div className="p-4 bg-white/5 rounded-2xl text-white/40 group-hover:text-primary transition-colors ring-1 ring-white/5 shadow-inner">
                                                            <FileTextIcon className="w-7 h-7" />
                                                        </div>
                                                        <span className={`px-4 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-[0.2em] border backdrop-blur-3xl shadow-2xl ${doc.status === 'Verified' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                            }`}>
                                                            {doc.status}
                                                        </span>
                                                    </div>
                                                    <h4 className="font-serif font-black text-white text-xl uppercase tracking-tighter truncate mb-2 relative z-10">{doc.document_name}</h4>
                                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 relative z-10">{doc.document_type} <span className="text-white/5 mx-2">—</span> {new Date(doc.uploaded_at).toLocaleDateString()}</p>

                                                    <div className="mt-10 flex gap-3 relative z-10">
                                                        <button
                                                            onClick={() => window.open(supabase.storage.from('teacher-documents').getPublicUrl(doc.file_path).data.publicUrl, '_blank')}
                                                            className="flex-1 py-4 bg-primary/5 border border-primary/10 hover:border-primary/50 text-primary text-[9px] font-black rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] hover:bg-primary/10"
                                                        >
                                                            <InfoIcon className="w-4 h-4" /> Secure Display
                                                        </button>
                                                        <button className="p-4 bg-white/5 text-white/20 hover:text-white rounded-2xl transition-all border border-white/5 hover:bg-white/10 shadow-inner">
                                                            <DownloadIcon className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {activeTab === 'account' && (
                                <motion.div
                                    key="account"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="max-w-4xl space-y-12"
                                >
                                    <SectionTitle title="Security Protocol Center" icon={<ShieldCheckIcon className="w-6 h-6" />} />

                                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
                                        {/* Main Controls */}
                                        <div className="lg:col-span-3 space-y-8">
                                            <div className="bg-[#0b0c10] border border-white/5 rounded-[3rem] p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,1)] group hover:border-primary/30 transition-all relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-10 opacity-[0.02] group-hover:rotate-12 transition-transform duration-1000"><KeyIcon className="w-32 h-32" /></div>
                                                <h4 className="font-serif font-black text-2xl text-white uppercase tracking-tighter flex items-center gap-4 mb-8">
                                                    <div className="p-3 bg-primary/10 rounded-2xl text-primary ring-1 ring-primary/20"><KeyIcon className="w-6 h-6" /></div>
                                                    Authentication Matrix
                                                </h4>
                                                <p className="text-sm text-white/40 mb-10 leading-relaxed font-medium">Modify node accessibility or initiate a mandatory cryptographic reset for this institutional uplink.</p>
                                                <div className="flex flex-wrap gap-5">
                                                    <button onClick={() => setConfirmationAction({ type: 'reset_password', title: 'SECURITY_OVERRIDE', message: `Proceed with sending a secure password reset link to ${teacher.email}?` })} className="px-8 py-4 bg-white/5 hover:bg-white text-white/60 hover:text-black rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-white/5 shadow-inner flex items-center gap-3">
                                                        Reset Credentials
                                                    </button>
                                                    <button onClick={() => setConfirmationAction({ type: 'toggle_active', title: teacher.is_active ? 'REVOKE_NODE_ACCESS' : 'RESTORE_NODE_ACCESS', message: `Are you sure you want to ${teacher.is_active ? 'suspend' : 'reauthorize'} this portal immediately?` })} className={`px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center gap-3 ${teacher.is_active ? 'bg-red-600/10 text-red-500 border border-red-500/20 hover:bg-red-600 hover:text-white' : 'bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white'}`}>
                                                        {teacher.is_active ? <XCircleIcon className="w-5 h-5" /> : <CheckCircleIcon className="w-5 h-5" />}
                                                        {teacher.is_active ? 'Suspend Gateway' : 'Enable Gateway'}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="p-10 bg-red-600/[0.03] border border-red-600/10 rounded-[3rem] relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000"><ShieldAlertIcon className="w-40 h-40 text-red-500" /></div>
                                                <h4 className="text-red-500 font-serif font-black text-2xl uppercase tracking-tighter flex items-center gap-4 mb-4">
                                                    <ShieldAlertIcon className="w-7 h-7" /> Institutional Expulsion
                                                </h4>
                                                <p className="text-sm text-red-700/60 mb-8 max-w-sm font-medium leading-relaxed">Final resignation protocols and permanent record archival. This process handles automated class and department reassignments.</p>
                                                <button onClick={() => setIsOffboarding(true)} className="px-10 py-4 bg-white/5 hover:bg-red-600 hover:text-white border border-red-500/20 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-inner transition-all active:scale-95">Initiate Formal Offboarding</button>
                                            </div>
                                        </div>

                                        {/* Activity Log */}
                                        <div className="lg:col-span-2 space-y-8">
                                            <div className="bg-[#0d0f14] border border-white/5 rounded-[3rem] p-10 shadow-inner h-full flex flex-col relative overflow-hidden">
                                                <h4 className="font-black text-[10px] uppercase tracking-[0.4em] text-white/20 mb-10 flex items-center gap-3">
                                                    <ActivityIcon className="w-5 h-5 text-primary/40" /> Neural Activity Audit
                                                </h4>
                                                <div className="space-y-10 flex-grow relative z-10">
                                                    {securityLogs.map(log => (
                                                        <div key={log.id} className="relative pl-8 pb-2">
                                                            <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_10px_#3b82f6]"></div>
                                                            <div className="absolute left-[4px] top-4 w-[1px] h-full bg-white/5"></div>
                                                            <p className="text-[11px] font-black text-white uppercase tracking-widest leading-none">{log.action}</p>
                                                            <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mt-2">{log.device} <span className="text-white/5 mx-2">—</span> {log.time}</p>
                                                            <p className="text-[9px] text-white/10 font-mono mt-2 tracking-tighter uppercase">{log.location}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                <button className="mt-12 text-[9px] font-black uppercase tracking-[0.3em] text-primary/40 hover:text-primary transition-all flex items-center justify-center gap-3 border border-white/5 py-4 rounded-2xl bg-white/[0.01] hover:bg-primary/5">
                                                    <DownloadIcon className="w-4 h-4" /> Extract Full Audit Manifest
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Empty/Loading States for other tabs */}
                            {(['timetable', 'attendance'].includes(activeTab)) && (
                                <motion.div
                                    key="loading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="h-full flex flex-col items-center justify-center py-32 text-center"
                                >
                                    <div className="w-32 h-32 bg-white/[0.02] rounded-[3rem] flex items-center justify-center mb-10 border-2 border-dashed border-white/5 relative group">
                                        <div className="absolute inset-0 bg-primary/5 rounded-[3rem] animate-pulse"></div>
                                        <ClockIcon className="w-12 h-12 text-primary opacity-40 group-hover:rotate-180 transition-transform duration-1000" />
                                    </div>
                                    <h3 className="text-2xl font-serif font-black text-white uppercase tracking-tighter">Module Handshake</h3>
                                    <p className="text-[10px] font-black text-white/20 mt-4 max-w-xs uppercase tracking-[0.3em] leading-relaxed">
                                        SYNCHRONIZING REAL-TIME {activeTab.toUpperCase()} TELEMETRY INTO THE ADMINISTRATIVE NODE...
                                    </p>
                                </motion.div>
                            )}

                        </AnimatePresence>
                    </div>
                </div>
            </div>

            <ConfirmationModal
                isOpen={!!confirmationAction}
                onClose={() => setConfirmationAction(null)}
                onConfirm={executeAccountAction}
                title={confirmationAction?.title || ''}
                message={confirmationAction?.message || ''}
                loading={processingAction}
                confirmText="Execute"
            />

            {isOffboarding && (
                <OffboardingModal
                    teacher={teacher}
                    onClose={() => setIsOffboarding(false)}
                    onSuccess={() => { setIsOffboarding(false); onUpdate(); onClose(); }}
                />
            )}

            {isAssignModalOpen && (
                <AssignSubjectModal
                    teacher={teacher}
                    onClose={() => setIsAssignModalOpen(false)}
                    onSuccess={() => { setIsAssignModalOpen(false); fetchMappings(); }}
                />
            )}
        </div>
    );
};

export default TeacherDetailModal;