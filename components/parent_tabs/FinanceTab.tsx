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
import { InfoIcon } from '../icons/InfoIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { ArrowRightIcon } from '../icons/ArrowRightIcon';
import { ShieldAlertIcon } from '../icons/ShieldAlertIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { LockIcon } from '../icons/LockIcon';
import { IdCardIcon } from '../icons/IdCardIcon';
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
    status: 'ARCHIVED' | 'CURRENT' | 'UPCOMING' | 'ACTIVE';
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
    const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
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

    // Flow Enhancement States
    const [notified, setNotified] = useState(false);
    const [showProtocolInfo, setShowProtocolInfo] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isTransmitting, setIsTransmitting] = useState(false);
    const [successToast, setSuccessToast] = useState<string | null>(null);
    const [terminalSteps, setTerminalSteps] = useState([
        { id: '01', label: 'System Validation', status: 'OK' },
        { id: '02', label: 'Ledger Pending', status: 'PENDING' },
        { id: '03', label: 'Configuration', status: 'VERIFIED' },
        { id: '04', label: 'Security Verification', status: 'NON_COMPLETE' }
    ]);

    // Auto-dismiss success toast
    useEffect(() => {
        if (successToast) {
            const timer = setTimeout(() => setSuccessToast(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [successToast]);

    // Reset notified state when context changes
    useEffect(() => {
        setNotified(false);
        setShowProtocolInfo(false);
        setTerminalSteps([
            { id: '01', label: 'System Validation', status: 'OK' },
            { id: '02', label: 'Ledger Pending', status: 'PENDING' },
            { id: '03', label: 'Configuration', status: 'VERIFIED' },
            { id: '04', label: 'Security Verification', status: 'NON_COMPLETE' }
        ]);
    }, [selectedStudentId, selectedCycleId]);

    // --- SUB-COMPONENTS: CINEMATIC FLOW ELEMENTS ---
    const ForensicScanner = () => (
        <div className="absolute inset-0 z-20 pointer-events-none">
            <motion.div
                initial={{ top: "-5%" }}
                animate={{ top: "105%" }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 h-[2px] bg-amber-500/40"
                style={{ boxShadow: '0 0 30px rgba(245, 158, 11, 0.6)' }}
            />
            <motion.div
                initial={{ top: "-15%" }}
                animate={{ top: "95%" }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear", delay: 0.1 }}
                className="absolute left-10 right-10 h-[1px] bg-amber-500/10"
                style={{ boxShadow: '0 0 20px rgba(245, 158, 11, 0.2)' }}
            />
        </div>
    );

    const NodeMap = ({ progress }: { progress: number }) => {
        const nodes = [
            { id: 'enrollment', label: 'Enrollment', description: 'Student registration verified' },
            { id: 'year', label: 'Year Activated', description: 'Academic cycle initialized' },
            { id: 'fee', label: 'Fee Configured', description: 'Grade mapping established' },
            { id: 'ledger', label: 'Ledger Generated', description: 'Institutional ledger created' },
            { id: 'installments', label: 'Installments Created', description: 'Payment schedule defined' },
            { id: 'payments', label: 'Payments Enabled', description: 'Operational state active' }
        ];

        return (
            <div className="relative w-full h-32 mb-12 flex items-center justify-between px-4 md:px-10 mt-6">
                <div className="absolute top-1/2 left-4 md:left-10 right-4 md:right-10 h-[1px] bg-white/5 border-t border-dashed border-white/10 z-0"></div>
                {/* Animated Flow Line */}
                <motion.div
                    className="absolute top-1/2 left-4 md:left-10 h-[2px] bg-gradient-to-r from-amber-600 via-orange-400 to-amber-500 z-10 origin-left shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: progress / 100 }}
                    transition={{ duration: 2.5, ease: "easeInOut" }}
                    style={{ width: 'calc(100% - 80px)' }}
                />

                {nodes.map((node, i) => {
                    const stepThreshold = (i / (nodes.length - 1)) * 100;
                    const isActive = progress >= stepThreshold;
                    const isProcessing = progress > (i - 1) / (nodes.length - 1) * 100 && progress < stepThreshold;

                    return (
                        <div key={node.id} className="relative z-20 flex flex-col items-center group/node">
                            <motion.div
                                animate={isActive ? {
                                    scale: [1, 1.1, 1],
                                    borderColor: ['rgba(245,158,11,0.2)', 'rgba(245,158,11,0.6)', 'rgba(245,158,11,0.2)'],
                                    boxShadow: isActive ? ['0 0 0px rgba(245,158,11,0)', '0 0 20px rgba(245,158,11,0.2)', '0 0 0px rgba(245,158,11,0)'] : []
                                } : {}}
                                transition={{ duration: 4, repeat: Infinity }}
                                className={clsx(
                                    "w-10 h-10 rounded-xl border flex items-center justify-center transition-all duration-1000 backdrop-blur-md cursor-help",
                                    isActive ? "bg-amber-500/10 border-amber-500/50 text-amber-500" :
                                        isProcessing ? "bg-amber-500/5 border-amber-500/30 text-amber-500/50" : "bg-black/60 border-white/5 text-white/5"
                                )}
                            >
                                {isActive ? (
                                    <CheckCircleIcon className="w-4 h-4" />
                                ) : (
                                    <div className="text-[9px] font-black">{String(i + 1).padStart(2, '0')}</div>
                                )}
                            </motion.div>

                            {/* Tooltip on Hover */}
                            <div className="absolute -top-12 opacity-0 group-hover/node:opacity-100 transition-opacity bg-black border border-white/10 p-2 rounded text-[8px] whitespace-nowrap z-50 pointer-events-none">
                                <div className="font-bold text-amber-500 uppercase">{node.label}</div>
                                <div className="text-white/40">{node.description}</div>
                            </div>

                            <div className={clsx(
                                "absolute -bottom-8 w-max text-[7px] font-black uppercase tracking-[0.2em] text-center max-w-[60px] md:max-w-none md:text-[8px]",
                                isActive ? "text-amber-500/60" : "text-white/10"
                            )}>
                                {node.label}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const DataParticles = () => (
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
            {[...Array(15)].map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ x: `${Math.random() * 100}%`, y: "110%", opacity: 0 }}
                    animate={{ y: "-10%", opacity: [0, 0.5, 0] }}
                    transition={{ duration: Math.random() * 10 + 15, repeat: Infinity, ease: "linear", delay: i * 2 }}
                    className="absolute w-px h-12 bg-gradient-to-t from-transparent via-amber-500/20 to-transparent"
                />
            ))}
        </div>
    );

    const TerminalStream = ({ side }: { side: 'left' | 'right' }) => (
        <div className={clsx("absolute top-0 bottom-0 w-8 overflow-hidden pointer-events-none opacity-20 hidden lg:block", side === 'left' ? "left-4" : "right-4")}>
            <motion.div
                animate={{ y: ["-100%", "0%"] }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                className="flex flex-col gap-4"
            >
                {[...Array(20)].map((_, i) => (
                    <div key={i} className="text-[8px] font-mono text-amber-500/40 whitespace-nowrap rotate-90">
                        {Math.random().toString(16).substring(2, 10).toUpperCase()}
                    </div>
                ))}
            </motion.div>
        </div>
    );

    const RegionalRadar = () => (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 pointer-events-none opacity-20">
            {[1, 2, 3].map(i => (
                <motion.div
                    key={i}
                    animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                    transition={{ duration: 4, repeat: Infinity, delay: i * 1.3 }}
                    className="absolute inset-0 border border-amber-500/30 rounded-full"
                />
            ))}
            <div className="absolute inset-0 border border-amber-500/10 rounded-full scale-150 border-dashed"></div>
        </div>
    );

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
            // SECURITY UPGRADE: v3 uses auth.uid() on server for absolute isolation
            const { data, error } = await supabase.rpc('get_parent_linked_students_finance_v3');
            if (error) throw error;
            setStudents(data || []);

            // Auto-select first student if none selected
            if (data && data.length > 0 && !selectedStudentId) {
                setSelectedStudentId(data[0].student_id);
            }
        } catch (err: any) {
            console.error("Error fetching students:", err);
            setError(`Security Connection Status: Records Linkage Isolated`);
        } finally {
            setLoading(false);
        }
    }, [selectedStudentId]);

    const fetchFinanceDetail = useCallback(async () => {
        if (!selectedStudentId || !selectedCycleId) return;
        setLoading(true);
        try {
            const selectedOpt = cycleOptions.find(c => c.id === selectedCycleId);

            if (!selectedOpt?.db_id) {
                setFinanceDetail({
                    summary: { total_billed: 0, total_paid: 0, outstanding: 0, status: 'NOT_GENERATED' },
                    installments: [],
                    breakdown: []
                });
                return;
            }

            // SECURITY UPGRADE: v5 implements 6-step lifecycle architecture
            const { data, error } = await supabase.rpc('get_student_finance_detail_v5', {
                p_student_id: selectedStudentId,
                p_cycle_id: selectedOpt.db_id
            });

            if (error) throw error;

            if (data?.error === '403_ACCESS_FORBIDDEN') {
                setError("Access Denied: Isolation breach attempt detected.");
                setFinanceDetail(null);
                return;
            }

            if (data) {
                setFinanceDetail(data);
            } else {
                setFinanceDetail({
                    summary: { total_billed: 0, total_paid: 0, outstanding: 0, status: 'NOT_GENERATED' },
                    installments: [],
                    breakdown: []
                });
            }
        } finally {
            setLoading(false);
        }
    }, [selectedStudentId, selectedCycleId, cycleOptions]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchFinanceDetail();
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    const handleNotifyAuditor = async () => {
        if (!selectedStudentId) return;
        setIsSubmitting(true);
        setError(null);

        // Phase 1: Visual pulse — show sync in-progress
        setTerminalSteps(prev => prev.map(s => s.id === '01' ? { ...s, status: 'VALIDATING...' } : s));
        await new Promise(r => setTimeout(r, 400));
        setTerminalSteps(prev => prev.map(s => s.id === '02' ? { ...s, status: 'REGISTERING...' } : s));
        await new Promise(r => setTimeout(r, 400));
        setTerminalSteps(prev => prev.map(s => s.id === '03' ? { ...s, status: 'MAPPING...' } : s));
        await new Promise(r => setTimeout(r, 300));
        setTerminalSteps(prev => prev.map(s => s.id === '04' ? { ...s, status: 'SIGNING...' } : s));

        try {
            const { data, error } = await supabase.rpc('automate_finance_lifecycle', {
                p_student_id: selectedStudentId
            });

            if (error) throw error;

            if (data?.success) {
                // Phase 2: Success cascade animation
                setTerminalSteps([
                    { id: '01', label: 'System Validation', status: 'OK' },
                    { id: '02', label: 'Ledger Records', status: 'STABLE' },
                    { id: '03', label: 'Payment Schedule', status: 'VERIFIED' },
                    { id: '04', label: 'Payment Gateway', status: 'SYNC_COMPLETE' }
                ]);
                setNotified(true);
                setSuccessToast(`Finance synchronized! Ledger generated with ${data.total_amount ? '₹' + Number(data.total_amount).toLocaleString('en-IN') : 'fee allocation'}.`);

                // Phase 3: Refresh data to transition from sync view to financial console
                await fetchFinanceDetail();
            } else {
                const readinessError = data?.error || 'UNKNOWN_GAP';
                const friendlyErrors: Record<string, string> = {
                    'YEAR_NOT_ACTIVE': 'No active academic year found. Contact administration.',
                    'FEE_CONFIG_MISSING': 'Fee structure not globalized for this grade. Admin required.',
                    'PAYMENT_PLAN_MISSING': 'Fee components (Tuition/Lab) not defined. Admin required.',
                    'STUDENT_NOT_FOUND': 'Student profile record not found in Bureau.',
                    'STUDENT_PROFILE_NOT_FOUND': 'Student profile record incomplete.',
                    'NO_ACTIVE_ACADEMIC_YEAR': 'Global academic cycle not activated.',
                    'ZERO_FEE_AMOUNT': 'Fee structure exists but ledger sum is ₹0.',
                    'ENROLLMENT_PENDING': 'Student enrollment state is not marked as ACTIVE.'
                };
                setTerminalSteps(prev => prev.map(s => s.id === '04' ? { ...s, status: readinessError } : s));
                setError(friendlyErrors[readinessError] || `Record Update Required: ${readinessError}`);
            }
        } catch (err: any) {
            console.error("Sync error:", err);
            setTerminalSteps(prev => prev.map(s => s.id === '04' ? { ...s, status: 'SEC_FAIL' } : s));
            setError(`Critical Terminal Error: ${err.message || "System server timeout"}`);
        } finally {
            setIsSubmitting(false);
        }
    };

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

    // Helpers for UI Logic (Case-Insensitive, V13 Lifecycle States)
    const lifecycleStatus = financeDetail?.summary?.status?.toUpperCase() || '';
    const isPreview = activeCycle?.status?.toUpperCase() === 'UPCOMING' || lifecycleStatus === 'PREVIEW';
    const isCurrent = (activeCycle?.status?.toUpperCase() === 'CURRENT' || activeCycle?.status?.toUpperCase() === 'ACTIVE') && lifecycleStatus !== 'PREVIEW';
    const isArchived = activeCycle?.status?.toUpperCase() === 'ARCHIVED';
    const isNotConfigured = (
        ['NOT_GENERATED', 'FINANCE_SYNC_REQUIRED', 'ENROLLMENT_PENDING', 'GRADE_MAPPING_MISSING', 'PAYMENT_PLAN_MISSING', 'YEAR_NOT_ACTIVE', 'LEDGER_GENERATED'].includes(lifecycleStatus)
    ) && (!financeDetail?.installments || financeDetail.installments.length === 0);
    const isPaymentsEnabled = lifecycleStatus === 'PAYMENTS_ENABLED';

    // Status Badge Helpers
    const getStatusColor = (status: string) => {
        const s = status?.toUpperCase();
        switch (s) {
            case 'CURRENT':
            case 'ACTIVE': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            case 'UPCOMING': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
            case 'ARCHIVED': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            default: return 'text-white/40 bg-white/5 border-white/10';
        }
    };

    return (
        <div className="max-w-7xl mx-auto pb-32 px-4 space-y-6 animate-in fade-in duration-700 font-sans">
            {/* SUCCESS TOAST */}
            <AnimatePresence>
                {successToast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        className="fixed top-6 right-6 z-[100] max-w-sm"
                    >
                        <div className="bg-emerald-500/20 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3 shadow-2xl shadow-emerald-500/10">
                            <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400 mt-0.5">
                                <CheckCircleIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">System Event</div>
                                <div className="text-sm text-emerald-100 leading-snug">{successToast}</div>
                            </div>
                            <button onClick={() => setSuccessToast(null)} className="text-white/30 hover:text-white/60 transition-colors">
                                <XIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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

                    {/* Finance Status Roadmap */}
                    <div className="relative bg-[#111827]/40 backdrop-blur-md border border-white/5 rounded-2xl p-6 md:p-8 overflow-hidden shadow-2xl group/timeline">
                        {/* Scanning Light Effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/5 to-transparent -translate-x-full group-hover/timeline:translate-x-full transition-transform duration-[3000ms] ease-in-out"></div>

                        <div className="flex items-center justify-between min-w-[700px] relative">
                            {/* Base Trace Line */}
                            <div className="absolute top-[15px] left-0 w-full h-[1px] bg-white/5 z-0"></div>

                            {/* Active Data Flow Line */}
                            <div
                                className="absolute top-[14px] left-0 h-[3px] bg-gradient-to-r from-emerald-500 via-purple-500 to-indigo-500 z-0 transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                style={{
                                    width: !isNotConfigured ? (isCurrent ? '100%' : '50%') : (isCurrent || isPreview ? '25%' : '0%'),
                                    opacity: 0.8
                                }}
                            ></div>

                            {[
                                { label: 'Enrollment', status: 'completed', icon: <CheckCircleIcon />, desc: 'Record Verified' },
                                { label: 'Year Activated', status: isCurrent || isPreview ? 'completed' : 'pending', icon: <ClockIcon />, desc: isCurrent ? 'Active Cycle' : 'Scheduled' },
                                { label: 'Fee Configured', status: !isNotConfigured ? 'completed' : 'pending', icon: <DocumentTextIcon />, desc: !isNotConfigured ? 'Validated' : 'Queued' },
                                { label: 'Ledger Generated', status: isCurrent && !isNotConfigured ? 'completed' : 'pending', icon: <UploadIcon />, desc: isCurrent && !isNotConfigured ? 'Immutable' : 'Locked' },
                                { label: 'Payments Enabled', status: isCurrent && !isNotConfigured ? 'active' : 'pending', icon: <CreditCardIcon />, desc: isCurrent && !isNotConfigured ? 'Live' : 'Encrypted' },
                            ].map((step, idx) => (
                                <div key={idx} className="flex flex-col items-center gap-3 relative z-10 w-32 group/node">
                                    {/* Connection Point (Node) */}
                                    <div className={clsx(
                                        "w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-700 relative",
                                        step.status === 'completed' ? "bg-[#064e3b] border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] text-emerald-400" :
                                            step.status === 'active' ? "bg-indigo-900 border-indigo-400 text-indigo-200 animate-pulse shadow-[0_0_15px_rgba(129,140,248,0.5)]" :
                                                "bg-[#0f172a] border-white/10 text-white/10"
                                    )}>
                                        {/* Dynamic Glow for Active/Completed */}
                                        {(step.status === 'completed' || step.status === 'active') && (
                                            <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-current"></div>
                                        )}
                                        {React.cloneElement(step.icon as React.ReactElement, { className: "w-4 h-4" } as any)}
                                    </div>

                                    {/* Meta Labels */}
                                    <div className="text-center">
                                        <div className={clsx(
                                            "text-[10px] font-black uppercase tracking-widest transition-colors mb-0.5",
                                            step.status === 'completed' || step.status === 'active' ? "text-white" : "text-white/20"
                                        )}>
                                            {step.label}
                                        </div>
                                        <div className={clsx(
                                            "text-[7px] font-bold uppercase tracking-[0.2em] opacity-40 group-hover/node:opacity-100 transition-opacity",
                                            step.status === 'completed' ? "text-emerald-400" : step.status === 'active' ? "text-indigo-400" : "text-white/20"
                                        )}>
                                            {step.desc}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* C. FINANCIAL HIERARCHY GRID */}
                    {/* STATE-BASED UI: EXECUTIVE-GRADE PENDING BOARD */}
                    {isNotConfigured ? (
                        <div className="relative group max-w-3xl mx-auto mt-12">
                            {/* Cinematic Background Glow */}
                            <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 via-transparent to-amber-500/20 rounded-3xl blur-xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>

                            <div className="relative bg-[#0f172a]/80 backdrop-blur-3xl border border-white/5 rounded-3xl p-8 md:p-14 overflow-hidden shadow-2xl">
                                {/* Forensic Scanning & Depth */}
                                <DataParticles />
                                <ForensicScanner />
                                <TerminalStream side="left" />
                                <TerminalStream side="right" />

                                {/* Decorative Grid Pattern */}
                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

                                {/* Corner Accents */}
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-amber-500/20 rounded-tl-3xl"></div>
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-amber-500/20 rounded-tr-3xl"></div>
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-amber-500/20 rounded-bl-3xl"></div>
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-amber-500/20 rounded-br-3xl"></div>

                                <div className="flex flex-col items-center relative z-10 text-center">
                                    {/* Pulsing Icon Shield */}
                                    <div className="relative mb-8">
                                        <div className="absolute -inset-4 bg-amber-500/10 rounded-full animate-ping"></div>
                                        <div className="w-24 h-24 bg-gradient-to-br from-amber-500/20 to-orange-500/10 rounded-2xl flex items-center justify-center border border-amber-500/30 shadow-inner group-hover:scale-110 transition-transform duration-700">
                                            <ShieldAlertIcon className="w-12 h-12 text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
                                        </div>
                                    </div>

                                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">
                                        Finance Activation <span className="text-amber-500">Workflow</span>
                                    </h3>

                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-amber-500"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${financeDetail?.summary?.sync_progress || 25}%` }}
                                                transition={{ duration: 2 }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-black text-amber-500/60 uppercase tracking-widest leading-none">
                                            {financeDetail?.summary?.sync_progress || 25}% Verified Match
                                        </span>
                                    </div>

                                    <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-xl mx-auto mb-8">
                                        <span className="block font-bold text-white/90">
                                            Record for <span className="text-amber-500">{selectedStudent?.display_name}</span> is currently being processed.
                                        </span>
                                    </p>

                                    {/* Elevated Enrollment Context Card */}
                                    <div className="w-full max-w-lg mb-8 group/context relative">
                                        <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 to-orange-500/10 rounded-2xl blur opacity-10 group-hover/context:opacity-30 transition-opacity"></div>
                                        <div className="relative bg-white/[0.03] border border-white/5 rounded-2xl p-6 flex flex-col gap-4 transition-all hover:bg-white/[0.06] hover:border-white/10 overflow-hidden">
                                            {/* Regional Radar Visualizer */}
                                            <RegionalRadar />

                                            <div className="flex items-center justify-between relative z-10">
                                                <div className="flex items-center gap-4 text-left">
                                                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center relative shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                                                        <ShieldCheckIcon className="w-7 h-7 text-emerald-500 relative z-10" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <div className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em]">FEE MAPPING INTELLIGENCE NODE</div>
                                                            <div className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-[8px] font-black text-indigo-500 uppercase">{financeDetail?.summary?.branch?.code || 'CIS'}</div>
                                                        </div>
                                                        <div className="text-2xl font-black text-white leading-tight uppercase tracking-tighter">
                                                            {financeDetail?.summary?.branch?.name || selectedStudent?.branch_name || 'H.Q. Institutional Center'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="hidden sm:block text-right">
                                                    <div className="text-[9px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/5 px-4 py-2 rounded-xl border border-amber-500/10 shadow-lg">
                                                        NON-ACTIVE
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-8 w-full max-w-lg mb-4 px-2">
                                                <div className="text-left py-4 border-l-2 border-white/5 pl-4 group-hover/context:border-amber-500/20 transition-colors">
                                                    <div className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Grade Level</div>
                                                    <div className="text-sm font-bold text-white tracking-tight">
                                                        Class {financeDetail?.summary?.grade || selectedStudent?.grade || 'N/A'} — Enrolled
                                                    </div>
                                                </div>
                                                <div className="text-right py-4 border-r-2 border-white/5 pr-4 group-hover/context:border-amber-500/20 transition-colors">
                                                    <div className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Academic Cycle</div>
                                                    <div className="text-sm font-bold text-slate-300">
                                                        {financeDetail?.summary?.academic_period || activeCycle?.year_name || '2025-2026'}
                                                    </div>
                                                </div>
                                            </div>

                                            {financeDetail?.summary?.branch?.address && (
                                                <div className="pt-3 border-t border-white/5 flex items-start gap-2 text-left">
                                                    <div className="text-[8px] font-black text-white/20 uppercase tracking-widest mt-1">Locality:</div>
                                                    <div className="text-[10px] text-white/40 leading-tight">
                                                        {financeDetail.summary.branch.address}, {financeDetail.summary.branch.city}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 4. DYNAMIC NODE TOPOLOGY MAP */}
                                    <NodeMap progress={financeDetail?.summary?.sync_progress || 25} />

                                    <div className="w-full max-w-lg text-center mt-4">
                                        <p className="text-white/40 italic text-[11px] md:text-sm mx-auto mb-2 opacity-60">
                                            The configuration for the {activeCycle?.year_name} cycle has been initialized but requires final administrative authentication point at <span className="text-white/60">{financeDetail?.summary?.branch?.name || 'the primary branch'}</span>.
                                        </p>
                                    </div>

                                    {/* CINEMATIC FLOW ACTION AREA */}
                                    <div className="mt-8 flex flex-col sm:flex-row gap-5 w-full justify-center relative z-20">
                                        <button
                                            onClick={() => setShowProtocolInfo(!showProtocolInfo)}
                                            className="flex-1 max-w-[200px] px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white/60 hover:text-white transition-all transform active:scale-95 flex items-center justify-center gap-3 group/btn"
                                        >
                                            <InfoIcon className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" />
                                            {showProtocolInfo ? 'Close Audit' : 'Audit Protocol'}
                                        </button>

                                        <div className="relative flex-1 max-w-[200px]">
                                            {isTransmitting && (
                                                <div className="absolute inset-0 z-0">
                                                    <div className="absolute inset-0 bg-emerald-500/20 rounded-2xl animate-ping"></div>
                                                    <div className="absolute inset-0 bg-emerald-500/10 rounded-2xl animate-ping" style={{ animationDelay: '500ms' }}></div>
                                                </div>
                                            )}
                                            <button
                                                onClick={async () => {
                                                    setIsTransmitting(true);
                                                    await handleNotifyAuditor();
                                                    setTimeout(() => setIsTransmitting(false), 3000);
                                                }}
                                                disabled={notified || isSubmitting}
                                                className={clsx(
                                                    "w-full px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all transform active:scale-95 flex items-center justify-center gap-3 shadow-2xl relative z-10 font-bold",
                                                    notified ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                                                )}
                                            >
                                                {isSubmitting ? <Spinner size="sm" /> : notified ? <ShieldCheckIcon className="w-4 h-4" /> : <LockIcon className="w-4 h-4" />}
                                                {notified ? 'VERIFIED NOTIFY' : 'AUTHENTICATE NODE'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Protocol Info Modal/Expanded Area */}
                                    <AnimatePresence>
                                        {showProtocolInfo && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="mt-8 p-6 bg-[#0a0a0b] border border-amber-500/20 rounded-2xl text-left max-w-xl relative"
                                            >
                                                <div className="absolute top-0 right-0 p-4 opacity-5">
                                                    <ShieldAlertIcon className="w-20 h-20 text-amber-500" />
                                                </div>
                                                <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <InfoIcon className="w-4 h-4" />
                                                    Synchronization Protocol
                                                </h4>
                                                <ul className="space-y-3 text-[11px] text-white/60 leading-relaxed relative z-10">
                                                    {[
                                                        { id: '01', text: 'Verification of student enrollment block on the regional ledger.' },
                                                        { id: '02', text: 'Administrative audit of grade-wise fee components (Tuition, Lab).' },
                                                        { id: '03', text: 'Final cryptographic signature by the Institutional Auditor.' }
                                                    ].map((item, idx) => (
                                                        <motion.li
                                                            key={item.id}
                                                            initial={{ opacity: 0, x: -10 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: idx * 0.15 }}
                                                            className="flex gap-3 items-start"
                                                        >
                                                            <span className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[9px] font-black text-amber-500 shrink-0">{item.id}</span>
                                                            <span className="pt-0.5">{item.text}</span>
                                                        </motion.li>
                                                    ))}
                                                </ul>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* TERMINAL ENHANCEMENT */}
                                    <div className="mt-12 w-full max-w-lg relative group/term">
                                        <div className="absolute -inset-0.5 bg-white/5 rounded-2xl blur-sm opacity-50"></div>
                                        <div className="relative bg-[#0a0a0b] rounded-2xl p-5 border border-white/10 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                                            <div className="flex items-center justify-between mb-5 border-b border-white/5 pb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex gap-1.5">
                                                        <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
                                                        <div className="w-2 h-2 rounded-full bg-amber-500/50"></div>
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500/50"></div>
                                                    </div>
                                                    <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">Finance Isolation Terminal</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                                    <span className="text-[9px] font-black text-emerald-500 uppercase">Live</span>
                                                </div>
                                            </div>

                                            <div className="space-y-4 font-mono">
                                                {terminalSteps.map((step) => (
                                                    <div key={step.id} className="flex items-center justify-between text-[11px] group/line cursor-default">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-white/10">{step.id}.</span>
                                                            <span className="text-white/40 tracking-tight group-hover/line:text-white/60 transition-colors uppercase">{step.label}</span>
                                                        </div>
                                                        <span className={clsx(
                                                            "font-black tracking-[0.1em]",
                                                            step.status === 'OK' || step.status === 'STABLE' || step.status === 'VERIFIED' || step.status === 'SYNC_COMPLETE' ? "text-emerald-500" :
                                                                step.status === 'WAITING' || step.status.includes('...') ? "text-amber-500 animate-pulse" : "text-red-500"
                                                        )}>
                                                            {step.status}
                                                        </span>
                                                    </div>
                                                ))}

                                                <div className="pt-4 border-t border-white/5 mt-4 flex items-center justify-between">
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Active Subsystem</span>
                                                        <span className="text-xs font-black text-amber-500 uppercase tracking-[0.2em]">{(financeDetail?.summary?.sync_phase || (isSubmitting ? 'SYNCHRONIZING' : 'VERIFICATION'))}</span>
                                                    </div>
                                                    <button className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[9px] font-black uppercase rounded-md hover:bg-amber-500/20 transition-all">
                                                        Verify Tracker
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* BOTTOM STATUS GRID */}
                                    <div className="mt-12 w-full max-w-lg grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {[
                                            { label: 'Inst. Plan', value: '2025-26 | PRI', color: 'text-blue-400' },
                                            { label: 'Verification', value: 'NON-SYNC', color: 'text-amber-400' },
                                            { label: 'Auditor', value: 'MD-572', color: 'text-emerald-400' },
                                            { label: 'Audit Cert', value: 'NO-SIGN', color: 'text-red-400' }
                                        ].map((box, i) => (
                                            <div key={i} className="bg-white/[0.02] border border-white/5 p-3 rounded-xl flex flex-col items-center">
                                                <div className="text-[7px] font-black text-white/20 uppercase tracking-widest mb-1">{box.label}</div>
                                                <div className={clsx("text-[9px] font-black uppercase", box.color)}>{box.value}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Digital Signature Anchor */}
                                    <div className="mt-12 flex flex-col items-center opacity-20">
                                        <div className="text-[7px] font-black text-white/40 uppercase tracking-[0.4em] mb-2">Institutional Digital Signature</div>
                                        <div className="flex gap-2 items-center">
                                            <div className="w-12 h-[1px] bg-white/20"></div>
                                            <div className="text-[9px] font-serif italic text-white/60">G-OS/Core_Finance_Node</div>
                                            <div className="w-12 h-[1px] bg-white/20"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
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
                                            </div>
                                        </>
                                    ) : (
                                        /* ACTIVE MODE CONTENT */
                                        metrics.outstanding > 0 ? (
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
                                        )
                                    )}
                                </div>

                                {/* 2. TOTAL FEES & PAID */}
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
                                    <div className="flex items-center justify-between px-2">
                                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Installment Schedule</h3>
                                        <div className="px-2 py-1 bg-white/5 rounded border border-white/10 text-[9px] font-bold text-white/30">
                                            {financeDetail?.installments?.length || 0} TERMS
                                        </div>
                                    </div>

                                    <div className="bg-[#1f2937]/30 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-white/5 border-b border-white/5">
                                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40">Term / Description</th>
                                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40 whitespace-nowrap">Due Date</th>
                                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40">Amount</th>
                                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40">Status</th>
                                                    <th className="px-6 py-4 text-right"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {financeDetail?.installments?.map((inst: any) => (
                                                    <tr key={inst.id} className="hover:bg-white/[0.02] transition-colors group">
                                                        <td className="px-6 py-5">
                                                            <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{inst.title}</div>
                                                            <div className="text-[10px] text-white/30 uppercase tracking-tighter mt-0.5">Academic Installment</div>
                                                        </td>
                                                        <td className="px-6 py-5">
                                                            <div className="text-xs font-medium text-white/60">
                                                                {new Date(inst.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-5">
                                                            <div className="text-sm font-black text-white">{formatCurrency(inst.amount)}</div>
                                                            {inst.paid > 0 && <div className="text-[10px] text-emerald-500/60 mt-0.5 font-bold uppercase tracking-tighter">Paid: {formatCurrency(inst.paid)}</div>}
                                                        </td>
                                                        <td className="px-6 py-5">
                                                            <div className={clsx(
                                                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                                                inst.status === 'paid' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                                    inst.is_overdue && !isPreview ? "bg-red-500/10 text-red-500 border-red-500/20 animate-pulse" :
                                                                        "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                                            )}>
                                                                <span className={clsx("w-1 h-1 rounded-full", inst.status === 'paid' ? "bg-emerald-500" : inst.is_overdue && !isPreview ? "bg-red-500" : "bg-blue-500")}></span>
                                                                {inst.status}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-5 text-right">
                                                            {inst.status !== 'paid' && isCurrent && (
                                                                <button
                                                                    onClick={() => handlePayNow([inst.id])}
                                                                    className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider rounded border border-white/10 transition-all active:scale-95"
                                                                >
                                                                    Pay
                                                                </button>
                                                            )}
                                                            {inst.status === 'paid' && <CheckCircleIcon className="w-5 h-5 text-emerald-500/50 ml-auto" />}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {(!financeDetail?.installments || financeDetail.installments.length === 0) && (
                                                    <tr>
                                                        <td colSpan={5} className="px-6 py-12 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <DocumentTextIcon className="w-8 h-8 text-white/10 mb-2" />
                                                                <div className="text-sm font-bold text-white/20 uppercase tracking-widest">No Installments Found</div>
                                                                <div className="text-[10px] text-white/10 mt-1">Finance Setup Pending – School Admin Action Required</div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* FEE BREAKDOWN (1/3 width) */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-2">
                                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Full Fee Breakdown</h3>
                                        <button
                                            onClick={() => setIsFeeBreakdownOpen(!isFeeBreakdownOpen)}
                                            className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest"
                                        >
                                            {isFeeBreakdownOpen ? 'Hide' : 'Show All'}
                                        </button>
                                    </div>

                                    <div className="bg-[#1f2937]/30 border border-white/5 rounded-2xl p-6 shadow-xl">
                                        <div className="space-y-4">
                                            {financeDetail?.breakdown?.slice(0, isFeeBreakdownOpen ? 100 : 4).map((item: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/40 group-hover:bg-indigo-500 transition-colors"></div>
                                                        <div>
                                                            <div className="text-xs font-bold text-white/80 uppercase tracking-tight">{item.name}</div>
                                                            <div className="text-[9px] text-white/20 uppercase tracking-widest">{item.type || 'Academic Fee'}</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-sm font-black text-white/60">{formatCurrency(item.amount)}</div>
                                                </div>
                                            ))}
                                            {!isFeeBreakdownOpen && financeDetail?.breakdown?.length > 4 && (
                                                <button
                                                    onClick={() => setIsFeeBreakdownOpen(true)}
                                                    className="w-full py-2 mt-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[9px] font-black text-white/30 uppercase tracking-[0.2em] transition-all"
                                                >
                                                    + {financeDetail.breakdown.length - 4} More Components
                                                </button>
                                            )}
                                            {(!financeDetail?.breakdown || financeDetail.breakdown.length === 0) && (
                                                <div className="text-center py-4 text-[10px] font-bold text-white/20 uppercase tracking-widest">
                                                    No Components Loaded
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-8 pt-6 border-t border-white/5">
                                            <div className="flex items-center justify-between text-white/40 mb-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest">Total Valuation</span>
                                                <span className="text-xs font-bold">{formatCurrency(metrics.totalFees)}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-emerald-400">
                                                <span className="text-[10px] font-black uppercase tracking-widest">Total Verified</span>
                                                <span className="text-xs font-black">{formatCurrency(metrics.totalPaid)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Download Receipt Block */}
                                    <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
                                                    <DocumentTextIcon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-black text-white uppercase tracking-widest">Transaction Ledger</div>
                                                    <div className="text-[10px] text-white/30 mt-0.5">Verified Records</div>
                                                </div>
                                            </div>
                                            <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 text-[9px] font-bold text-white/40 uppercase">
                                                Live History
                                            </div>
                                        </div>

                                        <div className="space-y-3 mt-2">
                                            {financeDetail?.installments?.filter((i: any) => i.paid > 0).map((i: any) => (
                                                <div key={`txn-${i.id}`} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5 group hover:border-emerald-500/20 transition-all">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-500"><CheckCircleIcon className="w-3 h-3" /></div>
                                                        <div>
                                                            <div className="text-[10px] font-bold text-white uppercase">{i.title} Settlement</div>
                                                            <div className="text-[8px] text-white/30 uppercase mt-0.5">REF: TXN-{i.id.substring(0, 8).toUpperCase()}</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xs font-black text-emerald-400">{formatCurrency(i.paid)}</div>
                                                        <div className="text-[8px] text-white/20 uppercase">Receipt Generated</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!financeDetail?.installments?.some((i: any) => i.paid > 0)) && (
                                                <div className="text-center py-6 border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
                                                    <div className="text-[10px] font-bold text-white/10 uppercase tracking-[0.2em]">No Transactions Recorded</div>
                                                </div>
                                            )}
                                        </div>

                                        <button className="w-full py-3 mt-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-xl text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 group">
                                            <DownloadIcon className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                                            Download Consolidated Receipt
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* F. MANUAL PAYMENT MODAL (Executive Grade) */}
                    <AnimatePresence>
                        {isUploadModalOpen && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setIsUploadModalOpen(false)}>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                    onClick={e => e.stopPropagation()}
                                    className="bg-[#111827] w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                                >
                                    {/* Header */}
                                    <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-emerald-500/5 to-transparent">
                                        <div>
                                            <h3 className="text-lg font-black text-white uppercase tracking-tight">Payment Submission</h3>
                                            <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-0.5">Manual Receipt Upload · Secure Channel</div>
                                        </div>
                                        <button onClick={() => setIsUploadModalOpen(false)} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                                            <XIcon className="w-5 h-5 text-white/50" />
                                        </button>
                                    </div>

                                    {/* Selected Installments Badge */}
                                    {selectedInstallments.length > 0 && (
                                        <div className="px-6 pt-4">
                                            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 flex items-center gap-3">
                                                <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400"><DocumentTextIcon className="w-4 h-4" /></div>
                                                <div className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                                                    {selectedInstallments.length} Installment{selectedInstallments.length > 1 ? 's' : ''} Selected for Settlement
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="p-6 space-y-5">
                                        {/* Amount Field */}
                                        <div>
                                            <label className="text-[10px] uppercase font-black text-white/40 tracking-widest mb-1.5 block">Payment Amount (₹)</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 font-bold text-sm">₹</span>
                                                <input
                                                    type="number"
                                                    placeholder="0.00"
                                                    value={uploadData.amount}
                                                    onChange={e => setUploadData({ ...uploadData, amount: e.target.value })}
                                                    className="w-full bg-black/30 border border-white/10 rounded-xl pl-8 pr-4 py-3.5 text-white text-lg font-bold focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder:text-white/10"
                                                />
                                            </div>
                                        </div>

                                        {/* Payment Mode & Date - Side by side */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] uppercase font-black text-white/40 tracking-widest mb-1.5 block">Payment Mode</label>
                                                <select
                                                    value={uploadData.mode}
                                                    onChange={e => setUploadData({ ...uploadData, mode: e.target.value })}
                                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
                                                >
                                                    <option value="NEFT" className="bg-[#111827]">NEFT / RTGS</option>
                                                    <option value="UPI" className="bg-[#111827]">UPI Transfer</option>
                                                    <option value="CARD" className="bg-[#111827]">Card Payment</option>
                                                    <option value="CASH" className="bg-[#111827]">Cash Deposit</option>
                                                    <option value="CHEQUE" className="bg-[#111827]">Cheque / DD</option>
                                                    <option value="WALLET" className="bg-[#111827]">Digital Wallet</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase font-black text-white/40 tracking-widest mb-1.5 block">Payment Date</label>
                                                <input
                                                    type="date"
                                                    value={uploadData.date}
                                                    onChange={e => setUploadData({ ...uploadData, date: e.target.value })}
                                                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-emerald-500/50 transition-all"
                                                />
                                            </div>
                                        </div>

                                        {/* UTR / Reference */}
                                        <div>
                                            <label className="text-[10px] uppercase font-black text-white/40 tracking-widest mb-1.5 block">UTR / Transaction Reference</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. UTR123456789"
                                                value={uploadData.ref}
                                                onChange={e => setUploadData({ ...uploadData, ref: e.target.value })}
                                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-white/10"
                                            />
                                        </div>

                                        {/* File Upload */}
                                        <div>
                                            <label className="text-[10px] uppercase font-black text-white/40 tracking-widest mb-1.5 block">Payment Proof (Receipt / Screenshot)</label>
                                            <div className="relative">
                                                <input
                                                    type="file"
                                                    accept="image/*,.pdf"
                                                    onChange={e => {
                                                        if (e.target.files) setUploadFile(e.target.files[0]);
                                                    }}
                                                    className="hidden"
                                                    id="payment-proof-upload"
                                                />
                                                <label
                                                    htmlFor="payment-proof-upload"
                                                    className="flex items-center justify-center gap-3 w-full py-4 bg-black/20 border-2 border-dashed border-white/10 hover:border-emerald-500/30 rounded-xl cursor-pointer transition-all group"
                                                >
                                                    {uploadFile ? (
                                                        <div className="flex items-center gap-3">
                                                            <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                                                            <span className="text-sm text-emerald-300 font-medium">{uploadFile.name}</span>
                                                            <button onClick={(e) => { e.preventDefault(); setUploadFile(null); }} className="text-red-400 hover:text-red-300 ml-2">
                                                                <XIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <UploadIcon className="w-5 h-5 text-white/20 group-hover:text-emerald-500/50 transition-colors" />
                                                            <span className="text-sm text-white/30 group-hover:text-white/50 transition-colors">Click to upload proof</span>
                                                        </>
                                                    )}
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer Actions */}
                                    <div className="p-5 border-t border-white/5 flex items-center justify-between bg-white/[0.01]">
                                        <div className="text-[9px] text-white/20 font-bold uppercase tracking-widest">Encrypted Submission · AES-256</div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => { setIsUploadModalOpen(false); setUploadFile(null); setSelectedInstallments([]); }}
                                                className="px-5 py-2.5 text-white/60 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors rounded-xl hover:bg-white/5"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (!selectedStudentId || !uploadData.amount || parseFloat(uploadData.amount) <= 0) {
                                                        setError('Please enter a valid payment amount.');
                                                        return;
                                                    }
                                                    setIsSubmitting(true);
                                                    setError(null);
                                                    try {
                                                        let proofUrl = '';

                                                        // Upload proof if file selected
                                                        if (uploadFile) {
                                                            const fileName = `receipts/${selectedStudentId}/${Date.now()}_${uploadFile.name}`;
                                                            const { data: up, error: upErr } = await supabase.storage.from('secure-documents').upload(fileName, uploadFile);
                                                            if (upErr && process.env.NODE_ENV !== 'development') throw upErr;
                                                            proofUrl = up ? supabase.storage.from('secure-documents').getPublicUrl(fileName).data.publicUrl : '';
                                                        }

                                                        // Submit payment via RPC
                                                        const { data: result, error: rpcErr } = await supabase.rpc('submit_manual_payment_receipt', {
                                                            p_student_id: selectedStudentId,
                                                            p_amount: parseFloat(uploadData.amount),
                                                            p_transaction_date: uploadData.date,
                                                            p_transaction_ref: uploadData.ref,
                                                            p_payment_mode: uploadData.mode,
                                                            p_proof_url: proofUrl,
                                                            p_invoice_ids: selectedInstallments
                                                        });

                                                        if (rpcErr) throw rpcErr;

                                                        if (result?.success) {
                                                            setSuccessToast(`Payment of ₹${parseFloat(uploadData.amount).toLocaleString('en-IN')} submitted successfully! ${result.allocated ? `₹${Number(result.allocated).toLocaleString('en-IN')} auto-allocated.` : ''}`);
                                                        } else {
                                                            setSuccessToast('Payment submitted for verification.');
                                                        }

                                                        setIsUploadModalOpen(false);
                                                        setUploadFile(null);
                                                        setSelectedInstallments([]);
                                                        setUploadData({ amount: '', date: new Date().toISOString().split('T')[0], mode: 'NEFT', ref: '' });
                                                        fetchFinanceDetail();
                                                    } catch (e: any) {
                                                        console.error('Payment submission error:', e);
                                                        setError(`Payment Error: ${e.message || 'Submission failed'}`);
                                                    } finally {
                                                        setIsSubmitting(false);
                                                    }
                                                }}
                                                disabled={isSubmitting || !uploadData.amount}
                                                className={clsx(
                                                    "px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-2 transition-all transform active:scale-95",
                                                    !uploadData.amount || isSubmitting
                                                        ? "bg-white/5 text-white/20 cursor-not-allowed border border-white/5"
                                                        : "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-black shadow-emerald-500/20"
                                                )}
                                            >
                                                {isSubmitting ? <Spinner size="sm" className="text-black" /> : <CreditCardIcon className="w-4 h-4" />}
                                                {isSubmitting ? 'Processing...' : 'Submit Payment'}
                                            </button>
                                        </div>
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
