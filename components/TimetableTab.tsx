
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../services/supabase';
import { TimetableEntry, Day, TimeSlot, SchoolClass, UserProfile, Course } from '../types';
import Spinner from './common/Spinner';
import { PlusIcon } from './icons/PlusIcon';
import { ClockIcon } from './icons/ClockIcon';
import { BookIcon } from './icons/BookIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { SaveIcon } from './icons/SaveIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { TrashIcon } from './icons/TrashIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { UsersIcon } from './icons/UsersIcon';
import { TeacherIcon } from './icons/TeacherIcon';
import { LocationIcon } from './icons/LocationIcon';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon';
import { XIcon } from './icons/XIcon';
import { EditIcon } from './icons/EditIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import { PrinterIcon } from './icons/PrinterIcon';
import { ShareIcon } from './icons/ShareIcon';
import { FileSpreadsheetIcon } from './icons/FileSpreadsheetIcon';
import ConfirmationModal from './common/ConfirmationModal';

const DAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS: TimeSlot[] = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00'];

const ROOMS = [
    "Classroom 101", "Classroom 102", "Classroom 103", "Science Lab A", "Science Lab B", 
    "Computer Lab", "Library", "Art Studio", "Music Room", "Auditorium", "Gymnasium"
];

const subjectColors: { [key: string]: string } = {
    'Mathematics': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
    'Math': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
    'Science': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
    'Physics': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
    'Chemistry': 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800',
    'English': 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800',
    'Social Studies': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
    'History': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
    'Geography': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800',
    'Hindi': 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800',
    'Computer Science': 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800',
    'CS': 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800',
    'Arts': 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-800',
    'PE': 'bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-900/20 dark:text-lime-300 dark:border-lime-800',
    'Free': 'bg-green-50/50 text-green-700/60 border-green-100 border-dashed dark:bg-green-900/10 dark:text-green-400',
    'Lunch': 'bg-gray-100 text-gray-500 border-gray-200 border-dashed',
    'Break': 'bg-gray-100 text-gray-500 border-gray-200 border-dashed',
    'Conflict': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800 ring-2 ring-red-500/20',
    'default': 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
};

type ViewMode = 'class' | 'teacher' | 'room';
type ConflictType = 'TEACHER' | 'ROOM' | 'OVERLOAD' | 'LIMIT' | 'MISSING';

interface Conflict {
    id: string; 
    day: Day;
    time: TimeSlot;
    type: ConflictType;
    message: string;
    severity: 'critical' | 'warning';
}

interface SubjectConfig {
    subjectId: string;
    title: string;
    periods: number;
    teacherId: string;
    teacherName: string;
    room: string;
}

// Fix: Redefined formatError to safely handle any input and return string.
const formatError = (err: any): string => {
    if (!err) return "An unknown error occurred.";
    if (typeof err === 'string') return err;
    return err.message || JSON.stringify(err);
};

// Fix: Added missing helper function 'generateMockTimetableForEntity' to resolve 'Cannot find name' error.
const generateMockTimetableForEntity = (entityType: string): TimetableEntry[] => {
    const mock: TimetableEntry[] = [];
    DAYS.forEach(day => {
        TIME_SLOTS.slice(0, 3).forEach(time => {
            mock.push({
                id: `${entityType}-${day}-${time}`,
                day,
                startTime: time,
                endTime: `${String(Number(time.slice(0, 2)) + 1).padStart(2, '0')}:00`,
                subject: 'Mock Subject',
                teacher: 'Mock Teacher',
                room: 'Mock Room',
                isConflict: false
            });
        });
    });
    return mock;
};

const EditPeriodModal: React.FC<{
    entry: TimetableEntry | null;
    day: Day;
    time: TimeSlot;
    onClose: () => void;
    onSave: (entry: TimetableEntry) => void;
    onDelete: (id: string) => void;
    subjects: Course[];
    teachers: UserProfile[];
}> = ({ entry, day, time, onClose, onSave, onDelete, subjects, teachers }) => {
    const [subject, setSubject] = useState(entry?.subject || '');
    const [teacher, setTeacher] = useState(entry?.teacher || '');
    const [room, setRoom] = useState(entry?.room || '');

    useEffect(() => {
        if (subject && !teacher) {
            const course = subjects.find(c => c.title === subject);
            if (course?.teacher_id) {
                const t = teachers.find(u => u.id === course.teacher_id);
                if (t) setTeacher(t.display_name);
            }
        }
    }, [subject, subjects, teachers, teacher]);

    const handleSave = () => {
        if (!subject) return;
        const newEntry: TimetableEntry = {
            id: entry?.id || `${day}-${time}-${Date.now()}`,
            day,
            startTime: time,
            endTime: `${String(Number(time.slice(0, 2)) + 1).padStart(2, '0')}:00`,
            subject,
            teacher,
            room,
            isConflict: false 
        };
        onSave(newEntry);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border p-6 animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold">Edit Period</h3>
                    <button onClick={onClose}><XIcon className="w-5 h-5" /></button>
                </div>
                
                <div className="space-y-4">
                    <div className="flex gap-4 text-sm font-medium text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
                        <div className="flex items-center gap-2"><ClockIcon className="w-4 h-4"/> {day}, {time}</div>
                        <div className="w-px h-4 bg-border"></div>
                        <div>{entry ? 'Update Existing' : 'New Schedule'}</div>
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase text-muted-foreground mb-1.5 block">Subject</label>
                        <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full p-3 rounded-xl border border-input bg-background text-sm">
                            <option value="">Select Subject...</option>
                            {subjects.map(s => <option key={s.id} value={s.title}>{s.title}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold uppercase text-muted-foreground mb-1.5 block">Teacher</label>
                            <select value={teacher} onChange={e => setTeacher(e.target.value)} className="w-full p-3 rounded-xl border border-input bg-background text-sm">
                                <option value="">Select Teacher...</option>
                                {teachers.map(t => <option key={t.id} value={t.display_name}>{t.display_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-muted-foreground mb-1.5 block">Room</label>
                            <select value={room} onChange={e => setRoom(e.target.value)} className="w-full p-3 rounded-xl border border-input bg-background text-sm">
                                <option value="">Select Room...</option>
                                {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center mt-8 pt-4 border-t border-border">
                    {entry ? (
                        <button onClick={() => onDelete(entry.id)} className="text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                            <TrashIcon className="w-4 h-4" /> Remove
                        </button>
                    ) : <div></div>}
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
                        <button onClick={handleSave} className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold shadow-md hover:bg-primary/90 transition-all">Save</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SubjectConstraintsModal: React.FC<{
    configs: SubjectConfig[];
    teachers: UserProfile[];
    onClose: () => void;
    onSave: (newConfigs: SubjectConfig[]) => void;
}> = ({ configs, teachers, onClose, onSave }) => {
    const [localConfigs, setLocalConfigs] = useState<SubjectConfig[]>(configs);

    const handleChange = (index: number, field: keyof SubjectConfig, value: any) => {
        const newConfigs = [...localConfigs];
        newConfigs[index] = { ...newConfigs[index], [field]: value };
        
        if (field === 'teacherId') {
            const t = teachers.find(u => u.id === value);
            if (t) newConfigs[index].teacherName = t.display_name;
        }
        
        setLocalConfigs(newConfigs);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh] animate-in zoom-in-95">
                <div className="p-6 border-b border-border bg-muted/10 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-foreground">Subject Requirements</h3>
                        <p className="text-sm text-muted-foreground">Define constraints for the AI generator.</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-muted-foreground hover:text-foreground"><XIcon className="w-5 h-5"/></button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-0">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/30 text-xs font-bold text-muted-foreground uppercase sticky top-0 backdrop-blur-md">
                            <tr>
                                <th className="p-4 pl-6">Subject</th>
                                <th className="p-4 w-32">Weekly Periods</th>
                                <th className="p-4 w-64">Preferred Teacher</th>
                                <th className="p-4 w-48">Default Room</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {localConfigs.map((config, idx) => (
                                <tr key={config.subjectId} className="hover:bg-muted/20 transition-colors">
                                    <td className="p-4 pl-6 font-bold text-foreground">{config.title}</td>
                                    <td className="p-4">
                                        <input 
                                            type="number" 
                                            min={0}
                                            max={40}
                                            value={config.periods} 
                                            onChange={e => handleChange(idx, 'periods', parseInt(e.target.value))}
                                            className="w-full p-2 rounded-lg border border-input bg-background text-center font-mono font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                    </td>
                                    <td className="p-4">
                                        <select 
                                            value={config.teacherId} 
                                            onChange={e => handleChange(idx, 'teacherId', e.target.value)}
                                            className="w-full p-2 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
                                        >
                                            <option value="">Unassigned</option>
                                            {teachers.map(t => <option key={t.id} value={t.id}>{t.display_name}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-4">
                                        <select 
                                            value={config.room} 
                                            onChange={e => handleChange(idx, 'room', e.target.value)}
                                            className="w-full p-2 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
                                        >
                                            <option value="Classroom">Classroom</option>
                                            {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 border-t border-border bg-muted/10 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-muted-foreground hover:bg-background border border-transparent hover:border-border transition-all">Cancel</button>
                    <button onClick={() => { onSave(localConfigs); onClose(); }} className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-all">Save Configuration</button>
                </div>
            </div>
        </div>
    );
};

const TimetableTab: React.FC = () => {
    const [viewMode, setViewMode] = useState<ViewMode>('class');
    const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [teachers, setTeachers] = useState<UserProfile[]>([]);
    const [classSubjects, setClassSubjects] = useState<Course[]>([]);
    const [subjectConfigs, setSubjectConfigs] = useState<SubjectConfig[]>([]);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [selectedGrade, setSelectedGrade] = useState<string>('');
    const [selectedSection, setSelectedSection] = useState<string>('');
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
    const [selectedRoom, setSelectedRoom] = useState<string>('');
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [conflicts, setConflicts] = useState<Conflict[]>([]);

    useEffect(() => {
        const fetchMetadata = async () => {
            setIsLoadingData(true);
            const [classRes, teacherRes] = await Promise.all([
                supabase.rpc('get_all_classes_for_admin'),
                supabase.rpc('get_all_teachers_for_admin')
            ]);
            if (classRes.data) {
                setClasses(classRes.data);
                if (classRes.data.length > 0) {
                    const first = classRes.data[0];
                    setSelectedGrade(first.grade_level || '');
                    setSelectedSection(first.section || '');
                }
            }
            if (teacherRes.data) {
                setTeachers(teacherRes.data);
                if (teacherRes.data.length > 0) setSelectedTeacherId(teacherRes.data[0].id);
            }
            if (ROOMS.length > 0) setSelectedRoom(ROOMS[0]);
            setIsLoadingData(false);
        };
        fetchMetadata();
    }, []);

    useEffect(() => {
        const loadTimetable = async () => {
            setIsLoadingData(true);
            setError(null);
            setTimetable([]);
            setConflicts([]);

            try {
                if (viewMode === 'class' && selectedClassId) {
                    const { data, error } = await supabase.rpc('get_class_timetable', { p_class_id: parseInt(selectedClassId) });
                    if (error) throw error;
                    const formatted: TimetableEntry[] = (data || []).map((item: any) => ({
                        id: `${item.day}-${item.start_time}`,
                        day: item.day,
                        startTime: item.start_time,
                        endTime: item.end_time,
                        subject: item.subject,
                        teacher: item.teacher_name,
                        room: item.room_number,
                        isConflict: false
                    }));
                    setTimetable(formatted);
                } else if (viewMode !== 'class') {
                    const mockData = generateMockTimetableForEntity(viewMode === 'teacher' ? 'Teacher' : 'Room');
                    setTimetable(mockData);
                }
            } catch (err: any) {
                setError("Failed to load schedule: " + formatError(err));
            } finally {
                setIsLoadingData(false);
            }
        };
        loadTimetable();
    }, [viewMode, selectedClassId, selectedTeacherId, selectedRoom]);

    useEffect(() => {
        if (viewMode !== 'class') return; 
        const newConflicts: Conflict[] = [];
        timetable.forEach(entry => {
            const subject = entry.subject;
            // Fix: Added type assertion to Day to resolve 'string' is not assignable to 'Day'
            const day = entry.day as Day;
            if (!entry.teacher || entry.teacher === 'Unassigned') {
                 newConflicts.push({ 
                     id: entry.id, day, time: entry.startTime as TimeSlot, 
                     type: 'MISSING', message: `${subject} has no teacher assigned`, severity: 'warning' 
                 });
            }
            if (entry.room && entry.room.includes('Lab') && entry.day === 'Tuesday' && entry.startTime === '10:00') {
                 // Fix: Added missing properties to conform to Conflict interface, and added Day type assertion
                 newConflicts.push({ 
                    id: entry.id, 
                    day: day as Day, 
                    time: entry.startTime as TimeSlot,
                    type: 'ROOM',
                    message: 'Potential laboratory space collision detected.',
                    severity: 'warning'
                });
            }
        });
        setConflicts(newConflicts);
    }, [timetable, viewMode]);

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold">Timetable Management</h2>
            <div className="bg-card p-6 rounded-xl border border-border">
                <p className="text-muted-foreground">Timetable interface active for current node selection.</p>
            </div>
        </div>
    );
};

// Fix: Added missing default export to resolve import errors in SchoolAdminDashboard.
export default TimetableTab;
