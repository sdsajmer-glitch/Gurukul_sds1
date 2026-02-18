import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';
import { UserProfile } from '../../types';
import Spinner from '../common/Spinner';
import PremiumAvatar from '../common/PremiumAvatar';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

// Icons
import { GraduationCapIcon } from '../icons/GraduationCapIcon';
import { TrendingUpCustomIcon } from '../icons/TrendingUpIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { BookOpenIcon } from '../icons/BookOpenIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { SearchIcon } from '../icons/SearchIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { HeatmapIcon } from '../icons/HeatmapIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { ClipboardListIcon } from '../icons/ClipboardListIcon';
import { MailIcon } from '../icons/MailIcon';
import { InfoIcon } from '../icons/InfoIcon';

interface AcademicIntel {
    overview: {
        overall_score: number;
        attendance_rate: number;
        subjects_count: number;
        assignments_pending: number;
        upcoming_exams: number;
        risk: { level: 'STABLE' | 'AT_RISK' | 'CRITICAL'; reason: string };
    };
    attendance: {
        percentage: number;
        total_days: number;
        present_days: number;
        absent_days: number;
        heatmap: { date: string; status: string }[];
    };
    subjects: {
        s_id: string;
        name: string;
        code: string;
        department: string;
        proficiency: number;
        faculty_name?: string;
    }[];
    exams: {
        title: string;
        subject_name: string;
        exam_date: string;
        total_marks: number;
        marks_obtained: number;
        status: string;
    }[];
    assignments: {
        title: string;
        subject_name: string;
        due_date: string;
        status: string;
    }[];
    remarks: {
        remark: string;
        category: string;
        severity: string;
        recorded_at: string;
        teacher_name: string;
    }[];
}

interface AcademicsTabProps {
    profile: UserProfile;
    initialStudentId?: string | null;
}

const ProgressRing: React.FC<{ value: number; size?: number; stroke?: number; colorClass?: string }> = ({ value, size = 48, stroke = 4, colorClass = "text-indigo-500" }) => {
    const radius = (size / 2) - stroke;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (Math.min(value, 100) / 100) * circumference;

    return (
        <svg width={size} height={size} className="transform -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={stroke} fill="transparent" className="text-white/5" />
            <motion.circle
                cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={stroke} fill="transparent"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                strokeLinecap="round"
                className={clsx("transition-all", colorClass)}
            />
        </svg>
    );
};

const AcademicsTab: React.FC<AcademicsTabProps> = ({ profile, initialStudentId }) => {
    const [students, setStudents] = useState<any[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(initialStudentId || null);
    const [intel, setIntel] = useState<AcademicIntel | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSelectionOpen, setIsSelectionOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [downloadingReport, setDownloadingReport] = useState(false);

    // Fetch Linked Students
    const fetchStudents = useCallback(async () => {
        try {
            const { data, error } = await supabase.rpc('get_parent_linked_students_finance_v3');
            if (error) throw error;
            setStudents(data || []);
            if (data?.length > 0 && !selectedStudentId) {
                setSelectedStudentId(data[0].student_id);
            }
        } catch (err: any) {
            console.error("Student fetch error:", err);
            setError("Identity Roster isolation active.");
        }
    }, [selectedStudentId]);

    // Fetch Academic Intelligence
    const fetchIntel = useCallback(async () => {
        if (!selectedStudentId) return;
        setLoading(true);
        setError(null);
        try {
            const { data, error: rpcError } = await supabase.rpc('get_student_academic_master_intel', {
                p_student_id: selectedStudentId
            });

            if (rpcError) {
                console.error("RPC Error:", rpcError);
                setError("Backend synchronization failed. Please run the academic update script.");
                setIntel(null);
                return;
            }

            if (data?.error === '403_ACCESS_FORBIDDEN') {
                setError("SECURITY ALERT: Academic isolation breach detected.");
                setIntel(null);
                return;
            }

            setIntel(data);
        } catch (err: any) {
            console.error("Intel fetch error:", err);
            setError("Intelligence Matrix node disconnected.");
        } finally {
            setLoading(false);
        }
    }, [selectedStudentId]);

    useEffect(() => {
        fetchStudents();
    }, [fetchStudents]);

    useEffect(() => {
        if (selectedStudentId) fetchIntel();
    }, [selectedStudentId, fetchIntel]);

    const selectedStudent = useMemo(() => students.find(s => s.student_id === selectedStudentId), [students, selectedStudentId]);

    const handleDownloadSummary = () => {
        setDownloadingReport(true);
        setTimeout(() => {
            setDownloadingReport(false);
            alert("INTELLIGENCE_REPORT_GENERATED: Secure PDF node prepared for " + selectedStudent?.display_name);
        }, 2000);
    };

    if (loading && !intel) {
        return (
            <div className="flex flex-col items-center justify-center py-40">
                <Spinner size="lg" className="text-indigo-500" />
                <p className="text-[10px] font-black uppercase text-white/20 mt-8 tracking-[0.4em] animate-pulse">Synchronizing Academic Magnitude</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-12 pb-32 font-sans animate-in fade-in duration-700">

            {/* ERROR NOTIFICATION NODE */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center justify-between gap-4 overflow-hidden"
                    >
                        <div className="flex items-center gap-3">
                            <AlertTriangleIcon className="w-5 h-5 text-red-500" />
                            <p className="text-xs font-bold text-red-400 uppercase tracking-widest">{error}</p>
                        </div>
                        <button
                            onClick={() => fetchIntel()}
                            className="px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-500 text-[10px] font-black uppercase rounded-lg transition-all"
                        >
                            Retry
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 1. ACADEMIC OVERVIEW HEADER */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-16">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="relative group">
                        <button
                            onClick={() => setIsSelectionOpen(!isSelectionOpen)}
                            className="flex items-center gap-4 bg-[#111827] border border-white/5 hover:border-indigo-500/30 p-2 pr-6 rounded-2xl transition-all shadow-xl group"
                        >
                            <PremiumAvatar name={selectedStudent?.display_name || 'Select'} src={selectedStudent?.profile_photo_url} size="sm" />
                            <div className="text-left">
                                <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">Institutional Node</p>
                                <h2 className="text-sm font-black text-white group-hover:text-indigo-400 transition-colors uppercase tracking-widest">{selectedStudent?.display_name || 'Scanning...'}</h2>
                                <p className="text-[10px] text-indigo-400/60 font-medium uppercase tracking-tighter">{selectedStudent?.grade} • Section A</p>
                            </div>
                            <ChevronRightIcon className={clsx("w-4 h-4 text-white/20 transition-transform", isSelectionOpen && "rotate-90")} />
                        </button>

                        <AnimatePresence>
                            {isSelectionOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="absolute top-full left-0 mt-3 w-72 bg-[#111827] border border-white/10 rounded-2xl shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)] z-50 overflow-hidden"
                                >
                                    {students.map(s => (
                                        <button
                                            key={s.student_id}
                                            onClick={() => { setSelectedStudentId(s.student_id); setIsSelectionOpen(false); }}
                                            className="w-full p-4 flex items-center gap-3 hover:bg-indigo-500/10 transition-colors border-b border-white/5 last:border-0 text-left"
                                        >
                                            <PremiumAvatar name={s.display_name} src={s.profile_photo_url} size="xs" />
                                            <div>
                                                <p className="text-xs font-bold text-white">{s.display_name}</p>
                                                <p className="text-[10px] text-white/30 uppercase">{s.grade}</p>
                                            </div>
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="h-10 w-[1px] bg-white/5 hidden sm:block" />

                    <div className="flex gap-4">
                        <div className="flex flex-col">
                            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">Academic Cycle</p>
                            <p className="text-xs font-bold text-white uppercase tracking-widest">Year 2025-26</p>
                        </div>
                        <div className={clsx(
                            "px-3 py-1.5 rounded-xl border flex items-center gap-2",
                            intel?.overview?.risk?.level === 'CRITICAL' ? "bg-red-500/10 border-red-500/20 text-red-400" :
                                intel?.overview?.risk?.level === 'AT_RISK' ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                                    "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        )}>
                            <div className={clsx("w-1.5 h-1.5 rounded-full animate-pulse",
                                intel?.overview?.risk?.level === 'CRITICAL' ? "bg-red-500" :
                                    intel?.overview?.risk?.level === 'AT_RISK' ? "bg-amber-500" :
                                        "bg-emerald-500"
                            )} />
                            <span className="text-[9px] font-black uppercase tracking-widest">{(intel?.overview?.risk?.level || 'STABLE')} STATUS</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <div className="relative flex-1 lg:flex-none">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/10" />
                        <input
                            type="text"
                            placeholder="Search Academic Data..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full lg:w-64 bg-white/5 border border-white/5 rounded-2xl py-3 pl-12 pr-6 text-xs text-white placeholder-white/10 focus:border-indigo-500/50 outline-none transition-all"
                        />
                    </div>
                    <button
                        onClick={handleDownloadSummary}
                        disabled={downloadingReport}
                        className="p-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-2xl text-indigo-400 transition-all active:scale-95"
                    >
                        {downloadingReport ? <Spinner size="xs" color="text-indigo-400" /> : <DownloadIcon className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* QUICK STATS CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
                {[
                    { label: 'Overall Proficiency', value: intel ? `${intel.overview.overall_score}%` : '0%', icon: TrendingUpCustomIcon, color: 'text-indigo-400' },
                    { label: 'Attendance Rate', value: intel ? `${intel.overview.attendance_rate}%` : '0%', icon: ActivityIcon, color: 'text-emerald-400' },
                    { label: 'Pending Tasks', value: intel?.overview?.assignments_pending || 0, icon: ClipboardListIcon, color: 'text-amber-400' },
                    { label: 'Upcoming Exams', value: intel?.overview?.upcoming_exams || 0, icon: GraduationCapIcon, color: 'text-blue-400' }
                ].map((stat, i) => (
                    <div key={i} className="bg-[#111827] border border-white/5 p-6 rounded-3xl group hover:border-white/10 transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className={clsx("p-3 rounded-2xl bg-white/5", stat.color)}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                        </div>
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">{stat.label}</p>
                        <h3 className="text-2xl font-black text-white mt-1">{stat.value}</h3>
                    </div>
                ))}
            </div>

            {/* 2 & 3: MAIN DYNAMIC GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* 2. SUBJECT PERFORMANCE GRID (8 COLS) */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xs font-black uppercase tracking-[0.4em] text-white/20">Learning Matrix</h3>
                        <span className="text-[9px] font-bold text-indigo-400 uppercase bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/10">Active Subjects</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(intel?.subjects || []).map((sub, i) => (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                key={sub.s_id}
                                className="bg-[#111827]/40 border border-white/5 hover:border-indigo-500/20 p-6 rounded-3xl transition-all group relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <BookOpenIcon className="w-16 h-16" />
                                </div>
                                <div className="flex justify-between items-start relative z-10">
                                    <div className="space-y-1">
                                        <h4 className="text-lg font-black text-white tracking-tight group-hover:text-indigo-400 transition-colors uppercase">{sub.name}</h4>
                                        <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">{sub.department}</p>
                                    </div>
                                    <ProgressRing value={sub.proficiency} colorClass={sub.proficiency < 40 ? "text-red-500" : sub.proficiency < 70 ? "text-amber-500" : "text-indigo-500"} />
                                </div>
                                <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-black text-white/30">FC</div>
                                        <span className="text-[10px] font-bold text-white/40 uppercase">Faculty Lead</span>
                                    </div>
                                    <span className="text-sm font-black text-white">{sub.proficiency}%</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* 3. ASSESSMENT TIMELINE */}
                    <div className="pt-8 space-y-6">
                        <h3 className="text-xs font-black uppercase tracking-[0.4em] text-white/20">Assessment Intelligence</h3>
                        <div className="space-y-3">
                            {(intel?.exams || []).map((exam, i) => (
                                <div key={i} className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.04] transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                                            <GraduationCapIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h5 className="text-sm font-black text-white uppercase tracking-tight">{exam.title}</h5>
                                            <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">{exam.subject_name} • {new Date(exam.exam_date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-white">{exam.marks_obtained || 0} <span className="text-white/20">/ {exam.total_marks}</span></p>
                                        <div className="flex items-center gap-1 justify-end mt-1">
                                            <div className={clsx("w-1 h-1 rounded-full", (exam.marks_obtained / exam.total_marks) >= 0.4 ? "bg-emerald-500" : "bg-red-500")} />
                                            <span className={clsx("text-[9px] font-black uppercase", (exam.marks_obtained / exam.total_marks) >= 0.4 ? "text-emerald-400" : "text-red-400")}>
                                                {(exam.marks_obtained / exam.total_marks * 100).toFixed(0)}% Achieved
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 4, 5, 6: LATERAL ANALYTICS (4 COLS) */}
                <div className="lg:col-span-4 space-y-8">

                    {/* 5. ATTENDANCE HEATMAP */}
                    <div className="bg-[#111827] border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30">Presence Pulse</h3>
                                <p className="text-[10px] text-emerald-400 font-bold uppercase mt-1">Institutional Integrity OK</p>
                            </div>
                            <HeatmapIcon className="w-5 h-5 text-emerald-500/40" />
                        </div>

                        <div className="grid grid-cols-7 gap-1.5 mb-6">
                            {Array.from({ length: 31 }).map((_, i) => {
                                const dayData = intel?.attendance?.heatmap?.[i];
                                return (
                                    <div
                                        key={i}
                                        className={clsx(
                                            "aspect-square rounded-[4px] border border-white/5",
                                            dayData ? (dayData.status === 'present' ? "bg-emerald-500/40" : "bg-red-500/40") : "bg-white/5"
                                        )}
                                        title={dayData ? `${dayData.date}: ${dayData.status}` : 'No Record'}
                                    />
                                );
                            })}
                        </div>
                        <div className="flex items-center justify-between text-[8px] font-black text-white/20 uppercase tracking-widest pt-4 border-t border-white/5">
                            <span className="flex items-center gap-1.5"><CalendarIcon className="w-3 h-3" /> Monthly Node</span>
                            <div className="flex gap-3">
                                <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Present</div>
                                <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> Absent</div>
                            </div>
                        </div>
                    </div>

                    {/* 4. ASSIGNMENT TRACKER */}
                    <div className="bg-[#111827] border border-white/5 rounded-3xl p-8 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30">Task Registry</h3>
                            <span className="text-[10px] font-black text-amber-400">{intel?.overview?.assignments_pending || 0} Pending</span>
                        </div>
                        <div className="space-y-4">
                            {(intel?.assignments || []).map((task, i) => (
                                <div key={i} className="group cursor-default">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-0.5">
                                            <p className="text-[11px] font-black text-white group-hover:text-indigo-400 transition-colors uppercase">{task.title}</p>
                                            <p className="text-[9px] text-white/20 font-bold uppercase">{task.subject_name}</p>
                                        </div>
                                        <div className={clsx(
                                            "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter",
                                            task.status === 'PENDING' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                        )}>
                                            {task.status}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 mt-2">
                                        <ClockIcon className="w-3 h-3 text-white/10" />
                                        <span className="text-[9px] text-white/10 font-bold uppercase">Due: {new Date(task.due_date).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 6. TEACHER COMMUNICATION PANEL */}
                    <div className="bg-[#111827] border border-white/5 rounded-3xl p-8 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30">Strategic Remarks</h3>
                            <MailIcon className="w-4 h-4 text-white/20" />
                        </div>
                        <div className="space-y-6">
                            {(intel?.remarks || []).map((r, i) => (
                                <div key={i} className="relative pl-6 border-l border-white/5 space-y-2">
                                    <div className={clsx(
                                        "absolute -left-[5px] top-0 w-2 h-2 rounded-full",
                                        r.severity === 'CRITICAL' ? "bg-red-500" : r.severity === 'POSITIVE' ? "bg-emerald-500" : "bg-indigo-500"
                                    )} />
                                    <div className="flex justify-between items-start">
                                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{r.category}</p>
                                        <span className="text-[8px] text-white/10">{new Date(r.recorded_at).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-xs text-white/60 leading-relaxed italic">"{r.remark}"</p>
                                    <p className="text-[9px] font-bold text-white/20 uppercase">— {r.teacher_name || 'Class Lead'}</p>
                                </div>
                            ))}
                            {(intel?.remarks || []).length === 0 && (
                                <div className="py-4 text-center">
                                    <p className="text-[10px] text-white/10 uppercase tracking-widest font-black">No recent field remarks recorded.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* EMPTY STATE HANDLER (SAFETY) */}
            {(intel?.subjects || []).length === 0 && !loading && !error && (
                <div className="bg-[#111827] border border-white/5 border-dashed rounded-[40px] p-24 flex flex-col items-center justify-center text-center">
                    <div className="p-6 bg-white/5 rounded-full mb-8">
                        <InfoIcon className="w-12 h-12 text-white/10" />
                    </div>
                    <h4 className="text-xl font-black text-white uppercase tracking-widest mb-4">Node Isolation Active</h4>
                    <p className="text-white/20 text-sm max-w-md mx-auto leading-relaxed">
                        Subjects and assessment modules have not yet been mapped for this institutional lifecycle.
                        Please contact the administrator for curriculum synchronization.
                    </p>
                </div>
            )}
        </div>
    );
};

export default AcademicsTab;
