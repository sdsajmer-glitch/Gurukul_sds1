import React from 'react';
import { TargetIcon } from '../icons/TargetIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { ChartBarIcon } from '../icons/ChartBarIcon';

const ImpactItem: React.FC<{ label: string; value: string; sub: string; icon: React.ReactNode; color: string }> = ({ label, value, sub, icon, color }) => (
    <div className="flex-1 min-w-[200px] p-10 bg-[#14161c] border border-white/5 rounded-[2.5rem] text-center space-y-6 group hover:bg-white/[0.02] transition-all duration-500 relative overflow-hidden">
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[1px] bg-gradient-to-r from-transparent via-${color}-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />

        <div className="flex flex-col items-center gap-2">
            <div className="text-white/10 group-hover:text-white/30 transition-colors">
                {icon}
            </div>
            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">{label}</p>
        </div>

        <h5 className="text-6xl font-serif font-black text-white transition-all duration-700 group-hover:scale-110 group-hover:tracking-tighter">{value}</h5>

        <div className="flex flex-col items-center gap-1">
            <p className="text-[9px] font-black text-white/5 uppercase tracking-[0.3em] group-hover:text-white/20 transition-colors">{sub}</p>
            <div className="w-8 h-[1px] bg-white/[0.03]" />
        </div>
    </div>
);

const ImpactRegistry: React.FC = () => {
    return (
        <div className="flex flex-col md:flex-row gap-8 w-full">
            <ImpactItem
                label="Department Nodes"
                value="04"
                sub="Active Alignments"
                icon={<TargetIcon className="w-5 h-5" />}
                color="primary"
            />
            <ImpactItem
                label="Cohort Impact"
                value="~112"
                sub="Student Reach Index"
                icon={<UsersIcon className="w-5 h-5" />}
                color="violet"
            />
            <ImpactItem
                label="Efficiency Delta"
                value="96%"
                sub="Institutional Output"
                icon={<ChartBarIcon className="w-5 h-5" />}
                color="emerald"
            />
        </div>
    );
};

export default ImpactRegistry;
