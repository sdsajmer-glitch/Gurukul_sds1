import React from 'react';
import { ActivityIcon } from '../icons/ActivityIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { TargetIcon } from '../icons/TargetIcon';

const StrategicCommand: React.FC = () => {
    return (
        <div className="flex flex-col gap-8 h-full">
            {/* Primary Command Card */}
            <div className="p-10 bg-[#14161c] border border-white/5 rounded-[3rem] shadow-sm flex flex-col gap-10 hover:translate-y-[-4px] transition-all duration-300">
                <div className="flex items-center justify-between border-b border-white/5 pb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-[1.25rem] text-primary ring-1 ring-primary/20">
                            <ActivityIcon className="w-5 h-5" />
                        </div>
                        <div className="space-y-0.5">
                            <h3 className="text-[15px] font-bold text-white uppercase tracking-wider">Forecasting</h3>
                            <p className="text-[9px] font-medium text-white/20 uppercase tracking-widest">Predictive Load Model</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    <p className="text-[11px] font-medium text-white/30 uppercase tracking-[0.2em] leading-[1.8] italic">
                        Projected load stability for the next academic trimester remains within nominal parameters. No imminent saturation bottlenecks detected.
                    </p>

                    <div className="space-y-4 pt-4 border-t border-white/[0.04]">
                        <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5 group hover:bg-white/[0.04] transition-colors">
                            <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Next-Term Delta</span>
                                <span className="text-[12px] font-bold text-emerald-500 uppercase">+1.2 Node_Hrs</span>
                            </div>
                            <TargetIcon className="w-4 h-4 text-emerald-500/20 group-hover:text-emerald-500/50 transition-colors" />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5 group hover:bg-white/[0.04] transition-colors">
                            <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Burnout Risk</span>
                                <span className="text-[12px] font-bold text-white/40 uppercase">LOW_PRECISION</span>
                            </div>
                            <ActivityIcon className="w-4 h-4 text-white/5 group-hover:text-white/20 transition-colors" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Strategy Recommendation Card */}
            <div className="p-10 bg-violet-500/[0.02] border border-violet-500/10 rounded-[3rem] shadow-sm flex flex-col gap-8 hover:translate-y-[-4px] transition-all duration-300">
                <div className="flex items-center gap-4 border-b border-violet-500/10 pb-6">
                    <div className="p-3 bg-violet-500/10 rounded-[1.25rem] text-violet-500 ring-1 ring-violet-500/20">
                        <ClockIcon className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                        <h3 className="text-[15px] font-bold text-white uppercase tracking-wider">Strategy</h3>
                        <p className="text-[9px] font-medium text-violet-500/30 uppercase tracking-widest">Resourcing Recommendation</p>
                    </div>
                </div>

                <div className="p-6 bg-violet-500/5 border border-violet-500/10 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-violet-500/10 blur-3xl rounded-full" />
                    <p className="text-[12px] font-black text-violet-500/80 uppercase tracking-[0.1em] leading-relaxed relative z-10">
                        Allocate auxiliary grading support for Tuesday peak cycles. Optimize Resourcing Node 04.
                    </p>
                </div>

                <button className="w-full py-5 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-2xl text-[10px] font-black text-violet-500 uppercase tracking-[0.3em] transition-all shadow-inner">
                    Authorize Strategy Sync
                </button>
            </div>
        </div>
    );
};

export default StrategicCommand;
