import React from 'react';
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
        <article
            className="group relative bg-gradient-to-br from-[#0a0a0b] to-[#0f0f12] border border-white/10 hover:border-white/20 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/40 hover:-translate-y-1 flex flex-col min-h-[280px]"
        >
            {/* Card Header */}
            <div className="p-6 pb-4 border-b border-white/5">
                <div className="flex items-start justify-between mb-4">
                    {/* Node Type Icon */}
                    <div className={`p-3 rounded-xl transition-all duration-300 ${isMain ? 'bg-primary/10 text-primary ring-2 ring-primary/20' : 'bg-white/5 text-white/40 group-hover:bg-white/10'}`}>
                        <SchoolIcon className="w-6 h-6" />
                    </div>

                    {/* Action Buttons - Accessible & Clear */}
                    <div className="flex gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(); }}
                            className="p-2.5 text-white/20 hover:text-white hover:bg-white/5 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                            title="Edit node configuration"
                            aria-label={`Edit ${name} configuration`}
                        >
                            <EditIcon className="w-4 h-4" />
                        </button>
                        {!isMain && onDelete && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                className="p-2.5 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-red-500/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                                title="Remove node from network"
                                aria-label={`Remove ${name} from network`}
                            >
                                <XIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Node Information */}
                <div>
                    <h3 className="text-lg font-black text-white tracking-tight leading-tight mb-2 line-clamp-2">{name}</h3>
                    <p className="text-xs text-white/30 font-medium uppercase tracking-wide flex items-center gap-2">
                        <LocationIcon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{location}</span>
                    </p>
                </div>
            </div>

            {/* Card Footer - Status & Metadata */}
            <div className="p-6 pt-4 mt-auto">
                <div className="flex items-center justify-between">
                    {/* Status Badge */}
                    <StatusBadge status={status} />

                    {/* Administrator Avatar */}
                    {adminName && (
                        <div
                            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-white/60 uppercase"
                            title={adminName}
                        >
                            {adminName[0]}
                        </div>
                    )}
                </div>
            </div>

            {/* Hover Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-primary/0 via-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </article>
    );
}
