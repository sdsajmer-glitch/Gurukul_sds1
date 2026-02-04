
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

const CollapsibleDocumentCard: React.FC<{
    req: RequirementWithDocs;
    onUpload: (file: File, reqId: number, admId: string, onProgress: (progress: number) => void) => Promise<void>;
}> = ({ req, onUpload }) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isPreviewing, setIsPreviewing] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- 1. Status Matrix Logic ---
    const status = req.status || 'Pending';
    const isMandatory = req.is_mandatory;
    const docFile = req.admission_documents?.[0];
    const hasFileRecord = !!docFile;

    // Derived States
    const isVerified = status === 'Verified' || status === 'APPROVED';
    const isRejected = status === 'Rejected';
    const isReviewing = status === 'Reviewing';
    // Submitted is essentially "Under Review" effectively in this system if not explicit
    const isSubmitted = status === 'Submitted' || status === 'Uploaded';
    const isExpired = status === 'Expired';
    const isPending = status === 'Pending';

    // Matrix Configuration (Figma Spec Implementation)
    const getConfig = () => {
        if (isVerified) return {
            theme: 'emerald',
            bg: 'bg-emerald-500/5',
            border: 'border-accent-success',
            glow: 'shadow-glow-success',
            icon: <ShieldCheckIcon className="w-5 h-5" />,
            label: 'VERIFIED',
            text: 'text-accent-success',
            subText: '100%',
            actionButton: 'text-accent-success border-accent-success hover:bg-accent-success/10'
        };
        if (isRejected) return {
            theme: 'red',
            bg: 'bg-accent-error/5',
            border: 'border-accent-error',
            glow: 'shadow-glow-error',
            icon: <XIcon className="w-5 h-5" />,
            label: 'REJECTED',
            text: 'text-accent-error',
            subText: 'Action Required',
            actionButton: 'text-accent-error border-accent-error hover:bg-accent-error/10'
        };
        if (isSubmitted || isReviewing) return {
            theme: 'blue',
            bg: 'bg-accent-info/5',
            border: 'border-accent-info',
            glow: 'shadow-glow-info',
            icon: <CheckCircleIcon className="w-5 h-5" />,
            label: 'SUBMITTED',
            text: 'text-accent-info',
            subText: 'Pending verification',
            actionButton: 'text-accent-info border-accent-info hover:bg-accent-info/10'
        };
        if (isMandatory) return {
            theme: 'amber',
            bg: 'bg-accent-warning/5',
            border: 'border-accent-warning border-dashed',
            glow: 'shadow-glow-warning',
            icon: <AlertTriangleIcon className="w-5 h-5" />,
            label: 'REQUIRED',
            text: 'text-accent-warning',
            subText: 'Mandatory for enrollment',
            actionButton: 'bg-accent-premium text-white hover:bg-accent-premium/90 border-transparent shadow-lg'
        };
        // Optional
        return {
            theme: 'gray',
            bg: 'bg-white/[0.02]',
            border: 'border-white/10',
            glow: '',
            icon: <DocumentTextIcon className="w-5 h-5" />,
            label: 'OPTIONAL',
            text: 'text-white/40',
            subText: 'Not mandatory',
            actionButton: 'bg-accent-premium text-white hover:bg-accent-premium/90 border-transparent shadow-lg'
        };
    };

    const config = getConfig();

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
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files);
        }
    };

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!docFile?.storage_path) return;
        setIsDownloading(true);
        try {
            const { data, error } = await supabase.storage.from(BUCKETS.DOCUMENTS).download(docFile.storage_path);
            if (error) throw error;
            const url = window.URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = docFile.file_name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert("Download failed. Please try again.");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleView = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!docFile?.storage_path) return;
        try {
            const url = await StorageService.getSignedUrl(BUCKETS.DOCUMENTS, docFile.storage_path);
            window.open(url, '_blank');
        } catch (err) {
            alert("Unable to open file preview.");
        }
    };

    // --- Artifact Card UI ---
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`group relative flex flex-col p-6 rounded-[20px] border-2 transition-all duration-300 overflow-hidden ${config.bg} ${config.border} ${config.glow} hover:-translate-y-1 hover:shadow-2xl`}
            style={{ minHeight: '360px' }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
            onDrop={handleDrop}
        >
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div className={`p-3 rounded-xl border border-white/5 bg-white/5 ${config.text}`}>
                    {config.icon}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border bg-black/20 ${config.text} ${config.border.replace('border-dashed', 'border-solid')}`}>
                    {config.label}
                </span>
            </div>

            {/* Content */}
            <div className="flex-grow flex flex-col">
                <h4 className="text-lg font-bold text-white mb-2 leading-tight">{req.document_name}</h4>
                <p className={`text-xs font-medium font-mono mb-8 ${config.text} opacity-80`}>{config.subText}</p>

                {hasFileRecord ? (
                    <div className="mt-auto space-y-3">
                        <div className="p-4 rounded-xl bg-[#0a0c10] border border-white/10 flex items-center gap-4 group/file hover:border-white/20 transition-colors">
                            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-white/40">
                                {docFile.mime_type?.includes('pdf') ? <FileTextIcon className="w-5 h-5" /> : <PaperClipIcon className="w-5 h-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-white truncate">{docFile.file_name}</p>
                                <p className="text-[10px] text-white/30 font-mono mt-0.5">{formatFileSize(docFile.file_size || 0)} • {new Date(docFile.uploaded_at || new Date()).toLocaleDateString()}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={handleView}
                                className="h-10 flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-[10px] font-black uppercase tracking-widest text-white transition-all"
                            >
                                <EyeIcon className="w-3 h-3" /> Preview
                            </button>
                            <button
                                onClick={handleDownload}
                                disabled={isDownloading}
                                className="h-10 flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-[10px] font-black uppercase tracking-widest text-white transition-all"
                            >
                                {isDownloading ? <Spinner size="sm" /> : <DownloadIcon className="w-3 h-3" />} Download
                            </button>
                        </div>

                        {!isVerified && (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-3 text-[10px] font-normal text-white/30 hover:text-white border-t border-dashed border-white/10 hover:border-white/30 transition-all flex items-center justify-center gap-2 mt-2"
                            >
                                <UploadIcon className="w-3 h-3" /> Upload Replacement Artifact
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="mt-auto">
                        <div className={`mt-4 mb-6 h-32 rounded-xl border-2 border-dashed ${isDragOver ? 'border-accent-premium bg-accent-premium/10' : 'border-white/5 bg-white/[0.02]'} flex flex-col items-center justify-center gap-2 transition-all`}>
                            {uploadProgress !== null ? (
                                <div className="w-full px-6 text-center">
                                    <p className="text-[10px] font-black text-accent-premium uppercase mb-2">Syncing {uploadProgress.toFixed(0)}%</p>
                                    <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-accent-premium" style={{ width: `${uploadProgress}%` }}></div></div>
                                </div>
                            ) : (
                                <>
                                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/20"><UploadIcon className="w-4 h-4" /></div>
                                    <span className="text-[10px] font-medium text-white/20">Drag & Drop</span>
                                </>
                            )}
                        </div>

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadProgress !== null}
                            className={`w-full h-12 flex items-center justify-center gap-2 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all border ${config.actionButton} ${uploadProgress ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <UploadIcon className="w-4 h-4" /> Upload
                        </button>
                    </div>
                )}

                {/* Error Toast */}
                {error && <div className="absolute inset-x-4 bottom-4 p-3 bg-red-500/90 text-white text-[10px] font-bold rounded-lg text-center backdrop-blur-md animate-in slide-in-from-bottom-2">{error}</div>}

                <input ref={fileInputRef} type="file" className="hidden" onChange={e => handleFileSelect(e.target.files)} />
            </div>

            {/* Hover Effect Layer */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500"></div>
        </motion.div>
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
    }, [profile.id, focusOnAdmissionId, onClearFocus, expandedIds.size]);

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
        <div className="max-w-7xl mx-auto space-y-12 pb-32 animate-in fade-in duration-700">
            {/* Module Header */}
            <div className="relative p-10 md:p-16 rounded-[3rem] bg-[#0c0e12] border border-white/5 overflow-hidden shadow-2xl ring-1 ring-white/5">
                <div className="absolute -right-40 -top-40 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none opacity-40"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]"><ShieldCheckIcon className="w-6 h-6" /></div>
                        <span className="text-[11px] font-black uppercase text-emerald-500 tracking-[0.4em] drop-shadow-sm">Integrity Center</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-serif font-black text-white tracking-tighter uppercase leading-none">Artifact <span className="text-white/20 italic">Vault.</span></h2>
                    <p className="text-white/40 text-lg font-serif italic border-l border-white/10 pl-8 max-w-lg leading-relaxed mt-6">
                        Finalize institutional identity synchronization by providing verified artifacts for enrollment nodes.
                    </p>
                </div>
            </div>

            {/* Students List */}
            <div className="space-y-8 px-2">
                {Object.keys(groupedData).map(admId => {
                    const node = groupedData[admId];
                    const isExpanded = expandedIds.has(admId);
                    const verifiedCount = node.requirements.filter(r => ['Verified', 'Submitted', 'Uploaded', 'Reviewing'].includes(r.status || '')).length;
                    const total = node.requirements.length;
                    const percent = total > 0 ? Math.round((verifiedCount / total) * 100) : 0;

                    return (
                        <motion.div layout key={admId} className={`group bg-[#0f1116] border transition-all duration-700 rounded-[3rem] overflow-hidden shadow-xl ${isExpanded ? 'border-primary/20 ring-1 ring-primary/5 shadow-2xl shadow-primary/5' : 'border-white/5 hover:border-white/10'}`}>
                            {/* Student Header */}
                            <header className="p-8 flex flex-col md:flex-row items-center justify-between cursor-pointer gap-6 relative" onClick={() => toggleExpand(admId)}>
                                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>

                                <div className="flex items-center gap-6 w-full md:w-auto relative z-10">
                                    <PremiumAvatar src={node.profilePhotoUrl} name={node.applicantName} size="sm" className="shadow-2xl border border-white/10 w-16 h-16 rounded-2xl" />
                                    <div>
                                        <h3 className="text-2xl font-bold text-white group-hover:text-primary transition-colors tracking-tight">{node.applicantName}</h3>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Grade {node.grade}</span>
                                            {total === 0 && <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-white/20 font-bold uppercase tracking-wider">Empty Node</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end relative z-10">
                                    <div className="flex items-center gap-8">
                                        <div className="w-48 text-right hidden md:block">
                                            <div className="flex justify-between items-end mb-2">
                                                <div className="flex flex-col items-start">
                                                    <span className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-0.5">Vault Status</span>
                                                    <span className={`text-[10px] font-bold uppercase tracking-wide ${percent === 100 ? 'text-[#22C55E]' : 'text-white/60'}`}>
                                                        {percent === 100 ? 'Fully Synchronized' : percent > 75 ? 'Almost Complete' : percent > 0 ? 'Syncing in Progress' : 'Pending Initialization'}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className={`text-xl font-black ${percent === 100 ? 'text-[#22C55E]' : 'text-white'}`}>{percent}%</span>
                                                </div>
                                            </div>
                                            <div className="h-2 bg-[#121622] rounded-full overflow-hidden border border-white/5 relative">
                                                <div className="absolute inset-0 bg-white/[0.02]"></div>
                                                <motion.div
                                                    className={`h-full rounded-full relative overflow-hidden ${percent === 100 ? 'bg-[#22C55E]' : 'bg-[#8B5CF6]'}`}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${percent}%` }}
                                                    transition={{ duration: 1, ease: "circOut" }}
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-full -translate-x-full animate-[shimmer_2s_infinite]"></div>
                                                </motion.div>
                                            </div>
                                            <p className="text-[9px] font-mono text-white/30 mt-2 text-right">
                                                {verifiedCount} of {total} documents submitted
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`p-4 rounded-full bg-white/5 border border-white/10 transition-all duration-500 shadow-xl ${isExpanded ? 'rotate-180 bg-primary/10 text-primary border-primary/20 shadow-primary/10' : 'text-white/30 group-hover:text-white group-hover:bg-white/10'}`}>
                                        <ChevronDownIcon className="w-5 h-5" />
                                    </div>
                                </div>
                            </header>

                            {/* Collapsible Content */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.section
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                                        className="overflow-hidden bg-[#0a0c10]/50 shadow-inner"
                                    >
                                        <div className="p-8 md:p-10 border-t border-white/[0.04]">
                                            {node.requirements.length === 0 ? (
                                                <div className="text-center py-12 md:py-16 text-white/20 border-2 border-dashed border-white/5 rounded-[2rem] flex flex-col items-center bg-[#0c0d12]/50 relative overflow-hidden">
                                                    <div className="absolute inset-0 bg-grid-white/[0.02] [mask-image:linear-gradient(0deg,white,transparent)]"></div>
                                                    <div className="relative z-10 mb-8">
                                                        <div className="w-20 h-20 bg-gradient-to-tr from-white/10 to-transparent rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-2xl ring-1 ring-white/10 group-hover:scale-105 transition-transform duration-500">
                                                            <DocumentTextIcon className="w-10 h-10 opacity-60 text-primary drop-shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
                                                        </div>
                                                        <h4 className="font-serif font-black text-2xl text-white/60 tracking-tight">Initialize Vault</h4>
                                                        <p className="text-sm font-medium text-white/30 max-w-sm mx-auto mt-3 leading-relaxed">Select a standard artifact type to begin the institutional synchronization process.</p>
                                                    </div>

                                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-3xl px-4 relative z-10">
                                                        {['Birth Certificate', 'Transfer Certificate', 'Report Card', 'Identity Proof', 'Medical Record', 'Other Artifact'].map((type) => (
                                                            <button
                                                                key={type}
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    let name = type;
                                                                    if (type === 'Other Artifact') {
                                                                        const customName = window.prompt("Enter the designation for this artifact:");
                                                                        if (!customName) return;
                                                                        name = customName;
                                                                    }

                                                                    try {
                                                                        const { error } = await supabase.from('document_requirements').insert({
                                                                            admission_id: admId,
                                                                            document_name: name,
                                                                            is_mandatory: false,
                                                                            status: 'Pending'
                                                                        });
                                                                        if (error) throw error;
                                                                        await fetchData(true);
                                                                    } catch (err: any) {
                                                                        alert("Protocol Interrupted: " + err.message);
                                                                    }
                                                                }}
                                                                className="group/btn relative flex flex-col items-center justify-center p-6 rounded-2xl bg-[#13151a] border border-white/5 hover:border-primary/40 hover:bg-[#1a1c24] transition-all duration-300 overflow-hidden shadow-lg hover:shadow-primary/10"
                                                            >
                                                                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500"></div>
                                                                <PlusIcon className="w-6 h-6 text-white/20 group-hover/btn:text-primary mb-3 transition-colors duration-300 group-hover/btn:scale-110" />
                                                                <span className="text-[11px] font-black text-white/40 group-hover/btn:text-white uppercase tracking-widest relative z-10">{type}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-6">
                                                    {/* Add New Button (Top Right of Grid) */}
                                                    <div className="flex justify-end">
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                const name = prompt("Enter artifact name:");
                                                                if (!name) return;
                                                                try {
                                                                    const { error } = await supabase.from('document_requirements').insert({
                                                                        admission_id: admId,
                                                                        document_name: name,
                                                                        is_mandatory: false,
                                                                        status: 'Pending'
                                                                    });
                                                                    if (error) throw error;
                                                                    await fetchData(true);
                                                                } catch (err: any) {
                                                                    alert("Failed to add slot: " + err.message);
                                                                }
                                                            }}
                                                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 hover:border-white/20 transition-all text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-primary"
                                                        >
                                                            <PlusIcon className="w-3 h-3" /> Add Artifact
                                                        </button>
                                                    </div>

                                                    <motion.div
                                                        initial="hidden"
                                                        animate="visible"
                                                        variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
                                                        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
                                                    >
                                                        {node.requirements.map(req => (
                                                            <CollapsibleDocumentCard key={req.id} req={req} onUpload={handleUpload} />
                                                        ))}
                                                    </motion.div>
                                                </div>
                                            )}
                                        </div>
                                    </motion.section>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </div>

            {Object.keys(groupedData).length === 0 && !loading && (
                <div className="relative py-40 rounded-[3rem] overflow-hidden flex flex-col items-center justify-center group transition-all duration-700">

                    {/* Ambient Background */}
                    <div className="absolute inset-0 bg-[#0c0e12] border border-white/5 rounded-[3rem]"></div>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/[0.03] via-transparent to-transparent opacity-50"></div>

                    {/* Animated Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full pointer-events-none animate-pulse-slow"></div>

                    {/* Dashed Border Overlay */}
                    <div className="absolute inset-4 border-2 border-dashed border-white/5 rounded-[2.5rem] pointer-events-none"></div>

                    {/* Content */}
                    <div className="relative z-10 flex flex-col items-center max-w-xl mx-auto px-6 text-center">

                        {/* Icon Container */}
                        <div className="relative mb-10 group-hover:-translate-y-2 transition-transform duration-500 ease-out">
                            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                            <div className="w-24 h-24 bg-gradient-to-br from-[#1a1d26] to-[#0c0e12] rounded-3xl flex items-center justify-center border border-white/5 shadow-2xl relative z-10 ring-1 ring-white/5 group-hover:border-primary/30 grayscale group-hover:grayscale-0 transition-all duration-500">
                                <ShieldCheckIcon className="w-10 h-10 text-white/30 group-hover:text-primary transition-colors duration-500" />
                            </div>
                        </div>

                        <h3 className="text-3xl md:text-4xl font-serif font-bold text-white mb-6 tracking-tight">
                            Identity Artifacts Missing
                        </h3>

                        <p className="text-white/40 text-sm md:text-base leading-relaxed mb-10 max-w-md mx-auto">
                            The artifact vault is currently dormant because no active institutional profiles are linked.
                            <span className="block mt-4 text-white/20 font-medium italic">Initialize the protocol by registering a student identity below.</span>
                        </p>

                        <button
                            onClick={() => setActiveComponent?.('My Children')}
                            className="relative px-10 py-5 bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-[0_20px_50px_-15px_rgba(var(--primary),0.3)] transition-all duration-300 group/btn overflow-hidden transform hover:-translate-y-1 hover:shadow-[0_30px_60px_-15px_rgba(var(--primary),0.4)] ring-1 ring-white/10"
                        >
                            <span className="relative z-10 flex items-center gap-3">
                                <PlusIcon className="w-4 h-4 group-hover/btn:rotate-90 transition-transform duration-500" />
                                Register Student Identity
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-full -translate-x-full group-hover/btn:animate-[shimmer_1s_infinite]"></div>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentsTab;
