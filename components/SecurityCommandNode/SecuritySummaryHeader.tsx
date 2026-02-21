import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { LockIcon } from '../icons/LockIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { MonitorIcon } from '../icons/MonitorIcon';
import { ShieldAlertIcon } from '../icons/ShieldAlertIcon';

interface SecuritySummaryHeaderProps {
    status: 'Active' | 'Suspended' | 'Restricted';
    mfaEnabled: boolean;
    riskScore: 'Low' | 'Moderate' | 'High';
    activeSessions: number;
    lastLogin: string;
    deviceCount: number;
}

const SummaryMiniCard: React.FC<{ label: string; value: string | number; icon?: React.ReactNode; color?: string }> = ({ label, value, icon, color }) => (
    <div className="flex-1 min-w-[160px] bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col gap-1 transition-all hover:bg-white/[0.04]">
        <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">{label}</p>
        <div className="flex items-center gap-2">
            {icon && <span className="text-white/40">{icon}</span>}
            <span className={`text-[13px] font-bold tracking-tight ${color || 'text-white/80'}`}>{value}</span>
        </div>
    </div>
);

const SecuritySummaryHeader: React.FC<SecuritySummaryHeaderProps> = ({
    status,
    mfaEnabled,
    riskScore,
    activeSessions,
    lastLogin,
    deviceCount
}) => {
    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl p-6 shadow-sm overflow-hidden">
            <div className="flex flex-nowrap items-center gap-4 overflow-x-auto custom-scrollbar-horizontal pb-2 lg:pb-0">
                <SummaryMiniCard
                    label="Account Status"
                    value={status.toUpperCase()}
                    color={status === 'Active' ? 'text-emerald-500' : 'text-red-500'}
                    icon={<ShieldCheckIcon className="w-3.5 h-3.5" />}
                />
                <SummaryMiniCard
                    label="MFA Verification"
                    value={mfaEnabled ? 'ENFORCED' : 'DISABLED'}
                    color={mfaEnabled ? 'text-emerald-500' : 'text-white/30'}
                    icon={<LockIcon className="w-3.5 h-3.5" />}
                />
                <SummaryMiniCard
                    label="Risk Index"
                    value={riskScore.toUpperCase()}
                    color={riskScore === 'Low' ? 'text-emerald-500' : riskScore === 'Moderate' ? 'text-amber-500' : 'text-red-500'}
                    icon={<ShieldAlertIcon className="w-3.5 h-3.5" />}
                />
                <SummaryMiniCard
                    label="Live Uplinks"
                    value={`${activeSessions} SESSIONS`}
                    icon={<ActivityIcon className="w-3.5 h-3.5 text-primary" />}
                />
                <SummaryMiniCard
                    label="Device Matrix"
                    value={`${deviceCount} VERIFIED`}
                    icon={<MonitorIcon className="w-3.5 h-3.5" />}
                />
                <div className="flex-1 min-w-[200px] bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col gap-1 text-right ml-auto">
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Last Forensic Handshake</p>
                    <p className="text-[12px] font-bold text-white/60 tracking-tight">{lastLogin}</p>
                </div>
            </div>
        </div>
    );
};

export default SecuritySummaryHeader;
