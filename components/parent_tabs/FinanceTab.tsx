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

        const currentDbCycle = dbCycles?.find(c => c.is_current);
        const currentYearStart = currentDbCycle ? parseInt(currentDbCycle.year_name.split('-')[0]) : 2024;

        const baseYear = 2023; // Start a bit earlier to show history if needed
        const endYear = 2030;
        const generated: AcademicCycle[] = [];

        for (let y = baseYear; y <= endYear; y++) {
            const yearName = `${y}-${y + 1}`;
            let status: AcademicCycle['status'] = 'UPCOMING';

            if (y < currentYearStart) status = 'ARCHIVED';
            else if (y === currentYearStart) status = 'CURRENT';
            else status = 'UPCOMING';

            // Find matching DB ID
            const dbMatch = dbCycles?.find(c => c.year_name === yearName);

            generated.push({
                id: y,
                year_name: yearName,
                is_current: status === 'CURRENT',
                status: status,
                db_id: dbMatch?.id
            });
        }

        // Filter: Show only from 1 year back to future
        const relevantCycles = generated.filter(c => c.id >= currentYearStart - 1);
        setCycleOptions(relevantCycles);

        // Default to Current
        const current = relevantCycles.find(c => c.status === 'CURRENT');
        if (current) setSelectedCycleId(current.id);
        else if (relevantCycles.length > 0) setSelectedCycleId(relevantCycles[1]?.id || relevantCycles[0].id);

    }, []);

    const fetchStudents = useCallback(async () => {
        setLoading(true);
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
            // Dev Mock
            if (process.env.NODE_ENV === 'development') {
                setStudents([{ student_id: 'mock-1', display_name: 'Demo Student', grade: 'Grade 5', profile_photo_url: null }]);
                setSelectedStudentId('mock-1');
            }
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
        if (selectedStudentId && selectedCycleId) fetchFinanceDetail();
    }, [selectedStudentId, selectedCycleId, fetchFinanceDetail]);


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

    return (
        <div className="max-w-7xl mx-auto pb-32 px-4 space-y-8 animate-in fade-in duration-700 font-sans">

            {/* A. HEADER CONTROLS (Student & Year) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">

                {/* 1. Student Selector */}
                <div className="relative z-20">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 pl-1">Select Student <span className="text-red-400">*</span></label>
                    <button
                        onClick={() => setIsStudentMenuOpen(!isStudentMenuOpen)}
                        className="w-full bg-[#1f2937] border border-white/10 hover:border-white/20 rounded-xl p-3 flex items-center justify-between transition-all shadow-lg"
                    >
                        <div className="flex items-center gap-3">
                            {selectedStudent ? (
                                <>
                                    <PremiumAvatar name={selectedStudent.display_name} src={selectedStudent.profile_photo_url} size="sm" />
                                    <div className="text-left">
                                        <div className="text-sm font-bold text-white">{selectedStudent.display_name}</div>
                                        <div className="text-xs text-white/50">{selectedStudent.grade || 'Grade N/A'}</div>
                                    </div>
                                </>
                            ) : (
                                <span className="text-white/50 italic">Please select a student...</span>
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
                                    className="absolute top-full left-0 w-full mt-2 bg-[#1f2937] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-30"
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

                {/* 2. Academic Year Selector */}
                <div className="relative z-10">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 pl-1">Academic Year</label>
                    <button
                        onClick={() => setIsYearMenuOpen(!isYearMenuOpen)}
                        className="w-full bg-[#1f2937] border border-white/10 hover:border-white/20 rounded-xl p-3 flex items-center justify-between transition-all shadow-lg min-h-[60px]"
                    >
                        {activeCycle ? (
                            <div className="flex items-center gap-3">
                                <div className={clsx("p-2 rounded-lg",
                                    activeCycle.status === 'CURRENT' ? 'bg-emerald-500/10 text-emerald-500' :
                                        activeCycle.status === 'UPCOMING' ? 'bg-blue-500/10 text-blue-500' : 'bg-white/5 text-white/40'
                                )}>
                                    <ClockIcon className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-bold text-white">{activeCycle.year_name}</div>
                                    <div className={clsx("text-[10px] font-bold uppercase tracking-wider",
                                        activeCycle.status === 'CURRENT' ? 'text-emerald-500' :
                                            activeCycle.status === 'UPCOMING' ? 'text-blue-500' : 'text-white/40'
                                    )}>
                                        {activeCycle.status}
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
                                    className="absolute top-full right-0 w-full mt-2 bg-[#1f2937] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-30 max-h-[300px] overflow-y-auto"
                                >
                                    {cycleOptions.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => { setSelectedCycleId(c.id); setIsYearMenuOpen(false); }}
                                            className="w-full p-3 flex items-center justify-between hover:bg-white/5 text-left border-b border-white/5 last:border-0"
                                        >
                                            <span className={clsx("text-sm font-medium", selectedCycleId === c.id ? "text-white" : "text-white/60")}>{c.year_name}</span>
                                            <span className={clsx("text-[9px] px-2 py-1 rounded font-black uppercase",
                                                c.status === 'CURRENT' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    c.status === 'UPCOMING' ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-white/30'
                                            )}>{c.status}</span>
                                        </button>
                                    ))}
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* ERROR STATE: No Student */}
            {!selectedStudentId ? (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-8 text-center animate-pulse mt-8">
                    <AlertTriangleIcon className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-amber-500">Selection Required</h3>
                    <p className="text-amber-200/60 mt-2">Please select a student from the dropdown above to view their financial details.</p>
                </div>
            ) : (
                <>
                    {/* B. FUTURE YEAR BANNER */}
                    {activeCycle?.status === 'UPCOMING' && (
                        <div className="bg-blue-500/10 border-l-4 border-blue-500 p-4 rounded-r-xl flex items-center gap-4 mt-8">
                            <div className="p-2 bg-blue-500/20 rounded-full text-blue-400"><ClockIcon className="w-5 h-5" /></div>
                            <div>
                                <h4 className="text-blue-100 font-bold text-sm">Upcoming Academic Year Preview</h4>
                                <p className="text-blue-200/60 text-xs">This fee structure is subject to approval. Payments are currently disabled.</p>
                            </div>
                        </div>
                    )}

                    {/* C. FINANCIAL SUMMARY STRIP (4 Cards) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">

                        {/* 1. Total Fees */}
                        <div className="bg-[#1f2937]/50 rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-colors">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400"><DocumentTextIcon className="w-5 h-5" /></div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Total Fees</span>
                            </div>
                            <div className="text-2xl font-bold text-white">{formatCurrency(metrics.totalFees)}</div>
                            <div className="text-[10px] text-white/30 mt-1">For {activeCycle?.year_name}</div>
                        </div>

                        {/* 2. Total Paid */}
                        <div className="bg-[#1f2937]/50 rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-colors">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><CheckCircleIcon className="w-5 h-5" /></div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Total Paid</span>
                            </div>
                            <div className="text-2xl font-bold text-white">{formatCurrency(metrics.totalPaid)}</div>
                            <div className="text-[10px] text-emerald-500/50 mt-1">Verified Payments</div>
                        </div>

                        {/* 3. OUTSTANDING (Hero) */}
                        <div className={clsx(
                            "md:col-span-2 lg:col-span-1 rounded-2xl p-6 border flex flex-col justify-between relative overflow-hidden transition-all duration-500",
                            metrics.outstanding > 0
                                ? "bg-gradient-to-br from-amber-500/10 to-red-500/10 border-red-500/30"
                                : "bg-gradient-to-br from-emerald-500/10 to-emerald-900/10 border-emerald-500/30"
                        )}>
                            <div className="flex items-center gap-3 mb-2 relative z-10">
                                {metrics.outstanding > 0 ? (
                                    <>
                                        <div className="p-2 bg-red-500/20 rounded-lg text-red-500"><AlertTriangleIcon className="w-5 h-5" /></div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-red-400">Action Required</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-500"><CheckCircleIcon className="w-5 h-5" /></div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">All Clear</span>
                                    </>
                                )}
                            </div>

                            <div className="relative z-10">
                                {metrics.outstanding > 0 ? (
                                    <>
                                        <div className="text-3xl font-black text-white">{formatCurrency(metrics.outstanding)}</div>
                                        <div className="text-xs text-red-300 mt-1 font-medium">Pending Dues</div>
                                        {activeCycle?.status === 'CURRENT' && (
                                            <button
                                                onClick={() => {
                                                    const unpaidIds = financeDetail?.installments.filter((i: any) => i.status !== 'paid').map((i: any) => i.id);
                                                    handlePayNow(unpaidIds && unpaidIds.length > 0 ? unpaidIds : []);
                                                }}
                                                className="mt-4 w-full py-2 bg-red-500 hover:bg-red-400 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-lg flex items-center justify-center gap-2"
                                            >
                                                <CreditCardIcon className="w-4 h-4" />
                                                Pay Now
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div className="text-xl font-bold text-emerald-100">Payments Up to Date</div>
                                        <div className="text-xs text-emerald-400/60 mt-1">No pending dues</div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* 4. Next Due */}
                        <div className="bg-[#1f2937]/50 rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-colors">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400"><ClockIcon className="w-5 h-5" /></div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Next Due</span>
                            </div>
                            {metrics.nextDue ? (
                                <>
                                    <div className="text-xl font-bold text-white mb-1">
                                        {new Date(metrics.nextDue.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                    </div>
                                    <div className="text-xs text-white/50">{metrics.nextDue.title}</div>
                                    <div className="text-sm font-bold text-white mt-2">{formatCurrency(metrics.nextDue.amount - metrics.nextDue.paid)}</div>
                                </>
                            ) : (
                                <div className="h-full flex flex-col justify-center">
                                    <div className="text-lg font-bold text-white/50">No Dues</div>
                                    <div className="text-xs text-white/30">Relax, nothing upcoming.</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* D. INSTALLMENT SCHEDULE */}
                    <div className="bg-[#1f2937] rounded-2xl border border-white/5 overflow-hidden shadow-xl mt-8">
                        <div className="p-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">Installment Schedule</h3>
                                <p className="text-xs text-white/40 mt-1">Detailed breakdown of fee installments</p>
                            </div>
                        </div>

                        {!financeDetail?.installments?.length ? (
                            <div className="p-12 text-center">
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <DocumentTextIcon className="w-6 h-6 text-white/20" />
                                </div>
                                <h4 className="text-white font-bold text-sm">No Installments Found</h4>
                                <p className="text-white/40 text-xs mt-1">There is no payment schedule available for {activeCycle?.year_name} yet.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-white/[0.02]">
                                        <tr>
                                            <th className="p-4 pl-6 text-[10px] font-black uppercase tracking-widest text-white/30 whitespace-nowrap hidden md:table-cell">Status</th>
                                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-white/30">Installment</th>
                                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-white/30 whitespace-nowrap">Due Date</th>
                                            <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-white/30">Total</th>
                                            <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-white/30">Paid</th>
                                            <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-white/30">Remaining</th>
                                            <th className="p-4 pr-6 text-right text-[10px] font-black uppercase tracking-widest text-white/30">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {financeDetail.installments.map((inst: any) => {
                                            const remaining = inst.amount - inst.paid;
                                            const isOverdue = inst.is_overdue;
                                            // const statusColor = inst.status === 'paid' ? 'text-emerald-500' : isOverdue ? 'text-red-500' : 'text-amber-500';

                                            return (
                                                <tr key={inst.id} className="group hover:bg-white/[0.02] transition-colors">
                                                    <td className="p-4 pl-6 hidden md:table-cell">
                                                        <div className={clsx("w-2 h-2 rounded-full",
                                                            inst.status === 'paid' ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : 'bg-amber-500'
                                                        )}></div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="text-sm font-bold text-white">{inst.title}</div>
                                                        <div className="md:hidden flex items-center gap-2 mt-1">
                                                            <div className={clsx("w-1.5 h-1.5 rounded-full",
                                                                inst.status === 'paid' ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : 'bg-amber-500'
                                                            )}></div>
                                                            <span className={clsx("text-[9px] uppercase font-bold",
                                                                inst.status === 'paid' ? 'text-emerald-500' : isOverdue ? 'text-red-500' : 'text-amber-500'
                                                            )}>{inst.status}</span>
                                                        </div>
                                                        {isOverdue && <div className="text-[9px] text-red-500 font-bold uppercase mt-1 hidden md:block">Overdue</div>}
                                                    </td>
                                                    <td className="p-4 text-xs font-mono text-white/60">
                                                        {new Date(inst.due_date).toLocaleDateString()}
                                                    </td>
                                                    <td className="p-4 text-right text-sm font-mono text-white">{formatCurrency(inst.amount)}</td>
                                                    <td className="p-4 text-right text-sm font-mono text-emerald-400">{formatCurrency(inst.paid)}</td>
                                                    <td className="p-4 text-right text-sm font-mono font-bold text-white">{formatCurrency(remaining)}</td>
                                                    <td className="p-4 pr-6 text-right">
                                                        {remaining > 0 ? (
                                                            activeCycle?.status === 'CURRENT' ? (
                                                                <button
                                                                    onClick={() => handlePayNow([inst.id])}
                                                                    className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider rounded border border-white/10"
                                                                >
                                                                    Pay This
                                                                </button>
                                                            ) : (
                                                                <span className="text-[10px] text-white/20 uppercase font-bold">Locked</span>
                                                            )
                                                        ) : (
                                                            <CheckCircleIcon className="w-5 h-5 text-emerald-500 ml-auto" />
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

                    {/* E. FEE BREAKDOWN ACCORDION */}
                    <div className="bg-[#1f2937] rounded-2xl border border-white/5 overflow-hidden mt-8">
                        <button
                            onClick={() => setIsFeeBreakdownOpen(!isFeeBreakdownOpen)}
                            className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400"><DocumentTextIcon className="w-5 h-5" /></div>
                                <div className="text-left">
                                    <h3 className="text-sm font-bold text-white">Full Fee Breakdown</h3>
                                    <p className="text-[10px] text-white/40 uppercase tracking-widest">Detailing Tuition, Transport, & Activities</p>
                                </div>
                            </div>
                            {isFeeBreakdownOpen ? <ChevronUpIcon className="w-5 h-5 text-white/50" /> : <ChevronDownIcon className="w-5 h-5 text-white/50" />}
                        </button>
                        <AnimatePresence>
                            {isFeeBreakdownOpen && (
                                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                    <div className="p-5 pt-0 border-t border-white/5">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {financeDetail?.breakdown?.map((item: any, idx: number) => (
                                                <div key={idx} className="flex justify-between items-center p-3 bg-black/20 rounded-lg border border-white/5">
                                                    <div>
                                                        <div className="text-xs font-bold text-white/80">{item.name}</div>
                                                        <div className="text-[10px] text-white/30">{item.type || 'Standard'}</div>
                                                    </div>
                                                    <div className="text-sm font-mono font-bold text-white">{formatCurrency(item.amount)}</div>
                                                </div>
                                            ))}
                                            {(!financeDetail?.breakdown || financeDetail.breakdown.length === 0) && (
                                                <p className="text-white/30 text-xs italic">No detailed breakdown available.</p>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
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
