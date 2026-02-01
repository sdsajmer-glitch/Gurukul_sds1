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
    const [stats, setStats] = useState({ students: 0, teachers: 0, courses: 0 });
    const [loading, setLoading] = useState(true);
    const [isBranchAdminEligible, setIsBranchAdminEligible] = useState(false);

    useEffect(() => {
        const checkEligibility = async () => {
            try {
                const { data, error } = await supabase.rpc('check_branch_admin_eligibility');
                if (!error && data) {
                    setIsBranchAdminEligible(data.eligible);
                }
            } catch (err) {
                console.error("Eligibility Check Error:", err);
            }
        };
        checkEligibility();
    }, []);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            const branchId = currentBranch ? currentBranch.id : null;
            if (!branchId) {
                setLoading(false);
                return;
            }

            try {
                const [studentRes, teacherRes, courseRes] = await Promise.all([
                    supabase.rpc('get_all_students_for_admin', { p_branch_id: branchId }),
                    supabase.from('teacher_profiles').select('user_id', { count: 'exact', head: true }).eq('branch_id', branchId),
                    supabase.from('courses').select('id', { count: 'exact', head: true }).eq('branch_id', branchId)
                ]);

                setStats({
                    students: studentRes.data?.length || 0,
                    teachers: teacherRes.count || 0,
                    courses: courseRes.count || 0
                });
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [currentBranch]);

    const isBranchAdmin = profile.role === BuiltInRoles.SCHOOL_ADMINISTRATION && !!profile.branch_id;
    const branchStatus = currentBranch?.status || 'Active';
    const isBranchLinked = branchStatus === 'Active' || branchStatus === 'Linked' || !!profile.branch_id;

    return (
        <div className="space-y-8 pb-20 animate-in fade-in duration-700">
            {/* --- PREMIUM COMMAND CENTER HEADER --- */}
            <div className="relative overflow-hidden rounded-[3rem] bg-[#0a0a0c] border border-white/5 p-8 md:p-14 shadow-2xl shadow-black/50 ring-1 ring-white/10">
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
                                            <span className="flex items-center gap-2 text-[9px] font-bold text-emerald-500 uppercase tracking-[0.2em] bg-emerald-500/5 px-4 py-2 rounded-full border border-emerald-500/10 backdrop-blur-md">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div> Node Synced
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-2 text-[9px] font-bold text-amber-500 uppercase tracking-[0.2em] bg-amber-500/5 px-4 py-2 rounded-full border border-amber-500/10 backdrop-blur-md">
                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div> Handshake Pending
                                            </span>
                                        )
                                    )}
                                </div>

                                <div>
                                    <h1 className="text-5xl md:text-7xl font-serif font-black text-white tracking-tight leading-none mb-2 uppercase">
                                        Welcome, <br /><span className="text-white/30 italic lowercase">{(profile.display_name || 'Admin').split(' ')[0]}!</span>
                                    </h1>
                                    <p className="text-white/40 text-lg md:text-xl font-medium tracking-tight font-serif italic mt-6 border-l border-white/10 pl-8">System Status: {currentBranch ? 'Operating under local node context.' : 'Standby mode. Node resolution required.'}</p>
                                </div>
                            </>
                        )}

                        {currentBranch ? (
                            <div className="flex flex-col gap-6 pt-2 animate-in slide-in-from-left-6 duration-1000">
                                <div className="flex flex-col md:flex-row items-start md:items-center gap-8 group">
                                    <div className="p-5 bg-white/5 rounded-[2.2rem] text-primary shadow-2xl border border-white/10 group-hover:scale-105 group-hover:rotate-2 transition-all duration-700 ring-1 ring-inset ring-white/5">
                                        <SchoolIcon className="w-12 h-12" />
                                    </div>
                                    <div className="min-w-0 flex-grow">
                                        <div className="flex items-center gap-4 mb-2">
                                            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase leading-none truncate font-sans drop-shadow-lg">
                                                {currentBranch.name}
                                            </h2>
                                            <span className="font-mono text-[10px] font-black text-white/30 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 shrink-0 shadow-inner">
                                                NODE_{currentBranch.id.toString().padStart(4, '0')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-white/40 font-bold uppercase tracking-[0.2em] text-[11px] leading-relaxed">
                                            <LocationIcon className="w-4 h-4 text-primary opacity-60 shrink-0" />
                                            {[currentBranch.address, currentBranch.city, currentBranch.state].filter(Boolean).join(', ')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : !loading && isBranchAdminEligible && (
                            <div className="group relative bg-[#0a0a0c] border border-red-500/20 rounded-[3rem] p-8 md:p-12 animate-in zoom-in duration-1000 max-w-4xl overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.1)] ring-1 ring-red-500/10">
                                <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-red-500/5 rounded-full filter blur-[100px] pointer-events-none"></div>
                                <div className="absolute top-0 right-0 p-12 opacity-[0.03] transform rotate-12 group-hover:scale-110 transition-transform duration-1000"><ShieldCheckIcon className="w-64 h-64 text-red-500" /></div>

                                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
                                    <div className="flex items-start gap-8 text-center md:text-left flex-col md:flex-row items-center md:items-start max-w-2xl">
                                        <div className="relative">
                                            <div className="w-24 h-24 bg-red-600 text-white rounded-[2.2rem] flex items-center justify-center flex-shrink-0 shadow-2xl shadow-red-600/40 transform group-hover:rotate-12 transition-transform duration-700 ring-4 ring-red-600/20">
                                                <AlertTriangleIcon className="w-12 h-12" />
                                            </div>
                                            <div className="absolute -top-2 -right-2 w-8 h-8 bg-black rounded-full border-2 border-red-600 flex items-center justify-center animate-bounce">
                                                <span className="text-[10px] font-black text-red-600">!</span>
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="text-4xl font-serif font-black text-white uppercase tracking-tighter leading-none mb-4">Identity Disconnect</h3>
                                            <p className="text-base text-white/40 leading-relaxed font-medium">
                                                No active branch node detected for <strong className="text-white/80">{profile.email}</strong>.
                                                <span className="block mt-2 text-white/30 italic">Handshake required: Enter your provisioned link code to activate this workstation and sync with the institutional registry.</span>
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onNavigate('Code Verification')}
                                        className="group/btn w-full md:w-auto px-12 py-6 bg-red-600 hover:bg-red-500 text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-red-600/30 transition-all transform hover:-translate-y-2 active:scale-95 flex items-center justify-center gap-4 whitespace-nowrap ring-4 ring-red-600/20"
                                    >
                                        <KeyIcon className="w-6 h-6 group-hover/btn:rotate-45 transition-transform duration-500" />
                                        Start Handshake
                                    </button>
                                </div>
                            </div>
                        )}
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
                            <button className="px-10 py-4 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 group/dl">
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
                            title="Live Courses"
                            value={stats.courses.toString()}
                            icon={<CoursesIcon className="h-7 w-7" />}
                            trend="Stable"
                            colorClass="bg-amber-500/10 text-amber-400"
                        />
                        <StatCard
                            title="Revenue (YTD)"
                            value="$0"
                            icon={<TrendingUpCustomIcon className="h-7 w-7" />}
                            trend="--%"
                            colorClass="bg-indigo-500/10 text-indigo-400"
                        />
                    </div>
                )}
            </div>

            {/* --- ANALYTICS VISUALIZATION --- */}
            <div className={`grid grid-cols-1 lg:grid-cols-5 gap-10 transition-all duration-1000 ${!currentBranch ? 'opacity-20 blur-xl pointer-events-none' : 'opacity-100'}`}>
                <div className="lg:col-span-3 group/chart relative bg-[#0a0a0c]/80 backdrop-blur-2xl border border-white/5 rounded-[3.5rem] shadow-2xl flex flex-col h-[520px] overflow-hidden ring-1 ring-white/10 hover:ring-white/20 transition-all duration-700">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover/chart:opacity-100 transition-opacity duration-1000"></div>
                    <div className="p-10 md:p-12 border-b border-white/5 flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-primary/10 rounded-2xl text-primary border border-primary/20 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                <TrendingUpIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-black text-2xl text-white font-serif tracking-tight uppercase">Demographic Distribution</h3>
                                <p className="text-[10px] text-white/30 mt-1 uppercase tracking-[0.3em] font-black italic">Intelligence Protocol: Enrollment Grade Sync</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Live Syncing</span>
                        </div>
                    </div>
                    <div className="p-10 flex-grow relative z-10"><AreaChart /></div>
                    <div className="absolute bottom-6 right-12 text-[8px] font-black text-white/10 uppercase tracking-[0.4em] select-none">Metric Stream v2.4</div>
                </div>

                <div className="lg:col-span-2 group/metric relative bg-[#0a0a0c]/80 backdrop-blur-2xl border border-white/5 rounded-[3.5rem] shadow-2xl flex flex-col h-[520px] overflow-hidden ring-1 ring-white/10 hover:ring-white/20 transition-all duration-700">
                    <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/5 via-transparent to-transparent opacity-0 group-hover/metric:opacity-100 transition-opacity duration-1000"></div>
                    <div className="p-10 md:p-12 border-b border-white/5 flex justify-between items-center relative z-10">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-500 border border-amber-500/20 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                <SparklesIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-black text-2xl text-white font-serif tracking-tight uppercase">Engagement Metric</h3>
                                <p className="text-[10px] text-white/30 mt-1 uppercase tracking-[0.3em] font-black italic">Institutional Health Index</p>
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
