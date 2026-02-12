
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../services/supabase';
import { SchoolClass, Course, UserProfile, SchoolAdminProfileData } from '../types';
import Spinner from './common/Spinner';
import { ClassIcon } from './icons/ClassIcon';
import { PlusIcon } from './icons/PlusIcon';
import { SearchIcon } from './icons/SearchIcon';
import { EditIcon } from './icons/EditIcon';
import { TrashIcon } from './icons/TrashIcon';
import { UsersIcon } from './icons/UsersIcon';
import { TeacherIcon } from './icons/TeacherIcon';
import { XIcon } from './icons/XIcon';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { BookIcon } from './icons/BookIcon';
import { FilterIcon } from './icons/FilterIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon';
import { ClockIcon } from './icons/ClockIcon';
import { MoreHorizontalIcon } from './icons/MoreHorizontalIcon';
import { UploadIcon } from './icons/UploadIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon';
import BulkClassOperationsModal from './classes/BulkClassOperationsModal';
import { SparklesIcon } from './icons/SparklesIcon';
import { GoogleGenAI } from '@google/genai';
import CreateClassWizard from './classes/CreateClassWizard';
import ClassWorkspace from './classes/ClassWorkspace';

// --- Types ---

interface ExtendedClass extends SchoolClass {
    id: number;
    name: string;
    grade_level: string;
    capacity: number;
    class_teacher_id?: string | null;
    teacher_name?: string;
    student_count?: number;
    created_at?: string;
}

type QuickFilterType = 'All' | 'No Teacher' | 'No Students' | 'Overloaded' | 'New' | 'Full';
type ClassStatus = 'Active' | 'Pending Setup' | 'Inactive' | 'Draft' | 'Overloaded';

interface ClassesTabProps {
    branchId?: number | null;
    profile: UserProfile;
}

// --- Local Components ---

const SortIcon: React.FC<{ direction: 'ascending' | 'descending' | null }> = ({ direction }) => (
    <svg className={`w-3 h-3 ml-1 transition-transform duration-300 ${direction === 'descending' ? 'rotate-180' : ''} ${direction ? 'opacity-100' : 'opacity-30'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
);

const KPICard: React.FC<{
    title: string;
    value: number;
    subValue?: string | React.ReactNode;
    icon: React.ReactNode;
    color: string;
    trend?: string;
    onClick?: () => void;
    active?: boolean;
    index: number;
}> = ({ title, value, subValue, icon, color, trend, onClick, active, index }) => {
    const colorBase = color.split('-')[1];
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
            onClick={onClick}
            whileHover={{ y: -5, scale: 1.02 }}
            className={`
                relative overflow-hidden rounded-2xl p-6 transition-all duration-300 cursor-pointer group
                ${active
                    ? 'bg-card ring-2 ring-primary shadow-2xl shadow-primary/20 bg-gradient-to-br from-card to-primary/5'
                    : 'bg-card hover:shadow-2xl hover:border-primary/30 border border-border/80 shadow-sm'
                }
            `}
        >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-${colorBase}-500/10 to-transparent rounded-bl-full -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-125`}></div>
            <div className="relative z-10 flex justify-between items-start">
                <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] mb-2 flex items-center gap-2">
                        {title}
                        {trend && (
                            <motion.span
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                className="text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full text-[9px] font-bold ring-1 ring-emerald-500/20"
                            >
                                {trend}
                            </motion.span>
                        )}
                    </p>
                    <h3 className="text-3xl font-black text-foreground tracking-tighter flex items-center gap-1">
                        {value}
                        {active && <motion.div layoutId="active-dot" className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />}
                    </h3>
                    {subValue && <div className="mt-1 text-xs font-semibold text-muted-foreground/80">{subValue}</div>}
                </div>
                <div className={`p-3.5 rounded-2xl ${color} bg-opacity-10 text-${colorBase}-600 shadow-sm ring-1 ring-inset ring-neutral-400/10 dark:ring-white/10 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 group-hover:shadow-lg`}>
                    {icon}
                </div>
            </div>
        </motion.div>
    );
};

const StatusBadge: React.FC<{ status: ClassStatus | string }> = ({ status }) => {
    const styles: Record<string, string> = {
        'Active': 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-500/5',
        'Pending Setup': 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400 dark:bg-amber-500/5',
        'Inactive': 'bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400 dark:bg-red-500/5',
        'Draft': 'bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400 dark:bg-purple-500/5',
        'Overloaded': 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20 dark:text-indigo-400 dark:bg-indigo-500/5',
    };
    const dotColors: Record<string, string> = {
        'Active': 'bg-emerald-500',
        'Pending Setup': 'bg-amber-500',
        'Inactive': 'bg-red-500',
        'Draft': 'bg-purple-500',
        'Overloaded': 'bg-indigo-500',
    };
    let normalizedStatus = status;
    if (status === 'Pending') normalizedStatus = 'Pending Setup';
    if (status === 'Full') normalizedStatus = 'Active';

    return (
        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all hover:scale-105 cursor-default ${styles[normalizedStatus] || styles['Draft']}`}>
            <span className={`relative flex h-2 w-2 mr-2`}>
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-40 ${dotColors[normalizedStatus] || 'bg-gray-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColors[normalizedStatus] || 'bg-gray-400'}`}></span>
            </span>
            {normalizedStatus}
        </span>
    );
};

const ClassroomAIModal: React.FC<{ classes: ExtendedClass[]; onClose: () => void }> = ({ classes, onClose }) => {
    const [activeTab, setActiveTab] = useState<'distribution' | 'staffing' | 'insights'>('distribution');
    const [loading, setLoading] = useState(false);
    const [aiResponse, setAiResponse] = useState<string | null>(null);
    const [teachers, setTeachers] = useState<UserProfile[]>([]);

    useEffect(() => {
        if (activeTab === 'staffing' && teachers.length === 0) {
            supabase.rpc('get_all_teachers_for_admin').then(({ data }) => {
                if (data) setTeachers(data);
            });
        }
        setAiResponse(null);
    }, [activeTab]);

    const runAnalysis = async () => {
        setLoading(true);
        setAiResponse(null);

        try {
            const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
            if (!apiKey) throw new Error("AI Key Missing");
            const ai = new GoogleGenAI({ apiKey });

            let prompt = "";
            let dataContext = "";

            if (activeTab === 'distribution') {
                const classData = classes.map(c => ({ name: c.name, grade: c.grade_level, count: c.student_count, capacity: c.capacity || 30 }));
                dataContext = JSON.stringify(classData);
                prompt = `
                    Analyze the following class enrollment data: ${dataContext}.
                    Identify any classes that are overfilled (count > capacity) or significantly underfilled.
                    Suggest specific student moves to balance the distribution within the same grade levels.
                    Format the response as a list of actionable suggestions.
                    Keep it concise and professional.
                `;
            } else if (activeTab === 'staffing') {
                const unassigned = classes.filter(c => !c.class_teacher_id).map(c => c.name);
                const teacherList = teachers.map(t => t.display_name).slice(0, 10);
                prompt = `
                    The following classes have no assigned teacher: ${unassigned.join(', ')}.
                    Here is a list of available faculty: ${teacherList.join(', ')}.
                    Suggest optimal assignments based on typical school structures.
                    Provide a rationale for each suggestion.
                `;
            } else {
                const totalStudents = classes.reduce((acc, c) => acc + (c.student_count || 0), 0);
                const totalCapacity = classes.reduce((acc, c) => acc + (c.capacity || 30), 0);
                prompt = `
                    School Data: Total Students: ${totalStudents}, Total Capacity: ${totalCapacity}, Class Count: ${classes.length}.
                    Analyze the capacity utilization. Predict potential issues if enrollment grows by 10%.
                    Provide 3 strategic recommendations.
                `;
            }

            const result = await ai.models.generateContent({
                model: "gemini-1.5-flash",
                contents: [{ role: 'user', parts: [{ text: prompt }] }]
            });
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
            setAiResponse(text);

        } catch (err: any) {
            setAiResponse("AI Analysis Unavailable: " + (err.message || String(err)));
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-xl z-[200] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-card w-full max-w-3xl rounded-[2.5rem] shadow-2xl border border-white/10 flex flex-col overflow-hidden max-h-[85vh] ring-1 ring-black/5"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-8 border-b border-border bg-gradient-to-r from-primary/10 via-purple-500/5 to-transparent flex justify-between items-center backdrop-blur-md">
                    <div className="flex items-center gap-5">
                        <div className="p-3.5 bg-primary text-primary-foreground rounded-2xl shadow-xl shadow-primary/30 ring-4 ring-primary/5">
                            <SparklesIcon className="w-7 h-7 animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-foreground tracking-tight">Classroom Intelligence</h3>
                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-70">Empowered by Gemini AI</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2.5 rounded-full hover:bg-neutral-500/10 text-muted-foreground hover:text-foreground transition-all duration-300 transform hover:rotate-90"><XIcon className="w-6 h-6" /></button>
                </div>

                <div className="flex border-b border-border bg-muted/20 p-2 gap-2">
                    {[
                        { id: 'distribution', label: 'Distribution', icon: <UsersIcon className="w-4 h-4" /> },
                        { id: 'staffing', label: 'Staffing', icon: <TeacherIcon className="w-4 h-4" /> },
                        { id: 'insights', label: 'Strategy', icon: <ChartBarIcon className="w-4 h-4" /> },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 py-3.5 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-2xl transition-all ${activeTab === tab.id ? 'bg-card text-primary shadow-lg shadow-black/5 border border-border/50' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-10 overflow-y-auto flex-grow bg-background/50 custom-scrollbar">
                    {!aiResponse && !loading && (
                        <div className="text-center py-12 space-y-8">
                            <div className="relative inline-block">
                                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
                                <div className="relative w-28 h-28 bg-card/80 backdrop-blur-md rounded-[2.5rem] flex items-center justify-center mx-auto border-2 border-dashed border-primary/40 shadow-2xl">
                                    <SparklesIcon className="w-14 h-14 text-primary animate-bounce" />
                                </div>
                            </div>
                            <div className="max-w-md mx-auto space-y-3">
                                <h4 className="text-2xl font-black text-foreground tracking-tight">Intelligence Ready</h4>
                                <p className="text-muted-foreground text-sm leading-relaxed font-medium">
                                    {activeTab === 'distribution' && "I'll analyze student loads across sections to ensure a balanced academic environment."}
                                    {activeTab === 'staffing' && "I'll match the best available faculty to unassigned classes based on institutional history."}
                                    {activeTab === 'insights' && "I'll run a deep forensic analysis on current enrollment trends to project future scaling needs."}
                                </p>
                            </div>
                            <button onClick={runAnalysis} className="px-10 py-4 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(var(--primary),0.3)] hover:shadow-primary/50 transition-all hover:scale-105 active:scale-95 flex items-center gap-3 mx-auto text-sm group">
                                <SparklesIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" /> Start Analysis
                            </button>
                        </div>
                    )}

                    {loading && (
                        <div className="flex flex-col items-center justify-center py-20 space-y-8">
                            <div className="relative">
                                <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <SparklesIcon className="w-8 h-8 text-primary animate-pulse" />
                                </div>
                            </div>
                            <p className="text-sm font-black text-muted-foreground uppercase tracking-[0.3em] animate-pulse">Quantizing Parameters...</p>
                        </div>
                    )}

                    {aiResponse && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-8"
                        >
                            <div className="bg-card border border-border/60 rounded-[2rem] p-10 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-primary via-purple-500 to-indigo-600"></div>
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="p-3 bg-primary/10 rounded-xl text-primary"><SparklesIcon className="w-6 h-6" /></div>
                                    <h4 className="font-black text-xl tracking-tight text-foreground/90">AI Forensic Insight</h4>
                                </div>
                                <div className="prose dark:prose-invert prose-sm max-w-none text-foreground/80 whitespace-pre-wrap leading-relaxed font-medium text-base">
                                    {aiResponse}
                                </div>
                                <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-border/40">
                                    <button onClick={() => setAiResponse(null)} className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-muted-foreground hover:bg-neutral-500/10 transition-colors">Dismiss</button>
                                    <button onClick={runAnalysis} className="px-8 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest shadow-lg hover:shadow-primary/30 transition-all active:scale-95 flex items-center gap-2">
                                        <ClockIcon className="w-4 h-4" /> Regenerate
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

const ClassCard: React.FC<{
    cls: ExtendedClass;
    status: string;
    onClick: () => void;
    onAssign: (e: React.MouseEvent) => void;
}> = ({ cls, status, onClick, onAssign }) => (
    <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        whileHover={{ y: -8, scale: 1.02 }}
        onClick={onClick}
        className="bg-card border border-border/60 rounded-[2rem] p-6 shadow-sm hover:shadow-2xl transition-all group cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[320px]"
    >
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/5 to-purple-500/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-150"></div>

        <div className="space-y-6 relative z-10">
            <div className="flex justify-between items-start">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-600/10 text-blue-600 flex items-center justify-center font-black text-2xl border border-blue-500/10 shadow-inner group-hover:scale-110 transition-transform">
                    {cls.grade_level}
                </div>
                <StatusBadge status={status} />
            </div>

            <div>
                <h3 className="text-xl font-black text-foreground tracking-tight group-hover:text-primary transition-colors">{cls.name}</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 mt-1">{cls.academic_year} Cycle</p>
            </div>

            <div className="space-y-3">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <span>Capacity</span>
                    <span>{Math.round(((cls.student_count || 0) / (cls.capacity || 30)) * 100)}% Full</span>
                </div>
                <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden p-0.5 ring-1 ring-black/5">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(((cls.student_count || 0) / (cls.capacity || 30)) * 100, 100)}%` }}
                        className={`h-full rounded-full shadow-sm ${((cls.student_count || 0) > (cls.capacity || 30)) ? 'bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-emerald-500 to-teal-400'}`}
                    />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground/60">
                    <span>{cls.student_count || 0} Students</span>
                    <span>{cls.capacity || 30} Max</span>
                </div>
            </div>
        </div>

        <div className="pt-6 mt-6 border-t border-border/40 relative z-10">
            {cls.teacher_name ? (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-600/10 flex items-center justify-center text-indigo-600 text-xs font-black">
                        {cls.teacher_name.charAt(0)}
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Faculty Lead</p>
                        <p className="font-bold text-sm text-foreground">{cls.teacher_name}</p>
                    </div>
                </div>
            ) : (
                <button
                    onClick={onAssign}
                    className="w-full py-3 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-amber-500 hover:text-white transition-all shadow-sm active:scale-95"
                >
                    <AlertTriangleIcon className="w-4 h-4" /> Assign Faculty
                </button>
            )}
        </div>
    </motion.div>
);

const ClassesTab: React.FC<ClassesTabProps> = ({ branchId, profile }) => {
    const [classes, setClasses] = useState<ExtendedClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState<ExtendedClass | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [schoolProfile, setSchoolProfile] = useState<SchoolAdminProfileData | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [quickFilter, setQuickFilter] = useState<QuickFilterType>('All');
    const [sortConfig, setSortConfig] = useState<{ key: keyof ExtendedClass; direction: 'ascending' | 'descending' }>({ key: 'name', direction: 'ascending' });
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const [isAIModalOpen, setIsAIModalOpen] = useState(false);
    const [initialOpenAssignFaculty, setInitialOpenAssignFaculty] = useState(false);

    const fetchClasses = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_all_classes_for_admin', { p_branch_id: branchId });
            if (error) throw error;
            const extended: ExtendedClass[] = (data || []).map((c: any) => ({
                ...c,
                teacher_name: c.teacher_name,
                student_count: c.student_count,
                capacity: c.capacity || 30
            }));

            setClasses(extended);

            // Sync selected class with updated data
            setSelectedClass(prev => {
                if (!prev) return null;
                const fresh = extended.find(c => c.id === prev.id);
                return fresh ? fresh : prev;
            });

            const { data: schoolData } = await supabase.from('school_admin_profiles').select('*').limit(1).single();
            if (schoolData) setSchoolProfile(schoolData as SchoolAdminProfileData);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [branchId]);

    useEffect(() => {
        fetchClasses();
    }, [fetchClasses]);

    const getStatus = (cls: ExtendedClass): string => {
        if ((cls.student_count || 0) > (cls.capacity || 30)) return 'Overloaded';
        if (!cls.class_teacher_id) return 'Pending Setup';
        if ((cls.student_count || 0) === 0) return 'Draft';
        return 'Active';
    };

    const filteredClasses = useMemo(() => {
        return classes.filter(cls => {
            const matchesSearch = cls.name.toLowerCase().includes(searchTerm.toLowerCase()) || (cls.teacher_name || '').toLowerCase().includes(searchTerm.toLowerCase());
            let matchesFilter = true;
            if (quickFilter === 'No Teacher') matchesFilter = !cls.class_teacher_id;
            if (quickFilter === 'No Students') matchesFilter = (cls.student_count || 0) === 0;
            if (quickFilter === 'Overloaded') matchesFilter = (cls.student_count || 0) > (cls.capacity || 30);
            if (quickFilter === 'Full') matchesFilter = (cls.student_count || 0) === (cls.capacity || 30);
            return matchesSearch && matchesFilter;
        }).sort((a, b) => {
            const aVal = (a[sortConfig.key] || '').toString();
            const bVal = (b[sortConfig.key] || '').toString();
            if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
    }, [classes, searchTerm, quickFilter, sortConfig]);

    const stats = useMemo(() => ({
        total: classes.length,
        sections: new Set(classes.map(c => c.name)).size,
        students: classes.reduce((acc, c) => acc + (c.student_count || 0), 0),
        unassigned: classes.filter(c => !c.class_teacher_id).length,
    }), [classes]);

    const handleSort = (key: keyof ExtendedClass) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending'
        }));
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8 pb-20"
        >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 p-1">
                <div className="space-y-2">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3"
                    >
                        <div className="w-2 h-8 bg-primary rounded-full"></div>
                        <h1 className="text-4xl font-black text-foreground tracking-tighter uppercase italic">Academic Command</h1>
                    </motion.div>
                    <p className="text-muted-foreground font-medium text-lg max-w-xl leading-relaxed">System-wide structural orchestration of grades, sections, and faculty assignments.</p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <motion.button
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsAIModalOpen(true)}
                        className="px-6 py-3.5 bg-gradient-to-r from-primary to-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-[0_15px_30px_rgba(var(--primary),0.2)] transition-all flex items-center gap-3 border border-white/10"
                    >
                        <SparklesIcon className="w-5 h-5 text-white animate-pulse" /> AI Assistant
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsBulkModalOpen(true)}
                        className="px-6 py-3.5 bg-card hover:bg-neutral-500/5 text-foreground font-black uppercase tracking-widest rounded-2xl border border-border/80 transition-all flex items-center gap-3 shadow-md"
                    >
                        <UploadIcon className="w-5 h-5 text-muted-foreground" /> Bulk Ops
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-8 py-3.5 bg-foreground text-background font-black uppercase tracking-widest rounded-2xl shadow-xl hover:shadow-2xl transition-all flex items-center gap-3"
                    >
                        <PlusIcon className="w-5 h-5" /> New Class
                    </motion.button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard index={0} title="Academic Grades" value={12} icon={<ClassIcon className="w-6 h-6" />} color="bg-blue-600" active={false} />
                <KPICard index={1} title="Active Sections" value={stats.total} icon={<UsersIcon className="w-6 h-6" />} color="bg-emerald-600" />
                <KPICard index={2} title="Total Enrollment" value={stats.students} icon={<CheckCircleIcon className="w-6 h-6" />} color="bg-indigo-600" />
                <KPICard index={3} title="Orphaned Classes" value={stats.unassigned} icon={<AlertTriangleIcon className="w-6 h-6" />} color="bg-amber-600" trend={stats.unassigned > 0 ? 'Critical' : 'Stable'} onClick={() => setQuickFilter('No Teacher')} active={quickFilter === 'No Teacher'} />
            </div>

            <AnimatePresence>
                {filteredClasses.some(c => (c.student_count || 0) > (c.capacity || 30)) && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex items-center justify-between shadow-2xl shadow-red-500/5"
                    >
                        <div className="flex items-center gap-4 text-red-700 dark:text-red-400">
                            <div className="p-2.5 bg-red-500/20 rounded-xl animate-pulse"><AlertTriangleIcon className="w-5 h-5" /></div>
                            <div>
                                <span className="font-black uppercase tracking-wider text-xs block">Operational Violation</span>
                                <span className="font-medium text-sm opacity-80 text-red-600/90 dark:text-red-400/90">Critical capacity thresholds exceeded in some sections. Immediate rebalancing advised.</span>
                            </div>
                        </div>
                        <button onClick={() => setIsAIModalOpen(true)} className="text-[10px] font-black uppercase tracking-[0.2em] bg-red-500 text-white px-6 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-500/20">Analyze Risk</button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="bg-card border border-border/60 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col min-h-[600px] ring-1 ring-black/5 relative">
                <div className="p-6 border-b border-border bg-muted/20 backdrop-blur-3xl flex flex-col md:flex-row gap-6 justify-between items-center sticky top-0 z-20">
                    <div className="relative w-full md:max-w-md group">
                        <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-all duration-300" />
                        <input
                            type="text"
                            placeholder="Filter classes, faculty..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-14 pr-6 py-4 rounded-2xl border border-border/80 bg-background/50 text-sm font-bold placeholder:text-muted-foreground/50 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-inner"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-40">
                            <span className="text-[10px] font-black border border-border px-1.5 py-0.5 rounded-md">CMD</span>
                            <span className="text-[10px] font-black border border-border px-1.5 py-0.5 rounded-md">K</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto scrollbar-hide">
                        <div className="flex p-1 bg-black/5 dark:bg-white/5 rounded-2xl border border-border/40">
                            {(['All', 'No Teacher', 'No Students', 'Overloaded', 'New'] as QuickFilterType[]).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setQuickFilter(f)}
                                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${quickFilter === f ? 'bg-card text-primary shadow-xl ring-1 ring-primary/20' : 'bg-transparent text-muted-foreground hover:text-foreground'}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>

                        <div className="flex p-1 bg-black/5 dark:bg-white/5 rounded-2xl border border-border/40">
                            <button onClick={() => setViewMode('grid')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-card text-primary shadow-md' : 'text-muted-foreground hover:text-foreground'}`}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /></svg>
                            </button>
                            <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-card text-primary shadow-md' : 'text-muted-foreground hover:text-foreground'}`}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-grow overflow-x-auto custom-scrollbar p-6">
                    {loading ? (
                        <div className="flex flex-col justify-center items-center h-[500px] space-y-6">
                            <div className="relative">
                                <Spinner size="lg" className="text-primary" />
                                <div className="absolute inset-0 blur-2xl bg-primary/20 animate-pulse"></div>
                            </div>
                            <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">Synchronizing Academic State...</p>
                        </div>
                    ) : filteredClasses.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center h-[500px] text-center p-10"
                        >
                            <div className="relative mb-8">
                                <div className="absolute inset-0 bg-muted/20 blur-3xl rounded-full scale-150"></div>
                                <div className="relative w-24 h-24 bg-muted/10 rounded-[2rem] flex items-center justify-center border-2 border-dashed border-border/60">
                                    <ClassIcon className="w-12 h-12 text-muted-foreground/30" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-black text-foreground tracking-tight">Vortex Empty</h3>
                            <p className="text-muted-foreground text-sm mt-2 mb-10 max-w-xs mx-auto font-medium">Your current parameters have collapsed the search space. No records exist in this state.</p>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => { setSearchTerm(''); setQuickFilter('All') }}
                                className="text-primary text-[10px] font-black uppercase tracking-[0.2em] bg-primary/10 px-8 py-3.5 rounded-2xl hover:bg-primary/20 transition-all border border-primary/20"
                            >
                                Reset Context
                            </motion.button>
                        </motion.div>
                    ) : viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                            <AnimatePresence mode="popLayout">
                                {filteredClasses.map((cls, idx) => (
                                    <ClassCard
                                        key={cls.id}
                                        cls={cls}
                                        status={getStatus(cls)}
                                        onClick={() => {
                                            setInitialOpenAssignFaculty(false);
                                            setSelectedClass(cls);
                                        }}
                                        onAssign={(e) => {
                                            e.stopPropagation();
                                            setInitialOpenAssignFaculty(true);
                                            setSelectedClass(cls);
                                        }}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-muted/30 border-b border-border text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] sticky top-0 z-10 backdrop-blur-3xl shadow-sm">
                                <tr>
                                    <th className="p-8 cursor-pointer hover:text-primary group transition-all" onClick={() => handleSort('grade_level')}>
                                        <div className="flex items-center gap-2">Core Grade <SortIcon direction={sortConfig.key === 'grade_level' ? sortConfig.direction : null} /></div>
                                    </th>
                                    <th className="p-8 cursor-pointer hover:text-primary group transition-all" onClick={() => handleSort('name')}>
                                        <div className="flex items-center gap-2">Designation / Section <SortIcon direction={sortConfig.key === 'name' ? sortConfig.direction : null} /></div>
                                    </th>
                                    <th className="p-8 cursor-pointer hover:text-primary group transition-all" onClick={() => handleSort('teacher_name')}>
                                        <div className="flex items-center gap-2">Faculty Lead <SortIcon direction={sortConfig.key === 'teacher_name' ? sortConfig.direction : null} /></div>
                                    </th>
                                    <th className="p-8">Operational Capacity</th>
                                    <th className="p-8 text-center">Protocol Status</th>
                                    <th className="p-8 text-right pr-12">Action Control</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20">
                                <AnimatePresence mode="popLayout">
                                    {filteredClasses.map((cls, idx) => (
                                        <motion.tr
                                            key={cls.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ delay: Math.min(idx * 0.03, 0.4) }}
                                            onClick={() => {
                                                setInitialOpenAssignFaculty(false);
                                                setSelectedClass(cls);
                                            }}
                                            className="hover:bg-primary/[0.02] transition-colors cursor-pointer group/row border-l-4 border-l-transparent hover:border-l-primary"
                                        >
                                            <td className="p-8">
                                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-600/10 text-blue-600 flex items-center justify-center font-black text-base border border-blue-500/10 shadow-inner group-hover/row:scale-110 transition-transform">
                                                    {cls.grade_level}
                                                </div>
                                            </td>
                                            <td className="p-8">
                                                <p className="font-black text-foreground text-base tracking-tight group-hover/row:text-primary transition-colors">{cls.name}</p>
                                                <p className="text-[10px] text-muted-foreground mt-1 font-black uppercase tracking-widest opacity-60">{cls.academic_year}</p>
                                            </td>
                                            <td className="p-8">
                                                {cls.teacher_name ? (
                                                    <div className="flex items-center gap-4">
                                                        <div className="relative">
                                                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center text-indigo-600 text-xs font-black shadow-inner border border-white/5">
                                                                {(cls.teacher_name || '?').charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-card rounded-full shadow-lg"></div>
                                                        </div>
                                                        <span className="text-sm font-black text-foreground tracking-tight">{cls.teacher_name}</span>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setInitialOpenAssignFaculty(true);
                                                            setSelectedClass(cls);
                                                        }}
                                                        className="text-[9px] text-amber-600 font-black uppercase tracking-[0.2em] bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20 inline-flex items-center gap-2 group-hover/row:bg-amber-500 group-hover/row:text-white transition-all hover:scale-105 active:scale-95"
                                                    >
                                                        <AlertTriangleIcon className="w-3.5 h-3.5" /> Assign Faculty
                                                    </button>
                                                )}
                                            </td>
                                            <td className="p-8">
                                                <div className="w-48">
                                                    <div className="flex justify-between text-[10px] mb-2 font-black uppercase tracking-widest text-muted-foreground/60">
                                                        <span>{cls.student_count || 0} Synchronized</span>
                                                        <span>{cls.capacity || 30} Limit</span>
                                                    </div>
                                                    <div className="h-2.5 w-full bg-muted/40 rounded-full overflow-hidden ring-1 ring-black/5 p-0.5">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${Math.min(((cls.student_count || 0) / (cls.capacity || 30)) * 100, 100)}%` }}
                                                            transition={{ duration: 1, ease: "easeOut" }}
                                                            className={`h-full rounded-full shadow-lg ${((cls.student_count || 0) > (cls.capacity || 30)) ? 'bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-emerald-500 to-teal-400'}`}
                                                        ></motion.div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-8 text-center">
                                                <StatusBadge status={getStatus(cls)} />
                                            </td>
                                            <td className="p-8 text-right pr-12">
                                                <motion.button
                                                    whileHover={{ scale: 1.1, rotate: 90 }}
                                                    className="p-3 bg-muted/10 rounded-2xl text-muted-foreground hover:text-primary transition-all opacity-0 group-hover/row:opacity-100 shadow-sm border border-border/40"
                                                >
                                                    <MoreHorizontalIcon className="w-6 h-6" />
                                                </motion.button>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {selectedClass && (
                    <ClassWorkspace
                        key={selectedClass.id}
                        profile={profile}
                        classData={selectedClass}
                        onClose={() => {
                            setSelectedClass(null);
                            setInitialOpenAssignFaculty(false);
                        }}
                        onUpdate={fetchClasses}
                        schoolProfile={schoolProfile}
                        initialOpenAssignFaculty={initialOpenAssignFaculty}
                    />
                )}

                {isCreateModalOpen && (
                    <CreateClassWizard
                        onClose={() => setIsCreateModalOpen(false)}
                        onSuccess={fetchClasses}
                        branchId={branchId}
                    />
                )}

                {isBulkModalOpen && (
                    <BulkClassOperationsModal
                        onClose={() => setIsBulkModalOpen(false)}
                        onSuccess={() => {
                            setIsBulkModalOpen(false);
                            fetchClasses();
                        }}
                        academicYear={`${new Date().getFullYear()}-${new Date().getFullYear() + 1}`}
                        branchId={branchId}
                    />
                )}

                {isAIModalOpen && (
                    <ClassroomAIModal
                        classes={classes}
                        onClose={() => setIsAIModalOpen(false)}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default ClassesTab;
