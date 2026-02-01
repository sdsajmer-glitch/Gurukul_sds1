
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

    const isVerified = req.status === 'Verified';
    const isRejected = req.status === 'Rejected';
    const isSubmitted = req.status === 'Submitted';

    // Check if we actually have a file record
    const docFile = req.admission_documents?.[0];
    const hasFileRecord = !!docFile;

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

    // Card Styles based on status
    const cardBaseStyle = "group relative rounded-[1.5rem] border transition-all duration-500 overflow-hidden";
    const cardStatusStyle = isVerified
        ? 'bg-[#051a10] border-emerald-500/30 shadow-[0_0_20px_-5px_rgba(16,185,129,0.15)]'
        : isRejected
            ? 'bg-[#1a0505] border-red-500/30'
            : isSubmitted
                ? 'bg-[#080b14] border-blue-500/30 shadow-[0_0_20px_-5px_rgba(59,130,246,0.15)]'
                : 'bg-[#0c0d12] border-white/5 hover:border-white/10 hover:bg-[#111318]';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${cardBaseStyle} ${cardStatusStyle}`}
        >
            {/* Status Glow Line (Left) */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${isVerified ? 'bg-emerald-500' : isRejected ? 'bg-red-500' : isSubmitted ? 'bg-blue-500' : 'bg-transparent'
                } opacity-50`}></div>

            {/* --- Header --- */}
            <div
                onClick={toggleExpand}
                className="p-5 flex items-center justify-between cursor-pointer relative z-10"
            >
                <div className="flex items-center gap-5">
                    {/* Status Icon Box */}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner transition-colors ${isVerified ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            isRejected ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                isSubmitted ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                    'bg-white/5 border-white/10 text-white/20'
                        }`}>
                        {isVerified ? <CheckCircleIcon className="w-6 h-6" /> :
                            isRejected ? <AlertTriangleIcon className="w-6 h-6" /> :
                                isSubmitted ? <CheckCircleIcon className="w-6 h-6" /> :
                                    <DocumentTextIcon className="w-6 h-6" />}
                    </div>

                    <div>
                        <h4 className={`text-base font-bold leading-tight ${isVerified ? 'text-emerald-100' : isRejected ? 'text-red-100' : 'text-white'
                            }`}>{req.document_name}</h4>

                        <div className="flex items-center gap-2 mt-1.5 h-5">
                            {req.is_mandatory && (
                                <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 tracking-wider">MANDATORY</span>
                            )}
                            {docFile ? (
                                <span className="text-[10px] font-mono text-white/40 flex items-center gap-1">
                                    <PaperClipIcon className="w-3 h-3" /> {formatFileSize(docFile.file_size || 0)}
                                </span>
                            ) : isSubmitted ? (
                                <span className="text-[10px] text-blue-400/60 font-medium italic">Synced (Metadata)</span>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Status Pill */}
                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] border shadow-[0_2px_10px_-2px_rgba(0,0,0,0.5)] backdrop-blur-sm ${isVerified ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-900/20' :
                            isRejected ? 'bg-red-500/10 border-red-500/30 text-red-100 shadow-red-900/20' :
                                isSubmitted ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-blue-900/20' :
                                    'bg-white/5 border-white/10 text-white/30'
                        }`}>
                        {uploadProgress !== null ? 'Syncing...' : req.status}
                    </div>

                    <div className={`p-2 rounded-full transition-colors ${isExpanded ? 'bg-white/10 text-white' : 'text-white/20 group-hover:text-white hover:bg-white/5'}`}>
                        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.3, ease: "backOut" }}>
                            <ChevronDownIcon className="w-4 h-4" />
                        </motion.div>
                    </div>
                </div>
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
                                    <div className="flex items-start gap-4 p-5 bg-[#0a0c10] rounded-2xl border border-white/5 relative overflow-hidden group/file">
                                        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover/file:opacity-100 transition-opacity"></div>

                                        <div className="w-12 h-12 bg-[#1c1f26] rounded-xl flex items-center justify-center border border-white/5 text-white/50 shadow-inner">
                                            {docFile.mime_type?.includes('pdf') ? <FileTextIcon className="w-6 h-6" /> : <PaperClipIcon className="w-6 h-6" />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-white font-bold truncate pr-4">{docFile.file_name}</p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="text-[10px] text-white/30 font-mono uppercase bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                                    {docFile.mime_type?.split('/')[1] || 'FILE'}
                                                </span>
                                                <span className="text-[10px] text-white/30 font-mono">
                                                    {new Date(docFile.uploaded_at || new Date()).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>

                                        {/* File Actions */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleView}
                                                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border border-white/5 transition-colors"
                                                title="Preview Artifact"
                                            >
                                                <EyeIcon className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={handleDownload}
                                                disabled={isDownloading}
                                                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border border-white/5 transition-colors"
                                                title="Download Artifact"
                                            >
                                                {isDownloading ? <Spinner size="sm" /> : <DownloadIcon className="w-4 h-4" />}
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
                } else if (Object.keys(grouped).length > 0 && expandedIds.size === 0) {
                    setExpandedIds(new Set([Object.keys(grouped)[0]]));
                }
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
                                    <div className="flex items-center gap-6">
                                        <div className="w-36 text-right">
                                            <div className="flex justify-between items-end mb-2">
                                                <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Vault Sync</span>
                                                <span className={`text-sm font-black ${percent === 100 ? 'text-emerald-500' : 'text-primary'}`}>{percent}%</span>
                                            </div>
                                            <div className="h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5"><div className={`h-full rounded-full transition-all duration-1000 ease-out ${percent === 100 ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]'}`} style={{ width: `${percent}%` }}></div></div>
                                        </div>
                                    </div>
                                    <div className={`p-4 rounded-full bg-white/5 border border-white/10 transition-all duration-500 ${isExpanded ? 'rotate-180 bg-primary/10 text-primary border-primary/20' : 'text-white/30 group-hover:text-white group-hover:bg-white/10'}`}>
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
