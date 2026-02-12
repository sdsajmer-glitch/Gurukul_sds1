import React from 'react';
import { motion } from 'framer-motion';
import { FileTextIcon } from '../icons/FileTextIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { LockIcon } from '../icons/LockIcon';
import { ActivityIcon } from '../icons/ActivityIcon';

interface VaultSummaryStripProps {
    totalDocs: number;
    verifiedDocs: number;
    storageUsed: string;
    lastArchived: string;
}

const SummaryItem: React.FC<{ label: string; value: string | number; icon?: React.ReactNode; color?: string }> = ({ label, value, icon, color }) => (
    <div className="flex-1 min-w-[140px] bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col gap-1 transition-all hover:bg-white/[0.04]">
        <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">{label}</p>
        <div className="flex items-center gap-2">
            {icon && <span className="text-white/40">{icon}</span>}
            <span className={`text-[13px] font-bold tracking-tight ${color || 'text-white/80'}`}>{value}</span>
        </div>
    </div>
);

const VaultSummaryStrip: React.FC<VaultSummaryStripProps> = ({
    totalDocs,
    verifiedDocs,
    storageUsed,
    lastArchived
}) => {
    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl p-6 shadow-sm overflow-hidden">
            <div className="flex flex-nowrap items-center gap-4 overflow-x-auto custom-scrollbar-horizontal pb-2 lg:pb-0">
                <SummaryItem
                    label="Total Inventory"
                    value={`${totalDocs} ASSETS`}
                    icon={<FileTextIcon className="w-3.5 h-3.5" />}
                />
                <SummaryItem
                    label="Verification"
                    value={`${verifiedDocs} VERIFIED`}
                    color="text-emerald-500"
                    icon={<ShieldCheckIcon className="w-3.5 h-3.5" />}
                />
                <SummaryItem
                    label="Encryption Level"
                    value="AES-256"
                    color="text-primary/60"
                    icon={<LockIcon className="w-3.5 h-3.5" />}
                />
                <SummaryItem
                    label="Storage Profile"
                    value={storageUsed}
                    icon={<ActivityIcon className="w-3.5 h-3.5" />}
                />
                <div className="flex-1 min-w-[200px] bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col gap-1 text-right ml-auto">
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Last Archival Batch</p>
                    <p className="text-[12px] font-bold text-white/60 tracking-tight">{lastArchived}</p>
                </div>
            </div>
        </div>
    );
};

export default VaultSummaryStrip;
