import React, { useEffect, useState } from 'react';
import { SchoolAdminProfileData, SchoolBranch, UserProfile, BuiltInRoles } from '../../types';
import { supabase } from '../../services/supabase';
import StatCard from './StatCard';
import AreaChart from './charts/AreaChart';
import BarChart from './charts/BarChart';
import { StudentsIcon } from '../icons/StudentsIcon';
import { TeacherIcon } from '../icons/TeacherIcon';
import { CoursesIcon } from '../icons/CoursesIcon';
import { FinanceIcon } from '../icons/FinanceIcon';
import { LocationIcon } from '../icons/LocationIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { SchoolIcon } from '../icons/SchoolIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { KeyIcon } from '../icons/KeyIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { TrendingUpCustomIcon } from '../icons/TrendingUpIcon';
import { StatsSkeleton, Skeleton } from '../common/Skeleton';

interface DashboardOverviewProps {
    schoolProfile: SchoolAdminProfileData | null;
    currentBranch: SchoolBranch | null;
    profile: UserProfile;
    onNavigate: (component: string) => void;
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ schoolProfile, currentBranch, profile, onNavigate }) => {
    const [stats, setStats] = useState({
        students: 0,
        teachers: 0,
        courses: 0,
        revenue: 0,
        outstanding: 0,
        overdueCount: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            const branchId = currentBranch ? currentBranch.id : null;
            if (!branchId) {
                setLoading(false);
                return;
            }

            try {
                // Fetch Operational Stats & Financial Intelligence in Parallel
                const [studentRes, teacherRes, courseRes, financeRes] = await Promise.all([
                    supabase.rpc('get_all_students_for_admin', { p_branch_id: branchId }),
                    supabase.from('teacher_profiles').select('user_id', { count: 'exact', head: true }).eq('branch_id', branchId),
                    supabase.from('courses').select('id', { count: 'exact', head: true }).eq('branch_id', branchId),
                    supabase.rpc('get_finance_dashboard_snapshot', { p_branch_id: branchId })
                ]);

                const fData = financeRes.data || {};

                setStats({
                    students: studentRes.data?.length || 0,
                    teachers: teacherRes.count || 0,
                    courses: courseRes.count || 0,
                    revenue: fData.total_paid || 0,
                    outstanding: fData.total_outstanding || 0,
                    overdueCount: fData.overdue_count || 0
                });
            } catch (err) {
                console.error("Dashboard Metadata Error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [currentBranch]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const isBranchAdmin = profile.role === BuiltInRoles.SCHOOL_ADMINISTRATION && !!profile.branch_id;
    const branchStatus = currentBranch?.status || 'Active';
    const isBranchLinked = branchStatus === 'Active' || branchStatus === 'Linked' || !!profile.branch_id;

    return (
        <div className="space-y-8 pb-20 animate-in fade-in duration-700">
            {/* --- PREMIUM COMMAND CENTER HEADER --- */}
            <div className="relative overflow-hidden rounded-[3rem] bg-card border border-border p-8 md:p-14 shadow-2xl shadow-black/20 ring-1 ring-border/5">
                <div className="absolute -right-40 -top-40 w-[600px] h-[600px] bg-primary/10 rounded-full filter blur-[120px] opacity-40 animate-aurora pointer-events-none"></div>

                <div className="relative z-10 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-12">
                    <div className="space-y-8 w-full max-w-4xl">
                        {loading && !currentBranch ? (
                            <div className="space-y-6">
                                <Skeleton.Line variant="title" width="30%" />
                                <Skeleton.Line variant="title" width="60%" className="h-16" />
                                <Skeleton.Line variant="body" width="45%" />
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-[10px] font-black uppercase text-primary tracking-[0.4em] bg-primary/10 px-5 py-2 rounded-full border border-primary/20 shadow-inner">Institutional Control</span>
                                    {currentBranch && (
                                        isBranchLinked ? (
                                            <span className="flex items-center gap-2 text-[9px] font-bold text-accent-success uppercase tracking-[0.2em] bg-accent-success/5 px-4 py-2 rounded-full border border-accent-success/10 backdrop-blur-md">
                                                <div className="w-1.5 h-1.5 rounded-full bg-accent-success animate-pulse shadow-[0_0_8px_rgba(var(--accent-success-rgb),0.5)]"></div> Node Synced
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-2 text-[9px] font-bold text-accent-warning uppercase tracking-[0.2em] bg-accent-warning/5 px-4 py-2 rounded-full border border-accent-warning/10 backdrop-blur-md">
                                                <div className="w-1.5 h-1.5 rounded-full bg-accent-warning animate-pulse shadow-[0_0_8px_rgba(var(--accent-warning-rgb),0.5)]"></div> Verification Pending
                                            </span>
                                        )
                                    )}
                                </div>

                                <div>
                                    <h1 className="text-5xl md:text-7xl font-serif font-black text-foreground tracking-tight leading-none mb-2 uppercase">
                                        Welcome, <br /><span className="text-muted-foreground/30 italic lowercase">{(profile.display_name || 'Admin').split(' ')[0]}!</span>
                                    </h1>
                                    <p className="text-muted-foreground text-lg md:text-xl font-medium tracking-tight font-serif italic mt-6 border-l border-border pl-8">System Status: {currentBranch ? 'Operating under local node context.' : 'Standby mode. Node resolution required.'}</p>
                                </div>
                            </>
                        )}

                        {currentBranch ? (
                            <div className="flex flex-col gap-6 pt-2 animate-in slide-in-from-left-6 duration-1000">
                                <div className="flex flex-col md:flex-row items-start md:items-center gap-8 group">
                                    <div className="p-5 bg-muted/40 rounded-[2.2rem] text-primary shadow-2xl border border-border group-hover:scale-105 group-hover:rotate-2 transition-all duration-700 ring-1 ring-inset ring-border/5">
                                        <SchoolIcon className="w-12 h-12" />
                                    </div>
                                    <div className="min-w-0 flex-grow">
                                        <div className="flex items-center gap-4 mb-2">
                                            <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tighter uppercase leading-none truncate font-sans drop-shadow-lg">
                                                {currentBranch.name}
                                            </h2>
                                            <span className="font-mono text-[10px] font-black text-muted-foreground/40 bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 shrink-0 shadow-inner">
                                                NODE_{currentBranch.id.toString().padStart(4, '0')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground/60 font-bold uppercase tracking-[0.2em] text-[11px] leading-relaxed">
                                            <LocationIcon className="w-4 h-4 text-primary opacity-60 shrink-0" />
                                            {[currentBranch.address, currentBranch.city, currentBranch.state].filter(Boolean).join(', ')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <div className="flex flex-col gap-4 w-full lg:w-auto">
                        {!isBranchAdmin ? (
                            <button
                                onClick={() => onNavigate('Branches')}
                                className="px-10 py-5 bg-primary text-primary-foreground rounded-2xl shadow-2xl shadow-primary/30 hover:bg-primary/90 hover:shadow-primary/50 font-black text-xs uppercase tracking-[0.3em] transition-all transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-4 whitespace-nowrap ring-4 ring-primary/10"
                            >
                                <GridIcon className="w-5 h-5" /> Institutional Nodes
                            </button>
                        ) : isBranchLinked && (
                            <button className="px-10 py-4 bg-muted/40 hover:bg-muted/60 text-foreground/70 hover:text-foreground border border-border rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 group/dl">
                                <DownloadIcon className="w-5 h-5 group-hover/dl:translate-y-1 transition-transform" /> Export Intelligence
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* --- SCOPED TELEMETRY GRID --- */}
            <div className="relative group/telemetry">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 rounded-[4rem] opacity-0 group-hover/telemetry:opacity-100 transition-opacity duration-1000 pointer-events-none"></div>
                {loading ? (
                    <StatsSkeleton />
                ) : (
                    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 transition-all duration-1000 ${!currentBranch ? 'opacity-30 grayscale blur-[2px] pointer-events-none' : 'opacity-100'}`}>
                        <StatCard
                            title="Active Enrollment"
                            value={stats.students.toString()}
                            icon={<StudentsIcon className="h-7 w-7" />}
                            trend="+5.2%"
                            colorClass="bg-blue-500/10 text-blue-400"
                        />
                        <StatCard
                            title="Faculty Assets"
                            value={stats.teachers.toString()}
                            icon={<TeacherIcon className="h-7 w-7" />}
                            trend="+2 new"
                            colorClass="bg-emerald-500/10 text-emerald-400"
                        />
                        <StatCard
                            title="Revenue (Gross)"
                            value={formatCurrency(stats.revenue)}
                            icon={<TrendingUpCustomIcon className="h-7 w-7" />}
                            trend="Live Sync"
                            colorClass="bg-indigo-500/10 text-indigo-400"
                        />
                        <StatCard
                            title="Due Balances"
                            value={formatCurrency(stats.outstanding)}
                            icon={<AlertTriangleIcon className="h-7 w-7" />}
                            trend={`${stats.overdueCount} Overdue`}
                            colorClass={stats.outstanding > 0 ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}
                        />
                    </div>
                )}
            </div>

            {/* --- ANALYTICS VISUALIZATION --- */}
            <div className={`grid grid-cols-1 lg:grid-cols-5 gap-10 transition-all duration-1000 ${!currentBranch ? 'opacity-20 blur-xl pointer-events-none' : 'opacity-100'}`}>
                <div className="lg:col-span-3 group/chart relative bg-card/80 backdrop-blur-2xl border border-border rounded-[3.5rem] shadow-2xl flex flex-col h-[520px] overflow-hidden ring-1 ring-border/5 hover:ring-border/20 transition-all duration-700">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover/chart:opacity-100 transition-opacity duration-1000"></div>
                    <div className="p-10 md:p-12 border-b border-border flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-primary/10 rounded-2xl text-primary border border-primary/20 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                <TrendingUpCustomIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-black text-2xl text-foreground font-serif tracking-tight uppercase">Demographic Distribution</h3>
                                <p className="text-[10px] text-muted-foreground/40 mt-1 uppercase tracking-[0.3em] font-black italic">Intelligence Protocol: Enrollment Grade Sync</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-accent-success animate-pulse"></div>
                            <span className="text-[9px] font-black text-muted-foreground/20 uppercase tracking-widest">Live Syncing</span>
                        </div>
                    </div>
                    <div className="p-10 flex-grow relative z-10"><AreaChart /></div>
                    <div className="absolute bottom-6 right-12 text-[8px] font-black text-muted-foreground/10 uppercase tracking-[0.4em] select-none">Metric Stream v2.4</div>
                </div>

                <div className="lg:col-span-2 group/metric relative bg-card/80 backdrop-blur-2xl border border-border rounded-[3.5rem] shadow-2xl flex flex-col h-[520px] overflow-hidden ring-1 ring-border/5 hover:ring-border/20 transition-all duration-700">
                    <div className="absolute inset-0 bg-gradient-to-tr from-accent-warning/5 via-transparent to-transparent opacity-0 group-hover/metric:opacity-100 transition-opacity duration-1000"></div>
                    <div className="p-10 md:p-12 border-b border-border flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-accent-warning/10 rounded-2xl text-accent-warning border border-accent-warning/20 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                <SparklesIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-black text-2xl text-foreground font-serif tracking-tight uppercase">Engagement Metric</h3>
                                <p className="text-[10px] text-muted-foreground/40 mt-1 uppercase tracking-[0.3em] font-black italic">Institutional Health Index</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-10 flex-grow relative z-10"><BarChart /></div>
                </div>
            </div>
        </div>
    );
};

const GridIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="7" height="7" x="3" y="3" rx="1.5" /><rect width="7" height="7" x="14" y="3" rx="1.5" /><rect width="7" height="7" x="14" y="14" rx="1.5" /><rect width="7" height="7" x="3" y="14" rx="1.5" /></svg>
);

export default DashboardOverview;
