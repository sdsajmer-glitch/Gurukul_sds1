import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { LockIcon } from '../icons/LockIcon';
import { ActivityIcon } from '../icons/ActivityIcon';

interface SecuritySummaryHeaderProps {
    status: 'Active' | 'Suspended' | 'Restricted';
    mfaEnabled: boolean;
    riskScore: 'Low' | 'Moderate' | 'High';
    activeSessions: number;
    lastLogin: string;
}

const SecuritySummaryHeader: React.FC<SecuritySummaryHeaderProps> = ({
    status,
    mfaEnabled,
    riskScore,
    activeSessions,
    lastLogin
}) => {
    const riskColors = {
        Low: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        Moderate: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        High: 'text-red-500 bg-red-500/10 border-red-500/20'
    };

    return (
        <div className="bg-white/[0.02] border border-white/5 rounded-[3rem] p-10 flex flex-wrap lg:flex-nowrap items-center justify-between gap-10 shadow-3xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] to-transparent pointer-events-none" />

            <div className="flex items-center gap-8 relative z-10">
                <div className="w-20 h-20 rounded-[2rem] bg-black/40 border border-white/10 flex items-center justify-center text-primary shadow-2xl group-hover:scale-110 transition-transform duration-700">
                    <ShieldCheckIcon className="w-10 h-10" />
                </div>
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-serif font-black text-white uppercase tracking-tighter italic">Protocol Status.</h3>
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] border ${status === 'Active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                            {status}
                        </span>
                    </div>
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Node Security Integrity: Managed</p>
                </div>
            </div>

            <div className="flex flex-wrap gap-12 relative z-10">
                <div className="space-y-2">
                    <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.4em]">MFA Authentication</p>
                    <div className="flex items-center gap-2">
                        <LockIcon className={`w-4 h-4 ${mfaEnabled ? 'text-emerald-500' : 'text-white/20'}`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${mfaEnabled ? 'text-white' : 'text-white/20'}`}>
                            {mfaEnabled ? 'ENFORCED' : 'DISABLED'}
                        </span>
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.4em]">Risk Assessment</p>
                    <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${riskColors[riskScore]}`}>
                        {riskScore} SEVERITY
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.4em]">Active Uplinks</p>
                    <div className="flex items-center gap-2">
                        <ActivityIcon className="w-4 h-4 text-primary animate-pulse" />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">{activeSessions} SESSIONS</span>
                    </div>
                </div>

                <div className="hidden xl:block h-10 w-px bg-white/5" />

                <div className="space-y-1 text-right">
                    <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.4em]">Forensic Handshake</p>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{lastLogin}</p>
                </div>
            </div>
        </div>
    );
};

export default SecuritySummaryHeader;
