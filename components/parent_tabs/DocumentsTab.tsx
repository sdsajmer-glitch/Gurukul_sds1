
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
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- 1. Status Matrix Logic ---
    const status = req.status || 'Pending';
    const isMandatory = req.is_mandatory;
    const docFile = req.admission_documents?.[0];
    const hasFileRecord = !!docFile;

    // Derived States
    const isVerified = status === 'Verified';
    const isRejected = status === 'Rejected';
    const isReviewing = status === 'Reviewing';
    // Submitted is essentially "Under Review" effectively in this system if not explicit
    const isSubmitted = status === 'Submitted' || status === 'Uploaded';
    const isExpired = status === 'Expired';
    const isPending = status === 'Pending';

    // Matrix Configuration (Figma Spec Implementation)
    const getConfig = () => {
        if (isVerified) return { // Approved
            theme: 'emerald',
            bg: 'bg-[#0E1F16]',
            border: 'border-[#22C55E]',
            glow: 'shadow-[0_0_20px_-5px_rgba(34,197,94,0.15)]',
            icon: <ShieldCheckIcon className="w-6 h-6" />,
            label: 'VERIFIED',
            text: 'text-[#22C55E]',
            subText: 'Verified and secured.',
            barColor: 'bg-[#22C55E]'
        };
        if (isRejected) return { // Rejected
            theme: 'red',
            bg: 'bg-[#241212]',
            border: 'border-[#EF4444]',
            glow: 'shadow-[0_0_20px_-5px_rgba(239,68,68,0.15)]',
            icon: <XIcon className="w-6 h-6" />,
            label: 'REJECTED',
            text: 'text-[#EF4444]',
            subText: 'Action Required: Re-upload',
            barColor: 'bg-[#EF4444]'
        };
        if (isExpired) return { // Expired
            theme: 'orange',
            bg: 'bg-[#261A0D]',
            border: 'border-[#F97316]',
            glow: 'shadow-[0_0_20px_-5px_rgba(249,115,22,0.15)]',
            icon: <AlertTriangleIcon className="w-6 h-6" />,
            label: 'EXPIRED',
            text: 'text-[#F97316]',
            subText: 'Document has expired',
            barColor: 'bg-[#F97316]'
        };
        if (isReviewing || isSubmitted) return { // Reviewing or Submitted
            theme: 'blue',
            bg: 'bg-[#121B2E]',
            border: 'border-[#3B82F6]',
            glow: 'shadow-[0_0_20px_-5px_rgba(59,130,246,0.15)]',
            icon: <CheckCircleIcon className="w-6 h-6" />,
            label: 'SUBMITTED',
            text: 'text-[#3B82F6]',
            subText: 'Typically verified in 24 hrs',
            barColor: 'bg-[#3B82F6]'
        };
        if (isPending && isMandatory) return { // Required
            theme: 'amber',
            bg: 'bg-[#1E1A0E]',
            border: 'border-[#FBBF24] border-dashed',
            glow: 'shadow-[0_0_20px_-5px_rgba(251,191,36,0.15)]',
            icon: <AlertTriangleIcon className="w-6 h-6" />,
            label: 'REQUIRED',
            text: 'text-[#FBBF24]',
            subText: 'Mandatory for enrollment',
            barColor: 'bg-[#FBBF24]'
        };
        // Optional / Default
        return {
            theme: 'gray',
            bg: 'bg-[#1A1A1A]',
            border: 'border-[#6B7280]',
            glow: '',
            icon: <DocumentTextIcon className="w-6 h-6" />,
            label: 'OPTIONAL',
            text: 'text-[#6B7280]',
            subText: 'Not mandatory',
            barColor: 'bg-[#6B7280]'
        };
    };

    const config = getConfig();

    const toggleExpand = () => setIsExpanded(!isExpanded);

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

    // Card Styles based on status (Handled by config now)

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`group relative flex flex-col gap-3 p-5 rounded-[20px] border transition-all duration-300 overflow-hidden ${config.bg} ${config.border} ${config.glow}`}
            style={{ minHeight: '130px' }}
        >
            {/* Header: Icon + Badge */}
            <div className="flex items-start justify-between w-full relative z-10">
                <div className={`w-8 h-8 flex items-center justify-center rounded-lg border border-white/5 ${config.text} bg-white/5`}>
                    {config.icon}
                </div>

                {/* Status Pill Badge */}
                <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border shadow-sm ${config.text} ${config.bg} border-white/5`}>
                    {config.label}
                </div>
            </div>

            {/* Title & Meta */}
            <div className="relative z-10">
                <h4 className="text-sm font-bold text-white leading-tight mb-1">{req.document_name}</h4>
                <p className={`text-xs ${config.text} opacity-80 leading-relaxed`}>{config.subText}</p>
                {docFile && (
                    <div className="flex items-center gap-2 mt-2">
                        <span className="w-1 h-1 rounded-full bg-white/20"></span>
                        <p className="text-[10px] text-white/30 font-mono uppercase">{docFile.mime_type?.split('/')[1] || 'FILE'}</p>
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="h-px bg-white/5 w-full my-1"></div>

            {/* Actions */}
            <div className="mt-auto relative z-10">
                {!isExpanded ? (
                    <div className="flex items-center gap-2">
                        {/* Primary Open/Upload Button */}
                        <button
                            onClick={toggleExpand}
                            className={`flex-1 h-10 flex items-center justify-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-lg group/btn ${hasFileRecord
                                ? 'bg-white/[0.03] text-white hover:bg-white/[0.08] border-white/10'
                                : 'bg-primary text-white hover:bg-primary/90 border-primary/50'
                                }`}
                        >
                            {hasFileRecord ? (
                                <>
                                    <EyeIcon className="w-3.5 h-3.5 opacity-60 group-hover/btn:opacity-100" />
                                    <span>View</span>
                                </>
                            ) : (
                                <>
                                    <UploadIcon className="w-3.5 h-3.5" />
                                    <span>Upload</span>
                                </>
                            )}
                        </button>

                        {/* Action Buttons for Files */}
                        {hasFileRecord && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-white/40 hover:text-white transition-all"
                                    title="Edit / Replace"
                                >
                                    <UploadIcon className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleDownload}
                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-white/40 hover:text-white transition-all"
                                    title="Download"
                                >
                                    <DownloadIcon className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <button onClick={toggleExpand} className="w-full py-3 text-[10px] text-red-400/60 hover:text-red-400 font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 bg-red-500/[0.05] rounded-xl hover:bg-red-500/10"><XIcon className="w-3 h-3" /> Close View</button>
                )}
            </div>

            {/* --- Expanded Content --- */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
                        className="relative"
                    >
                        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                        <div className="p-6 pt-6 bg-black/20 backdrop-blur-sm">

                            {/* Rejection Notice */}
                            {isRejected && (
                                <div className="mb-6 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl flex gap-3 backdrop-blur-md">
                                    <div className="mt-0.5 min-w-[20px]"><AlertTriangleIcon className="w-5 h-5 text-red-500" /></div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-red-500 tracking-wider mb-1">Issue Detected</p>
                                        <p className="text-sm text-red-200/80 leading-relaxed font-medium">{req.rejection_reason || 'The provided artifact does not meet the necessary criteria for verification. Please review and re-upload.'}</p>
                                    </div>
                                </div>
                            )}

                            {/* Main Content Area */}
                            {hasFileRecord && !isRejected ? (
                                <div className="space-y-6">
                                    {/* File Card */}
                                    <div className="relative group/file overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e12] transition-colors hover:border-white/20">

                                        {/* File Info Header */}
                                        <div className="flex items-start gap-5 p-6 pb-0">

                                            <div className="w-16 h-16 rounded-2xl bg-[#151820] flex items-center justify-center border border-white/5 text-white/40 shadow-inner group-hover/file:text-white group-hover/file:scale-105 transition-all duration-300">
                                                {docFile.mime_type?.includes('pdf') ? <FileTextIcon className="w-8 h-8" /> : <PaperClipIcon className="w-8 h-8" />}
                                            </div>

                                            <div className="flex-1 min-w-0 pt-1">
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="text-lg font-bold text-white truncate pr-4" title={docFile.file_name}>{docFile.file_name}</p>
                                                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${isVerified ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                                        'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                                        }`}>
                                                        {isVerified ? 'Verified' : 'Pending Review'}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-3 text-xs text-white/40 font-mono">
                                                    <span className="uppercase bg-white/5 px-2 py-0.5 rounded text-[10px]">{docFile.mime_type?.split('/')[1] || 'FILE'}</span>
                                                    <span>•</span>
                                                    <span>{formatFileSize(docFile.file_size || 0)}</span>
                                                    <span>•</span>
                                                    <span>{new Date(docFile.uploaded_at || new Date()).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Bar */}
                                        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5">
                                            <button
                                                onClick={handleView}
                                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider border border-white/5 hover:border-white/20 transition-all group/btn"
                                            >
                                                <EyeIcon className="w-4 h-4 text-white/40 group-hover/btn:text-white transition-colors" />
                                                Preview
                                            </button>

                                            <button
                                                onClick={handleDownload}
                                                disabled={isDownloading}
                                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary hover:text-white font-bold text-xs uppercase tracking-wider border border-primary/20 hover:border-primary/50 transition-all group/btn"
                                            >
                                                {isDownloading ? <Spinner size="sm" /> : <DownloadIcon className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />}
                                                Download
                                            </button>
                                        </div>
                                    </div>

                                    {/* Replace Button (Only if not verified) */}
                                    {!isVerified && (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/10 text-xs font-bold text-white/30 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all group/replace"
                                        >
                                            <UploadIcon className="w-4 h-4 text-white/20 group-hover/replace:text-white transition-colors" />
                                            Upload Replacement Artifact
                                        </button>
                                    )}
                                </div>
                            ) : (
                                /* Upload Area */
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                                    onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
                                    onDrop={handleDrop}
                                    className={`
                                        relative min-h-[160px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-500 overflow-hidden
                                        ${isDragOver
                                            ? 'border-primary bg-primary/10 shadow-[0_0_30px_rgba(var(--primary),0.2)]'
                                            : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
                                        }
                                    `}
                                >
                                    {/* Background Grid Pattern */}
                                    <div className="absolute inset-0 bg-grid-white/[0.02] [mask-image:linear-gradient(0deg,transparent,black)] pointer-events-none"></div>

                                    <div className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${isDragOver ? 'bg-primary/20 text-primary scale-110' : 'bg-[#1c1f26] text-white/40 shadow-xl border border-white/5'
                                        }`}>
                                        <UploadIcon className="w-6 h-6" />
                                    </div>
                                    <div className="relative z-10 text-center px-4">
                                        <p className={`text-xs font-bold uppercase tracking-widest transition-colors ${isDragOver ? 'text-primary' : 'text-white/60'}`}>
                                            {isDragOver ? 'Release to Upload' : 'Initiate Upload Protocol'}
                                        </p>
                                        <p className="text-[10px] text-white/20 font-medium mt-2 leading-relaxed max-w-[200px] mx-auto">
                                            Click or Drag verified artifact here.<br />PDF, JPG, PNG (Max 10MB)
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Progress Bar */}
                            {uploadProgress !== null && (
                                <div className="mt-5">
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-primary mb-2">
                                        <span>Encrypting & Syncing</span>
                                        <span>{uploadProgress.toFixed(0)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-[#0a0c10] rounded-full overflow-hidden border border-white/5">
                                        <motion.div
                                            className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${uploadProgress}%` }}
                                            transition={{ duration: 0.2 }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Error Message */}
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                                    className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center gap-2 text-red-300"
                                >
                                    <AlertTriangleIcon className="w-4 h-4" />
                                    <p className="text-[10px] font-bold uppercase tracking-wide">{error}</p>
                                </motion.div>
                            )}

                            <input ref={fileInputRef} type="file" className="hidden" onChange={e => handleFileSelect(e.target.files)} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
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
                    const verifiedCount = node.requirements.filter(r => r.status === 'Verified').length;
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
                                            <div className="h-1.5 bg-[#121622] rounded-full overflow-hidden border border-white/5 relative">
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
                                                {verifiedCount} of {total} required documents completed
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
                <div className="py-32 text-center border-2 border-dashed border-white/10 rounded-[4rem] shadow-2xl flex flex-col items-center bg-[#0c0d12]">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 shadow-inner"><DocumentTextIcon className="w-10 h-10 text-white/20" /></div>
                    <h3 className="text-xl font-bold text-white/60">No Active Enrollments</h3>
                    <p className="text-white/20 max-sm mx-auto mt-2 text-sm leading-relaxed">No active institutional identities linked to this profile. Register a child to activate the document vault.</p>
                    <button
                        onClick={() => setActiveComponent?.('My Children')}
                        className="mt-8 px-10 py-4 bg-primary text-white font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-3 group transform hover:-translate-y-1 active:scale-95"
                    >
                        <PlusIcon className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
                        Register a Child
                    </button>
                </div>
            )}
        </div>
    );
};

export default DocumentsTab;
