import React from 'react';
import { motion } from 'framer-motion';
import { TeacherExtended } from '../../types';
import WorkloadSummaryStrip from './WorkloadSummaryStrip';
import SaturationAnalysis from './SaturationAnalysis';
import { ChartBarIcon } from '../icons/ChartBarIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { ClockIcon } from '../icons/ClockIcon';

interface WorkloadCoreProps {
    teacher: TeacherExtended;
    workloadHours: number;
    maxLoad: number;
}

const WorkloadCore: React.FC<WorkloadCoreProps> = ({
    teacher,
    workloadHours,
    maxLoad
}) => {
    const utilization = (workloadHours / maxLoad) * 100;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-8 w-full max-w-[1440px] mx-auto pb-32"
        >
            {/* 🏫 SECTION HEADER LAYER */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 px-2">
                <div className="space-y-1">
                    <div className="flex items-center gap-3 opacity-40">
                        <div className="w-8 h-px bg-primary/40" />
                        <span className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Academic Control</span>
                    </div>
                    <h2 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Workload <span className="text-white/20 italic font-medium">Core.</span></h2>
                    <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em]">Strategic Load Analysis & Pedagogical Capacity Telemetry</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className={`px-4 py-2 border rounded-xl flex items-center gap-2 transition-all ${utilization > 90 ? 'bg-red-500/5 border-red-500/10' : 'bg-emerald-500/5 border-emerald-500/10'}`}>
                        <div className={`w-2 h-2 rounded-full animate-pulse ${utilization > 90 ? 'bg-red-500' : 'bg-emerald-500'}`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${utilization > 90 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {utilization > 90 ? 'CRITICAL_LOAD_ALERT' : 'OPTIMAL_SATURATION'}
                        </span>
                    </div>
                </div>
            </div>

            {/* 🏫 SUMMARY STRIP */}
            <WorkloadSummaryStrip
                totalHours={workloadHours}
                maxCapacity={maxLoad}
                utilization={utilization}
                cohortReach={workloadHours * 28} // Estimated
            />

            {/* 🏫 MAIN OPERATIONAL GRID (8/4 Split) */}
            <div className="grid grid-cols-12 gap-8 items-start px-1">

                {/* 8-COLUMN MAIN CONTENT (70% weight approx) */}
                <div className="col-span-12 xl:col-span-8 space-y-8">
                    <div className="transition-all duration-200 hover:translate-y-[-4px]">
                        <SaturationAnalysis hours={workloadHours} max={maxLoad} />
                    </div>
                </div>

                {/* 4-COLUMN AUXILIARY PANEL (30% weight approx) */}
                <div className="hidden xl:block xl:col-span-4 h-full">
                    <div className="sticky top-8 space-y-8">
                        {/* Capacity Forecasting Card */}
                        <div className="p-10 bg-[#14161c] border border-white/5 rounded-[2.5rem] shadow-sm space-y-8 transition-all hover:translate-y-[-4px]">
                            <div className="flex items-center justify-between border-b border-white/5 pb-5">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary ring-1 ring-primary/20">
                                        <ActivityIcon className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Forecasting</h3>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <p className="text-[10px] font-medium text-white/20 uppercase tracking-widest leading-relaxed">
                                    Projected load stability for the next academic trimester remains within nominal parameters.
                                </p>

                                <div className="space-y-4 pt-4 border-t border-white/[0.03]">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Next-Term Delta</p>
                                        <span className="text-[11px] font-black text-emerald-500 uppercase">+1.2 Node_Hrs</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Burnout Risk</p>
                                        <span className="text-[11px] font-black text-white/40 uppercase">LOW_PRECISION</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Resource Recommendations Card */}
                        <div className="p-10 bg-[#14161c] border border-white/5 rounded-[2.5rem] shadow-sm space-y-8 transition-all hover:translate-y-[-4px]">
                            <div className="flex items-center justify-between border-b border-white/5 pb-5">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-violet-500/10 rounded-xl text-violet-500 ring-1 ring-violet-500/20">
                                        <ClockIcon className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Strategy</h3>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                    <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Recommendation</p>
                                    <p className="text-[11px] font-medium text-white/60 leading-relaxed uppercase tracking-tight">Allocate auxiliary grading support for Tuesday peak cycles.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default WorkloadCore;
