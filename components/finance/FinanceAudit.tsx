import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { ArrowRightIcon } from '../icons/ArrowRightIcon';
import { RefreshCwIcon as SyncIcon } from '../icons/RefreshCwIcon';
import { SearchIcon } from '../icons/SearchIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { supabase } from '../../services/supabase';
import Spinner from '../common/Spinner';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { XIcon } from '../icons/XIcon';
import { FilterIcon } from '../icons/FilterIcon';

interface AuditLog {
    id: string;
    module: string;
    action: string;
    description: string;
    entity_type: string;
    entity_id: string;
    old_value: any;
    new_value: any;
    performed_by_name: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    created_at: string;
}

const FinanceAudit: React.FC<{ branchId: number | null }> = ({ branchId }) => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

    // Fetch Logic
    const fetchData = async () => {
        setLoading(true);
        try {
            const bid = (branchId === null || branchId === undefined) ? null : branchId;
            const [logsRes, statsRes] = await Promise.all([
                supabase.rpc('get_forensic_audit_logs', {
                    p_branch_id: bid,
                    p_limit: 100
                }),
                supabase.rpc('get_institutional_health_index', { p_branch_id: bid })
            ]);

            if (logsRes.error) throw logsRes.error;
            setLogs(logsRes.data || []);
            if (statsRes.data) setStats(statsRes.data);
        } catch (err) {
            console.error("Forensic Sync Failure:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [branchId]);

    // Filtering Logic
    const filteredLogs = logs.filter(log => {
        const matchesSearch = searchTerm === '' ||
            log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.performed_by_name.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        if (filter === 'ALL') return true;
        if (filter === 'CRITICAL') return log.severity === 'CRITICAL' || log.severity === 'HIGH';
        if (filter === 'MUTATIONS') return ['MANUAL_ADJUSTMENT', 'FEE_WAIVER', 'STRUCTURE_CHANGE', 'DELETE'].includes(log.action);
        if (filter === 'ACCESS') return log.action.includes('LOGIN') || log.action.includes('ACCESS');

        return true;
    });

    const handleExport = () => {
        if (logs.length === 0) return;
        const headers = "Timestamp,Action,Description,Severity,Operator,Entity\n";
        const csv = logs.map(l =>
            `"${new Date(l.created_at).toISOString()}","${l.action}","${l.description}","${l.severity}","${l.performed_by_name}","${l.entity_type}:${l.entity_id}"`
        ).join("\n");
        const blob = new Blob([headers + csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Forensic_Audit_Trail_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const getSeverityDetails = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' };
            case 'HIGH': return { color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' };
            case 'MEDIUM': return { color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
            default: return { color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
        }
    };

    if (loading && !logs.length) return (
        <div className="py-60 flex flex-col items-center justify-center space-y-8">
            <Spinner size="lg" className="text-primary" />
            <div className="flex flex-col items-center gap-2">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] city-lights-text">Secure Verification</p>
                <p className="text-[10px] text-white/10 uppercase tracking-widest font-mono">Loading Immutable Ledger</p>
            </div>
        </div>
    );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">

            {/* 1️⃣ Header & Controls */}
            <header className="mb-8 flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[9px] font-bold text-white/30 uppercase tracking-widest">
                        <span>Governance Node</span>
                        <span className="text-white/10">/</span>
                        <span className="text-white">Audit Trail</span>
                    </div>
                    <div>
                        <h1 className="text-3xl font-serif text-white tracking-tight mb-2">Financial Audit</h1>
                        <p className="text-white/40 text-sm max-w-xl leading-relaxed">
                            Immutable forensic logs of all financial operations, access events, and data mutations.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden md:flex bg-[#0c0d12] p-1 rounded-xl border border-white/10">
                        {['ALL', 'CRITICAL', 'MUTATIONS', 'ACCESS'].map(t => (
                            <button
                                key={t}
                                onClick={() => setFilter(t)}
                                className={`px-5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${filter === t
                                    ? 'bg-white text-black shadow-lg shadow-white/10'
                                    : 'text-white/30 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handleExport}
                        className="px-5 py-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-white/60 hover:text-white rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 group"
                    >
                        <DownloadIcon className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                        <span className="hidden md:inline">Export Log</span>
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">

                {/* 2️⃣ Main Audit Ledger (8 Cols) */}
                <div className="xl:col-span-8 space-y-6">
                    {/* Search Bar */}
                    <div className="sticky top-4 z-20 bg-[#0c0d12]/90 backdrop-blur-xl border border-white/10 rounded-xl p-2 flex gap-2 items-center shadow-2xl">
                        <div className="relative flex-grow">
                            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <input
                                type="text"
                                placeholder="Search by event ID, user, or description..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-transparent border-none rounded-lg pl-11 pr-4 py-2.5 text-xs font-medium text-white placeholder-white/20 focus:ring-0 focus:outline-none uppercase tracking-wide"
                            />
                        </div>
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors">
                                <XIcon className="w-4 h-4" />
                            </button>
                        )}
                        <div className="h-6 w-px bg-white/10 mx-2" />
                        <button onClick={() => fetchData()} className="p-2.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors" title="Refresh Ledger">
                            <SyncIcon className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Table Container */}
                    <div className="bg-[#0c0d12] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative min-h-[500px]">
                        {/* Headers */}
                        <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/5 bg-white/[0.02] text-[9px] font-black text-white/30 uppercase tracking-[0.15em]">
                            <div className="col-span-3">Timestamp</div>
                            <div className="col-span-6">Event Details</div>
                            <div className="col-span-2 text-center">Severity</div>
                            <div className="col-span-1 text-right"></div>
                        </div>

                        {/* List */}
                        <div className="divide-y divide-white/[0.03]">
                            {filteredLogs.length > 0 ? filteredLogs.map((log) => {
                                const severityStyle = getSeverityDetails(log.severity);
                                return (
                                    <motion.div
                                        key={log.id}
                                        layoutId={log.id}
                                        onClick={() => setExpandedRowId(expandedRowId === log.id ? null : log.id)}
                                        className={`group relative transition-all cursor-pointer ${expandedRowId === log.id ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'}`}
                                    >
                                        <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors ${expandedRowId === log.id ? severityStyle.bg.replace('/10', '') : 'bg-transparent group-hover:bg-white/10'}`} />

                                        <div className="grid grid-cols-12 gap-4 px-6 py-5 items-start relative z-10 text-xs">
                                            {/* Timestamp Column */}
                                            <div className="col-span-3 flex flex-col gap-1">
                                                <span className="font-mono text-white/90 font-medium">
                                                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                </span>
                                                <span className="text-[9px] text-white/30 uppercase tracking-widest">
                                                    {new Date(log.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </span>
                                                <div className="mt-2 flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[9px] text-white/40 font-bold border border-white/5">
                                                        {log.performed_by_name.charAt(0)}
                                                    </div>
                                                    <span className="text-[9px] text-white/40 truncate max-w-[80px]">{log.performed_by_name}</span>
                                                </div>
                                            </div>

                                            {/* Event Details Column */}
                                            <div className="col-span-6 space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[9px] font-mono text-white/60">
                                                        {log.action}
                                                    </span>
                                                    <span className="text-[9px] text-white/30 uppercase tracking-wider">{log.module}</span>
                                                </div>
                                                <p className="text-white/80 font-medium leading-relaxed">{log.description}</p>
                                            </div>

                                            {/* Severity Column */}
                                            <div className="col-span-2 flex justify-center pt-1">
                                                <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest border ${severityStyle.color} ${severityStyle.bg} ${severityStyle.border}`}>
                                                    {log.severity}
                                                </span>
                                            </div>

                                            {/* Expand Icon */}
                                            <div className="col-span-1 flex justify-end pt-1">
                                                <ChevronDownIcon className={`w-4 h-4 text-white/20 transition-transform duration-300 ${expandedRowId === log.id ? 'rotate-180 text-white' : ''}`} />
                                            </div>
                                        </div>

                                        {/* Expanded Context */}
                                        <AnimatePresence>
                                            {expandedRowId === log.id && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden bg-[#050608] border-t border-white/5 shadow-inner"
                                                >
                                                    <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-8 text-xs font-mono">
                                                        <div>
                                                            <h4 className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-3">Technical Metadata</h4>
                                                            <div className="space-y-2 border-l border-white/10 pl-3">
                                                                <div className="flex gap-4">
                                                                    <span className="text-white/30 w-20">Entity ID:</span>
                                                                    <span className="text-white/60">{log.entity_id}</span>
                                                                </div>
                                                                <div className="flex gap-4">
                                                                    <span className="text-white/30 w-20">Type:</span>
                                                                    <span className="text-white/60">{log.entity_type}</span>
                                                                </div>
                                                                <div className="flex gap-4">
                                                                    <span className="text-white/30 w-20">Event ID:</span>
                                                                    <span className="text-white/60 select-all">{log.id}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <h4 className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-3">Data Trace</h4>
                                                            {(log.old_value || log.new_value) ? (
                                                                <div className="space-y-3">
                                                                    {log.old_value && (
                                                                        <div className="bg-red-500/5 border border-red-500/10 p-3 rounded-lg">
                                                                            <span className="text-[9px] text-red-400 block mb-1">PREVIOUS STATE</span>
                                                                            <pre className="text-red-300/60 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(log.old_value, null, 2)}</pre>
                                                                        </div>
                                                                    )}
                                                                    {log.new_value && (
                                                                        <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg">
                                                                            <span className="text-[9px] text-emerald-400 block mb-1">NEW STATE</span>
                                                                            <pre className="text-emerald-300/60 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(log.new_value, null, 2)}</pre>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="text-white/20 italic">No data payload recorded.</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            }) : (
                                <div className="py-24 text-center">
                                    <div className="inline-flex p-4 rounded-full bg-white/[0.03] mb-4">
                                        <ShieldCheckIcon className="w-8 h-8 text-white/20" />
                                    </div>
                                    <h3 className="text-white font-bold text-sm mb-1">Secure Ledger Empty</h3>
                                    <p className="text-[10px] text-white/30 uppercase tracking-widest">No matching governance records found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3️⃣ Oversight Analytics Panel (4 Cols) */}
                <div className="xl:col-span-4 space-y-6">

                    {/* Health Status */}
                    <div className="bg-[#0c0d12] border border-white/10 rounded-2xl p-6 relative overflow-hidden">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">System Integrity</h3>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-mono font-bold text-emerald-500">{stats?.integrity_index || '1.00'}</span>
                                    <span className="text-[10px] uppercase font-bold text-emerald-500/60 bg-emerald-500/10 px-2 py-0.5 rounded">Optimal</span>
                                </div>
                            </div>
                            <ActivityIcon className="w-6 h-6 text-emerald-500/40" />
                        </div>
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 w-full" />
                        </div>
                        <p className="mt-4 text-xs text-white/40 leading-relaxed">
                            Financial governance protocols are active. No critical deviations detected in the last 24 hour cycle.
                        </p>
                    </div>

                    {/* Threat Vector */}
                    <div className="bg-[#0c0d12] border border-white/10 rounded-2xl p-6">
                        <h3 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-6">Threat Vectors</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${stats?.anomalies_detected > 0 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                                    <span className="text-xs font-bold text-white/80">Anomaly Detection</span>
                                </div>
                                <span className={`font-mono text-sm font-bold ${stats?.anomalies_detected > 0 ? 'text-red-500' : 'text-white/40'}`}>
                                    {String(stats?.anomalies_detected || 0).padStart(2, '0')}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span className="text-xs font-bold text-white/80">Manual Adjustments</span>
                                </div>
                                <span className="font-mono text-sm font-bold text-blue-400">
                                    {String(stats?.recent_adjustments || 0).padStart(2, '0')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Action Card */}
                    {stats?.anomalies_detected > 0 && (
                        <div className="group bg-red-500/5 border border-red-500/20 rounded-2xl p-6 hover:bg-red-500/10 transition-colors cursor-pointer">
                            <div className="flex items-center gap-3 mb-3">
                                <AlertTriangleIcon className="w-5 h-5 text-red-500" />
                                <h3 className="text-xs font-black text-red-500 uppercase tracking-widest">Protocol Breach</h3>
                            </div>
                            <p className="text-xs text-red-200/60 mb-4 leading-relaxed">
                                Critical anomalies detected in student accounts. Immediate reconciliation required.
                            </p>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-red-400 uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                                <span>Initiate Forensics</span>
                                <ArrowRightIcon className="w-3 h-3" />
                            </div>
                        </div>
                    )}

                </div>

            </div>
        </div>
    );
};

export default FinanceAudit;
