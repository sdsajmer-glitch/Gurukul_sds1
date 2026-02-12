import React from 'react';
import { motion } from 'framer-motion';

const WorkloadTrendAnalysis: React.FC = () => {
    const data = [45, 60, 55, 80, 70, 90, 85];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl p-8 shadow-sm space-y-8">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Historical Load Distribution</h3>
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Aggregate 7-Day Precision Trend</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary/40" />
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Peak Triggers</span>
                    </div>
                </div>
            </div>

            <div className="h-48 flex items-end justify-between gap-4 px-2">
                {data.map((val, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                        <div className="w-full relative flex items-end justify-center h-full">
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${val}%` }}
                                transition={{ duration: 1, delay: i * 0.1, ease: "circOut" }}
                                className={`w-full max-w-[40px] rounded-t-lg transition-all duration-300 ${val > 80 ? 'bg-primary/40' : 'bg-primary/20'} group-hover:bg-primary/60`}
                            >
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black border border-white/10 px-2 py-1 rounded text-[9px] font-black text-white whitespace-nowrap z-10">
                                    {val}% Saturation
                                </div>
                            </motion.div>
                        </div>
                        <span className="text-[10px] font-black text-white/10 uppercase tracking-widest group-hover:text-white/40 transition-colors">{days[i]}</span>
                    </div>
                ))}
            </div>

            <div className="pt-6 border-t border-white/[0.03] flex items-center justify-between">
                <p className="text-[10px] font-medium text-white/20 italic">"Operational fluctuations remain within 15% delta of institutional baselines."</p>
                <div className="flex gap-2">
                    <span className="px-2 py-0.5 rounded bg-white/5 text-[8px] font-black text-white/20 uppercase tracking-widest">Log_Active</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-[8px] font-black text-white/20 uppercase tracking-widest">TS_0991</span>
                </div>
            </div>
        </div>
    );
};

export default WorkloadTrendAnalysis;
