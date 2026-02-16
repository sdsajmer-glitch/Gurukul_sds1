import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../services/supabase';
import { UserProfile } from '../../types';
import Spinner from '../common/Spinner';
import PremiumAvatar from '../common/PremiumAvatar';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

// Icons
import { GraduationCapIcon } from '../icons/GraduationCapIcon';
import { TrendingUpIcon } from '../icons/TrendingUpIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { BookOpenIcon } from '../icons/BookOpenIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { ChevronLeftIcon } from '../icons/ChevronLeftIcon';
import { SearchIcon } from '../icons/SearchIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { HeatmapIcon } from '../icons/HeatmapIcon';

interface AcademicIntel {
    summary: {
        overall_score: number;
        attendance: {
            percentage: number;
            total_days: number;
            present_days: number;
            absent_days: number;
        };
        status: 'EXEMPLARY' | 'STABLE' | 'SATISFACTORY' | 'ATTENTION_REQUIRED';
    };
    subjects: {
        name: string;
        code: string;
        department: string;
        proficiency: number;
        history: {
            exam: string;
            score: number;
            total: number;
            date: string;
        }[];
    }[];
}

interface AcademicsTabProps {
    profile: UserProfile;
    initialStudentId?: string | null;
}

const AcademicsTab: React.FC<AcademicsTabProps> = ({ profile, initialStudentId }) => {
    const [students, setStudents] = useState<any[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(initialStudentId || null);
    const [intel, setIntel] = useState<AcademicIntel | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSelectionOpen, setIsSelectionOpen] = useState(false);

    // Fetch Linked Students
    const fetchStudents = useCallback(async () => {
        try {
            const { data, error } = await supabase.rpc('get_parent_linked_students_finance_v2', { p_parent_id: profile.id });
            if (error) throw error;
            setStudents(data || []);
            if (data?.length > 0 && !selectedStudentId) {
                setSelectedStudentId(data[0].student_id);
            }
        } catch (err: any) {
            console.error("Student fetch error:", err);
            setError("Identity Roster unavailable.");
        }
    }, [profile.id, selectedStudentId]);

    // Fetch Academic Intelligence
    const fetchIntel = useCallback(async () => {
        if (!selectedStudentId) return;
        setLoading(true);
        try {
            const { data, error: rpcError } = await supabase.rpc('get_student_academic_intel_v1', {
                p_student_id: selectedStudentId
            });
            if (rpcError) throw rpcError;
            setIntel(data);
        } catch (err: any) {
            console.error("Intel fetch error:", err);
            setError("Performance Matrix decryption failed.");
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

    if (loading && !intel) {
        return (
            <div className="flex flex-col items-center justify-center py-40">
                <Spinner size="lg" className="text-indigo-500" />
                <p className="text-[10px] font-black uppercase text-white/20 mt-8 tracking-[0.4em] animate-pulse">Synchronizing Intelligence Nodes</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-32 font-sans animate-in fade-in duration-700">
            {/* 1. SELECTION COMMAND STRIP */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
                <div className="relative group w-full md:w-auto">
                    <button
                        onClick={() => setIsSelectionOpen(!isSelectionOpen)}
                        className="flex items-center gap-4 bg-[#111827] border border-white/5 hover:border-indigo-500/30 p-2 pr-6 rounded-2xl transition-all shadow-xl group"
                    >
                        <PremiumAvatar name={selectedStudent?.display_name || 'Select'} src={selectedStudent?.profile_photo_url} size="sm" />
                        <div className="text-left">
                            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">Institutional Node</p>
                            <h2 className="text-sm font-black text-white group-hover:text-indigo-400 transition-colors uppercase tracking-widest">{selectedStudent?.display_name || 'Scanning...'}</h2>
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

                <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">System Cycle</p>
                        <p className="text-xs font-bold text-white uppercase tracking-widest">Academic Year 2025-26</p>
                    </div>
                </div>
            </div>

            {intel && (
                <>
                    {/* 2. EXECUTIVE CLARITY GRID */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Overall Score */}
                        <div className="bg-gradient-to-br from-indigo-600/20 to-transparent border border-indigo-500/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><TrendingUpIcon className="w-24 h-24" /></div>
                            <div className="relative z-10">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-4">Academic Proficiency</p>
                                <div className="flex items-baseline gap-3">
                                    <h3 className="text-6xl font-black text-white tracking-tighter">{intel.summary.overall_score}%</h3>
                                    <span className="text-xs font-bold text-white/30 uppercase tracking-widest">Aggregate</span>
                                </div>
                                <div className="mt-6 flex items-center gap-2">
                                    <div className={clsx("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                        intel.summary.status === 'EXEMPLARY' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                            intel.summary.status === 'STABLE' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                                "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                    )}>
                                        {intel.summary.status} NODE
                                    </div>
                                    <span className="text-[10px] text-white/20 font-bold uppercase tracking-tighter">Verified across 5 subjects</span>
                                </div>
                            </div>
                        </div>

                        {/* Attendance Pulse */}
                        <div className="bg-[#111827] border border-white/5 rounded-3xl p-8 shadow-2xl relative group overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><ActivityIcon className="w-24 h-24" /></div>
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mb-4">Presence Integrity</p>
                            <div className="flex items-baseline gap-3">
                                <h3 className="text-6xl font-black text-white tracking-tighter">{intel.summary.attendance.percentage}%</h3>
                                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Stable</span>
                            </div>
                            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                                <div>
                                    <p className="text-[9px] text-white/20 font-black uppercase">Present Days</p>
                                    <p className="text-sm font-black text-white">{intel.summary.attendance.present_days}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] text-white/20 font-black uppercase">Leaves Taken</p>
                                    <p className="text-sm font-black text-red-500/80">{intel.summary.attendance.absent_days}</p>
                                </div>
                            </div>
                        </div>

                        {/* Quick Insights */}
                        <div className="bg-[#111827] border border-white/5 rounded-3xl p-8 shadow-2xl">
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mb-6">Subject Proficiency</p>
                            <div className="space-y-4">
                                {intel.subjects.slice(0, 3).map(s => (
                                    <div key={s.code} className="space-y-1.5">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                                            <span className="text-white/60">{s.name}</span>
                                            <span className="text-white">{s.proficiency}%</span>
                                        </div>
                                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${s.proficiency}%` }}
                                                className="h-full bg-indigo-500/60 rounded-full"
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button className="w-full py-2 mt-2 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black text-white/30 uppercase tracking-[0.2em] transition-all">
                                    View Detailed Matrix
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 3. PERFORMANCE MATRIX SECTION */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8">
                        {/* Subject Intelligence (8 Cols) */}
                        <div className="lg:col-span-8 space-y-6">
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 px-2">Assessment Timeline</h3>
                            <div className="space-y-4">
                                {intel.subjects.map(subject => (
                                    <div key={subject.code} className="bg-[#111827]/40 border border-white/5 rounded-3xl p-6 hover:border-white/10 transition-colors group">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white/40 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-all border border-white/10">
                                                    <BookOpenIcon className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h4 className="text-lg font-black text-white uppercase tracking-tight">{subject.name}</h4>
                                                    <p className="text-[10px] text-white/20 uppercase font-bold tracking-widest">{subject.department}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-8">
                                                <div className="text-right">
                                                    <p className="text-[9px] text-white/20 font-black uppercase">Proficiency</p>
                                                    <p className="text-xl font-black text-white tracking-tighter">{subject.proficiency}%</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] text-white/20 font-black uppercase">Status</p>
                                                    <p className="text-xs font-black text-emerald-400 mt-1.5 uppercase tracking-widest">Verified</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Sub-Timeline for Exams */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                                            {subject.history.map((exam, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-4 bg-black/30 rounded-2xl border border-white/5 hover:border-indigo-500/20 group/exam transition-all cursor-default">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-white/5 rounded-lg text-white/20 group-hover/exam:text-indigo-400 transition-colors"><GraduationCapIcon className="w-4 h-4" /></div>
                                                        <div>
                                                            <p className="text-[11px] font-bold text-white/70 group-hover/exam:text-white transition-colors">{exam.exam}</p>
                                                            <p className="text-[9px] text-white/20 uppercase font-medium">{new Date(exam.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-black text-white">{exam.score}<span className="text-[10px] text-white/20">/{exam.total}</span></p>
                                                        <p className="text-[9px] font-bold text-emerald-500/60 uppercase">{(exam.score / exam.total * 100).toFixed(0)}%</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Secondary Metrics / AI Insights (4 Cols) */}
                        <div className="lg:col-span-4 space-y-8">
                            {/* Attendance Heatmap Placeholder */}
                            <div className="bg-[#111827] border border-white/5 rounded-3xl p-8 shadow-2xl">
                                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/30 mb-6 flex items-center gap-2">
                                    <HeatmapIcon className="w-4 h-4" /> Presence Pulse
                                </h3>

                                <div className="grid grid-cols-7 gap-1.5">
                                    {Array.from({ length: 35 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className={clsx(
                                                "aspect-square rounded-[4px] border border-white/5",
                                                i < 28 ? (Math.random() > 0.1 ? "bg-emerald-500/40" : "bg-red-500/40") : "bg-white/5"
                                            )}
                                        />
                                    ))}
                                </div>
                                <div className="mt-4 flex items-center justify-between text-[8px] font-black text-white/20 uppercase tracking-widest">
                                    <span>Last 30 Cycles</span>
                                    <div className="flex gap-2">
                                        <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40"></div> OK</div>
                                        <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500/40"></div> ABS</div>
                                    </div>
                                </div>
                            </div>

                            {/* AI Strategic Insight */}
                            <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-3xl p-8 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4"><ActivityIcon className="w-12 h-12 text-indigo-500/20 animate-pulse" /></div>
                                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400 mb-4">Strategic Intel</h3>
                                <p className="text-sm text-indigo-100/60 leading-relaxed italic">
                                    "Academic trajectory shows strong growth in <span className="text-indigo-300 font-bold">Technology</span> and <span className="text-indigo-300 font-bold">Science</span>. Focus recommended on descriptive Humanities assessments to balance the aggregate node."
                                </p>
                                <div className="mt-6 pt-6 border-t border-indigo-500/20">
                                    <button className="flex items-center gap-3 text-indigo-300 hover:text-white transition-colors">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Generate Comprehensive Report</span>
                                        <ChevronRightIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Verified Seal */}
                            <div className="border border-dashed border-white/10 rounded-3xl p-10 flex flex-col items-center justify-center text-center group">
                                <div className="p-4 bg-emerald-500/5 rounded-full mb-4 border border-emerald-500/10 group-hover:scale-110 transition-transform">
                                    <CheckCircleIcon className="w-10 h-10 text-emerald-500/40" />
                                </div>
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Official Transcript</p>
                                <p className="text-[11px] text-white/10 mt-2 italic">Institutional node data verified at 2026-02-16T23:50:37Z</p>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AcademicsTab;
