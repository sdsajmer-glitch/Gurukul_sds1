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
import PersonalMatrix from './PersonalMatrix/PersonalMatrix';
import ComplianceDossier from './ComplianceDossier/ComplianceDossier';
import DocumentAssetRegistry from './DocumentAssetRegistry/DocumentAssetRegistry';
import AcademicPortfolio from './AcademicPortfolio/AcademicPortfolio';
import StudentResponse from './StudentResponse/StudentResponse';
import LiveTimetable from './LiveTimetable/LiveTimetable';
import WorkloadCore from './WorkloadCore/WorkloadCore';
import SecurityCommandNode from './SecurityCommandNode/SecurityCommandNode';
import GovernanceAudit from './GovernanceAudit/GovernanceAudit';

interface TeacherDetailModalProps {
    teacher: TeacherExtended;
    onClose: () => void;
    onUpdate: () => void;
}

type TabType = 'personal' | 'compliance' | 'portfolio' | 'response' | 'timetable' | 'workload' | 'governance' | 'vault' | 'security';

const generateEmployeeId = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `EMP-${year}-${random}`;
};

const TabButton: React.FC<{ label: string; id: TabType; activeId: TabType; onClick: (id: TabType) => void; icon: React.ReactNode; isHeader?: boolean }> = ({ label, id, activeId, onClick, icon, isHeader }) => {
    if (isHeader) return <p className="px-8 py-6 text-[9px] font-black text-white/10 uppercase tracking-[0.4em] mb-2">{label}</p>;
    return (
        <button
            onClick={() => onClick(id)}
            className={`w-full flex items-center gap-4 px-8 py-5 text-[11px] font-black uppercase tracking-widest border-l-4 transition-all whitespace-nowrap relative group ${activeId === id
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
};

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
                    <option value="" className="bg-[#0d0f14]">Select Option...</option>
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
                    {value || 'No Information'}
                </p>
                {readOnly && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-primary/5 text-[8px] font-black text-primary/40 uppercase tracking-widest border border-primary/10">System</span>
                )}
                {!value && !isEditing && (
                    <span className="text-[8px] font-black text-amber-500/30 uppercase tracking-[0.2em] border border-amber-500/10 px-2 py-0.5 rounded-lg">Update Required</span>
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
        if (activeTab === 'vault') fetchDocs();
        if (activeTab === 'portfolio') fetchMappings();
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

                {/* Header Section */}
                <div className="p-10 border-b border-white/5 bg-white/[0.01] backdrop-blur-3xl flex flex-col md:flex-row justify-between items-center gap-10 flex-shrink-0 z-10 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent pointer-events-none"></div>

                    <div className="flex items-center gap-10 relative z-10">
                        <div className="relative group">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="w-32 h-32 rounded-[3rem] bg-gradient-to-br from-[#12141c] to-[#1a1d26] flex items-center justify-center text-white text-5xl font-black shadow-[0_32px_64px_-16px_rgba(0,0,0,1)] border-4 border-white/5 overflow-hidden transform group-hover:rotate-2 transition-transform duration-700 relative"
                            >
                                {teacher.details?.profile_picture_url ? (
                                    <img src={teacher.details.profile_picture_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={teacher.display_name} />
                                ) : (
                                    <span className="opacity-20 font-serif italic">{teacher.display_name.charAt(0)}</span>
                                )}
                            </motion.div>
                            <div className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-full border-4 border-[#0d0f14] flex items-center justify-center shadow-2xl z-20 ${teacher.is_active ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : 'bg-red-500 shadow-[0_0_15px_#ef4444]'}`}>
                                {teacher.is_active ? <CheckCircleIcon className="w-5 h-5 text-white" /> : <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center"><XIcon className="w-3.5 h-3.5 text-red-500" /></div>}
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-4 mb-3">
                                <h2 className="text-4xl font-serif font-black text-white uppercase tracking-tighter">{teacher.display_name}</h2>
                                <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border backdrop-blur-md shadow-2xl ${teacher.details?.employment_status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                    {teacher.details?.employment_status || 'TEMPORARY'}
                                </span>
                                <div className="flex items-center gap-2 px-3 py-1 bg-white/[0.02] border border-white/5 rounded-lg">
                                    <div className="w-1 h-1 rounded-full bg-primary animate-pulse"></div>
                                    <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Connected</span>
                                </div>
                            </div>
                            <p className="text-[11px] font-black text-white/40 uppercase tracking-[0.4em] flex items-center gap-4">
                                <div className="p-1 px-3 bg-primary/10 rounded-lg text-primary text-[9px] font-black ring-1 ring-primary/20">SENIOR FACULTY</div>
                                <span className="text-white/10">|</span>
                                <span className="text-white/60">{teacher.details?.subject || 'GENERAL STUDIES'} — {teacher.details?.department || 'ACADEMIC_POOL'}</span>
                            </p>
                            <div className="flex flex-wrap items-center gap-6 mt-6">
                                <div className="flex items-center gap-2.5 text-[10px] font-black text-white/20 uppercase tracking-widest hover:text-white transition-colors cursor-pointer group/stat">
                                    <MailIcon className="w-3.5 h-3.5 opacity-40 group-hover/stat:text-primary transition-colors" /> {teacher.email}
                                </div>
                                <div className="flex items-center gap-2.5 text-[10px] font-black text-white/20 uppercase tracking-widest hover:text-white transition-colors cursor-pointer group/stat">
                                    <PhoneIcon className="w-3.5 h-3.5 opacity-40 group-hover/stat:text-primary transition-colors" /> {teacher.phone || 'No Contact'}
                                </div>
                                <div className="px-4 py-1.5 rounded-xl bg-white/5 text-white/40 font-mono text-[9px] font-bold border border-white/5 shadow-inner">Reference ID: {formData.employee_id || '---'}</div>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => alert('Messaging System Initialized...')} className="px-8 py-4 bg-primary text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-3">
                            <CommunicationIcon className="w-4 h-4" /> Message
                        </motion.button>
                        <button onClick={onClose} className="p-4 rounded-2xl hover:bg-white/5 text-white/20 hover:text-white transition-all border border-transparent hover:border-white/10 group"><XIcon className="w-7 h-7 group-hover:rotate-90 transition-transform duration-300" /></button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row flex-grow overflow-hidden">
                    {/* Command Sidebar Navigation */}
                    <div className="w-full md:w-80 bg-black/20 border-r border-white/5 flex-shrink-0 overflow-y-auto custom-scrollbar">
                        <nav className="p-6 space-y-1">
                            <TabButton id="personal" label="Profile Overview" isHeader={true} activeId={activeTab} onClick={setActiveTab} icon={null} />
                            <TabButton id="personal" label="Personal Profile" activeId={activeTab} onClick={setActiveTab} icon={<UserIcon className="w-4 h-4" />} />
                            <TabButton id="compliance" label="Compliance Records" activeId={activeTab} onClick={setActiveTab} icon={<BriefcaseIcon className="w-4 h-4" />} />

                            <TabButton id="personal" label="Academic Management" isHeader={true} activeId={activeTab} onClick={setActiveTab} icon={null} />
                            <TabButton id="portfolio" label="Academic Records" activeId={activeTab} onClick={setActiveTab} icon={<BookIcon className="w-4 h-4" />} />
                            <TabButton id="response" label="Student Feedback" activeId={activeTab} onClick={setActiveTab} icon={<UsersIcon className="w-4 h-4" />} />
                            <TabButton id="timetable" label="Timetable" activeId={activeTab} onClick={setActiveTab} icon={<TimetableIcon className="w-4 h-4" />} />
                            <TabButton id="workload" label="Workload Management" activeId={activeTab} onClick={setActiveTab} icon={<ChartBarIcon className="w-4 h-4" />} />

                            <TabButton id="personal" label="Documents & Security" isHeader={true} activeId={activeTab} onClick={setActiveTab} icon={null} />
                            <TabButton id="governance" label="Activity Log" activeId={activeTab} onClick={setActiveTab} icon={<ActivityIcon className="w-4 h-4" />} />
                            <TabButton id="vault" label="Documents" activeId={activeTab} onClick={setActiveTab} icon={<FileTextIcon className="w-4 h-4" />} />
                            <TabButton id="security" label="Security Settings" activeId={activeTab} onClick={setActiveTab} icon={<ShieldCheckIcon className="w-4 h-4" />} />
                        </nav>
                    </div>

                    {/* Content Viewport */}
                    <div className="flex-grow overflow-y-auto p-12 bg-[#0d0f14] relative custom-scrollbar">
                        <AnimatePresence mode="wait">
                            {/* Tab-Specific Editing Controls */}
                            {['personal', 'compliance'].includes(activeTab) && (
                                <div className="absolute top-10 right-10 z-10 flex items-center gap-6">
                                    {!isEditing && (
                                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] bg-white/[0.02] px-4 py-2 rounded-xl border border-white/5">Editable by: HR / Admin</p>
                                    )}
                                    {isEditing ? (
                                        <div className="flex gap-2">
                                            <button onClick={() => setIsEditing(false)} className="px-6 py-3 bg-white/5 text-white/40 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">Discard</button>
                                            <button onClick={handleSaveProfile} disabled={isSavingProfile} className="px-6 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-3">
                                                {isSavingProfile ? <Spinner size="sm" className="text-current" /> : <><SaveIcon className="w-4 h-4" /> Commit Changes</>}
                                            </button>
                                        </div>
                                    ) : (
                                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setIsEditing(true)} className="px-6 py-3 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-2xl transition-all">
                                            <EditIcon className="w-4 h-4" /> Edit Information
                                        </motion.button>
                                    )}
                                </div>
                            )}

                            {activeTab === 'personal' && (
                                <PersonalMatrix
                                    teacher={teacher}
                                    onUpdate={onUpdate}
                                />
                            )}

                            {activeTab === 'compliance' && (
                                <ComplianceDossier
                                    teacher={teacher}
                                    onUpdate={onUpdate}
                                />
                            )}

                            {activeTab === 'portfolio' && (
                                <AcademicPortfolio
                                    teacher={teacher}
                                    mappings={mappings}
                                    loadingMappings={loadingMappings}
                                    onMapRequest={() => setIsAssignModalOpen(true)}
                                    onUnmapRequest={(id, subjectName, className) => setConfirmationAction({
                                        type: 'unmap_subject',
                                        title: 'Subject Unlinked',
                                        message: `Are you sure you want to decouple ${teacher.display_name} from ${subjectName} (${className})? This action will be archived in the activity log.`,
                                        targetId: id
                                    })}
                                />
                            )}

                            {activeTab === 'response' && (
                                <StudentResponse teacher={teacher} />
                            )}

                            {activeTab === 'timetable' && (
                                <LiveTimetable teacher={teacher} />
                            )}

                            {activeTab === 'workload' && (
                                <WorkloadCore
                                    teacher={teacher}
                                    workloadHours={workloadHours}
                                    maxLoad={maxLoad}
                                />
                            )}

                            {activeTab === 'vault' && (
                                <DocumentAssetRegistry
                                    teacher={teacher}
                                    docs={docs}
                                    loadingDocs={loadingDocs}
                                    onArchiveClick={() => alert('Document archived successfully.')}
                                />
                            )}

                            {activeTab === 'security' && (
                                <SecurityCommandNode teacher={teacher} />
                            )}

                            {activeTab === 'governance' && (
                                <GovernanceAudit teacher={teacher} />
                            )}

                        </AnimatePresence>
                    </div>
                </div >
            </div >

            <ConfirmationModal
                isOpen={!!confirmationAction}
                onClose={() => setConfirmationAction(null)}
                onConfirm={executeAccountAction}
                title={confirmationAction?.title || ''}
                message={confirmationAction?.message || ''}
                loading={processingAction}
                confirmText="Execute"
            />

            {
                isOffboarding && (
                    <OffboardingModal
                        teacher={teacher}
                        onClose={() => setIsOffboarding(false)}
                        onSuccess={() => { setIsOffboarding(false); onUpdate(); onClose(); }}
                    />
                )
            }

            {
                isAssignModalOpen && (
                    <AssignSubjectModal
                        teacher={teacher}
                        onClose={() => setIsAssignModalOpen(false)}
                        onSuccess={() => { setIsAssignModalOpen(false); fetchMappings(); }}
                    />
                )
            }
        </div >
    );
};

export default TeacherDetailModal;