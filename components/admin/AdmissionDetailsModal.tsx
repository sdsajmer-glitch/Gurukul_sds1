import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, formatError } from '../../services/supabase';
import { AdmissionApplication } from '../../types';
import Spinner from '../common/Spinner';
import { XIcon } from '../icons/XIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
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

    const isMounted = useRef(true);

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
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300">
            <div className="bg-[#0f1115] w-full max-w-5xl rounded-[2rem] shadow-2xl border border-white/10 flex flex-col max-h-[90vh] overflow-hidden relative ring-1 ring-white/5" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-black shadow-lg ring-4 ring-white/5">
                            {admission.applicant_name.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white uppercase tracking-tight">{admission.applicant_name}</h2>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/60 text-[10px] uppercase font-bold tracking-wider">Grade {admission.grade}</span>
                                <span className="text-white/20">•</span>
                                <span className="text-white/40 text-xs font-mono">{admission.application_number || 'PENDING'}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-xl hover:bg-white/10 text-white/30 hover:text-white transition-all hover:rotate-90 duration-300"><XIcon className="w-6 h-6" /></button>
                </div>

                <div className="flex-grow overflow-y-auto custom-scrollbar">
                    <div className="p-8 space-y-8">
                        {/* Status Banner */}
                        <AnimatePresence>
                            {finalizeState === 'success' && (
                                <motion.div
                                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    className="p-8 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex flex-col items-center gap-4 text-center shadow-2xl backdrop-blur-sm"
                                >
                                    <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center shadow-inner ring-1 ring-emerald-500/30">
                                        <CheckCircleIcon className="w-8 h-8 text-emerald-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-2xl font-black text-emerald-500 uppercase tracking-tight">Enrollment Complete</h3>
                                        <p className="text-emerald-500/70 font-medium">Student ID: <span className="font-mono font-bold text-emerald-400">{provisionedData?.student_id_number}</span></p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {finalizeState !== 'success' && (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
                                {/* Left Column: Applicant Data */}
                                <div className="lg:col-span-5 space-y-6">
                                    <h3 className="text-xs font-black uppercase text-white/40 tracking-[0.2em] flex items-center gap-2">
                                        <UserIcon className="w-4 h-4" /> Applicant Profile
                                    </h3>
                                    <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-6 space-y-6 shadow-inner hover:bg-white/[0.05] transition-colors group">
                                        <div className="flex items-start gap-4 p-2 rounded-xl hover:bg-white/5 transition-colors">
                                            <div className="mt-1 p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><UserIcon className="w-5 h-5" /></div>
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-white/30 mb-0.5">Parent Name</p>
                                                <p className="text-white font-bold text-lg">{admission.parent_name}</p>
                                            </div>
                                        </div>
                                        <div className="h-px bg-white/5 w-full"></div>
                                        <div className="flex items-start gap-4 p-2 rounded-xl hover:bg-white/5 transition-colors">
                                            <div className="mt-1 p-2 bg-purple-500/20 rounded-lg text-purple-400"><MailIcon className="w-5 h-5" /></div>
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-white/30 mb-0.5">Contact Email</p>
                                                <p className="text-white font-medium">{admission.parent_email}</p>
                                            </div>
                                        </div>
                                        <div className="h-px bg-white/5 w-full"></div>
                                        <div className="flex items-start gap-4 p-2 rounded-xl hover:bg-white/5 transition-colors">
                                            <div className="mt-1 p-2 bg-pink-500/20 rounded-lg text-pink-400"><PhoneIcon className="w-5 h-5" /></div>
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-white/30 mb-0.5">Contact Phone</p>
                                                <p className="text-white font-medium font-mono">{admission.parent_phone}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Actions / Notes Placeholder */}
                                    <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-6 flex items-center justify-center text-white/20 text-sm font-medium hover:border-white/20 hover:text-white/40 transition-all cursor-pointer">
                                        + Add Internal Note
                                    </div>
                                </div>

                                {/* Right Column: Documentation */}
                                <div className="lg:col-span-7 space-y-6 flex flex-col">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-black uppercase text-white/40 tracking-[0.2em] flex items-center gap-2">
                                            <ShieldCheckIcon className="w-4 h-4" /> Documentation
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={fetchDocs}
                                                className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                                                title="Refresh Documents"
                                            >
                                                <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                            </button>
                                            <button
                                                onClick={() => setIsRequestingDoc(!isRequestingDoc)}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                                                    ${isRequestingDoc ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/50' : 'bg-white/5 text-white/60 hover:bg-indigo-500 hover:text-white'}`}
                                            >
                                                <PlusIcon className="w-3 h-3" /> Request Doc
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-grow flex flex-col gap-3">
                                        {/* Request Form */}
                                        <AnimatePresence>
                                            {isRequestingDoc && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl flex items-center gap-3">
                                                        <FileTextIcon className="w-5 h-5 text-indigo-400 shrink-0" />
                                                        <input
                                                            type="text"
                                                            value={newDocName}
                                                            onChange={(e) => setNewDocName(e.target.value)}
                                                            placeholder="Enter document name (e.g. Birth Certificate)..."
                                                            className="bg-transparent border-none outline-none text-white text-sm w-full placeholder-white/20"
                                                            autoFocus
                                                            onKeyDown={(e) => e.key === 'Enter' && handleRequestDoc()}
                                                        />
                                                        <button
                                                            onClick={handleRequestDoc}
                                                            disabled={requestingLoading || !newDocName.trim()}
                                                            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition-colors shrink-0"
                                                        >
                                                            {requestingLoading ? <Spinner size="sm" className="text-white" /> : 'Request'}
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* Document List */}
                                        {loading && docs.length === 0 ? (
                                            <div className="p-8 flex justify-center"><Spinner /></div>
                                        ) : docs.length === 0 ? (
                                            <div className="p-12 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center text-center gap-4 bg-white/[0.01]">
                                                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-white/20">
                                                    <FileTextIcon className="w-6 h-6" />
                                                </div>
                                                <p className="text-white/30 text-sm font-medium">No documents requested yet.</p>
                                                <button
                                                    onClick={() => setIsRequestingDoc(true)}
                                                    className="text-indigo-400 text-xs font-bold uppercase tracking-wider hover:text-indigo-300 hover:underline"
                                                >
                                                    Request First Document
                                                </button>
                                            </div>
                                        ) : (
                                            docs.map(doc => (
                                                <div key={doc.id} className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/5 rounded-2xl group hover:border-white/10 hover:bg-white/[0.05] transition-all">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-3 rounded-xl ${doc.status === 'Verified' ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30' :
                                                                doc.status === 'Rejected' ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30' :
                                                                    'bg-white/10 text-white/40'
                                                            }`}>
                                                            <FileTextIcon className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-white flex items-center gap-2">
                                                                {doc.document_name}
                                                                {doc.is_mandatory && <span className="text-[8px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-full font-black uppercase tracking-wider">Required</span>}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className={`text-[10px] uppercase font-bold tracking-wider ${doc.status === 'Verified' ? 'text-emerald-400' :
                                                                        doc.status === 'Rejected' ? 'text-red-400' :
                                                                            'text-white/30'
                                                                    }`}>
                                                                    {doc.status}
                                                                </span>
                                                                {doc.status === 'Rejected' && (
                                                                    <span className="text-[10px] text-red-400/50 truncate max-w-[150px]">• {doc.rejection_reason}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {doc.admission_documents?.[0]?.storage_path ? (
                                                            <div className="flex items-center bg-black/20 rounded-lg p-1 border border-white/5">
                                                                <button
                                                                    onClick={() => StorageService.getSignedUrl(BUCKETS.DOCUMENTS, doc.admission_documents[0].storage_path).then(url => window.open(url, '_blank'))}
                                                                    className="p-2 hover:bg-white/10 rounded-md text-white/50 hover:text-white transition-all"
                                                                    title="View"
                                                                >
                                                                    <EyeIcon className="w-4 h-4" />
                                                                </button>
                                                                <div className="w-px h-4 bg-white/10 mx-1"></div>
                                                                <button
                                                                    onClick={() => handleDownload(doc)}
                                                                    disabled={downloadingId === doc.id}
                                                                    className="p-2 hover:bg-white/10 rounded-md text-white/50 hover:text-primary transition-colors disabled:opacity-50"
                                                                    title="Download"
                                                                >
                                                                    {downloadingId === doc.id ? <Spinner size="sm" className="text-primary" /> : <DownloadIcon className="w-4 h-4" />}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-white/20 italic pr-2">Waiting for upload...</span>
                                                        )}

                                                        {doc.status !== 'Verified' && doc.admission_documents?.length > 0 && (
                                                            <div className="flex items-center gap-2 ml-2">
                                                                <button onClick={() => handleVerifyDoc(doc.id)} className="p-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-lg transition-all border border-emerald-500/20" title="Verify"><CheckCircleIcon className="w-4 h-4" /></button>
                                                                <button onClick={() => handleRejectDoc(doc.id)} className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all border border-red-500/20" title="Reject"><XIcon className="w-4 h-4" /></button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-8 border-t border-white/5 bg-white/[0.02] flex justify-between items-center gap-4 shrink-0 backdrop-blur-md">
                    <p className="text-xs text-white/20 font-medium hidden md:block">
                        Secure Admission Protocol v2.4 • Authorized Personnel Only
                    </p>
                    <div className="flex gap-4 ml-auto">
                        {admission.status !== 'Enrolled' && finalizeState !== 'success' && (
                            <button
                                onClick={handleFinalize}
                                disabled={finalizeState === 'processing'}
                                className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 hover:scale-105 hover:shadow-emerald-500/20 text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl shadow-xl transition-all active:scale-95 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group ring-4 ring-emerald-500/10 border border-emerald-400/20"
                            >
                                {finalizeState === 'processing' ? <Spinner size="sm" className="text-white" /> : <><ShieldCheckIcon className="w-5 h-5 group-hover:scale-110 transition-transform" /> Finalize Enrollment</>}
                            </button>
                        )}
                        {(admission.status === 'Enrolled' || finalizeState === 'success') && (
                            <button onClick={onClose} className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl border border-white/10 transition-all hover:border-white/20">
                                Close Portal
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdmissionDetailsModal;