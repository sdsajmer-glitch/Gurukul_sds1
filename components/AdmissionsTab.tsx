import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase, formatError } from '../services/supabase';
import { AdmissionApplication } from '../types';
import Spinner from './common/Spinner';
import AdmissionDetailsModal from './admin/AdmissionDetailsModal';
import PremiumAvatar from './common/PremiumAvatar';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

// --- Authoritative UI Icons ---
const ShieldCheckIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>;
const RefreshIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>;
const DocumentTextIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M5.036 19.49a.75.75 0 00.11.086c.285.19.66.27 1.012.242 1.94-.156 3.86-.412 5.75-.767a.75.75 0 00.545-.545 37.814 37.814 0 00.767-5.75c.028-.352-.053-.727-.243-1.012a.75.75 0 00-.087-.11L15.93 7.333a3 3 0 00-4.242 0L5.036 14.003l-.001.001a1.5 1.5 0 00-.33 1.92l.001.002 1.371 2.5a1.5 1.5 0 001.999.636l.002-.001 2.5-1.37a1.5 1.5 0 00.636-2z" /></svg>;
const EyeIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const ChevronDownIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>;
const FilterIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} stroke="currentColor" ><path d="M10.5 6h9.75M10.5 12h9.75M10.5 18h9.75M3 6h3M3 12h3M3 18h3" /></svg>;

const STATUS_CONFIG: Record<string, { label: string; style: string; dot: string }> = {
    'Registered': { label: 'Registered', style: 'text-slate-400 bg-white/5 border-white/10', dot: 'bg-slate-500' },
    'Pending Review': { label: 'Pending Review', style: 'text-amber-400 bg-amber-400/10 border-amber-400/20', dot: 'bg-amber-500' },
    'Verified': { label: 'Verified', style: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20', dot: 'bg-indigo-500' },
    'Approved': { label: 'Cleared', style: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', dot: 'bg-emerald-500' },
    'Enrolled': { label: 'Enrolled', style: 'text-teal-400 bg-teal-400/10 border-teal-400/20', dot: 'bg-teal-500' },
    'Rejected': { label: 'Rejected', style: 'text-rose-400 bg-rose-400/10 border-rose-400/20', dot: 'bg-rose-500' },
};

const AdmissionsTab: React.FC<{ branchId?: number | null }> = ({ branchId }) => {
    const [applicants, setApplicants] = useState<AdmissionApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [selectedAdmission, setSelectedAdmission] = useState<AdmissionApplication | null>(null);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);

    const fetchApplicants = useCallback(async () => {
        if (!branchId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_admissions_v2', { p_branch_id: branchId });
            if (error) throw error;
            // Only show promoted enquiries or formal applications
            const filtered = (data || []).filter((a: any) =>
                !['ENQUIRY_ACTIVE', 'ENQUIRY_VERIFIED', 'ENQUIRY_IN_REVIEW', 'ENQUIRY_CONTACTED', 'ENQUIRY_CONVERTED'].includes(a.status)
            );
            setApplicants(filtered as AdmissionApplication[]);
        } catch (err) {
            console.error("Vault Access Error:", err);
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

    const filteredApps = applicants.filter(app => {
        if (filterStatus === 'All') return true; // Show everything in the ledger
        return app.status === filterStatus;
    });

    const metrics = useMemo(() => ({
        total: applicants.length,
        cleared: applicants.filter(a => a.status === 'Approved').length,
        pending: applicants.filter(a => a.status === 'Pending Review' || a.status === 'Registered').length
    }), [applicants]);

    return (
        <div className="max-w-[1800px] mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700 select-none pb-20 pt-6">

            {/* 1. Header Section (The Vault Hero) */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-10">
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                        <span className="text-[10px] font-black uppercase text-white/30 tracking-[0.4em]">Finalized Identity Promotion</span>
                    </div>
                    <h2 className="text-5xl md:text-7xl font-serif font-black text-white tracking-tighter uppercase leading-[0.85]">
                        Admission <span className="opacity-20 font-light italic">Vault.</span>
                    </h2>
                    <p className="text-white/40 text-sm md:text-lg font-serif italic max-w-xl mt-6 border-l border-white/10 pl-8">
                        The ultimate ledger for enrollment identities. Secure, audited, and synchronized through administrative protocol.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden xl:flex items-center gap-3 px-6 py-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none">Integrity Active</span>
                    </div>
                    <button onClick={fetchApplicants} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-white/20 hover:text-white transition-all shadow-xl active:scale-95 group">
                        <RefreshIcon className={clsx("w-6 h-6", loading && "animate-spin")} />
                    </button>
                </div>
            </div>

            {/* 2. Intelligence Metrics Overlay */}
            <div className="flex flex-wrap gap-6">
                <MetricStrip label="Registry Volume" value={metrics.total} icon={<DocumentTextIcon />} color="text-indigo-400" />
                <MetricStrip label="Cleared Nodes" value={metrics.cleared} icon={<ShieldCheckIcon />} color="text-emerald-400" />
                <MetricStrip label="Pending Action" value={metrics.pending} icon={<RefreshIcon />} color="text-amber-400" />
            </div>

            {/* 3. The Ledger Component */}
            <div className="bg-[#0a0a0c] border border-white/5 rounded-[3.5rem] shadow-3xl overflow-hidden ring-1 ring-white/5 relative group min-h-[600px]">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/[0.02] via-transparent to-transparent pointer-events-none" />

                {/* Unified Toolbar */}
                <div className="p-8 md:p-10 border-b border-white/[0.03] bg-white/[0.01] flex flex-col md:flex-row gap-8 justify-between items-center backdrop-blur-3xl sticky top-0 z-30">
                    <div className="relative" ref={filterRef}>
                        <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={clsx("flex items-center gap-4 px-6 py-4 rounded-[1.5rem] border transition-all hover:bg-white/5", isFilterOpen ? "bg-white/5 border-indigo-500/30 text-white" : "bg-black/40 border-white/5 text-white/40")}
                        >
                            <FilterIcon className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest min-w-[120px] text-left">{filterStatus === 'All' ? 'Active Workflow' : filterStatus}</span>
                            <ChevronDownIcon className={clsx("w-4 h-4 transition-transform", isFilterOpen && "rotate-180")} />
                        </button>
                        <AnimatePresence>
                            {isFilterOpen && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full left-0 mt-4 w-60 bg-[#0c0d12]/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-2 shadow-2xl z-50">
                                    {['All', 'Pending Review', 'Verified', 'Approved', 'Enrolled', 'Rejected'].map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => { setFilterStatus(opt); setIsFilterOpen(false); }}
                                            className={clsx("w-full text-left px-5 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all", filterStatus === opt ? "bg-indigo-600 text-white" : "text-white/30 hover:bg-white/5 hover:text-white")}
                                        >
                                            {opt === 'All' ? 'Full Ledger' : opt}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em]">{filteredApps.length} Identities Identified</span>
                    </div>
                </div>

                {/* Table Protocol */}
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-black/40 border-b border-white/[0.03] text-[10px] font-black uppercase text-white/20 tracking-[0.40em]">
                            <tr>
                                <th className="p-10 pl-14">Identity Node</th>
                                <th className="p-10">Sync Timestamp</th>
                                <th className="p-10 text-center">Protocol State</th>
                                <th className="p-10 pr-14 text-right">Admin Control</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                            {loading ? (
                                <tr><td colSpan={4} className="p-40 text-center"><Spinner size="lg" className="opacity-20 translate-y-20 scale-150" /></td></tr>
                            ) : filteredApps.length === 0 ? (
                                <tr><td colSpan={4} className="p-40 text-center opacity-10 flex flex-col items-center justify-center scale-150"><DocumentTextIcon className="w-12 h-12 mb-4" /><span className="text-[10px] font-black uppercase tracking-[0.8em]">Vault Silent</span></td></tr>
                            ) : filteredApps.map((app, idx) => (
                                <tr key={app.id} onClick={() => setSelectedAdmission(app)} className="group hover:bg-white/[0.015] transition-all cursor-pointer">
                                    <td className="p-8 pl-14">
                                        <div className="flex items-center gap-8">
                                            <PremiumAvatar src={app.profile_photo_url} name={app.applicant_name} size="md" className="rounded-2xl transition-all group-hover:scale-110 group-hover:rotate-2 shadow-2xl" />
                                            <div className="min-w-0">
                                                <p className="text-xl font-black text-white/90 group-hover:text-white transition-all uppercase tracking-tight">{app.applicant_name}</p>
                                                <div className="flex items-center gap-3 mt-2">
                                                    <span className="text-[9px] font-black text-white/20 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/5">Grade {app.grade}</span>
                                                    {app.status === 'Enrolled' && (
                                                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                                                            <ShieldCheckIcon className="w-2.5 h-2.5" /> Student Created
                                                        </span>
                                                    )}
                                                    {app.application_number && <span className="text-[9px] font-mono text-white/10 uppercase tracking-[0.2em]">{app.application_number}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-8">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-black text-white/30 uppercase">{new Date(app.registered_at || app.submitted_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                            <span className="text-[9px] font-mono text-white/10 mt-1 uppercase tracking-tighter">Identity Logged</span>
                                        </div>
                                    </td>
                                    <td className="p-8 text-center">
                                        <div className={clsx("inline-flex items-center gap-3 px-6 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest", STATUS_CONFIG[app.status]?.style || "bg-white/5 text-white/20")}>
                                            <div className={clsx("w-1.5 h-1.5 rounded-full animate-pulse", STATUS_CONFIG[app.status]?.dot || "bg-white/10")} />
                                            {STATUS_CONFIG[app.status]?.label || app.status}
                                        </div>
                                    </td>
                                    <td className="p-8 pr-14 text-right">
                                        <button className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 text-white/20 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all flex items-center justify-center ml-auto shadow-2xl">
                                            <EyeIcon className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedAdmission && (
                <AdmissionDetailsModal
                    admission={selectedAdmission}
                    onClose={() => setSelectedAdmission(null)}
                    onUpdate={fetchApplicants}
                />
            )}
        </div>
    );
};

const MetricStrip = ({ label, value, icon, color }: any) => (
    <div className="px-10 py-5 bg-[#0c0d12] border border-white/5 rounded-[2rem] flex items-center gap-6 group hover:border-white/10 transition-all shadow-xl">
        <div className={clsx("p-3 bg-white/[0.02] border border-white/10 rounded-xl", color)}>
            {React.cloneElement(icon, { className: "w-5 h-5" })}
        </div>
        <div>
            <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] block mb-1">{label}</span>
            <span className="text-3xl font-serif font-black text-white/80">{value}</span>
        </div>
    </div>
);

export default AdmissionsTab;
