import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, formatError } from '../../services/supabase';
import { SchoolClass, StudentForAdmin, Course, SchoolAdminProfileData } from '../../types';
import Spinner from '../common/Spinner';
import { XIcon } from '../icons/XIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { TeacherIcon } from '../icons/TeacherIcon';
import { BookIcon } from '../icons/BookIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { ChartBarIcon } from '../icons/ChartBarIcon';
import { FileTextIcon } from '../icons/FileTextIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';

interface ClassWorkspaceProps {
    classData: SchoolClass & {
        student_count?: number;
        teacher_name?: string;
        grade_level?: string;
        section?: string;
        academic_year?: string;
        capacity?: number;
    };
    onClose: () => void;
    onUpdate: () => void;
    schoolProfile: SchoolAdminProfileData | null;
}

type TabType = 'overview' | 'students' | 'teachers' | 'subjects' | 'timetable' | 'analytics' | 'docs' | 'activity';

const TabButton: React.FC<{ id: TabType, label: string, icon: React.ReactNode, active: boolean, onClick: (id: TabType) => void }> = ({ id, label, icon, active, onClick }) => (
    <button
        onClick={() => onClick(id)}
        className={`flex items-center gap-3 px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] border-l-4 transition-all whitespace-nowrap ${active
                ? 'border-primary text-primary bg-primary/10 shadow-[inset_4px_0_12px_rgba(var(--primary),0.1)]'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5'
            }`}
    >
        <span className={`${active ? 'scale-110' : 'opacity-60'} transition-transform`}>{icon}</span>
        {label}
    </button>
);

const StatWidget: React.FC<{ title: string, value: string | number, icon: React.ReactNode, color: string, trend?: string }> = ({ title, value, icon, color, trend }) => (
    <motion.div
        whileHover={{ y: -5 }}
        className="bg-card border border-border/60 rounded-[1.5rem] p-6 shadow-sm flex flex-col justify-between hover:shadow-xl hover:border-primary/20 transition-all group"
    >
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-2xl ${color} bg-opacity-10 text-${color.split('-')[1]}-600 shadow-inner group-hover:scale-110 transition-transform`}>
                {icon}
            </div>
            {trend && <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg">+{trend}</span>}
        </div>
        <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{title}</p>
            <p className="text-3xl font-black text-foreground tracking-tight">{value}</p>
        </div>
    </motion.div>
);

const ClassWorkspace: React.FC<ClassWorkspaceProps> = ({ classData, onClose, onUpdate, schoolProfile }) => {
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [loading, setLoading] = useState(false);
    const [students, setStudents] = useState<StudentForAdmin[]>([]);
    const [subjects, setSubjects] = useState<Course[]>([]);

    // Mock Data for enhancement visualization
    const [stats] = useState({
        attendanceRate: 94.2,
        avgPerformance: 78.5,
        pendingFees: 3,
        engagementScore: 88
    });

    const fetchDetails = useCallback(async () => {
        setLoading(true);
        try {
            const { data: rosterData } = await supabase.rpc('get_class_roster_for_admin', { p_class_id: classData.id });
            if (rosterData) setStudents(rosterData);

            const { data: subjectData } = await supabase.from('class_subjects')
                .select('subject_id, courses(*)')
                .eq('class_id', classData.id);

            if (subjectData) {
                const mappedSubjects = subjectData.map((item: any) => item.courses);
                setSubjects(mappedSubjects.filter(Boolean));
            }
        } finally {
            setLoading(false);
        }
    }, [classData.id]);

    useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);

    const handleRemoveStudent = async (studentId: string) => {
        const confirmed = window.confirm('DANGER: This action will de-roster the student from this section. Continue?');
        if (!confirmed) return;
        const { error } = await supabase.from('student_profiles').update({ assigned_class_id: null }).eq('user_id', studentId);
        if (error) alert(formatError(error));
        else fetchDetails();
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-8"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatWidget title="Total Roster" value={students.length} icon={<UsersIcon className="w-6 h-6" />} color="bg-blue-500" trend="12%" />
                            <StatWidget title="Mapped Courses" value={subjects.length || 0} icon={<BookIcon className="w-6 h-6" />} color="bg-purple-500" />
                            <StatWidget title="Live Attendance" value={`${stats.attendanceRate}%`} icon={<ActivityIcon className="w-6 h-6" />} color="bg-emerald-500" trend="2.4%" />
                            <StatWidget title="Financial Risk" value={stats.pendingFees} icon={<AlertTriangleIcon className="w-6 h-6" />} color="bg-amber-500" />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 bg-card border border-border/80 rounded-[2rem] p-10 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] -mr-32 -mt-32"></div>
                                <div className="flex justify-between items-start mb-10 relative z-10">
                                    <div>
                                        <h3 className="text-2xl font-black text-foreground tracking-tight">Structural DNA</h3>
                                        <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1 opacity-60">System configuration for {classData.name}</p>
                                    </div>
                                    <button className="text-[10px] font-black uppercase tracking-[0.2em] bg-primary/10 hover:bg-primary/20 text-primary px-6 py-3 rounded-xl transition-all border border-primary/20 shadow-lg shadow-primary/5">Execute Edit</button>
                                </div>
                                <div className="grid grid-cols-2 gap-10 text-sm relative z-10">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Academic Hierarchy</p>
                                        <p className="font-bold text-lg">{classData.grade_level} - Terminal</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Zone Designation</p>
                                        <p className="font-bold text-lg">Section {classData.section || 'Alpha'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Temporal Cycle</p>
                                        <p className="font-bold text-lg">{classData.academic_year || '2024-25'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Density Control</p>
                                        <progress className="w-full h-2 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary" value={students.length} max={classData.capacity || 30}></progress>
                                        <p className="text-[10px] font-bold text-right opacity-60">{students.length} / {classData.capacity || 30} Units</p>
                                    </div>
                                </div>
                                <div className="mt-12 pt-10 border-t border-border/60 relative z-10">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-6">Structural Lead (Class Teacher)</p>
                                    {classData.teacher_name ? (
                                        <div className="flex items-center gap-5 p-5 bg-primary/[0.03] rounded-3xl border border-primary/10 group-hover:bg-primary/[0.05] transition-colors">
                                            <div className="relative">
                                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-xl shadow-primary/20">
                                                    {classData.teacher_name.charAt(0)}
                                                </div>
                                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-4 border-card rounded-full shadow-lg"></div>
                                            </div>
                                            <div>
                                                <p className="text-lg font-black text-foreground tracking-tight">{classData.teacher_name}</p>
                                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Authorized Faculty Lead</p>
                                            </div>
                                            <button className="ml-auto p-3 hover:bg-primary/[0.08] rounded-2xl text-primary transition-all">
                                                <ChevronRightIcon className="w-6 h-6" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="p-6 bg-amber-500/5 border-2 border-dashed border-amber-500/20 rounded-3xl text-amber-600/90 text-sm flex items-center justify-center gap-3 font-bold italic">
                                            <AlertTriangleIcon className="w-5 h-5 animate-bounce" /> No System Lead Assigned. Manual Override Required.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-foreground text-background rounded-[2rem] p-8 shadow-2xl space-y-6 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-indigo-500"></div>
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">System Controls</h3>
                                    <div className="space-y-3">
                                        {[
                                            { label: 'Synchronize Students', icon: <UsersIcon className="w-4 h-4" />, color: 'hover:bg-blue-500' },
                                            { label: 'Structural Timetable', icon: <ClockIcon className="w-4 h-4" />, color: 'hover:bg-indigo-500' },
                                            { label: 'Export Intelligence', icon: <DownloadIcon className="w-4 h-4" />, color: 'hover:bg-emerald-500' },
                                            { label: 'Initiate Audit', icon: <ChartBarIcon className="w-4 h-4" />, color: 'hover:bg-amber-500' }
                                        ].map(action => (
                                            <button key={action.label} className={`w-full py-4 px-5 rounded-2xl bg-white/10 hover:shadow-xl font-black text-[10px] uppercase tracking-widest text-left flex items-center justify-between transition-all group/btn ${action.color}`}>
                                                <span className="flex items-center gap-4">{action.icon} {action.label}</span>
                                                <ChevronRightIcon className="w-4 h-4 opacity-0 group-hover/btn:opacity-100 group-hover/btn:translate-x-1 transition-all" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                );
            case 'students':
                return (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-8"
                    >
                        <div className="flex justify-between items-center bg-card/50 p-6 rounded-[2.5rem] border border-border/60 backdrop-blur-md">
                            <div>
                                <h3 className="text-2xl font-black text-foreground tracking-tight">Active Roster ({students.length})</h3>
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">Enrolled unit details for {classData.name}</p>
                            </div>
                            <button className="bg-foreground text-background px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-xl">
                                <PlusIcon className="w-4 h-4" /> Deploy Enrollment
                            </button>
                        </div>
                        <div className="bg-card border border-border/80 rounded-[2.5rem] overflow-hidden shadow-2xl">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-muted/10 border-b border-border/60 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                                    <tr>
                                        <th className="p-8 pl-10">Unit Identity</th>
                                        <th className="p-8">System ID</th>
                                        <th className="p-8">Classification</th>
                                        <th className="p-8 text-right pr-10">Control</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/20">
                                    {students.map(student => (
                                        <tr key={student.id} className="hover:bg-primary/[0.02] transition-colors group">
                                            <td className="p-8 pl-10">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-black group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                                                        {student.display_name.charAt(0)}
                                                    </div>
                                                    <span className="font-black text-foreground tracking-tight">{student.display_name}</span>
                                                </div>
                                            </td>
                                            <td className="p-8 font-mono text-[10px] font-black text-muted-foreground tracking-widest">{student.student_id_number || 'VOID'}</td>
                                            <td className="p-8">
                                                <span className="px-3 py-1 bg-muted/30 rounded-lg text-[9px] font-black uppercase tracking-widest border border-border/50">{student.gender || 'N/A'}</span>
                                            </td>
                                            <td className="p-8 text-right pr-10">
                                                <button onClick={() => handleRemoveStudent(student.id)} className="text-[9px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500 hover:text-white px-5 py-2.5 rounded-xl transition-all border border-red-500/20 active:scale-95">De-Roster</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {students.length === 0 && <tr><td colSpan={4} className="p-20 text-center text-muted-foreground font-black uppercase tracking-[0.3em] opacity-40">Zero Units Detected</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                );
            case 'analytics':
                return (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-3xl font-black text-foreground tracking-tight italic uppercase">Operational Intelligence</h3>
                                <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">Deep forensic analysis of structural performance.</p>
                            </div>
                            <div className="flex items-center gap-2 p-1 bg-muted/20 rounded-2xl border border-border/40">
                                {['Day', 'Week', 'Month'].map(t => (
                                    <button key={t} className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${t === 'Week' ? 'bg-card text-primary shadow-lg ring-1 ring-primary/20' : 'text-muted-foreground hover:text-foreground'}`}>{t}</button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                            <div className="lg:col-span-2 space-y-10">
                                <div className="bg-card border border-border/80 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden h-[400px]">
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-indigo-500/[0.03]"></div>
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] mb-10 text-muted-foreground">Performance Velocity Curve</h4>
                                    <div className="h-48 flex items-end gap-3 relative pb-6 border-b border-border/40">
                                        {[45, 67, 54, 89, 72, 91, 84, 95, 76, 88].map((v, i) => (
                                            <div key={i} className="flex-1 flex flex-col items-center gap-3 group/bar">
                                                <div className="relative w-full">
                                                    <motion.div
                                                        initial={{ height: 0 }}
                                                        animate={{ height: `${v}%` }}
                                                        transition={{ delay: i * 0.05, duration: 1 }}
                                                        className={`w-full rounded-2xl transition-all shadow-lg shadow-black/5 ${i === 7 ? 'bg-primary' : 'bg-muted/40 group-hover/bar:bg-primary/40'}`}
                                                    ></motion.div>
                                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-foreground text-background px-2.5 py-1 rounded-lg text-[10px] font-black opacity-0 group-hover/bar:opacity-100 transition-all scale-75 group-hover/bar:scale-100">{v}%</div>
                                                </div>
                                                <span className="text-[8px] font-black text-muted-foreground/60 uppercase">M{i + 1}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-8 flex justify-between items-center">
                                        <div className="flex gap-10">
                                            <div><p className="text-[10px] font-black uppercase text-muted-foreground">Avg Pulse</p><p className="text-xl font-black">78.5</p></div>
                                            <div><p className="text-[10px] font-black uppercase text-muted-foreground">Threshold</p><p className="text-xl font-black">65.0</p></div>
                                        </div>
                                        <div className="flex items-center gap-2 text-emerald-500 font-black text-xs">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                                            STABLE
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-10">
                                    <div className="bg-card border border-border px-8 py-10 rounded-[2.5rem] shadow-lg">
                                        <h5 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-4">Subject Proficiency</h5>
                                        <div className="space-y-6">
                                            {['Mathematics', 'Sciences', 'Humanities'].map(s => (
                                                <div key={s} className="space-y-2">
                                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest"><span className="opacity-60">{s}</span><span>{s === 'Sciences' ? '92%' : '74%'}</span></div>
                                                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: s === 'Sciences' ? '92%' : '74%' }}></div></div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-card border border-border px-8 py-10 rounded-[2.5rem] shadow-lg">
                                        <h5 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-4">Engagement Index</h5>
                                        <div className="relative h-24 flex items-center justify-center">
                                            <div className="text-4xl font-black italic tracking-tighter">88<span className="text-xs non-italic opacity-40 ml-1">/100</span></div>
                                            <svg className="absolute w-32 h-32 -rotate-90">
                                                <circle cx="64" cy="64" r="50" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-muted/10"></circle>
                                                <circle cx="64" cy="64" r="50" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-primary" strokeDasharray="314" strokeDashoffset="38"></circle>
                                            </svg>
                                        </div>
                                        <p className="text-center text-[9px] font-black uppercase opacity-40 mt-6 tracking-[0.2em]">Alpha Class Ranking: #2</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-10">
                                <div className="bg-muted px-8 py-10 rounded-[2.5rem] space-y-8">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest opacity-60">System Insights</h4>
                                    {[
                                        { title: 'Peak Attendance', value: 'Tuesday', icon: <ActivityIcon className="w-4 h-4" /> },
                                        { title: 'Low Engagement', value: 'History', icon: <BookIcon className="w-4 h-4" /> },
                                        { title: 'Predictive Growth', value: '+14%', icon: <ChartBarIcon className="w-4 h-4" /> }
                                    ].map(item => (
                                        <div key={item.title} className="flex items-center gap-4">
                                            <div className="p-3 bg-white/10 rounded-xl text-foreground/60 shadow-inner">{item.icon}</div>
                                            <div>
                                                <p className="text-[8px] font-black uppercase opacity-40 leading-none mb-1">{item.title}</p>
                                                <p className="text-sm font-black tracking-tight">{item.value}</p>
                                            </div>
                                        </div>
                                    ))}
                                    <button className="w-full py-4 bg-foreground text-background rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl hover:scale-105 active:scale-95 transition-all">Download Audit</button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                );
            case 'docs':
                return (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
                        <div className="flex justify-between items-center bg-card p-10 rounded-[3rem] border border-border h-48 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-[100px] -mr-40 -mt-40"></div>
                            <div className="relative z-10">
                                <h3 className="text-4xl font-black text-foreground tracking-tighter uppercase italic">Repository</h3>
                                <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.3em] mt-2">Centralized institutional documentation.</p>
                            </div>
                            <div className="flex gap-4 relative z-10">
                                <button className="p-4 bg-muted hover:bg-neutral-500/10 rounded-2xl transition-all shadow-md"><DownloadIcon className="w-6 h-6 text-muted-foreground" /></button>
                                <button className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all">Upload Document</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {[
                                { name: 'Academic_Syllabus_24.pdf', size: '2.4 MB', type: 'PDF' },
                                { name: 'Faculty_Assessments_Q1.xlsx', size: '1.1 MB', type: 'XLS' },
                                { name: 'Parent_Communication_Logs.docx', size: '842 KB', type: 'DOC' },
                                { name: 'Class_Timetable_Final.v2.pdf', size: '4.2 MB', type: 'PDF' }
                            ].map(doc => (
                                <motion.div whileHover={{ scale: 1.02, y: -5 }} key={doc.name} className="bg-card border border-border p-8 rounded-[2rem] flex items-center justify-between group shadow-sm hover:shadow-2xl transition-all">
                                    <div className="flex items-center gap-6">
                                        <div className="w-14 h-14 rounded-2xl bg-muted group-hover:bg-primary/10 transition-all flex items-center justify-center text-muted-foreground group-hover:text-primary">
                                            <FileTextIcon className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <p className="font-black text-foreground tracking-tight max-w-[140px] truncate">{doc.name}</p>
                                            <p className="text-[10px] font-black uppercase text-muted-foreground opacity-40 mt-1">{doc.size} • {doc.type}</p>
                                        </div>
                                    </div>
                                    <button className="p-3 opacity-0 group-hover:opacity-100 bg-muted hover:bg-primary hover:text-white transition-all rounded-xl"><DownloadIcon className="w-4 h-4" /></button>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                );
            case 'activity':
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-4xl mx-auto space-y-12 py-10">
                        <h3 className="text-3xl font-black text-foreground tracking-tighter uppercase italic text-center">Protocol Feed</h3>
                        <div className="relative space-y-12">
                            <div className="absolute left-[31px] top-0 w-px h-full bg-border/40"></div>
                            {[
                                { action: 'Section Re-roster', user: 'Admin Node', time: '2 hours ago', icon: <UsersIcon className="w-4 h-4" />, color: 'bg-blue-500' },
                                { action: 'Timetable Optimization', user: 'AI Assistant', time: '5 hours ago', icon: <SparklesIcon className="w-4 h-4" />, color: 'bg-primary' },
                                { action: 'New Faculty Assignment', user: 'School Principal', time: 'Today, 10:14 AM', icon: <TeacherIcon className="w-4 h-4" />, color: 'bg-purple-500' },
                                { action: 'Structural Audit Complete', user: 'System Bot', time: 'Yesterday', icon: <ChartBarIcon className="w-4 h-4" />, color: 'bg-emerald-500' }
                            ].map((log, i) => (
                                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} key={i} className="relative flex items-center gap-10 group">
                                    <div className={`relative z-10 w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-transform ${log.color}`}>
                                        {log.icon}
                                    </div>
                                    <div className="flex-grow bg-card border border-border/80 p-8 rounded-[2rem] shadow-sm group-hover:shadow-2xl transition-all relative">
                                        <div className="absolute left-0 top-1/2 -translate-x-1/2 w-4 h-4 bg-card border-l border-t border-border/80 rotate-45 -ml-2"></div>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-black text-lg tracking-tight text-foreground">{log.action}</p>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 mt-1">Authorized by {log.user}</p>
                                            </div>
                                            <span className="text-[9px] font-black text-muted-foreground/40 italic">{log.time}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                );
            case 'timetable':
                return (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="relative mb-10">
                            <div className="absolute inset-0 bg-primary/20 blur-3xl scale-150 animate-pulse"></div>
                            <div className="relative w-28 h-28 bg-card rounded-[2.5rem] flex items-center justify-center border-2 border-dashed border-primary/20 shadow-2xl">
                                <ClockIcon className="w-14 h-14 text-primary/40" />
                            </div>
                        </div>
                        <h3 className="text-3xl font-black text-foreground tracking-tight italic uppercase">Temporal Matrix</h3>
                        <p className="text-muted-foreground text-sm mt-3 mb-10 max-w-md mx-auto font-medium">Weekly structural schedules are managed in the global Timetable Core module for cross-institutional alignment.</p>
                        <button className="px-10 py-4 bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all">Access Nexus Interface</button>
                    </div>
                );
            default:
                return <div className="p-20 text-center text-muted-foreground font-black uppercase tracking-[0.5em] opacity-40">System Core Null</div>;
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[100] flex items-center justify-center p-4 lg:p-10 pointer-events-auto"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: 50, scale: 0.95, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                exit={{ y: 50, scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="bg-background w-full max-w-[1440px] h-full rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/[0.08] flex flex-col overflow-hidden ring-1 ring-white/10"
                onClick={e => e.stopPropagation()}
            >

                {/* Protocol Header */}
                <div className="px-12 py-10 border-b border-white/[0.05] bg-card/[0.4] backdrop-blur-3xl flex justify-between items-center relative z-20">
                    <div className="flex items-center gap-8">
                        <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-primary to-indigo-700 flex items-center justify-center text-white text-3xl font-black shadow-[0_20px_40px_rgba(var(--primary),0.3)] ring-4 ring-primary/5">
                            {classData.grade_level}
                        </div>
                        <div>
                            <div className="flex items-center gap-4">
                                <h2 className="text-4xl font-black text-foreground tracking-tighter italic uppercase">{classData.name}</h2>
                                <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-inner">Operational</span>
                            </div>
                            <div className="flex items-center gap-5 mt-2 text-xs text-muted-foreground font-black uppercase tracking-widest opacity-60">
                                <span>Cycle: {classData.academic_year}</span>
                                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"></div>
                                <span>Jurisdiction: {schoolProfile?.school_name}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-4 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-all duration-500 transform hover:rotate-90 shadow-lg"><XIcon className="w-8 h-8" /></button>
                </div>

                <div className="flex flex-col md:flex-row flex-grow overflow-hidden">
                    {/* Navigation Cortex */}
                    <div className="w-full md:w-80 bg-black/20 border-r border-white/5 flex-shrink-0 flex flex-col relative z-10">
                        <nav className="p-6 space-y-2 flex-grow overflow-y-auto scrollbar-hide">
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/30 px-6 mb-4">Core Control</p>
                            <TabButton id="overview" label="Workspace Overview" icon={<ActivityIcon className="w-5 h-5" />} active={activeTab === 'overview'} onClick={setActiveTab} />
                            <TabButton id="students" label="Section Roster" icon={<UsersIcon className="w-5 h-5" />} active={activeTab === 'students'} onClick={setActiveTab} />
                            <TabButton id="teachers" label="Faculty Matrix" icon={<TeacherIcon className="w-5 h-5" />} active={activeTab === 'teachers'} onClick={setActiveTab} />
                            <TabButton id="subjects" label="Curriculum Map" icon={<BookIcon className="w-5 h-5" />} active={activeTab === 'subjects'} onClick={setActiveTab} />
                            <div className="h-4"></div>
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/30 px-6 mb-4">Intelligence</p>
                            <TabButton id="timetable" label="Temporal Sync" icon={<ClockIcon className="w-5 h-5" />} active={activeTab === 'timetable'} onClick={setActiveTab} />
                            <TabButton id="analytics" label="Performance Forensics" icon={<ChartBarIcon className="w-5 h-5" />} active={activeTab === 'analytics'} onClick={setActiveTab} />
                            <TabButton id="docs" label="Static Repository" icon={<FileTextIcon className="w-5 h-5" />} active={activeTab === 'docs'} onClick={setActiveTab} />
                            <TabButton id="activity" label="Action Protocol" icon={<ActivityIcon className="w-5 h-5" />} active={activeTab === 'activity'} onClick={setActiveTab} />
                        </nav>
                        <div className="p-10 border-t border-white/5 bg-black/10">
                            <div className="flex items-center gap-4 text-primary bg-primary/10 p-4 rounded-2xl border border-primary/20">
                                <SparklesIcon className="w-6 h-6 animate-pulse" />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em]">Cortex Online</span>
                            </div>
                        </div>
                    </div>

                    {/* Content Nexus */}
                    <div className="flex-grow overflow-y-auto p-12 lg:p-16 bg-background custom-scrollbar relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.01] to-transparent pointer-events-none"></div>
                        <AnimatePresence mode="wait">
                            {loading ? (
                                <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-full space-y-8">
                                    <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin shadow-2xl shadow-primary/20"></div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground animate-pulse">Syncing Structural Data...</p>
                                </motion.div>
                            ) : (
                                <div key={activeTab}>
                                    {renderTabContent()}
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default ClassWorkspace;