import React from 'react';
import { TargetIcon } from '../icons/TargetIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { ActivityIcon } from '../icons/ActivityIcon';

interface KPICardProps {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    color?: string;
}

const KPICard: React.FC<KPICardProps> = ({ label, value, icon, color }) => (
    <div className="flex-1 bg-[#14161c] border border-white/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4 hover:bg-white/[0.02] transition-all group shadow-sm h-[200px]">
        <div className={`p-3 rounded-xl bg-white/[0.03] border border-white/5 text-white/20 group-hover:text-primary transition-colors ${color}`}>
            {icon}
        </div>
        <div className="space-y-1">
            <h5 className="text-[32px] font-serif font-black text-white tracking-tighter leading-none">{value}</h5>
            <p className="text-[12px] font-black text-white/20 uppercase tracking-[0.3em]">{label}</p>
        </div>
    </div>
);

interface WorkloadKPIGridProps {
    departments: number;
    hours: number;
    utilization: number;
}

const WorkloadKPIGrid: React.FC<WorkloadKPIGridProps> = ({ departments, hours, utilization }) => {
    return (
        <div className="flex gap-6 w-full">
            <KPICard
                label="Departments"
                value={departments < 10 ? `0${departments}` : departments}
                icon={<TargetIcon className="w-6 h-6" />}
            />
            <KPICard
                label="Weekly Hours"
                value={hours}
                icon={<ClockIcon className="w-6 h-6" />}
                color="group-hover:text-primary"
            />
            <KPICard
                label="Utilization"
                value={`${utilization.toFixed(1)}%`}
                icon={<ActivityIcon className="w-6 h-6" />}
                color={utilization > 90 ? "group-hover:text-red-500" : "group-hover:text-emerald-500"}
            />
        </div>
    );
};

export default WorkloadKPIGrid;
