import React from 'react';
import { motion } from 'framer-motion';
import { ActivityIcon } from '../icons/ActivityIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { UserIcon } from '../icons/UserIcon';

interface AuditLogEntry {
    id: string;
    action: string;
    actor: string;
    role: string;
    timestamp: string;
    status: 'authorized' | 'flagged' | 'archived';
    hash: string;
}

const mockLogs: AuditLogEntry[] = [
    { id: '1', action: 'PERSONAL_DATA_MUTATION', actor: 'Admin_Sarah', role: 'HR_MASTER', timestamp: '2026-02-12 14:20', status: 'authorized', hash: '8f2e..9a1b' },
    { id: '2', action: 'DOCUMENT_VAULT_ACCESS', actor: 'Principal_John', role: 'GOVERNOR', timestamp: '2026-02-12 11:05', status: 'authorized', hash: '4c1d..2e8f' },
    { id: '3', action: 'UNAUTHORIZED_LOGIN_ATTEMPT', actor: 'REMOTE_NODE', role: 'EXT_SYS', timestamp: '2026-02-11 23:45', status: 'flagged', hash: '1a2b..3c4d' },
    { id: '4', action: 'CONTRACT_STATUS_REVOKED', actor: 'SYSTEM_DAEMON', role: 'SYS_ADMIN', timestamp: '2026-02-10 09:00', status: 'archived', hash: 'd9e8..f7a6' },
];

const AuditLogRegistry: React.FC = () => {
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center px-4 mb-2">
                <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em]">Historical Ledger [SHA-256]</h3>
                <div className="flex gap-4">
                    <span className="text-[9px] font-bold text-white/10 uppercase tracking-widest flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Authorized</span>
                    <span className="text-[9px] font-bold text-white/10 uppercase tracking-widest flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-red-500" /> Flagged</span>
                </div>
            </div>

            <div className="bg-[#14161c] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-sm">
                <div className="divide-y divide-white/[0.03]">
                    {mockLogs.map((log, idx) => (
                        <motion.div
                            key={log.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className="p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6 group hover:bg-white/[0.01] transition-all"
                        >
                            <div className="shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-white/5 border border-white/5 group-hover:bg-white/10 transition-colors">
                                {log.status === 'flagged' ? (
                                    <ShieldCheckIcon className="w-5 h-5 text-red-500" />
                                ) : (
                                    <ActivityIcon className="w-5 h-5 text-primary/40" />
                                )}
                            </div>

                            <div className="flex-grow space-y-2">
                                <div className="flex items-center gap-3">
                                    <p className="text-[11px] font-black text-white uppercase tracking-wider">{log.action}</p>
                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${log.status === 'authorized' ? 'text-emerald-500 bg-emerald-500/10' : log.status === 'flagged' ? 'text-red-500 bg-red-500/10' : 'text-white/20 bg-white/5'} tracking-[0.2em]`}>{log.status}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 text-[9px] font-medium text-white/30 uppercase tracking-widest">
                                        <UserIcon className="w-3 h-3" />
                                        <span>{log.actor} <span className="text-white/10 font-black">[{log.role}]</span></span>
                                    </div>
                                    <div className="w-1 h-1 rounded-full bg-white/5" />
                                    <span className="text-[9px] font-medium text-white/20 uppercase tracking-widest">{log.timestamp}</span>
                                </div>
                            </div>

                            <div className="shrink-0 text-right">
                                <p className="text-[9px] font-mono text-white/10 group-hover:text-primary/40 transition-colors uppercase tracking-widest">Sig_Hash: {log.hash}</p>
                                <button className="mt-2 text-[10px] font-black text-white/20 hover:text-white uppercase tracking-[0.2em] transition-colors">Verify Chain</button>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <div className="p-6 bg-white/[0.01] text-center border-t border-white/[0.03]">
                    <button className="text-[10px] font-black text-primary/40 uppercase tracking-[0.4em] hover:text-primary transition-colors">Deep Archives Access Needed</button>
                </div>
            </div>
        </div>
    );
};

export default AuditLogRegistry;
