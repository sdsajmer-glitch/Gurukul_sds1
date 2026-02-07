import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase, formatError } from './services/supabase';
import { AdmissionApplication } from './types';
import Spinner from './components/common/Spinner';
import { XIcon } from './components/icons/XIcon';
import { CheckCircleIcon } from './components/icons/CheckCircleIcon';
import { DocumentTextIcon } from './components/icons/DocumentTextIcon';
import { EyeIcon } from './components/icons/EyeIcon';
import { ClockIcon } from './components/icons/ClockIcon';
import { FilterIcon } from './components/icons/FilterIcon';
import { AlertTriangleIcon } from './components/icons/AlertTriangleIcon';
import { RefreshIcon } from './components/icons/RefreshIcon';
import { ChevronDownIcon } from './components/icons/ChevronDownIcon';
import AdmissionDetailsModal from './components/admin/AdmissionDetailsModal';
import PremiumAvatar from './components/common/PremiumAvatar';
import { motion, AnimatePresence } from 'framer-motion';

const statusColors: Record<string, string> = {
    'Registered': 'bg-slate-500/10 text-slate-400 border-white/5',
    'Pending Review': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'Verified': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    'Approved': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-black shadow-[0_0_10px_rgba(16,185,129,0.1)]',
    'Rejected': 'bg-rose-500/10 text-red-500 border-rose-500/20',
    'Cancelled': 'bg-zinc-500/10 text-zinc-500 border-white/5',
};

const formatStatus = (s: string) => s === 'Approved' ? 'Admitted' : s;

export const RequestDocumentsModal: React.FC<{
    admissionId: string;
    applicantName: string;
    onClose: () => void;
    onSuccess: () => void;
}> = ({ admissionId, applicantName, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const docOptions = [
        "Birth Certificate",
        "Previous School Transfer Certificate",
        "Passport / Identity Proof",
        "Immunization Records",
        "Recent Passport Photo"
    ];

    const toggleDoc = (doc: string) => {
        setSelectedDocs(prev => prev.includes(doc) ? prev.filter(d => d !== doc) : [...prev, doc]);
    };

    const handleSelectAll = () => {
        if (selectedDocs.length === docOptions.length) setSelectedDocs([]);
        else setSelectedDocs(docOptions);
    };

    const handleSendRequest = async () => {
        if (selectedDocs.length === 0) {
            setStatus({ type: 'error', message: 'Selection Required: At least one document must be requested.' });
            return;
        }

        setLoading(true);
        setStatus(null);

        try {
            const { error } = await supabase.rpc('admin_request_documents', {
                p_admission_id: admissionId,
                p_documents: selectedDocs,
                p_message: message
            });

            if (error) throw error;

            setStatus({ type: 'success', message: 'Request Transmitted: Identity verification cycle initialized.' });

            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1800);

        } catch (err: any) {
            setStatus({ type: 'error', message: `Uplink Failure: ${formatError(err)}` });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[400] p-4" onClick={onClose}>
            <div className="bg-[#0c0d12] w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-white/10 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 ring-1 ring-white/5" onClick={e => e.stopPropagation()}>
                <div className="px-8 py-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <DocumentTextIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-tight">Request Artifacts</h3>
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Verification Protocol</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-all text-white/30 hover:text-white">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar flex-grow space-y-8">
                    {status && (
                        <div className={`p-4 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2 border ${status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                            {status.type === 'success' ? <CheckCircleIcon className="w-6 h-6 shrink-0" /> : <AlertTriangleIcon className="w-6 h-6 shrink-0" />}
                            <p className="text-xs font-bold uppercase tracking-wide leading-relaxed">{status.message}</p>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="flex justify-between items-end px-1">
                            <p className="text-xs font-serif italic text-white/40 leading-relaxed">
                                Request specific identities for <strong className="text-white not-italic">{applicantName}</strong>'s node.
                            </p>
                            <button onClick={handleSelectAll} className="text-[9px] font-black uppercase text-primary tracking-widest hover:underline">
                                {selectedDocs.length === docOptions.length ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {docOptions.map(doc => {
                                const isSelected = selectedDocs.includes(doc);
                                return (
                                    <label
                                        key={doc}
                                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden ${isSelected ? 'bg-primary/10 border-primary ring-2 ring-primary/5' : 'bg-white/[0.02] border-white/10 hover:border-white/10'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary border-primary' : 'bg-black/20 border-white/10 group-hover:border-primary/40'}`}>
                                            {isSelected && <CheckCircleIcon className="w-3.5 h-3.5 text-white" />}
                                        </div>
                                        <span className={`text-[11px] font-bold uppercase tracking-tight transition-colors ${isSelected ? 'text-white' : 'text-white/40 group-hover:text-white/60'}`}>{doc}</span>
                                        <input type="checkbox" checked={isSelected} onChange={() => toggleDoc(doc)} className="hidden" />
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em] ml-1">Context / Message</label>
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder="Explain the protocol necessity..."
                            className="w-full p-5 bg-white/[0.02] border border-white/10 rounded-[1.8rem] text-sm text-white focus:border-primary/50 focus:ring-8 focus:ring-primary/5 outline-none h-28 resize-none shadow-inner transition-all font-serif italic"
                        />
                    </div>
                </div>

                <div className="px-8 py-6 border-t border-white/5 bg-white/[0.01] flex flex-col sm:flex-row justify-end items-center gap-4">
                    <button
                        onClick={onClose}
                        className="w-full sm:w-auto px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/30 hover:text-white transition-all order-2 sm:order-1"
                    >
                        Abort
                    </button>
                    <button
                        onClick={handleSendRequest}
                        disabled={loading || selectedDocs.length === 0}
                        className={`w-full sm:w-auto px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 transform active:scale-95 shadow-2xl order-1 sm:order-2 ${loading || selectedDocs.length === 0 ? 'bg-white/5 text-white/10 cursor-not-allowed grayscale' : 'bg-primary text-white shadow-primary/20 hover:bg-primary/90'}`}
                    >
                        {loading ? <Spinner size="sm" className="text-white" /> : <><ClockIcon className="w-4 h-4" /> Dispatch Request</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AdmissionsTab: React.FC<{ branchId?: number | null }> = ({ branchId }) => {
    const [applicants, setApplicants] = useState<AdmissionApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [selectedAdmission, setSelectedAdmission] = useState<AdmissionApplication | null>(null);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);

    const fetchApplicants = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const targetBranchId = (branchId === null || branchId === undefined) ? null : Number(branchId);
            const { data, error } = await supabase.rpc('get_admissions_v2', { p_branch_id: targetBranchId });
            if (error) throw error;

            // Allow all formal admission records (including promoted ones)
            const admissionOnlyRoster = (data || []).filter((a: any) =>
                !['ENQUIRY_ACTIVE', 'ENQUIRY_VERIFIED', 'ENQUIRY_IN_REVIEW', 'ENQUIRY_CONTACTED'].includes(a.status)
            );
            setApplicants(admissionOnlyRoster as AdmissionApplication[]);
        } catch (err) {
            console.error("Fetch failure:", err);
            setFetchError(formatError(err));
        } finally {
            setLoading(false);
        }
    }, [branchId]);

    useEffect(() => { fetchApplicants(); }, [fetchApplicants]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(e.target as Node)) setIsFilterOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredApps = useMemo(() => {
        return (applicants || []).filter(app =>
            filterStatus === 'All' || app.status === filterStatus
        );
    }, [applicants, filterStatus]);

    return (
        <div className="space-y-6 md:space-y-12 animate-in fade-in slide-up pb-20 pt-2">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                        <span className="text-[10px] font-black uppercase text-white/30 tracking-[0.4em]">Integrated Lifecycle Registry</span>
                    </div>
                    <h2 className="text-5xl md:text-7xl font-serif font-black text-white tracking-tighter uppercase leading-none">Admission <span className="opacity-20 font-light italic">Vault.</span></h2>
                    <p className="text-white/40 text-sm md:text-lg mt-6 italic font-serif leading-relaxed border-l border-white/10 pl-6 max-w-xl">
                        Operational intelligence for promoted identities and formal enrollment nodes.
                    </p>
                </div>
                <button
                    onClick={fetchApplicants}
                    className="p-4 rounded-[1.5rem] bg-white/[0.02] border border-white/5 text-white/30 hover:text-primary transition-all group shadow-xl active:scale-95"
                >
                    <RefreshIcon className={`w-6 h-6 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'}`} />
                </button>
            </div>

            {fetchError && (
                <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-[2rem] flex items-center justify-between shadow-xl animate-in shake">
                    <div className="flex items-center gap-4">
                        <AlertTriangleIcon className="w-8 h-8 text-red-500 shrink-0" />
                        <div>
                            <p className="text-xs font-black uppercase text-red-500 tracking-widest">Fetch Failure</p>
                            <p className="text-sm font-bold text-red-200/70 mt-1">{fetchError}</p>
                        </div>
                    </div>
                    <button onClick={fetchApplicants} className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95">Retry Protocol</button>
                </div>
            )}

            <div className="bg-[#0a0a0c] border border-white/5 rounded-[3rem] shadow-3xl overflow-visible flex flex-col min-h-[500px] ring-1 ring-white/5 relative">
                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-indigo-500/[0.02] to-transparent pointer-events-none rounded-t-[3rem]" />

                <div className="p-8 border-b border-white/[0.03] bg-white/[0.01] flex wrap gap-4 justify-between items-center backdrop-blur-3xl sticky top-0 z-30 rounded-t-[3rem]">
                    <div className="relative" ref={filterRef}>
                        <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className="flex items-center gap-4 bg-black/60 px-6 py-4 rounded-[1.5rem] border border-white/10 shadow-inner group hover:border-primary/40 transition-all min-w-[200px]"
                        >
                            <FilterIcon className="w-4 h-4 text-white/20 group-hover:text-primary transition-colors" />
                            <span className="text-[11px] font-black uppercase text-white/60 tracking-[0.2em] flex-grow text-left">
                                {filterStatus === 'All' ? 'GLOBAL ROSTER' : filterStatus}
                            </span>
                            <ChevronDownIcon className={`w-4 h-4 text-white/20 transition-transform duration-500 ${isFilterOpen ? 'rotate-180 text-primary' : ''}`} />
                        </button>

                        <AnimatePresence>
                            {isFilterOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute top-full left-0 mt-4 w-72 bg-[#0c0d12] border border-white/10 rounded-[2rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] p-3 z-[60] backdrop-blur-2xl ring-1 ring-white/5"
                                >
                                    {['All', 'Registered', 'Pending Review', 'Verified', 'Approved', 'Rejected'].map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => { setFilterStatus(status); setIsFilterOpen(false); }}
                                            className={`w-full text-left px-6 py-4 rounded-[1.2rem] text-[10px] font-black uppercase tracking-[0.3em] transition-all ${filterStatus === status ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/20 hover:text-white hover:bg-white/5'}`}
                                        >
                                            {status === 'All' ? 'FULL LEDGER' : status === 'Approved' ? 'ADMITTED' : status}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <span className="text-[10px] font-black text-white/10 uppercase tracking-[0.4em]">{filteredApps.length} Identities Identified</span>
                </div>

                {loading ? (
                    <div className="flex flex-col justify-center items-center py-40 gap-6">
                        <Spinner size="lg" className="text-primary" />
                        <p className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em] animate-pulse">Syncing Lifecycle Ledger</p>
                    </div>
                ) : filteredApps.length === 0 && !fetchError ? (
                    <div className="py-40 text-center flex flex-col items-center gap-8 animate-in fade-in duration-1000">
                        <div className="w-24 h-24 bg-white/[0.01] rounded-[2.5rem] flex items-center justify-center border border-dashed border-white/10 shadow-inner">
                            <DocumentTextIcon className="w-10 h-10 text-white/5" />
                        </div>
                        <div className="max-w-sm mx-auto">
                            <h3 className="text-xl font-serif font-black text-white/20 uppercase tracking-widest mb-4">Registry <span className="italic opacity-50">Standby.</span></h3>
                            <p className="text-xs text-white/10 leading-relaxed italic font-serif">
                                No records matched the current protocol filters. Verify an <strong className="text-white/30">Admission Code</strong> in Quick Verification to Provision new nodes.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto w-full custom-scrollbar">
                        <table className="w-full text-left text-sm min-w-[900px]">
                            <thead className="bg-[#0c0d12]/40 text-[10px] font-black uppercase text-white/20 tracking-[0.3em] border-b border-white/[0.03]">
                                <tr>
                                    <th className="p-10 pl-14">Identity Node</th>
                                    <th className="p-10">Registry Pulse</th>
                                    <th className="p-10">Lifecycle Status</th>
                                    <th className="p-10 text-right pr-14">Administrative Protocols</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.02] relative z-10">
                                {filteredApps.map((app, idx) => (
                                    <tr
                                        key={app.id}
                                        className="hover:bg-white/[0.015] transition-all group cursor-pointer animate-in fade-in slide-in-from-bottom-2"
                                        style={{ animationDelay: `${idx * 40}ms` }}
                                        onClick={() => setSelectedAdmission(app)}
                                    >
                                        <td className="p-10 pl-14">
                                            <div className="flex items-center gap-10">
                                                <div className="relative group-hover:scale-105 transition-transform duration-500">
                                                    <div className="absolute inset-0 bg-primary/20 blur-2xl opacity-0 group-hover:opacity-30 transition-opacity" />
                                                    <PremiumAvatar src={app.profile_photo_url} name={app.applicant_name} size="md" className="relative z-10 ring-2 ring-white/5 group-hover:ring-primary/40 shadow-2xl" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-serif font-black text-white uppercase tracking-tight group-hover:text-primary transition-colors text-[20px] leading-none mb-2">{app.applicant_name}</p>
                                                    <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">Grade {app.grade} Node</span>
                                                        {app.application_number && <span className="text-white/10 font-mono tracking-tighter">[{app.application_number}]</span>}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-10">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-3 font-mono text-[12px] text-white/40 font-bold uppercase tracking-widest">
                                                    <ClockIcon className="w-4 h-4 opacity-30" />
                                                    {new Date(app.registered_at || app.submitted_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                                                </div>
                                                <span className="text-[9px] font-black text-white/10 uppercase tracking-[0.2em] pl-7">Identity Recorded</span>
                                            </div>
                                        </td>
                                        <td className="p-10">
                                            <span className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase border tracking-widest shadow-2xl transition-all flex items-center gap-3 w-fit ${statusColors[app.status] || statusColors['Registered']}`}>
                                                <div className="w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
                                                {formatStatus(app.status)}
                                            </span>
                                        </td>
                                        <td className="p-10 text-right pr-14">
                                            <button className="p-5 rounded-[1.5rem] bg-white/[0.03] text-white/20 group-hover:text-primary group-hover:bg-primary/10 group-hover:border-primary/20 border border-transparent transition-all shadow-2xl active:scale-90">
                                                <EyeIcon className="w-6 h-6" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {selectedAdmission && (
                <AdmissionDetailsModal
                    admission={selectedAdmission}
                    onClose={() => setSelectedAdmission(null)}
                    onUpdate={() => {
                        fetchApplicants();
                    }}
                />
            )}
        </div>
    );
};

export default AdmissionsTab;