import React, { useEffect, useState } from 'react';

interface StatCardProps {
    title: string;
    value: string;
    icon: React.ReactNode;
    trend: string;
    colorClass?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, colorClass = "bg-primary/10 text-primary" }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        const numericValue = parseFloat(value.replace(/[^0-9.-]+/g, ""));
        if (isNaN(numericValue)) return;

        let start = 0;
        const duration = 2500; // Even slower for a more cinematic transition
        const startTime = Date.now();

        const animate = () => {
            const now = Date.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ultra-premium quart-out easing
            const easedProgress = 1 - Math.pow(1 - progress, 4);

            setDisplayValue(easedProgress * numericValue);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setDisplayValue(numericValue);
            }
        };

        requestAnimationFrame(animate);
    }, [value]);

    const isNumeric = !isNaN(parseFloat(value.replace(/[^0-9.-]+/g, "")));
    let formattedValue = value;
    if (isNumeric) {
        const prefix = value.startsWith('$') ? '$' : '';
        const suffix = value.endsWith('%') ? '%' : '';
        formattedValue = `${prefix}${Math.round(displayValue).toLocaleString()}${suffix}`;
    }

    const isPositive = trend.includes('+') || trend === 'Stable';

    return (
        <div className="group relative bg-[#0a0a0c]/80 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-9 shadow-2xl transition-all duration-700 hover:bg-[#0a0a0c] hover:-translate-y-2 overflow-hidden ring-1 ring-white/5 hover:ring-white/20">
            {/* Background Glow */}
            <div className={`absolute -right-20 -top-20 w-48 h-48 rounded-full blur-[60px] opacity-0 group-hover:opacity-20 transition-opacity duration-1000 pointer-events-none ${colorClass.split(' ')[0]}`}></div>

            <div className="flex justify-between items-start mb-10 relative z-10">
                <div className={`p-4 rounded-2xl bg-white/5 border border-white/10 ${colorClass.split(' ')[1]} transition-all duration-700 group-hover:scale-110 group-hover:rotate-6 shadow-2xl`}>
                    {icon}
                </div>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border shadow-inner transition-all duration-500 ${trend === 'Stable' ? 'bg-white/5 text-white/30 border-white/5' :
                        isPositive
                            ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20'
                            : 'bg-red-500/5 text-red-400 border-red-500/20'
                    }`}>
                    <span className="relative flex h-2 w-2">
                        {isPositive && trend !== 'Stable' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40"></span>}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${trend === 'Stable' ? 'bg-white/20' : isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                    </span>
                    {trend}
                </div>
            </div>

            <div className="relative z-10 space-y-3">
                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">{title}</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-5xl font-black text-white tracking-tighter leading-none font-sans">{formattedValue}</h3>
                </div>
                <div className="pt-6 border-t border-white/5 mt-6">
                    <p className="text-[8px] font-black text-white/10 uppercase tracking-[0.3em] flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-white/20"></div>
                        Real-time Node Telemetry
                    </p>
                </div>
            </div>
        </div>
    );
};

export default StatCard;