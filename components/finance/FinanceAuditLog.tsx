import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import Spinner from '../common/Spinner';
import { motion } from 'framer-motion';

interface AuditLog {
    id: number;
    action_type: string;
    description: string;
    created_at: string;
    performed_by_name: string;
    entity_id?: string;
    entity_type?: string;
}

const FinanceAuditLog: React.FC<{ branchId: number | null }> = ({ branchId }) => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);

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
                setLogs(data || []);
            } catch (err) {
                console.error("Audit Sync Error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, [branchId]);

    if (loading) return (
        <div className="py-48 flex flex-col items-center justify-center space-y-12">
            <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full animate-pulse"></div>
                <Spinner size="lg" className="text-primary relative z-10" />
            </div>
            <div className="space-y-4 text-center">
                <h4 className="text-[11px] font-black text-primary/40 uppercase tracking-[0.6em] animate-pulse">Decrypting Audit Trail</h4>
                <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.2em]">Synchronizing forensic artifacts from secure storage...</p>
            </div>
        </div>
    );

    if (logs.length === 0) return (
        <div className="py-48 text-center flex flex-col items-center gap-10 opacity-40 group">
            <div className="relative">
                <div className="absolute inset-0 bg-white/5 blur-[80px] rounded-full group-hover:bg-white/10 transition-all duration-1000"></div>
                <ShieldCheckIcon className="w-24 h-24 text-white/5 relative z-10 group-hover:scale-110 transition-transform duration-700" />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.5em] text-white/20">No Forensic Artifacts Detected in the Registry</p>
        </div>
    );

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-1000 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 px-8">
                <div className="space-y-2 text-center md:text-left">
                    <h3 className="text-4xl font-serif font-black text-white uppercase tracking-tighter leading-none">The Forensic Trail</h3>
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Chronological record of all institutional financial mutations</p>
                </div>
                <div className="flex items-center gap-4 px-8 py-4 bg-white/[0.02] border border-white/5 rounded-2xl shadow-inner group">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                    <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40 group-hover:text-white transition-colors">Historical Registry Integrity Verified</span>
                </div>
            </div>

            <div className="bg-white/[0.01] border border-white/5 rounded-[4rem] overflow-hidden shadow-3xl relative group backdrop-blur-3xl">
                <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent top-0 shadow-[0_0_20px_rgba(59,130,246,0.3)]"></div>
                <div className="divide-y divide-white/[0.04]">
                    {logs.map((log, idx) => (
                        <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: (idx % 10) * 0.05, duration: 0.5 }}
                            className="p-10 md:p-14 flex flex-col md:flex-row md:items-center justify-between gap-10 hover:bg-white/[0.03] transition-all duration-500 group/item relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.01] to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity"></div>
                            <div className="flex items-start gap-10 relative z-10">
                                <div className="p-5 rounded-[1.8rem] bg-black/40 border border-white/5 text-white/10 group-hover/item:text-primary group-hover/item:border-primary/30 group-hover/item:shadow-[0_0_30px_rgba(59,130,246,0.15)] transition-all duration-500 shadow-inner group-hover/item:scale-110">
                                    <ShieldCheckIcon className="w-8 h-8" />
                                </div>
                                <div className="space-y-4">
                                    <div className="flex flex-wrap items-center gap-6">
                                        <span className="px-5 py-2 bg-primary/10 border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-[0.4em] text-primary shadow-2xl">{log.action_type}</span>
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-white/10 group-hover/item:bg-primary/40 transition-colors"></div>
                                            <span className="text-[11px] font-mono text-white/20 uppercase tracking-[0.2em] group-hover/item:text-white/40 transition-colors">{new Date(log.created_at).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <p className="text-xl text-white/80 font-serif font-black italic tracking-tight leading-relaxed group-hover/item:text-white transition-colors">
                                        {log.description}
                                    </p>
                                </div>
                            </div>
                            <div className="pl-24 md:pl-0 text-right relative z-10">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase text-white/10 tracking-[0.5em] group-hover/item:text-white/20 transition-colors">Forensic Source Node</p>
                                    <div className="inline-flex items-center gap-4 px-6 py-2.5 bg-black/40 border border-white/5 rounded-xl group-hover/item:border-white/10 transition-all">
                                        <div className="w-2 h-2 rounded-full bg-white/10 group-hover/item:bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0)] group-hover/item:shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all"></div>
                                        <p className="text-xs font-black text-white/40 group-hover/item:text-white/80 transition-colors uppercase tracking-[0.2em]">{log.performed_by_name || 'SYSTEM_CORE_NODE'}</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
                <div className="p-10 bg-white/[0.01] border-t border-white/[0.04] text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.6em] text-white/10 hover:text-white/20 transition-colors cursor-default">Maximum depth of 50 artifacts reached • Authentication protocol stable</p>
                </div>
            </div>
        </div>
    );
};

export default FinanceAuditLog;
