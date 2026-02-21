import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { SearchIcon } from '../icons/SearchIcon';
import { RefreshIcon } from '../icons/RefreshIcon';
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
    return 'Other Uploads';
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
    const [isPanelOpen, setIsPanelOpen] = useState(false); // For secure drawer

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
        <>
            <div
                className={clsx(
                    "flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-2xl border transition-all duration-300",
                    "bg-[#0d0f14] hover:bg-white/[0.02] cursor-pointer group hover:border-white/20",
                    isDragOver ? "ring-2 ring-primary bg-primary/[0.02] border-primary/30" : "border-white/5",
                    isVerified && "bg-emerald-500/[0.02] border-emerald-500/10 hover:border-emerald-500/30"
                )}
                onClick={() => setIsPanelOpen(true)}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
                onDrop={handleDrop}
            >
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className={clsx(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300 relative overflow-hidden",
                        isVerified ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                            isRejected ? "bg-red-500/10 border-red-500/20 text-red-500" :
                                isSubmitted ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                                    "bg-white/[0.05] border-white/5 text-white/30 group-hover:bg-white/[0.08]"
                    )}>
                        {isVerified && <div className="absolute inset-0 bg-emerald-500/20 shimmer-effect pointer-events-none"></div>}
                        {isVerified ? <ShieldCheckIcon className="w-5 h-5 relative z-10" /> :
                            isRejected ? <AlertTriangleIcon className="w-5 h-5 relative z-10" /> :
                                hasFileRecord ? <FileTextIcon className="w-5 h-5 relative z-10" /> :
                                    <LockIcon className="w-5 h-5 relative z-10 opacity-70" />}
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-bold text-white truncate tracking-tight">{req.document_name}</h4>
                            {isMandatory && <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" title="Required"></div>}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-white/40 font-medium">
                            {hasFileRecord ? (
                                <>
                                    <span className="flex items-center gap-1"><CheckCircleIcon className="w-3 h-3 text-emerald-500" /> AES-256</span>
                                    <span className="w-1 h-1 rounded-full bg-white/10"></span>
                                    <span>{new Date(docFile.created_at).toLocaleDateString()}</span>
                                    <span className="w-1 h-1 rounded-full bg-white/10"></span>
                                    <span>{formatFileSize(docFile.file_size || 0)}</span>
                                </>
                            ) : (
                                <span>Awaiting Upload</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t border-white/5 md:border-none gap-4">
                    <div className={clsx(
                        "px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border shrink-0",
                        isVerified ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                            isRejected ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                isSubmitted ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                    "bg-white/5 text-white/40 border-white/10"
                    )}>
                        {status}
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {hasFileRecord ? (
                            <>
                                <button onClick={handleView} className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/[0.03] hover:bg-white/[0.1] border border-white/5 text-white/60 hover:text-white transition-colors">
                                    <EyeIcon className="w-4 h-4" />
                                </button>
                                <button onClick={handleDownload} disabled={isDownloading} className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/[0.03] hover:bg-white/[0.1] border border-white/5 text-white/60 hover:text-white transition-colors">
                                    <DownloadIcon className="w-4 h-4" />
                                </button>
                                {!isVerified && (
                                    <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary transition-colors">
                                        <RefreshIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </>
                        ) : (
                            <button onClick={() => fileInputRef.current?.click()} className="h-9 px-4 rounded-xl flex items-center justify-center bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest transition-colors gap-2">
                                <UploadIcon className="w-3.5 h-3.5" /> Upload
                            </button>
                        )}
                        <input ref={fileInputRef} type="file" className="hidden" onChange={e => handleFileSelect(e.target.files)} />
                    </div>
                </div>

                {uploadProgress !== null && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
                        <div className="h-full bg-primary animate-pulse" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                )}
            </div>

            {/* Secure Drawer Modal */}
            <AnimatePresence>
                {isPanelOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" onClick={() => setIsPanelOpen(false)} />
                        <motion.div
                            initial={{ x: '100%', opacity: 0.5 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                            className="fixed right-0 top-0 bottom-0 w-full md:w-[480px] bg-[#0c0e12] border-l border-white/10 z-[60] shadow-2xl flex flex-col"
                        >
                            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
                                <div>
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">
                                        <LockIcon className="w-3 h-3" /> Secure Artifact Panel
                                    </div>
                                    <h3 className="text-lg font-bold text-white tracking-tight">{req.document_name}</h3>
                                </div>
                                <button onClick={() => setIsPanelOpen(false)} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 transition-colors">
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-start gap-4">
                                    <ShieldCheckIcon className={clsx("w-6 h-6 shrink-0", isVerified ? "text-emerald-500" : "text-white/20")} />
                                    <div>
                                        <p className="text-sm font-bold text-white mb-1">Status: <span className={isVerified ? "text-emerald-500" : isRejected ? "text-red-500" : "text-amber-500"}>{status}</span></p>
                                        <p className="text-[11px] text-white/50 leading-relaxed">
                                            {isVerified ? "This document has been verified by the institutional authority. Cryptographic locks are active." :
                                                isRejected ? "This document was rejected. Please review the reason below and upload a corrected version." :
                                                    isSubmitted ? "Document is currently under review by the administration. Security locks are active." :
                                                        "Awaiting secure upload. Ensure file is clear and legible before provisioning."}
                                        </p>
                                    </div>
                                </div>

                                {req.notes_for_parent && (
                                    <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl">
                                        <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1.5">Institutional Guideline</p>
                                        <p className="text-xs text-white/70 leading-relaxed italic">{req.notes_for_parent}</p>
                                    </div>
                                )}

                                {isRejected && req.rejection_reason && (
                                    <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
                                        <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1.5">Rejection Reason</p>
                                        <p className="text-xs text-red-400/80 leading-relaxed">{req.rejection_reason}</p>
                                    </div>
                                )}

                                {hasFileRecord ? (
                                    <div className="space-y-4">
                                        <div className="p-4 rounded-2xl bg-black border border-white/5">
                                            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-4">Metadata Analysis</p>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-white/40">File Name</span>
                                                    <span className="text-white/80 font-mono text-[10px] truncate max-w-[200px]" title={docFile.file_name}>{docFile.file_name}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-white/40">Size</span>
                                                    <span className="text-white/80">{formatFileSize(docFile.file_size || 0)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-white/40">Uploaded At</span>
                                                    <span className="text-white/80">{new Date(docFile.created_at).toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-white/40">Encryption</span>
                                                    <span className="text-emerald-500 font-mono text-[10px]">AES-256 (At Rest)</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-white/40">Required</span>
                                                    <span className="text-white/80">{isMandatory ? 'Yes' : 'No'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <Button variant="secondary" className="h-12 bg-white/[0.05] hover:bg-white/[0.1] border-white/5" onClick={handleView}>
                                                <EyeIcon className="w-4 h-4 mr-2" /> Preview
                                            </Button>
                                            <Button variant="secondary" className="h-12 bg-white/[0.05] hover:bg-white/[0.1] border-white/5" onClick={handleDownload}>
                                                <DownloadIcon className="w-4 h-4 mr-2" /> Store Securely
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-white/10 text-center">
                                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-white/20 mb-4">
                                            <UploadIcon className="w-8 h-8" />
                                        </div>
                                        <p className="text-sm font-bold text-white mb-2">No Artifact Present</p>
                                        <p className="text-xs text-white/40 mb-6">Upload a clear, high-quality document to fulfill this requirement.</p>
                                        <Button variant="primary" className="w-full" onClick={() => fileInputRef.current?.click()}>
                                            Upload Securely
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

const DocumentCategoryAccordion: React.FC<{
    category: string;
    reqs: RequirementWithDocs[];
    onUpload: (file: File, reqId: number, admId: string, onProgress: (progress: number) => void) => Promise<void>;
}> = ({ category, reqs, onUpload }) => {
    const mandatoryReqs = reqs.filter(r => r.is_mandatory);
    const uploadedMandatoryCount = mandatoryReqs.filter(r => ['Verified', 'Submitted', 'Uploaded', 'Reviewing', 'APPROVED'].includes(r.status || '')).length;
    const isMissingMandatory = mandatoryReqs.length > 0 && uploadedMandatoryCount < mandatoryReqs.length;

    // Auto-expand if missing mandatory docs
    const [isOpen, setIsOpen] = useState(isMissingMandatory);

    const percent = reqs.length === 0 ? 0 : Math.round(((reqs.filter(r => ['Verified', 'Submitted', 'Uploaded', 'Reviewing', 'APPROVED'].includes(r.status || '')).length) / reqs.length) * 100);

    return (
        <div className="bg-[#0b0c10]/40 border border-white/5 rounded-3xl overflow-hidden shadow-sm transition-colors hover:border-white/10 mb-6">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none"
            >
                <div className="flex items-center gap-4 flex-1">
                    <div className={clsx(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                        isMissingMandatory ? "bg-red-500/10 border-red-500/20 text-red-500" :
                            percent === 100 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                                "bg-white/[0.05] border-white/5 text-white/40"
                    )}>
                        {isMissingMandatory ? <AlertTriangleIcon className="w-5 h-5" /> : (percent === 100 ? <ShieldCheckIcon className="w-5 h-5" /> : <FileTextIcon className="w-5 h-5" />)}
                    </div>
                    <div className="flex-1 max-w-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                            <h3 className="text-sm font-bold text-white tracking-wide">{category}</h3>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                                {uploadedMandatoryCount}/{mandatoryReqs.length} Mandatory
                            </div>
                        </div>
                        <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden border border-white/5 relative">
                            <div className={clsx(
                                "h-full rounded-full transition-all duration-1000",
                                isMissingMandatory ? "bg-amber-500" : (percent === 100 ? "bg-emerald-500" : "bg-primary")
                            )} style={{ width: `${percent}%` }}></div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 ml-6 pl-4 border-l border-white/5">
                    <div className="text-right hidden sm:block">
                        <div className="text-xs font-bold text-white mb-0.5">{percent}% Complete</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-widest">{reqs.length} Documents</div>
                    </div>
                    <div className={clsx(
                        "w-8 h-8 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center transition-transform duration-300",
                        isOpen ? "rotate-180" : ""
                    )}>
                        <ChevronDownIcon className="w-4 h-4 text-white/50" />
                    </div>
                </div>
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 pt-0 space-y-3 border-t border-white/5 mt-2 bg-black/20">
                            {reqs.map(req => (
                                <DocumentCard key={req.id} req={req} onUpload={onUpload} />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const DocumentsTab: React.FC<DocumentsTabProps> = ({ profile, focusOnAdmissionId, onClearFocus, setActiveComponent }) => {
    const [loading, setLoading] = useState(true);
    const [groupedData, setGroupedData] = useState<Record<string, GroupedRequirementData>>({});
    const [selectedAdmissionId, setSelectedAdmissionId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
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
                    setSelectedAdmissionId(focusOnAdmissionId);
                    onClearFocus();
                } else if (Object.keys(grouped).length > 0 && !selectedAdmissionId) {
                    setSelectedAdmissionId(Object.keys(grouped)[0]);
                }
            }
        } catch (err: any) {
            setError(formatError(err));
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, [profile.id, focusOnAdmissionId, onClearFocus, selectedAdmissionId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleUpload = async (file: File, reqId: number, admId: string, onProgress: (progress: number) => void) => {
        if (!profile.id) throw new Error("Identity context missing.");

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

    const activeNode = selectedAdmissionId ? groupedData[selectedAdmissionId] : null;

    const filteredRequirements = useMemo(() => {
        if (!activeNode) return [];
        if (!searchQuery.trim()) return activeNode.requirements;
        const q = searchQuery.toLowerCase();
        return activeNode.requirements.filter(r => r.document_name.toLowerCase().includes(q));
    }, [activeNode, searchQuery]);

    const requirementsByCategory = useMemo(() => {
        const categories: Record<string, RequirementWithDocs[]> = {};
        filteredRequirements.forEach(req => {
            const cat = getDocumentCategory(req.document_name);
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(req);
        });
        return categories;
    }, [filteredRequirements]);

    const activeNodeStats = useMemo(() => {
        if (!activeNode) return { total: 0, verified: 0, pending: 0, isCompleted: false, percent: 0, uploadedMandatoryCount: 0, mandatoryTotal: 0 };
        const reqs = activeNode.requirements;

        if (reqs.length === 0) {
            return { total: 0, verified: 0, pending: 0, isCompleted: false, percent: 0, uploadedMandatoryCount: 0, mandatoryTotal: 0 };
        }

        const mandatoryReqs = reqs.filter(r => r.is_mandatory);
        const uploadedMandatoryCount = mandatoryReqs.filter(r => ['Verified', 'Submitted', 'Uploaded', 'Reviewing', 'APPROVED'].includes(r.status || '')).length;
        const mandatoryTotal = mandatoryReqs.length;
        const MIN_REQUIRED_DOCS = 3;

        const calcMandatoryTotal = Math.max(mandatoryTotal, MIN_REQUIRED_DOCS);
        const isCompleted = uploadedMandatoryCount >= MIN_REQUIRED_DOCS && uploadedMandatoryCount >= mandatoryTotal;
        const percent = Math.min(100, Math.round((uploadedMandatoryCount / calcMandatoryTotal) * 100));

        return {
            total: reqs.length,
            verified: reqs.filter(r => r.status === 'Verified' || r.status === 'APPROVED').length,
            pending: reqs.filter(r => r.status === 'Pending').length,
            isCompleted, percent, uploadedMandatoryCount, mandatoryTotal: calcMandatoryTotal
        };
    }, [activeNode]);

    if (loading) return (
        <div className="py-40 flex flex-col items-center justify-center gap-6">
            <Spinner size="lg" className="text-primary" />
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20 animate-pulse">Initialising Security Protocol</p>
        </div>
    );

    if (error) return <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-center font-bold">{error}</div>;

    const navItems = Object.keys(groupedData).map(id => groupedData[id]);

    return (
        <div className="w-full mx-auto space-y-6 pb-32 animate-in fade-in duration-1000 max-w-[1400px]">

            {/* LAYER 1: VAULT CONTROL BAR */}
            <div className="bg-[#0b0c10] border border-white/5 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>

                <div className="flex items-center gap-6 z-10">
                    <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center shrink-0">
                        <LockIcon className="w-8 h-8 text-primary opacity-80" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-xl font-bold text-white tracking-tight uppercase">Security Vault</h2>
                            <div className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Connected
                            </div>
                        </div>
                        <p className="text-[11px] text-white/40">All files are encrypted using AES-256 vault standard encryption. Access is controlled by secure RBAC policies.</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 z-10">
                    <div className="relative">
                        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        <input
                            type="text"
                            placeholder="Search Vault..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full sm:w-64 h-11 bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-4 text-sm text-white focus:ring-1 focus:ring-primary focus:border-primary/50 transition-all placeholder:text-white/20"
                        />
                    </div>
                    {/* Add visual space for health stats */}
                    {activeNode && (
                        <div className="flex items-center gap-4 px-4 h-11 bg-white/[0.02] border border-white/5 rounded-xl">
                            <div className="text-center">
                                <span className="block text-[10px] text-white/30 uppercase tracking-widest">Vault Health</span>
                                <span className={clsx("text-xs font-bold", activeNodeStats.isCompleted ? "text-emerald-500" : (activeNodeStats.uploadedMandatoryCount === 0 ? "text-red-500" : "text-amber-500"))}>
                                    {activeNodeStats.percent}%
                                </span>
                            </div>
                            <div className="w-px h-6 bg-white/10"></div>
                            <div className="text-center">
                                <span className="block text-[10px] text-white/30 uppercase tracking-widest">Documents</span>
                                <span className="text-xs font-bold text-white">{activeNodeStats.total}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* LAYER 2: HORIZONTAL STUDENT SELECTOR */}
            {navItems.length > 0 ? (
                <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-none items-stretch">
                    {navItems.map(node => {
                        const isSelected = selectedAdmissionId === node.admissionId;
                        return (
                            <button
                                key={node.admissionId}
                                onClick={() => setSelectedAdmissionId(node.admissionId)}
                                className={clsx(
                                    "flex items-center gap-4 px-4 py-3 rounded-2xl border transition-all duration-300 min-w-[240px]",
                                    isSelected ? "bg-primary/[0.05] border-primary/30 ring-1 ring-primary/20 shadow-lg" : "bg-[#0b0c10]/60 border-white/5 hover:border-white/10 hover:bg-[#0b0c10]"
                                )}
                            >
                                <PremiumAvatar src={node.profilePhotoUrl} name={node.applicantName} size="sm" className={clsx("shrink-0 transition-opacity", !isSelected && "opacity-60")} />
                                <div className="text-left flex-1 min-w-0">
                                    <div className="text-sm font-bold text-white truncate">{node.applicantName}</div>
                                    <div className="text-[10px] text-white/40 uppercase tracking-widest">Node ID: {node.admissionId.substring(0, 8)}</div>
                                </div>
                                <div className={clsx("w-2 h-2 rounded-full", isSelected ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)]" : "bg-white/10")}></div>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-20 rounded-3xl border border-dashed border-white/5 bg-[#0b0c10]/40">
                    <p className="text-white/30 font-medium">No valid identity nodes found in your roster.</p>
                </div>
            )}

            {/* LAYER 3: DOCUMENT GRID SECTION */}
            {activeNode && (
                <div className="flex flex-col lg:flex-row gap-8 items-start">

                    {/* LEFT COLUMN: Security Summary Panel (Desktop) */}
                    <div className="w-full lg:w-80 shrink-0 space-y-6 hidden lg:block">
                        <div className="p-6 rounded-3xl bg-[#0b0c10] border border-white/5 shadow-xl">
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/30 mb-6">Security Summary</h3>

                            <div className="space-y-5">
                                <div className="flex items-center justify-between pb-4 border-b border-white/5">
                                    <div className="flex items-center gap-2">
                                        <LockIcon className="w-4 h-4 text-emerald-500" />
                                        <span className="text-xs text-white/60">Encryption Status</span>
                                    </div>
                                    <span className="text-xs font-bold text-emerald-500">Active</span>
                                </div>

                                <div className="flex items-center justify-between pb-4 border-b border-white/5">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheckIcon className={clsx("w-4 h-4", activeNodeStats.isCompleted ? "text-emerald-500" : "text-amber-500")} />
                                        <span className="text-xs text-white/60">Compliance Score</span>
                                    </div>
                                    <span className={clsx("text-xs font-bold", activeNodeStats.isCompleted ? "text-emerald-500" : "text-amber-500")}>
                                        {activeNodeStats.percent}%
                                    </span>
                                </div>

                                <div className="flex items-center justify-between pb-4 border-b border-white/5">
                                    <div className="flex items-center gap-2">
                                        <RefreshIcon className="w-4 h-4 text-white/40" />
                                        <span className="text-xs text-white/60">Pending Verification</span>
                                    </div>
                                    <span className="text-xs font-bold text-white">{activeNodeStats.pending}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangleIcon className={clsx("w-4 h-4", activeNodeStats.uploadedMandatoryCount < activeNodeStats.mandatoryTotal ? "text-red-500" : "text-white/20")} />
                                        <span className="text-xs text-white/60">Missing Required</span>
                                    </div>
                                    <span className={clsx("text-xs font-bold", activeNodeStats.uploadedMandatoryCount < activeNodeStats.mandatoryTotal ? "text-red-500" : "text-white/20")}>
                                        {Math.max(0, activeNodeStats.mandatoryTotal - activeNodeStats.uploadedMandatoryCount)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Document Grid */}
                    <div className="flex-1 w-full space-y-8">
                        {/* Mobile Security Strip (inline above categories) */}
                        <div className="block lg:hidden">
                            <div className="p-4 rounded-2xl bg-[#0b0c10] border border-white/5 flex items-center justify-between shadow-sm">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-0.5">Compliance</span>
                                    <span className={clsx("text-sm font-bold", activeNodeStats.isCompleted ? "text-emerald-500" : "text-amber-500")}>
                                        {activeNodeStats.percent}% Complete
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <span className="block text-[9px] text-white/30 uppercase tracking-wider">Missing</span>
                                        <span className={clsx("text-xs font-bold", (activeNodeStats.mandatoryTotal - activeNodeStats.uploadedMandatoryCount > 0) ? "text-red-500" : "text-white/20")}>
                                            {Math.max(0, activeNodeStats.mandatoryTotal - activeNodeStats.uploadedMandatoryCount)}
                                        </span>
                                    </div>
                                    <div className="w-px h-6 bg-white/10"></div>
                                    <div className="text-right">
                                        <span className="block text-[9px] text-white/30 uppercase tracking-wider">Pending</span>
                                        <span className="text-xs font-bold text-white">
                                            {activeNodeStats.pending}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {filteredRequirements.length === 0 ? (
                            <div className="p-16 rounded-3xl border border-dashed border-white/5 bg-[#0b0c10]/40 text-center">
                                <FileTextIcon className="w-12 h-12 text-white/10 mx-auto mb-4" />
                                <p className="text-white/40 font-medium text-sm">
                                    {activeNode.requirements.length === 0 ? "No document requirements assigned to this node." : "No documents found for this query."}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {Object.entries(requirementsByCategory).map(([category, reqs]) => (
                                    <DocumentCategoryAccordion key={category} category={category} reqs={reqs} onUpload={handleUpload} />
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            )}
        </div>
    );
};

export default DocumentsTab;
