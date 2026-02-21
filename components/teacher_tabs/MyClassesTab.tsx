import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../services/supabase';
import { TeacherClassOverview, TeacherClassDetails, ClassSubject, LessonPlan, FunctionComponentWithIcon } from '../../types';
import Spinner from '../common/Spinner';
import { UsersIcon } from '../icons/UsersIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { BookOpenIcon } from '../icons/BookOpenIcon';
import { XIcon } from '../icons/XIcon';
import { GraduationCapIcon } from '../icons/GraduationCapIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { FileTextIcon } from '../icons/FileTextIcon';
import { GridIcon } from '../icons/GridIcon';
import { UploadIcon } from '../icons/UploadIcon';

type DetailTab = 'roster' | 'assignments' | 'materials';

interface MyClassesTabProps {
    currentUserId: string;
}

const MyClassesTab: FunctionComponentWithIcon<MyClassesTabProps> = ({ currentUserId }) => {
    const [overviews, setOverviews] = useState<TeacherClassOverview[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
    const [classDetails, setClassDetails] = useState<TeacherClassDetails | null>(null);
    const [loading, setLoading] = useState({ overviews: true, details: false });
    const [error, setError] = useState<string | null>(null);

    const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>('roster');
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);

    const fetchOverviews = useCallback(async () => {
        setLoading({ overviews: true, details: false });
        setError(null);
        const { data, error } = await supabase.rpc('get_teacher_class_overviews');
        if (error) setError(`Failed to fetch classes: ${error.message}`);
        else setOverviews(data || []);
        setLoading(prev => ({ ...prev, overviews: false }));
    }, []);

    useEffect(() => {
        fetchOverviews();
    }, [fetchOverviews]);

    const handleSelectClass = useCallback(async (classId: number) => {
        if (selectedClassId === classId) {
            setSelectedClassId(null);
            setClassDetails(null);
            return;
        }
        setSelectedClassId(classId);
        setLoading(prev => ({ ...prev, details: true }));
        setError(null);
        const { data, error } = await supabase.rpc('get_teacher_class_details', { p_class_id: classId });
        if (error) setError(`Failed to fetch class details: ${error.message}`);
        else setClassDetails(data);
        setLoading(prev => ({ ...prev, details: false }));
    }, [selectedClassId]);

    const refreshDetails = () => {
        if (selectedClassId) handleSelectClass(selectedClassId);
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-10"
        >
            <div className="flex justify-between items-end border-b border-border pb-8">
                <div>
                    <h2 className="text-4xl font-black text-foreground tracking-tighter uppercase italic italic">Control Center</h2>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] mt-1 opacity-60">Operational Class Management</p>
                </div>
                <div className="flex gap-4">
                    <div className="bg-primary/5 border border-primary/10 rounded-2xl px-6 py-3 flex items-center gap-3">
                        <UsersIcon className="w-5 h-5 text-primary" />
                        <span className="text-sm font-black text-foreground">{overviews.length} Units</span>
                    </div>
                </div>
            </div>

            {loading.overviews ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <Spinner size="lg" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Syncing Unit Overviews...</p>
                </div>
            ) : error && !classDetails ? (
                <div className="p-12 text-center bg-rose-500/5 border-2 border-dashed border-rose-500/20 rounded-[3rem]">
                    <p className="text-rose-600 font-black text-sm uppercase tracking-widest italic">{error}</p>
                </div>
            ) : (overviews ?? []).length === 0 ? (
                <div className="p-24 text-center bg-muted/20 border-2 border-dashed border-border rounded-[4rem]">
                    <GridIcon className="w-20 h-20 mx-auto text-muted-foreground/10 mb-8" />
                    <p className="text-muted-foreground font-black text-[10px] uppercase tracking-[0.4em]">Zero Assigned Units Detected</p>
                    <p className="text-xs text-muted-foreground mt-4 font-bold">Contact institutional admin for unit allocation.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {overviews.map((cls, idx) => (
                        <ClassCard
                            key={cls.id}
                            classOverview={cls}
                            isSelected={selectedClassId === cls.id}
                            onClick={() => handleSelectClass(cls.id)}
                            index={idx}
                        />
                    ))}
                </div>
            )}

            <AnimatePresence mode="wait">
                {selectedClassId && classDetails && !loading.details && (
                    <motion.div
                        key={selectedClassId}
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="mt-12 bg-card border-2 border-border/60 rounded-[3.5rem] shadow-2xl overflow-hidden relative"
                    >
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-indigo-500 to-purple-600"></div>
                        <div className="p-10 border-b border-border bg-muted/10 flex flex-col xl:flex-row justify-between items-center gap-8">
                            <div className="flex items-center gap-6">
                                <div className="p-5 bg-primary/10 rounded-2xl text-primary shadow-inner">
                                    <GraduationCapIcon className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="font-black text-2xl text-foreground tracking-tight italic uppercase">{overviews.find(c => c.id === selectedClassId)?.name}</h3>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mt-1 opacity-60">Advanced Management</p>
                                </div>
                            </div>
                            <div className="flex bg-background border-2 border-border p-1.5 rounded-[1.5rem] shadow-inner">
                                {(['roster', 'assignments', 'materials'] as DetailTab[]).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveDetailTab(tab)}
                                        className={`px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeDetailTab === tab ? 'bg-primary text-white shadow-xl shadow-primary/30' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="p-12">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeDetailTab}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {activeDetailTab === 'roster' && <RosterView details={classDetails} />}
                                    {activeDetailTab === 'assignments' && <AssignmentsView details={classDetails} onAdd={() => setIsAssignmentModalOpen(true)} />}
                                    {activeDetailTab === 'materials' && <MaterialsView details={classDetails} onAdd={() => setIsMaterialModalOpen(true)} />}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {loading.details && (
                <div className="flex flex-col items-center justify-center p-24 gap-6">
                    <Spinner size="lg" className="text-primary" />
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Syncing User Interface...</p>
                </div>
            )}

            <AnimatePresence>
                {isAssignmentModalOpen && selectedClassId && classDetails && (
                    <AddAssignmentModal
                        classId={selectedClassId}
                        subjects={classDetails.subjects ?? []}
                        onClose={() => setIsAssignmentModalOpen(false)}
                        onSuccess={refreshDetails}
                        currentUserId={currentUserId}
                    />
                )}
                {isMaterialModalOpen && selectedClassId && classDetails && (
                    <AddMaterialModal
                        classId={selectedClassId}
                        subjects={classDetails.subjects ?? []}
                        onClose={() => setIsMaterialModalOpen(false)}
                        onSuccess={refreshDetails}
                        currentUserId={currentUserId}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// Sub-components for detail view
const ClassCard: React.FC<{ classOverview: TeacherClassOverview, isSelected: boolean, onClick: () => void, index: number }> = ({ classOverview, isSelected, onClick, index }) => (
    <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        whileHover={{ scale: 1.02, y: -5 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className={`p-10 rounded-[2.5rem] border-2 text-left transition-all duration-300 relative overflow-hidden group ${isSelected ? 'bg-primary/5 border-primary shadow-[0_0_50px_rgba(var(--primary),0.1)]' : 'bg-card border-border/60 hover:border-primary/40 shadow-xl'}`}
    >
        {isSelected && <div className="absolute top-0 left-0 w-full h-1.5 bg-primary"></div>}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-125 transition-transform"></div>

        <div className="flex justify-between items-start relative z-10">
            <div>
                <h3 className="font-black text-2xl text-foreground tracking-tight underline decoration-primary decoration-4 underline-offset-4 decoration-transparent group-hover:decoration-primary transition-all duration-500 uppercase italic italic">{classOverview.name}</h3>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mt-3 opacity-60">Unit Operations</p>
            </div>
            <div className={`p-4 rounded-2xl flex flex-col items-center gap-1 shadow-inner ${isSelected ? 'bg-primary text-white' : 'bg-muted/50 text-muted-foreground'}`}>
                <span className="text-lg font-black">{classOverview.student_count}</span>
                <UsersIcon className="w-4 h-4" />
            </div>
        </div>

        <div className="mt-10 flex items-center justify-between text-[10px] font-black uppercase tracking-widest relative z-10">
            <span className={isSelected ? 'text-primary' : 'text-muted-foreground/60'}>{isSelected ? 'Active Selection' : 'Click to Command'}</span>
            <ChevronRightIcon className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-muted-foreground/30'}`} />
        </div>
    </motion.button>
);

const RosterView: React.FC<{ details: TeacherClassDetails }> = ({ details }) => {
    const roster = details?.roster ?? [];
    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h4 className="text-xl font-black text-foreground tracking-tight uppercase italic underline decoration-primary decoration-4 underline-offset-8">Unit Personnel</h4>
                <div className="text-[10px] font-black uppercase tracking-widest bg-muted px-5 py-2 rounded-xl border border-border">{roster.length} Sync'd Profiles</div>
            </div>
            {roster.length === 0 ? (
                <div className="p-20 text-center bg-muted/20 rounded-[3rem] border-2 border-dashed border-border mt-4">
                    <UsersIcon className="w-16 h-16 mx-auto text-muted-foreground/10 mb-6" />
                    <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Zero Personnel Detected</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                    {roster.map((student, idx) => (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            key={student.id}
                            className="p-6 bg-card rounded-[2rem] border border-border/80 flex items-center gap-6 shadow-sm hover:shadow-2xl hover:border-primary/30 transition-all group cursor-default"
                        >
                            <div className="h-16 w-16 rounded-2xl overflow-hidden bg-primary/5 flex-shrink-0 border-2 border-border/50 group-hover:border-primary/40 transition-colors shadow-inner">
                                <img className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" src={`https://api.dicebear.com/8.x/initials/svg?seed=${student.display_name}&backgroundColor=transparent&textColor=primary`} alt="" />
                            </div>
                            <div className="min-w-0">
                                <p className="font-black text-foreground tracking-tight text-lg truncate group-hover:text-primary transition-colors uppercase italic">{student.display_name}</p>
                                <div className="flex items-center gap-3 mt-1.5 font-black uppercase tracking-widest opacity-60">
                                    <span className="text-[9px] bg-muted px-2 py-0.5 rounded-lg border border-border">#{student.roll_number || 'STU'}</span>
                                    <span className="text-[8px]">Enrolled</span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};

const AssignmentsView: React.FC<{ details: TeacherClassDetails, onAdd: () => void }> = ({ details, onAdd }) => {
    const assignments = details?.assignments ?? [];
    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h4 className="text-xl font-black text-foreground tracking-tight uppercase italic underline decoration-primary decoration-4 underline-offset-8">Output Assignments</h4>
                <button onClick={onAdd} className="bg-primary text-white text-[10px] font-black uppercase tracking-widest px-8 py-4 rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"><PlusIcon className="w-5 h-5" /> Deploy Assignment</button>
            </div>
            {assignments.length === 0 ? (
                <div className="p-20 text-center bg-muted/20 rounded-[3rem] border-2 border-dashed border-border mt-4">
                    <FileTextIcon className="w-16 h-16 mx-auto text-muted-foreground/10 mb-6" />
                    <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Zero Active Deployments</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {assignments.map((a, idx) => (
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            key={a.id}
                            className="p-8 rounded-[2.5rem] border-2 border-border/80 bg-muted/10 hover:bg-card hover:border-primary/40 transition-all group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
                            <div className="flex justify-between items-start relative z-10">
                                <div className="space-y-2">
                                    <p className="font-black text-2xl text-foreground tracking-tighter uppercase italic group-hover:text-primary transition-colors">{a.title}</p>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary px-3 py-1 rounded-lg border border-primary/20">{a.subject}</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Assignment</span>
                                    </div>
                                </div>
                                <div className="text-right space-y-2">
                                    <div className="flex items-center justify-end gap-2 text-[10px] font-black text-rose-600 uppercase tracking-widest">
                                        <CalendarIcon className="w-4 h-4" />
                                        <span>Deadline: {new Date(a.due_date).toLocaleDateString()}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground bg-background px-4 py-2 rounded-xl border-2 border-border/60 shadow-sm">{a.status}</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed mt-6 font-bold opacity-80 relative z-10 line-clamp-3">{a.description}</p>
                            <div className="mt-8 pt-6 border-t border-border/60 flex justify-between items-center relative z-10">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
                                    <span>Max Score Trace:</span>
                                    <span className="text-foreground">100.00</span>
                                </div>
                                <button className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline group-hover:translate-x-1 transition-transform">View Manifest</button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};

const MaterialsView: React.FC<{ details: TeacherClassDetails, onAdd: () => void }> = ({ details, onAdd }) => {
    const materials = details?.studyMaterials ?? [];
    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h4 className="text-xl font-black text-foreground tracking-tight uppercase italic underline decoration-primary decoration-4 underline-offset-8">Knowledge Repository</h4>
                <button onClick={onAdd} className="bg-foreground text-background text-[10px] font-black uppercase tracking-widest px-8 py-4 rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3"><PlusIcon className="w-5 h-5" /> Upload Intelligence</button>
            </div>
            {materials.length === 0 ? (
                <div className="p-20 text-center bg-muted/20 rounded-[3rem] border-2 border-dashed border-border mt-4">
                    <BookOpenIcon className="w-16 h-16 mx-auto text-muted-foreground/10 mb-6" />
                    <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Zero Intelligence Found</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {materials.map((m, idx) => (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            key={m.id}
                            className="p-8 rounded-[2.5rem] border-2 border-border bg-muted/10 hover:bg-card hover:border-primary/40 transition-all group flex flex-col justify-between h-full shadow-lg"
                        >
                            <div className="flex items-start gap-6">
                                <div className="p-4 bg-primary text-white rounded-2xl group-hover:rotate-12 transition-transform shadow-2xl shadow-primary/30">
                                    <BookOpenIcon className="w-6 h-6" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-black text-lg text-foreground tracking-tighter truncate group-hover:text-primary transition-colors uppercase italic italic">{m.title}</p>
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-1.5 opacity-60 truncate">{m.file_name}</p>
                                </div>
                            </div>
                            <div className="mt-8 pt-6 border-t border-border/60 flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                <span className="text-muted-foreground/40">Timestamp: {new Date(m.created_at).toLocaleDateString()}</span>
                                <button className="text-primary hover:underline">Download Material</button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};

const AddAssignmentModal: React.FC<{ classId: number, subjects: ClassSubject[], onClose: () => void, onSuccess: () => void, currentUserId: string }> = ({ classId, subjects, onClose, onSuccess, currentUserId }) => {
    const [title, setTitle] = useState('');
    const [subjectId, setSubjectId] = useState<string>(subjects?.[0]?.id?.toString() || '');
    const [dueDate, setDueDate] = useState('');
    const [description, setDescription] = useState('');
    const [maxScore, setMaxScore] = useState(100);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const isoDate = new Date(dueDate).toISOString();

            const { error: rpcError } = await supabase.rpc('create_homework_assignment', {
                p_class_id: classId,
                p_subject_id: parseInt(subjectId),
                p_teacher_id: currentUserId,
                p_title: title,
                p_description: description,
                p_due_date: isoDate,
                p_attachments: [],
                p_max_score: maxScore,
                p_status: 'Active'
            });

            if (rpcError) throw rpcError;

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-3xl flex justify-center items-center z-[200] p-6"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 50 }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="bg-card w-full max-w-2xl rounded-[3.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden relative"
                onClick={e => e.stopPropagation()}
            >
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary to-indigo-600"></div>
                <form onSubmit={handleSubmit}>
                    <header className="px-12 py-10 border-b border-border bg-muted/10 flex justify-between items-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
                        <div className="flex items-center gap-6 relative z-10">
                            <div className="p-4 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20 rotate-12 transition-transform">
                                <PlusIcon className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="font-black text-2xl text-foreground tracking-tighter uppercase italic italic">Deploy Task</h3>
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] mt-1 opacity-60">New Assignment</p>
                            </div>
                        </div>
                        <button type="button" onClick={onClose} className="p-4 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-all transform hover:rotate-90 border border-white/5 relative z-10"><XIcon className="w-7 h-7" /></button>
                    </header>
                    <main className="px-12 py-10 space-y-10 relative">
                        {error && <p className="text-rose-600 bg-rose-500/10 p-5 rounded-2xl text-xs font-black uppercase tracking-widest border border-rose-500/20 italic">{error}</p>}

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground block ml-1">Objective Title</label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full bg-muted/30 border-2 border-border rounded-2xl px-6 py-5 text-sm font-black focus:border-primary focus:ring-8 focus:ring-primary/5 outline-none transition-all placeholder:text-muted-foreground/30 shadow-inner" placeholder="Enter Task Designation..." />
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground block ml-1">Module Subject</label>
                                <select value={subjectId} onChange={e => setSubjectId(e.target.value)} required className="w-full bg-muted/30 border-2 border-border rounded-2xl px-6 py-5 text-sm font-black focus:border-primary focus:ring-8 focus:ring-primary/5 outline-none transition-all cursor-pointer shadow-inner">{(subjects ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                            </div>
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground block ml-1">Temporal Deadline</label>
                                <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} required className="w-full bg-muted/30 border-2 border-border rounded-2xl px-6 py-5 text-sm font-black focus:border-primary focus:ring-8 focus:ring-primary/5 outline-none transition-all shadow-inner" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-8">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground block ml-1">Max Score Scale</label>
                                <input type="number" value={maxScore} onChange={e => setMaxScore(parseInt(e.target.value))} required className="w-full bg-muted/30 border-2 border-border rounded-2xl px-6 py-5 text-sm font-black focus:border-primary focus:ring-8 focus:ring-primary/5 outline-none transition-all shadow-inner" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground block ml-1">Task Manifest</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full bg-muted/30 border-2 border-border rounded-2xl px-6 py-5 text-sm font-black focus:border-primary focus:ring-8 focus:ring-primary/5 outline-none transition-all placeholder:text-muted-foreground/30 shadow-inner" placeholder="Operational instructions and task parameters..." />
                        </div>
                    </main>
                    <footer className="px-12 py-10 border-t border-border bg-muted/10 flex justify-end gap-6 relative z-10">
                        <button type="button" onClick={onClose} className="px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] text-muted-foreground hover:bg-white/5 transition-all">Abort</button>
                        <button type="submit" disabled={loading} className="px-12 py-5 bg-foreground text-background rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.4em] shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-30">
                            {loading ? <Spinner size="sm" className="text-background" /> : 'Execute Deployment'}
                        </button>
                    </footer>
                </form>
            </motion.div>
        </motion.div>
    );
};

const AddMaterialModal: React.FC<{ classId: number, subjects: ClassSubject[], onClose: () => void, onSuccess: () => void, currentUserId: string }> = ({ classId, subjects, onClose, onSuccess, currentUserId }) => {
    const [title, setTitle] = useState('');
    const [subjectId, setSubjectId] = useState<string>(subjects?.[0]?.id?.toString() || '');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) { setError('Error: No source file selected.'); return; }
        setLoading(true);
        setError('');

        try {
            if (!currentUserId) throw new Error("Session invalid. Please login again.");

            const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
            const filePath = `${currentUserId}/${classId}-${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage.from('study-materials').upload(filePath, file);
            if (uploadError) throw uploadError;

            const { error: rpcError } = await supabase.rpc('teacher_create_study_material', {
                p_class_id: classId,
                p_subject_id: parseInt(subjectId),
                p_title: title,
                p_description: description,
                p_file_name: file.name,
                p_file_path: filePath,
                p_file_type: fileExt,
                p_uploaded_by: currentUserId
            });
            if (rpcError) throw rpcError;

            onSuccess();
            onClose();

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-3xl flex justify-center items-center z-[200] p-6"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 50 }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="bg-card w-full max-w-2xl rounded-[3.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden relative"
                onClick={e => e.stopPropagation()}
            >
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-teal-600"></div>
                <form onSubmit={handleSubmit}>
                    <header className="px-12 py-10 border-b border-border bg-muted/10 flex justify-between items-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
                        <div className="flex items-center gap-6 relative z-10">
                            <div className="p-4 bg-emerald-500 text-white rounded-2xl shadow-xl shadow-emerald-500/20 rotate-12 transition-transform">
                                <BookOpenIcon className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="font-black text-2xl text-foreground tracking-tighter uppercase italic italic">Sync Intelligence</h3>
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] mt-1 opacity-60">Upload Resource</p>
                            </div>
                        </div>
                        <button type="button" onClick={onClose} className="p-4 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-all transform hover:rotate-90 border border-white/5 relative z-10"><XIcon className="w-7 h-7" /></button>
                    </header>
                    <main className="px-12 py-10 space-y-10 relative">
                        {error && <p className="text-rose-600 bg-rose-500/10 p-5 rounded-2xl text-xs font-black uppercase tracking-widest border border-rose-500/20 italic">{error}</p>}

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground block ml-1">Title</label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="w-full bg-muted/30 border-2 border-border rounded-2xl px-6 py-5 text-sm font-black focus:border-emerald-500 focus:ring-8 focus:ring-emerald-500/5 outline-none transition-all placeholder:text-muted-foreground/30 shadow-inner" placeholder="Enter Material Title..." />
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground block ml-1">Module Subject</label>
                            <select value={subjectId} onChange={e => setSubjectId(e.target.value)} required className="w-full bg-muted/30 border-2 border-border rounded-2xl px-6 py-5 text-sm font-black focus:border-emerald-500 focus:ring-8 focus:ring-emerald-500/5 outline-none transition-all cursor-pointer shadow-inner">{(subjects ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground block ml-1">Intel Summary</label>
                            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full bg-muted/30 border-2 border-border rounded-2xl px-6 py-5 text-sm font-black focus:border-emerald-500 focus:ring-8 focus:ring-emerald-500/5 outline-none transition-all placeholder:text-muted-foreground/30 shadow-inner" placeholder="Summary of the resource..." />
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground block ml-1">Attachment</label>
                            <div className="relative group">
                                <input type="file" onChange={e => setFile(e.target.files ? e.target.files[0] : null)} required className="absolute inset-0 opacity-0 cursor-pointer z-20" />
                                <div className="w-full bg-muted/30 border-4 border-dashed border-border rounded-[2rem] px-8 py-12 text-center group-hover:bg-emerald-500/[0.02] group-hover:border-emerald-500/40 transition-all shadow-inner">
                                    <UploadIcon className="w-10 h-10 mx-auto text-muted-foreground/30 mb-4 group-hover:scale-110 group-hover:text-emerald-500 transition-all" />
                                    <p className="font-black text-sm text-foreground uppercase tracking-tight">{file ? file.name : 'Upload CSV/PDF Resources'}</p>
                                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mt-2">{file ? `${(file.size / 1024).toFixed(1)} KB • Verified` : 'Click to select or drop a file'}</p>
                                </div>
                            </div>
                        </div>
                    </main>
                    <footer className="px-12 py-10 border-t border-border bg-muted/10 flex justify-end gap-6 relative z-10">
                        <button type="button" onClick={onClose} className="px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] text-muted-foreground hover:bg-white/5 transition-all">Abort</button>
                        <button type="submit" disabled={loading} className="px-12 py-5 bg-emerald-600 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.4em] shadow-[0_20px_40px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95 transition-all disabled:opacity-30">
                            {loading ? <Spinner size="sm" className="text-white" /> : 'Initiate Sync'}
                        </button>
                    </footer>
                </form>
            </motion.div>
        </motion.div>
    );
};


MyClassesTab.Icon = UsersIcon;
export default MyClassesTab;
