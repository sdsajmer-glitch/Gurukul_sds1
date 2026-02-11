import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, formatError } from '../../services/supabase';
import { SchoolClass, SchoolBranch, BulkImportResult } from '../../types';
import Spinner from '../common/Spinner';
import { XIcon } from '../icons/XIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { FileSpreadsheetIcon } from '../icons/FileSpreadsheetIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { BookIcon } from '../icons/BookIcon';
import { SchoolIcon } from '../icons/SchoolIcon';
import { TeacherIcon } from '../icons/TeacherIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { ChevronLeftIcon } from '../icons/ChevronLeftIcon';

export type BulkClassActionType = 'create_classes' | 'assign_teachers' | 'map_subjects' | 'assign_students';

interface BulkClassOperationsModalProps {
    onClose: () => void;
    onSuccess: () => void;
    branchId?: number | null;
    academicYear: string;
}

const parseCSVLine = (line: string): string[] => {
    const pattern = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
    const matches = line.match(pattern) || [];
    return matches.map(m => m.replace(/^"|"$/g, '').trim());
};

const normalizeClassName = (name: string): string => {
    if (!name) return '';
    let processed = name.trim();
    processed = processed.replace(/Grade\s*(\d+)\s*-\s*([A-Z0-9]+)/i, (match, g, s) => {
        return `Grade ${g} - ${s.toUpperCase()}`;
    });
    processed = processed.replace(/^(\d+)\s*-\s*([A-Z0-9]+)$/i, (match, g, s) => {
        return `Grade ${g} - ${s.toUpperCase()}`;
    });
    return processed;
};

const BulkClassOperationsModal: React.FC<BulkClassOperationsModalProps> = ({ onClose, onSuccess, branchId, academicYear }) => {
    const [step, setStep] = useState<'select' | 'upload' | 'processing' | 'summary'>('select');
    const [action, setAction] = useState<BulkClassActionType | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);

    const [progress, setProgress] = useState(0);
    const [results, setResults] = useState<{ success: number; failed: number; errors: string[] }>({ success: 0, failed: 0, errors: [] });
    const [isProcessing, setIsProcessing] = useState(false);
    const [contextError, setContextError] = useState<string | null>(null);

    useEffect(() => {
        if (action === 'create_classes' && !branchId) {
            setContextError("No branch is selected. Please select an active branch context before proceeding.");
        } else {
            setContextError(null);
        }
    }, [action, branchId]);

    const getTemplate = (type: BulkClassActionType) => {
        switch (type) {
            case 'create_classes':
                return "Grade,Section,Class Name,Capacity\n10,A,Grade 10 - A,30\n10,B,Grade 10 - B,30";
            case 'assign_teachers':
                return "Class Name,Teacher Email\nGrade 10 - A,teacher@school.com\nGrade 10 - B,teacher2@school.com";
            case 'map_subjects':
                return "Class Name,Official Subject Code\nGrade 10 - A,CBSE-10-MAT\nGrade 10 - A,CBSE-10-ENG";
            case 'assign_students':
                return "Student Email,Class Name\nstudent1@school.com,Grade 10 - A\nstudent2@school.com,Grade 10 - B";
            default:
                return "";
        }
    };

    const handleDownloadTemplate = () => {
        if (!action) return;
        const content = getTemplate(action);
        const blob = new Blob([content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${action}_template.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);

            const reader = new FileReader();
            reader.onload = (evt) => {
                const text = evt.target?.result as string;
                if (text) {
                    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
                    if (lines.length < 2) {
                        setContextError("The uploaded CSV file is empty or missing required data rows.");
                        return;
                    }

                    const data = lines.slice(1).map((line) => {
                        const cols = parseCSVLine(line);
                        if (cols.length === 0 || (cols.length === 1 && !cols[0])) return null;

                        if (action === 'create_classes') {
                            return {
                                grade: cols[0]?.trim(),
                                section: cols[1]?.trim(),
                                name: normalizeClassName(cols[2] || `Grade ${cols[0]} - ${cols[1]}`),
                                capacity: parseInt(cols[3]) || 30
                            };
                        }
                        if (action === 'assign_teachers') {
                            return { class_name: normalizeClassName(cols[0]), teacher_email: cols[1]?.trim() };
                        }
                        if (action === 'map_subjects') {
                            return { class_name: normalizeClassName(cols[0]), subject_code: cols[1]?.trim() };
                        }
                        if (action === 'assign_students') {
                            return { student_email: cols[0]?.trim(), class_name: normalizeClassName(cols[1]) };
                        }
                        return null;
                    }).filter(Boolean);

                    setPreviewData(data);
                    setContextError(null);
                }
            };
            reader.readAsText(selectedFile);
        }
    };

    const processBatch = async () => {
        if (contextError || !action || previewData.length === 0) return;

        setIsProcessing(true);
        setStep('processing');
        setProgress(15);
        setResults({ success: 0, failed: 0, errors: [] });

        try {
            const rpcParams: any = {};
            if (action === 'create_classes') {
                rpcParams.p_classes = previewData;
                rpcParams.p_branch_id = branchId;
                rpcParams.p_academic_year = academicYear;
            } else if (action === 'assign_teachers') {
                rpcParams.p_assignments = previewData;
            } else if (action === 'assign_students') {
                rpcParams.p_enrollments = previewData;
            } else if (action === 'map_subjects') {
                rpcParams.p_mappings = previewData;
            }

            const rpcMap: Record<BulkClassActionType, string> = {
                'create_classes': 'bulk_create_classes',
                'assign_teachers': 'bulk_assign_class_teachers',
                'map_subjects': 'bulk_map_subjects_to_classes',
                'assign_students': 'bulk_enroll_students_to_classes'
            };

            setProgress(40);
            const { data, error } = await supabase.rpc(rpcMap[action], rpcParams);

            if (error) throw error;

            setProgress(100);

            const success = data?.success_count ?? (data?.success || 0);
            const failed = data?.failure_count ?? (data?.failed || 0);
            const rawErrors = data?.errors || [];

            setResults({
                success,
                failed,
                errors: rawErrors.map((e: any) => formatError(e))
            });

            setTimeout(() => setStep('summary'), 800);

        } catch (err: any) {
            console.error("Batch processing error:", err);
            setResults({
                success: 0,
                failed: previewData.length,
                errors: [formatError(err)]
            });
            setStep('summary');
        } finally {
            setIsProcessing(false);
        }
    };

    const getTitle = () => {
        switch (action) {
            case 'create_classes': return 'Mass Scale Class Creation';
            case 'assign_teachers': return 'Faculty Matrix Assignment';
            case 'map_subjects': return 'Curriculum Linkage Protocol';
            case 'assign_students': return 'Student Roster Synchronization';
            default: return 'Institutional Bulk Operations';
        }
    };

    const getIcon = () => {
        switch (action) {
            case 'create_classes': return <SchoolIcon className="w-8 h-8" />;
            case 'assign_teachers': return <TeacherIcon className="w-8 h-8" />;
            case 'map_subjects': return <BookIcon className="w-8 h-8" />;
            case 'assign_students': return <UsersIcon className="w-8 h-8" />;
            default: return <UploadIcon className="w-8 h-8" />;
        }
    };

    const renderSelectStep = () => (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                    { id: 'create_classes', label: 'Create Classes', desc: 'Initialize grades and sections in bulk', icon: <SchoolIcon className="w-8 h-8" />, color: 'bg-indigo-600' },
                    { id: 'assign_teachers', label: 'Assign Teachers', desc: 'Map faculty leads to specific units', icon: <TeacherIcon className="w-8 h-8" />, color: 'bg-purple-600' },
                    { id: 'assign_students', label: 'Enroll Students', desc: 'Execute massive student rostering', icon: <UsersIcon className="w-8 h-8" />, color: 'bg-emerald-600' },
                    { id: 'map_subjects', label: 'Map Subjects', desc: 'Link entire curriculum blocks', icon: <BookIcon className="w-8 h-8" />, color: 'bg-amber-600' },
                ].map((opt, idx) => (
                    <motion.button
                        whileHover={{ scale: 1.02, y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        key={opt.id}
                        onClick={() => { setAction(opt.id as BulkClassActionType); setStep('upload'); }}
                        className="flex flex-col items-center p-8 rounded-[2.5rem] border-2 border-border/50 bg-card hover:border-primary/40 hover:bg-primary/[0.02] transition-all group text-center h-full shadow-lg relative overflow-hidden"
                    >
                        <div className={`absolute top-0 right-0 w-32 h-32 ${opt.color}/[0.05] rounded-full blur-3xl -mr-16 -mt-16`}></div>
                        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-white mb-6 shadow-2xl group-hover:rotate-12 transition-transform duration-500 relative z-10 ${opt.color}`}>
                            {opt.icon}
                        </div>
                        <h4 className="font-black text-foreground text-lg tracking-tight uppercase italic">{opt.label}</h4>
                        <p className="text-[10px] text-muted-foreground mt-2 font-black uppercase tracking-widest opacity-60 px-4 leading-relaxed">{opt.desc}</p>
                    </motion.button>
                ))}
            </div>
        </motion.div>
    );

    const renderUploadStep = () => (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-10">
            <div className="p-8 bg-primary/5 border-2 border-dashed border-primary/20 rounded-[2.5rem] flex items-start gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
                <div className="p-4 bg-primary/10 rounded-2xl text-primary shadow-inner relative z-10">
                    <FileSpreadsheetIcon className="w-8 h-8" />
                </div>
                <div className="flex-grow text-left relative z-10">
                    <h4 className="text-lg font-black text-foreground tracking-tight uppercase italic underline decoration-primary decoration-4 underline-offset-4 mb-2">Protocol Requirements</h4>
                    <p className="text-xs text-muted-foreground/80 font-bold leading-relaxed mb-6">
                        System automatically normalizes Class Designations to <strong className="text-primary font-black uppercase">Grade X - Section</strong>. Ensure CSV source mapping aligns with architectural nodes.
                    </p>
                    <button onClick={handleDownloadTemplate} className="text-[10px] bg-background border-2 border-border px-6 py-3 rounded-xl font-black uppercase tracking-widest text-foreground hover:bg-muted hover:border-primary/40 transition-all flex items-center gap-3 shadow-xl active:scale-95 group">
                        <DownloadIcon className="w-4 h-4 group-hover:animate-bounce" /> Download Structure Template
                    </button>
                </div>
            </div>

            {contextError && (
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4 text-rose-600 bg-rose-500/10 p-6 rounded-2xl border-2 border-rose-500/20 shadow-lg italic">
                    <AlertTriangleIcon className="w-8 h-8 flex-shrink-0 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-widest leading-relaxed">{contextError}</span>
                </motion.div>
            )}

            <div className="border-4 border-dashed border-border/80 rounded-[3.5rem] p-16 text-center hover:bg-primary/[0.02] transition-all relative group cursor-pointer bg-muted/5 shadow-inner">
                <input type="file" accept=".csv" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                <div className="w-28 h-28 bg-primary/10 text-primary rounded-[2rem] flex items-center justify-center mx-auto mb-8 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-2xl shadow-primary/20">
                    <UploadIcon className="w-12 h-12" />
                </div>
                <p className="font-black text-foreground text-2xl tracking-tighter uppercase italic">
                    {file ? file.name : `Inject Data Stream`}
                </p>
                <p className="text-[10px] text-muted-foreground mt-3 font-black uppercase tracking-[0.3em]">{file ? `${(file.size / 1024).toFixed(1)} KB • Integrity Verified` : 'Select Source CSV or Drop Protocol'}</p>
            </div>

            <AnimatePresence>
                {previewData.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-center gap-3 text-emerald-600 bg-emerald-500/5 py-3 rounded-2xl border border-emerald-500/10"
                    >
                        <CheckCircleIcon className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{previewData.length} records synthesized successfully</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );

    const renderSummaryStep = () => (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10 text-center py-6">
            <div className="grid grid-cols-2 gap-8">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="p-10 bg-emerald-500/[0.03] border-2 border-emerald-500/20 rounded-[3rem] shadow-xl relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -mr-12 -mt-12"></div>
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 mb-6 flex items-center justify-center mx-auto shadow-inner">
                        <CheckCircleIcon className="w-8 h-8" />
                    </div>
                    <p className="text-6xl font-black text-emerald-600 tracking-tighter mb-2">{results.success}</p>
                    <p className="text-[10px] font-black text-emerald-700/60 uppercase tracking-[0.3em]">Successful</p>
                </motion.div>
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="p-10 bg-rose-500/[0.03] border-2 border-rose-500/20 rounded-[3rem] shadow-xl relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl -mr-12 -mt-12"></div>
                    <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 mb-6 flex items-center justify-center mx-auto shadow-inner">
                        <AlertTriangleIcon className="w-8 h-8" />
                    </div>
                    <p className="text-6xl font-black text-rose-600 tracking-tighter mb-2">{results.failed}</p>
                    <p className="text-[10px] font-black text-rose-700/60 uppercase tracking-[0.3em]">Failures</p>
                </motion.div>
            </div>

            {results.errors.length > 0 ? (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="text-left bg-muted/30 p-8 rounded-[2.5rem] border-2 border-border shadow-inner max-h-80 overflow-y-auto custom-scrollbar"
                >
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-6 text-foreground flex items-center gap-3">
                        <AlertTriangleIcon className="w-5 h-5 text-amber-500" />
                        Operation Log / Error Manifest:
                    </p>
                    <ul className="space-y-4 text-muted-foreground text-xs font-bold leading-relaxed">
                        {results.errors.map((err, idx) => (
                            <li key={idx} className="pb-4 border-b border-border/40 last:border-0 last:pb-0 flex items-start gap-4">
                                <span className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center text-[10px] font-black shrink-0">{idx + 1}</span>
                                <span className="italic">{err}</span>
                            </li>
                        ))}
                    </ul>
                </motion.div>
            ) : results.success > 0 ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center p-12 bg-emerald-500/[0.03] rounded-[3.5rem] border-4 border-dashed border-emerald-500/20 relative group"
                >
                    <div className="absolute inset-0 bg-emerald-500/[0.01] animate-pulse rounded-[3.5rem]"></div>
                    <CheckCircleIcon className="w-20 h-20 mx-auto mb-6 text-emerald-500 drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]" />
                    <p className="font-black text-emerald-700 text-2xl uppercase italic tracking-tight">Mass Synchronization Complete</p>
                    <p className="text-[10px] font-black text-emerald-600/60 uppercase tracking-[0.3em] mt-3">All parameters deployed successfully</p>
                </motion.div>
            ) : null}
        </motion.div>
    );

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/90 backdrop-blur-3xl z-[150] flex items-center justify-center p-6"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 50 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 50 }}
                    transition={{ type: "spring", damping: 30, stiffness: 300 }}
                    className="bg-card w-full max-w-4xl rounded-[3.5rem] shadow-[0_0_120px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden flex flex-col max-h-[94vh] ring-1 ring-black/5"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="p-12 border-b border-white/[0.05] bg-muted/10 flex justify-between items-center relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-[120px] -mr-40 -mt-40 transition-all group-hover:scale-125 duration-1000"></div>
                        <div className="flex items-center gap-8 relative z-20">
                            <div className="p-6 bg-primary text-white rounded-[2rem] shadow-2xl shadow-primary/40 rotate-12 group-hover:rotate-0 transition-all duration-700 hover:scale-110">
                                {action ? getIcon() : <UploadIcon className="w-8 h-8" />}
                            </div>
                            <div>
                                <h3 className="font-black text-3xl text-foreground tracking-tighter uppercase italic italic">{action ? getTitle() : 'Mass Core Deployment'}</h3>
                                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.4em] mt-1 opacity-60">
                                    {step === 'select' ? 'Select Operational Action' : step === 'upload' ? 'Map Source Protocols' : step === 'processing' ? 'Executing Synchronize...' : 'Operation Delta Manifest'}
                                </p>
                            </div>
                        </div>
                        {step !== 'processing' && (
                            <button onClick={onClose} className="p-5 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-all transform hover:rotate-90 z-20 border border-white/5">
                                <XIcon className="w-8 h-8" />
                            </button>
                        )}
                    </div>

                    <div className="p-12 overflow-y-auto custom-scrollbar flex-grow bg-background relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.01] to-transparent pointer-events-none"></div>
                        <AnimatePresence mode="wait">
                            <div key={step}>
                                {step === 'select' && renderSelectStep()}
                                {step === 'upload' && renderUploadStep()}
                                {step === 'processing' && (
                                    <div className="py-24 text-center space-y-12">
                                        <div className="relative w-56 h-56 mx-auto">
                                            <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
                                            <svg className="w-full h-full relative z-10" viewBox="0 0 100 100">
                                                <circle className="text-muted/10 stroke-current" strokeWidth="4" cx="50" cy="50" r="46" fill="transparent"></circle>
                                                <motion.circle
                                                    initial={{ strokeDashoffset: 289 }}
                                                    animate={{ strokeDashoffset: 289 - (289 * progress) / 100 }}
                                                    className="text-primary stroke-current transition-all duration-700 ease-out"
                                                    strokeWidth="6"
                                                    strokeLinecap="round"
                                                    cx="50"
                                                    cy="50"
                                                    r="46"
                                                    fill="transparent"
                                                    strokeDasharray="289"
                                                    transform="rotate(-90 50 50)"
                                                ></motion.circle>
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                                                <span className="text-6xl font-black text-foreground tracking-tighter italic">{progress}%</span>
                                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mt-2">Active Mapping</span>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <h4 className="text-2xl font-black text-foreground tracking-tight uppercase italic underline decoration-primary decoration-4 underline-offset-8">Synchronizing Data Nodes</h4>
                                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground animate-pulse">Initializing Mass Protocol Deployment...</p>
                                        </div>
                                    </div>
                                )}
                                {step === 'summary' && renderSummaryStep()}
                            </div>
                        </AnimatePresence>
                    </div>

                    <div className="p-12 border-t border-white/[0.05] bg-muted/10 flex justify-end gap-6 relative z-30">
                        {step === 'upload' && (
                            <>
                                <button
                                    onClick={() => { setStep('select'); setFile(null); setPreviewData([]); setAction(null); }}
                                    className="px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all flex items-center gap-4 active:scale-95"
                                >
                                    <ChevronLeftIcon className="w-5 h-5" /> Abort Action
                                </button>
                                <button
                                    onClick={processBatch}
                                    disabled={!file || isProcessing || !!contextError}
                                    className="px-12 py-6 bg-foreground text-background rounded-3xl font-black text-[10px] uppercase tracking-[0.4em] shadow-2xl hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-4 transition-all"
                                >
                                    {isProcessing ? <Spinner size="sm" className="text-background" /> : <>Initiate Synchronization <ChevronRightIcon className="w-6 h-6" /></>}
                                </button>
                            </>
                        )}
                        {step === 'summary' && (
                            <button
                                onClick={() => { onSuccess(); onClose(); }}
                                className="px-16 py-6 bg-primary text-white rounded-3xl font-black text-[10px] uppercase tracking-[0.5em] shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-5"
                            >
                                Finalize Deployment <CheckCircleIcon className="w-6 h-6" />
                            </button>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default BulkClassOperationsModal;