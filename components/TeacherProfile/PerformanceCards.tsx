import React from 'react';
import { motion } from 'framer-motion';
import { ActivityIcon } from '../icons/ActivityIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { ChartBarIcon } from '../icons/ChartBarIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';

const MatrixCard: React.FC<{
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    accent?: string;
}> = ({ title, icon, children, accent = "primary" }) => (
    <div className="p-10 bg-white/[0.01] border border-white/5 rounded-[3.5rem] shadow-3xl space-y-10 group hover:border-white/10 transition-all flex flex-col h-full overflow-hidden relative">
        <div className="flex items-center justify-between relative z-10">
            <h4 className="text-[11px] font-black text-white/20 uppercase tracking-[0.5em]">{title}</h4>
            <div className={`text-${accent} p-3 rounded-2xl bg-${accent}/5 border border-${accent}/10 group-hover:scale-110 group-hover:rotate-12 transition-all duration-700`}>
                {icon}
            </div>
        </div>
        <div className="flex-grow relative z-10">
            {children}
        </div>
        <div className={`absolute -bottom-10 -right-10 w-40 h-40 bg-${accent}/[0.02] blur-3xl rounded-full group-hover:scale-150 transition-transform duration-[2s] pointer-events-none`} />
    </div>
);

const PerformanceCards: React.FC = () => {
    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
            <MatrixCard title="Performance Intelligence" icon={<ActivityIcon className="w-6 h-6" />} accent="violet-400">
                <div className="space-y-8">
                    <div className="flex justify-between items-end">
                        <div className="space-y-2">
                            <h5 className="text-5xl font-serif font-black text-white tracking-tighter">4.9<span className="text-sm text-white/20 ml-1 font-sans italic">/5</span></h5>
                            <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest px-3 py-1 bg-violet-400/10 rounded-lg inline-block border border-violet-400/20">Alpha Tier Engagement</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">+12.4%</p>
                            <p className="text-[9px] font-black text-white/10 uppercase tracking-widest whitespace-nowrap">vs Last Cycle</p>
                        </div>
                    </div>

                    <div className="space-y-5 pt-4">
                        {[
                            { label: 'Student Feedback Index', val: 94 },
                            { label: 'Pedagogical Velocity', val: 88 },
                            { label: 'Syllabus Precision', val: 97 }
                        ].map((stat, i) => (
                            <div key={i} className="space-y-2.5">
                                <div className="flex justify-between text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">
                                    <span>{stat.label}</span>
                                    <span className="text-white/60">{stat.val}%</span>
                                </div>
                                <div className="h-1.5 bg-white/[0.03] rounded-full overflow-hidden shadow-inner">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${stat.val}%` }}
                                        className="h-full bg-gradient-to-r from-violet-600 to-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.3)]"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </MatrixCard>

            <MatrixCard title="Governance Snapshot" icon={<ShieldCheckIcon className="w-6 h-6" />} accent="emerald-500">
                <div className="space-y-8">
                    <div className="flex items-center gap-4">
                        <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-[0_0_15px_#10b981] animate-pulse" />
                        <h5 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Integrity Verified.</h5>
                    </div>

                    <div className="space-y-4">
                        {[
                            { label: 'Institutional Contract', status: 'Compliant' },
                            { label: 'Training Protocol', status: '92% Certified' },
                            { label: 'Documentation Vault', status: 'Archive_Stable' }
                        ].map((item, i) => (
                            <div key={i} className="flex justify-between items-center p-6 bg-black/40 rounded-2xl border border-white/5 hover:border-emerald-500/20 transition-all cursor-default">
                                <span className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em]">{item.label}</span>
                                <div className="flex items-center gap-2">
                                    <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" />
                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{item.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <p className="text-[10px] font-black italic text-white/10 uppercase tracking-[0.2em] text-center pt-4">Last Governance Audit: NodeCycle_0226</p>
                </div>
            </MatrixCard>

            <MatrixCard title="Institutional Health" icon={<ChartBarIcon className="w-6 h-6" />} accent="primary">
                <div className="space-y-10">
                    <div className="flex items-center gap-10">
                        <div className="w-32 h-32 relative flex items-center justify-center">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="42" fill="transparent" stroke="currentColor" strokeWidth="10" className="text-white/[0.03]" />
                                <motion.circle
                                    cx="50" cy="50" r="42" fill="transparent" stroke="currentColor" strokeWidth="10"
                                    strokeDasharray="263.8"
                                    initial={{ strokeDashoffset: 263.8 }}
                                    animate={{ strokeDashoffset: 263.8 - (263.8 * 0.84) }}
                                    className="text-primary drop-shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-serif font-black text-white">84<span className="text-xs text-primary">%</span></span>
                            </div>
                        </div>
                        <div className="space-y-6 flex-grow">
                            <div className="space-y-2">
                                <p className="text-[11px] font-black text-white/20 uppercase tracking-widest">Balance Index</p>
                                <p className="text-lg font-serif font-black text-emerald-500 uppercase italic">OPTIMIZED</p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-[11px] font-black text-white/20 uppercase tracking-widest">Burnout Risk</p>
                                <p className="text-lg font-serif font-black text-emerald-500 uppercase italic">NEGLIGIBLE</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 bg-black/40 rounded-3xl border border-white/5 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                            <p className="text-[11px] font-black text-white/60 uppercase tracking-widest">Institutional Pulse Normal</p>
                        </div>
                        <p className="text-[10px] text-white/20 uppercase leading-relaxed font-bold tracking-widest">
                            No critical workload saturation detected in current node cycles. Capacity for specialized institutional projects remains high.
                        </p>
                    </div>
                </div>
            </MatrixCard>
        </div>
    );
};

export default PerformanceCards;
