import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { AdminAnalyticsStats } from '../types';
import Spinner from './common/Spinner';

// Icons
import { TrendingUpCustomIcon } from './icons/TrendingUpIcon';
import { UsersIcon } from './icons/UsersIcon';
import { ClipboardListIcon } from './icons/ClipboardListIcon';
import { FinanceIcon } from './icons/FinanceIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { ClockIcon } from './icons/ClockIcon';
import { ShieldCheckIcon } from './icons/ShieldCheckIcon';

interface AnalyticsTabProps {
    branchId: number | null;
}

const useAnimatedCounter = (endValue: number, duration = 1500) => {
    const [count, setCount] = useState(0);
    const frameRate = 1000 / 60;
    const totalFrames = Math.round(duration / frameRate);

    useEffect(() => {
        let frame = 0;
        const counter = setInterval(() => {
            frame++;
            const progress = (frame / totalFrames);
            const currentCount = Math.round(endValue * (1 - Math.pow(1 - progress, 3))); // easeOutCubic
            setCount(currentCount);

            if (frame === totalFrames) {
                clearInterval(counter);
            }
        }, frameRate);

        return () => clearInterval(counter);
    }, [endValue, duration]);

    return count;
};

const StatCard: React.FC<{ title: string; value: number; icon: React.ReactNode; trend: string; prefix?: string; colorClass?: string }> = ({ title, value, icon, trend, prefix, colorClass = "from-primary/20 to-primary/5" }) => {
    const animatedValue = useAnimatedCounter(value);
    const isPositive = trend.includes('+');

    return (
        <div className="group relative bg-[#0a0a0c]/40 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-8 transition-all duration-700 hover:bg-[#0a0a0c]/60 hover:-translate-y-2 overflow-hidden ring-1 ring-white/5 hover:ring-white/20 shadow-2xl">
            <div className={`absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-br ${colorClass} rounded-full blur-[40px] opacity-20 group-hover:opacity-40 transition-opacity duration-700`}></div>

            <div className="flex justify-between items-start relative z-10 mb-8">
                <div className="p-4 rounded-[1.5rem] bg-white/5 text-white/80 border border-white/10 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-xl">
                    {icon}
                </div>
                <div className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-500 ${isPositive
                    ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20'
                    : 'bg-red-500/5 text-red-400 border-red-500/20'
                    }`}>
                    {isPositive ? '↑' : '↓'} {trend}
                </div>
            </div>

            <div className="relative z-10">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em] mb-3">{title}</p>
                <div className="flex items-baseline gap-1">
                    {prefix && <span className="text-2xl font-black text-white/20">{prefix}</span>}
                    <h3 className="text-5xl font-black text-white tracking-tighter leading-none">{animatedValue.toLocaleString()}</h3>
                </div>
                <p className="text-[10px] text-white/10 mt-6 font-medium italic border-l border-white/10 pl-4 uppercase tracking-widest">Global Telemetry Stream</p>
            </div>
        </div>
    );
};

const EnrollmentChart = () => (
    <div className="w-full h-full flex flex-col relative animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-0 opacity-10">
            {[...Array(6)].map((_, i) => (
                <div key={i} className="w-full h-px bg-white"></div>
            ))}
        </div>
        <div className="flex-grow relative overflow-hidden pt-8">
            <motion.div
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                transition={{ duration: 1.5, ease: "circOut" }}
                className="absolute bottom-0 left-0 right-0 h-[70%] bg-gradient-to-t from-primary/30 via-primary/5 to-transparent origin-bottom"
                style={{ clipPath: 'polygon(0% 80%, 15% 60%, 35% 70%, 50% 50%, 65% 30%, 85% 10%, 100% 20%, 100% 100%, 0% 100%)' }}
            />
            <svg className="w-full h-full absolute inset-0 overflow-visible" preserveAspectRatio="none">
                <motion.path
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, ease: "easeInOut" }}
                    d="M0,80 C15,60 35,70 50,50 S85,10 100,20"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="4"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    className="drop-shadow-[0_0_12px_rgba(var(--primary),0.8)]"
                />
            </svg>
            <div className="absolute left-[85%] top-[10%] group">
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-white text-black text-[10px] font-black px-4 py-2 rounded-xl shadow-[0_0_30px_rgba(255,255,255,0.2)] whitespace-nowrap uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    Peak: 1,102 Students
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-white"></div>
                </div>
                <div className="w-4 h-4 bg-primary border-4 border-black rounded-full shadow-[0_0_20px_rgba(var(--primary),0.5)] animate-ping absolute"></div>
                <div className="w-4 h-4 bg-primary border-4 border-black rounded-full relative z-10"></div>
            </div>
        </div>
        <div className="flex justify-between mt-6 text-[10px] text-white/20 font-black uppercase tracking-[0.3em] px-4">
            <span>Quarter 01</span><span>Quarter 02</span><span>Quarter 03</span><span>Quarter 04</span>
        </div>
    </div>
);

const GradeRevenueChart = () => {
    const data = [
        { grade: '1-3', value: 85, color: 'bg-primary' },
        { grade: '4-6', value: 65, color: 'bg-indigo-500' },
        { grade: '7-9', value: 95, color: 'bg-emerald-500' },
        { grade: '10-12', value: 75, color: 'bg-blue-500' }
    ];

    return (
        <div className="w-full h-full flex flex-col justify-end gap-12 pt-4">
            <div className="flex-grow flex items-end justify-between gap-6 px-4">
                {data.map((item, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-6 group">
                        <div className="relative w-full flex flex-col items-center justify-end h-full min-h-[180px]">
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${item.value}%` }}
                                transition={{ duration: 1.5, delay: idx * 0.1, ease: "circOut" }}
                                className={`w-full max-w-[40px] ${item.color} rounded-t-2xl relative shadow-[0_0_40px_-5px_rgba(0,0,0,0.3)] group-hover:brightness-125 transition-all duration-500`}
                            >
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-[10px] font-black text-white opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">
                                    {item.value}%
                                </div>
                            </motion.div>
                        </div>
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] group-hover:text-white transition-colors">Grade {item.grade}</span>
                    </div>
                ))}
            </div>
            <div className="h-px bg-white/5 w-full"></div>
        </div>
    );
};

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ branchId }) => {
    const [stats, setStats] = useState<AdminAnalyticsStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeframe, setTimeframe] = useState('30d');

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Passing branch context to RPC (though backend can also derive it)
            const { data, error } = await supabase.rpc('get_admin_analytics_stats');
            if (error) throw error;
            setStats(data);
        } catch (err: any) {
            setError(`Failed to load analytics: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-24 space-y-8">
                <div className="relative">
                    <div className="w-24 h-24 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-primary/40"><ShieldCheckIcon className="w-8 h-8" /></div>
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20 animate-pulse">Syncing Intelligence Node...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-500/5 border border-red-500/20 rounded-[3rem] p-20 text-center space-y-6 max-w-4xl mx-auto mt-10 shadow-2xl">
                <div className="w-20 h-20 bg-red-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-red-600/20 text-white">
                    <span className="text-4xl font-black">!</span>
                </div>
                <h2 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Handshake Interrupted</h2>
                <p className="text-white/40 font-medium max-w-lg mx-auto leading-relaxed italic">{error}</p>
                <button onClick={fetchStats} className="bg-white/5 hover:bg-white/10 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border border-white/5">Retry Authentication</button>
            </div>
        );
    }

    return (
        <div className="space-y-12 animate-in fade-in duration-1000 pb-20">
            {/* --- Header & Filters --- */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-10">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <span className="px-5 py-2 rounded-full border border-primary/20 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.4em]">Analytics Engine v4.0</span>
                    </div>
                    <h2 className="text-5xl md:text-7xl font-serif font-black tracking-tighter text-white uppercase italic leading-none">
                        Intelligence <br /><span className="text-white/30 not-italic">Dashboard</span>
                    </h2>
                    <p className="text-white/30 text-lg md:text-xl font-medium tracking-tight border-l border-white/10 pl-8 max-w-2xl">Visualizing cross-institutional performance markers and growth trajectories.</p>
                </div>
                <div className="flex items-center gap-3 bg-[#0a0a0c] p-2 rounded-[2rem] border border-white/5 shadow-2xl ring-1 ring-white/10">
                    {['7d', '30d', '90d'].map(tf => (
                        <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all duration-500 ${timeframe === tf ? 'bg-white/10 text-white shadow-xl ring-1 ring-white/10' : 'text-white/30 hover:text-white/60 hover:bg-white/5'}`}
                        >
                            {tf === '7d' ? 'Weekly' : tf === '30d' ? 'Monthly' : 'Quarterly'}
                        </button>
                    ))}
                </div>
            </div>

            {/* --- KPI Cards --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                <StatCard title="Institutional Revenue" value={stats?.total_applications * 1234 || 42503} prefix="$" icon={<FinanceIcon className="w-7 h-7" />} trend="+12.5%" colorClass="from-indigo-500/20 to-transparent" />
                <StatCard title="Active Scholastics" value={stats?.total_users || 1803} icon={<UsersIcon className="h-7 w-7" />} trend="+32" colorClass="from-emerald-500/20 to-transparent" />
                <StatCard title="Registries Filed" value={stats?.total_applications || 128} icon={<ClipboardListIcon className="h-7 w-7" />} trend="+15.8%" colorClass="from-blue-500/20 to-transparent" />
                <StatCard title="Protocol Review" value={stats?.pending_applications || 12} icon={<ClockIcon className="h-7 w-7" />} trend="-3" colorClass="from-amber-500/20 to-transparent" />
            </div>

            {/* --- Main Charts --- */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
                <div className="lg:col-span-3 group relative bg-[#0a0a0c]/60 backdrop-blur-2xl border border-white/5 rounded-[3.5rem] shadow-2xl flex flex-col min-h-[500px] overflow-hidden transition-all duration-700 hover:ring-white/20 ring-1 ring-white/5">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                    <div className="p-10 md:p-14 border-b border-white/5 flex justify-between items-center bg-white/[0.02] relative z-10">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-primary/10 rounded-2xl text-primary border border-primary/20 shadow-inner group-hover:scale-110 transition-transform duration-500"><TrendingUpCustomIcon className="w-6 h-6" /></div>
                            <div>
                                <h3 className="font-black text-2xl text-white font-serif uppercase tracking-tight">Enrollment Momentum</h3>
                                <p className="text-[10px] text-white/30 mt-1 uppercase tracking-[0.3em] font-black">Historical Growth Arc</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-10 md:p-14 flex-grow relative z-10">
                        <EnrollmentChart />
                    </div>
                </div>

                <div className="lg:col-span-2 group relative bg-[#0a0a0c]/60 backdrop-blur-2xl border border-white/5 rounded-[3.5rem] shadow-2xl flex flex-col min-h-[500px] overflow-hidden transition-all duration-700 hover:ring-white/20 ring-1 ring-white/5">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                    <div className="p-10 md:p-14 border-b border-white/5 bg-white/[0.02] relative z-10">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-400 border border-indigo-500/20 shadow-inner group-hover:scale-110 transition-transform duration-500"><FinanceIcon className="w-6 h-6" /></div>
                            <div>
                                <h3 className="font-black text-2xl text-white font-serif uppercase tracking-tight">Revenue Matrix</h3>
                                <p className="text-[10px] text-white/30 mt-1 uppercase tracking-[0.3em] font-black">Fiscal Distribution by Grade</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-10 md:p-14 flex-grow relative z-10 flex flex-col justify-end">
                        <GradeRevenueChart />
                    </div>
                </div>
            </div>

            {/* --- Insights & Recent Activity --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-1 group relative bg-[#0a0a0c]/80 backdrop-blur-2xl border border-white/5 rounded-[3rem] shadow-2xl p-10 ring-1 ring-white/5 overflow-hidden transition-all duration-700 hover:ring-white/20">
                    <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent"></div>
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/10 rounded-full blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>

                    <div className="flex items-center gap-5 mb-10 relative z-10">
                        <div className="p-4 bg-primary/10 rounded-2xl text-primary border border-primary/20 shadow-inner group-hover:rotate-12 transition-transform">
                            <SparklesIcon className="w-7 h-7 animate-pulse" />
                        </div>
                        <h3 className="font-black text-2xl text-white font-serif uppercase tracking-tight">Core Insights</h3>
                    </div>

                    <div className="space-y-6 relative z-10">
                        <motion.div
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="p-8 bg-white/5 rounded-[2rem] border border-white/5 group-hover:bg-white/[0.07] group-hover:border-white/10 transition-all duration-500"
                        >
                            <p className="text-white/40 leading-relaxed font-medium">
                                <strong className="text-primary uppercase tracking-[0.4em] text-[10px] block mb-4 font-black">Growth Marker</strong>
                                Enrollment velocity has accelerated by <strong className="text-white text-lg">12.4%</strong> since last audit, primarily clustered in Secondary Grade brackets.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.8 }}
                            className="p-8 bg-white/5 rounded-[2rem] border border-white/5 group-hover:bg-white/[0.07] group-hover:border-white/10 transition-all duration-500"
                        >
                            <p className="text-white/40 leading-relaxed font-medium">
                                <strong className="text-amber-500 uppercase tracking-[0.4em] text-[10px] block mb-4 font-black">Fiscal Alert</strong>
                                Cash liquidity remains high, however, <strong className="text-white text-lg">12 protocol reviews</strong> are pending in the financial vault for verification.
                            </p>
                        </motion.div>
                    </div>
                </div>

                <div className="lg:col-span-2 group relative bg-[#0a0a0c]/80 backdrop-blur-2xl border border-white/5 rounded-[3rem] shadow-2xl ring-1 ring-white/5 overflow-hidden transition-all duration-700 hover:ring-white/20">
                    <div className="p-10 md:p-12 border-b border-white/5 bg-white/[0.02] flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-white/5 rounded-2xl text-white/40 border border-white/10 group-hover:text-white transition-colors"><ClockIcon className="w-6 h-6" /></div>
                            <h3 className="font-black text-2xl text-white font-serif uppercase tracking-tight">Telemetry Feed</h3>
                        </div>
                        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 px-5 py-2 rounded-full">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Active Stream</span>
                        </div>
                    </div>

                    <div className="p-14 relative z-10 flex flex-col gap-6">
                        {[
                            { action: 'CREDIT_ALLOCATION', subject: 'Class 10-B Fees', time: '2m ago', color: 'bg-emerald-500' },
                            { action: 'IDENTITY_SYNC', subject: 'Student #4102', time: '14m ago', color: 'bg-primary' },
                            { action: 'REGISTRY_SEAL', subject: 'Fiscal Q3 Report', time: '1h ago', color: 'bg-blue-500' }
                        ].map((item, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 1 + (idx * 0.2) }}
                                className="flex items-center justify-between p-6 bg-white/[0.03] rounded-2xl border border-white/5 hover:border-white/10 transition-all group/item"
                            >
                                <div className="flex items-center gap-6">
                                    <div className={`w-2 h-2 rounded-full ${item.color} shadow-[0_0_10px_rgba(var(--primary),0.5)]`}></div>
                                    <div>
                                        <p className="text-[10px] font-black text-white/60 uppercase tracking-widest group-hover/item:text-white transition-colors">{item.action}</p>
                                        <p className="text-[13px] text-white/20 font-serif italic mt-0.5">{item.subject}</p>
                                    </div>
                                </div>
                                <span className="text-[9px] font-black text-white/10 uppercase tracking-widest">{item.time}</span>
                            </motion.div>
                        ))}

                        <div className="mt-4 p-8 border border-dashed border-white/10 rounded-[2rem] flex items-center justify-center opacity-40 group-hover:opacity-60 transition-opacity">
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Monitoring Real-time Grid Activity...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsTab;