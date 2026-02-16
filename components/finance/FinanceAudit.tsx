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

    // Fetch Logic
    const fetchData = async () => {
        setLoading(true);
        try {
            const bid = (branchId === null || branchId === undefined) ? null : branchId;
            const [logsRes, statsRes] = await Promise.all([
                supabase.rpc('get_forensic_audit_logs', {
                    p_branch_id: typeof bid === 'string' ? bid : null,
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
        if (filter === 'MUTATIONS') return ['MANUAL_ADJUSTMENT', 'FEE_WAIVER', 'STRUCTURE_CHANGE'].includes(log.action);
        if (filter === 'LOGINS') return log.action.includes('LOGIN') || log.action.includes('ACCESS');
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

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return 'bg-red-500 text-white shadow-red-500/20';
            case 'HIGH': return 'bg-orange-500 text-white shadow-orange-500/20';
            case 'MEDIUM': return 'bg-amber-500 text-black shadow-amber-500/20';
            default: return 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
        }
    };

    const getStatusBorder = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return 'border-l-red-500';
            case 'HIGH': return 'border-l-orange-500';
            case 'MEDIUM': return 'border-l-amber-500';
            default: return 'border-l-emerald-500';
        }
    };

    if (loading && !logs.length) return (
        <div className="py-60 flex flex-col items-center justify-center space-y-12">
            <Spinner size="lg" className="text-primary" />
            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] animate-pulse">Synchronizing Forensic Nodes...</p>
        </div>
    );

    return (
        <div className="max-w-[1920px] mx-auto pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* 1️⃣ Header Section */}
            <header className="mb-10 border-b border-white/5 pb-8">
                <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-white/30 uppercase tracking-widest">
                            <span>Finance Center</span>
                            <span className="text-white/10">/</span>
                            <span className="text-white">Audit Logs</span>
                        </div>
                        <div>
                            <h1 className="text-4xl font-serif text-white tracking-tight mb-2">Financial Audit</h1>
                            <p className="text-white/40 text-sm max-w-2xl leading-relaxed">
                                Automated financial oversight, event logging, and compliance tracking.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex bg-[#0c0d12] p-1 rounded-xl border border-white/10">
                            {['ALL', 'CRITICAL', 'MUTATIONS'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setFilter(t)}
                                    className={`px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filter === t
                                            ? 'bg-white text-black shadow-lg'
                                            : 'text-white/30 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={handleExport}
                            className="px-6 py-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-white/60 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-3"
                        >
                            <DownloadIcon className="w-3.5 h-3.5" />
                            <span>Export</span>
                        </button>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">

                {/* 2️⃣ Main Audit Ledger (9 Cols) */}
                <div className="xl:col-span-9 space-y-6">
                    {/* Sticky Filter Bar */}
                    <div className="sticky top-4 z-30 bg-[#0F1117]/80 backdrop-blur-xl border border-white/10 rounded-xl p-3 flex gap-4 items-center shadow-2xl">
                        <div className="relative flex-grow">
                            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <input
                                type="text"
                                placeholder="Search by description, action, or user ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-[#0c0d12] border border-white/5 rounded-lg pl-11 pr-4 py-3 text-xs font-medium text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all"
                            />
                        </div>
                        <button onClick={() => fetchData()} className="p-3 hover:bg-white/5 rounded-lg border border-transparent hover:border-white/10 transition-all group">
                            <SyncIcon className="w-4 h-4 text-white/30 group-hover:text-white transition-colors" />
                        </button>
                    </div>

                    {/* Ledger Table */}
                    <div className="border border-white/10 rounded-2xl overflow-hidden bg-[#0c0d12] shadow-2xl">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/5 bg-white/[0.01] text-[10px] font-black text-white/30 uppercase tracking-[0.15em]">
                            <div className="col-span-3 lg:col-span-2">Timestamp</div>
                            <div className="col-span-3 lg:col-span-2">Operator</div>
                            <div className="col-span-2 lg:col-span-2">Action</div>
                            <div className="col-span-4 lg:col-span-4">Description</div>
                            <div className="hidden lg:block lg:col-span-1">Severity</div>
                            <div className="hidden lg:block lg:col-span-1 text-right"></div>
                        </div>

                        {/* Rows */}
                        <div className="divide-y divide-white/[0.02]">
                            {filteredLogs.length > 0 ? filteredLogs.map((log) => (
                                <motion.div
                                    key={log.id}
                                    layoutId={log.id}
                                    onClick={() => setExpandedRowId(expandedRowId === log.id ? null : log.id)}
                                    className={`group relative transition-colors cursor-pointer ${expandedRowId === log.id ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'
                                        }`}
                                >
                                    {/* Status Line */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${getStatusBorder(log.severity)}`} />

                                    <div className="grid grid-cols-12 gap-4 px-6 py-5 items-center relative z-10">
                                        <div className="col-span-3 lg:col-span-2 flex flex-col justify-center">
                                            <span className="text-xs font-mono text-white/70 font-medium">
                                                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <span className="text-[10px] text-white/20 uppercase tracking-widest mt-1">
                                                {new Date(log.created_at).toLocaleDateString()}
                                            </span>
                                        </div>

                                        <div className="col-span-3 lg:col-span-2 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/10 to-transparent border border-white/5 flex items-center justify-center text-[10px] font-black text-white/40">
                                                {log.performed_by_name.charAt(0)}
                                            </div>
                                            <div className="flex flex-col truncate">
                                                <span className="text-xs font-bold text-white/80 truncate">{log.performed_by_name}</span>
                                                <span className="text-[9px] text-white/30 uppercase tracking-wider truncate">ID: {log.performed_by_name === 'SYSTEM_CORE' ? 'SYS' : 'USR'}</span>
                                            </div>
                                        </div>

                                        <div className="col-span-2 lg:col-span-2">
                                            <span className="inline-block px-3 py-1 bg-white/5 border border-white/10 rounded-md text-[9px] font-black text-white/60 uppercase tracking-wider">
                                                {log.action}
                                            </span>
                                        </div>

                                        <div className="col-span-4 lg:col-span-4 pr-4">
                                            <p className="text-sm text-white/70 font-medium truncate group-hover:text-white transition-colors">{log.description}</p>
                                        </div>

                                        <div className="hidden lg:block lg:col-span-1">
                                            <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${log.severity === 'HIGH' || log.severity === 'CRITICAL' ? 'text-red-500 bg-red-500/10' :
                                                    log.severity === 'MEDIUM' ? 'text-amber-500 bg-amber-500/10' : 'text-emerald-500 bg-emerald-500/10'}
                                            `}>
                                                {log.severity}
                                            </span>
                                        </div>

                                        <div className="hidden lg:flex lg:col-span-1 justify-end">
                                            <ChevronDownIcon className={`w-4 h-4 text-white/20 transition-transform duration-300 ${expandedRowId === log.id ? 'rotate-180' : ''}`} />
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    <AnimatePresence>
                                        {expandedRowId === log.id && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden bg-[#0a0b10] border-t border-white/5"
                                            >
                                                <div className="px-6 py-6 grid grid-cols-2 gap-8 text-xs">
                                                    <div>
                                                        <h4 className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-3">Event Metadata</h4>
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between py-2 border-b border-white/5">
                                                                <span className="text-white/40">Entity ID</span>
                                                                <span className="font-mono text-white/60">{log.entity_id}</span>
                                                            </div>
                                                            <div className="flex justify-between py-2 border-b border-white/5">
                                                                <span className="text-white/40">Entity Type</span>
                                                                <span className="font-mono text-white/60">{log.entity_type}</span>
                                                            </div>
                                                            <div className="flex justify-between py-2 border-b border-white/5">
                                                                <span className="text-white/40">Module Context</span>
                                                                <span className="font-mono text-white/60">{log.module}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-3">Data Mutation</h4>
                                                        {log.old_value || log.new_value ? (
                                                            <div className="font-mono bg-black/40 p-4 rounded-lg border border-white/5 text-white/50 text-[10px] overflow-x-auto">
                                                                {log.old_value && <div className="mb-2"><span className="text-red-400">- PREV:</span> {JSON.stringify(log.old_value)}</div>}
                                                                {log.new_value && <div><span className="text-emerald-400">+ NEW:</span> {JSON.stringify(log.new_value)}</div>}
                                                            </div>
                                                        ) : (
                                                            <div className="text-white/20 italic p-4">No payload data captured with this event.</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            )) : (
                                <div className="py-32 flex flex-col items-center justify-center opacity-40">
                                    <div className="p-6 bg-white/5 rounded-full mb-4">
                                        <SearchIcon className="w-8 h-8 text-white/40" />
                                    </div>
                                    <h3 className="text-white font-bold text-lg mb-1">No Audit Records Found</h3>
                                    <p className="text-sm text-white/40">Adjust your filters or try a different search term.</p>
                                    <button onClick={() => { setFilter('ALL'); setSearchTerm(''); }} className="mt-6 text-xs font-black uppercase text-primary tracking-widest hover:underline">Clear Filters</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3️⃣ Oversight Analytics Panel (3 Cols) */}
                <div className="xl:col-span-3 space-y-6">
                    {/* Health Score Card */}
                    <div className="bg-[#0c0d12] border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform">
                            <ShieldCheckIcon className="w-24 h-24 text-emerald-500" />
                        </div>
                        <h3 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-4">Audit Health Score</h3>
                        <div className="flex items-end gap-3 mb-2">
                            <span className="text-5xl font-serif font-black text-emerald-400 tracking-tight">{stats?.integrity_index || '1.000'}</span>
                            <span className="text-xs font-bold text-emerald-500/60 mb-2">STABLE</span>
                        </div>
                        <p className="text-xs text-white/40 leading-relaxed">System operating within normal governance parameters. No critical drifts detected.</p>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#0c0d12] border border-white/10 rounded-xl p-4">
                            <h4 className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2">Anomalies</h4>
                            <span className={`text-2xl font-bold ${stats?.anomalies_detected > 0 ? 'text-amber-500' : 'text-white'}`}>
                                {String(stats?.anomalies_detected || '00').padStart(2, '0')}
                            </span>
                        </div>
                        <div className="bg-[#0c0d12] border border-white/10 rounded-xl p-4">
                            <h4 className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-2">Adjustments</h4>
                            <span className="text-2xl font-bold text-blue-400">
                                {String(stats?.recent_adjustments || '00').padStart(2, '0')}
                            </span>
                        </div>
                    </div>

                    {/* Critical Alert Card */}
                    <div className="bg-[#0c0d12] border border-red-500/20 rounded-2xl p-6 relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest">Critical Alert Vector</h3>
                        </div>
                        <p className="text-xs font-medium text-white/60 mb-6 leading-relaxed">
                            {stats?.anomalies_detected > 0
                                ? `${stats.anomalies_detected} Anomalies detected in student ledger integrity. Immediate forensic tracing recommended.`
                                : "No critical vectors currently active. System operating within normal governance parameters."}
                        </p>
                        <button
                            onClick={() => setFilter('CRITICAL')}
                            className={`w-full py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${stats?.anomalies_detected > 0
                                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20'
                                    : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
                                }`}
                            disabled={!stats?.anomalies_detected}
                        >
                            Engage Investigation
                        </button>
                    </div>

                    {/* Support Link */}
                    <div className="text-center pt-4">
                        <button className="text-[10px] font-bold text-white/20 hover:text-white/40 uppercase tracking-widest transition-colors flex items-center justify-center gap-2 mx-auto">
                            <ActivityIcon className="w-3 h-3" /> System Status: Online
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinanceAudit;
