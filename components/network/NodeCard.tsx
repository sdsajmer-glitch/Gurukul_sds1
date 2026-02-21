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
    // Determine status based on isMain for now, can be expanded to passed prop later
    const status: NodeStatus = isMain ? 'head-office' : 'active'; // Assuming active for now unless we have more logic

    return (
        <motion.article
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="group relative bg-[#0D0F14]/60 backdrop-blur-3xl border border-white/5 hover:border-primary/30 rounded-[32px] overflow-hidden transition-all duration-500 hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] flex flex-col min-h-[300px] ring-1 ring-white/5"
        >
            {/* Card Header */}
            <div className="p-8 pb-6 border-b border-white/5">
                <div className="flex items-start justify-between mb-6">
                    {/* Node Type Icon */}
                    <div className={`p-4 rounded-2xl transition-all duration-500 ${isMain ? 'bg-primary/10 text-primary ring-2 ring-primary/20 shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]' : 'bg-white/5 text-white/20 group-hover:bg-white/10 group-hover:text-white/40'}`}>
                        <SchoolIcon className="w-6 h-6" />
                    </div>

                    {/* Action Buttons - Accessible & Clear */}
                    <div className="flex gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(); }}
                            className="p-3 text-white/10 hover:text-white hover:bg-white/5 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-[48px] min-h-[48px] flex items-center justify-center border border-white/0 hover:border-white/5"
                            title="Edit node configuration"
                            aria-label={`Edit ${name} configuration`}
                        >
                            <EditIcon className="w-4.5 h-4.5" />
                        </button>
                        {!isMain && onDelete && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                className="p-3 text-white/10 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-red-500/50 min-w-[48px] min-h-[48px] flex items-center justify-center border border-white/0 hover:border-red-500/10"
                                title="Remove node from network"
                                aria-label={`Remove ${name} from network`}
                            >
                                <XIcon className="w-4.5 h-4.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Node Information */}
                <div>
                    <h3 className="text-xl font-black text-white tracking-tighter leading-tight mb-3 line-clamp-2 uppercase italic">{name}</h3>
                    <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em] flex items-center gap-2">
                        <LocationIcon className="w-3.5 h-3.5 flex-shrink-0 opacity-40" />
                        <span className="truncate">{location}</span>
                    </p>
                </div>
            </div>

            {/* Card Footer - Status & Metadata */}
            <div className="p-8 pt-6 mt-auto bg-white/[0.01]">
                <div className="flex items-center justify-between">
                    {/* Status Badge */}
                    <StatusBadge status={status} />

                    {/* Administrator Avatar */}
                    {adminName && (
                        <div
                            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-white/40 uppercase ring-4 ring-[#0D0F14]"
                            title={adminName}
                        >
                            {adminName[0]}
                        </div>
                    )}
                </div>
            </div>

            {/* Hover Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-primary/0 via-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        </motion.article>
    );
}
