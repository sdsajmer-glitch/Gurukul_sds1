import React from 'react';
import { motion } from 'framer-motion';
import { ChartBarIcon } from '../icons/ChartBarIcon';
import { TargetIcon } from '../icons/TargetIcon';

interface WorkloadHeaderProps {
    utilization: number;
}

const WorkloadHeader: React.FC<WorkloadHeaderProps> = ({ utilization }) => {
    const isCritical = utilization > 90;

    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl h-[90px] px-8 flex items-center justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className="flex items-center gap-6 relative z-10">
                <div className="p-3 bg-primary/10 rounded-xl text-primary ring-1 ring-primary/20 shadow-lg group-hover:scale-110 transition-transform duration-500">
                    <ChartBarIcon className="w-6 h-6" />
                </div>

                <div className="space-y-0.5">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-serif font-black text-white uppercase tracking-tight">Workload <span className="text-white/20 italic font-medium">Core.</span></h1>
                        <div className={`px-3 py-0.5 rounded-md border flex items-center gap-2 ${isCritical ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isCritical ? 'bg-red-500' : 'bg-emerald-500'}`} />
                            <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${isCritical ? 'text-red-500' : 'text-emerald-500'}`}>
                                {isCritical ? 'CRITICAL_LOAD_DETECTED' : 'OPTIMAL_SATURATION'}
                            </span>
                        </div>
                    </div>
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">Strategic Load Analysis & Pedagogical Capacity Telemetry</p>
                </div>
            </div>

            <div className="flex items-center gap-6 relative z-10">
                <div className="h-10 w-px bg-white/5 hidden md:block" />
                <div className="flex flex-col text-right">
                    <span className="text-[9px] font-black text-white/10 uppercase tracking-widest">Procedural Status</span>
                    <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Operational_Verified</span>
                </div>
                <button className="h-11 px-6 bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-[0.3em] transition-all">
                    Sync Telemetry
                </button>
            </div>
        </div>
    );
};

export default WorkloadHeader;
