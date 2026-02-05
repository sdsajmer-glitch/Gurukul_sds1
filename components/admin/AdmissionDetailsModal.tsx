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
    const [expandedDoc, setExpandedDoc] = useState<number | null>(null);

    const isMounted = useRef(true);

    const totalDocs = docs.length;
    const verifiedDocs = docs.filter(d => d.status === 'Verified').length;
    const mandatoryDocs = docs.filter(d => d.is_mandatory);
    const allMandatoryVerified = mandatoryDocs.length > 0 && mandatoryDocs.every(d => d.status === 'Verified');
    const progressPercentage = totalDocs > 0 ? Math.round((verifiedDocs / totalDocs) * 100) : 0;

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
                        <PremiumAvatar
                            src={admission.profile_photo_url}
                            name={admission.applicant_name}
                            size="lg"
                            className="shadow-[0_8px_30px_rgb(79,70,229,0.3)] ring-4 ring-white/10"
                        />
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

                <div className="flex-grow overflow-y-auto custom-scrollbar relative z-10 px-4 sm:px-0">
                    <div className="p-6 lg:p-10 space-y-8 lg:space-y-10">
                        {/* Status Banner */}
                        <AnimatePresence>
                            {finalizeState === 'success' && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    className="p-8 lg:p-12 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/20 rounded-[2.5rem] flex flex-col items-center gap-6 text-center shadow-2xl backdrop-blur-2xl relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
                                    <motion.div
                                        initial={{ rotate: -10, scale: 0 }}
                                        animate={{ rotate: 0, scale: 1 }}
                                        transition={{ type: "spring", damping: 12 }}
                                        className="w-24 h-24 bg-emerald-500/20 rounded-3xl flex items-center justify-center shadow-[0_0_60px_rgba(16,185,129,0.3)] ring-2 ring-emerald-500/40 relative"
                                    >
                                        <CheckCircleIcon className="w-12 h-12 text-emerald-500" />
                                        <div className="absolute -inset-4 bg-emerald-500/20 blur-2xl rounded-full animate-pulse -z-10" />
                                    </motion.div>
                                    <div className="space-y-3">
                                        <h3 className="text-3xl lg:text-4xl font-black text-white uppercase tracking-tighter">Enrollment Finalized</h3>
                                        <div className="bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20 inline-block">
                                            <p className="text-emerald-500 font-black font-mono tracking-[0.3em] text-xl">
                                                SID: {provisionedData?.student_id_number}
                                            </p>
                                        </div>
                                        <p className="text-white/50 text-sm font-medium max-w-lg mx-auto leading-relaxed mt-4">
                                            Identity synchronization successful. Student ledger nodes have been initialized with the designated fee structure. Redirecting to registry console...
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {finalizeState !== 'success' && (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                                {/* Left Column: Applicant Data */}
                                <div className="lg:col-span-12 xl:col-span-5 space-y-8">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                                                <UserIcon className="w-4 h-4" />
                                            </div>
                                            <h3 className="text-xs font-black uppercase text-white/40 tracking-[0.4em]">
                                                Applicant Profile
                                            </h3>
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Profile 100%</span>
                                        </div>
                                    </div>

                                    <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8 space-y-8 backdrop-blur-md relative overflow-hidden group shadow-2xl transition-all hover:bg-white/[0.04]">
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] -mr-32 -mt-32 group-hover:bg-indigo-500/10 transition-all duration-700" />

                                        <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <button className="p-2 text-white/20 hover:text-white/50 transition-colors" title="Modify Registry Entry">
                                                <RefreshCwIcon className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="flex items-start gap-6 relative z-10 transition-transform group-hover:translate-x-1 duration-300">
                                            <div className="mt-1 p-3.5 bg-indigo-500/10 rounded-2xl text-indigo-400 border border-indigo-500/20 shadow-lg group-hover:shadow-indigo-500/10 transition-shadow">
                                                <UserIcon className="w-7 h-7" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase font-black text-white/30 mb-2 tracking-[0.2em]">Parent Identity</p>
                                                <p className="text-white font-black text-2xl tracking-tighter">{admission.parent_name}</p>
                                            </div>
                                        </div>

                                        <div className="h-px bg-gradient-to-r from-white/10 via-white/5 to-transparent w-full" />

                                        <div className="flex items-start gap-6 relative z-10 transition-transform group-hover:translate-x-1 duration-300 delay-75">
                                            <div className="mt-1 p-3.5 bg-purple-500/10 rounded-2xl text-purple-400 border border-purple-500/20 shadow-lg group-hover:shadow-purple-500/10 transition-shadow">
                                                <MailIcon className="w-7 h-7" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10px] uppercase font-black text-white/30 mb-2 tracking-[0.2em]">Primary Contact</p>
                                                <p className="text-white/90 font-bold text-lg truncate">{admission.parent_email}</p>
                                            </div>
                                        </div>

                                        <div className="h-px bg-gradient-to-r from-white/10 via-white/5 to-transparent w-full" />

                                        <div className="flex items-start gap-6 relative z-10 transition-transform group-hover:translate-x-1 duration-300 delay-150">
                                            <div className="mt-1 p-3.5 bg-pink-500/10 rounded-2xl text-pink-400 border border-pink-500/20 shadow-lg group-hover:shadow-pink-500/10 transition-shadow">
                                                <PhoneIcon className="w-7 h-7" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase font-black text-white/30 mb-2 tracking-[0.2em]">Registry Phone</p>
                                                <p className="text-white font-black font-mono tracking-[0.15em] text-xl">{admission.parent_phone}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <button className="w-full bg-white/[0.02] border border-dashed border-white/10 rounded-[2rem] p-8 flex items-center justify-center gap-4 text-white/20 text-[10px] font-black uppercase tracking-[0.3em] hover:border-white/20 hover:bg-white/[0.05] hover:text-white/40 transition-all group active:scale-[0.98]">
                                        <div className="p-2 bg-white/5 rounded-lg group-hover:bg-white/10 transition-colors">
                                            <PlusIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                        </div>
                                        Add Internal Protocol Note
                                    </button>
                                </div>

                                {/* Right Column: Documentation */}
                                <div className="lg:col-span-12 xl:col-span-7 space-y-8 flex flex-col">
                                    <div className="flex flex-col gap-6">
                                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                                        <ShieldCheckIcon className="w-5 h-5" />
                                                    </div>
                                                    <h3 className="text-xs font-black uppercase text-white/40 tracking-[0.4em]">
                                                        Documentation Vault
                                                    </h3>
                                                </div>
                                                <div className="flex items-center gap-3 pl-1.5">
                                                    <div className="flex -space-x-1">
                                                        {[...Array(totalDocs)].map((_, i) => (
                                                            <div key={i} className={`w-1.5 h-1.5 rounded-full border border-black ${i < verifiedDocs ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-white/10'}`} />
                                                        ))}
                                                    </div>
                                                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                                                        {verifiedDocs} of {totalDocs} Verified <span className="text-white/10 mx-2">|</span> {progressPercentage}% Complete
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={fetchDocs}
                                                    className="p-3 rounded-2xl bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all border border-white/5 shadow-lg active:scale-95"
                                                    title="Re-sync Registry"
                                                >
                                                    <RefreshCwIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                                                </button>
                                                <button
                                                    onClick={() => setIsRequestingDoc(!isRequestingDoc)}
                                                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95
                                                        ${isRequestingDoc ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20' : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10 hover:border-white/20'}`}
                                                >
                                                    <PlusIcon className="w-4 h-4" /> {isRequestingDoc ? 'Cancel' : 'Request Doc'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Progress Track */}
                                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden relative">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progressPercentage}%` }}
                                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-grow flex flex-col gap-6">
                                        {/* Request Form */}
                                        <AnimatePresence>
                                            {isRequestingDoc && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0, y: -20 }}
                                                    animate={{ height: 'auto', opacity: 1, y: 0 }}
                                                    exit={{ height: 0, opacity: 0, y: -20 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="bg-indigo-600/15 border border-indigo-600/30 p-6 rounded-[2rem] flex flex-col sm:flex-row items-center gap-6 relative shadow-2xl">
                                                        <div className="absolute inset-0 bg-indigo-600/10 animate-pulse rounded-[2rem] -z-10" />
                                                        <div className="p-3 bg-indigo-600/20 rounded-xl">
                                                            <FileTextIcon className="w-6 h-6 text-indigo-400 shrink-0" />
                                                        </div>
                                                        <input
                                                            type="text"
                                                            value={newDocName}
                                                            onChange={(e) => setNewDocName(e.target.value)}
                                                            placeholder="Specify required artifact title..."
                                                            className="bg-transparent border-none outline-none text-white text-lg w-full placeholder-white/20 font-bold tracking-tight"
                                                            autoFocus
                                                            onKeyDown={(e) => e.key === 'Enter' && handleRequestDoc()}
                                                        />
                                                        <button
                                                            onClick={handleRequestDoc}
                                                            disabled={requestingLoading || !newDocName.trim()}
                                                            className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] disabled:opacity-50 transition-all shadow-[0_8px_30px_rgba(79,70,229,0.4)] shrink-0 active:scale-95"
                                                        >
                                                            {requestingLoading ? <Spinner size="sm" className="text-white" /> : 'Dispatch Protocol'}
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* Document List */}
                                        <div className="space-y-4">
                                            {loading && docs.length === 0 ? (
                                                <div className="py-24 flex flex-col items-center justify-center gap-6">
                                                    <div className="relative">
                                                        <Spinner className="text-indigo-500 w-12 h-12" />
                                                        <div className="absolute inset-0 flex items-center justify-center text-indigo-400/30">
                                                            <RefreshCwIcon className="w-5 h-5 animate-spin-reverse" />
                                                        </div>
                                                    </div>
                                                    <p className="text-[10px] uppercase font-black tracking-[0.5em] text-white/30 animate-pulse">Synchronizing Records...</p>
                                                </div>
                                            ) : docs.length === 0 ? (
                                                <div className="py-24 border-2 border-dashed border-white/10 rounded-[3rem] flex flex-col items-center justify-center text-center gap-8 bg-white/[0.01] group hover:bg-white/[0.02] transition-all duration-500">
                                                    <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center text-white/10 group-hover:scale-110 group-hover:text-white/20 transition-all duration-700 ring-1 ring-white/10 shadow-2xl relative">
                                                        <FileTextIcon className="w-12 h-12" />
                                                        <div className="absolute -inset-4 bg-white/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <p className="text-white text-xl font-black tracking-tighter">Vault Repository Empty</p>
                                                        <p className="text-white/30 text-sm font-medium max-w-xs mx-auto">Initiate document requests to begin the verification sequence.</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setIsRequestingDoc(true)}
                                                        className="px-10 py-4 bg-white/5 hover:bg-white/10 text-white/70 text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl transition-all border border-white/10 shadow-xl active:scale-95"
                                                    >
                                                        Initiate Req-Seq [Alpha]
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-4">
                                                    {docs.map((doc, idx) => (
                                                        <motion.div
                                                            key={doc.id}
                                                            initial={{ opacity: 0, y: 20 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: idx * 0.08 }}
                                                            onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                                                            className={`flex flex-col p-6 bg-white/[0.03] border rounded-[2rem] group transition-all duration-500 relative overflow-hidden shadow-xl cursor-pointer
                                                                ${expandedDoc === doc.id ? 'border-white/20 bg-white/[0.06] ring-1 ring-white/10' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.05]'}
                                                            `}
                                                        >
                                                            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-transparent via-white/10 to-transparent group-hover:via-indigo-500/50 transition-all duration-700" />

                                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                                                                <div className="flex items-center gap-6 relative z-10 mb-4 sm:mb-0">
                                                                    <div className={`p-4 rounded-2xl transition-all duration-500 shadow-lg ${doc.status === 'Verified' ? 'bg-emerald-500/15 text-emerald-400 ring-2 ring-emerald-500/30' :
                                                                        doc.status === 'Rejected' ? 'bg-red-500/15 text-red-500 ring-2 ring-red-500/30' :
                                                                            'bg-white/5 text-white/30 group-hover:scale-110 group-hover:text-white/60'
                                                                        }`}>
                                                                        {doc.status === 'Verified' ? <CheckCircleIcon className="w-7 h-7" /> : <FileTextIcon className="w-7 h-7" />}
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-3">
                                                                            <p className="text-lg font-black text-white tracking-tight uppercase group-hover:text-indigo-400 transition-colors">
                                                                                {doc.document_name}
                                                                            </p>
                                                                            {doc.is_mandatory && (
                                                                                <span className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] shadow-sm">
                                                                                    Required
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-4 mt-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className={`w-2 h-2 rounded-full ${doc.status === 'Verified' ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]' :
                                                                                    doc.status === 'Rejected' ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]' :
                                                                                        'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.8)]'
                                                                                    }`} />
                                                                                <span className={`text-[10px] uppercase font-black tracking-[0.2em] font-mono ${doc.status === 'Verified' ? 'text-emerald-400' :
                                                                                    doc.status === 'Rejected' ? 'text-red-400' :
                                                                                        'text-amber-400'
                                                                                    }`}>
                                                                                    {doc.status}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Hover Triggered Actions */}
                                                                <div className="flex items-center gap-4 relative z-10 ml-auto sm:ml-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto">
                                                                    {doc.admission_documents?.[0]?.storage_path ? (
                                                                        <div className="flex items-center bg-black/60 rounded-[1.5rem] p-2 border border-white/10 backdrop-blur-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
                                                                            <button
                                                                                onClick={() => StorageService.getSignedUrl(BUCKETS.DOCUMENTS, doc.admission_documents[0].storage_path).then(url => window.open(url, '_blank'))}
                                                                                className="p-3 hover:bg-white/10 rounded-2xl text-white/50 hover:text-white transition-all group/btn"
                                                                                title="Inspect Artifact"
                                                                            >
                                                                                <EyeIcon className="w-5 h-5 group-hover/btn:scale-125 transition-transform duration-300" />
                                                                            </button>
                                                                            <div className="w-px h-8 bg-white/15 mx-1.5" />
                                                                            <button
                                                                                onClick={() => handleDownload(doc)}
                                                                                disabled={downloadingId === doc.id}
                                                                                className="p-3 hover:bg-white/10 rounded-2xl text-white/50 hover:text-indigo-400 transition-all disabled:opacity-50 group/btn"
                                                                                title="Secure Download"
                                                                            >
                                                                                {downloadingId === doc.id ? <Spinner size="sm" className="text-indigo-400" /> : <DownloadIcon className="w-5 h-5 group-hover/btn:scale-125 transition-transform duration-300" />}
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="px-6 py-2.5 rounded-[1.25rem] bg-white/[0.03] border border-white/5 shadow-inner">
                                                                            <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] font-mono animate-pulse">Wait-Pld</span>
                                                                        </div>
                                                                    )}

                                                                    {doc.status !== 'Verified' && doc.admission_documents?.length > 0 && (
                                                                        <div className="flex items-center gap-3 ml-2" onClick={e => e.stopPropagation()}>
                                                                            <button
                                                                                onClick={() => handleVerifyDoc(doc.id)}
                                                                                className="p-4 bg-emerald-500/10 hover:bg-emerald-600 text-emerald-500 hover:text-white rounded-2xl transition-all border border-emerald-500/20 shadow-xl active:scale-90 group/v"
                                                                                title="Execute Verification"
                                                                            >
                                                                                <CheckCircleIcon className="w-6 h-6 group-hover/v:scale-110 transition-transform" />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleRejectDoc(doc.id)}
                                                                                className="p-4 bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white rounded-2xl transition-all border border-red-500/20 shadow-xl active:scale-90 group/v"
                                                                                title="Reject Artifact"
                                                                            >
                                                                                <XIcon className="w-6 h-6 group-hover/v:scale-110 transition-transform" />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Expansion Area: Reviewer Notes / Recovery */}
                                                            <AnimatePresence>
                                                                {expandedDoc === doc.id && (
                                                                    <motion.div
                                                                        initial={{ height: 0, opacity: 0 }}
                                                                        animate={{ height: 'auto', opacity: 1 }}
                                                                        exit={{ height: 0, opacity: 0 }}
                                                                        className="overflow-hidden"
                                                                    >
                                                                        <div className="pt-6 mt-6 border-t border-white/10 flex flex-col gap-4">
                                                                            {doc.status === 'Rejected' && (
                                                                                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-4">
                                                                                    <AlertTriangleIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                                                                                    <div className="space-y-1">
                                                                                        <p className="text-[10px] font-black uppercase text-red-400/60 tracking-widest">Rejection Reason</p>
                                                                                        <p className="text-sm font-medium text-red-200/80">{doc.rejection_reason}</p>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/20 px-2">
                                                                                <p>Artifact Type: Registry Document</p>
                                                                                <p>Internal ID: {doc.id}</p>
                                                                            </div>
                                                                        </div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-8 lg:p-10 border-t border-white/10 bg-white/[0.02] flex flex-col md:flex-row justify-between items-center gap-8 shrink-0 backdrop-blur-3xl relative z-10">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)] ${allMandatoryVerified ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                            <p className="text-[11px] text-white/50 font-black uppercase tracking-[0.5em]">
                                Secure Admission Protocol v2.5
                            </p>
                        </div>
                        <p className="text-[9px] text-white/20 font-bold uppercase tracking-[0.3em] pl-5">
                            {allMandatoryVerified
                                ? "Protocol Stage: Ready for Finalization"
                                : `Protocol Stage: Awaiting Compliance (${verifiedDocs}/${totalDocs} Verified)`}
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6 w-full md:w-auto items-center">
                        {!allMandatoryVerified && admission.status !== 'Enrolled' && finalizeState !== 'success' && (
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/30 text-center sm:text-right max-w-[200px] leading-relaxed">
                                Complete all <span className="text-indigo-400">Mandatory</span> verifications to enable finalization.
                            </p>
                        )}

                        {admission.status !== 'Enrolled' && finalizeState !== 'success' && (
                            <motion.button
                                whileHover={allMandatoryVerified ? { scale: 1.03, translateY: -2 } : {}}
                                whileTap={allMandatoryVerified ? { scale: 0.97 } : {}}
                                onClick={handleFinalize}
                                disabled={finalizeState === 'processing' || !allMandatoryVerified}
                                className={`w-full sm:px-16 py-6 font-black text-sm uppercase tracking-[0.4em] rounded-[2rem] transition-all flex items-center justify-center gap-5 relative overflow-hidden border
                                    ${allMandatoryVerified
                                        ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 hover:from-emerald-500 hover:via-emerald-400 hover:to-emerald-300 text-white shadow-[0_20px_60px_rgba(16,185,129,0.4)] border-emerald-400/40'
                                        : 'bg-white/5 text-white/20 border-white/10 grayscale cursor-not-allowed opacity-50'}
                                `}
                            >
                                <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-[-20deg]" />
                                {finalizeState === 'processing' ? (
                                    <><Spinner size="sm" className="text-white" /> Initializing Node...</>
                                ) : (
                                    <>
                                        <ShieldCheckIcon className="w-7 h-7" />
                                        Finalize Enrollment
                                    </>
                                )}
                            </motion.button>
                        )}
                        {(admission.status === 'Enrolled' || finalizeState === 'success') && (
                            <button onClick={onClose} className="w-full sm:px-16 py-6 bg-white/5 hover:bg-white/10 text-white font-black text-sm uppercase tracking-[0.4em] rounded-[2rem] border border-white/10 transition-all hover:border-indigo-500/50 backdrop-blur-3xl shadow-2xl active:scale-95 group">
                                <span className="group-hover:text-indigo-400 transition-colors">Term-Exit Protocol</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdmissionDetailsModal;