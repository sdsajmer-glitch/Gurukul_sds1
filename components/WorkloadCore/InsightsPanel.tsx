import React from 'react';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { TargetIcon } from '../icons/TargetIcon';
import { ClockIcon } from '../icons/ClockIcon';

const InsightModule: React.FC<{ title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, subtitle, icon, children }) => (
    <div className="bg-[#14161c] border border-white/5 rounded-2xl p-6 space-y-4 hover:bg-white/[0.01] transition-all group">
        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <div className="p-2 rounded-lg bg-white/[0.03] border border-white/10 text-white/20 group-hover:text-primary transition-colors">
                {icon}
            </div>
            <div className="space-y-0.5">
                <h4 className="text-[12px] font-bold text-white uppercase tracking-wider">{title}</h4>
                <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{subtitle}</p>
            </div>
        </div>
        <div className="space-y-3">
            {children}
        </div>
    </div>
);

const InsightsPanel: React.FC = () => {
    return (
        <div className="flex flex-col gap-6 h-full">
            <InsightModule
                title="Workload Health"
                subtitle="System Diagnostic"
                icon={<ShieldCheckIcon className="w-4 h-4" />}
            >
                <div className="flex items-center justify-between p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Status: Nominal</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <p className="text-[11px] font-medium text-white/30 leading-relaxed uppercase tracking-tight italic">
                    All pedagogical nodes operating within authorized saturation parameters.
                </p>
            </InsightModule>

            <InsightModule
                title="Optimization"
                subtitle="Resource Recommendation"
                icon={<TargetIcon className="w-4 h-4" />}
            >
                <ul className="space-y-3">
                    {[
                        'Reallocate 2 units to Sector-B',
                        'Optimize Tuesday Peak Gap',
                        'Sync with Peer Node ALPHA'
                    ].map((text, i) => (
                        <li key={i} className="flex gap-3 items-start">
                            <div className="w-1 h-1 rounded-full bg-primary/40 mt-1.5 shrink-0" />
                            <p className="text-[11px] font-bold text-white/40 uppercase tracking-tight">{text}</p>
                        </li>
                    ))}
                </ul>
            </InsightModule>

            <InsightModule
                title="Strategy Actions"
                subtitle="Procedural Protocol"
                icon={<ActivityIcon className="w-4 h-4" />}
            >
                <button className="w-full py-4 bg-primary/10 border border-primary/20 rounded-xl text-[10px] font-black text-primary uppercase tracking-[0.3em] hover:bg-primary/20 transition-all shadow-inner">
                    Apply Rebalancing
                </button>
                <button className="w-full py-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-white/20 uppercase tracking-[0.3em] hover:bg-white/10 hover:text-white transition-all">
                    Generate Audit PDF
                </button>
            </InsightModule>

            <InsightModule
                title="Trend Summary"
                subtitle="Monthly Precision"
                icon={<ClockIcon className="w-4 h-4" />}
            >
                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <span className="text-[10px] font-bold text-white/10 uppercase tracking-widest leading-none">Monthly Delta</span>
                        <span className="text-[14px] font-serif font-black text-emerald-500 tracking-tighter leading-none">+4.2%</span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500/30 w-[65%]" />
                    </div>
                </div>
            </InsightModule>
        </div>
    );
};

export default InsightsPanel;
