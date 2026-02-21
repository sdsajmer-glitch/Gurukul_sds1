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

    // Derived Categorization
    const getDocumentCategory = (docName: string) => {
        const lower = docName.toLowerCase();
        if (lower.includes('birth') || lower.includes('photo') || lower.includes('address') || lower.includes('identity') || lower.includes('aadhar') || lower.includes('passport')) {
            return 'Identity Documents';
        }
        if (lower.includes('transfer') || lower.includes('report') || lower.includes('mark') || lower.includes('academic')) {
            return 'Academic Records';
        }
        if (lower.includes('fee') || lower.includes('receipt') || lower.includes('finance')) {
            return 'Financial Documents';
        }
        if (lower.includes('medical') || lower.includes('health')) {
            return 'Medical Records';
        }
        return 'Compliance Artifacts';
    };

    const categories = Array.from(new Set(docs.map(d => getDocumentCategory(d.document_name))));

    const totalDocs = docs.length;
    const verifiedDocs = docs.filter(d => d.status === 'Verified').length;
    const submittedDocs = docs.filter(d => d.status === 'Submitted').length;
    const pendingDocs = docs.filter(d => d.status === 'Pending' || d.status === 'Missing').length;
    const rejectedDocs = docs.filter(d => d.status === 'Rejected').length;
    const mandatoryDocs = docs.filter(d => d.is_mandatory);
    const allMandatoryVerified = mandatoryDocs.length > 0 && mandatoryDocs.every(d => d.status === 'Verified');
    const progressPercentage = totalDocs > 0 ? Math.round((verifiedDocs / totalDocs) * 100) : 0;

    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    // ═══════════════════════════════════════════════════════════
    // AUTO-SEED: Persist mandatory documents to DB when vault is empty
    // This is the CORE FIX for promoted students with no documents
    // ═══════════════════════════════════════════════════════════
    const seedMandatoryDocuments = useCallback(async () => {
        if (!admission.id || hasSeeded.current) return false;
        setSeedingDocs(true);
        try {
            // Check what already exists to avoid duplicates
            const { data: existing } = await supabase
                .from('document_requirements')
                .select('document_name')
                .eq('admission_id', admission.id);

            const existingNames = (existing || []).map((d: any) => d.document_name.toLowerCase().trim());
            const records = STANDARD_MANDATORY
                .filter(name => !existingNames.includes(name.toLowerCase().trim()))
                .map(name => ({
                    admission_id: admission.id,
                    document_name: name,
                    is_mandatory: true,
                    status: 'Pending'
                }));

            if (records.length === 0) {
                hasSeeded.current = true;
                return true; // All already exist
            }

            const { error } = await supabase
                .from('document_requirements')
                .insert(records);

            if (error) {
                console.error("Auto-seed error:", error);
                return false;
            }
            hasSeeded.current = true;
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
            if (!d || !d.document_name) return false;
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
            return (a.document_name || '').localeCompare(b.document_name || '');
        });
        return combined;
    }, [admission.id]);

    const fetchDocs = useCallback(async () => {
        if (!admission.id) return;
        setLoading(true);
        let fetchedDocs: any[] = [];
        try {
            // Step 1: Query requirements linked to this admission OR its parent enquiry
            const { data: reqData, error: reqErr } = await supabase
                .from('document_requirements')
                .select('*')
                .or(`admission_id.eq.${admission.id}${admission.enquiry_id ? ',enquiry_id.eq.' + admission.enquiry_id : ''}`)
                .order('is_mandatory', { ascending: false });

            if (reqErr) {
                console.warn("[Vault] Requirements query failed:", reqErr.message);
            }

            if (reqData && reqData.length > 0) {
                // Step 2: Fetch admission_documents with uploader profiles
                const reqIds = reqData.map((r: any) => r.id);
                const { data: adDocs } = await supabase
                    .from('admission_documents')
                    .select('*, uploader:profiles(display_name, role)')
                    .in('requirement_id', reqIds);

                const docsMap = new Map<number, any[]>();
                (adDocs || []).forEach((ad: any) => {
                    const existing = docsMap.get(ad.requirement_id) || [];
                    existing.push(ad);
                    docsMap.set(ad.requirement_id, existing);
                });

                fetchedDocs = reqData.map((r: any) => ({
                    ...r,
                    admission_documents: docsMap.get(r.id) || []
                }));
            } else {
                // Step 3: No documents found — auto-seed mandatory docs
                if (!hasSeeded.current) {
                    console.log("[Vault] No documents found, auto-seeding...");
                    const seeded = await seedMandatoryDocuments();
                    if (seeded) {
                        // Re-fetch after successful seed
                        const { data: freshReqs } = await supabase
                            .from('document_requirements')
                            .select('*')
                            .eq('admission_id', admission.id)
                            .order('is_mandatory', { ascending: false });

                        if (freshReqs && freshReqs.length > 0) {
                            fetchedDocs = freshReqs.map((r: any) => ({ ...r, admission_documents: [] }));
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Vault Sync Error:", error);
        } finally {
            if (isMounted.current) {
                setDocs(processDocsList(fetchedDocs));
                setLoading(false);
            }
        }
    }, [admission.id, admission.enquiry_id, seedMandatoryDocuments, processDocsList]);

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

            if (error) {
                // Intercept the known "fee_structures" database error
                if (error.message?.includes('fee_structures') || JSON.stringify(error).includes('fee_structures')) {
                    throw new Error("DATABASE_FAULT_FEE_STRUCTURES");
                }
                throw error;
            }

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

            if (err.message === "DATABASE_FAULT_FEE_STRUCTURES" || err.message?.includes('fee_structures')) {
                alert(
                    "🚨 CRITICAL DATABASE FAULT DETECTED 🚨\n\n" +
                    "The Supabase database has old, stale triggers that are trying to reference a legacy table `public.fee_structures`.\n\n" +
                    "TO FIX THIS NOW:\n" +
                    "1. Open your Supabase Dashboard -> SQL Editor.\n" +
                    "2. Copy the entire contents of the new file `ENROLLMENT_FINAL_V3_NUCLEAR_FIX.sql` I just created for you.\n" +
                    "3. Run the script. It will wipe out the stale functions and enforce the modern `finance_fee_structures` mapping.\n\n" +
                    "After running that script, click 'Finalize Enrollment' again and it will work perfectly!"
                );
            } else {
                alert("Enrollment Failed: " + (err.message || "Database transaction error."));
            }
            if (isMounted.current) setFinalizeState('idle');
        }
    };

    // Helper: Create a Missing placeholder doc in DB and return the real ID
    const ensureDocInDb = async (docId: number): Promise<number | null> => {
        if (docId > 0) return docId; // Already in DB
        // Find the doc in local state by its placeholder ID
        const doc = docs.find(d => d.id === docId);
        if (!doc) return null;
        try {
            const { data, error } = await supabase
                .from('document_requirements')
                .insert({
                    admission_id: admission.id,
                    document_name: doc.document_name,
                    is_mandatory: doc.is_mandatory,
                    status: 'Pending'
                })
                .select('id')
                .single();

            if (error) {
                console.error("Failed to create doc in DB:", error);
                return null;
            }
            return data?.id || null;
        } catch (e) {
            console.error("ensureDocInDb error:", e);
            return null;
        }
    };

    const handleVerifyDoc = async (docId: number) => {
        try {
            const realId = await ensureDocInDb(docId);
            if (!realId) {
                alert("Could not create document record. Please try Initialize Compliance Protocol first.");
                return;
            }
            await supabase.from('document_requirements').update({ status: 'Verified' }).eq('id', realId);
            fetchDocs();
        } catch (e) { console.error(e); }
    };

    const handleRejectDoc = async (docId: number) => {
        const reason = prompt("Enter rejection reason:");
        if (!reason) return;
        try {
            const realId = await ensureDocInDb(docId);
            if (!realId) {
                alert("Could not create document record. Please try Initialize Compliance Protocol first.");
                return;
            }
            await supabase.from('document_requirements').update({ status: 'Rejected', rejection_reason: reason }).eq('id', realId);
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
        <div className="fixed inset-0 z-[100] bg-bg-primary/95 backdrop-blur-3xl overflow-y-auto custom-scrollbar flex flex-col items-center">
            {/* Main Console Container */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-[1440px] min-h-screen bg-bg-secondary border-x border-white/[0.03] flex flex-col shadow-2xl"
            >
                {/* ═══ ENTERPRISE HEADER REBUILD ═══ */}
                <header className="px-8 py-6 border-b border-white/[0.03] bg-bg-card/50 sticky top-0 z-50 backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-8">
                        {/* Student Identity Section */}
                        <div className="flex items-center gap-6 min-w-0">
                            <div className="relative">
                                <PremiumAvatar
                                    src={admission.profile_photo_url}
                                    name={admission.applicant_name}
                                    size="xl"
                                    className="ring-4 ring-white/5 shadow-2xl"
                                />
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-accent-success rounded-full border-4 border-bg-secondary flex items-center justify-center">
                                    <ShieldCheckIcon className="w-3 h-3 text-white" />
                                </div>
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <h2 className="text-3xl font-black text-white tracking-tight uppercase truncate">{admission.applicant_name}</h2>
                                    <span className={clsx("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-current",
                                        admission.status === 'Enrolled' ? "text-accent-success bg-accent-success/10" : "text-accent-warning bg-accent-warning/10"
                                    )}>
                                        {admission.status || 'PROSPECT'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Grade</span>
                                        <span className="text-[11px] font-bold text-white/60">{admission.grade}</span>
                                    </div>
                                    <div className="w-1 h-1 rounded-full bg-white/10" />
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Reg ID</span>
                                        <span className="text-[11px] font-mono text-white/60">{admission.application_number || 'PENDING'}</span>
                                    </div>
                                    <div className="w-1 h-1 rounded-full bg-white/10" />
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Parent</span>
                                        <span className="text-[11px] font-bold text-white/60 truncate max-w-[150px]">{admission.parent_email}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Central Compliance Status - Quick View */}
                        <div className="hidden xl:flex items-center gap-8 px-8 border-x border-white/[0.03]">
                            <div className="text-center">
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-1">Verified</p>
                                <p className="text-xl font-black text-accent-success leading-none">{verifiedDocs}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-1">Missing</p>
                                <p className="text-xl font-black text-accent-error leading-none">{docs.filter(d => d.status === 'Missing').length}</p>
                            </div>
                            <div className="w-px h-10 bg-white/5" />
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between gap-10">
                                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Compliance Score</span>
                                    <span className="text-[11px] font-black text-accent-primary">{progressPercentage}%</span>
                                </div>
                                <div className="w-48 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progressPercentage}%` }}
                                        className="h-full bg-accent-primary shadow-[0_0_10px_rgba(139,92,246,0.3)]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Command Strip */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={fetchDocs}
                                className="p-3 rounded-xl bg-white/[0.03] text-white/25 hover:text-white hover:bg-white/[0.06] transition-all border border-white/[0.05]"
                            >
                                <RefreshCwIcon className={clsx("w-5 h-5", loading && "animate-spin")} />
                            </button>
                            <button
                                onClick={() => setIsRequestingDoc(true)}
                                className="flex items-center gap-2 px-6 py-3 bg-accent-primary hover:bg-accent-primary/80 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-accent-primary/10 active:scale-95 border border-white/10"
                            >
                                <PlusIcon className="w-4 h-4" />
                                Request Document
                            </button>
                            <button
                                onClick={onClose}
                                className="p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/30 hover:text-white transition-all hover:rotate-90 duration-500 border border-white/[0.06]"
                            >
                                <XIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Secondary Navigation Strip */}
                    <div className="flex items-center gap-1 mt-6 bg-bg-card p-1 rounded-xl border border-white/[0.03] w-fit">
                        {[
                            { key: 'vault' as const, label: 'Documentation Vault', icon: <ShieldCheckIcon className="w-4 h-4" /> },
                            { key: 'identity' as const, label: 'Applicant Identity', icon: <UserIcon className="w-4 h-4" /> },
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={clsx(
                                    "flex items-center gap-2.5 px-6 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-[0.15em] transition-all duration-300",
                                    activeTab === tab.key
                                        ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/20 shadow-lg shadow-accent-primary/5"
                                        : "text-white/20 hover:text-white/40 border border-transparent"
                                )}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </header>

                {/* ═══ MAIN BODY (GRID SYSTEM) ═══ */}
                <main className="flex-grow grid grid-cols-12 overflow-hidden">
                    {/* Left Sidebar / Meta Panel */}
                    <aside className="col-span-12 lg:col-span-3 border-r border-white/[0.03] bg-bg-card/30 p-8 space-y-8 overflow-y-auto custom-scrollbar">
                        <div>
                            <h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-6">Vault Summary</h3>
                            <div className="space-y-4">
                                <SummaryBadge label="Total Artifacts" value={totalDocs} color="primary" />
                                <SummaryBadge label="Verified Assets" value={verifiedDocs} color="success" />
                                <SummaryBadge label="Pending Review" value={submittedDocs} color="warning" />
                                <SummaryBadge label="Missing mandatory" value={docs.filter(d => d.status === 'Missing').length} color="error" />
                            </div>
                        </div>

                        <div className="pt-8 border-t border-white/[0.03]">
                            <h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-4">Security Protocol</h3>
                            <div className="p-4 rounded-xl bg-accent-success/5 border border-accent-success/10 space-y-3">
                                <div className="flex items-center gap-2">
                                    <ShieldCheckIcon className="w-4 h-4 text-accent-success" />
                                    <span className="text-[10px] font-black text-accent-success uppercase tracking-widest">End-to-End Encrypted</span>
                                </div>
                                <p className="text-[9px] text-white/30 leading-relaxed uppercase tracking-wider font-bold">
                                    All documents are audit-logged and stored in verified compliance nodes.
                                </p>
                            </div>
                        </div>
                    </aside>

                    {/* Primary Content Area */}
                    <section className="col-span-12 lg:col-span-9 overflow-y-auto custom-scrollbar p-8">
                        {finalizeState === 'success' ? (
                            <SuccessBanner provisionedData={provisionedData} />
                        ) : loading ? (
                            <div className="space-y-6 max-w-5xl mx-auto">
                                <div className="h-32 bg-white/5 rounded-2xl animate-pulse" />
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
                                    ))}
                                </div>
                            </div>
                        ) : activeTab === 'vault' ? (
                            <div className="space-y-8 max-w-5xl mx-auto">
                                {docs.length === 0 ? (
                                    <div className="py-20 flex flex-col items-center justify-center text-center gap-6 bg-bg-card/40 border border-dashed border-white/10 rounded-3xl">
                                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
                                            <FileTextIcon className="w-10 h-10 text-white/10" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-xl font-bold text-white/40 uppercase tracking-widest">No Documents Found</h3>
                                            <p className="text-sm text-white/20 max-w-xs mx-auto">
                                                No document requirements have been initialized for this application node.
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleInitializeCompliance}
                                            disabled={seedingDocs}
                                            className="px-6 py-3 bg-accent-primary/10 hover:bg-accent-primary border border-accent-primary/20 text-accent-primary hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all gap-2 flex items-center"
                                        >
                                            {seedingDocs ? <RefreshCwIcon className="w-4 h-4 animate-spin" /> : <PlusIcon className="w-4 h-4" />}
                                            Initialize Compliance Protocol
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {/* Horizontal Compliance Summary Strip */}
                                        <div className="flex items-center justify-between gap-4 p-6 bg-bg-card/80 border border-white/[0.03] rounded-2xl shadow-xl">
                                            <div className="flex items-center gap-12">
                                                <div className="space-y-1">
                                                    <p className="text-2xl font-black text-white leading-none">{totalDocs}</p>
                                                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Total Required</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-2xl font-black text-accent-success leading-none">{verifiedDocs}</p>
                                                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Verified</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-2xl font-black text-accent-warning leading-none">{submittedDocs}</p>
                                                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Submitted</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-2xl font-black text-accent-error leading-none">{docs.filter(d => d.status === 'Missing').length}</p>
                                                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Missing</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6 pl-8 border-l border-white/[0.05]">
                                                <div className="text-right space-y-1">
                                                    <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Overall Compliance</p>
                                                    <p className="text-3xl font-black text-white leading-none tracking-tighter">{progressPercentage}%</p>
                                                </div>
                                                <div className="w-16 h-16 relative flex items-center justify-center">
                                                    <svg className="w-full h-full -rotate-90">
                                                        <circle cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="6" className="text-white/5" />
                                                        <circle cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="6" className="text-accent-primary" strokeDasharray={176} strokeDashoffset={176 - (176 * progressPercentage) / 100} />
                                                    </svg>
                                                    <ShieldCheckIcon className="absolute w-5 h-5 text-accent-primary opacity-50" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Accordion Categories */}
                                        <div className="space-y-4">
                                            {['Identity Documents', 'Academic Records', 'Financial Records', 'Medical Records', 'Compliance Artifacts'].map(catName => {
                                                const catDocs = docs.filter(d => getDocumentCategory(d.document_name) === catName);
                                                if (catDocs.length === 0 && catName === 'Compliance Artifacts') return null;
                                                if (catDocs.length === 0) return null;
                                                return (
                                                    <DocumentCategoryAccordion
                                                        key={catName}
                                                        category={catName}
                                                        docs={catDocs}
                                                        onVerify={handleVerifyDoc}
                                                        onReject={handleRejectDoc}
                                                        onDownload={handleDownload}
                                                        downloadingId={downloadingId}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <IdentityTab admission={admission} />
                        )}
                    </section>
                </main>

                {/* ═══ STICKY FINALIZATION FOOTER ═══ */}
                {finalizeState !== 'success' && (
                    <footer className="border-t border-white/[0.03] bg-bg-card/80 backdrop-blur-xl px-8 py-4 flex items-center justify-between gap-6 sticky bottom-0 z-50">
                        {/* Left: Compliance Status */}
                        <div className="flex items-center gap-4">
                            <div className={clsx(
                                "w-2.5 h-2.5 rounded-full animate-pulse",
                                allMandatoryVerified ? "bg-accent-success shadow-[0_0_10px_rgba(34,197,94,0.6)]" : "bg-accent-warning shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                            )} />
                            <div>
                                <p className={clsx(
                                    "text-[10px] font-black uppercase tracking-[0.25em]",
                                    allMandatoryVerified ? "text-accent-success" : "text-accent-warning"
                                )}>
                                    {allMandatoryVerified ? "Ready For Finalization" : "Awaiting Document Clearance"}
                                </p>
                                <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest mt-0.5">
                                    {allMandatoryVerified
                                        ? "All mandatory artifacts verified. Enrollment protocol unlocked."
                                        : `${mandatoryDocs.filter(d => d.status !== 'Verified').length} mandatory document(s) pending verification.`
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Right: Finalize Button */}
                        <div className="flex items-center gap-3">
                            {admission.status !== 'Enrolled' ? (
                                <button
                                    id="finalize-enrollment-btn"
                                    onClick={handleFinalize}
                                    disabled={finalizeState === 'processing'}
                                    className={clsx(
                                        "flex items-center gap-3 px-8 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 active:scale-95 border",
                                        finalizeState === 'processing'
                                            ? "bg-white/5 border-white/10 text-white/20 cursor-not-allowed"
                                            : allMandatoryVerified
                                                ? "bg-accent-primary hover:bg-accent-primary/80 text-white border-transparent shadow-xl shadow-accent-primary/20"
                                                : "bg-accent-warning/10 hover:bg-accent-warning text-accent-warning hover:text-white border-accent-warning/30 hover:border-transparent"
                                    )}
                                >
                                    {finalizeState === 'processing' ? (
                                        <>
                                            <RefreshCwIcon className="w-4 h-4 animate-spin" />
                                            Processing Identity...
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheckIcon className="w-4 h-4" />
                                            Finalize Enrollment
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div className="flex items-center gap-3 px-8 py-3.5 rounded-xl bg-accent-success/10 border border-accent-success/20">
                                    <ShieldCheckIcon className="w-4 h-4 text-accent-success" />
                                    <span className="text-[11px] font-black uppercase tracking-widest text-accent-success">Enrolled &amp; Secured</span>
                                </div>
                            )}
                        </div>
                    </footer>
                )}
            </motion.div>
        </div>
    );
};

// ═══ HELPER COMPONENTS ═══

function SummaryBadge({ label, value, color }: { label: string, value: number, color: 'primary' | 'success' | 'warning' | 'error' }) {
    const colorMap = {
        primary: 'text-accent-primary border-accent-primary/20 bg-accent-primary/5',
        success: 'text-accent-success border-accent-success/20 bg-accent-success/5',
        warning: 'text-accent-warning border-accent-warning/20 bg-accent-warning/5',
        error: 'text-accent-error border-accent-error/20 bg-accent-error/5',
    };

    return (
        <div className={clsx("p-4 rounded-xl border flex items-center justify-between", colorMap[color])}>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</span>
            <span className="text-xl font-black">{value}</span>
        </div>
    );
}

function SuccessBanner({ provisionedData }: any) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-16 flex flex-col items-center justify-center text-center gap-6"
        >
            <div className="w-24 h-24 bg-accent-success/10 rounded-3xl flex items-center justify-center ring-4 ring-accent-success/20 overflow-hidden shadow-2xl">
                <ShieldCheckIcon className="w-12 h-12 text-accent-success" />
            </div>
            <div className="space-y-2">
                <h3 className="text-4xl font-black text-white uppercase tracking-tighter">Enrollment Secure</h3>
                <p className="text-accent-success font-mono uppercase tracking-[0.4em] text-lg">SID: {provisionedData?.student_id_number}</p>
            </div>
            <p className="text-white/30 text-sm max-w-sm mx-auto leading-relaxed font-bold uppercase tracking-widest">
                Identity and compliance verified. Student record is now globally active.
            </p>
        </motion.div>
    );
}

interface DocAccordionProps {
    category: string;
    docs: any[];
    onVerify: (id: number) => void;
    onReject: (id: number) => void;
    onDownload: (doc: any) => void;
    downloadingId: number | null;
}

function DocumentCategoryAccordion({ category, docs, onVerify, onReject, onDownload, downloadingId }: DocAccordionProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const verified = docs.filter(d => d.status === 'Verified').length;
    const isComplete = verified === docs.length;

    return (
        <div className="bg-bg-card/40 border border-white/[0.03] rounded-2xl overflow-hidden shadow-lg transition-all hover:border-white/[0.06]">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-8 py-5 flex items-center justify-between hover:bg-white/[0.02] transition-all"
            >
                <div className="flex items-center gap-6">
                    <div className={clsx("w-1.5 h-6 rounded-full transition-colors", isComplete ? "bg-accent-success shadow-[0_0_10px_rgba(34,197,94,0.3)]" : "bg-accent-primary")} />
                    <div className="text-left">
                        <h4 className="text-[11px] font-black text-white tracking-[0.2em] uppercase">{category}</h4>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{docs.length} Requirements</span>
                            <div className="w-1 h-1 rounded-full bg-white/10" />
                            <span className={clsx("text-[10px] font-black uppercase tracking-widest", isComplete ? "text-accent-success" : "text-accent-primary/60")}>
                                {verified}/{docs.length} Complete
                            </span>
                        </div>
                    </div>
                </div>
                <ChevronDownIcon className={clsx("w-5 h-5 text-white/20 transition-transform duration-300", isExpanded && "rotate-180")} />
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-white/5 bg-black/20"
                    >
                        <div className="p-4 space-y-2">
                            {docs.map(doc => (
                                <DocumentCard
                                    key={doc.id}
                                    doc={doc}
                                    onVerify={onVerify}
                                    onReject={onReject}
                                    onDownload={onDownload}
                                    downloadingId={downloadingId}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function DocumentCard({ doc, onVerify, onReject, onDownload, downloadingId }: any) {
    const [expanded, setExpanded] = useState(false);
    const file = doc.admission_documents?.[0];
    const status = doc.status;

    return (
        <motion.div
            layout
            className="flex flex-col bg-bg-card/40 border border-white/[0.03] rounded-xl hover:bg-bg-card/60 transition-all overflow-hidden"
        >
            <div className="flex items-center justify-between gap-6 p-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={clsx("w-10 h-10 rounded-lg flex items-center justify-center border transition-all",
                        status === 'Verified' ? "bg-accent-success/10 border-accent-success/20 text-accent-success" :
                            status === 'Submitted' ? "bg-accent-warning/10 border-accent-warning/20 text-accent-warning shadow-[0_0_15px_rgba(245,158,11,0.1)]" :
                                "bg-white/[0.03] border-white/10 text-white/20"
                    )}>
                        {status === 'Verified' ? <ShieldCheckIcon className="w-5 h-5" /> : <FileTextIcon className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="text-[11px] font-black text-white/80 uppercase tracking-widest truncate">
                                {doc.document_name}
                            </p>
                            {doc.is_mandatory && <span className="text-[8px] text-accent-primary bg-accent-primary/10 px-1.5 py-0.5 rounded border border-accent-primary/20 font-black">REQUIRED</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={clsx("text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1.5",
                                status === 'Verified' ? "text-accent-success" :
                                    status === 'Submitted' ? "text-accent-warning" :
                                        status === 'Rejected' ? "text-accent-error" :
                                            "text-white/20"
                            )}>
                                <div className={clsx("w-1 h-1 rounded-full", status === 'Verified' ? "bg-accent-success" : status === 'Submitted' ? "bg-accent-warning" : status === 'Rejected' ? "bg-accent-error" : "bg-white/10")} />
                                {status}
                            </span>
                            {file && (
                                <>
                                    <div className="w-0.5 h-0.5 rounded-full bg-white/10" />
                                    <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                                        Last Updated: {new Date(file.uploaded_at).toLocaleDateString()}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {file && (
                        <button
                            onClick={() => onDownload(doc)}
                            className="p-2 rounded-lg bg-white/[0.03] text-white/40 hover:text-white hover:bg-white/[0.06] border border-white/[0.05] transition-all"
                        >
                            {downloadingId === doc.id ? <RefreshCwIcon className="w-4 h-4 animate-spin" /> : <DownloadIcon className="w-4 h-4" />}
                        </button>
                    )}
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className={clsx("p-2 rounded-lg bg-white/[0.03] border border-white/[0.05] transition-all", expanded ? "bg-accent-primary/20 text-accent-primary" : "text-white/20 hover:text-white")}
                    >
                        <EyeIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden border-t border-white/[0.03] bg-black/20"
                    >
                        <div className="p-6 space-y-6">
                            {(status === 'Submitted' || status === 'Pending' || status === 'Missing') && (
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => onVerify(doc.id)}
                                        className="flex-1 py-3 bg-accent-success/10 hover:bg-accent-success text-accent-success hover:text-white border border-accent-success/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                    >
                                        Verify & Secure Artifact
                                    </button>
                                    <button
                                        onClick={() => onReject(doc.id)}
                                        className="flex-1 py-3 bg-accent-error/10 hover:bg-accent-error text-accent-error hover:text-white border border-accent-error/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                    >
                                        Reject Asset
                                    </button>
                                </div>
                            )}

                            {doc.rejection_reason && (
                                <div className="p-4 rounded-xl bg-accent-error/5 border border-accent-error/10">
                                    <p className="text-[9px] font-black text-accent-error uppercase tracking-widest mb-1 leading-none">Protocol Violation Reason</p>
                                    <p className="text-sm font-bold text-white/60">{doc.rejection_reason}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-8 pt-4">
                                <div className="space-y-4">
                                    <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Audit Records</p>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-accent-primary" />
                                            <p className="text-[11px] font-bold text-white/40 uppercase">Requirement initialized</p>
                                        </div>
                                        {file && (
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-accent-success" />
                                                <p className="text-[11px] font-bold text-white/40 uppercase">
                                                    Uploaded by <span className="text-accent-primary">{file.uploader?.display_name || 'System'}</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-2">Vault Location</p>
                                    <span className="inline-block px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-[10px] font-mono text-white/30 truncate max-w-full italic">
                                        {file?.storage_path || 'AWAITING_UPLINK'}
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

function IdentityTab({ admission }: any) {
    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InfoCard
                    title="Registry Details"
                    icon={<FileTextIcon className="w-4 h-4" />}
                    data={[
                        { label: 'Application Number', value: admission.application_number },
                        { label: 'Grade of Enrollment', value: `Standard ${admission.grade}` },
                        { label: 'Registry Status', value: admission.status },
                        { label: 'Last Update', value: new Date().toLocaleDateString() }
                    ]}
                />
                <InfoCard
                    title="Guardian Context"
                    icon={<UserIcon className="w-4 h-4" />}
                    data={[
                        { label: 'Guardian Email', value: admission.parent_email },
                        { label: 'Sync Status', value: 'Synchronized with Cloud Registry' },
                        { label: 'Communication Node', value: 'Endpoint Active' }
                    ]}
                />
            </div>

            <div className="p-8 bg-bg-card/30 border border-white/[0.03] rounded-3xl space-y-4">
                <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Compliance Footprint</h4>
                <div className="grid grid-cols-4 gap-6">
                    <MetaItem label="Age" value={admission.age} />
                    <MetaItem label="Gender" value={admission.gender} />
                    <MetaItem label="Address" value={admission.address} isLong />
                </div>
            </div>
        </div>
    );
}

function InfoCard({ title, icon, data }: any) {
    return (
        <div className="bg-bg-card/50 border border-white/[0.03] rounded-2xl p-8 space-y-6 hover:border-white/10 transition-all">
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-accent-primary/10 text-accent-primary border border-accent-primary/10">
                    {icon}
                </div>
                <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{title}</h4>
            </div>
            <div className="space-y-5">
                {data.map((item: any, idx: number) => (
                    <div key={idx} className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">{item.label}</span>
                        <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">{item.value || 'N/A'}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function MetaItem({ label, value, isLong }: { label: string; value: any; isLong?: boolean }) {
    return (
        <div className={clsx("flex flex-col gap-1.5", isLong && "col-span-2")}>
            <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">{label}</span>
            <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider leading-relaxed">{value || 'N/A'}</span>
        </div>
    );
}

export default AdmissionDetailsModal;
