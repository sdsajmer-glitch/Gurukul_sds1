import React from 'react';
import { motion } from 'framer-motion';
import { ChartBarIcon } from '../icons/ChartBarIcon';
import { MoreVerticalIcon } from '../icons/MoreVerticalIcon';

const WorkloadHeader: React.FC = () => {
    return (
        <div className="w-full flex items-center justify-between px-2 py-4 border-b border-white/5 bg-[#0a0a0c]/50 backdrop-blur-md sticky top-0 z-30">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/5">
                    <ChartBarIcon className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                    <h1 className="text-lg font-serif font-black text-white uppercase tracking-tight leading-none">Workload <span className="text-white/20 italic font-medium">Core.</span></h1>
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mt-1">Faculty Allocation & Capacity Utilization</p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <motion.button
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-6 py-2.5 bg-white text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-lg shadow-xl shadow-white/5 hover:bg-white/90 transition-all flex items-center gap-2"
                >
                    Update Allocation
                </motion.button>
                <button className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all">
                    <MoreVerticalIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default WorkloadHeader;
