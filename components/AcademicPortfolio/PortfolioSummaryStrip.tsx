import React from 'react';
import { motion } from 'framer-motion';
import { BookIcon } from '../icons/BookIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { StarIcon } from '../icons/StarIcon';

interface PortfolioSummaryStripProps {
    assignedSubjects: number;
    totalImpact: number;
    weeklyHours: number;
    efficiencyRating: string | number;
}

const SummaryItem: React.FC<{ label: string; value: string | number; icon?: React.ReactNode; color?: string }> = ({ label, value, icon, color }) => (
    <div className="flex-1 min-w-[160px] bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col gap-1 transition-all hover:bg-white/[0.04]">
        <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">{label}</p>
        <div className="flex items-center gap-2">
            {icon && <span className="text-white/40">{icon}</span>}
            <span className={`text-[13px] font-bold tracking-tight ${color || 'text-white/80'}`}>{value}</span>
        </div>
    </div>
);

const PortfolioSummaryStrip: React.FC<PortfolioSummaryStripProps> = ({
    assignedSubjects,
    totalImpact,
    weeklyHours,
    efficiencyRating
}) => {
    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl p-6 shadow-sm overflow-hidden">
            <div className="flex flex-nowrap items-center gap-4 overflow-x-auto custom-scrollbar-horizontal pb-2 lg:pb-0">
                <SummaryItem
                    label="Mapped Registries"
                    value={`${assignedSubjects} SUBJECTS`}
                    icon={<BookIcon className="w-3.5 h-3.5" />}
                />
                <SummaryItem
                    label="Cohort Impact"
                    value={`~${totalImpact} STUDENTS`}
                    color="text-primary/60"
                    icon={<UsersIcon className="w-3.5 h-3.5" />}
                />
                <SummaryItem
                    label="Pedagogical Delta"
                    value={`${weeklyHours} NODE_HRS`}
                    icon={<ClockIcon className="w-3.5 h-3.5" />}
                />
                <SummaryItem
                    label="Output Quality"
                    value={`${efficiencyRating}% ALPHA`}
                    color="text-emerald-500"
                    icon={<StarIcon className="w-3.5 h-3.5" />}
                />
                <div className="flex-1 min-w-[200px] bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col gap-1 text-right ml-auto">
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Live Telemetry</p>
                    <p className="text-[12px] font-bold text-primary/60 tracking-tight uppercase">Portfolio_Optimized</p>
                </div>
            </div>
        </div>
    );
};

export default PortfolioSummaryStrip;
