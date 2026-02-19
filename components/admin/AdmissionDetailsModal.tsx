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
import { LocationIcon } from '../icons/LocationIcon';
import { StorageService, BUCKETS } from '../../services/storage';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon } from '../icons/PlusIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { RefreshCwIcon } from '../icons/RefreshCwIcon';
import StudentProfileModal from '../students/StudentProfileModal';
import { StudentForAdmin } from '../../types';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import clsx from 'clsx';

interface AdmissionDetailsModalProps {
    admission: AdmissionApplication;
    onClose: () => void;
    onUpdate: () => void;
    onNavigate?: (comp: string) => void;
}

const STANDARD_MANDATORY = [
    'Aadhar Card / National ID',
    'Birth Certificate',
    'Transfer Certificate',
    'Student Photograph'
];

const AdmissionDetailsModal: React.FC<AdmissionDetailsModalProps> = ({ admission, onClose, onUpdate, onNavigate }) => {
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
    const [seedingDocs, setSeedingDocs] = useState(false);
    const [activeTab, setActiveTab] = useState<'identity' | 'vault'>('vault');

    const isMounted = useRef(true);
    const hasSeeded = useRef(false);

    const totalDocs = docs.length;
    const verifiedDocs = docs.filter(d => d.status === 'Verified').length;
    const mandatoryDocs = docs.filter(d => d.is_mandatory);
    const supportingDocs = docs.filter(d => !d.is_mandatory);
    const allMandatoryVerified = mandatoryDocs.length > 0 && mandatoryDocs.every(d => d.status === 'Verified');
    const progressPercentage = totalDocs > 0 ? Math.round((verifiedDocs / totalDocs) * 100) : 0;
    const pendingDocs = docs.filter(d => d.status === 'Pending' || d.status === 'Missing').length;
    const rejectedDocs = docs.filter(d => d.status === 'Rejected').length;

    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    // ═══════════════════════════════════════════════════════════
    // AUTO-SEED: Persist mandatory documents to DB when vault is empty
    // This is the CORE FIX for promoted students with no documents
    // ═══════════════════════════════════════════════════════════
    const seedMandatoryDocuments = useCallback(async () => {
        if (!admission.id || hasSeeded.current) return false;
        hasSeeded.current = true;
        setSeedingDocs(true);
        try {
            const records = STANDARD_MANDATORY.map(name => ({
                admission_id: admission.id,
                document_name: name,
                is_mandatory: true,
                status: 'Pending'
            }));

            const { error } = await supabase
                .from('document_requirements')
                .insert(records);

            if (error) {
                console.error("Auto-seed error:", error);
                return false;
            }
            return true;
        } catch (err) {
            console.error("Seed protocol failure:", err);
            return false;
        } finally {
            if (isMounted.current) setSeedingDocs(false);
        }
    }, [admission.id]);

    // ═══ Helper: Deduplicate + fill missing mandatory docs ═══
    const processDocsList = useCallback((rawDocs: any[]) => {
        const seen = new Set();
        const uniqueDocs = rawDocs.filter((d: any) => {
            const key = d.document_name.toLowerCase().trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        const existingNames = uniqueDocs.map((d: any) => d.document_name.toLowerCase().trim());
        const missingDocs = STANDARD_MANDATORY
            .filter(name => !existingNames.includes(name.toLowerCase().trim()))
            .map((name, idx) => ({
                id: -(idx + 100),
                document_name: name,
                status: 'Missing',
                is_mandatory: true,
                admission_id: admission.id,
                created_at: new Date().toISOString(),
                admission_documents: []
            }));

        const combined = [...uniqueDocs, ...missingDocs];
        combined.sort((a, b) => {
            if (a.is_mandatory && !b.is_mandatory) return -1;
            if (!a.is_mandatory && b.is_mandatory) return 1;
            return a.document_name.localeCompare(b.document_name);
        });
        return combined;
    }, [admission.id]);

    const fetchDocs = useCallback(async () => {
        if (!admission.id) return;
        setLoading(true);
        try {
            // Primary query: PostgREST resource embedding
            const { data, error } = await supabase
                .from('document_requirements')
                .select('*, admission_documents!requirement_id(*)')
                .eq('admission_id', admission.id)
                .order('is_mandatory', { ascending: false });

            if (error) {
                console.warn("[Vault] Embedded query failed, trying fallback:", error.message);
                // Fallback: Separate queries and manual join
                const { data: reqData, error: reqErr } = await supabase
                    .from('document_requirements')
                    .select('*')
                    .eq('admission_id', admission.id)
                    .order('is_mandatory', { ascending: false });

                if (reqErr) throw reqErr;

                if (reqData && reqData.length > 0) {
                    // Fetch admission_documents separately for each requirement
                    const reqIds = reqData.map((r: any) => r.id);
                    const { data: adDocs } = await supabase
                        .from('admission_documents')
                        .select('*')
                        .in('requirement_id', reqIds);

                    // Manual join
                    const docsMap = new Map<number, any[]>();
                    (adDocs || []).forEach((ad: any) => {
                        const existing = docsMap.get(ad.requirement_id) || [];
                        existing.push(ad);
                        docsMap.set(ad.requirement_id, existing);
                    });

                    const joinedData = reqData.map((r: any) => ({
                        ...r,
                        admission_documents: docsMap.get(r.id) || []
                    }));

                    if (isMounted.current) {
                        setDocs(processDocsList(joinedData));
                    }
                    return;
                }
            }

            // ═══ AUTO-SEED FIX: If DB has ZERO docs, seed them now ═══
            if ((!data || data.length === 0) && !hasSeeded.current) {
                const seeded = await seedMandatoryDocuments();
                if (seeded) {
                    // Re-fetch after seeding (use simple query)
                    const { data: freshReqs } = await supabase
                        .from('document_requirements')
                        .select('*')
                        .eq('admission_id', admission.id)
                        .order('is_mandatory', { ascending: false });

                    if (freshReqs && freshReqs.length > 0) {
                        const freshWithDocs = freshReqs.map((r: any) => ({ ...r, admission_documents: [] }));
                        if (isMounted.current) setDocs(processDocsList(freshWithDocs));
                    }
                    return;
                }
            }

            // Check if embed returned data but admission_documents are all null/empty
            // This happens when PostgREST embed works for requirements but not for nested docs
            let processedData = data || [];
            if (processedData.length > 0) {
                const allDocsEmpty = processedData.every((d: any) =>
                    !d.admission_documents || d.admission_documents.length === 0
                );

                if (allDocsEmpty) {
                    // Fallback: fetch admission_documents separately
                    const reqIds = processedData.map((r: any) => r.id);
                    const { data: adDocs } = await supabase
                        .from('admission_documents')
                        .select('*')
                        .in('requirement_id', reqIds);

                    if (adDocs && adDocs.length > 0) {
                        const docsMap = new Map<number, any[]>();
                        adDocs.forEach((ad: any) => {
                            const existing = docsMap.get(ad.requirement_id) || [];
                            existing.push(ad);
                            docsMap.set(ad.requirement_id, existing);
                        });

                        processedData = processedData.map((r: any) => ({
                            ...r,
                            admission_documents: docsMap.get(r.id) || []
                        }));
                    }
                }
            }

            if (isMounted.current) {
                setDocs(processDocsList(processedData));
            }
        } catch (error) {
            console.error("Vault Sync Error:", error);
        } finally {
            if (isMounted.current) setLoading(false);
        }
    }, [admission.id, seedMandatoryDocuments, processDocsList]);

    useEffect(() => {
        fetchDocs();
    }, [fetchDocs]);

    // ═══ Initialize Compliance Protocol: Actually seeds to DB ═══
    const handleInitializeCompliance = async () => {
        if (!admission.id) return;
        setSeedingDocs(true);
        try {
            // Find which mandatory docs are truly missing from DB
            const { data: existing } = await supabase
                .from('document_requirements')
                .select('document_name')
                .eq('admission_id', admission.id);

            const existingNames = (existing || []).map((d: any) => d.document_name.toLowerCase().trim());
            const toInsert = STANDARD_MANDATORY
                .filter(name => !existingNames.includes(name.toLowerCase().trim()))
                .map(name => ({
                    admission_id: admission.id,
                    document_name: name,
                    is_mandatory: true,
                    status: 'Pending'
                }));

            if (toInsert.length > 0) {
                const { error } = await supabase
                    .from('document_requirements')
                    .insert(toInsert);
                if (error) throw error;
            }

            hasSeeded.current = true;
            await fetchDocs();
        } catch (err) {
            console.error("Initialize error:", err);
            alert("Failed to initialize compliance protocol.");
        } finally {
            if (isMounted.current) setSeedingDocs(false);
        }
    };

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
                        if (onNavigate) {
                            onNavigate('Student Management');
                        }
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

    // ═══ Status helpers ═══
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Enrolled': return 'emerald';
            case 'Approved': case 'Verified': return 'indigo';
            case 'Rejected': case 'Cancelled': return 'red';
            default: return 'amber';
        }
    };
    const statusColor = getStatusColor(admission.status);

    return (
        <div
            className="fixed inset-0 bg-black/90 backdrop-blur-2xl flex items-center justify-center z-[200] p-3 sm:p-6 animate-in fade-in duration-500"
            onClick={onClose}
        >
            <div
                className="bg-[#06080d] w-full max-w-6xl rounded-[1.5rem] sm:rounded-[2.5rem] shadow-[0_0_120px_rgba(0,0,0,0.6)] border border-white/[0.06] flex flex-col max-h-[96vh] sm:max-h-[92vh] overflow-hidden relative"
                onClick={e => e.stopPropagation()}
            >
                {/* ═══ Ambient Background Glow ═══ */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/[0.03] blur-[150px] rounded-full -mr-72 -mt-72 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/[0.02] blur-[120px] rounded-full -ml-64 -mb-64 pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-500/[0.01] blur-[200px] rounded-full pointer-events-none" />

                {/* ═══ HEADER ═══ */}
                <div className="p-5 sm:p-7 border-b border-white/[0.04] bg-gradient-to-r from-white/[0.01] to-transparent backdrop-blur-md relative z-10">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 sm:gap-5 min-w-0">
                            <div className="relative hidden xs:block">
                                <div className={`absolute inset-0 bg-${statusColor}-500/20 blur-xl rounded-full animate-pulse`} />
                                <PremiumAvatar
                                    src={admission.profile_photo_url}
                                    name={admission.applicant_name}
                                    size="lg"
                                    className="relative z-10 ring-2 ring-white/10 shadow-2xl"
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-3 mb-1.5">
                                    <motion.h2
                                        initial={{ x: -15, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        className="text-lg sm:text-2xl font-black text-white uppercase tracking-tight truncate"
                                        title={admission.applicant_name}
                                    >
                                        {admission.applicant_name}
                                    </motion.h2>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[9px] font-black uppercase tracking-[0.15em] text-white/40">
                                        <div className="w-1 h-1 rounded-full bg-indigo-400" />
                                        Grade {admission.grade}
                                    </span>
                                    <span className="text-[10px] font-mono text-white/20 bg-white/[0.03] px-2 py-1 rounded-md border border-white/[0.04] truncate max-w-[160px]">
                                        {admission.application_number || 'PENDING_REGISTRATION'}
                                    </span>
                                    {admission.student_user_id && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 text-[9px] font-black uppercase tracking-[0.12em]">
                                            <ShieldCheckIcon className="w-3 h-3" /> Provisioned
                                        </span>
                                    )}
                                    {admission.status === 'Enrolled' && (
                                        <button
                                            onClick={() => setViewStudentProfile(true)}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/15 text-indigo-400 text-[9px] font-black uppercase tracking-[0.12em] hover:bg-indigo-500/20 transition-all"
                                        >
                                            <UserIcon className="w-3 h-3" /> View Profile
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/30 hover:text-white transition-all hover:rotate-90 duration-500 border border-white/[0.06] shrink-0"
                            aria-label="Close modal"
                        >
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* ═══ Tab Navigation ═══ */}
                    <div className="flex items-center gap-1 mt-4 bg-white/[0.02] p-1 rounded-xl border border-white/[0.04] w-fit">
                        {[
                            { key: 'vault' as const, label: 'Documentation Vault', icon: <ShieldCheckIcon className="w-3.5 h-3.5" />, count: totalDocs },
                            { key: 'identity' as const, label: 'Applicant Identity', icon: <UserIcon className="w-3.5 h-3.5" />, count: null },
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={clsx(
                                    "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300",
                                    activeTab === tab.key
                                        ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 shadow-lg shadow-indigo-500/5"
                                        : "text-white/25 hover:text-white/50 border border-transparent"
                                )}
                            >
                                {tab.icon}
                                <span className="hidden sm:inline">{tab.label}</span>
                                {tab.count !== null && (
                                    <span className={clsx("px-1.5 py-0.5 rounded text-[8px]", activeTab === tab.key ? "bg-indigo-500/30 text-indigo-300" : "bg-white/5 text-white/20")}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ═══ BODY ═══ */}
                <div className="flex-grow overflow-y-auto custom-scrollbar relative z-10">
                    {/* ═══ Success Banner ═══ */}
                    <AnimatePresence>
                        {finalizeState === 'success' && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className="m-6 sm:m-8 p-10 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 rounded-[2rem] flex flex-col items-center gap-5 text-center shadow-3xl backdrop-blur-3xl relative overflow-hidden"
                            >
                                <motion.div
                                    initial={{ rotate: -10, scale: 0 }}
                                    animate={{ rotate: 0, scale: 1 }}
                                    transition={{ type: "spring", damping: 12 }}
                                    className="w-20 h-20 bg-emerald-500/20 rounded-2xl flex items-center justify-center shadow-[0_0_60px_rgba(16,185,129,0.3)] ring-2 ring-emerald-500/40"
                                >
                                    <CheckCircleIcon className="w-10 h-10 text-emerald-500" />
                                </motion.div>
                                <div className="space-y-2">
                                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Enrollment Finalized</h3>
                                    <p className="text-emerald-500 font-mono tracking-[0.4em] text-lg">SID: {provisionedData?.student_id_number}</p>
                                    <p className="text-white/40 text-sm font-medium max-w-lg mx-auto leading-relaxed mt-3 italic">
                                        Registry node successfully initialized. Student profile is now active.
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {finalizeState !== 'success' && (
                        <div className="p-5 sm:p-8">
                            {/* ═══ VAULT TAB ═══ */}
                            {activeTab === 'vault' && (
                                <div className="space-y-6">
                                    {/* Vault Status Metrics */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <VaultMetricCard label="Total Artifacts" value={totalDocs} color="indigo" />
                                        <VaultMetricCard label="Verified" value={verifiedDocs} color="emerald" />
                                        <VaultMetricCard label="Pending" value={pendingDocs} color="amber" />
                                        <VaultMetricCard label="Rejected" value={rejectedDocs} color="red" />
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Compliance Readiness</span>
                                            <span className={clsx("text-[11px] font-black uppercase tracking-[0.15em]",
                                                progressPercentage === 100 ? "text-emerald-400" : progressPercentage > 50 ? "text-indigo-400" : "text-amber-400"
                                            )}>{progressPercentage}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-white/[0.04] rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progressPercentage}%` }}
                                                transition={{ duration: 1, ease: "easeOut" }}
                                                className={clsx("h-full rounded-full",
                                                    progressPercentage === 100 ? "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]" :
                                                        progressPercentage > 50 ? "bg-gradient-to-r from-indigo-600 to-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.3)]" :
                                                            "bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                                                )}
                                            />
                                        </div>
                                    </div>

                                    {/* Toolbar */}
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-5 bg-red-500 rounded-full shadow-[0_0_12px_rgba(239,68,68,0.3)]" />
                                            <h4 className="text-[11px] font-black text-white/70 uppercase tracking-[0.2em]">Mandatory Documents</h4>
                                            <span className="text-[9px] font-bold text-white/20 bg-white/[0.03] px-2 py-0.5 rounded border border-white/[0.04]">
                                                {mandatoryDocs.filter(d => d.status === 'Verified').length}/{mandatoryDocs.length}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={fetchDocs}
                                                className="p-2 rounded-lg bg-white/[0.03] text-white/25 hover:text-white hover:bg-white/[0.06] transition-all border border-white/[0.05]"
                                            >
                                                <RefreshCwIcon className={clsx("w-4 h-4", loading && "animate-spin")} />
                                            </button>
                                            <button
                                                onClick={() => setIsRequestingDoc(!isRequestingDoc)}
                                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-[0.15em] rounded-lg transition-all shadow-lg shadow-indigo-500/10 active:scale-95 border border-indigo-400/20"
                                            >
                                                <PlusIcon className="w-3.5 h-3.5" />
                                                Request Document
                                            </button>
                                        </div>
                                    </div>

                                    {/* Request New Document Form */}
                                    <AnimatePresence>
                                        {isRequestingDoc && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                <div className="p-4 bg-indigo-600/[0.06] border border-indigo-500/15 rounded-xl flex items-center gap-3">
                                                    <input
                                                        value={newDocName} onChange={e => setNewDocName(e.target.value)}
                                                        placeholder="Enter document name..."
                                                        className="flex-1 bg-transparent border-none outline-none text-white text-sm font-medium placeholder:text-white/20"
                                                        autoFocus
                                                        onKeyDown={e => e.key === 'Enter' && handleRequestDoc()}
                                                    />
                                                    <button
                                                        onClick={handleRequestDoc}
                                                        disabled={requestingLoading || !newDocName.trim()}
                                                        className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase active:scale-90 transition-transform disabled:opacity-40"
                                                    >
                                                        {requestingLoading ? <Spinner size="sm" /> : 'Add'}
                                                    </button>
                                                    <button onClick={() => setIsRequestingDoc(false)} className="p-2 text-white/30 hover:text-white rounded-lg hover:bg-white/5 transition-all">
                                                        <XIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* ═══ MANDATORY DOCUMENTS ═══ */}
                                    <div className="space-y-2">
                                        {mandatoryDocs.length > 0 ? (
                                            mandatoryDocs.map((doc, idx) => (
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
                                            ))
                                        ) : (
                                            <div className="space-y-3">
                                                <EmptySlot label="No mandatory documents found in vault" />
                                                <button
                                                    onClick={handleInitializeCompliance}
                                                    disabled={seedingDocs}
                                                    className="w-full py-4 rounded-xl border border-dashed border-indigo-500/20 hover:border-indigo-500/40 bg-indigo-500/[0.03] hover:bg-indigo-500/[0.06] text-[10px] font-black uppercase text-indigo-400/60 hover:text-indigo-400 transition-all tracking-[0.2em] flex items-center justify-center gap-3"
                                                >
                                                    {seedingDocs ? (
                                                        <><Spinner size="sm" /> Seeding Documents...</>
                                                    ) : (
                                                        <><PlusIcon className="w-4 h-4" /> Initialize Compliance Protocol</>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* ═══ SUPPORTING DOCUMENTS ═══ */}
                                    <div className="space-y-3 mt-8">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-5 bg-indigo-500 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.3)]" />
                                            <h4 className="text-[11px] font-black text-white/70 uppercase tracking-[0.2em]">Supporting Evidence</h4>
                                            <span className="text-[9px] font-bold text-white/20 bg-white/[0.03] px-2 py-0.5 rounded border border-white/[0.04]">
                                                {supportingDocs.length}
                                            </span>
                                        </div>

                                        {supportingDocs.length > 0 ? (
                                            supportingDocs.map((doc, idx) => (
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
                                            ))
                                        ) : (
                                            <EmptySlot label="No supporting evidence provided" />
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ═══ IDENTITY TAB ═══ */}
                            {activeTab === 'identity' && (
                                <div className="space-y-6">
                                    <div className="bg-white/[0.015] border border-white/[0.05] rounded-2xl p-6 space-y-6 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/[0.04] blur-[80px] -mr-24 -mt-24" />
                                        <IdentityMeta
                                            icon={<UserIcon className="w-4.5 h-4.5" />}
                                            label="Parent / Guardian"
                                            value={admission.parent_name || (studentData?.parent_guardian_details ? "REGISTRY_LINKED" : "")}
                                            subValue={admission.parent_name ? "Primary Contact" : "System Placeholder"}
                                            color="indigo"
                                        />
                                        <IdentityMeta
                                            icon={<MailIcon className="w-4.5 h-4.5" />}
                                            label="Comm-Link Email"
                                            value={admission.parent_email || "PROTOCOL_PENDING"}
                                            color="purple"
                                        />
                                        <IdentityMeta
                                            icon={<PhoneIcon className="w-4.5 h-4.5" />}
                                            label="Verified Phone"
                                            value={admission.parent_phone || "UNLINKED_NODE"}
                                            color="pink"
                                        />
                                        <IdentityMeta
                                            icon={<LocationIcon className="w-4.5 h-4.5" />}
                                            label="Residential Address"
                                            value={admission.address || "NO ADDRESS RECORDED"}
                                            color="indigo"
                                        />
                                        <IdentityMeta
                                            icon={<AlertTriangleIcon className="w-4.5 h-4.5" />}
                                            label="Emergency Contact"
                                            value={admission.emergency_contact || "NOT SET"}
                                            color="purple"
                                        />

                                        {admission.medical_info && (
                                            <div className="p-4 bg-red-500/[0.06] border border-red-500/15 rounded-xl">
                                                <p className="text-[9px] font-black text-red-500 uppercase tracking-[0.15em] mb-1">Medical Alert</p>
                                                <p className="text-sm text-red-200/80 font-medium">{admission.medical_info}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Additional Info Cards */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {admission.date_of_birth && (
                                            <InfoCard label="Date of Birth" value={new Date(admission.date_of_birth).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })} />
                                        )}
                                        {admission.gender && (
                                            <InfoCard label="Gender" value={admission.gender} />
                                        )}
                                        <InfoCard label="Status" value={admission.status} />
                                        <InfoCard label="Submitted" value={admission.submitted_at ? new Date(admission.submitted_at).toLocaleDateString() : 'N/A'} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ═══ FOOTER ═══ */}
                <footer className="p-5 sm:px-8 bg-[#04060a]/80 border-t border-white/[0.04] backdrop-blur-3xl flex flex-col sm:flex-row items-center justify-between gap-4 z-20">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={clsx("w-2 h-2 rounded-full animate-pulse shrink-0",
                            admission.status === 'Enrolled' ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" :
                                allMandatoryVerified ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" :
                                    "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]")} />
                        <div className="min-w-0">
                            <span className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] block truncate">
                                {admission.status === 'Enrolled' ? "Enrollment Active" :
                                    allMandatoryVerified ? "Ready for Finalization" :
                                        `${mandatoryDocs.filter(d => d.status !== 'Verified').length} Mandatory Pending`}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        {!allMandatoryVerified && admission.status !== 'Enrolled' && (
                            <p className="text-[9px] font-bold text-amber-500/50 uppercase tracking-wider text-right max-w-[180px] leading-relaxed hidden sm:block">
                                Verify all mandatory documents to proceed
                            </p>
                        )}
                        {admission.status === 'Enrolled' ? (
                            <button
                                onClick={() => { onClose(); onNavigate?.('Student Management'); }}
                                className="flex-1 sm:flex-none px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/10 active:scale-95 border border-indigo-400/20"
                            >
                                <UsersIcon className="w-4 h-4" /> View in Directory
                            </button>
                        ) : (
                            <button
                                onClick={handleFinalize}
                                disabled={!allMandatoryVerified || finalizeState === 'processing'}
                                className={clsx(
                                    "flex-1 sm:flex-none px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-95",
                                    allMandatoryVerified
                                        ? "bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/20 shadow-xl shadow-indigo-500/10"
                                        : "bg-white/[0.03] text-white/15 border border-white/[0.04] cursor-not-allowed"
                                )}
                            >
                                {finalizeState === 'processing' ? <Spinner size="sm" /> : (
                                    <><ShieldCheckIcon className="w-4 h-4" /> Finalize Enrollment</>
                                )}
                            </button>
                        )}
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

// ═══ SUB-COMPONENTS ═══

function VaultMetricCard({ label, value, color }: { label: string; value: number; color: string }) {
    const colorMap: Record<string, string> = {
        indigo: "from-indigo-500/10 to-indigo-500/[0.02] border-indigo-500/10 text-indigo-400",
        emerald: "from-emerald-500/10 to-emerald-500/[0.02] border-emerald-500/10 text-emerald-400",
        amber: "from-amber-500/10 to-amber-500/[0.02] border-amber-500/10 text-amber-400",
        red: "from-red-500/10 to-red-500/[0.02] border-red-500/10 text-red-400",
    };
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={clsx("bg-gradient-to-br border rounded-xl p-4 text-center", colorMap[color])}
        >
            <p className="text-2xl font-black">{value}</p>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-50 mt-1">{label}</p>
        </motion.div>
    );
}

function InfoCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
            <p className="text-[9px] font-black text-white/25 uppercase tracking-[0.15em] mb-1">{label}</p>
            <p className="text-sm font-bold text-white/70 uppercase">{value}</p>
        </div>
    );
}

function IdentityMeta({ icon, label, value, subValue, color }: any) {
    const colorMap: any = {
        indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/15",
        purple: "bg-purple-500/10 text-purple-400 border-purple-500/15",
        pink: "bg-pink-500/10 text-pink-400 border-pink-500/15",
    };
    const isEmpty = !value || value.includes('PENDING') || value.includes('UNLINKED');

    return (
        <div className="flex items-start sm:items-center gap-4 group/item transition-all hover:translate-x-1 duration-300">
            <div className={clsx("p-3 rounded-xl border transition-all duration-300 group-hover/item:scale-105 shrink-0", colorMap[color])}>{icon}</div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[9px] font-bold text-white/25 uppercase tracking-[0.15em]">{label}</p>
                    {subValue && <span className="text-[7px] font-black text-indigo-500/40 uppercase tracking-widest hidden sm:inline">{subValue}</span>}
                </div>
                <p className={clsx(
                    "font-bold text-sm sm:text-base tracking-tight uppercase leading-tight transition-colors break-all",
                    isEmpty ? "text-white/10 italic text-xs" : "text-white group-hover/item:text-indigo-400"
                )}>{value}</p>
            </div>
        </div>
    );
}

function DocumentRow({ doc, expanded, onToggle, onVerify, onReject, onDownload, downloading, index }: any) {
    const isVerified = doc.status === 'Verified';
    const isRejected = doc.status === 'Rejected';
    const isMissing = doc.status === 'Missing';
    const file = doc.admission_documents?.[0];

    const statusConfig = isVerified
        ? { bg: "bg-emerald-500/8", border: "border-emerald-500/15", icon: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", accent: "emerald", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/15" }
        : isRejected
            ? { bg: "bg-red-500/5", border: "border-red-500/15", icon: "bg-red-500/10 text-red-400 border-red-500/20", accent: "red", badge: "bg-red-500/10 text-red-400 border-red-500/15" }
            : isMissing
                ? { bg: "bg-white/[0.01]", border: "border-white/[0.04]", icon: "bg-white/[0.03] text-white/15 border-white/[0.05]", accent: "gray", badge: "bg-white/5 text-white/20 border-white/[0.06]" }
                : { bg: "bg-amber-500/5", border: "border-amber-500/10", icon: "bg-amber-500/10 text-amber-500 border-amber-500/20", accent: "amber", badge: "bg-amber-500/10 text-amber-500 border-amber-500/15" };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className={clsx(
                "group relative border transition-all duration-300 rounded-xl overflow-hidden cursor-pointer",
                expanded ? `${statusConfig.bg} ${statusConfig.border} shadow-lg` : `border-white/[0.04] hover:border-white/[0.08] bg-white/[0.01] hover:bg-white/[0.02]`
            )}
            onClick={onToggle}
        >
            {/* Verified Left Accent */}
            {isVerified && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" />}

            <div className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                    {/* Status Icon */}
                    <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 transition-all", statusConfig.icon)}>
                        {isVerified ? <ShieldCheckIcon className="w-5 h-5" /> :
                            isMissing ? <FileTextIcon className="w-5 h-5 opacity-30" /> :
                                isRejected ? <XIcon className="w-5 h-5" /> :
                                    <AlertTriangleIcon className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0">
                        <h4 className={clsx(
                            "text-xs font-black uppercase tracking-wider transition-colors truncate",
                            isMissing ? "text-white/20" : "text-white/80 group-hover:text-white"
                        )}>
                            {doc.document_name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={clsx("text-[8px] font-black uppercase tracking-[0.12em] px-2 py-0.5 rounded-md border", statusConfig.badge)}>
                                {doc.status}
                            </span>
                            {doc.is_mandatory && !isVerified && (
                                <span className="flex items-center gap-1 text-[7px] font-black text-red-500/40 uppercase tracking-wider">
                                    <div className="w-1 h-1 rounded-full bg-red-500/50" /> Required
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    {file ? (
                        <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-lg border border-white/[0.05]">
                            <button onClick={() => StorageService.getSignedUrl(BUCKETS.DOCUMENTS, file.storage_path).then(url => window.open(url, '_blank'))} className="p-2 text-white/20 hover:text-white hover:bg-white/5 rounded-lg transition-all"><EyeIcon className="w-3.5 h-3.5" /></button>
                            <button onClick={onDownload} className="p-2 text-white/20 hover:text-white hover:bg-white/5 rounded-lg transition-all">{downloading ? <Spinner size="sm" /> : <DownloadIcon className="w-3.5 h-3.5" />}</button>
                            {!isVerified && (
                                <div className="flex gap-1 pl-1 border-l border-white/[0.06] ml-1">
                                    <button onClick={onVerify} className="px-3 py-1.5 bg-emerald-600/15 hover:bg-emerald-600 text-emerald-400 hover:text-white text-[8px] font-black uppercase tracking-wider rounded-lg transition-all border border-emerald-500/15">Verify</button>
                                    <button onClick={onReject} className="px-3 py-1.5 bg-red-600/15 hover:bg-red-600 text-red-400 hover:text-white text-[8px] font-black uppercase tracking-wider rounded-lg transition-all border border-red-500/15">Reject</button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <span className="text-[8px] font-black uppercase tracking-[0.12em] text-white/15 italic mr-2">Awaiting Upload</span>
                    )}
                    <ChevronDownIcon className={clsx("w-4 h-4 transition-all duration-400", expanded ? "rotate-180 text-white/40" : "text-white/10")} />
                </div>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-5 pb-5 overflow-hidden"
                    >
                        <div className="pt-4 border-t border-white/[0.03] space-y-4">
                            {isRejected && (
                                <div className="p-4 bg-red-500/[0.05] border border-red-500/10 rounded-xl flex items-start gap-3">
                                    <AlertTriangleIcon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-[9px] font-black text-red-500/50 uppercase tracking-wider">Rejection Reason</p>
                                        <p className="text-xs text-red-400/80 font-medium italic mt-1">"{doc.rejection_reason}"</p>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <p className="text-[9px] font-black text-white/20 uppercase tracking-wider mb-1">Registry Note</p>
                                    <p className="text-[11px] text-white/30 leading-relaxed italic">Required for institutional compliance and academic vetting.</p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <p className="text-[9px] font-black text-white/20 uppercase tracking-wider">Timestamp</p>
                                    <span className="px-2.5 py-1 bg-white/[0.02] border border-white/[0.06] rounded-md text-[10px] font-mono text-white/25 italic">
                                        {new Date(doc.created_at).toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function EmptySlot({ label }: { label: string }) {
    return (
        <div className="py-10 flex flex-col items-center gap-3 border border-dashed border-white/[0.06] rounded-xl bg-white/[0.01]">
            <FileTextIcon className="w-8 h-8 text-white/[0.06]" />
            <p className="text-[10px] font-bold text-white/15 uppercase tracking-[0.2em]">{label}</p>
        </div>
    );
}

export default AdmissionDetailsModal;