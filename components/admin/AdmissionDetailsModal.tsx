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
        <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl flex items-center justify-center z-[200] p-4 animate-in fade-in duration-500">
            <div className="bg-[#0a0c10] w-full max-w-5xl rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col max-h-[90vh] overflow-hidden relative ring-1 ring-white/5" onClick={e => e.stopPropagation()}>

                {/* Decorative Background Element */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 blur-[120px] rounded-full -mr-64 -mt-64 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-600/5 blur-[120px] rounded-full -ml-64 -mb-64 pointer-events-none" />

                {/* Header */}
                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.01] backdrop-blur-md relative z-10">
                    <div className="flex items-center gap-6">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 flex items-center justify-center text-white text-3xl font-black shadow-[0_8px_30px_rgb(79,70,229,0.3)] ring-4 ring-white/10"
                        >
                            {admission.applicant_name.charAt(0)}
                        </motion.div>
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
                                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] uppercase font-black tracking-widest">
                                        <ShieldCheckIcon className="w-3 h-3" /> Identity Linked
                                    </span>
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

                <div className="flex-grow overflow-y-auto custom-scrollbar relative z-10">
                    <div className="p-8 lg:p-10 space-y-10">
                        {/* Status Banner */}
                        <AnimatePresence>
                            {finalizeState === 'success' && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    className="p-10 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 rounded-[2rem] flex flex-col items-center gap-6 text-center shadow-2xl backdrop-blur-xl relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 pointer-events-none" />
                                    <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.2)] ring-2 ring-emerald-500/30 animate-pulse">
                                        <CheckCircleIcon className="w-10 h-10 text-emerald-500" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Enrollment Finalized</h3>
                                        <p className="text-emerald-500 font-bold font-mono tracking-widest text-lg">
                                            SID: {provisionedData?.student_id_number}
                                        </p>
                                        <p className="text-white/40 text-sm font-medium max-w-md mx-auto">
                                            Identity node synchronized and fiscal ledger initialized. Redirecting to administrative console...
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {finalizeState !== 'success' && (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                                {/* Left Column: Applicant Data */}
                                <div className="lg:col-span-12 xl:col-span-5 space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                                            <UserIcon className="w-4 h-4" />
                                        </div>
                                        <h3 className="text-[10px] font-black uppercase text-white/40 tracking-[0.3em]">
                                            Applicant Profile
                                        </h3>
                                    </div>

                                    <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-8 space-y-8 backdrop-blur-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-colors" />

                                        <div className="flex items-start gap-5 relative z-10">
                                            <div className="mt-1 p-3 bg-indigo-500/10 rounded-xl text-indigo-400 ring-1 ring-indigo-500/20">
                                                <UserIcon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] uppercase font-black text-white/30 mb-1 tracking-widest">Parent Name</p>
                                                <p className="text-white font-bold text-xl tracking-tight">{admission.parent_name}</p>
                                            </div>
                                        </div>

                                        <div className="h-px bg-gradient-to-r from-white/10 via-white/5 to-transparent w-full" />

                                        <div className="flex items-start gap-5 relative z-10">
                                            <div className="mt-1 p-3 bg-purple-500/10 rounded-xl text-purple-400 ring-1 ring-purple-500/20">
                                                <MailIcon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] uppercase font-black text-white/30 mb-1 tracking-widest">Contact Email</p>
                                                <p className="text-white/80 font-semibold">{admission.parent_email}</p>
                                            </div>
                                        </div>

                                        <div className="h-px bg-gradient-to-r from-white/10 via-white/5 to-transparent w-full" />

                                        <div className="flex items-start gap-5 relative z-10">
                                            <div className="mt-1 p-3 bg-pink-500/10 rounded-xl text-pink-400 ring-1 ring-pink-500/20">
                                                <PhoneIcon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] uppercase font-black text-white/30 mb-1 tracking-widest">Contact Phone</p>
                                                <p className="text-white font-bold font-mono tracking-widest">{admission.parent_phone}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <button className="w-full bg-white/[0.01] border border-dashed border-white/10 rounded-2xl p-6 flex items-center justify-center gap-3 text-white/20 text-xs font-black uppercase tracking-widest hover:border-white/20 hover:bg-white/[0.03] hover:text-white/40 transition-all group">
                                        <PlusIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                        Add Internal Protocol Note
                                    </button>
                                </div>

                                {/* Right Column: Documentation */}
                                <div className="lg:col-span-12 xl:col-span-7 space-y-6 flex flex-col">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                                <ShieldCheckIcon className="w-4 h-4" />
                                            </div>
                                            <h3 className="text-[10px] font-black uppercase text-white/40 tracking-[0.3em]">
                                                Documentation Vault
                                            </h3>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={fetchDocs}
                                                className="p-2.5 rounded-xl bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all border border-white/5"
                                                title="Re-sync Repository"
                                            >
                                                <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                            </button>
                                            <button
                                                onClick={() => setIsRequestingDoc(!isRequestingDoc)}
                                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg
                                                    ${isRequestingDoc ? 'bg-indigo-600 text-white ring-2 ring-indigo-500/50' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10 hover:border-white/20'}`}
                                            >
                                                <PlusIcon className="w-4 h-4" /> {isRequestingDoc ? 'Cancel' : 'Request Doc'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-grow flex flex-col gap-4">
                                        {/* Request Form */}
                                        <AnimatePresence>
                                            {isRequestingDoc && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0, y: -10 }}
                                                    animate={{ height: 'auto', opacity: 1, y: 0 }}
                                                    exit={{ height: 0, opacity: 0, y: -10 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="bg-indigo-600/10 border border-indigo-600/20 p-5 rounded-2xl flex items-center gap-4 relative">
                                                        <div className="absolute inset-0 bg-indigo-600/5 animate-pulse rounded-2xl -z-10" />
                                                        <FileTextIcon className="w-6 h-6 text-indigo-400 shrink-0" />
                                                        <input
                                                            type="text"
                                                            value={newDocName}
                                                            onChange={(e) => setNewDocName(e.target.value)}
                                                            placeholder="Specify required artifact (e.g. Identity Proof)..."
                                                            className="bg-transparent border-none outline-none text-white text-sm w-full placeholder-white/20 font-medium"
                                                            autoFocus
                                                            onKeyDown={(e) => e.key === 'Enter' && handleRequestDoc()}
                                                        />
                                                        <button
                                                            onClick={handleRequestDoc}
                                                            disabled={requestingLoading || !newDocName.trim()}
                                                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 transition-all shadow-lg shrink-0"
                                                        >
                                                            {requestingLoading ? <Spinner size="sm" className="text-white" /> : 'Dispatch Request'}
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* Document List */}
                                        <div className="space-y-3">
                                            {loading && docs.length === 0 ? (
                                                <div className="p-20 flex flex-col items-center justify-center gap-4">
                                                    <Spinner className="text-indigo-500" />
                                                    <p className="text-[10px] uppercase font-black tracking-widest text-white/20 animate-pulse">Syncing Repository...</p>
                                                </div>
                                            ) : docs.length === 0 ? (
                                                <div className="p-20 border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center text-center gap-6 bg-white/[0.005] group hover:bg-white/[0.01] transition-all">
                                                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center text-white/10 group-hover:scale-110 transition-transform duration-500 ring-1 ring-white/5">
                                                        <FileTextIcon className="w-10 h-10" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-white/40 text-sm font-bold tracking-tight">Vault is currently empty</p>
                                                        <p className="text-white/20 text-xs font-medium">No documentation has been requested for this applicant.</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setIsRequestingDoc(true)}
                                                        className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white/60 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all border border-white/10"
                                                    >
                                                        Initiate Request Sequence
                                                    </button>
                                                </div>
                                            ) : (
                                                docs.map((doc, idx) => (
                                                    <motion.div
                                                        key={doc.id}
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: idx * 0.05 }}
                                                        className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-2xl group hover:bg-white/[0.04] transition-all relative overflow-hidden"
                                                    >
                                                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-transparent via-white/5 to-transparent" />

                                                        <div className="flex items-center gap-5 relative z-10">
                                                            <div className={`p-4 rounded-xl transition-all duration-300 ${doc.status === 'Verified' ? 'bg-emerald-500/10 text-emerald-400 ring-2 ring-emerald-500/20' :
                                                                doc.status === 'Rejected' ? 'bg-red-500/10 text-red-400 ring-2 ring-red-500/20' :
                                                                    'bg-white/5 text-white/30 group-hover:text-white/50'
                                                                }`}>
                                                                <FileTextIcon className="w-6 h-6" />
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-3">
                                                                    <p className="text-base font-bold text-white tracking-tight">
                                                                        {doc.document_name}
                                                                    </p>
                                                                    {doc.is_mandatory && (
                                                                        <span className="px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full text-[8px] font-black uppercase tracking-widest">
                                                                            Required
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-3 mt-1.5">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className={`w-1.5 h-1.5 rounded-full ${doc.status === 'Verified' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                                                                                doc.status === 'Rejected' ? 'bg-red-500' : 'bg-white/20'
                                                                            }`} />
                                                                        <span className={`text-[9px] uppercase font-black tracking-widest ${doc.status === 'Verified' ? 'text-emerald-400' :
                                                                            doc.status === 'Rejected' ? 'text-red-400' :
                                                                                'text-white/20'
                                                                            }`}>
                                                                            {doc.status}
                                                                        </span>
                                                                    </div>
                                                                    {doc.status === 'Rejected' && (
                                                                        <span className="text-[10px] text-red-400/50 font-medium italic truncate max-w-[200px]">
                                                                            • {doc.rejection_reason}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3 relative z-10">
                                                            {doc.admission_documents?.[0]?.storage_path ? (
                                                                <div className="flex items-center bg-black/40 rounded-[1.25rem] p-1.5 border border-white/5 backdrop-blur-md">
                                                                    <button
                                                                        onClick={() => StorageService.getSignedUrl(BUCKETS.DOCUMENTS, doc.admission_documents[0].storage_path).then(url => window.open(url, '_blank'))}
                                                                        className="p-2.5 hover:bg-white/10 rounded-xl text-white/40 hover:text-white transition-all group/btn"
                                                                        title="Inspect Artifact"
                                                                    >
                                                                        <EyeIcon className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                                                    </button>
                                                                    <div className="w-px h-6 bg-white/10 mx-1" />
                                                                    <button
                                                                        onClick={() => handleDownload(doc)}
                                                                        disabled={downloadingId === doc.id}
                                                                        className="p-2.5 hover:bg-white/10 rounded-xl text-white/40 hover:text-indigo-400 transition-all disabled:opacity-50 group/btn"
                                                                        title="Secure Download"
                                                                    >
                                                                        {downloadingId === doc.id ? <Spinner size="sm" className="text-indigo-400" /> : <DownloadIcon className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />}
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="px-4 py-2 rounded-xl bg-white/[0.02] border border-white/5">
                                                                    <span className="text-[10px] font-black text-white/10 uppercase tracking-widest animate-pulse">Awaiting Payload</span>
                                                                </div>
                                                            )}

                                                            {doc.status !== 'Verified' && doc.admission_documents?.length > 0 && (
                                                                <div className="flex items-center gap-2 ml-2">
                                                                    <button onClick={() => handleVerifyDoc(doc.id)} className="p-3 bg-emerald-500/10 hover:bg-emerald-600 text-emerald-500 hover:text-white rounded-xl transition-all border border-emerald-500/20 shadow-lg" title="Verify Artifact"><CheckCircleIcon className="w-5 h-5" /></button>
                                                                    <button onClick={() => handleRejectDoc(doc.id)} className="p-3 bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20 shadow-lg" title="Reject Artifact"><XIcon className="w-5 h-5" /></button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-10 border-t border-white/5 bg-white/[0.01] flex justify-between items-center gap-6 shrink-0 backdrop-blur-2xl relative z-10">
                    <div className="flex flex-col gap-1">
                        <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.4em] hidden md:block">
                            Secure Admission Protocol v2.5
                        </p>
                        <p className="text-[8px] text-white/10 font-bold uppercase tracking-[0.2em] hidden md:block">
                            Synchronized with Central Registry • {new Date().toLocaleDateString()}
                        </p>
                    </div>

                    <div className="flex gap-6 ml-auto">
                        {admission.status !== 'Enrolled' && finalizeState !== 'success' && (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleFinalize}
                                disabled={finalizeState === 'processing'}
                                className="px-12 py-5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl shadow-[0_10px_40px_rgba(16,185,129,0.3)] transition-all flex items-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed group border border-emerald-400/30"
                            >
                                {finalizeState === 'processing' ? (
                                    <><Spinner size="sm" className="text-white" /> Finalizing Node...</>
                                ) : (
                                    <>
                                        <ShieldCheckIcon className="w-6 h-6 group-hover:scale-110 transition-transform duration-300" />
                                        Finalize Enrollment
                                    </>
                                )}
                            </motion.button>
                        )}
                        {(admission.status === 'Enrolled' || finalizeState === 'success') && (
                            <button onClick={onClose} className="px-12 py-5 bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl border border-white/10 transition-all hover:border-white/20 backdrop-blur-md">
                                Secure Exit
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdmissionDetailsModal;