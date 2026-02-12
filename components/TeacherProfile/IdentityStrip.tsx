import React from 'react';
import { motion } from 'framer-motion';
import { TeacherExtended } from '../../types';
import { RefreshCwIcon } from '../icons/RefreshCwIcon';
import { MoreVerticalIcon } from '../icons/MoreVerticalIcon';

interface IdentityStripProps {
    teacher: TeacherExtended;
}

const IdentityStrip: React.FC<IdentityStripProps> = ({ teacher }) => {
    return (
        <div className="sticky top-0 z-30 bg-[#0a0a0c]/80 backdrop-blur-xl border-b border-white/5 py-6 px-10 flex items-center justify-between group">
            <div className="flex items-center gap-8">
                <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 flex items-center justify-center shadow-2xl overflow-hidden">
                        {teacher.details?.profile_picture_url ? (
                            <img src={teacher.details.profile_picture_url} className="w-full h-full object-cover" alt={teacher.display_name} />
                        ) : (
                            <span className="text-white font-serif italic text-2xl">{teacher.display_name.charAt(0)}</span>
                        )}
                    </div>
                    <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-[#0a0a0c] ${teacher.is_active ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : 'bg-red-500 shadow-[0_0_15px_#ef4444]'}`}
                    />
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-black text-white uppercase tracking-widest leading-none">{teacher.display_name}</h2>
                        <span className="text-[10px] font-mono text-white/20 px-2 py-0.5 border border-white/5 rounded-md">REF_ID__{teacher.details?.employee_id || 'NULL'}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="px-3 py-1 bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest rounded-lg ring-1 ring-primary/20">
                            {teacher.details?.designation || 'SENIOR FACULTY'}
                        </span>
                        <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] font-serif italic">{teacher.details?.department || 'ACADEMIC_POOL'}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-10">
                <div className="hidden lg:flex flex-col items-end gap-1">
                    <span className="text-[9px] font-black text-white/10 uppercase tracking-[0.4em]">Node Sync Status</span>
                    <div className="flex items-center gap-2">
                        <RefreshCwIcon className="w-3.5 h-3.5 text-emerald-500 animate-spin-slow" />
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Live Uplink Active</span>
                    </div>
                </div>

                <div className="h-10 w-px bg-white/5" />

                <div className="flex flex-col items-end gap-1">
                    <span className="text-[9px] font-black text-white/10 uppercase tracking-[0.4em]">System Pulse</span>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} CYCLE_NODE
                    </span>
                </div>

                <button className="p-3 rounded-xl bg-white/5 text-white/20 hover:text-white hover:bg-white/10 transition-all">
                    <MoreVerticalIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default IdentityStrip;
