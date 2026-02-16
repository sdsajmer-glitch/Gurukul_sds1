import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, formatError } from '../../services/supabase';
import { UserProfile } from '../../types';
import Spinner from '../common/Spinner';
import { CreditCardIcon } from '../icons/CreditCardIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { XIcon } from '../icons/XIcon';
import { DocumentTextIcon } from '../icons/DocumentTextIcon';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { ChevronUpIcon } from '../icons/ChevronUpIcon';
import PremiumAvatar from '../common/PremiumAvatar';

interface FinanceTabProps {
    profile: UserProfile;
    initialStudentId?: string | null;
}

interface AcademicCycle {
    id: number;
    year_name: string;
    is_current: boolean;
    start_date?: string;
    status: 'ARCHIVED' | 'CURRENT' | 'UPCOMING';
    db_id?: number; // Actual DB ID if available
}

const FinanceTab: React.FC<FinanceTabProps> = ({ profile }) => {
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<any[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [financeDetail, setFinanceDetail] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Academic Year State
    const [cycleOptions, setCycleOptions] = useState<AcademicCycle[]>([]);
    const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null); // This tracks the generic Year ID (e.g., 2024)
    const [isYearMenuOpen, setIsYearMenuOpen] = useState(false);
    const [isStudentMenuOpen, setIsStudentMenuOpen] = useState(false);

    // Toggle States
    const [isFeeBreakdownOpen, setIsFeeBreakdownOpen] = useState(false);

    // Payment Logic
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadData, setUploadData] = useState({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        mode: 'NEFT',
        ref: ''
    });
    const [selectedInstallments, setSelectedInstallments] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- 1. INITIALIZATION & DATA FETCHING ---

    // Generate Dynamic Years (2024 -> 2030) + Merge with DB Current
    const initializeCycles = useCallback(async () => {
        // Fetch known cycles from DB to map IDs
        const { data: dbCycles } = await supabase.from('academic_years').select('*').order('start_date', { ascending: true });

        // CRITICAL FIX: Base on current real-world time (2026) or DB flag
        const currentDbCycle = dbCycles?.find(c => c.is_current);
        // If DB says nothing, we are in Feb 2026 -> 2025-2026 is the active cycle
        const currentYearStart = currentDbCycle ? parseInt(currentDbCycle.year_name.split('-')[0]) : 2025;

        const baseYear = 2023;
        const endYear = 2030;
        const generated: AcademicCycle[] = [];

        for (let y = baseYear; y <= endYear; y++) {
            const yearName = `${y}-${y + 1}`;
            let status: AcademicCycle['status'] = 'UPCOMING';

            // Match exact DB status if available
            const dbMatch = dbCycles?.find(c => c.year_name === yearName);

            if (dbMatch) {
                status = dbMatch.status.toUpperCase() as any;
            } else {
                if (y < currentYearStart) status = 'ARCHIVED';
                else if (y === currentYearStart) status = 'CURRENT';
                else status = 'UPCOMING';
            }

            generated.push({
                id: y,
                year_name: yearName,
                is_current: status === 'CURRENT' || (dbMatch?.is_current ?? false),
                status: status,
                db_id: dbMatch?.id
            });
        }

        // Filter: Show only from 1 year back to future
        const relevantCycles = generated.filter(c => c.id >= 2023);
        setCycleOptions(relevantCycles);

        // Auto-selection logic: Prioritize DB "Current"
        const dbCurrent = relevantCycles.find(c => c.db_id && dbCycles?.find(db => db.id === c.db_id)?.is_current);
        const logicCurrent = relevantCycles.find(c => c.status === 'CURRENT');

        if (dbCurrent) setSelectedCycleId(dbCurrent.id);
        else if (logicCurrent) setSelectedCycleId(logicCurrent.id);
        else if (relevantCycles.length > 0) setSelectedCycleId(relevantCycles.find(c => c.id === 2025)?.id || relevantCycles[0].id);

    }, []);

    const fetchStudents = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase.rpc('get_parent_linked_students_finance_v2', { p_parent_id: profile.id });
            if (error) throw error;
            setStudents(data || []);

            // Auto-select first student if none selected
            if (data && data.length > 0 && !selectedStudentId) {
                setSelectedStudentId(data[0].student_id);
            }
        } catch (err: any) {
            console.error("Error fetching students:", err);
            // Show more context in the error state
            setError(`Roster Linkage Pending: ${err.message || "Connectivity check failed"}`);
        } finally {
            setLoading(false);
        }
    }, [profile.id, selectedStudentId]);

    const fetchFinanceDetail = useCallback(async () => {
        if (!selectedStudentId || !selectedCycleId) return;
        setLoading(true);
        try {
            const selectedOpt = cycleOptions.find(c => c.id === selectedCycleId);

            // If we have a DB ID, use it. If not, it's a future generated year -> Likely no data
            if (!selectedOpt?.db_id) {
                setFinanceDetail({
                    summary: { total_billed: 0, total_paid: 0, outstanding: 0, status: 'NOT_GENERATED' },
                    installments: [],
                    breakdown: []
                });
                return;
            }

            const { data, error } = await supabase.rpc('get_student_finance_detail_v3', {
                p_student_id: selectedStudentId,
                p_cycle_id: selectedOpt.db_id
            });

            if (data) {
                setFinanceDetail(data);
            } else {
                setFinanceDetail({
                    summary: { total_billed: 0, total_paid: 0, outstanding: 0, status: 'NOT_GENERATED' },
                    installments: [],
                    breakdown: []
                });
            }

        } catch (err) {
            console.error("Fetch Finance Error:", err);
        } finally {
            setLoading(false);
        }
    }, [selectedStudentId, selectedCycleId, cycleOptions]);

    useEffect(() => {
        initializeCycles();
        fetchStudents();
    }, [initializeCycles, fetchStudents]);

    useEffect(() => {
        if (selectedStudentId && selectedCycleId && cycleOptions.length > 0) fetchFinanceDetail();
    }, [selectedStudentId, selectedCycleId, fetchFinanceDetail, cycleOptions.length]);


    // --- 2. COMPUTED METRICS ---

    const activeCycle = cycleOptions.find(c => c.id === selectedCycleId);
    const selectedStudent = students.find(s => s.student_id === selectedStudentId);

    const metrics = useMemo(() => {
        if (!financeDetail) return { totalFees: 0, totalPaid: 0, outstanding: 0, nextDue: null, status: 'LOADING' };

        const summary = financeDetail.summary || {};
        const installments = financeDetail.installments || [];

        const totalFees = summary.total_billed || 0;
        const totalPaid = summary.total_paid || 0;
        const outstanding = summary.outstanding || 0; // Use summary outstanding which handles adjustments

        // Find next due installment
        // Logic: specific installment that is NOT paid and has the earliest due date
        const nextDueInst = installments
            .filter((i: any) => i.status !== 'paid')
            .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

        return {
            totalFees,
            totalPaid,
            outstanding,
            nextDue: nextDueInst,
            status: summary.status
        };
    }, [financeDetail]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);


    // --- 3. ACTIONS ---

    const handlePayNow = async (invoiceIds: string[]) => {
        if (!selectedStudentId || invoiceIds.length === 0) return;
        const totalAmount = financeDetail?.installments
            .filter((i: any) => invoiceIds.includes(i.id))
            .reduce((acc: number, curr: any) => acc + (curr.amount - curr.paid), 0) || 0;

        // If clicking 'Pay All' on Hero card, calculate total outstanding
        const amountToPay = totalAmount > 0 ? totalAmount : metrics.outstanding;

        setUploadData(prev => ({ ...prev, amount: amountToPay.toString() }));
        setIsUploadModalOpen(true);
        if (invoiceIds.length > 0) setSelectedInstallments(invoiceIds);
    };


    // --- 4. RENDER ---

    if (loading && !students.length) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <Spinner size="lg" className="text-emerald-500" />
        </div>
    );

    // Helpers for UI Logic
    // Helpers for UI Logic (Case-Insensitive)
    const isPreview = activeCycle?.status?.toUpperCase() === 'UPCOMING';
    const isCurrent = activeCycle?.status?.toUpperCase() === 'CURRENT' || activeCycle?.status?.toUpperCase() === 'ACTIVE';
    const isArchived = activeCycle?.status?.toUpperCase() === 'ARCHIVED';
    const isNotConfigured = financeDetail?.summary?.status === 'NOT_GENERATED' || ((!metrics.totalFees || metrics.totalFees === 0) && (!metrics.totalPaid || metrics.totalPaid === 0));

    // Status Badge Helpers
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'CURRENT': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            case 'UPCOMING': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
            case 'ARCHIVED': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            default: return 'text-white/40 bg-white/5 border-white/10';
        }
    };

    return (
        <div className="max-w-7xl mx-auto pb-32 px-4 space-y-6 animate-in fade-in duration-700 font-sans">
            {/* A. CONTROL STRIP (Merged Student & Year) */}
            <div className="bg-[#1f2937] border border-white/10 rounded-xl p-2 flex flex-col md:flex-row items-center gap-2 shadow-xl relative z-30 mt-6">

                {/* 1. Student Selector */}
                <div className="relative w-full md:w-1/2 group">
                    <button
                        onClick={() => { setIsStudentMenuOpen(!isStudentMenuOpen); setIsYearMenuOpen(false); }}
                        className="w-full bg-black/20 hover:bg-black/40 border border-transparent hover:border-white/10 rounded-lg p-2.5 flex items-center justify-between transition-all"
                    >
                        <div className="flex items-center gap-3">
                            {selectedStudent ? (
                                <>
                                    <PremiumAvatar name={selectedStudent.display_name} src={selectedStudent.profile_photo_url} size="xs" />
                                    <div className="text-left">
                                        <div className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-0.5">Student</div>
                                        <div className="text-sm font-bold text-white leading-none">{selectedStudent.display_name}</div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-left pl-1">
                                    <span className="text-[10px] text-red-400 font-black uppercase tracking-widest mb-0.5 block">Required</span>
                                    <span className="text-white/50 italic text-sm">Select Student...</span>
                                </div>
                            )}
                        </div>
                        <ChevronDownIcon className="w-4 h-4 text-white/50" />
                    </button>

                    <AnimatePresence>
                        {isStudentMenuOpen && (
                            <>
                                <div className="fixed inset-0" onClick={() => setIsStudentMenuOpen(false)}></div>
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                                    className="absolute top-full left-0 w-full mt-2 bg-[#1f2937] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-40"
                                >
                                    {students.map(s => (
                                        <button
                                            key={s.student_id}
                                            onClick={() => { setSelectedStudentId(s.student_id); setIsStudentMenuOpen(false); }}
                                            className="w-full p-3 flex items-center gap-3 hover:bg-white/5 text-left border-b border-white/5 last:border-0 relative"
                                        >
                                            <PremiumAvatar name={s.display_name} src={s.profile_photo_url} size="xs" />
                                            <div>
                                                <div className="text-sm font-bold text-white">{s.display_name}</div>
                                                <div className="text-xs text-white/50">{s.grade}</div>
                                            </div>
                                            {selectedStudentId === s.student_id && <div className="absolute right-3 w-2 h-2 rounded-full bg-emerald-500"></div>}
                                        </button>
                                    ))}
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>

                {/* Divider (Desktop) */}
                <div className="hidden md:block w-px h-10 bg-white/10"></div>

                {/* 2. Academic Year Selector */}
                <div className="relative w-full md:w-1/2">
                    <button
                        onClick={() => { setIsYearMenuOpen(!isYearMenuOpen); setIsStudentMenuOpen(false); }}
                        className="w-full bg-black/20 hover:bg-black/40 border border-transparent hover:border-white/10 rounded-lg p-2.5 flex items-center justify-between transition-all"
                    >
                        {activeCycle ? (
                            <div className="flex items-center gap-3">
                                <div className={clsx("p-2 rounded-md",
                                    activeCycle.status === 'CURRENT' ? "bg-emerald-500/10 text-emerald-500" :
                                        activeCycle.status === 'UPCOMING' ? "bg-purple-500/10 text-purple-500" : "bg-white/5 text-white/40"
                                )}>
                                    <ClockIcon className="w-4 h-4" />
                                </div>
                                <div className="text-left">
                                    <div className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-0.5">Academic Year</div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-white leading-none">{activeCycle.year_name}</span>
                                        <span className={clsx("text-[9px] px-1.5 py-0.5 rounded font-black uppercase border", getStatusColor(activeCycle.status))}>
                                            {activeCycle.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : <span>Loading...</span>}
                        <ChevronDownIcon className="w-4 h-4 text-white/50" />
                    </button>

                    <AnimatePresence>
                        {isYearMenuOpen && (
                            <>
                                <div className="fixed inset-0" onClick={() => setIsYearMenuOpen(false)}></div>
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                                    className="absolute top-full right-0 w-full mt-2 bg-[#1f2937] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-40 max-h-[300px] overflow-y-auto"
                                >
                                    {cycleOptions.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => { setSelectedCycleId(c.id); setIsYearMenuOpen(false); }}
                                            className="w-full p-3 flex items-center justify-between hover:bg-white/5 text-left border-b border-white/5 last:border-0"
                                        >
                                            <span className={clsx("text-sm font-medium", selectedCycleId === c.id ? "text-white" : "text-white/60")}>{c.year_name}</span>
                                            <span className={clsx("text-[9px] px-2 py-1 rounded font-black uppercase border", getStatusColor(c.status))}>{c.status}</span>
                                        </button>
                                    ))}
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Error State: Connectivity/Sync */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-4 text-red-500"
                    >
                        <AlertTriangleIcon className="w-5 h-5 shrink-0" />
                        <div className="text-xs font-black uppercase tracking-widest">{error}</div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Error State: No Student selected (Default) */}
            {!selectedStudentId ? (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-8 text-center flex flex-col items-center">
                    <AlertTriangleIcon className="w-12 h-12 text-amber-500 mb-4" />
                    <h3 className="text-xl font-bold text-amber-500">Selection Required</h3>
                    <p className="text-amber-200/60 mt-2 text-sm">{students.length > 0 ? "Please select a student from the dropdown above to view their financial details." : "No linked students found. Check your profile linkage in 'Children' tab."}</p>
                </div>
            ) : (
                <>
                    {/* B. UPCOMING YEAR ALERT (Compact Mode) */}
                    {isPreview && (
                        <div className="bg-purple-500/10 border-l-4 border-purple-500/50 p-3 rounded-r-lg flex items-center gap-3">
                            <div className="p-1.5 bg-purple-500/20 rounded-full text-purple-400"><ClockIcon className="w-4 h-4" /></div>
                            <div>
                                <h4 className="text-purple-100 font-bold text-sm">Upcoming Academic Year Preview</h4>
                                <p className="text-purple-200/60 text-[11px] leading-tight mt-0.5">Payments for {activeCycle?.year_name} will be enabled once the academic year begins.</p>
                            </div>
                        </div>
                    )}

                    {/* FINANCE LIFECYCLE TIMELINE INDICATOR */}
                    <div className="bg-[#1f2937]/30 border border-white/5 rounded-xl p-4 md:p-6 overflow-x-auto">
                        <div className="flex items-center justify-between min-w-[600px] relative">
                            {/* Connector Line */}
                            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/5 -translate-y-1/2 z-0"></div>
                            <div className={clsx(
                                "absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-emerald-500 to-purple-500 -translate-y-1/2 z-0 transition-all duration-1000",
                                isPreview ? "w-1/4" : isCurrent && !isNotConfigured ? "w-full" : "w-0"
                            )}></div>

                            {[
                                { label: 'Enrollment', status: 'completed', icon: <CheckCircleIcon /> },
                                { label: 'Preview Mode', status: isPreview || isCurrent ? 'completed' : 'pending', icon: <DocumentTextIcon /> },
                                { label: 'Year Activated', status: isCurrent ? 'completed' : 'pending', icon: <ClockIcon /> },
                                { label: 'Ledger Generated', status: isCurrent && !isNotConfigured ? 'completed' : 'pending', icon: <UploadIcon /> },
                                { label: 'Payments Enabled', status: isCurrent && !isNotConfigured ? 'active' : 'pending', icon: <CreditCardIcon /> },
                            ].map((step, idx) => (
                                <div key={idx} className="flex flex-col items-center gap-2 relative z-10 w-32">
                                    <div className={clsx(
                                        "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                                        step.status === 'completed' ? "bg-emerald-500 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]" :
                                            step.label === 'Preview Mode' && isPreview ? "bg-purple-500 border-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]" :
                                                step.status === 'active' ? "bg-indigo-500 border-indigo-500 text-white animate-pulse" :
                                                    "bg-[#111827] border-white/10 text-white/20"
                                    )}>
                                        {React.cloneElement(step.icon as React.ReactElement, { className: "w-4 h-4" } as any)}
                                    </div>
                                    <span className={clsx(
                                        "text-[10px] font-black uppercase tracking-tighter whitespace-nowrap",
                                        step.status === 'completed' || (step.label === 'Preview Mode' && isPreview) ? "text-white" : "text-white/20"
                                    )}>
                                        {step.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* C. FINANCIAL HIERARCHY GRID */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                        {/* 1. PRIMARY STATUS CARD */}
                        <div className={clsx(
                            "rounded-2xl p-6 border flex flex-col justify-between relative overflow-hidden transition-all duration-500",
                            // Dynamic Sizing & Styling
                            (isCurrent && metrics.outstanding > 0)
                                ? "md:col-span-2 lg:col-span-2 bg-gradient-to-br from-red-500/10 to-orange-500/5 border-red-500/20 hover:border-red-500/30"
                                : (isCurrent && !isNotConfigured)
                                    ? "lg:col-span-1 bg-gradient-to-br from-emerald-500/10 to-emerald-900/10 border-emerald-500/20"
                                    : "lg:col-span-1 bg-[#1f2937]/50 border-white/5"
                        )}>
                            {/* PREVIEW MODE CONTENT */}
                            {isPreview ? (
                                <>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400"><DocumentTextIcon className="w-5 h-5" /></div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-purple-300/60">Institutional Preview</span>
                                    </div>
                                    <div>
                                        {isNotConfigured ? (
                                            <div className="space-y-2">
                                                <div className="text-sm font-bold text-white/40 italic">Finalizing Structure...</div>
                                                <div className="text-[10px] text-purple-200/20 leading-tight uppercase tracking-tighter">Draft version will be published shortly by school administration.</div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="text-3xl font-black text-white tracking-tighter">{formatCurrency(metrics.totalFees)}</div>
                                                <div className="text-[10px] text-purple-200/40 mt-1 uppercase font-bold tracking-widest">Projected Enrollment Cost</div>

                                                {/* Preview Breakdown Hint */}
                                                <div className="mt-4 pt-4 border-t border-purple-500/10 grid grid-cols-2 gap-2">
                                                    <div>
                                                        <div className="text-[9px] text-white/30 uppercase font-black">Term 1 (40%)</div>
                                                        <div className="text-xs font-bold text-white/60">{formatCurrency(metrics.totalFees * 0.4)}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-[9px] text-white/30 uppercase font-black uppercase tracking-tighter">Seat Lock Fee</div>
                                                        <div className="text-[10px] font-bold text-emerald-400">Included</div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </>
                            ) :
                                /* ACTIVE MODE CONTENT */
                                isNotConfigured ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center py-2">
                                        <AlertTriangleIcon className="w-8 h-8 text-white/20 mb-2" />
                                        <div className="text-sm font-bold text-white/50">Fee Structure Not Configured</div>
                                    </div>
                                ) : metrics.outstanding > 0 ? (
                                    <>
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="p-2 bg-red-500/20 rounded-lg text-red-500"><AlertTriangleIcon className="w-5 h-5" /></div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-red-400">Action Required</span>
                                        </div>
                                        <div>
                                            <div className="text-4xl font-black text-white tracking-tight">{formatCurrency(metrics.outstanding)}</div>
                                            <div className="text-sm text-red-300/80 mt-1 font-medium">Outstanding Balance</div>
                                        </div>
                                        {isCurrent && (
                                            <button
                                                onClick={() => {
                                                    const unpaidIds = financeDetail?.installments.filter((i: any) => i.status !== 'paid').map((i: any) => i.id);
                                                    handlePayNow(unpaidIds && unpaidIds.length > 0 ? unpaidIds : []);
                                                }}
                                                className="mt-6 w-full py-3 bg-red-500 hover:bg-red-400 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 transition-transform transform active:scale-95"
                                            >
                                                <CreditCardIcon className="w-4 h-4" />
                                                Pay Outstanding Dues
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    /* ALL CLEAR STATE */
                                    <>
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-500"><CheckCircleIcon className="w-5 h-5" /></div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Status</span>
                                        </div>
                                        <div>
                                            <div className="text-xl font-bold text-emerald-100">All Clear</div>
                                            <div className="text-[10px] text-emerald-400/60 mt-1">Payments Up to Date</div>
                                        </div>
                                    </>
                                )}
                        </div>

                        {/* 2. TOTAL FEES & PAID (Hidden in Preview if showed in main - No, show as well for detailed view) */}

                        {!isPreview && (
                            <>
                                <div className="bg-[#1f2937]/50 rounded-2xl p-6 border border-white/5 flex flex-col justify-center hover:border-white/10 transition-colors">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-1.5 bg-indigo-500/10 rounded text-indigo-400"><DocumentTextIcon className="w-4 h-4" /></div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Total Fees</span>
                                    </div>
                                    <div className="text-2xl font-bold text-white">{formatCurrency(metrics.totalFees)}</div>
                                    <div className="text-[10px] text-white/30 mt-1">For {activeCycle?.year_name}</div>
                                </div>

                                <div className="bg-[#1f2937]/50 rounded-2xl p-6 border border-white/5 flex flex-col justify-center hover:border-white/10 transition-colors">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-1.5 bg-emerald-500/10 rounded text-emerald-400"><CheckCircleIcon className="w-4 h-4" /></div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Total Paid</span>
                                    </div>
                                    <div className="text-2xl font-bold text-emerald-400">{formatCurrency(metrics.totalPaid)}</div>
                                    <div className="text-[10px] text-white/30 mt-1">Verified Payments</div>
                                </div>
                            </>
                        )}

                        {/* 3. NEXT DUE */}
                        <div className={clsx(
                            "rounded-2xl p-6 border flex flex-col justify-between hover:border-white/10 transition-colors bg-[#1f2937]/50 border-white/5",
                            (isCurrent && metrics.outstanding > 0) ? "lg:col-span-2" : "lg:col-span-1"
                        )}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 bg-blue-500/10 rounded text-blue-400"><ClockIcon className="w-4 h-4" /></div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/30">{isPreview ? 'First Installment' : 'Next Due'}</span>
                            </div>
                            {metrics.nextDue ? (
                                <div className="flex items-end justify-between">
                                    <div className="flex flex-col gap-1">
                                        <div className="text-xl font-black text-white">
                                            {new Date(metrics.nextDue.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                            <div className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">{metrics.nextDue.title}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-black text-white leading-none">{formatCurrency(metrics.nextDue.amount - metrics.nextDue.paid)}</div>
                                        <div className="text-[10px] font-black text-white/20 uppercase mt-1">{isPreview ? 'Projected Amount' : 'Due Amount'}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col justify-center">
                                    <div className="text-lg font-bold text-white/30">{isPreview ? 'No Schedule Yet' : 'No Upcoming Dues'}</div>
                                    <div className="text-[10px] text-white/20">{isPreview ? 'Projected schedule will appear once finalized.' : 'Relax, nothing due soon.'}</div>
                                </div>
                            )}
                        </div>

                    </div>


                    {/* D. SECTIONS: INSTALLMENTS & BREAKDOWN */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* INSTALLMENT SCHEDULE (2/3 width) */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="bg-[#1f2937] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
                                <div className="p-5 border-b border-white/5 flex justify-between items-center">
                                    <h3 className="text-sm font-bold text-white">Installment Schedule</h3>
                                    {isPreview && <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-black uppercase">Preview Mode</span>}
                                </div>

                                {!financeDetail?.installments?.length ? (
                                    <div className={clsx("text-center flex flex-col items-center justify-center transition-all", isPreview ? "p-8" : "p-12")}>
                                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3">
                                            <DocumentTextIcon className="w-5 h-5 text-white/20" />
                                        </div>
                                        <h4 className="text-white font-bold text-sm">No Installments Found</h4>
                                        <p className="text-white/40 text-xs mt-1">
                                            {isPreview
                                                ? "Installments will be generated when academic year activates."
                                                : isCurrent && isNotConfigured
                                                    ? "Finance Setup Pending – School Admin Action Required"
                                                    : `There is no payment schedule available for ${activeCycle?.year_name} yet.`}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-black/20">
                                                <tr>
                                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Installment</th>
                                                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-white/30 whitespace-nowrap">Due Date</th>
                                                    <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-white/30">Amount</th>
                                                    <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-white/30">Status</th>
                                                    <th className="p-4 pr-6 text-right text-[10px] font-black uppercase tracking-widest text-white/30">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {financeDetail.installments.map((inst: any) => {
                                                    const remaining = inst.amount - inst.paid;
                                                    const isOverdue = inst.is_overdue;
                                                    const status = inst.status;

                                                    return (
                                                        <tr key={inst.id} className="group hover:bg-white/[0.02] transition-colors">
                                                            <td className="p-4">
                                                                <div className="text-sm font-bold text-white">{inst.title}</div>
                                                                {isOverdue && !isPreview && <div className="text-[9px] text-red-500 font-bold uppercase mt-0.5">Overdue</div>}
                                                            </td>
                                                            <td className="p-4 text-xs font-mono text-white/60">
                                                                {new Date(inst.due_date).toLocaleDateString()}
                                                            </td>
                                                            <td className="p-4 text-right text-sm font-mono text-white">
                                                                {formatCurrency(inst.amount)}
                                                                {inst.paid > 0 && <div className="text-[10px] text-emerald-500/60 mt-0.5">Paid: {formatCurrency(inst.paid)}</div>}
                                                            </td>
                                                            <td className="p-4 text-right">
                                                                {status === 'paid' ? (
                                                                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">PAID</span>
                                                                ) : (
                                                                    <span className={clsx("text-[10px] font-bold px-2 py-1 rounded", isOverdue && !isPreview ? "text-red-500 bg-red-500/10" : "text-amber-500 bg-amber-500/10")}>
                                                                        {status.toUpperCase()}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-4 pr-6 text-right">
                                                                {status !== 'paid' && remaining > 0 ? (
                                                                    isPreview ? (
                                                                        <span className="text-[10px] text-white/20 uppercase font-bold">Preview</span>
                                                                    ) : activeCycle?.status === 'CURRENT' ? (
                                                                        <button
                                                                            onClick={() => handlePayNow([inst.id])}
                                                                            className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider rounded border border-white/10 transition-colors"
                                                                        >
                                                                            Pay
                                                                        </button>
                                                                    ) : (
                                                                        <span className="text-[10px] text-white/20 uppercase font-bold">Locked</span>
                                                                    )
                                                                ) : (
                                                                    <CheckCircleIcon className="w-5 h-5 text-emerald-500/50 ml-auto" />
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* FEE BREAKDOWN ACCORDION (1/3 width) */}
                        <div className="lg:col-span-1">
                            <div className="bg-[#1f2937] rounded-2xl border border-white/5 overflow-hidden sticky top-6">
                                <button
                                    onClick={() => setIsFeeBreakdownOpen(!isFeeBreakdownOpen)}
                                    className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors bg-white/[0.01]"
                                >
                                    <div className="text-left">
                                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                            {isPreview ? 'Fee Structure (Preview)' : 'Full Fee Breakdown'}
                                            {isPreview && <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>}
                                        </h3>
                                        <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">Tuition, Transport, Activities</p>
                                    </div>
                                    {isFeeBreakdownOpen ? <ChevronUpIcon className="w-4 h-4 text-white/50" /> : <ChevronDownIcon className="w-4 h-4 text-white/50" />}
                                </button>

                                <AnimatePresence>
                                    {(isFeeBreakdownOpen || isPreview) && ( // Auto-open in preview
                                        <motion.div
                                            initial={{ height: isFeeBreakdownOpen ? 'auto' : 0 }}
                                            animate={{ height: isFeeBreakdownOpen ? 'auto' : 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="p-4 pt-0 border-t border-white/5 space-y-2 mt-2">
                                                {/* Year Tag at Top */}
                                                <div className="flex justify-between items-center mb-3">
                                                    <span className="text-[10px] font-black uppercase text-white/20">Academic Year</span>
                                                    <span className="text-[10px] font-bold text-white/40">{activeCycle?.year_name}</span>
                                                </div>

                                                {financeDetail?.breakdown?.map((item: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between items-center p-2.5 bg-black/20 rounded-lg border border-white/5">
                                                        <div>
                                                            <div className="text-xs font-bold text-white/90">{item.name}</div>
                                                            <div className="text-[10px] text-white/30">{item.type || 'Standard'}</div>
                                                        </div>
                                                        <div className="text-sm font-mono font-bold text-white">{formatCurrency(item.amount)}</div>
                                                    </div>
                                                ))}

                                                {(!financeDetail?.breakdown || financeDetail.breakdown.length === 0) && (
                                                    <div className="text-center py-4">
                                                        <p className="text-white/30 text-xs italic">No detailed breakdown available.</p>
                                                    </div>
                                                )}

                                                <div className="pt-3 border-t border-white/5 flex justify-between items-center mt-2">
                                                    <span className="text-xs font-bold text-white/50">Total</span>
                                                    <span className="text-lg font-bold text-emerald-400">{formatCurrency(metrics.totalFees)}</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>

                    {/* F. MANUAL PAYMENT MODAL (Simplified Reuse) */}
                    <AnimatePresence>
                        {isUploadModalOpen && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-[#1f2937] w-full max-w-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                                >
                                    <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                                        <h3 className="text-lg font-bold text-white">Upload Receipt</h3>
                                        <button onClick={() => setIsUploadModalOpen(false)}><XIcon className="w-5 h-5 text-white/50" /></button>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-white/40 mb-1 block">Amount</label>
                                            <input type="number" placeholder="Amount" value={uploadData.amount} onChange={e => setUploadData({ ...uploadData, amount: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 transition-colors" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-white/40 mb-1 block">UTR / Reference</label>
                                            <input type="text" placeholder="Transaction Reference ID" value={uploadData.ref} onChange={e => setUploadData({ ...uploadData, ref: e.target.value })} className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 transition-colors" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-bold text-white/40 mb-1 block">Proof</label>
                                            <input type="file" accept="image/*,.pdf" onChange={e => {
                                                if (e.target.files) setUploadFile(e.target.files[0]);
                                            }} className="w-full text-sm text-white/60 bg-black/20 rounded-lg p-3 border border-white/10" />
                                        </div>
                                    </div>
                                    <div className="p-4 border-t border-white/5 flex justify-end gap-3">
                                        <button onClick={() => setIsUploadModalOpen(false)} className="px-4 py-2 text-white/60 hover:text-white text-xs font-bold uppercase transition-colors">Cancel</button>
                                        <button
                                            onClick={async () => {
                                                if (!selectedStudentId || !uploadFile || !uploadData.amount) return alert("Fill all fields");
                                                setIsSubmitting(true);
                                                try {
                                                    const fileName = `receipts/${selectedStudentId}/${Date.now()}_${uploadFile.name}`;
                                                    const { data: up, error: upErr } = await supabase.storage.from('secure-documents').upload(fileName, uploadFile);
                                                    if (upErr && process.env.NODE_ENV !== 'development') throw upErr;

                                                    const proofUrl = up ? supabase.storage.from('secure-documents').getPublicUrl(fileName).data.publicUrl : 'https://mock.com/receipt';

                                                    // Pass uploadData.mode if UI has selector, else default 'NEFT'
                                                    await supabase.rpc('submit_manual_payment_receipt', {
                                                        p_student_id: selectedStudentId,
                                                        p_amount: parseFloat(uploadData.amount),
                                                        p_transaction_date: uploadData.date,
                                                        p_transaction_ref: uploadData.ref,
                                                        p_payment_mode: uploadData.mode,
                                                        p_proof_url: proofUrl,
                                                        p_invoice_ids: []
                                                    });
                                                    alert("Submitted for verification!");
                                                    setIsUploadModalOpen(false);
                                                    fetchFinanceDetail();
                                                } catch (e: any) { alert(e.message); }
                                                finally { setIsSubmitting(false); }
                                            }}
                                            disabled={isSubmitting}
                                            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold uppercase rounded-lg shadow-lg flex items-center gap-2"
                                        >
                                            {isSubmitting ? <Spinner size="sm" className="text-black" /> : null}
                                            {isSubmitting ? 'Submitting...' : 'Submit Receipt'}
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </div>
    );
};

export default FinanceTab;
