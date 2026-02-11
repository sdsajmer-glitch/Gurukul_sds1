import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, formatError } from '../../services/supabase';
import { UserProfile, Course } from '../../types';
import Spinner from '../common/Spinner';
import { XIcon } from '../icons/XIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { ChevronLeftIcon } from '../icons/ChevronLeftIcon';
import { SchoolIcon } from '../icons/SchoolIcon';
import { TeacherIcon } from '../icons/TeacherIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { BookIcon } from '../icons/BookIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { GraduationCapIcon } from '../icons/GraduationCapIcon';
import { LayersIcon } from '../icons/LayersIcon';
import { ChartBarIcon } from '../icons/ChartBarIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import Stepper from '../common/Stepper';
import CustomSelect from '../common/CustomSelect';

interface CreateClassWizardProps {
    onClose: () => void;
    onSuccess: () => void;
    branchId?: number | null;
}

const STEPS = ['Strategy', 'Leadership', 'Volume', 'Curriculum', 'Review'];

const CreateClassWizard: React.FC<CreateClassWizardProps> = ({ onClose, onSuccess, branchId }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        grade: '',
        section: '',
        teacher_id: '',
        academic_year: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
        capacity: 30,
        subjects: [] as string[] // Selected course IDs
    });

    const [teachers, setTeachers] = useState<UserProfile[]>([]);
    const [availableCourses, setAvailableCourses] = useState<Course[]>([]);

    useEffect(() => {
        const fetchResources = async () => {
            const [teacherRes, courseRes] = await Promise.all([
                supabase.rpc('get_all_teachers_for_admin'),
                supabase.from('courses').select('*').eq('status', 'Active')
            ]);

            if (teacherRes.data) setTeachers(teacherRes.data);
            if (courseRes.data) setAvailableCourses(courseRes.data);
        };
        fetchResources();
    }, []);

    const handleNext = () => setCurrentStep(p => Math.min(p + 1, STEPS.length - 1));
    const handleBack = () => setCurrentStep(p => Math.max(p - 1, 0));

    const handleSubmit = async () => {
        if (!branchId) {
            alert("Error: No branch context selected. Please refresh and try again.");
            return;
        }

        setLoading(true);
        try {
            const name = `Grade ${formData.grade} - ${formData.section}`;

            const { error: classError } = await supabase.rpc('manage_class', {
                p_id: null,
                p_name: name,
                p_grade_level: formData.grade,
                p_section: formData.section,
                p_academic_year: formData.academic_year,
                p_class_teacher_id: formData.teacher_id || null,
                p_branch_id: branchId,
                p_capacity: formData.capacity
            });

            if (classError) throw classError;

            const { data: newClass, error: fetchError } = await supabase
                .from('school_classes')
                .select('id')
                .eq('name', name)
                .eq('academic_year', formData.academic_year)
                .eq('branch_id', branchId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (fetchError || !newClass) throw new Error("Class created but ID retrieval failed.");

            if (formData.subjects.length > 0) {
                const { error: mapError } = await supabase.rpc('map_class_subjects', {
                    p_class_id: newClass.id,
                    p_subject_ids: formData.subjects.map(s => parseInt(s))
                });
                if (mapError) throw mapError;
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            alert(`Failed to create class: ${formatError(err)}`);
        } finally {
            setLoading(false);
        }
    };

    const gradeCourses = useMemo(() =>
        availableCourses.filter(c => c.grade_level === formData.grade),
        [availableCourses, formData.grade]);

    const toggleSubject = (courseId: string) => {
        setFormData(prev => {
            const newSubjects = prev.subjects.includes(courseId)
                ? prev.subjects.filter(id => id !== courseId)
                : [...prev.subjects, courseId];
            return { ...prev, subjects: newSubjects };
        });
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 0: // Basic
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                        <div>
                            <h3 className="text-2xl font-black text-foreground tracking-tight uppercase italic">Structural Parameters</h3>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-60">Define the core academic coordinates.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-8">
                            <CustomSelect
                                label="Academic Temporal Cycle"
                                options={[
                                    { label: '2024-2025 Cycle', value: '2024-2025' },
                                    { label: '2025-2026 Cycle', value: '2025-2026' },
                                    { label: '2026-2027 Cycle', value: '2026-2027' }
                                ]}
                                value={formData.academic_year}
                                onChange={v => setFormData({ ...formData, academic_year: v })}
                                icon={<CalendarIcon className="w-5 h-5" />}
                                required
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <CustomSelect
                                    label="Grade Hierarchy"
                                    options={Array.from({ length: 12 }, (_, i) => ({ label: `Grade ${i + 1} Level`, value: String(i + 1) }))}
                                    value={formData.grade}
                                    onChange={v => setFormData({ ...formData, grade: v })}
                                    placeholder="Select Tier"
                                    icon={<GraduationCapIcon className="w-5 h-5" />}
                                    required
                                />

                                <div className="relative group">
                                    <div className="absolute top-1/2 -translate-y-1/2 left-5 text-muted-foreground/40 pointer-events-none group-focus-within:text-primary transition-colors"><LayersIcon className="w-5 h-5" /></div>
                                    <input
                                        placeholder=" "
                                        value={formData.section}
                                        onChange={e => setFormData({ ...formData, section: e.target.value })}
                                        className="peer block w-full rounded-[1.5rem] border border-border bg-background px-6 py-5 pl-14 text-sm font-bold shadow-inner focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all"
                                    />
                                    <label className="absolute left-14 top-0 -translate-y-1/2 bg-background px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:normal-case peer-focus:top-0 peer-focus:text-[10px] peer-focus:font-black peer-focus:text-primary pointer-events-none">
                                        Section Designation (e.g. A, B, Delta)
                                    </label>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                );
            case 1: // Faculty
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                        <div>
                            <h3 className="text-2xl font-black text-foreground tracking-tight uppercase italic">Leadership Assignment</h3>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-60">Designate the primary faculty commander.</p>
                        </div>
                        <div className="bg-card border-2 border-dashed border-border p-10 rounded-[2.5rem] space-y-6">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Commanding Officer</label>
                            <div className="relative group">
                                <select
                                    value={formData.teacher_id}
                                    onChange={e => setFormData({ ...formData, teacher_id: e.target.value })}
                                    className="w-full p-5 pl-16 rounded-2xl border border-border bg-background text-sm font-black focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none appearance-none cursor-pointer shadow-xl transition-all"
                                >
                                    <option value="">Pending Assignment</option>
                                    {teachers.map(t => (
                                        <option key={t.id} value={t.id}>{t.display_name}</option>
                                    ))}
                                </select>
                                <TeacherIcon className="w-6 h-6 text-muted-foreground/40 absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-primary transition-colors" />
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none"><ChevronRightIcon className="w-5 h-5 text-muted-foreground/30 rotate-90" /></div>
                            </div>
                            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-start gap-4">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary"><UsersIcon className="w-4 h-4" /></div>
                                <p className="text-[10px] font-bold text-muted-foreground leading-relaxed">Assigned personnel will maintain total oversight of attendance, disciplinary protocols, and academic synchronization for this unit.</p>
                            </div>
                        </div>
                    </motion.div>
                );
            case 2: // Capacity
                return (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                        <div>
                            <h3 className="text-2xl font-black text-foreground tracking-tight uppercase italic">Volume Threshold</h3>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-60">Calibrate maximum unit occupancy limits.</p>
                        </div>
                        <div className="relative group max-w-sm mx-auto">
                            <div className="absolute top-1/2 -translate-y-1/2 left-6 text-muted-foreground/40 pointer-events-none group-focus-within:text-primary transition-colors"><ChartBarIcon className="w-6 h-6" /></div>
                            <input
                                type="number"
                                value={formData.capacity}
                                onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                                className="peer block w-full rounded-[2rem] border-2 border-border bg-background px-10 py-8 pl-16 text-4xl font-black shadow-2xl focus:border-primary focus:ring-8 focus:ring-primary/5 focus:outline-none transition-all text-center"
                                placeholder=" "
                            />
                            <label className="absolute left-1/2 -translate-x-1/2 top-0 -translate-y-1/2 bg-background px-3 text-[10px] font-black uppercase tracking-[0.3em] text-primary transition-all pointer-events-none">
                                Max Capacity
                            </label>
                        </div>
                        <div className="p-8 bg-amber-500/5 border border-amber-500/10 rounded-[2rem] text-amber-600/90 text-xs font-bold flex items-start gap-5 max-w-lg mx-auto leading-relaxed italic">
                            <AlertTriangleIcon className="w-6 h-6 flex-shrink-0 mt-1 animate-pulse" />
                            <p>Threshold violations will trigger institution-wide alerts but will not block student synchronization protocols. Systematic rebalancing is recommended post-threshold reached.</p>
                        </div>
                    </motion.div>
                );
            case 3: // Subjects
                return (
                    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 h-full flex flex-col">
                        <div className="flex justify-between items-end">
                            <div>
                                <h3 className="text-2xl font-black text-foreground tracking-tight uppercase italic">Curriculum Mapping</h3>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-60">Synchronize academic modules to this unit.</p>
                            </div>
                            <span className="text-[10px] bg-primary text-white px-5 py-2 rounded-xl font-black uppercase tracking-widest shadow-xl shadow-primary/20">{formData.subjects.length} Modules Linked</span>
                        </div>

                        <div className="flex-grow">
                            {gradeCourses.length === 0 ? (
                                <div className="p-20 text-center bg-muted/20 rounded-[3rem] border-2 border-dashed border-border mt-4">
                                    <BookIcon className="w-16 h-16 mx-auto text-muted-foreground/10 mb-6" />
                                    <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Zero Compatible Modules Detected</p>
                                    <p className="text-xs text-muted-foreground mt-4 font-bold">Initialize courses in the Core Repository first.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto max-h-[350px] pr-4 custom-scrollbar mt-4 p-2">
                                    {gradeCourses.map(course => (
                                        <motion.div
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            key={course.id}
                                            onClick={() => toggleSubject(course.id.toString())}
                                            className={`p-6 rounded-3xl border-2 cursor-pointer transition-all flex items-center gap-5 group relative overflow-hidden ${formData.subjects.includes(course.id.toString()) ? 'bg-primary/5 border-primary shadow-2xl' : 'bg-card border-border/60 hover:border-primary/40 shadow-sm'}`}
                                        >
                                            <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${formData.subjects.includes(course.id.toString()) ? 'bg-primary border-primary rotate-0 scale-110 shadow-lg' : 'bg-background border-border group-hover:border-primary/40 rotate-12'}`}>
                                                {formData.subjects.includes(course.id.toString()) && <CheckCircleIcon className="w-5 h-5 text-white" />}
                                            </div>
                                            <div className="flex-grow relative z-10">
                                                <p className={`text-sm font-black tracking-tight ${formData.subjects.includes(course.id.toString()) ? 'text-primary' : 'text-foreground'}`}>{course.title}</p>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1 opacity-60">{course.code} • {course.category}</p>
                                            </div>
                                            {formData.subjects.includes(course.id.toString()) && (
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-12 -mt-12"></div>
                                            )}
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                );
            case 4: // Review
                return (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                        <div className="text-center">
                            <h3 className="text-3xl font-black text-foreground tracking-tighter uppercase italic">Final Validation</h3>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-60">Verify structural integrity before deployment.</p>
                        </div>

                        <div className="bg-card border-2 border-border/80 rounded-[3rem] p-10 space-y-10 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-indigo-500 to-purple-600"></div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Designation</p>
                                    <p className="font-black text-2xl text-foreground tracking-tight underline decoration-primary decoration-4 underline-offset-8">Grade {formData.grade} - {formData.section}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Academic Cycle</p>
                                    <div className="flex items-center gap-3">
                                        <CalendarIcon className="w-5 h-5 text-primary" />
                                        <p className="text-xl font-black text-foreground tracking-tight">{formData.academic_year}</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Primary Lead</p>
                                    <div className="flex items-center gap-4 bg-muted/30 p-3 rounded-2xl border border-border/40">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black">{teachers.find(t => t.id === formData.teacher_id)?.display_name?.charAt(0) || '?'}</div>
                                        <p className="font-black text-sm text-foreground tracking-tight">{teachers.find(t => t.id === formData.teacher_id)?.display_name || <span className="text-amber-600">UNASSIGNED</span>}</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Capacity</p>
                                    <p className="text-2xl font-black text-foreground tracking-tight">{formData.capacity} <span className="text-xs opacity-40">Units</span></p>
                                </div>
                            </div>

                            <div className="pt-10 border-t border-border/60">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-6">Linked Modules ({formData.subjects.length})</p>
                                <div className="flex flex-wrap gap-2">
                                    {gradeCourses.filter(c => formData.subjects.includes(c.id.toString())).map(c => (
                                        <span key={c.id} className="text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 px-4 py-2 rounded-xl shadow-inner">{c.title}</span>
                                    ))}
                                    {formData.subjects.length === 0 && <span className="text-xs italic text-muted-foreground opacity-40 font-bold">Protocol Null: No Modules Linked</span>}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                );
            default: return null;
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/90 backdrop-blur-3xl z-[150] flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 50 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 50 }}
                    transition={{ type: "spring", damping: 30, stiffness: 300 }}
                    className="bg-card w-full max-w-4xl rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden flex flex-col max-h-[92vh] ring-1 ring-black/5"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="px-10 py-10 border-b border-white/[0.05] bg-muted/10 flex justify-between items-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] -mr-32 -mt-32 transition-all group-hover:scale-125"></div>
                        <div className="flex items-center gap-6 relative z-10">
                            <div className="p-5 bg-primary text-white rounded-[1.5rem] shadow-2xl shadow-primary/40 rotate-12 hover:rotate-0 transition-transform duration-500">
                                <SchoolIcon className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-foreground tracking-tighter uppercase italic italic">Initiate Section</h3>
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] mt-1 opacity-60">Operational Configuration Wizard</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-4 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-all transform hover:rotate-90 z-10"><XIcon className="w-7 h-7" /></button>
                    </div>

                    <div className="px-16 pt-10 pb-4">
                        <Stepper steps={STEPS} currentStep={currentStep} />
                    </div>

                    <div className="px-16 py-10 flex-grow overflow-y-auto custom-scrollbar bg-background/50 relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.01] to-transparent pointer-events-none"></div>
                        <AnimatePresence mode="wait">
                            <div key={currentStep}>
                                {renderStepContent()}
                            </div>
                        </AnimatePresence>
                    </div>

                    <div className="px-12 py-10 border-t border-white/[0.05] bg-muted/10 flex justify-between items-center relative z-10">
                        <button
                            onClick={currentStep === 0 ? onClose : handleBack}
                            className="px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all flex items-center gap-3 active:scale-95"
                        >
                            <ChevronLeftIcon className="w-4 h-4" /> {currentStep === 0 ? 'Abort' : 'Previous'}
                        </button>

                        <button
                            onClick={currentStep === STEPS.length - 1 ? handleSubmit : handleNext}
                            disabled={loading || (currentStep === 0 && (!formData.grade || !formData.section))}
                            className="px-12 py-6 bg-foreground text-background rounded-3xl font-black text-[10px] uppercase tracking-[0.4em] shadow-2xl hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-4 transition-all"
                        >
                            {loading ? <Spinner size="sm" className="text-background" /> : (
                                currentStep === STEPS.length - 1 ? 'Execute Synchronize' : <>Continue Protocol <ChevronRightIcon className="w-5 h-5" /></>
                            )}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default CreateClassWizard;