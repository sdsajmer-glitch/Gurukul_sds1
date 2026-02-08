import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, formatError } from '../../services/supabase';
import { AdmissionApplication } from '../../types';
import Spinner from '../common/Spinner';
import { XIcon } from '../icons/XIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import PremiumAvatar from '../common/PremiumAvatar';
import { UserIcon } from '../icons/UserIcon';
import { MailIcon } from '../icons/MailIcon';
import { PhoneIcon } from '../icons/PhoneIcon';
import { FileTextIcon } from '../icons/FileTextIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { EyeIcon } from '../icons/EyeIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { StorageService, BUCKETS } from '../../services/storage';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon } from '../icons/PlusIcon';
import { RefreshCwIcon } from '../icons/RefreshCwIcon';
import StudentProfileModal from '../students/StudentProfileModal';
import { StudentForAdmin } from '../../types';
import clsx from 'clsx';

interface AdmissionDetailsModalProps {
    admission: AdmissionApplication;
    onClose: () => void;
    onUpdate: () => void;
}

const AdmissionDetailsModal: React.FC<AdmissionDetailsModalProps> = ({ admission, onClose, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [docs, setDocs] = useState<any[]>([]);
    const [finalizeState, setFinalizeState] = useState<'idle' | 'processing' | 'success'>('idle');
    const [provisionedData, setProvisionedData] = useState<{ student_id: string; student_id_number: string } | null>(null);
    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [isRequestingDoc, setIsRequestingDoc] = useState(false);
    const [newDocName, setNewDocName] = useState('');
    const [requestingLoading, setRequestingLoading] = useState(false);
    const [expandedDoc, setExpandedDoc] = useState<number | null>(null);
    const [viewStudentProfile, setViewStudentProfile] = useState(false);
    const [studentData, setStudentData] = useState<StudentForAdmin | null>(null);

    const isMounted = useRef(true);

    const totalDocs = docs.length;
    const verifiedDocs = docs.filter(d => d.status === 'Verified').length;
    const mandatoryDocs = docs.filter(d => d.is_mandatory);
    const allMandatoryVerified = mandatoryDocs.length > 0 && mandatoryDocs.every(d => d.status === 'Verified');
    const progressPercentage = totalDocs > 0 ? Math.round((verifiedDocs / totalDocs) * 100) : 0;

    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    const fetchDocs = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('document_requirements')
                .select('*, admission_documents(*)')
                .eq('admission_id', admission.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            if (isMounted.current) setDocs(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            if (isMounted.current) setLoading(false);
        }
    }, [admission.id]);

    useEffect(() => {
        fetchDocs();
    }, [fetchDocs]);

    useEffect(() => {
        const fetchStudentNode = async () => {
            if (!admission.student_user_id) return;
            try {
                const { data, error } = await supabase
                    .from('student_profiles')
                    .select(`*, profiles!inner (*), school_classes (name)`)
                    .eq('user_id', admission.student_user_id)
                    .single();

                if (error) throw error;
                if (data && isMounted.current) {
                    setStudentData({
                        id: data.user_id,
                        email: data.profiles?.email || '',
                        display_name: data.profiles?.display_name || '',
                        phone: data.profiles?.phone,
                        role: data.profiles?.role,
                        is_active: data.profiles?.is_active,
                        profile_completed: data.profiles?.profile_completed,
                        created_at: data.created_at || data.profiles?.created_at,
                        profile_photo_url: data.profiles?.profile_photo_url,
                        gender: data.gender,
                        date_of_birth: data.date_of_birth,
                        address: data.address,
                        student_id_number: data.student_id_number,
                        grade: data.grade,
                        roll_number: data.roll_number,
                        parent_guardian_details: data.parent_guardian_details,
                        assigned_class_id: data.assigned_class_id,
                        assigned_class_name: data.school_classes?.name || null
                    });
                }
            } catch (err) {
                console.error("Student Node Fetch Error:", err);
            }
        };

        fetchStudentNode();
    }, [admission.student_user_id]);

    const handleDownload = async (doc: any) => {
        const file = doc.admission_documents?.[0];
        if (!file?.storage_path) return;

        setDownloadingId(doc.id);
        try {
            const { data, error } = await supabase.storage.from(BUCKETS.DOCUMENTS).download(file.storage_path);
            if (error) throw error;

            const url = window.URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.file_name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            console.error("Download error:", err);
            alert("Download failed: " + (err.message || "File access denied."));
        } finally {
            if (isMounted.current) setDownloadingId(null);
        }
    };

    const handleRequestDoc = async () => {
        if (!newDocName.trim()) return;
        setRequestingLoading(true);
        try {
            const { error } = await supabase.from('document_requirements').insert({
                admission_id: admission.id,
                document_name: newDocName.trim(),
                status: 'Pending',
                is_mandatory: true
            });

            if (error) throw error;
            setNewDocName('');
            setIsRequestingDoc(false);
            fetchDocs();
        } catch (err: any) {
            console.error("Request failed:", err);
            alert("Failed to request document.");
        } finally {
            if (isMounted.current) setRequestingLoading(false);
        }
    };

    const handleFinalize = async () => {
        setFinalizeState('processing');
        try {
            const { data, error } = await supabase.rpc('admin_finalize_enrollment', {
                p_admission_id: admission.id
            });

            if (error) throw error;

            if (data && data.success) {
                if (isMounted.current) {
                    setProvisionedData({
                        student_id: data.student_id,
                        student_id_number: data.student_id_number
                    });
                    setFinalizeState('success');
                    setTimeout(() => {
                        onUpdate();
                        onClose();
                    }, 2500);
                }
            } else {
                throw new Error(data?.message || "Protocol rejection by enrollment engine.");
            }
        } catch (err: any) {
            console.error("Enrollment Error:", err);
            alert("Enrollment Failed: " + (err.message || "Database transaction error."));
            if (isMounted.current) setFinalizeState('idle');
        }
    };

    const handleVerifyDoc = async (docId: number) => {
        try {
            await supabase.from('document_requirements').update({ status: 'Verified' }).eq('id', docId);
            fetchDocs();
        } catch (e) { console.error(e); }
    };

    const handleRejectDoc = async (docId: number) => {
        const reason = prompt("Enter rejection reason:");
        if (!reason) return;
        try {
            await supabase.from('document_requirements').update({ status: 'Rejected', rejection_reason: reason }).eq('id', docId);
            fetchDocs();
        } catch (e) { console.error(e); }
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl flex items-center justify-center z-[200] p-4 animate-in fade-in duration-500">
            <div className="bg-[#0a0c10] w-full max-w-5xl rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col max-h-[90vh] overflow-hidden relative ring-1 ring-white/5" onClick={e => e.stopPropagation()}>

                {/* Decorative Background Element */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 blur-[120px] rounded-full -mr-64 -mt-64 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-600/5 blur-[120px] rounded-full -ml-64 -mb-64 pointer-events-none" />

                {/* Header */}
                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.01] backdrop-blur-md relative z-10">
                    <div className="flex items-center gap-6">
                        <PremiumAvatar
                            src={admission.profile_photo_url}
                            name={admission.applicant_name}
                            size="lg"
                            className="shadow-[0_8px_30px_rgb(79,70,229,0.3)] ring-4 ring-white/10"
                        />
                        <div>
                            <motion.h2
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                className="text-3xl font-black text-white uppercase tracking-tighter"
                            >
                                {admission.applicant_name}
                            </motion.h2>
                            <div className="flex items-center gap-3 mt-1.5">
                                <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-[10px] uppercase font-black tracking-widest">
                                    Grade {admission.grade}
                                </span>
                                <span className="text-white/20">•</span>
                                <span className="text-white/40 text-xs font-mono tracking-wider bg-white/5 px-2 py-0.5 rounded-md">
                                    {admission.application_number || 'PENDING_REGISTRATION'}
                                </span>
                                {admission.student_user_id && (
                                    <div className="flex items-center gap-2">
                                        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] uppercase font-black tracking-widest">
                                            <ShieldCheckIcon className="w-3 h-3" /> Student Master Active
                                        </span>
                                        {admission.status === 'Enrolled' && (
                                            <button
                                                onClick={() => setViewStudentProfile(true)}
                                                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] uppercase font-black tracking-widest hover:bg-indigo-500/20 transition-all"
                                            >
                                                <UserIcon className="w-3 h-3" /> View Profile
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/30 hover:text-white transition-all hover:rotate-90 duration-500 border border-white/5 hover:border-white/10"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto custom-scrollbar relative z-10 px-4 sm:px-0">
                    <div className="p-6 lg:p-12">
                        {/* Status Banner */}
                        <AnimatePresence>
                            {finalizeState === 'success' && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    className="p-12 mb-10 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 rounded-[3rem] flex flex-col items-center gap-6 text-center shadow-3xl backdrop-blur-3xl relative overflow-hidden"
                                >
                                    <motion.div
                                        initial={{ rotate: -10, scale: 0 }}
                                        animate={{ rotate: 0, scale: 1 }}
                                        transition={{ type: "spring", damping: 12 }}
                                        className="w-24 h-24 bg-emerald-500/20 rounded-[2rem] flex items-center justify-center shadow-[0_0_60px_rgba(16,185,129,0.3)] ring-2 ring-emerald-500/40"
                                    >
                                        <CheckCircleIcon className="w-12 h-12 text-emerald-500" />
                                    </motion.div>
                                    <div className="space-y-2">
                                        <h3 className="text-4xl font-black text-white uppercase tracking-tighter">Enrollment Finalized</h3>
                                        <p className="text-emerald-500 font-mono tracking-[0.4em] text-xl">SID: {provisionedData?.student_id_number}</p>
                                        <p className="text-white/40 text-sm font-medium max-w-lg mx-auto leading-relaxed mt-4 italic">
                                            Registry node successfully initialized. Student profile is now active and compliant with institutional protocols.
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {finalizeState !== 'success' && (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                                {/* Left Column: Identity Passport */}
                                <div className="lg:col-span-5 space-y-10">
                                    <div className="space-y-4">
                                        <SectionHeader icon={<UserIcon className="w-4 h-4" />} title="Applicant Identity" badge="Registry Alpha" />
                                        <div className="bg-white/[0.02] border border-white/10 rounded-[2.5rem] p-10 space-y-10 shadow-3xl relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] -mr-32 -mt-32" />

                                            <IdentityMeta icon={<UserIcon className="w-6 h-6" />} label="Parent / Guardian" value={admission.parent_name} color="indigo" />
                                            <IdentityMeta icon={<MailIcon className="w-6 h-6" />} label="Comm-Link Email" value={admission.parent_email} color="purple" />
                                            <IdentityMeta icon={<PhoneIcon className="w-6 h-6" />} label="Verified Phone" value={admission.parent_phone} color="pink" />

                                            <div className="pt-6 border-t border-white/5">
                                                <div className="flex items-center justify-between mb-4">
                                                    <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Application State</span>
                                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Live Node</span>
                                                </div>
                                                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                                    <div className="h-full bg-indigo-500 w-[100%] rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-8 border-2 border-dashed border-white/5 rounded-[2.5rem] bg-white/[0.01] flex flex-col items-center gap-4 text-center group hover:bg-white/[0.02] transition-all">
                                        <PlusIcon className="w-6 h-6 text-white/10 group-hover:text-white/30 transition-colors" />
                                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Internal Protocol Notes</p>
                                    </div>
                                </div>

                                {/* Right Column: Documentation Vault */}
                                <div className="lg:col-span-7 space-y-10">
                                    <div className="flex items-center justify-between gap-4">
                                        <SectionHeader
                                            icon={<ShieldCheckIcon className="w-4 h-4" />}
                                            title="Documentation Vault"
                                            badge={`${verifiedDocs}/${totalDocs} Verified`}
                                        />
                                        <div className="flex gap-2">
                                            <ActionButton icon={<RefreshCwIcon className={loading ? 'animate-spin' : ''} />} onClick={fetchDocs} />
                                            <button
                                                onClick={() => setIsRequestingDoc(!isRequestingDoc)}
                                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xl active:scale-95"
                                            >
                                                Request Discovery
                                            </button>
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {isRequestingDoc && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                                                <div className="mb-6 p-6 bg-indigo-600/10 border border-indigo-500/20 rounded-3xl flex items-center gap-4">
                                                    <input
                                                        value={newDocName} onChange={e => setNewDocName(e.target.value)}
                                                        placeholder="Specify required artifact..."
                                                        className="flex-1 bg-transparent border-none outline-none text-white font-bold placeholder:text-white/20"
                                                    />
                                                    <button onClick={handleRequestDoc} className="p-3 bg-indigo-500 text-white rounded-xl active:scale-90 transition-transform">
                                                        <PlusIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="space-y-4">
                                        {docs.map((doc, idx) => (
                                            <DocumentRow
                                                key={doc.id}
                                                doc={doc}
                                                index={idx}
                                                expanded={expandedDoc === doc.id}
                                                onToggle={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                                                onVerify={() => handleVerifyDoc(doc.id)}
                                                onReject={() => handleRejectDoc(doc.id)}
                                                onDownload={() => handleDownload(doc)}
                                                downloading={downloadingId === doc.id}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sticky Institutional Footer */}
                <footer className="p-8 lg:px-12 bg-black/40 border-t border-white/5 backdrop-blur-3xl flex flex-col md:flex-row items-center justify-between gap-8 z-20">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <div className={clsx("w-2 h-2 rounded-full animate-pulse", allMandatoryVerified ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]")} />
                            <span className="text-[11px] font-black uppercase text-white/60 tracking-[0.4em]">Administrative Finalization Deck</span>
                        </div>
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] ml-5 italic">
                            {allMandatoryVerified ? "Compliance Protocol: Ready for Execution" : "Compliance Protocol: Awaiting Mandatory Artifacts"}
                        </p>
                    </div>

                    <div className="flex items-center gap-6 w-full md:w-auto">
                        {!allMandatoryVerified && (
                            <p className="text-[10px] font-black text-amber-500/60 uppercase tracking-widest text-right max-w-[200px] leading-relaxed hidden sm:block">
                                Verify all <span className="underline underline-offset-4">Mandatory Documents</span> to proceed.
                            </p>
                        )}
                        <button
                            onClick={handleFinalize}
                            disabled={!allMandatoryVerified || finalizeState === 'processing'}
                            className={clsx(
                                "flex-1 md:flex-none px-12 py-5 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 relative overflow-hidden group shadow-3xl active:scale-95",
                                allMandatoryVerified
                                    ? "bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/30"
                                    : "bg-white/5 text-white/10 border border-white/5 grayscale pointer-events-none"
                            )}
                        >
                            {finalizeState === 'processing' ? <Spinner size="sm" /> : (
                                <>
                                    <ShieldCheckIcon className="w-5 h-5" />
                                    Finalize Enrollment
                                </>
                            )}
                        </button>
                    </div>
                </footer>
            </div>
            {viewStudentProfile && studentData && (
                <StudentProfileModal
                    student={studentData}
                    onClose={() => setViewStudentProfile(false)}
                    onUpdate={() => { }}
                />
            )}
        </div>
    );
};

// --- Sub-Components ---

function SectionHeader({ icon, title, badge, color = "white" }: any) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-lg text-white/40 border border-white/10">{icon}</div>
                <h3 className="text-[10px] font-black uppercase text-white/40 tracking-[0.4em]">{title}</h3>
            </div>
            <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-black text-white/30 uppercase tracking-widest">
                {badge}
            </span>
        </div>
    );
}

function IdentityMeta({ icon, label, value, color }: any) {
    const colorMap: any = {
        indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
        pink: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    };
    return (
        <div className="flex items-start gap-6 group/item transition-transform hover:translate-x-1 duration-300">
            <div className={clsx("p-4 rounded-2xl border shadow-lg", colorMap[color])}>{icon}</div>
            <div className="min-w-0">
                <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mb-1.5">{label}</p>
                <p className="text-white font-black text-xl tracking-tight truncate uppercase leading-none">{value}</p>
            </div>
        </div>
    );
}

function ActionButton({ icon, onClick, className }: any) {
    return (
        <button onClick={onClick} className={clsx("p-2.5 rounded-xl bg-white/5 text-white/30 hover:text-white hover:bg-white/10 transition-all border border-white/10", className)}>
            {React.cloneElement(icon, { className: "w-5 h-5" })}
        </button>
    );
}

function DocumentRow({ doc, expanded, onToggle, onVerify, onReject, onDownload, downloading, index }: any) {
    const isVerified = doc.status === 'Verified';
    const isRejected = doc.status === 'Rejected';
    const file = doc.admission_documents?.[0];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
            className={clsx(
                "group relative bg-white/[0.02] border transition-all duration-500 rounded-[2rem] overflow-hidden cursor-pointer",
                expanded ? "bg-white/[0.05] border-white/20 shadow-2xl" : "border-white/5 hover:border-white/10 hover:bg-white/[0.03]"
            )}
            onClick={onToggle}
        >
            <div className="p-6 flex items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className={clsx(
                        "p-4 rounded-2xl transition-all duration-500",
                        isVerified ? "bg-emerald-500/20 text-emerald-400" : isRejected ? "bg-red-500/20 text-red-500" : "bg-white/5 text-white/20 group-hover:bg-white/10"
                    )}>
                        {isVerified ? <CheckCircleIcon className="w-6 h-6" /> : <FileTextIcon className="w-6 h-6" />}
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h4 className="text-lg font-black text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors uppercase leading-none">{doc.document_name}</h4>
                            {doc.is_mandatory && <span className="px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-md text-[8px] font-black uppercase tracking-widest">Required</span>}
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                            <span className={clsx("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md", isVerified ? "bg-emerald-500/10 text-emerald-400" : isRejected ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-500")}>
                                {doc.status}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto" onClick={e => e.stopPropagation()}>
                    {file && (
                        <div className="flex gap-2">
                            <ActionButton icon={<EyeIcon />} onClick={() => StorageService.getSignedUrl(BUCKETS.DOCUMENTS, file.storage_path).then(url => window.open(url, '_blank'))} />
                            <ActionButton icon={downloading ? <Spinner size="sm" /> : <DownloadIcon />} onClick={onDownload} />
                        </div>
                    )}
                    {!isVerified && file && (
                        <div className="flex gap-2 ml-4">
                            <button onClick={onVerify} className="p-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg transition-all active:scale-90"><CheckCircleIcon className="w-5 h-5" /></button>
                            <button onClick={onReject} className="p-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-lg transition-all active:scale-90"><XIcon className="w-5 h-5" /></button>
                        </div>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="px-10 pb-8 overflow-hidden">
                        <div className="pt-6 border-t border-white/5 space-y-4">
                            {isRejected && <p className="text-xs text-red-400 italic">“{doc.rejection_reason}”</p>}
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
                                <span>Artifact Type: Institutional Registry</span>
                                <span>Node ID: {doc.id}</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}


export default AdmissionDetailsModal;