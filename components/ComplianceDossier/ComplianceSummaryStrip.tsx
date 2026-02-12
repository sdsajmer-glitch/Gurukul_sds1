import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { ActivityIcon } from '../icons/ActivityIcon';

interface ComplianceSummaryStripProps {
    tenure: string | number;
    integrityStatus: string;
    contractType: string;
    backgroundCheck: string;
}

const SummaryItem: React.FC<{ label: string; value: string | number; icon?: React.ReactNode; color?: string }> = ({ label, value, icon, color }) => (
    <div className="flex-1 min-w-[150px] bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col gap-1 transition-all hover:bg-white/[0.04]">
        <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">{label}</p>
        <div className="flex items-center gap-2">
            {icon && <span className="text-white/40">{icon}</span>}
            <span className={`text-[13px] font-bold tracking-tight ${color || 'text-white/80'}`}>{value}</span>
        </div>
    </div>
);

const ComplianceSummaryStrip: React.FC<ComplianceSummaryStripProps> = ({
    tenure,
    integrityStatus,
    contractType,
    backgroundCheck
}) => {
    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl p-6 shadow-sm overflow-hidden">
            <div className="flex flex-nowrap items-center gap-4 overflow-x-auto custom-scrollbar-horizontal pb-2 lg:pb-0">
                <SummaryItem
                    label="Institutional Tenure"
                    value={`${tenure} MONTHS`}
                    icon={<ClockIcon className="w-3.5 h-3.5" />}
                />
                <SummaryItem
                    label="Integrity Rating"
                    value={integrityStatus.toUpperCase()}
                    color="text-emerald-500"
                    icon={<ShieldCheckIcon className="w-3.5 h-3.5" />}
                />
                <SummaryItem
                    label="Governing Contract"
                    value={contractType.toUpperCase()}
                    color="text-primary/60"
                    icon={<BriefcaseIcon className="w-3.5 h-3.5" />}
                />
                <SummaryItem
                    label="Background Sync"
                    value={backgroundCheck.toUpperCase()}
                    icon={<ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-500/40" />}
                />
                <div className="flex-1 min-w-[200px] bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col gap-1 text-right ml-auto">
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Compliance Protocol</p>
                    <p className="text-[12px] font-bold text-white/60 tracking-tight uppercase">ISO_27001_ACTIVE</p>
                </div>
            </div>
        </div>
    );
};

export default ComplianceSummaryStrip;
