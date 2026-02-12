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

    return (
        <div className="space-y-8">
            <div className="p-12 bg-[#14161c] border border-white/5 rounded-[3.5rem] shadow-sm relative overflow-hidden group/card shadow-2xl">
                <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover/card:scale-110 transition-transform duration-1000">
                    <ChartBarIcon className="w-64 h-64" />
                </div>

                <div className="relative z-10 space-y-12">
                    <div className="flex justify-between items-end">
                        <div className="space-y-2">
                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.5em] mb-2">Pedagogical Commitment</p>
                            <h4 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Weekly Node Saturation</h4>
                        </div>
                        <div className="text-right space-y-1">
                            <h5 className="text-5xl font-serif font-black text-white tracking-tighter">{hours}<span className="text-sm text-white/20 ml-2 font-sans">/ {max}</span></h5>
                            <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.4em]">Aggregated Institutional Hours</p>
                        </div>
                    </div>

                    <div className="relative pt-4">
                        <div className="h-5 w-full bg-white/[0.03] rounded-full overflow-hidden shadow-inner ring-1 ring-white/5 relative">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 2, ease: [0.23, 1, 0.32, 1] }}
                                className={`h-full rounded-full relative ${percentage > 90 ? 'bg-gradient-to-r from-red-600 to-red-400' : 'bg-gradient-to-r from-primary via-indigo-500 to-violet-500'}`}
                            >
                                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.1)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.1)_75%,transparent_75%,transparent)] bg-[length:40px_40px] animate-[shine_4s_linear_infinite]" />
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-[0_0_20px_#fff] border-4 border-black/40" />
                            </motion.div>
                        </div>
                        <div className="flex justify-between mt-8 text-[10px] font-black text-white/10 uppercase tracking-[0.5em]">
                            <span>Base_Allocation [00h]</span>
                            <span className={`${percentage > 90 ? 'text-red-500/60 font-black' : 'text-primary/40 font-serif italic tracking-normal'}`}>{percentage.toFixed(1)}% Capacity Utilization</span>
                            <span>Max_Saturation [{max}h]</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Impact Grid Underneath */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    { label: 'Department Nodes', value: '04', sub: 'Active Alignments', icon: <TargetIcon className="w-5 h-5" />, color: 'primary' },
                    { label: 'Cohort Impact', value: '~112', sub: 'Student Reach Index', icon: <TargetIcon className="w-5 h-5" />, color: 'violet' },
                    { label: 'Efficiency Delta', value: '96%', sub: 'Institutional Output', icon: <TargetIcon className="w-5 h-5" />, color: 'emerald' },
                ].map((item, i) => (
                    <div key={i} className="p-10 bg-[#14161c] border border-white/5 rounded-[3rem] text-center space-y-5 group hover:bg-white/[0.02] transition-all">
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">{item.label}</p>
                        <h5 className="text-6xl font-serif font-black text-white transition-all duration-700 group-hover:scale-110">{item.value}</h5>
                        <p className="text-[9px] font-black text-white/5 uppercase tracking-widest">{item.sub}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SaturationAnalysis;
