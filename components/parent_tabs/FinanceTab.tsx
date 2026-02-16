import React, { useState, useEffect, useCallback } from 'react';
import { supabase, formatError } from '../../services/supabase';
import { UserProfile } from '../../types';
import Spinner from '../common/Spinner';
import { CreditCardIcon } from '../icons/CreditCardIcon';
import { TrendingUpCustomIcon } from '../icons/TrendingUpIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { RefreshIcon } from '../icons/RefreshIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { XIcon } from '../icons/XIcon';
import { DocumentTextIcon } from '../icons/DocumentTextIcon';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

interface FinanceTabProps {
    profile: UserProfile;
    initialStudentId?: string | null;
}

const FinanceTab: React.FC<FinanceTabProps> = ({ profile }) => {
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<any[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [financeDetail, setFinanceDetail] = useState<any>(null);
    const [activeCycle, setActiveCycle] = useState<number | null>(null);
    const [financeError, setFinanceError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filter/Menu States
    const [allCycles, setAllCycles] = useState<any[]>([]);
    const [isCycleMenuOpen, setIsCycleMenuOpen] = useState(false);

    // Manual Payment Modal State
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadData, setUploadData] = useState({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        mode: 'NEFT',
        ref: ''
    });

    // Multi-Select Payment State
    const [selectedInstallments, setSelectedInstallments] = useState<string[]>([]);

    useEffect(() => {
        // Reset selection when student/cycle changes
        setSelectedInstallments([]);
    }, [selectedStudentId, activeCycle]);

    // --- Data Fetching ---

    const fetchCycles = useCallback(async () => {
        const { data } = await supabase.from('academic_years').select('id, year_name, is_current').order('start_date', { ascending: false });
        if (data) setAllCycles(data);
    }, []);

    const fetchStudents = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_parent_linked_students_finance_v2', {
                p_parent_id: profile.id
            });
            if (error) throw error;

            setStudents(data || []);
            if (data && data.length > 0 && !selectedStudentId) {
                // Ensure we select the first student by default
                setSelectedStudentId(data[0].student_id);
            }
        } catch (err: any) {
            setError(formatError(err));
        } finally {
            setLoading(false);
        }
    }, [profile.id, selectedStudentId]);

    const fetchFinanceDetail = useCallback(async () => {
        if (!selectedStudentId) return;
        try {
            // Updated to v3 for detailed breakdown and cycle isolation
            const { data, error } = await supabase.rpc('get_student_finance_detail_v3', {
                p_student_id: selectedStudentId,
                p_cycle_id: activeCycle
            });

            if (error) throw error;
            setFinanceDetail(data);
            if (!activeCycle && data.cycle_id) setActiveCycle(data.cycle_id);
        } catch (err: any) {
            console.error("Fetch Detail Error:", err);
        }
    }, [selectedStudentId, activeCycle]);

    useEffect(() => {
        fetchCycles();
        fetchStudents();
    }, [fetchCycles, fetchStudents]);

    useEffect(() => {
        if (selectedStudentId) fetchFinanceDetail();
    }, [selectedStudentId, activeCycle, fetchFinanceDetail]);

    // --- Handlers ---

    const handlePayNow = async (invoiceIds: string[]) => {
        if (!selectedStudentId || invoiceIds.length === 0) return;

        setIsPaymentProcessing(true);
        const totalAmount = financeDetail.installments
            .filter((i: any) => invoiceIds.includes(i.id))
            .reduce((sum: number, i: any) => sum + (i.amount - i.paid), 0);

        try {
            // 1. Mock Enrollment / Intent
            const { data: intent, error: intentError } = await supabase.rpc('initiate_parent_payment', {
                p_student_id: selectedStudentId,
                p_amount: totalAmount,
                p_invoice_ids: invoiceIds
            });
            if (intentError) throw intentError;

            // 2. Simulate User Journey
            await new Promise(r => setTimeout(r, 2000));

            // 3. Mock Webhook Confirmation
            const { error: hookError } = await supabase.rpc('process_payment_success', {
                p_payment_id: intent.payment_id,
                p_transaction_ref: 'PAY' + Math.floor(Math.random() * 1000000)
            });
            if (hookError) throw hookError;

            await fetchFinanceDetail();
            alert('Institutional Payment Successful!');
        } catch (err: any) {
            alert('Gateway Error: ' + err.message);
        } finally {
            setIsPaymentProcessing(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploadFile(e.target.files[0]);
        }
    };

    const handleManualSubmit = async () => {
        if (!selectedStudentId || !uploadFile || !uploadData.amount || !uploadData.ref) {
            alert('Incomplete Submission: Please provide all transaction details and the receipt file.');
            return;
        }

        setIsSubmitting(true);
        try {
            const fileExt = uploadFile.name.split('.').pop();
            const fileName = `${selectedStudentId}/${Date.now()}.${fileExt}`;
            const filePath = `receipts/${fileName}`;

            const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, uploadFile);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);

            const { error: dbError } = await supabase.rpc('submit_manual_payment_receipt', {
                p_student_id: selectedStudentId,
                p_amount: parseFloat(uploadData.amount),
                p_transaction_date: uploadData.date,
                p_transaction_ref: uploadData.ref,
                p_payment_mode: uploadData.mode,
                p_proof_url: publicUrl,
                p_invoice_ids: []
            });

            if (dbError) throw dbError;

            alert('Manual Transaction Logged: Verification in progress.');
            setIsUploadModalOpen(false);
            setUploadFile(null);
            setUploadData({ ...uploadData, amount: '', ref: '' });
            fetchFinanceDetail();
        } catch (err: any) {
            alert('Submission Failed: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Helper for Currency ---
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
    };

    if (loading && students.length === 0) return (
        <div className="flex flex-col justify-center items-center h-[60vh] gap-4">
            <Spinner />
            <span className="text-white/40 text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">Decrypting Financial Ledger</span>
        </div>
    );

    const activeStudent = students.find(s => s.student_id === selectedStudentId);

    return (
        <div className="max-w-[1400px] mx-auto pb-20 px-4 md:px-8 space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">

            {/* 1. Header & Student Switcher */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8">
                <div>
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 mb-4"
                    >
                        <div className="w-12 h-[1px] bg-emerald-500/50"></div>
                        <span className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.5em] drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">Financial Intelligence Hub</span>
                    </motion.div>
                    <h1 className="text-5xl md:text-7xl font-serif font-black text-white tracking-tighter leading-none mb-2">
                        TUITION & <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">FEES.</span>
                    </h1>
                    <p className="text-white/40 text-[11px] font-medium tracking-wide uppercase max-w-sm">
                        Executive-Grade Financial Console for Managing {students.length > 1 ? 'Family' : 'Student'} Expenditures.
                    </p>
                </div>

                {students.length > 1 && (
                    <div className="flex bg-[#0c0e12] p-1.5 rounded-[2rem] border border-white/5 shadow-2xl backdrop-blur-xl">
                        {students.map(s => (
                            <button
                                key={s.student_id}
                                onClick={() => setSelectedStudentId(s.student_id)}
                                className={clsx(
                                    "px-8 py-3 rounded-full text-[11px] font-black uppercase tracking-widest transition-all duration-500 flex items-center gap-3",
                                    selectedStudentId === s.student_id
                                        ? "bg-emerald-500 text-black shadow-[0_10px_30px_-5px_rgba(16,185,129,0.4)]"
                                        : "text-white/40 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <div className={clsx("w-2 h-2 rounded-full", selectedStudentId === s.student_id ? "bg-black animate-pulse" : "bg-white/10")}></div>
                                {s.display_name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* 2. Key Intelligence Grid (Summary) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    {
                        label: 'Total Billed',
                        value: financeDetail?.summary.total_billed || 0,
                        icon: <TrendingUpCustomIcon className="w-6 h-6" />,
                        color: 'primary',
                        bg: 'bg-primary/5',
                        border: 'border-primary/10'
                    },
                    {
                        label: 'Gross Paid',
                        value: financeDetail?.summary.total_paid || 0,
                        icon: <CheckCircleIcon className="w-6 h-6 text-emerald-500" />,
                        color: 'emerald-500',
                        bg: 'bg-emerald-500/5',
                        border: 'border-emerald-500/10'
                    },
                    {
                        label: 'Outstanding Balance',
                        value: financeDetail?.summary.outstanding || 0,
                        icon: <AlertTriangleIcon className="w-6 h-6 text-red-500" />,
                        color: 'red-500',
                        bg: 'bg-red-500/5',
                        border: 'border-red-500/10',
                        isCritical: (financeDetail?.summary.outstanding > 0)
                    },
                    {
                        label: 'Overdue Amount',
                        value: financeDetail?.summary.overdue || 0,
                        icon: <ClockIcon className="w-6 h-6 text-amber-500" />,
                        color: 'amber-500',
                        bg: 'bg-amber-500/5',
                        border: 'border-amber-500/10',
                        isCritical: (financeDetail?.summary.overdue > 0)
                    }
                ].map((item, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className={clsx(
                            "p-8 rounded-[2.5rem] border backdrop-blur-sm relative overflow-hidden group hover:-translate-y-1 transition-all duration-500",
                            item.bg, item.border
                        )}
                    >
                        {/* Decorative Background Icon */}
                        <div className="absolute -right-6 -bottom-6 opacity-[0.03] group-hover:opacity-[0.08] group-hover:scale-125 transition-all duration-700 pointer-events-none">
                            {React.cloneElement(item.icon as React.ReactElement, { className: 'w-32 h-32' })}
                        </div>

                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-6">
                                <div className={clsx("w-12 h-12 rounded-2xl flex items-center justify-center border border-white/5", item.bg)}>
                                    {item.icon}
                                </div>
                                {idx === 2 && item.isCritical && (
                                    <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full">
                                        <div className="w-1 h-1 rounded-full bg-red-500 animate-ping"></div>
                                        <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Urgent</span>
                                    </div>
                                )}
                            </div>
                            <p className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em] mb-2">{item.label}</p>
                            <h3 className="text-3xl font-mono text-white tracking-tighter">
                                {formatCurrency(item.value)}
                            </h3>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* 3. Fee Structure Breakdown (New Section) */}
            {financeDetail?.breakdown?.length > 0 && (
                <div className="bg-[#0c0e12] rounded-[2.5rem] border border-white/5 p-8 md:p-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 opacity-[0.02]">
                        <DocumentTextIcon className="w-48 h-48" />
                    </div>
                    <div className="relative z-10 mb-8">
                        <h3 className="text-xl font-serif font-black text-white uppercase tracking-tighter mb-1">Fee Structure Breakdown</h3>
                        <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest leading-none">Detailed Component Mapping for Cycle {activeCycle}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 relative z-10">
                        {financeDetail.breakdown.map((item: any, idx: number) => (
                            <div key={idx} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex justify-between items-center group hover:bg-white/[0.04] transition-colors">
                                <div>
                                    <p className="text-white font-bold text-sm mb-1">{item.name}</p>
                                    <span className="text-[9px] text-white/30 font-black uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-md">{item.type || 'Standard'}</span>
                                </div>
                                <span className="text-emerald-400 font-mono font-bold text-lg">{formatCurrency(item.amount)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 4. Main Operational View (Schedule & Transactions) */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">

                {/* Installment Schedule (Table) */}
                <div className="xl:col-span-2 bg-[#0c0e12] rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl relative">
                    <div className="p-8 md:p-10 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <h3 className="text-xl font-serif font-black text-white uppercase tracking-tighter mb-1">Installment Schedule</h3>
                            <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest leading-none">Automated Breakdown of Fees for Cycle {activeCycle}</p>
                        </div>

                        <div className="flex items-center gap-4 w-full md:w-auto">
                            {/* Cycle Selector */}
                            <div className="relative">
                                <button
                                    onClick={() => setIsCycleMenuOpen(!isCycleMenuOpen)}
                                    className="px-6 py-3 bg-white/[0.03] hover:bg-white/[0.08] text-white/60 hover:text-white rounded-2xl border border-white/5 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-4"
                                >
                                    Cycle: <span className="text-emerald-500">{allCycles.find(c => c.id === activeCycle)?.year_name || 'SELECT'}</span>
                                    <div className={clsx("w-2 h-2 border-b-2 border-r-2 border-white/40 rotate-45 transition-transform duration-500", isCycleMenuOpen && "-rotate-[135deg] translate-y-1")} />
                                </button>
                                <AnimatePresence>
                                    {isCycleMenuOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 15, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 15, scale: 0.95 }}
                                            className="absolute right-0 top-full mt-3 w-56 bg-[#0c0e12] border border-white/10 rounded-[1.5rem] shadow-2xl z-[100] py-3 backdrop-blur-3xl overflow-hidden"
                                        >
                                            <div className="px-5 py-2 mb-2 border-b border-white/5">
                                                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Available Periods</span>
                                            </div>
                                            {allCycles.map(c => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => { setActiveCycle(c.id); setIsCycleMenuOpen(false); }}
                                                    className={clsx(
                                                        "w-full text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest transition-all",
                                                        activeCycle === c.id ? "text-emerald-500 bg-emerald-500/5" : "text-white/40 hover:text-white hover:bg-white/5"
                                                    )}
                                                >
                                                    {c.year_name} {c.is_current && <span className="ml-2 text-[8px] bg-emerald-500 text-black px-1.5 py-0.5 rounded-sm">Active</span>}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <button
                                onClick={() => setIsUploadModalOpen(true)}
                                className="px-8 py-3 bg-emerald-500 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 shadow-lg shadow-emerald-500/10 transition-all flex items-center gap-3 active:scale-95 group"
                            >
                                <UploadIcon className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />
                                Upload Receipt
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-[0.3em] text-white/20 bg-white/[0.01]">
                                    <th className="px-6 py-6 text-center w-16">
                                        <div className="w-4 h-4 rounded border border-white/10 mx-auto"></div>
                                    </th>
                                    <th className="px-6 py-6 text-left">Nomenclature</th>
                                    <th className="px-6 py-6 text-left">Deadline</th>
                                    <th className="px-6 py-6 text-right">Value</th>
                                    <th className="px-6 py-6 text-center">Status Matrix</th>
                                    <th className="px-6 py-6 text-right">Operation</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {financeDetail?.installments.map((inst: any, idx: number) => (
                                    <motion.tr
                                        key={inst.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className={clsx(
                                            "hover:bg-white/[0.03] transition-colors group/row",
                                            selectedInstallments.includes(inst.id) && "bg-emerald-500/[0.02]"
                                        )}
                                    >
                                        <td className="px-6 py-8 text-center">
                                            {inst.status !== 'paid' && (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedInstallments.includes(inst.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedInstallments([...selectedInstallments, inst.id]);
                                                        } else {
                                                            setSelectedInstallments(selectedInstallments.filter(id => id !== inst.id));
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-white/10 bg-white/5 checked:bg-emerald-500 checked:border-emerald-500 appearance-none cursor-pointer transition-all"
                                                />
                                            )}
                                        </td>
                                        <td className="px-6 py-8">
                                            <div className="flex flex-col">
                                                <span className="text-white font-serif font-bold text-lg">{inst.title}</span>
                                                <span className="text-[10px] text-white/30 uppercase tracking-widest mt-1">Institutional Component</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-8">
                                            <div className="flex flex-col">
                                                <span className={clsx("text-sm font-mono", inst.is_overdue ? "text-red-400" : "text-white/60")}>
                                                    {new Date(inst.due_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                                {inst.is_overdue && <span className="text-[9px] font-black text-red-500 uppercase tracking-widest mt-1">Breach of Deadline</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-8 text-right font-mono text-xl text-white tracking-tighter">
                                            {formatCurrency(inst.amount)}
                                            {inst.paid > 0 && inst.paid < inst.amount && (
                                                <span className="block text-[10px] text-emerald-500 font-mono mt-1">Paid: {formatCurrency(inst.paid)}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-8 text-center">
                                            <div className={clsx(
                                                "inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-[0.2em]",
                                                inst.status === 'paid' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]" :
                                                    inst.status === 'overdue' ? "bg-red-500/10 border-red-500/20 text-red-500" :
                                                        inst.status === 'partial' ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                                                            "bg-white/5 border-white/5 text-white/20"
                                            )}>
                                                <div className={clsx("w-1 h-1 rounded-full", inst.status === 'paid' ? "bg-emerald-500" : inst.status === 'overdue' ? "bg-red-500" : "bg-white/20")}></div>
                                                {inst.status}
                                            </div>
                                        </td>
                                        <td className="px-6 py-8 text-right">
                                            {inst.status !== 'paid' ? (
                                                <button
                                                    onClick={() => handlePayNow([inst.id])}
                                                    disabled={isPaymentProcessing}
                                                    className="relative overflow-hidden px-6 py-2 bg-white/5 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-500 hover:text-black transition-all disabled:opacity-50 active:scale-95 border border-white/10 hover:border-emerald-500"
                                                >
                                                    Pay Single
                                                </button>
                                            ) : (
                                                <div className="flex justify-end gap-3 opacity-20 group-hover/row:opacity-100 transition-opacity">
                                                    <button className="p-3 bg-white/5 rounded-xl hover:bg-white/10 text-white transition-colors">
                                                        <DocumentTextIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Bulk Action Bar */}
                        <AnimatePresence>
                            {selectedInstallments.length > 0 && (
                                <motion.div
                                    initial={{ y: 100, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: 100, opacity: 0 }}
                                    className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#0c0e12] border border-white/10 rounded-full pl-6 pr-2 py-2 flex items-center gap-6 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)]"
                                >
                                    <span className="text-white text-[10px] font-black uppercase tracking-widest">
                                        <span className="text-emerald-500">{selectedInstallments.length}</span> Installments Selected
                                    </span>
                                    <button
                                        onClick={() => handlePayNow(selectedInstallments)}
                                        disabled={isPaymentProcessing}
                                        className="bg-emerald-500 hover:bg-emerald-400 text-black px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        {isPaymentProcessing ? 'Processing...' : 'Proceed to Pay'}
                                        <CreditCardIcon className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Left Sidebar: Recent Transactions & Security */}
                <div className="space-y-8">

                    {/* Transactions Ledger */}
                    <div className="bg-[#0c0e12] rounded-[3rem] border border-white/5 p-10 shadow-xl">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-lg font-serif font-black text-white uppercase tracking-tighter">Transaction Ledger</h3>
                            <RefreshIcon className="w-4 h-4 text-white/20" />
                        </div>

                        <div className="space-y-6">
                            {financeDetail?.history.length > 0 ? financeDetail.history.map((tx: any, idx: number) => (
                                <motion.div
                                    key={tx.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    className="group/item flex justify-between items-center p-6 bg-white/[0.02] hover:bg-white/[0.04] rounded-[2rem] border border-white/5 hover:border-white/10 transition-all duration-300 relative overflow-hidden"
                                >
                                    <div className="relative z-10">
                                        <p className="text-white/80 font-mono text-xs tracking-tight">{tx.ref_id || 'UPLOADING...'}</p>
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="text-[9px] text-white/40 font-black uppercase tracking-widest">{tx.mode}</span>
                                            <div className="w-1 h-1 rounded-full bg-white/10"></div>
                                            <span className="text-[9px] text-white/40 font-black uppercase tracking-widest">{new Date(tx.date).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <div className="text-right relative z-10 flex flex-col items-end gap-1">
                                        <p className="text-emerald-400 font-mono font-bold text-lg">
                                            + {formatCurrency(tx.amount)}
                                        </p>
                                        <div className={clsx(
                                            "inline-flex items-center px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
                                            tx.status === 'Completed' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                                                tx.status === 'Pending Verification' ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                                                    "bg-white/5 border-white/10 text-white/30"
                                        )}>
                                            {tx.status}
                                        </div>
                                        {tx.proof_url && (
                                            <a
                                                href={tx.proof_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-2 text-[9px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest flex items-center gap-1.5 border-b border-blue-400/20 pb-0.5"
                                            >
                                                <UploadIcon className="w-2.5 h-2.5" />
                                                View Proof
                                            </a>
                                        )}
                                        <span className="text-[8px] text-white/20 mt-1 uppercase tracking-wider">{tx.id.slice(0, 8)}</span>
                                    </div>
                                </motion.div>
                            )) : (
                                <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-20">
                                    <div className="w-12 h-12 rounded-full border border-dashed border-white/50 flex items-center justify-center">
                                        <ClockIcon className="w-6 h-6" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">End of Ledger</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Security & Gateways */}
                    <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-purple-700 rounded-[3rem] p-10 text-white relative overflow-hidden min-h-[400px] flex flex-col justify-between shadow-[0_30px_60px_-12px_rgba(79,70,229,0.3)]">
                        <div className="absolute top-0 right-0 p-16 opacity-10 rotate-12 group-hover:rotate-45 transition-transform duration-1000">
                            <CreditCardIcon className="w-64 h-64" />
                        </div>

                        <div className="relative z-10">
                            <h3 className="text-3xl font-serif font-black uppercase tracking-tighter mb-4">SECURE PAYMENTS</h3>
                            <p className="text-white/70 text-sm leading-relaxed max-w-xs">
                                Our financial engine utilizes military-grade encryption for all PCI-compliant transactions. Your security is our priority.
                            </p>

                            <div className="mt-8 flex gap-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="px-3 py-1 bg-white/10 rounded-lg text-[9px] font-black tracking-widest uppercase border border-white/10">v{i + 1}.0 Secure</div>
                                ))}
                            </div>
                        </div>

                        <div className="relative z-10 space-y-4">
                            <button className="w-full py-5 bg-white text-indigo-600 font-black text-[11px] uppercase tracking-[0.3em] rounded-[1.5rem] hover:bg-white/90 shadow-2xl transition-all active:scale-95">
                                Manage Payment Profile
                            </button>
                            <p className="text-center text-[9px] text-white/40 font-bold uppercase tracking-widest">Powered by institutional gateway v4</p>
                        </div>
                    </div>

                </div>
            </div>

            {/* Manual Payment Upload Modal */}
            <AnimatePresence>
                {isUploadModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-[#000]/80 backdrop-blur-md p-4 md:p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 30, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.95, y: 30, opacity: 0 }}
                            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
                            className="bg-[#0c0e12] relative w-full max-w-lg rounded-[3rem] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7)] border border-white/10"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 opacity-50"></div>

                            <div className="p-10 pb-0 flex justify-between items-start">
                                <div>
                                    <h3 className="text-3xl font-serif font-black text-white tracking-tighter mb-2">Upload <span className="text-emerald-500">Receipt</span></h3>
                                    <p className="text-white/40 text-[11px] font-medium max-w-[260px]">Submit transaction evidence for manual verification by the accounts department.</p>
                                </div>
                                <button
                                    onClick={() => setIsUploadModalOpen(false)}
                                    className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all duration-300"
                                >
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-10 space-y-6">
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-2">Transaction Value</label>
                                        <div className="relative">
                                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 font-serif text-lg">₹</span>
                                            <input
                                                type="number"
                                                value={uploadData.amount}
                                                onChange={e => setUploadData({ ...uploadData, amount: e.target.value })}
                                                className="w-full bg-[#15161c] border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-white text-lg font-mono outline-none focus:border-emerald-500/50 transition-all shadow-inner"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-5">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-2">Date</label>
                                            <input
                                                type="date"
                                                value={uploadData.date}
                                                onChange={e => setUploadData({ ...uploadData, date: e.target.value })}
                                                className="w-full bg-[#15161c] border border-white/10 rounded-2xl px-6 py-4 text-white text-sm font-medium outline-none focus:border-emerald-500/50 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-2">Medium</label>
                                            <select
                                                value={uploadData.mode}
                                                onChange={e => setUploadData({ ...uploadData, mode: e.target.value })}
                                                className="w-full bg-[#15161c] border border-white/10 rounded-2xl px-6 py-4 text-white text-sm font-medium outline-none focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
                                            >
                                                <option value="NEFT">NEFT / RTGS</option>
                                                <option value="UPI">UPI Hub</option>
                                                <option value="CHEQUE">Cheque</option>
                                                <option value="CASH">Cash Deposit</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-2">UTR / Reference Number</label>
                                        <input
                                            type="text"
                                            value={uploadData.ref}
                                            onChange={e => setUploadData({ ...uploadData, ref: e.target.value })}
                                            className="w-full bg-[#15161c] border border-white/10 rounded-2xl px-6 py-4 text-white font-mono text-sm outline-none focus:border-emerald-500/50 transition-all"
                                            placeholder="Ex: UTR12345678"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-2">Receipt Document</label>
                                        <div className="relative group/zone">
                                            <input
                                                type="file"
                                                onChange={handleFileSelect}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                accept="image/*,.pdf"
                                            />
                                            <div className={clsx(
                                                "w-full rounded-[2rem] p-8 flex items-center gap-6 border-2 border-dashed transition-all duration-300",
                                                uploadFile ? "bg-emerald-500/5 border-emerald-500/30" : "bg-[#15161c] border-white/5 hover:border-emerald-500/20"
                                            )}>
                                                <div className={clsx(
                                                    "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-xl",
                                                    uploadFile ? "bg-emerald-500 text-black translate-x-1" : "bg-white/5 text-white/20 group-hover/zone:text-emerald-500"
                                                )}>
                                                    <UploadIcon className="w-7 h-7" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white font-bold text-sm truncate">{uploadFile ? uploadFile.name : 'Choose Evidence File'}</p>
                                                    <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mt-1">PDF or Imaging Formats (Max 10MB)</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleManualSubmit}
                                    disabled={isSubmitting}
                                    className="w-full relative overflow-hidden rounded-[1.5rem] py-5 group/submit disabled:opacity-50"
                                >
                                    <div className="absolute inset-0 bg-emerald-500 group-hover/submit:bg-emerald-400 transition-all duration-300"></div>
                                    <div className="relative flex items-center justify-center gap-3">
                                        {isSubmitting ? (
                                            <Spinner className="text-black w-4 h-4" />
                                        ) : (
                                            <span className="text-black font-black uppercase tracking-[0.3em] text-[11px]">Finalize Submission</span>
                                        )}
                                    </div>
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
};

export default FinanceTab;
