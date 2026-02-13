
import React from 'react';
import { motion } from 'framer-motion';
import { CalendarIcon } from '../icons/CalendarIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';

interface ExamsOverviewProps {
    exams: any[];
    cycles: any[];
    branchId: number | null;
    onEnterMarks: (exam: any) => void;
}

const ExamsOverview: React.FC<ExamsOverviewProps> = ({ exams, cycles, branchId, onEnterMarks }) => {
    return (
        <div className="space-y-10">
            {/* Top Dashboard Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Active Cycles', value: cycles.length, icon: <CalendarIcon />, color: 'text-primary' },
                    { label: 'Total Assessments', value: exams.length, icon: <ShieldCheckIcon />, color: 'text-emerald-500' },
                    { label: 'Completion Index', value: '78%', icon: <UsersIcon />, color: 'text-amber-500' },
                    { label: 'Forensic Integrity', value: 'Verified', icon: <PlusIcon />, color: 'text-emerald-400' }
                ].map((stat, i) => (
                    <div key={i} className="bg-[#12141c] border border-white/5 p-8 rounded-[2.5rem] flex flex-col justify-between group hover:border-white/10 transition-all">
                        <div className={`p-4 rounded-2xl bg-white/[0.03] ${stat.color} w-fit`}>{stat.icon}</div>
                        <div className="mt-6">
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mb-2">{stat.label}</p>
                            <h3 className="text-3xl font-serif font-black text-white tracking-tighter italic">{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Exam Orchestrator Registry */}
            <div className="bg-[#12141c] border border-white/5 rounded-[3.5rem] overflow-hidden shadow-3xl">
                <div className="p-10 border-b border-white/5 bg-white/[0.01] flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-serif font-black text-white uppercase tracking-tight">Exam Orchestrator</h3>
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mt-2">Centralized assessment scheduling & validation registry</p>
                    </div>
                    <button className="px-10 py-5 bg-primary text-white font-black text-[10px] uppercase tracking-[0.4em] rounded-2xl shadow-2xl flex items-center gap-4 hover:-translate-y-1 transition-all active:scale-95 shadow-primary/20">
                        <PlusIcon className="w-4 h-4" /> Create Assessment
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[#0f1115] border-b border-white/5 text-[9px] font-black text-white/20 uppercase tracking-[0.5em]">
                            <tr>
                                <th className="p-10 pl-14">Subject node</th>
                                <th className="p-10 text-center">Standard</th>
                                <th className="p-10">Schedule artifacts</th>
                                <th className="p-10 text-center">Saturation</th>
                                <th className="p-10 text-right pr-14">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                            {exams.length > 0 ? exams.map((exam, idx) => (
                                <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                                    <td className="p-10 pl-14">
                                        <div className="flex items-center gap-6">
                                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-serif font-black">
                                                {exam.subject_title?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-xl font-serif font-black text-white tracking-tight uppercase group-hover:text-primary transition-colors">{exam.subject_title}</p>
                                                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-1">{exam.cycle_name}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-10 text-center">
                                        <span className="px-5 py-2 bg-white/5 rounded-xl text-[10px] font-black text-white uppercase tracking-widest border border-white/5 shadow-inner italic">
                                            {exam.class_name}
                                        </span>
                                    </td>
                                    <td className="p-10">
                                        <div className="space-y-1">
                                            <p className="text-[12px] font-black text-white/60 tracking-widest uppercase">{new Date(exam.exam_date).toLocaleDateString()}</p>
                                            <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Digital Venue Locked</p>
                                        </div>
                                    </td>
                                    <td className="p-10 text-center">
                                        <div className="space-y-3 max-w-[120px] mx-auto">
                                            <div className="flex justify-between text-[9px] font-black text-white/40 uppercase tracking-widest">
                                                <span>{exam.entry_count}/{exam.student_count}</span>
                                                <span className={exam.status === 'PUBLISHED' ? 'text-emerald-500' : 'text-primary'}>
                                                    {Math.round((exam.entry_count / (exam.student_count || 1)) * 100)}%
                                                </span>
                                            </div>
                                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden shadow-inner">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${(exam.entry_count / (exam.student_count || 1)) * 100}%` }}
                                                    className={`h-full ${exam.status === 'PUBLISHED' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-10 text-right pr-14">
                                        <button
                                            onClick={() => onEnterMarks(exam)}
                                            className="p-4 bg-white/5 text-white/20 rounded-2xl hover:bg-primary/10 hover:text-primary transition-all border border-white/5 hover:border-primary/20"
                                        >
                                            {exam.status === 'PUBLISHED' ? 'View Results' : 'Enter Marks'}
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="py-40 text-center opacity-20">
                                        <CalendarIcon className="w-16 h-16 mx-auto mb-6" />
                                        <p className="text-[12px] font-black uppercase tracking-[0.6em]">No Examination Artifacts Found in Registry</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ExamsOverview;
