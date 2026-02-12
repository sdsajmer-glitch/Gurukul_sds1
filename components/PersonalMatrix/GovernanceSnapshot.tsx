import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { ActivityIcon } from '../icons/ActivityIcon';

interface GovernanceSnapshotProps {
    lastModified: string;
    complianceStatus: string;
    securityLevel: string;
    attendanceTrend: string;
}

const StatRow: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
    <div className="flex items-center justify-between py-4 border-b border-white/[0.03] last:border-0 group">
        <span className="text-[10px] font-black text-white/20 uppercase tracking-widest group-hover:text-white/40 transition-colors">{label}</span>
        <span className={`text-[12px] font-bold uppercase tracking-widest ${color || 'text-white/60'}`}>{value}</span>
    </div>
);

const GovernanceSnapshot: React.FC<GovernanceSnapshotProps> = ({
    lastModified,
    complianceStatus,
    securityLevel,
    attendanceTrend
}) => {
    return (
        <div className="p-8 bg-[#14161c] border border-white/5 rounded-2xl shadow-sm space-y-8 flex flex-col h-full">
            <div className="flex items-center justify-between border-b border-white/5 pb-5">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500 ring-1 ring-emerald-500/20">
                        <ShieldCheckIcon className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                        <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Faculty Governance</h3>
                        <p className="text-[9px] font-medium text-white/20 uppercase tracking-widest">Procedural Integrity Snap</p>
                    </div>
                </div>
            </div>

            <div className="flex-grow space-y-1">
                <StatRow label="Last Modified" value={lastModified} />
                <StatRow label="Compliance Status" value={complianceStatus} color="text-emerald-500" />
                <StatRow label="Security Level" value={securityLevel} color="text-amber-500" />
                <StatRow label="Attendance Trend" value={attendanceTrend} color="text-primary" />
            </div>

            <div className="pt-8 border-t border-white/5 mt-auto">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Recent Activity</h4>
                    <ActivityIcon className="w-3.5 h-3.5 text-white/10" />
                </div>
                <div className="space-y-4">
                    {[1, 2].map(i => (
                        <div key={i} className="flex gap-4 items-start group">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/5 mt-1.5 shrink-0 group-hover:bg-primary transition-colors" />
                            <div className="space-y-1 min-w-0">
                                <p className="text-[11px] font-medium text-white/40 leading-relaxed truncate uppercase tracking-tight italic">
                                    {i === 1 ? 'BIO_ATTRIBUTE_MUTATION_SYNCED' : 'UPLINK_ESTABLISHED_SECTOR_A'}
                                </p>
                                <p className="text-[9px] font-bold text-white/10 uppercase tracking-widest">T - {i * 4} hours ago</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <button className="w-full py-4 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-xl text-[10px] font-black text-white/40 uppercase tracking-[0.3em] transition-all mt-6 shadow-inner">
                View Full Audit Chain
            </button>
        </div>
    );
};

export default GovernanceSnapshot;
