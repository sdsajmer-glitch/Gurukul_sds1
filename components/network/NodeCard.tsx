import React from 'react';
import { motion } from 'framer-motion';
import { SchoolIcon } from '../icons/SchoolIcon';
import { LocationIcon } from '../icons/LocationIcon';
import { EditIcon } from '../icons/EditIcon';
import { XIcon } from '../icons/XIcon';
import { StatusBadge, NodeStatus } from './StatusBadge';

interface NodeCardProps {
    name: string;
    location: string;
    adminName?: string;
    isMain: boolean;
    onEdit: () => void;
    onDelete?: () => void;
}

export function NodeCard({
    name,
    location,
    adminName,
    isMain,
    onEdit,
    onDelete
}: NodeCardProps) {
    const status: NodeStatus = isMain ? 'head-office' : 'active';

    return (
        <motion.article
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="group relative bg-[#13141B] border border-white/5 rounded-3xl p-6 h-[240px] flex flex-col transition-all duration-300 hover:border-primary/40 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] cursor-pointer overflow-hidden shadow-md"
        >
            {/* Header Area */}
            <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl border transition-all duration-300 ${isMain ? 'bg-primary/10 border-primary/20 text-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]' : 'bg-white/5 border-white/10 text-white/30'}`}>
                    <SchoolIcon className="w-5 h-5" />
                </div>

                <div className="flex gap-1.5">
                    <StatusBadge status={status} />
                </div>
            </div>

            {/* Node Information */}
            <div className="space-y-1 mb-6">
                <h3 className="text-lg font-bold text-white tracking-tight leading-tight truncate uppercase italic">{name}</h3>
                <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest flex items-center gap-1.5">
                    <LocationIcon className="w-3 h-3 opacity-40 shrink-0" />
                    <span className="truncate">{location}</span>
                </p>
            </div>

            {/* Footer / Actions */}
            <div className="mt-auto flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {adminName && (
                        <div
                            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-white/40 uppercase"
                            title={adminName}
                        >
                            {adminName[0]}
                        </div>
                    )}
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-white/10 uppercase tracking-widest leading-none">Admin</span>
                        <span className="text-[10px] font-bold text-white/30 truncate max-w-[100px]">{adminName || 'Unassigned'}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        className="p-2.5 text-white/20 hover:text-white hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-white/10"
                        title="Edit Configuration"
                    >
                        <EditIcon className="w-4 h-4" />
                    </button>
                    {!isMain && onDelete && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(); }}
                            className="p-2.5 text-white/5 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/10"
                            title="Remove Branch"
                        >
                            <XIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Hover Glow Effect */}
            <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-primary/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
        </motion.article>
    );
}
