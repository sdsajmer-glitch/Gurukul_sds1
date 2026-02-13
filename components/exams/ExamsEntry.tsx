
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../services/supabase';
import { UserProfile } from '../../types';
import Spinner from '../common/Spinner';

// Icons
import { ChevronLeftIcon } from '../icons/ChevronLeftIcon';
import { SaveIcon } from '../icons/SaveIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';

interface ExamsEntryProps {
    exams: any[];
    selectedExam: any;
    branchId: number | null;
    profile: UserProfile;
    onBack: () => void;
}

const ExamsEntry: React.FC<ExamsEntryProps> = ({ exams, selectedExam, branchId, profile, onBack }) => {
    const [marks, setMarks] = useState<any[]>([]);
    const [roster, setRoster] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!selectedExam) return;
        setLoading(true);
        try {
            // 1. Fetch Class Roster
            const { data: rosterData, error: rosterError } = await supabase.rpc('get_class_roster_for_admin', {
                p_class_id: selectedExam.class_id || 0 // Assuming numeric ID based on schema
            });
            if (rosterError) throw rosterError;

            // 2. Fetch Existing Marks
            const { data: marksData, error: marksError } = await supabase
                .from('exam_marks')
                .select('*')
                .eq('subject_exam_id', selectedExam.exam_id);
            if (marksError) throw marksError;

            // 3. Merge Roster with Marks
            const merged = (rosterData || []).map((student: any) => {
                const markRecord = (marksData || []).find((m: any) => m.student_id === student.id);
                return {
                    ...student,
                    marks_obtained: markRecord?.marks_obtained ?? '',
                    is_absent: markRecord?.is_absent ?? false,
                    existing_record_id: markRecord?.id
                };
            });

            setRoster(merged);
        } catch (err) {
            console.error("Forensic Entry Sync Failure:", err);
            setError("Failed to synchronize examination registry.");
        } finally {
            setLoading(false);
        }
    }, [selectedExam]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleMarkChange = (studentId: string, value: string) => {
        setRoster(prev => prev.map(s =>
            s.id === studentId ? { ...s, marks_obtained: value } : s
        ));
    };

    const handleAbsentToggle = (studentId: string) => {
        setRoster(prev => prev.map(s =>
            s.id === studentId ? { ...s, is_absent: !s.is_absent } : s
        ));
    };

    const handleBulkSave = async () => {
        setIsSaving(true);
        try {
            const promises = roster.map(s =>
                supabase.rpc('upsert_exam_mark_forensic', {
                    p_subject_exam_id: selectedExam.exam_id,
                    p_student_id: s.id,
                    p_marks: s.is_absent ? 0 : Number(s.marks_obtained),
                    p_is_absent: s.is_absent,
                    p_reason: 'Bulk Entry via Command Console',
                    p_operator_id: profile?.id
                })
            );

            await Promise.all(promises);
            // Refresh to get updated audit trails/IDs if needed
            fetchData();
        } catch (err) {
            console.error("Forensic Registry Save Failure:", err);
            setError("Mass entry persistence failed.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!selectedExam) return (
        <div className="py-20 text-center bg-white/[0.01] border border-dashed border-white/10 rounded-[3rem]">
            <AlertTriangleIcon className="w-16 h-16 text-amber-500/30 mx-auto mb-6" />
            <p className="text-[12px] font-black text-white/40 uppercase tracking-[0.5em]">Please select an assessment node to initiate mark entry.</p>
        </div>
    );

    if (loading) return <div className="py-20 flex justify-center"><Spinner /></div>;

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Context Header */}
            <div className="bg-[#12141c] border border-white/5 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden ring-1 ring-white/5">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8">
                    <div className="flex items-center gap-8">
                        <button onClick={onBack} className="p-4 bg-white/5 text-white/40 rounded-2xl hover:text-white transition-all border border-white/5">
                            <ChevronLeftIcon className="w-5 h-5" />
                        </button>
                        <div>
                            <h3 className="text-2xl font-serif font-black text-white uppercase tracking-tight">{selectedExam.subject_title} <span className="text-primary mx-2">/</span> {selectedExam.cycle_name}</h3>
                            <div className="flex items-center gap-4 mt-2">
                                <span className="px-3 py-1 bg-white/5 rounded-lg text-[9px] font-black text-white/30 uppercase tracking-widest border border-white/5">{selectedExam.class_name}</span>
                                <span className="px-3 py-1 bg-white/5 rounded-lg text-[9px] font-black text-white/30 uppercase tracking-widest border border-white/5">Max Marks: {selectedExam.total_marks}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <button
                            disabled={isSaving}
                            onClick={handleBulkSave}
                            className="px-10 py-5 bg-primary text-white font-black text-[10px] uppercase tracking-[0.4em] rounded-2xl shadow-2xl flex items-center gap-4 hover:-translate-y-1 transition-all active:scale-95 shadow-primary/20 disabled:opacity-50"
                        >
                            {isSaving ? <Spinner size="sm" /> : <SaveIcon className="w-4 h-4" />} Commit Changes
                        </button>
                    </div>
                </div>
            </div>

            {/* Entry Registry */}
            <div className="bg-[#12141c] border border-white/5 rounded-[3.5rem] overflow-hidden shadow-3xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[#0f1115] border-b border-white/5 text-[9px] font-black text-white/20 uppercase tracking-[0.5em]">
                            <tr>
                                <th className="p-10 pl-14">Student Identity</th>
                                <th className="p-10 text-center">Protocol</th>
                                <th className="p-10 text-right">Magnitude Entry</th>
                                <th className="p-10 text-right pr-14">Integrity check</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                            {roster.map((student, idx) => {
                                const val = Number(student.marks_obtained);
                                const isFail = !student.is_absent && student.marks_obtained !== '' && val < (selectedExam.passing_marks || 33);

                                return (
                                    <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                                        <td className="p-10 pl-14">
                                            <div className="flex items-center gap-6">
                                                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-white/20 text-xs font-black ring-1 ring-white/10">
                                                    {student.roll_number || idx + 1}
                                                </div>
                                                <div>
                                                    <p className="text-lg font-serif font-black text-white tracking-tight uppercase group-hover:text-primary transition-colors">{student.display_name}</p>
                                                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-0.5">ID: {student.id.slice(0, 8)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-10 text-center">
                                            <button
                                                onClick={() => handleAbsentToggle(student.id)}
                                                className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${student.is_absent
                                                    ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                    }`}
                                            >
                                                {student.is_absent ? 'Marked Absent' : 'Present'}
                                            </button>
                                        </td>
                                        <td className="p-10 text-right">
                                            <input
                                                type="number"
                                                disabled={student.is_absent}
                                                max={selectedExam.total_marks}
                                                value={student.marks_obtained}
                                                onChange={(e) => handleMarkChange(student.id, e.target.value)}
                                                className={`w-32 bg-black/40 border p-4 rounded-xl text-right font-mono font-black text-xl tracking-tighter outline-none focus:ring-2 transition-all ${student.is_absent ? 'opacity-20 pointer-events-none' :
                                                    isFail ? 'text-red-500 border-red-500/20 focus:ring-red-500/20' :
                                                        'text-white border-white/5 focus:ring-primary/20'
                                                    }`}
                                                placeholder="0.00"
                                            />
                                        </td>
                                        <td className="p-10 text-right pr-14">
                                            <div className="flex flex-col items-end gap-1">
                                                <span className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${student.is_absent ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                    isFail ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                        'bg-primary/10 text-primary border-primary/20'
                                                    }`}>
                                                    {student.is_absent ? 'FAILURE_NODE' : isFail ? 'AT_RISK_SYNC' : 'VALID_REGISTRY'}
                                                </span>
                                                {student.existing_record_id && (
                                                    <span className="text-[8px] font-black text-white/10 uppercase tracking-widest">Signed & Verified</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ExamsEntry;
