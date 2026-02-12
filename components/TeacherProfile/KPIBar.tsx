import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUpCustomIcon as TrendingUpIcon } from '../icons/TrendingUpIcon';

interface KPIItemProps {
    label: string;
    value: string | number;
    trend?: string;
    status?: 'healthy' | 'warning' | 'critical';
    tooltip: string;
}

const KPIItem: React.FC<KPIItemProps> = ({ label, value, trend, status = 'healthy', tooltip }) => {
    const statusColors = {
        healthy: 'text-emerald-500',
        warning: 'text-amber-500',
        critical: 'text-red-500'
    };

    return (
        <motion.div
            whileHover={{ y: -4, backgroundColor: 'rgba(255,255,255,0.02)' }}
            className="flex-1 min-w-[160px] p-8 transition-all cursor-help relative group"
            title={tooltip}
        >
            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mb-4">{label}</p>
            <div className="flex items-baseline gap-3">
                <h4 className="text-3xl font-serif font-black text-white tracking-tighter leading-none">{value}</h4>
                {trend && (
                    <div className={`flex items-center gap-1 text-[10px] font-black ${statusColors[status]}`}>
                        <TrendingUpIcon className="w-3.5 h-3.5" />
                        <span>{trend}</span>
                    </div>
                )}
            </div>
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/0 to-transparent group-hover:via-primary/20 transition-all" />
        </motion.div>
    );
};

interface KPIBarProps {
    stats: {
        activeSections: number;
        totalStudents: number;
        weeklyHours: number;
        completionRate: string;
        compliance: string;
        evalScore: number;
    };
}

const KPIBar: React.FC<KPIBarProps> = ({ stats }) => {
    return (
        <div className="bg-white/[0.01] border border-white/5 rounded-[2.5rem] overflow-hidden flex flex-wrap lg:flex-nowrap divide-x divide-white/5 shadow-3xl">
            <KPIItem label="Active Sections" value={stats.activeSections} trend="+1" tooltip="Active academic registers mapped." />
            <KPIItem label="Stewardship" value={stats.totalStudents} trend="+14" tooltip="Total unique student identities assigned." />
            <KPIItem label="Weekly Load" value={stats.weeklyHours} status={stats.weeklyHours > 28 ? 'warning' : 'healthy'} tooltip="Institutional clock hours per 7-day cycle." />
            <KPIItem label="Archive Rate" value={stats.completionRate} trend="99.2%" status="healthy" tooltip="Audit percentage of digitized register status." />
            <KPIItem label="Governance Index" value={stats.compliance} status="healthy" tooltip="Compliance and documentation verification index." />
            <KPIItem label="Quality Score" value={stats.evalScore} status="healthy" tooltip="Aggregate evaluation and quality feedback score." />
        </div>
    );
};

export default KPIBar;
