import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, formatError } from '../services/supabase';
import { Enquiry, EnquiryStatus } from '../types';
import Spinner from './common/Spinner';
import EnquiryDetailsModal from './EnquiryDetailsModal';
import PremiumAvatar from './common/PremiumAvatar';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

// --- Authoritative UI Icons ---
const SearchIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>;
const ShieldCheckIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>;
const RefreshIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>;
const TerminalIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" /></svg>;
const ZapIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>;
const FilterIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" /></svg>;
const UserGroupIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} stroke="currentColor"><path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-3.121-3.122 6.124 6.124 0 00-6.125 0 4.125 4.125 0 00-3.121 3.122 9.337 9.337 0 004.121.952 9.38 9.38 0 002.625-.372z" /><path d="M15 12a3 3 0 110-6 3 3 0 010 6z" /><path d="M3.38 18.93a5.077 5.077 0 013.119-3.441 5.3 5.3 0 013.626 0 5.173 5.173 0 013.119 3.441" /><path d="M8.25 10.5a2.25 2.25 0 110-4.5 2.25 2.25 0 010 4.5z" /></svg>;

const STATUS_CONFIG: Record<string, { label: string, style: string }> = {
    'NEW': { label: 'New', style: 'text-blue-400 bg-blue-400/10 border-blue-400/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]' },
    'ENQUIRY_ACTIVE': { label: 'Active', style: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20' },
    'ENQUIRY_VERIFIED': { label: 'Verified', style: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' },
    'ENQUIRY_IN_REVIEW': { label: 'In Review', style: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
    'ENQUIRY_CONTACTED': { label: 'Contacted', style: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
    'ENQUIRY_REJECTED': { label: 'Rejected', style: 'text-rose-400 bg-rose-400/10 border-rose-400/20' },
    'ENQUIRY_CONVERTED': { label: 'Admitted', style: 'text-teal-400 bg-teal-400/10 border-teal-400/20' },
};

interface EnquiryTabProps {
    branchId?: number | null;
    onNavigate?: (component: string) => void;
}

const EnquiryTab: React.FC<EnquiryTabProps> = ({ branchId, onNavigate }) => {
    const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewingEnquiry, setViewingEnquiry] = useState<Enquiry | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('');

    const fetchEnquiries = useCallback(async (isSilent = false) => {
        if (branchId === undefined) return;
        if (!isSilent) setLoading(true);
        try {
            const cleanBranchId = branchId === null ? null : Number(branchId);
            const { data, error } = await supabase.rpc('get_all_enquiries_v3', { p_branch_id: cleanBranchId });
            if (error) throw error;
            setEnquiries(data || []);
        } catch (err: any) {
            console.error("Database Sync Error:", err);
        } finally {
            setLoading(false);
        }
    }, [branchId]);

    useEffect(() => { fetchEnquiries(); }, [fetchEnquiries]);

    const filteredEnquiries = useMemo(() => {
        return enquiries.filter(enq => {
            if (!filterStatus) {
                if (enq.status === 'ENQUIRY_CONVERTED' || enq.status === 'ENQUIRY_REJECTED') return false;
            } else if (enq.status !== filterStatus) return false;

            const searchLower = searchTerm.toLowerCase();
            return !searchTerm ||
                enq.applicant_name.toLowerCase().includes(searchLower) ||
                enq.parent_name.toLowerCase().includes(searchLower) ||
                String(enq.id).toLowerCase().includes(searchLower);
        });
    }, [enquiries, searchTerm, filterStatus]);

    const stats = useMemo(() => ({
        total: enquiries.length,
        verified: enquiries.filter(e => e.status === 'ENQUIRY_VERIFIED').length,
        active: enquiries.filter(e => e.status !== 'ENQUIRY_CONVERTED' && e.status !== 'ENQUIRY_REJECTED').length
    }), [enquiries]);

    return (
        <div className="max-w-[1700px] mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700 select-none pb-20">

            {/* 1. Authority Hero Area */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-10">
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                        <span className="text-[10px] font-black uppercase text-white/30 tracking-[0.4em]">Official Records</span>
                    </div>
                    <div>
                        <h2 className="text-5xl md:text-7xl font-serif font-black text-white tracking-tighter uppercase leading-[0.85]">
                            Enquiries.
                        </h2>
                        <p className="text-white/40 text-sm md:text-lg font-serif italic max-w-xl mt-6 border-l border-white/10 pl-8">
                            Verify and manage student enquiries through the official admissions channel.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                    <button onClick={() => fetchEnquiries()} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl text-white/20 hover:text-white transition-all shadow-xl active:scale-95 group">
                        <RefreshIcon className={clsx("w-6 h-6", loading && "animate-spin")} />
                    </button>
                    {onNavigate && (
                        <button
                            onClick={() => onNavigate('Code Verification')}
                            className="flex-grow md:flex-none h-16 px-10 bg-indigo-600 text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-indigo-900/20 hover:bg-indigo-500 hover:scale-[1.02] active:scale-95 transition-all border border-indigo-400/20 flex items-center justify-center gap-4"
                        >
                            <ZapIcon className="w-5 h-5" /> Verify Code
                        </button>
                    )}
                </div>
            </div>

            {/* 2. Intelligence Metrics (Glass Pattern) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatusCard title="Total Enquiries" value={stats.total} label="All Records" icon={<TerminalIcon />} color="text-indigo-400" />
                <StatusCard title="Verified" value={stats.verified} label="Verified Enquiries" icon={<ShieldCheckIcon />} color="text-emerald-400" />
                <StatusCard title="Active" value={stats.active} label="In Progress" icon={<UserGroupIcon />} color="text-blue-400" />
            </div>

            {/* 3. The Control Hub (Filter/Search) */}
            <div className="sticky top-4 z-[40] bg-[#0c0d12]/80 backdrop-blur-2xl p-3 border border-white/5 rounded-[2.5rem] shadow-2xl flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1 group">
                    <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search by name or ID..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-[1.8rem] pl-16 pr-8 py-4 text-white placeholder:text-white/10 outline-none text-sm transition-all focus:bg-black/60 font-medium"
                    />
                </div>
                <div className="flex p-1 bg-black/40 rounded-[1.8rem] border border-white/5 overflow-x-auto no-scrollbar max-w-full">
                    <FilterButton active={!filterStatus} onClick={() => setFilterStatus('')} label="View All" />
                    {Object.keys(STATUS_CONFIG).map(st => (
                        <FilterButton key={st} active={filterStatus === st} onClick={() => setFilterStatus(st)} label={STATUS_CONFIG[st].label} />
                    ))}
                </div>
            </div>

            {/* 4. The Registry Table (High-Fidelity) */}
            <div className="bg-[#0c0d12] rounded-[3rem] border border-white/5 shadow-2xl relative overflow-hidden group/table min-h-[500px]">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/[0.01] via-transparent to-transparent pointer-events-none" />

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white/[0.01] border-b border-white/[0.03]">
                            <tr>
                                <th className="p-10 pl-14 text-[10px] font-black uppercase text-white/20 tracking-[0.4em]">Applicant</th>
                                <th className="p-10 text-[10px] font-black uppercase text-white/20 tracking-[0.4em]">Grade</th>
                                <th className="p-10 text-[10px] font-black uppercase text-white/20 tracking-[0.4em]">Status</th>
                                <th className="p-10 text-[10px] font-black uppercase text-white/20 tracking-[0.4em]">Date</th>
                                <th className="p-10 pr-14 text-right text-[10px] font-black uppercase text-white/20 tracking-[0.4em]">View</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                            <AnimatePresence mode="popLayout">
                                {filteredEnquiries.length === 0 ? (
                                    <tr><td colSpan={5} className="p-40 text-center opacity-10 flex flex-col items-center justify-center scale-150"><TerminalIcon className="w-12 h-12 mb-4" /><span className="text-[10px] font-black uppercase tracking-[0.8em]">No Records</span></td></tr>
                                ) : (
                                    filteredEnquiries.map((enq, idx) => (
                                        <motion.tr
                                            key={enq.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.03 }}
                                            onClick={() => setViewingEnquiry(enq)}
                                            className="group hover:bg-white/[0.02] transition-all cursor-pointer relative overflow-hidden"
                                        >
                                            <td className="p-8 pl-14 relative">
                                                <div className="flex items-center gap-6">
                                                    <PremiumAvatar src={enq.profile_photo_url} name={enq.applicant_name} size="md" className="ring-1 ring-white/10 group-hover:ring-indigo-500/30 transition-all rounded-2xl" />
                                                    <div className="min-w-0">
                                                        <p className="text-xl font-black text-white/90 group-hover:text-white transition-all uppercase tracking-tight">{enq.applicant_name}</p>
                                                        <span className="text-[10px] font-mono text-white/10 uppercase tracking-widest block mt-1">ID-{String(enq.id).slice(0, 8)} • {enq.parent_name}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-8">
                                                <div className="px-4 py-2 rounded-xl bg-white/[0.02] border border-white/5 inline-flex flex-col">
                                                    <span className="text-[8px] font-black italic text-white/10 uppercase mb-0.5">Application For</span>
                                                    <span className="text-sm font-black text-white/60">Class {enq.grade}</span>
                                                </div>
                                            </td>
                                            <td className="p-8">
                                                <span className={clsx("px-5 py-2 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] border", STATUS_CONFIG[enq.status]?.style || "bg-white/5 text-white/20")}>
                                                    {STATUS_CONFIG[enq.status]?.label || enq.status}
                                                </span>
                                            </td>
                                            <td className="p-8">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-white/40">{new Date(enq.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                    <span className="text-[10px] font-mono text-white/10 mt-1">{new Date(enq.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </td>
                                            <td className="p-8 pr-14 text-right">
                                                <button className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 text-white/20 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all flex items-center justify-center ml-auto shadow-2xl">
                                                    <ZapIcon className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>

            {viewingEnquiry && (
                <EnquiryDetailsModal
                    enquiry={viewingEnquiry}
                    onClose={() => setViewingEnquiry(null)}
                    onUpdate={() => fetchEnquiries(true)}
                    onNavigate={onNavigate}
                />
            )}
        </div>
    );
};

const StatusCard = ({ title, value, label, icon, color }: any) => (
    <div className="bg-[#0c0d12] p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group hover:bg-white/[0.01] transition-all cursor-default">
        <div className="absolute top-0 right-0 p-8 opacity-5 text-white group-hover:scale-125 transition-transform duration-1000">
            {React.cloneElement(icon, { className: "w-24 h-24" })}
        </div>
        <div className="relative z-10 flex flex-col h-full justify-between gap-10">
            <div className="flex justify-between items-start">
                <div className={clsx("p-4 rounded-2xl bg-white/[0.02] border border-white/10", color)}>
                    {React.cloneElement(icon, { className: "w-6 h-6" })}
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black uppercase text-white/10 tracking-[0.4em]">{title}</span>
                </div>
            </div>
            <div>
                <h4 className="text-5xl font-serif font-black text-white tracking-tighter leading-none mb-3">{value}</h4>
                <p className="text-[9px] font-black uppercase text-white/20 tracking-[0.3em] italic">{label}</p>
            </div>
        </div>
    </div>
);

const FilterButton = ({ active, onClick, label }: any) => (
    <button
        onClick={onClick}
        className={clsx(
            "px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-[1.5rem] transition-all whitespace-nowrap",
            active ? "bg-indigo-600 text-white shadow-xl shadow-indigo-900/40" : "text-white/20 hover:text-white/40"
        )}
    >
        {label}
    </button>
);

export default EnquiryTab;
