import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../services/supabase';
import { SchoolClass, StudentRosterItem, AttendanceRecord, AttendanceStatus, FunctionComponentWithIcon } from '../../types';
import Spinner from '../common/Spinner';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { XCircleIcon } from '../icons/XCircleIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { ChecklistIcon } from '../icons/ChecklistIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { SearchIcon } from '../icons/SearchIcon';
import { FilterIcon } from '../icons/FilterIcon';

type CombinedAttendanceRecord = StudentRosterItem & {
    status: AttendanceStatus | null;
    notes: string | null;
};

const AttendanceTab: FunctionComponentWithIcon<{}> = () => {
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [roster, setRoster] = useState<StudentRosterItem[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [updatedAttendance, setUpdatedAttendance] = useState<Record<string, Partial<{ status: AttendanceStatus; notes: string }>>>({});

    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    const [loading, setLoading] = useState({ classes: true, roster: false });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchClasses = useCallback(async () => {
        setLoading(prev => ({ ...prev, classes: true }));
        const { data, error } = await supabase.rpc('get_teacher_classes');
        if (error) setError(`Failed to fetch classes: ${error.message}`);
        else {
            setClasses(data || []);
            if (data && data.length > 0 && !selectedClassId) {
                setSelectedClassId(data[0].id.toString());
            }
        }
        setLoading(prev => ({ ...prev, classes: false }));
    }, [selectedClassId]);

    useEffect(() => {
        fetchClasses();
    }, [fetchClasses]);

    useEffect(() => {
        const fetchRosterAndAttendance = async () => {
            if (!selectedClassId) return;

            setLoading(prev => ({ ...prev, roster: true }));
            setError(null);
            setRoster([]);
            setAttendance([]);
            setUpdatedAttendance({});

            const [rosterRes, attendanceRes] = await Promise.all([
                supabase.rpc('get_class_roster', { p_class_id: parseInt(selectedClassId) }),
                supabase.rpc('get_attendance', { p_class_id: parseInt(selectedClassId), p_attendance_date: selectedDate })
            ]);

            if (rosterRes.error) setError(`Failed to fetch roster: ${rosterRes.error.message}`);
            else setRoster(rosterRes.data || []);

            if (attendanceRes.error) setError(`Failed to fetch attendance: ${attendanceRes.error.message}`);
            else setAttendance(attendanceRes.data || []);

            setLoading(prev => ({ ...prev, roster: false }));
        };

        fetchRosterAndAttendance();
    }, [selectedClassId, selectedDate]);

    const combinedData = useMemo<CombinedAttendanceRecord[]>(() => {
        return roster.map(student => {
            const originalRecord = attendance.find(a => a.student_id === student.id);
            const changedRecord = updatedAttendance[student.id] || {};

            const currentStatus = (changedRecord.status ?? originalRecord?.status ?? 'Present') as AttendanceStatus;
            const currentNotes = (changedRecord.notes !== undefined) ? changedRecord.notes : originalRecord?.notes ?? null;

            return {
                ...student,
                status: currentStatus,
                notes: currentNotes,
            };
        });
    }, [roster, attendance, updatedAttendance]);

    const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
        setUpdatedAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], status } }));
    };

    const handleNotesChange = (studentId: string, notes: string) => {
        setUpdatedAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], notes } }));
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        const recordsToUpsert = Object.entries(updatedAttendance).map(([student_id, rawChanges]) => {
            const changes = rawChanges as Partial<{ status: AttendanceStatus; notes: string }>;
            const originalRecord = attendance.find(a => a.student_id === student_id);
            const originalStatus = originalRecord?.status ?? 'Present';
            const originalNotes = originalRecord?.notes ?? '';

            return {
                class_id: parseInt(selectedClassId),
                student_id,
                attendance_date: selectedDate,
                status: changes.status ?? originalStatus,
                notes: 'notes' in changes ? changes.notes : originalNotes,
            };
        });

        if (recordsToUpsert.length === 0) {
            setIsSaving(false);
            return;
        }

        const { error } = await supabase.rpc('upsert_attendance', { records: recordsToUpsert });
        if (error) {
            alert(`Failed to save changes: ${error.message}`);
        } else {
            setUpdatedAttendance({});
            const { data } = await supabase.rpc('get_attendance', { p_class_id: parseInt(selectedClassId), p_attendance_date: selectedDate });
            if (data) setAttendance(data);
        }
        setIsSaving(false);
    };

    const hasChanges = Object.keys(updatedAttendance).length > 0;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-10"
        >
            <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-8 border-b border-border pb-10">
                <div>
                    <h2 className="text-4xl font-black text-foreground tracking-tighter uppercase italic italic">Attendance Records</h2>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] mt-2 opacity-60">Daily Attendance Records</p>
                </div>
                <div className="flex flex-wrap items-center gap-6">
                    <div className="bg-muted/30 p-2 rounded-[1.5rem] border border-border flex flex-wrap items-center gap-4">
                        <div className="relative min-w-[200px]">
                            <label className="absolute -top-3 left-4 bg-background px-2 text-[9px] font-black text-muted-foreground uppercase tracking-widest">Active Unit</label>
                            {loading.classes ? <div className="px-5 py-3"><Spinner size="sm" /></div> :
                                <select
                                    value={selectedClassId}
                                    onChange={e => setSelectedClassId(e.target.value)}
                                    className="w-full bg-background border-2 border-border/60 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider focus:border-primary outline-none transition-all shadow-inner"
                                >
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            }
                        </div>
                        <div className="relative">
                            <label className="absolute -top-3 left-4 bg-background px-2 text-[9px] font-black text-muted-foreground uppercase tracking-widest">Target Date</label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                className="bg-background border-2 border-border/60 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider focus:border-primary outline-none transition-all shadow-inner"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleSaveChanges}
                        disabled={!hasChanges || isSaving}
                        className="bg-foreground text-background font-black text-[10px] uppercase tracking-[0.3em] py-5 px-10 rounded-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shadow-2xl relative overflow-hidden group"
                    >
                        <span className="relative z-10">{isSaving ? <Spinner size="sm" className="text-background" /> : 'Save records'}</span>
                        <div className="absolute inset-0 bg-primary/20 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                    </button>
                </div>
            </div>

            {loading.roster ? (
                <div className="flex flex-col items-center justify-center py-32 gap-6">
                    <Spinner size="lg" className="text-primary" />
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Synchronizing Personnel Data...</p>
                </div>
            ) : error ? (
                <div className="p-16 text-center bg-rose-500/5 border-2 border-dashed border-rose-500/20 rounded-[3.5rem]">
                    <p className="text-rose-600 font-black text-sm uppercase tracking-widest italic">{error}</p>
                </div>
            ) : roster.length === 0 && selectedClassId ? (
                <div className="p-32 text-center bg-muted/20 border-4 border-dashed border-border rounded-[4.5rem]">
                    <XCircleIcon className="w-20 h-20 mx-auto text-muted-foreground/10 mb-8" />
                    <p className="text-muted-foreground font-black text-[10px] uppercase tracking-[0.5em]">Zero Roster Nodes Traceable</p>
                    <p className="text-xs text-muted-foreground mt-4 font-bold">Initialize unit roster via administrative tools.</p>
                </div>
            ) : (
                <div className="bg-card rounded-[3.5rem] border-2 border-border shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-indigo-600"></div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-border">
                            <thead className="bg-muted/30">
                                <tr>
                                    <th className="px-10 py-8 text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] w-4/12">Personnel Candidate</th>
                                    <th className="px-10 py-8 text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] w-3/12 text-center">Presence Status</th>
                                    <th className="px-10 py-8 text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] w-5/12">Operational Logs / Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border bg-card">
                                <AnimatePresence>
                                    {combinedData.map((student, idx) => (
                                        <motion.tr
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.02 }}
                                            key={student.id}
                                            className="hover:bg-primary/[0.02] transition-all group"
                                        >
                                            <td className="px-10 py-6 whitespace-nowrap">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center border border-border group-hover:border-primary/30 transition-colors">
                                                        <img className="w-8 h-8 opacity-60 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0" src={`https://api.dicebear.com/8.x/initials/svg?seed=${student.display_name}&backgroundColor=transparent`} alt="" />
                                                    </div>
                                                    <div>
                                                        <p className="text-lg font-black text-foreground tracking-tighter uppercase italic group-hover:text-primary transition-colors">{student.display_name}</p>
                                                        <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest mt-1">ID: {student.roll_number || 'TRAC-000'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-10 py-6 whitespace-nowrap">
                                                <div className="flex justify-center gap-3">
                                                    {[
                                                        { label: 'Present', color: 'bg-emerald-500', icon: <CheckCircleIcon className="w-4 h-4" /> },
                                                        { label: 'Absent', color: 'bg-rose-500', icon: <XCircleIcon className="w-4 h-4" /> },
                                                        { label: 'Late', color: 'bg-amber-500', icon: <ClockIcon className="w-4 h-4" /> },
                                                    ].map(status => (
                                                        <button
                                                            key={status.label}
                                                            onClick={() => handleStatusChange(student.id, status.label as AttendanceStatus)}
                                                            className={`
                                                                flex flex-col items-center gap-1.5 px-5 py-3 rounded-2xl border-2 transition-all hover:scale-105 active:scale-95
                                                                ${student.status === status.label
                                                                    ? `${status.color} border-transparent text-white shadow-lg shadow-${status.color.split('-')[1]}-500/30 scale-105`
                                                                    : 'bg-background border-border text-muted-foreground/60 hover:border-primary/30 hover:text-foreground'
                                                                }
                                                            `}
                                                        >
                                                            {status.icon}
                                                            <span className="text-[8px] font-black uppercase tracking-widest">{status.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-10 py-6 whitespace-nowrap">
                                                <div className="relative group/input max-w-md">
                                                    <input
                                                        type="text"
                                                        value={student.notes || ''}
                                                        onChange={(e) => handleNotesChange(student.id, e.target.value)}
                                                        placeholder="Add operational note..."
                                                        className="w-full bg-muted/20 border-2 border-border/60 rounded-xl px-4 py-3 text-xs font-bold focus:border-primary focus:bg-background outline-none transition-all shadow-inner"
                                                    />
                                                    <div className="absolute top-1/2 -right-3 -translate-y-1/2 bg-primary text-white p-1.5 rounded-lg opacity-0 group-focus-within/input:opacity-100 transition-opacity">
                                                        <ChecklistIcon className="w-3.5 h-3.5" />
                                                    </div>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </motion.div>
    );
};

AttendanceTab.Icon = ChecklistIcon;
export default AttendanceTab;