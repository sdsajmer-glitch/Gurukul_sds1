
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, formatError } from '../../services/supabase';
import { StorageService, BUCKETS } from '../../services/storage';
import { UserProfile, DocumentRequirement as RequirementWithDocs, AdmissionApplication } from '../../types';
import Spinner from '../common/Spinner';
import { DocumentTextIcon } from '../icons/DocumentTextIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { EyeIcon } from '../icons/EyeIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import PremiumAvatar from '../common/PremiumAvatar';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from '../icons/XIcon';
import { PaperClipIcon } from '../icons/PaperClipIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { FileTextIcon } from '../icons/FileTextIcon';
import { LockIcon } from '../icons/LockIcon';
import clsx from 'clsx';

// Design System Components
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

// --- Types ---
interface GroupedRequirementData {
    admissionId: string;
    applicantName: string;
    profilePhotoUrl: string | null;
    grade: string;
    requirements: RequirementWithDocs[];
}

interface DocumentsTabProps {
    profile: UserProfile;
    focusOnAdmissionId?: string | null;
    onClearFocus: () => void;
    setActiveComponent?: (id: string) => void;
}

const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// --- Sub-Components ---
const DocumentCard: React.FC<{
    req: RequirementWithDocs;
    onUpload: (file: File, reqId: number, admId: string, onProgress: (progress: number) => void) => Promise<void>;
}> = ({ req, onUpload }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const status = req.status || 'Pending';
    const isMandatory = req.is_mandatory;
    const docFile = req.admission_documents?.[0];
    const hasFileRecord = !!docFile;

    const isVerified = status === 'Verified' || status === 'APPROVED';
    const isRejected = status === 'Rejected';
    const isSubmitted = status === 'Submitted' || status === 'Uploaded' || status === 'Reviewing';
    const isPending = isSubmitted || (!hasFileRecord && isMandatory);

    const handleFileSelect = async (files: FileList | null) => {
        if (!files?.length || uploadProgress !== null) return;
        const selectedFile = files[0];
        if (selectedFile.size > 10 * 1024 * 1024) {
            setError("File size exceeds 10MB limit.");
            return;
        }
        setError(null);
        setUploadProgress(0);
        try {
            await onUpload(selectedFile, req.id, req.admission_id, (progress) => setUploadProgress(progress));
        } catch (err: any) {
            setError(formatError(err));
        } finally {
            setUploadProgress(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
        if (e.dataTransfer.files?.length > 0) handleFileSelect(e.dataTransfer.files);
    };

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!docFile?.storage_path) return;
        setIsDownloading(true);
        try {
            const { data, error } = await supabase.storage.from(BUCKETS.DOCUMENTS).download(docFile.storage_path);
            if (error) throw error;
            const url = window.URL.createObjectURL(data);
            const a = document.createElement('a'); a.href = url; a.download = docFile.file_name;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) { alert("Download failed."); } finally { setIsDownloading(false); }
    };

    const handleView = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!docFile?.storage_path) return;
        try {
            const url = await StorageService.getSignedUrl(BUCKETS.DOCUMENTS, docFile.storage_path);
            window.open(url, '_blank');
        } catch (err) { alert("Unable to open preview."); }
    };

    return (
        <Card
            className={clsx(
                "h-full relative overflow-hidden transition-all duration-500 rounded-[2rem]",
                "bg-[#0d0f14] border-white/5 hover:border-white/10 shadow-2xl hover:shadow-primary/5 hover:-translate-y-1",
                isDragOver && "ring-2 ring-primary bg-primary/[0.02]",
                isVerified && "border-emerald-500/20"
            )}
        >
            {/* Header / Security Badge */}
            <div className="flex justify-between items-start mb-6 relative z-10">
                <div className={clsx(
                    "p-3 rounded-2xl border transition-all duration-500",
                    isVerified ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                        isRejected ? "bg-red-500/10 border-red-500/20 text-red-500" :
                            isPending ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                                "bg-white/[0.03] border-white/5 text-white/20"
                )}>
                    {isVerified ? <ShieldCheckIcon className="w-5 h-5" /> :
                        isRejected ? <XIcon className="w-5 h-5" /> :
                            <LockIcon className="w-5 h-5 opacity-40" />}
                </div>

                <div className="flex items-center gap-2">
                    <div className={clsx(
                        "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border shadow-sm",
                        isVerified ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                            isRejected ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                isPending ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                    "bg-white/5 text-white/40 border-white/10"
                    )}>
                        {status}
                    </div>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={clsx(
                            "w-8 h-8 rounded-full border border-white/10 flex items-center justify-center transition-all duration-300",
                            isExpanded ? "bg-primary/20 border-primary/30 rotate-180" : "bg-white/5 hover:bg-white/10"
                        )}
                    >
                        <ChevronDownIcon className={clsx("w-4 h-4", isExpanded ? "text-primary" : "text-white/30")} />
                    </button>
                </div>
            </div>

            {/* Title Section */}
            <div className="relative z-10 mb-8">
                <h4 className="text-[17px] font-bold text-white tracking-tight leading-tight mb-2 group-hover:text-primary transition-colors cursor-default">
                    {req.document_name}
                </h4>
                <div className="flex items-center gap-2">
                    <p className={clsx(
                        "text-[10px] font-bold uppercase tracking-widest",
                        isMandatory ? "text-primary/70" : "text-white/20"
                    )}>
                        {isMandatory ? 'Identity Essential' : 'Supporting Evidence'}
                    </p>
                    <div className="w-1 h-1 rounded-full bg-white/5"></div>
                    <span className="text-[9px] text-white/10 font-medium">Encrypted Storage</span>
                </div>
            </div>

            {/* Interaction Area (Always Visible Header) */}
            <div className="relative z-10 flex flex-col h-full">
                <AnimatePresence initial={false}>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                            className="overflow-hidden"
                        >
                            <div className="pb-6 space-y-4">
                                {req.notes_for_parent && (
                                    <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mb-1">Instructions</p>
                                        <p className="text-[11px] text-white/60 leading-relaxed italic">{req.notes_for_parent}</p>
                                    </div>
                                )}

                                {isRejected && req.rejection_reason && (
                                    <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                                        <p className="text-[9px] font-black text-red-500/40 uppercase tracking-[0.2em] mb-1">Rejection Reason</p>
                                        <p className="text-[11px] text-red-400/80 leading-relaxed">{req.rejection_reason}</p>
                                    </div>
                                )}

                                <div
                                    className="relative"
                                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                                    onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
                                    onDrop={handleDrop}
                                >
                                    {hasFileRecord ? (
                                        <div className="space-y-4">
                                            {/* Artifact Slot */}
                                            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex items-center gap-4 group/file hover:bg-black/60 transition-all">
                                                <div className="w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center text-white/20 group-hover/file:text-primary transition-colors">
                                                    {docFile.mime_type?.includes('pdf') ? <FileTextIcon className="w-5 h-5" /> : <PaperClipIcon className="w-5 h-5" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-white/70 truncate uppercase tracking-wide">{docFile.file_name}</p>
                                                    <p className="text-[9px] text-white/20 font-mono mt-1">{formatFileSize(docFile.file_size || 0)} • Verified Hash</p>
                                                </div>
                                            </div>

                                            {/* High-Trust Action Bar */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <Button
                                                    variant="secondary"
                                                    className="h-12 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border-white/5 text-white/60 hover:text-white flex items-center justify-center gap-2 transition-all active:scale-95"
                                                    onClick={handleView}
                                                >
                                                    <EyeIcon className="w-4 h-4" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Preview</span>
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    className="h-12 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border-white/5 text-white/60 hover:text-white flex items-center justify-center gap-2 transition-all active:scale-95"
                                                    onClick={handleDownload}
                                                    disabled={isDownloading}
                                                >
                                                    <DownloadIcon className="w-4 h-4" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Store</span>
                                                </Button>
                                            </div>

                                            {!isVerified && (
                                                <div className="pt-2">
                                                    <button
                                                        className="w-full h-10 text-[9px] font-black uppercase tracking-[0.25em] text-white/20 hover:text-primary transition-all flex items-center justify-center gap-3 border border-dashed border-white/5 rounded-xl hover:border-primary/30 hover:bg-primary/[0.02]"
                                                        onClick={() => fileInputRef.current?.click()}
                                                    >
                                                        <UploadIcon className="w-3.5 h-3.5" /> Replace Artifact
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        // Secure Upload Zone
                                        <div className="space-y-4">
                                            {uploadProgress !== null ? (
                                                <div className="bg-primary/5 p-6 rounded-[1.5rem] border border-primary/20 text-center animate-pulse">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-3">Encrypting Node... {uploadProgress.toFixed(0)}%</p>
                                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                        <div className="h-full bg-primary" style={{ width: `${uploadProgress}%` }}></div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="w-full group/upload cursor-pointer rounded-[1.5rem] border-2 border-dashed border-white/5 hover:border-primary/50 hover:bg-primary/[0.02] p-8 flex flex-col items-center justify-center gap-4 transition-all duration-700"
                                                >
                                                    <div className="w-14 h-14 rounded-2xl bg-white/[0.02] flex items-center justify-center group-hover/upload:bg-primary/10 transition-all duration-700">
                                                        <UploadIcon className="w-6 h-6 text-white/10 group-hover/upload:text-primary transition-colors" />
                                                    </div>
                                                    <div className="text-center">
                                                        <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] group-hover/upload:text-white/60 transition-colors">Provision Artifact</span>
                                                        <p className="text-[9px] text-white/5 mt-2 italic font-medium px-4 opacity-0 group-hover/upload:opacity-100 transition-opacity">Select an identity document for secure synchronization.</p>
                                                    </div>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {!isExpanded && (
                    <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[9px] font-black text-white/10 uppercase tracking-widest">
                            {hasFileRecord ? "Artifact Provisioned" : "Awaiting Artifact"}
                        </span>
                        <button
                            onClick={() => setIsExpanded(true)}
                            className="text-[9px] font-black text-primary uppercase tracking-[0.2em] hover:underline"
                        >
                            Quick View
                        </button>
                    </div>
                )}
            </div>

            {/* Error Logic */}
            <AnimatePresence>
                {error && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute inset-x-4 bottom-4 bg-red-500 p-3 text-[10px] font-black uppercase tracking-widest text-center rounded-xl shadow-2xl z-50 flex items-center justify-between">
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="p-1 hover:bg-white/10 rounded-lg"><XIcon className="w-4 h-4" /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            <input ref={fileInputRef} type="file" className="hidden" onChange={e => handleFileSelect(e.target.files)} />
        </Card>
    );
};


const DocumentsTab: React.FC<DocumentsTabProps> = ({ profile, focusOnAdmissionId, onClearFocus, setActiveComponent }) => {
    const [loading, setLoading] = useState(true);
    const [groupedData, setGroupedData] = useState<Record<string, GroupedRequirementData>>({});
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        setError(null);
        try {
            await supabase.rpc('parent_initialize_vault_slots_all');
            const { data: children, error: childError } = await supabase.rpc('get_my_children_profiles');
            if (childError) throw childError;
            const { data: reqs, error: reqsErr } = await supabase.rpc('parent_get_document_requirements', { p_user_id: profile.id });
            if (reqsErr) throw reqsErr;

            const grouped: Record<string, GroupedRequirementData> = {};

            (children || []).forEach((child: AdmissionApplication) => {
                grouped[child.id] = {
                    admissionId: child.id,
                    applicantName: child.applicant_name,
                    profilePhotoUrl: child.profile_photo_url,
                    grade: child.grade,
                    requirements: []
                };
            });

            (reqs || []).forEach((req: RequirementWithDocs) => {
                if (grouped[req.admission_id]) {
                    grouped[req.admission_id].requirements.push(req);
                }
            });

            // Sort requirements
            Object.values(grouped).forEach(group => {
                group.requirements.sort((a, b) => {
                    if (a.is_mandatory && !b.is_mandatory) return -1;
                    if (!a.is_mandatory && b.is_mandatory) return 1;
                    return a.document_name.localeCompare(b.document_name);
                });
            });

            setGroupedData(grouped);

            if (!isSilent) {
                if (focusOnAdmissionId && grouped[focusOnAdmissionId]) {
                    setExpandedIds(new Set([focusOnAdmissionId]));
                    onClearFocus();
                }
                // Auto-expand removed as per user request (Start Collapsed)
                // else if (Object.keys(grouped).length > 0 && expandedIds.size === 0) {
                //     setExpandedIds(new Set([Object.keys(grouped)[0]]));
                // }
            }
        } catch (err: any) {
            setError(formatError(err));
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, [profile.id, focusOnAdmissionId, onClearFocus]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleUpload = async (file: File, reqId: number, admId: string, onProgress: (progress: number) => void) => {
        if (!profile.id) throw new Error("Identity context missing.");

        // Simulating upload progress for better UX
        const interval = setInterval(() => {
            onProgress(Math.random() * 50 + 20);
        }, 300);

        try {
            const path = StorageService.getDocumentPath(profile.id, admId, reqId, file.name);
            const { error: upErr } = await supabase.storage.from(BUCKETS.DOCUMENTS).upload(path, file, { upsert: true });

            clearInterval(interval);
            onProgress(100);

            if (upErr) throw upErr;

            const { error: dbErr } = await supabase.rpc('parent_complete_document_upload', {
                p_requirement_id: reqId,
                p_admission_id: admId,
                p_file_name: file.name,
                p_storage_path: path,
                p_file_size: file.size,
                p_mime_type: file.type
            });

            if (dbErr) throw dbErr;

            await new Promise(resolve => setTimeout(resolve, 500));
            await fetchData(true);
        } catch (error) {
            clearInterval(interval);
            throw error;
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    if (loading) return (
        <div className="py-40 flex flex-col items-center justify-center gap-6">
            <Spinner size="lg" className="text-primary" />
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20 animate-pulse">Synchronizing Security Vault</p>
        </div>
    );

    if (error) return <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-center font-bold">{error}</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-32 animate-in fade-in duration-1000">
            {/* Page Header */}
            <div className="text-center md:text-left mb-16 border-l-2 border-primary/20 pl-8 md:pl-12 py-2">
                <div className="flex items-center gap-3 mb-4 justify-center md:justify-start">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Security Protocol</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-serif font-black text-white tracking-tighter uppercase leading-none">
                    Artifact <span className="opacity-30 font-normal">Vault.</span>
                </h2>
                <p className="text-white/40 text-[15px] leading-relaxed mt-6 max-w-lg italic font-serif">
                    Securely manage and synchronize institutional identity documents within a certified environment.
                </p>
            </div>

            {/* Enrolled Identities Selector */}
            <div className="space-y-8">
                {Object.keys(groupedData).map(admId => {
                    const node = groupedData[admId];
                    const isExpanded = expandedIds.has(admId);
                    const verifiedCount = node.requirements.filter(r => ['Verified', 'Submitted', 'Uploaded', 'Reviewing', 'APPROVED'].includes(r.status || '')).length;
                    const total = node.requirements.length;
                    const percent = total > 0 ? Math.round((verifiedCount / total) * 100) : 0;

                    return (
                        <div key={admId} className={clsx(
                            "group overflow-hidden rounded-[2.5rem] transition-all duration-700 border shadow-2xl",
                            isExpanded ? "bg-[#0c0e12] border-white/10 ring-1 ring-white/5" : "bg-[#0c0e12]/60 border-white/5 hover:border-white/10"
                        )}>
                            {/* Enrollment Header */}
                            <div
                                onClick={() => toggleExpand(admId)}
                                className={clsx(
                                    "relative p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8 cursor-pointer transition-all duration-700",
                                    isExpanded ? "bg-white/[0.02]" : "hover:bg-white/[0.01]"
                                )}
                            >
                                <div className="flex items-center gap-8 w-full md:w-auto z-10">
                                    <div className="relative">
                                        <div className={clsx(
                                            "absolute -inset-2 rounded-2xl blur-xl transition-all duration-700 opacity-0 group-hover:opacity-20",
                                            percent === 100 ? "bg-emerald-500" : "bg-primary"
                                        )}></div>
                                        <PremiumAvatar src={node.profilePhotoUrl} name={node.applicantName} size="md" className="w-20 h-20 rounded-2xl shadow-2xl relative z-10 grayscale-[0.3] group-hover:grayscale-0 transition-all duration-700" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-2xl font-bold text-white tracking-tight">{node.applicantName}</h3>
                                            {percent === 100 && <ShieldCheckIcon className="w-4 h-4 text-emerald-500" />}
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.2em]">Grade {node.grade} • Institutional Node</p>
                                            <div className="w-1 h-1 rounded-full bg-white/5"></div>
                                            <div className="flex items-center gap-3">
                                                <div className="h-1.5 w-24 bg-black/40 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                                    <div className={clsx(
                                                        "h-full rounded-full transition-all duration-1000",
                                                        percent === 100 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                                                    )} style={{ width: `${percent}%` }}></div>
                                                </div>
                                                <span className="text-[10px] font-black text-white/40">{percent}% Synchronized</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 z-10">
                                    <div className="text-right hidden md:block">
                                        <div className="flex items-center justify-end gap-2 mb-1">
                                            <LockIcon className="w-3 h-3 text-white/10" />
                                            <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Vault Status</span>
                                        </div>
                                        <span className={clsx(
                                            "text-[10px] font-black uppercase tracking-[0.15em]",
                                            percent === 100 ? "text-emerald-500" : "text-white/60"
                                        )}>
                                            {percent === 100 ? 'Verified Account' : 'Action Required'}
                                        </span>
                                    </div>
                                    <div className={clsx(
                                        "w-12 h-12 rounded-2xl border border-white/5 flex items-center justify-center transition-all duration-500 bg-white/[0.03]",
                                        isExpanded && "rotate-180 bg-primary/10 border-primary/20"
                                    )}>
                                        <ChevronDownIcon className={clsx("w-5 h-5", isExpanded ? "text-primary" : "text-white/20")} />
                                    </div>
                                </div>
                            </div>

                            {/* Artifact Grid Content */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                                    >
                                        <div className="border-t border-white/5 bg-black/20 p-8 md:p-12">
                                            {node.requirements.length === 0 ? (
                                                <div className="text-center py-20 bg-white/[0.01] rounded-[2rem] border border-dashed border-white/5">
                                                    <div className="w-16 h-16 rounded-2xl bg-white/[0.02] flex items-center justify-center mx-auto mb-6">
                                                        <FileTextIcon className="w-8 h-8 text-white/10" />
                                                    </div>
                                                    <p className="text-white/20 text-sm font-medium italic">No document requirements have been assigned to this node yet.</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                                    {node.requirements.map(req => (
                                                        <DocumentCard key={req.id} req={req} onUpload={handleUpload} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>

            {Object.keys(groupedData).length === 0 && !loading && (
                <div className="text-center py-32 rounded-[3rem] border-2 border-dashed border-white/5 bg-[#0c0e12]/40">
                    <PlusIcon className="w-12 h-12 text-white/5 mx-auto mb-6" />
                    <p className="text-white/20 font-medium italic text-lg tracking-tight">No active identity nodes found in your roster.</p>
                </div>
            )}
        </div>
    );
};

export default DocumentsTab;

