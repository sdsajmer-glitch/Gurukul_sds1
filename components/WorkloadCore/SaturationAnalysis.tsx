import React from 'react';
import { motion } from 'framer-motion';
import { ChartBarIcon } from '../icons/ChartBarIcon';
import { TargetIcon } from '../icons/TargetIcon';

interface SaturationAnalysisProps {
    hours: number;
    max: number;
}

const SaturationAnalysis: React.FC<SaturationAnalysisProps> = ({ hours, max }) => {
    const percentage = (hours / max) * 100;
    const isCritical = percentage > 90;

    return (
        <div className="bg-[#14161c] border border-white/5 rounded-[2.5rem] p-12 shadow-sm relative overflow-hidden group/card">
            {/* Background Decorative Icon */}
            <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover/card:scale-110 transition-transform duration-[1500ms] pointer-events-none">
                <ChartBarIcon className="w-80 h-80" />
            </div>

            <div className="relative z-10 flex flex-col gap-14">
                {/* Header Row */}
                <div className="flex justify-between items-end">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.6em]">Pedagogical Commitment</p>
                        </div>
                        <h4 className="text-4xl font-serif font-black text-white uppercase tracking-tighter leading-none">Weekly Node <span className="text-white/20 italic">Saturation.</span></h4>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                        <div className="flex items-baseline gap-2">
                            <h5 className="text-6xl font-serif font-black text-white tracking-tighter">{hours}</h5>
                            <span className="text-xl font-serif font-black text-white/20 tracking-tighter">/ {max}</span>
                        </div>
                        <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.4em]">Aggregated Institutional Hours</p>
                    </div>
                </div>

                {/* Main Saturation Component */}
                <div className="space-y-10">
                    <div className="relative pt-6">
                        {/* Bar Track */}
                        <div className="h-4 w-full bg-white/[0.04] rounded-full overflow-hidden relative shadow-inner">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 2.5, ease: [0.23, 1, 0.32, 1] }}
                                className={`h-full rounded-full relative ${isCritical ? 'bg-gradient-to-r from-red-600 to-red-400' : 'bg-gradient-to-r from-primary via-indigo-500/80 to-violet-500/60 shadow-[0_0_20px_rgba(100,100,255,0.2)]'}`}
                            >
                                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.05)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.05)_50%,rgba(255,255,255,0.05)_75%,transparent_75%,transparent)] bg-[length:32px_32px] animate-[shine_8s_linear_infinite]" />

                                {/* Glow Cursor */}
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 group-hover/card:scale-125 transition-transform duration-500">
                                    <div className={`w-8 h-8 rounded-full border-4 border-black/60 shadow-2xl ${isCritical ? 'bg-red-500' : 'bg-white'}`} />
                                    <div className={`absolute inset-0 rounded-full blur-xl opacity-30 ${isCritical ? 'bg-red-500' : 'bg-primary'}`} />
                                </div>
                            </motion.div>
                        </div>

                        {/* Labels Below Bar */}
                        <div className="flex justify-between items-center mt-10">
                            <div className="flex items-center gap-3">
                                <span className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em]">Base_Allocation [00h]</span>
                                <div className="w-32 h-[1px] bg-white/[0.03]" />
                            </div>

                            <div className="flex flex-col items-center">
                                <div className={`px-5 py-1.5 rounded-full border transition-all duration-700 ${isCritical ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-primary/5 border-primary/20 text-primary'}`}>
                                    <span className="text-[11px] font-black uppercase tracking-[0.3em] italic">{percentage.toFixed(1)}% Capacity Utilization</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-right">
                                <div className="w-32 h-[1px] bg-white/[0.03]" />
                                <span className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em]">Max_Saturation [{max}h]</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SaturationAnalysis;
