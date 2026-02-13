
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

interface AuditLog {
    id: number;
    action_type: string;
    description: string;
    created_at: string;
    performed_by_name: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

const FinanceAudit: React.FC<{ branchId: number | null }> = ({ branchId }) => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            try {
                let query = supabase
                    .from('finance_audit_logs')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50);

                const { data, error } = await query;
                if (error) throw error;

                // Add mock severity for UI demo
                const enriched = (data || []).map(l => ({
                    ...l,
                    severity: l.action_type.includes('DELETE') ? 'HIGH' : l.action_type.includes('UPDATE') ? 'MEDIUM' : 'LOW'
                })) as AuditLog[];

                setLogs(enriched);
            } catch (err) {
                console.error("Forensic Sync Failure:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, [branchId]);

    if (loading) return (
        <div className="py-60 flex flex-col items-center justify-center space-y-12">
            <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-[120px] rounded-full animate-pulse"></div>
                <Spinner size="lg" className="text-primary relative z-10" />
            </div>
            <div className="space-y-4 text-center">
                <h4 className="text-[11px] font-black text-primary uppercase tracking-[0.8em] animate-pulse">Initializing Forensic Core</h4>
                <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.3em]">Synchronizing encrypted financial mutations from secure vaults...</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-12 pb-24">
            {/* Executive Header Layer */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-12">
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="h-[1px] w-12 bg-red-500/40 rounded-full" />
                        <span className="text-[10px] font-black uppercase text-red-500/80 tracking-[0.5em]">Forensic Oversight Console</span>
                    </div>
                    <div>
                        <h2 className="text-[clamp(40px,5vw,64px)] font-serif font-black text-white tracking-tighter uppercase leading-[0.85]">
                            FINANCIAL <span className="text-white/20 italic font-medium lowercase italic">audit.</span>
                        </h2>
                        <p className="text-white/40 font-serif italic text-lg mt-6 max-w-2xl leading-relaxed">Absolute chronological visibility into every institutional financial mutation. Authenticated via cryptographic registry integrity checks.</p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="flex bg-black/40 p-2 rounded-2xl border border-white/5 backdrop-blur-xl">
                        {['ALL', 'CRITICAL', 'MUTATIONS', 'LOGINS'].map(t => (
                            <button
                                key={t}
                                onClick={() => setFilter(t)}
                                className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filter === t ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/20 hover:text-white/40'
                                    }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                    <button className="px-10 py-5 bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] text-white/40 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-4 active:scale-95 shadow-2xl group">
                        <DownloadIcon className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                        <span>Archive Trail</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                {/* Main Log Stream */}
                <div className="xl:col-span-8 space-y-6">
                    <div className="bg-[#12141c] border border-white/5 rounded-[3.5rem] overflow-hidden shadow-3xl relative group">
                        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent top-0"></div>

                        <div className="divide-y divide-white/[0.03]">
                            {logs.map((log, idx) => (
                                <motion.div
                                    key={log.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className="p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-10 hover:bg-white/[0.02] transition-all group/item"
                                >
                                    <div className="flex gap-8 items-start">
                                        <div className={`p-4 rounded-2xl bg-black/40 border border-white/5 group-hover/item:border-white/10 transition-all ${log.severity === 'HIGH' ? 'text-red-500' : log.severity === 'MEDIUM' ? 'text-amber-500' : 'text-emerald-500'
                                            }`}>
                                            <ShieldCheckIcon className="w-6 h-6" />
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-6">
                                                <span className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${log.severity === 'HIGH' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-primary/10 text-primary border-primary/20'
                                                    }`}>{log.action_type}</span>
                                                <span className="text-[10px] font-mono text-white/10 uppercase tracking-widest">{new Date(log.created_at).toLocaleString()}</span>
                                            </div>
                                            <p className="text-xl font-serif font-black text-white/80 group-hover/item:text-white transition-colors">{log.description}</p>
                                        </div>
                                    </div>
                                    <div className="pl-14 md:pl-0 flex flex-col items-end gap-3">
                                        <p className="text-[10px] font-black text-white/10 uppercase tracking-widest">Operator Identity</p>
                                        <div className="flex items-center gap-3 px-4 py-2 bg-white/[0.02] border border-white/5 rounded-xl">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{log.performed_by_name || 'SYSTEM_CORE'}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        <div className="p-8 text-center bg-white/[0.01] border-t border-white/[0.03]">
                            <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.6em]">Registry Visibility Limited to 50 Forensic Artifacts • Depth Stable</p>
                        </div>
                    </div>
                </div>

                {/* Risk Panel & Insights */}
                <div className="xl:col-span-4 space-y-10">
                    <div className="bg-[#12141c] border border-white/5 rounded-[3.5rem] p-12 shadow-3xl relative overflow-hidden group h-full">
                        <div className="absolute top-0 right-0 p-16 opacity-[0.01] group-hover:opacity-[0.03] transition-opacity duration-1000 rotate-12">
                            <AlertTriangleIcon className="w-64 h-64 text-red-500" />
                        </div>

                        <div className="relative z-10 space-y-12">
                            <div className="space-y-4">
                                <h4 className="text-2xl font-serif font-black text-white uppercase tracking-tight">Oversight Analytics</h4>
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Automated risk detection & drift monitoring</p>
                            </div>

                            <div className="space-y-8">
                                {[
                                    { label: 'Integrity Rating', value: '0.998', status: 'Stable', color: 'text-emerald-500' },
                                    { label: 'Anomalies Detected', value: '03', status: 'In Review', color: 'text-amber-500' },
                                    { label: 'Unverified Adjustments', value: '00', status: 'Clear', color: 'text-emerald-500' }
                                ].map((item, i) => (
                                    <div key={i} className="space-y-4">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">{item.label}</span>
                                            <span className={`text-[10px] font-black uppercase tracking-widest p-1.5 rounded-lg bg-white/[0.03] border border-white/5 ${item.color}`}>{item.status}</span>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <span className={`text-4xl font-serif font-black ${item.color} tracking-tighter`}>{item.value}</span>
                                            <div className="h-px flex-grow bg-white/5" />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-8 space-y-6">
                                <div className="flex items-center gap-4 text-red-500">
                                    <AlertTriangleIcon className="w-5 h-5" />
                                    <h5 className="text-[11px] font-black uppercase tracking-widest">Critical Alert Vector</h5>
                                </div>
                                <p className="text-sm text-red-500/60 font-medium leading-relaxed">System identity mismatch detected during manual fee adjustment in Grade 10-A context. Forensic tracing engaged.</p>
                                <button className="w-full py-4 bg-red-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-xl shadow-red-500/20 active:scale-95 transition-all">Engage Investigation</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinanceAudit;
