import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, formatError } from '../services/supabase';
import { UserProfile, Role } from '../types';
import { GoogleGenAI } from '@google/genai';
import Spinner from './common/Spinner';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { UsersIcon } from './icons/UsersIcon';
import { TeacherIcon } from './icons/TeacherIcon';
import { FinanceIcon } from './icons/FinanceIcon';
import { GraduationCapIcon } from './icons/GraduationCapIcon';
import { SchoolIcon } from './icons/SchoolIcon';
import { ClockIcon } from './icons/ClockIcon';
import { ShieldCheckIcon } from './icons/ShieldCheckIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { DocumentTextIcon } from './icons/DocumentTextIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { RefreshIcon } from './icons/RefreshIcon';
import ProfileDropdown from './common/ProfileDropdown';
import ThemeSwitcher from './common/ThemeSwitcher';
import { Skeleton, StatsSkeleton } from './common/Skeleton';

const StatBox: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string; trend?: string }> = ({ title, value, icon, color, trend }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -5, scale: 1.01 }}
        className="bg-[#0d0f14]/80 backdrop-blur-3xl border border-white/5 p-8 rounded-[2.5rem] shadow-2xl hover:shadow-primary/10 transition-all duration-500 group overflow-hidden relative ring-1 ring-white/5"
    >
        <div className={`absolute -right-8 -top-8 w-48 h-48 ${color} opacity-[0.03] rounded-full blur-[100px] group-hover:opacity-[0.08] transition-opacity duration-1000`}></div>
        <div className="flex justify-between items-start relative z-10">
            <div className={`p-4 rounded-2xl bg-white/5 text-white/30 ring-1 ring-white/10 shadow-inner group-hover:scale-110 group-hover:text-primary transition-all duration-500`}>
                {icon}
            </div>
            {trend && (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-[0.2em] border border-emerald-500/20">
                    {trend}
                </div>
            )}
        </div>
        <div className="mt-10 relative z-10">
            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mb-2">{title}</p>
            <h3 className="text-5xl font-serif font-black text-white tracking-tighter leading-none">{value}</h3>
        </div>
    </motion.div>
);

interface MinimalAdminDashboardProps {
    profile: UserProfile;
    onSignOut: () => void;
    onSelectRole: (role: Role, isExisting?: boolean) => void;
}

const MinimalAdminDashboard: React.FC<MinimalAdminDashboardProps> = ({ profile, onSignOut, onSelectRole }) => {
    const [stats, setStats] = useState({ students: 0, teachers: 0, revenue: 0, applications: 0 });
    const [pendingDocs, setPendingDocs] = useState<any[]>([]);
    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchTelemetry = useCallback(async () => {
        if (!isRefreshing) setLoading(true);
        try {
            const [std, tea, fin, adm, docs] = await Promise.all([
                supabase.from('student_profiles').select('*', { count: 'exact', head: true }),
                supabase.from('teacher_profiles').select('*', { count: 'exact', head: true }),
                supabase.rpc('get_finance_dashboard_data'),
                supabase.from('admissions').select('*', { count: 'exact', head: true }).eq('status', 'Pending Review'),
                supabase.from('document_requirements').select('*, admissions(applicant_name)').eq('status', 'Submitted').limit(5)
            ]);

            const currentStats = {
                students: std.count || 0,
                teachers: tea.count || 0,
                revenue: fin.data?.revenue_ytd || 0,
                applications: adm.count || 0
            };
            setStats(currentStats);
            setPendingDocs(docs.data || []);

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: `Perform an executive audit of the institutional node data: 
                - Enrollment: ${currentStats.students}
                - Faculty: ${currentStats.teachers}
                - Admission Queue: ${currentStats.applications}
                - Revenue: ${currentStats.revenue}
                Provide a 20-word clinical executive summary focusing on node health and current trajectory.`,
            });
            setAiInsight(response.text || null);
        } catch (e) {
            console.error("Governance Handshake Failure:", formatError(e));
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [isRefreshing]);

    useEffect(() => {
        fetchTelemetry();
    }, [fetchTelemetry]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    if (loading && !isRefreshing) return (
        <div className="flex flex-col justify-center items-center h-screen space-y-8 bg-[#08090a]">
            <Spinner size="lg" className="text-primary" />
            <p className="text-[10px] font-black uppercase tracking-[0.8em] text-white/30 animate-pulse">Establishing Governance Hub</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#08090a] text-foreground font-sans selection:bg-primary/20 pb-32">
            <div className="max-w-[1800px] mx-auto p-6 md:p-12 lg:p-16 space-y-16 animate-in fade-in duration-1000 relative z-10">

                {/* Header Container */}
                <div className="flex justify-between items-center bg-[#0d0f14]/90 p-4 rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-xl sticky top-6 z-50 ring-1 ring-white/10">
                    <div className="flex items-center gap-6 pl-4">
                        <div className="p-3 bg-primary/10 rounded-2xl shadow-inner border border-primary/20 group cursor-pointer" onClick={() => { setIsRefreshing(true); fetchTelemetry(); }}>
                            <SchoolIcon className={`w-6 h-6 text-primary ${isRefreshing ? 'animate-spin' : ''}`} />
                        </div>
                        <div>
                            <span className="font-serif font-black text-white text-xl tracking-[0.1em] uppercase leading-none block">Universepi <span className="text-white/20 italic font-medium">OS</span></span>
                            <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mt-1.5 block">Executive Telemetry Hub</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-6 pr-2">
                        <ThemeSwitcher />
                        <ProfileDropdown profile={profile} onSignOut={onSignOut} onSelectRole={onSelectRole} />
                    </div>
                </div>

                {/* Main Identity Banner */}
                <header className="relative flex flex-col xl:flex-row justify-between items-start xl:items-center gap-16 bg-[#0a0c10] border border-white/5 p-12 md:p-24 rounded-[5rem] overflow-hidden ring-1 ring-white/10 shadow-3xl">
                    <div className="absolute -right-20 -top-20 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
                    <div className="relative z-10 space-y-12 max-w-4xl">
                        <div className="flex items-center gap-4">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_#10b981] animate-pulse"></div>
                            <span className="text-[10px] font-black uppercase tracking-[0.6em] text-white/40">Identity Node Active</span>
                        </div>
                        <h1 className="text-7xl md:text-9xl font-serif font-black text-white tracking-tighter leading-[0.8] uppercase">
                            Executive <br /> <span className="text-white/30 italic lowercase">oversight.</span>
                        </h1>
                        <p className="text-xl text-white/40 font-medium font-serif italic max-w-xl leading-relaxed border-l-2 border-white/10 pl-10">
                            Unified analytical interface for institutional orchestration. High-fidelity tracking of node growth and fiscal synchronization.
                        </p>
                    </div>

                    <div className="xl:w-[460px] w-full">
                        {loading && !isRefreshing ? (
                            <Skeleton.Card className="bg-primary/5 border-primary/20 p-10 rounded-[3.5rem]" />
                        ) : aiInsight && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-primary/5 border border-primary/20 p-10 rounded-[3.5rem] relative group overflow-hidden shadow-2xl"
                            >
                                <SparklesIcon className="absolute -right-6 -bottom-6 w-32 h-32 text-primary/5 group-hover:scale-110 transition-transform duration-1000" />
                                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-primary mb-6">Autonomous Synthesis</p>
                                <p className="text-lg font-serif italic text-white/80 leading-relaxed font-medium">"{aiInsight}"</p>
                            </motion.div>
                        )}
                    </div>
                </header>

                {/* Telemetry Stats Grid */}
                {loading && !isRefreshing ? (
                    <StatsSkeleton />
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        <StatBox title="Current Enrollment" value={stats.students} icon={<GraduationCapIcon className="w-8 h-8" />} color="bg-blue-500" trend="+4.2%" />
                        <StatBox title="Faculty Nodes" value={stats.teachers} icon={<TeacherIcon className="w-8 h-8" />} color="bg-emerald-500" />
                        <StatBox title="Admission Queue" value={stats.applications} icon={<UsersIcon className="w-8 h-8" />} color="bg-amber-500" trend="Action" />
                        <StatBox title="Fiscal Stream" value={formatCurrency(stats.revenue)} icon={<FinanceIcon className="w-8 h-8" />} color="bg-indigo-500" />
                    </div>
                )}

                {/* Workspace Split View */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
                    {/* Vault Sync List */}
                    <div className="lg:col-span-8 bg-[#0c0e12] border border-white/5 rounded-[4.5rem] p-12 md:p-16 shadow-3xl relative overflow-hidden group ring-1 ring-white/10">
                        <div className="flex justify-between items-start mb-16 relative z-10">
                            <div className="space-y-2">
                                <h3 className="text-4xl font-serif font-black text-white tracking-tight uppercase leading-none">Vault Sync</h3>
                                <p className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em]">Pending Identity Artifacts</p>
                            </div>
                            <button onClick={() => { setIsRefreshing(true); fetchTelemetry(); }} className="p-5 bg-white/5 rounded-2xl border border-white/10 hover:text-primary transition-all group/refresh shadow-xl active:scale-95">
                                <RefreshIcon className={`w-6 h-6 ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'}`} />
                            </button>
                        </div>

                        <div className="space-y-4 relative z-10">
                            {loading && !isRefreshing ? (
                                <div className="space-y-4">
                                    <Skeleton.Line className="h-20 w-full rounded-[2rem]" />
                                    <Skeleton.Line className="h-20 w-[95%] rounded-[2rem]" />
                                    <Skeleton.Line className="h-20 w-[98%] rounded-[2rem]" />
                                </div>
                            ) : pendingDocs.length === 0 ? (
                                <div className="py-32 text-center flex flex-col items-center gap-6 opacity-20">
                                    <ShieldCheckIcon className="w-16 h-16 text-white" />
                                    <p className="uppercase font-black tracking-[0.5em] text-white text-sm">Registry Synchronized</p>
                                </div>
                            ) : pendingDocs.map((doc, i) => (
                                <motion.div
                                    key={doc.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="flex items-center justify-between p-8 bg-white/[0.02] border border-white/5 rounded-[2.8rem] hover:bg-white/[0.04] transition-all group/item shadow-inner"
                                >
                                    <div className="flex items-center gap-8">
                                        <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-400 group-hover/item:scale-110 transition-transform">
                                            <DocumentTextIcon className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <p className="text-[18px] font-bold text-white uppercase tracking-wider">{doc.admissions?.applicant_name}</p>
                                            <p className="text-[10px] text-white/20 uppercase font-black mt-1.5">{doc.document_name} Handshake</p>
                                        </div>
                                    </div>
                                    <ChevronRightIcon className="w-6 h-6 text-white/10 group-hover/item:text-primary group-hover:translate-x-1 transition-all" />
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Security Activity Feed */}
                    <div className="lg:col-span-4 bg-[#0a0a0c] border border-white/10 rounded-[4.5rem] p-12 md:p-14 shadow-inner relative overflow-hidden flex flex-col group/security">
                        <h3 className="text-[11px] font-black uppercase text-indigo-400 tracking-[0.5em] mb-16 flex items-center gap-4">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_#6366f1]"></div>
                            Security Stream
                        </h3>

                        <div className="space-y-12 flex-grow relative z-10">
                            {loading && !isRefreshing ? (
                                <div className="space-y-12">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="flex gap-8">
                                            <Skeleton.Avatar size="sm" className="rounded-2xl" />
                                            <div className="space-y-3 flex-grow">
                                                <Skeleton.Line width="65%" />
                                                <Skeleton.Line width="35%" variant="caption" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : [
                                { action: 'Identity Vault Synced', time: '12m ago', icon: <DocumentTextIcon className="w-4 h-4 text-emerald-400" /> },
                                { action: 'Governance Seal Applied', time: '3h ago', icon: <ShieldCheckIcon className="w-4 h-4 text-amber-400" /> },
                                { action: 'Admission Cycle Initialized', time: '5h ago', icon: <GraduationCapIcon className="w-4 h-4 text-blue-400" /> },
                                { action: 'Node Sync Handshake', time: '8h ago', icon: <ClockIcon className="w-4 h-4 text-white/30" /> }
                            ].map((log, i) => (
                                <div key={i} className="flex gap-8 items-start relative group/log">
                                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover/log:bg-white/10 transition-colors">
                                        {log.icon}
                                    </div>
                                    <div className="min-w-0 border-b border-white/5 pb-8 flex-grow">
                                        <p className="text-[15px] font-bold text-white/90 truncate uppercase tracking-tight group-hover/log:text-white transition-colors">{log.action}</p>
                                        <p className="text-[9px] font-bold text-white/10 uppercase font-mono mt-2">{log.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-12 pt-8 border-t border-white/5 text-center">
                            <span className="text-[9px] font-black text-white/5 uppercase tracking-[0.5em]">Audit Trail v9.5.1 Deployment</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MinimalAdminDashboard;