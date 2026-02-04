
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

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Logic
    const status = req.status || 'Pending';
    const isMandatory = req.is_mandatory;
    const docFile = req.admission_documents?.[0];
    const hasFileRecord = !!docFile;

    const isVerified = status === 'Verified' || status === 'APPROVED';
    const isRejected = status === 'Rejected';
    const isSubmitted = status === 'Submitted' || status === 'Uploaded' || status === 'Reviewing';

    // Mapping to Badge Status
    const getBadgeStatus = () => {
        if (isVerified) return 'verified';
        if (isRejected) return 'error';
        if (isSubmitted) return 'pending'; // or 'info'
        if (isMandatory) return 'pending'; // 'warning' visual is handled by badge color logic usually, but let's stick to standard types
        return 'default';
    };

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

    // Variant Determination
    let variant: 'default' | 'verified' | 'premium' | 'disabled' = 'default';
    if (isVerified) variant = 'verified';
    if (isMandatory && !isSubmitted && !isVerified) variant = 'premium'; // Use premium style for "Start Here" attention
    if (isRejected) variant = 'disabled'; // Or error style if supported, but let's use default with error badge

    return (
        <Card variant={variant} className={`h-full relative overflow-hidden transition-all duration-300 ${isDragOver ? 'ring-2 ring-primary bg-primary/10' : ''}`}>

            {/* Header */}
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className={`p-2.5 rounded-xl border ${isVerified ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-white/5 border-white/5 text-white/50'}`}>
                    {isVerified ? <ShieldCheckIcon className="w-5 h-5" /> : isRejected ? <XIcon className="w-5 h-5 text-red-500" /> : <DocumentTextIcon className="w-5 h-5" />}
                </div>
                <Badge status={getBadgeStatus()} text={status} />
            </div>

            {/* Title */}
            <div className="relative z-10 mb-6">
                <h4 className="text-base font-bold text-text-primary leading-tight mb-1">{req.document_name}</h4>
                <p className="text-xs text-text-tertiary font-mono">{isMandatory ? 'Required Artifact' : 'Optional Support Doc'}</p>
            </div>

            {/* Content Area */}
            <div
                className="flex-grow flex flex-col justify-end relative z-10"
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
                onDrop={handleDrop}
            >
                {hasFileRecord ? (
                    <div className="space-y-3">
                        {/* File Info */}
                        <div className="p-3 rounded-lg bg-bg-secondary border border-border-subtle flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-bg-card flex items-center justify-center text-text-tertiary">
                                {docFile.mime_type?.includes('pdf') ? <FileTextIcon className="w-4 h-4" /> : <PaperClipIcon className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-text-primary truncate">{docFile.file_name}</p>
                                <p className="text-[10px] text-text-disabled">{formatFileSize(docFile.file_size || 0)}</p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="secondary" size="sm" onClick={handleView} title="Preview">
                                <EyeIcon className="w-3.5 h-3.5" /> Prev
                            </Button>
                            <Button variant="secondary" size="sm" onClick={handleDownload} disabled={isDownloading} title="Download">
                                <DownloadIcon className="w-3.5 h-3.5" /> Save
                            </Button>
                        </div>

                        {!isVerified && (
                            <div className="pt-2 border-t border-border-subtle">
                                <button className="w-full text-[10px] text-text-tertiary hover:text-primary transition-colors flex items-center justify-center gap-1.5" onClick={() => fileInputRef.current?.click()}>
                                    <UploadIcon className="w-3 h-3" /> Upload Replacement
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    // Upload State
                    <div className="space-y-4">
                        {uploadProgress !== null ? (
                            <div className="bg-bg-secondary p-4 rounded-xl border border-border-subtle text-center">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">Syncing {uploadProgress.toFixed(0)}%</p>
                                <div className="h-1 w-full bg-bg-primary rounded-full overflow-hidden">
                                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                </div>
                            </div>
                        ) : (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="group/upload cursor-pointer rounded-xl border border-dashed border-border-subtle hover:border-primary/50 hover:bg-primary/5 p-4 flex flex-col items-center justify-center gap-2 transition-all"
                            >
                                <UploadIcon className="w-6 h-6 text-text-disabled group-hover/upload:text-primary transition-colors" />
                                <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wide">Click to Upload</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Error Overlay */}
            <AnimatePresence>
                {error && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-x-2 bottom-2 bg-red-500/90 text-white p-2 text-[10px] font-bold text-center rounded-lg backdrop-blur-sm z-50">
                        {error}
                        <button onClick={() => setError(null)} className="absolute top-1 right-1 opacity-50 hover:opacity-100"><XIcon className="w-3 h-3" /></button>
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
        <div className="max-w-7xl mx-auto space-y-8 pb-32 animate-in fade-in duration-700">
            {/* Header */}
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-white tracking-tight">Artifact Vault</h2>
                <p className="text-text-secondary mt-2">Securely manage and synchronize your institutional documents.</p>
            </div>

            {/* Students List */}
            <div className="space-y-6">
                {Object.keys(groupedData).map(admId => {
                    const node = groupedData[admId];
                    const isExpanded = expandedIds.has(admId);
                    const verifiedCount = node.requirements.filter(r => ['Verified', 'Submitted', 'Uploaded', 'Reviewing'].includes(r.status || '')).length;
                    const total = node.requirements.length;
                    const percent = total > 0 ? Math.round((verifiedCount / total) * 100) : 0;

                    return (
                        <div key={admId} className="group overflow-hidden rounded-3xl transition-all duration-500 border border-white/5 bg-[#0f1116] shadow-xl hover:shadow-2xl hover:border-white/10">
                            {/* Student Header */}
                            <div
                                onClick={() => toggleExpand(admId)}
                                className={`
                                    relative p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 cursor-pointer transition-colors duration-500
                                    ${isExpanded ? 'bg-bg-primary' : 'bg-[#0f1116] hover:bg-white/[0.02]'}
                                `}
                            >
                                <div className="flex items-center gap-6 w-full md:w-auto z-10">
                                    <PremiumAvatar src={node.profilePhotoUrl} name={node.applicantName} size="sm" className="w-14 h-14 rounded-2xl shadow-lg" />
                                    <div>
                                        <h3 className="text-xl font-bold text-white tracking-tight">{node.applicantName}</h3>
                                        <p className="text-xs text-text-tertiary mb-1 font-mono uppercase tracking-wider">Grade {node.grade}</p>
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 w-24 bg-bg-card rounded-full overflow-hidden border border-white/5">
                                                <div className={`h-full rounded-full ${percent === 100 ? 'bg-accent-success' : 'bg-accent-primary'}`} style={{ width: `${percent}%` }}></div>
                                            </div>
                                            <span className="text-[10px] font-bold text-text-secondary">{percent}%</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 z-10">
                                    <div className="text-right hidden md:block">
                                        <span className="text-[10px] text-text-tertiary block">Status</span>
                                        <span className={`text-xs font-bold ${percent === 100 ? 'text-accent-success' : 'text-text-primary'}`}>{percent === 100 ? 'Synchronized' : 'In Progress'}</span>
                                    </div>
                                    <Button variant="ghost" size="sm" className={`rounded-full w-10 h-10 p-0 flex items-center justify-center transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-white/5' : ''}`}>
                                        <ChevronDownIcon className="w-5 h-5 text-text-secondary" />
                                    </Button>
                                </div>
                            </div>

                            {/* Collapsible Content */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                                    >
                                        <div className="border-t border-white/5 bg-black/20 p-6 md:p-8">
                                            {node.requirements.length === 0 ? (
                                                <div className="text-center py-10">
                                                    <p className="text-text-disabled text-sm">No artifacts required for this enrollment.</p>
                                                    <Button variant="primary" className="mt-4" onClick={(e) => { e.stopPropagation(); /* Add logic */ }}>Initialize Requirements</Button>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <div className="text-center py-20">
                    <p className="text-text-disabled">No student profiles found.</p>
                </div>
            )}
        </div>
    );
};

export default DocumentsTab;

