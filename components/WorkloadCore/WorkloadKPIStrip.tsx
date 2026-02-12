import React from 'react';
import { motion } from 'framer-motion';
import { ClockIcon } from '../icons/ClockIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { TargetIcon } from '../icons/TargetIcon';
import { ChartBarIcon } from '../icons/ChartBarIcon';

interface WorkloadKPIStripProps {
    totalHours: number;
    maxCapacity: number;
    utilization: number;
    cohortReach: number;
}

const KPICapsule: React.FC<{ label: string; value: string | number; icon: React.ReactNode; color?: string }> = ({ label, value, icon, color }) => (
    <div className="flex-1 min-w-[200px] h-[86px] bg-white/[0.01] border border-white/5 rounded-2xl px-6 py-5 flex flex-col justify-between transition-all hover:bg-white/[0.03] group relative overflow-hidden shadow-sm">
        <div className="flex justify-between items-start relative z-10">
            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">{label}</p>
            <span className="text-white/10 group-hover:text-primary/40 transition-colors">{icon}</span>
        </div>
        <h5 className={`text-[16px] font-bold tracking-tighter uppercase relative z-10 ${color || 'text-white/90'}`}>{value}</h5>
        <div className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-primary/40 to-transparent w-0 group-hover:w-full transition-all duration-700" />
    </div>
);

const WorkloadKPIStrip: React.FC<WorkloadKPIStripProps> = ({
    totalHours,
    maxCapacity,
    utilization,
    cohortReach
}) => {
    return (
        <div className="bg-[#14161c] border border-white/5 rounded-3xl p-6 shadow-sm flex flex-col gap-6">
            <div className="flex flex-nowrap items-center gap-5 overflow-x-auto custom-scrollbar-horizontal pb-2 lg:pb-0">
                <KPICapsule
                    label="Weekly Saturation"
                    value={`${totalHours} / ${maxCapacity} HRS`}
                    icon={<ClockIcon className="w-3.5 h-3.5" />}
                />
                <KPICapsule
                    label="Capacity Delta"
                    value={`${utilization.toFixed(1)}% ALPHA`}
                    color={utilization > 90 ? "text-red-500" : "text-emerald-500"}
                    icon={<ActivityIcon className="w-3.5 h-3.5" />}
                />
                <KPICapsule
                    label="Cohort Impact"
                    value={`~${cohortReach} STUDENTS`}
                    icon={<TargetIcon className="w-3.5 h-3.5" />}
                />
                <KPICapsule
                    label="Efficiency Rating"
                    value="RANK_A++"
                    color="text-primary"
                    icon={<ChartBarIcon className="w-3.5 h-3.5" />}
                />
            </div>

            {/* Bottom Progress Bar Metadata */}
            <div className="flex items-center gap-6 px-1">
                <div className="flex-grow h-1.5 bg-white/5 rounded-full overflow-hidden relative">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${utilization}%` }}
                        transition={{ duration: 1.5, ease: "circOut" }}
                        className={`h-full rounded-full ${utilization > 90 ? 'bg-red-500/50' : 'bg-primary/40'}`}
                    />
                </div>
                <div className="flex gap-6 shrink-0">
                    <span className="text-[9px] font-black text-white/15 uppercase tracking-[0.4em]">Saturation Index: {utilization.toFixed(1)}%</span>
                    <span className="text-[9px] font-black text-emerald-500/30 uppercase tracking-[0.4em] italic">System_Stable</span>
                </div>
            </div>
        </div>
    );
};

export default WorkloadKPIStrip;
