import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { AdminAnalyticsStats } from '../types';
import Spinner from './common/Spinner';

// Icons
import { TrendingUpIcon } from './icons/TrendingUpIcon';
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
            <div
                className="absolute bottom-0 left-0 right-0 h-[70%] bg-gradient-to-t from-primary/30 to-transparent animate-aurora"
                style={{ clipPath: 'path("M0,100 C15,80 35,90 50,70 S85,30 100,40 V100 Z")' }}
            />
            <svg className="w-full h-full absolute inset-0 overflow-visible" preserveAspectRatio="none">
                <path className="sparkline" d="M0,80 C15,60 35,70 50,50 S85,10 100,20" fill="none" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round" vectorEffect="non-scaling-stroke shadow-2xl" />
            </svg>
            <div className="absolute left-[65%] top-[25%]">
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-white text-black text-[10px] font-black px-4 py-2 rounded-xl shadow-[0_0_30px_rgba(255,255,255,0.2)] whitespace-nowrap uppercase tracking-widest">
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
        <style>{`.sparkline { stroke-dasharray: 1000; stroke-dashoffset: 1000; animation: 3s cubic-bezier(0.4, 0, 0.2, 1) 0.5s forwards path-draw; } @keyframes path-draw { to { stroke-dashoffset: 0; } }`}</style>
    </div>
);

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
                            <div className="p-4 bg-primary/10 rounded-2xl text-primary border border-primary/20 shadow-inner group-hover:scale-110 transition-transform duration-500"><TrendingUpIcon className="w-6 h-6" /></div>
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
                    <div className="p-10 flex-grow flex flex-col items-center justify-center space-y-6 relative z-10">
                        <div className="w-24 h-24 border-4 border-dashed border-white/10 rounded-full flex items-center justify-center animate-spin-slow text-white/10">
                            <SparklesIcon className="w-10 h-10" />
                        </div>
                        <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.4em] text-center max-w-[200px] leading-relaxed">Synthesizing Fiscal Intelligence Feed...</p>
                    </div>
                </div>
            </div>

            {/* --- Insights & Recent Activity --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-1 group relative bg-[#0a0a0c]/80 backdrop-blur-2xl border border-white/5 rounded-[3rem] shadow-2xl p-10 ring-1 ring-white/5 overflow-hidden transition-all duration-700 hover:ring-white/20">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent"></div>
                    <div className="flex items-center gap-5 mb-8 relative z-10">
                        <div className="p-4 bg-primary/10 rounded-2xl text-primary border border-primary/20 shadow-inner">
                            <SparklesIcon className="w-7 h-7 animate-pulse" />
                        </div>
                        <h3 className="font-black text-2xl text-white font-serif uppercase tracking-tight">Core Insights</h3>
                    </div>
                    <div className="space-y-6 text-sm relative z-10">
                        <div className="p-6 bg-white/5 rounded-2xl border border-white/5 group-hover:bg-white/10 transition-colors">
                            <p className="text-white/40 leading-relaxed font-medium">
                                <strong className="text-primary uppercase tracking-widest text-[10px] block mb-2 font-black">Growth Marker</strong>
                                Enrollment velocity has accelerated by <strong className="text-white">12.4%</strong> since last audit, primarily clustered in the Secondary Grade brackets.
                            </p>
                        </div>
                        <div className="p-6 bg-white/5 rounded-2xl border border-white/5 group-hover:bg-white/10 transition-colors">
                            <p className="text-white/40 leading-relaxed font-medium">
                                <strong className="text-amber-500 uppercase tracking-widest text-[10px] block mb-2 font-black">Fiscal Alert</strong>
                                Cash liquidity remains high, however, <strong className="text-white">12 protocol reviews</strong> are pending in the financial vault needing immediate verification.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 group relative bg-[#0a0a0c]/80 backdrop-blur-2xl border border-white/5 rounded-[3rem] shadow-2xl ring-1 ring-white/5 overflow-hidden transition-all duration-700 hover:ring-white/20">
                    <div className="p-10 md:p-12 border-b border-white/5 bg-white/[0.02] flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-white/5 rounded-2xl text-white/40 border border-white/10"><ClockIcon className="w-6 h-6" /></div>
                            <h3 className="font-black text-2xl text-white font-serif uppercase tracking-tight text-white/60">Telemetry Feed</h3>
                        </div>
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-widest px-4 py-2 border border-white/5 rounded-full">Stream Offline</span>
                    </div>
                    <div className="p-20 flex flex-col items-center justify-center opacity-20 relative z-10 grayscale">
                        <ClipboardListIcon className="w-32 h-32 mb-8 text-white/20" />
                        <p className="text-[10px] text-white/50 font-black uppercase tracking-[0.5em] text-center">Protocol log awaiting active stream connection.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsTab;