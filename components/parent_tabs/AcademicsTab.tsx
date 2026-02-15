import React, { useState, useEffect, useCallback } from 'react';
import { supabase, formatError } from '../../services/supabase';
import { UserProfile } from '../../types';
import Spinner from '../common/Spinner';
import { BookOpenIcon } from '../icons/BookOpenIcon';
import { TrendingUpCustomIcon } from '../icons/TrendingUpIcon';
import { AcademicCapIcon } from '../icons/AcademicCapIcon';
import { ChartBarIcon } from '../icons/ChartBarIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { motion, AnimatePresence } from 'framer-motion';

interface AcademicsTabProps {
    profile: UserProfile;
}

const AcademicsTab: React.FC<AcademicsTabProps> = ({ profile }) => {
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<any[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [academicReport, setAcademicReport] = useState<any>(null);
    const [activeCycle, setActiveCycle] = useState<number | null>(null);
    const [allCycles, setAllCycles] = useState<any[]>([]);
    const [isCycleMenuOpen, setIsCycleMenuOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initial Fetch: Get Linked Students
    const fetchStudents = useCallback(async () => {
        setLoading(true);
        try {
            // Reusing the finance RPC for linked students list as it provides same base data
            const { data, error } = await supabase.rpc('get_parent_linked_students_finance_v2', {
                p_parent_id: profile.id
            });
            if (error) throw error;

            setStudents(data || []);
            if (data && data.length > 0 && !selectedStudentId) {
                setSelectedStudentId(data[0].student_id);
            }
        } catch (err: any) {
            setError(formatError(err));
        } finally {
            setLoading(false);
        }
    }, [profile.id, selectedStudentId]);

    // Fetch Cycles
    const fetchCycles = useCallback(async () => {
        const { data } = await supabase.from('academic_years').select('id, year_name, is_current').order('start_date', { ascending: false });
        if (data) setAllCycles(data);
    }, []);

    useEffect(() => {
        fetchCycles();
        fetchStudents();
    }, [fetchCycles, fetchStudents]);

    // Fetch Academic Report
    const fetchReport = useCallback(async () => {
        if (!selectedStudentId) return;

        try {
            const { data, error } = await supabase.rpc('get_student_academic_report', {
                p_student_id: selectedStudentId,
                p_cycle_id: activeCycle
            });

            if (error) throw error;
            setAcademicReport(data);
            if (!activeCycle && data?.cycle_id) setActiveCycle(data.cycle_id);

        } catch (err: any) {
            console.error('Academic Report Error:', err);
            // Fail gracefully
        }
    }, [selectedStudentId, activeCycle]);

    useEffect(() => {
        if (selectedStudentId) {
            fetchReport();
        }
    }, [selectedStudentId, fetchReport]);


    if (loading && students.length === 0) return (
        <div className="flex justify-center items-center h-64">
            <Spinner />
            <span className="ml-4 text-white/50 text-xs tracking-widest uppercase">Analyzing Performance...</span>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-4">

            {/* Context Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                        <span className="text-[10px] font-black uppercase text-white/40 tracking-[0.4em]">Academic Intelligence</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-serif font-black text-white tracking-tighter uppercase leading-none">
                        Performance <span className="text-indigo-500">Matrix.</span>
                    </h2>
                </div>

                <div className="flex flex-col items-end gap-4">
                    {/* Student Selector */}
                    {students.length > 1 && (
                        <div className="flex bg-white/5 p-1 rounded-full border border-white/10">
                            {students.map(s => (
                                <button
                                    key={s.student_id}
                                    onClick={() => setSelectedStudentId(s.student_id)}
                                    className={`
                                        px-5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all
                                        ${selectedStudentId === s.student_id
                                            ? 'bg-indigo-500 text-white shadow-lg'
                                            : 'text-white/40 hover:text-white hover:bg-white/5'}
                                    `}
                                >
                                    {s.display_name}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Cycle Selector */}
                    <div className="relative z-20">
                        <button
                            onClick={() => setIsCycleMenuOpen(!isCycleMenuOpen)}
                            className="px-5 py-2 bg-white/5 rounded-full border border-white/10 text-[9px] font-black text-white/60 uppercase tracking-widest flex items-center gap-3 hover:bg-white/10 transition-colors"
                        >
                            <CalendarIcon className="w-3 h-3" />
                            {allCycles.find(c => c.id === activeCycle)?.year_name || 'Active Cycle'}
                        </button>
                        <AnimatePresence>
                            {isCycleMenuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="absolute right-0 top-full mt-2 w-48 bg-[#1a1b23] border border-white/10 rounded-xl shadow-2xl py-2"
                                >
                                    {allCycles.map(cycle => (
                                        <button
                                            key={cycle.id}
                                            onClick={() => {
                                                setActiveCycle(cycle.id);
                                                setIsCycleMenuOpen(false);
                                            }}
                                            className={`w-full text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-colors ${activeCycle === cycle.id ? 'text-indigo-400' : 'text-white/60'}`}
                                        >
                                            {cycle.year_name}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {academicReport && (
                <>
                    {/* High Level KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Grade Card */}
                        <div className="bg-gradient-to-br from-indigo-600/20 to-purple-900/20 border border-indigo-500/20 p-8 rounded-[2.5rem] relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                                <AcademicCapIcon className="w-32 h-32 text-indigo-400" />
                            </div>
                            <p className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.2em] mb-4">Overall Grade</p>
                            <h3 className="text-6xl font-serif font-black text-white mb-2" style={{ color: academicReport.summary.health_color }}>
                                {academicReport.summary.final_grade || 'N/A'}
                            </h3>
                            <p className="text-xs text-white/40 max-w-[150px] leading-relaxed">
                                Cumulative academic performance across all subjects.
                            </p>
                        </div>

                        {/* Percentage Card */}
                        <div className="bg-[#12141c] border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden group hover:border-white/10 transition-colors">
                            <div className="absolute right-0 top-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                                <ChartBarIcon className="w-32 h-32 text-white" />
                            </div>
                            <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] mb-6">Weighted Average</p>
                            <div className="relative w-32 h-32 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                                    <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="8" fill="transparent"
                                        strokeDasharray={377}
                                        strokeDashoffset={377 - (377 * (academicReport.summary.percentage || 0)) / 100}
                                        className="text-indigo-500 transition-all duration-1000 ease-out"
                                    />
                                </svg>
                                <span className="absolute text-2xl font-black text-white">{academicReport.summary.percentage}%</span>
                            </div>
                        </div>

                        {/* Assessments Count */}
                        <div className="bg-[#12141c] border border-white/5 p-8 rounded-[2.5rem] flex flex-col justify-between group hover:border-white/10 transition-colors">
                            <div>
                                <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] mb-2">Assessments Completed</p>
                                <h3 className="text-4xl font-serif font-black text-white">{academicReport.summary.total_exams}</h3>
                            </div>
                            <div className="w-full bg-white/5 h-16 rounded-2xl flex items-end justify-around pb-2 px-2 gap-1 overflow-hidden">
                                {[40, 70, 50, 90, 60, 80, 50].map((h, i) => (
                                    <div key={i} className="w-full bg-indigo-500/20 rounded-t-sm transition-all group-hover:bg-indigo-500/40" style={{ height: `${h}%` }}></div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Subject Performance Grid */}
                    <div>
                        <h3 className="text-lg font-serif font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-3">
                            <BookOpenIcon className="w-5 h-5 text-white/40" />
                            Subject Proficiency
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {academicReport.subjects.map((sub: any, idx: number) => (
                                <div key={idx} className="bg-[#111218] border border-white/5 p-6 rounded-3xl hover:bg-white/[0.02] transition-colors">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-bold text-white tracking-wide">{sub.subject}</h4>
                                        <span className={`text-sm font-black ${sub.percentage >= 75 ? 'text-emerald-400' : sub.percentage >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                                            {sub.percentage}%
                                        </span>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ${sub.percentage >= 75 ? 'bg-emerald-500' : sub.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                            style={{ width: `${sub.percentage}%` }}
                                        />
                                    </div>
                                    <div className="mt-3 flex justify-between text-[9px] font-black text-white/30 uppercase tracking-widest">
                                        <span>{sub.exams_count} Assessments</span>
                                        <span>Target: 90%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Exam Timeline */}
                    <div className="bg-[#12141c] border border-white/5 rounded-[2.5rem] overflow-hidden">
                        <div className="p-8 border-b border-white/5">
                            <h3 className="text-lg font-serif font-bold text-white uppercase tracking-wider">Exam Registry</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[#0f1115] border-b border-white/5 text-[9px] font-black text-white/20 uppercase tracking-[0.5em]">
                                    <tr>
                                        <th className="p-6 pl-8">Exam Node</th>
                                        <th className="p-6">Date</th>
                                        <th className="p-6 text-right">Score</th>
                                        <th className="p-6 text-center">Grade</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                    {academicReport.exams.map((exam: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-6 pl-8 font-medium text-white/80">
                                                {exam.exam}
                                                <span className="block text-[10px] text-white/40 mt-1 uppercase tracking-wider">{exam.subject}</span>
                                            </td>
                                            <td className="p-6 text-sm text-white/50 font-mono">
                                                {new Date(exam.date).toLocaleDateString()}
                                            </td>
                                            <td className="p-6 text-right font-mono text-white/90">
                                                {exam.marks_obtained} / {exam.total_marks}
                                            </td>
                                            <td className="p-6 text-center">
                                                <span
                                                    className="inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border"
                                                    style={{
                                                        borderColor: `${exam.grade.color}40`,
                                                        backgroundColor: `${exam.grade.color}10`,
                                                        color: exam.grade.color
                                                    }}
                                                >
                                                    {exam.grade.label}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {academicReport.exams.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-12 text-center text-white/20 text-xs italic uppercase tracking-widest">
                                                No exam records found for this cycle.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AcademicsTab;
