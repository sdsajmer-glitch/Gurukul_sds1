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
                // Fetch recent 50 logs. 
                // We might need to filter by branch if the table supports it, 
                // but for now assuming global or RLS handled.
                let query = supabase
                    .from('finance_audit_logs')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50);

                // If branch_id column exists we could filter, but let's stick to simple fetch 
                // as we don't know exact schema for branch filtering on this table 
                // (it wasn't in the types extensively).

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
        <div className="py-32 flex flex-col items-center gap-6">
            <Spinner size="lg" className="text-primary" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 animate-pulse">Decrypting Audit Trail...</p>
        </div>
    );

    if (logs.length === 0) return (
        <div className="py-32 text-center flex flex-col items-center gap-8 opacity-40">
            <ShieldCheckIcon className="w-20 h-20 text-white/20" />
            <p className="text-sm font-black uppercase tracking-[0.3em] text-white/40">No Forensic Artifacts Found</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between px-4">
                <h3 className="text-2xl font-serif font-black text-white uppercase tracking-tight">Forensic Ledger</h3>
                <span className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-white/40">Latest 50 Entries</span>
            </div>

            <div className="bg-[#0c0d12] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl ring-1 ring-white/5 relative group">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                <div className="divide-y divide-white/[0.04]">
                    {logs.map((log, idx) => (
                        <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/[0.02] transition-colors group/item"
                        >
                            <div className="flex items-start gap-6">
                                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-white/20 group-hover/item:text-primary group-hover/item:border-primary/20 transition-all shadow-inner">
                                    <ShieldCheckIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-4 mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">{log.action_type}</span>
                                        <span className="w-1 h-1 rounded-full bg-white/10"></span>
                                        <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest">{new Date(log.created_at).toLocaleString()}</span>
                                    </div>
                                    <p className="text-base text-white/70 font-medium font-serif italic leading-relaxed group-hover/item:text-white transition-colors">
                                        {log.description}
                                    </p>
                                </div>
                            </div>
                            <div className="pl-16 md:pl-0 text-right">
                                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-white/20 mb-1">Performed By</p>
                                <p className="text-xs font-bold text-white uppercase tracking-wider">{log.performed_by_name || 'SYSTEM_NODE'}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default FinanceAuditLog;
