import React from 'react';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { KeyIcon } from '../icons/KeyIcon';

interface AuditSummaryStripProps {
    integrityScore: number;
    auditCount: number;
    lastRevision: string;
    complianceStatus: string;
}

const SummaryItem: React.FC<{ label: string; value: string | number; icon?: React.ReactNode; color?: string }> = ({ label, value, icon, color }) => (
    <div className="flex-1 min-w-[160px] bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col gap-1 transition-all hover:bg-white/[0.04]">
        <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">{label}</p>
        <div className="flex items-center gap-2">
            {icon && <span className="text-white/40">{icon}</span>}
            <span className={`text-[13px] font-bold tracking-tight ${color || 'text-white/80'}`}>{value}</span>
        </div>
    </div>
);

const AuditSummaryStrip: React.FC<AuditSummaryStripProps> = ({
    integrityScore,
    auditCount,
    lastRevision,
    complianceStatus
}) => {
    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl p-6 shadow-sm overflow-hidden">
            <div className="flex flex-nowrap items-center gap-4 overflow-x-auto custom-scrollbar-horizontal pb-2 lg:pb-0">
                <SummaryItem
                    label="Integrity Rating"
                    value={`${integrityScore}% ALPHA`}
                    color="text-emerald-500"
                    icon={<ShieldCheckIcon className="w-3.5 h-3.5" />}
                />
                <SummaryItem
                    label="Immutable Logs"
                    value={`${auditCount} EVENTS`}
                    icon={<ActivityIcon className="w-3.5 h-3.5" />}
                />
                <SummaryItem
                    label="Last Revision"
                    value={lastRevision}
                    icon={<CheckCircleIcon className="w-3.5 h-3.5" />}
                />
                <SummaryItem
                    label="Governance Protocol"
                    value={complianceStatus}
                    color="text-primary/60"
                    icon={<KeyIcon className="w-3.5 h-3.5" />}
                />
                <div className="flex-1 min-w-[200px] bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col gap-1 text-right ml-auto">
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Archival Ledger</p>
                    <p className="text-[12px] font-bold text-white/40 tracking-tight uppercase">SHA-256_Enforced</p>
                </div>
            </div>
        </div>
    );
};

export default AuditSummaryStrip;
