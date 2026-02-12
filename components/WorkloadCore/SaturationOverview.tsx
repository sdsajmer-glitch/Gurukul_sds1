import React from 'react';
import { motion } from 'framer-motion';

interface SaturationOverviewProps {
    hours: number;
    max: number;
    units: number;
    sections: number;
}

const StatItem: React.FC<{ label: string; value: string | number; sub?: string }> = ({ label, value, sub }) => (
    <div className="flex flex-col gap-1">
        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">{label}</p>
        <div className="flex items-baseline gap-1">
            <span className="text-xl font-serif font-black text-white tracking-tight">{value}</span>
            {sub && <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{sub}</span>}
        </div>
    </div>
);

const SaturationOverview: React.FC<SaturationOverviewProps> = ({ hours, max, units, sections }) => {
    const percentage = (hours / max) * 100;
    const isCritical = percentage > 90;

    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl p-8 h-[160px] flex items-center shadow-sm relative overflow-hidden group">
            <div className="grid grid-cols-12 w-full gap-12 items-center">

                {/* Left: Capacity Meter */}
                <div className="col-span-12 lg:col-span-7 space-y-4">
                    <div className="flex justify-between items-end mb-2">
                        <p className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Node Capacity Meter</p>
                        <span className={`text-[12px] font-bold tracking-tighter ${isCritical ? 'text-red-500' : 'text-emerald-500'}`}>
                            {percentage.toFixed(1)}% / 100%
                        </span>
                    </div>
                    <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden relative shadow-inner">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 1.5, ease: "circOut" }}
                            className={`h-full rounded-full ${isCritical ? 'bg-red-500/60' : 'bg-primary/50'}`}
                        />
                    </div>
                    <div className="flex justify-between text-[8px] font-black text-white/10 uppercase tracking-[0.4em]">
                        <span>System_Minimum</span>
                        <span>Operational_Peak</span>
                    </div>
                </div>

                {/* Right: Summary Stats */}
                <div className="col-span-12 lg:col-span-5 grid grid-cols-2 gap-x-8 gap-y-6 border-l border-white/5 pl-12 h-full flex items-center">
                    <StatItem label="Teaching Units" value={units} />
                    <StatItem label="Active Sections" value={sections} />
                    <StatItem label="Weekly Hours" value={hours} sub={`/ ${max}`} />
                    <StatItem label="Utilization %" value={`${percentage.toFixed(1)}%`} />
                </div>
            </div>
        </div>
    );
};

export default SaturationOverview;
