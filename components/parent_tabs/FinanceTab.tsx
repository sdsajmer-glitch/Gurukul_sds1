import React, { useState, useEffect, useCallback } from 'react';
import { supabase, formatError } from '../../services/supabase';
import { UserProfile } from '../../types';
import Spinner from '../common/Spinner';
import { CreditCardIcon } from '../icons/CreditCardIcon';
import { TrendingUpCustomIcon } from '../icons/TrendingUpIcon'; // Or similar
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { RefreshIcon } from '../icons/RefreshIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { XIcon } from '../icons/XIcon';
import { motion, AnimatePresence } from 'framer-motion';

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
    const [error, setError] = useState<string | null>(null);
    const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);

    // Cycle Selector State
    const [allCycles, setAllCycles] = useState<any[]>([]);
    const [isCycleMenuOpen, setIsCycleMenuOpen] = useState(false);

    // Initial Fetch: Get Linked Students
    const fetchStudents = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_parent_linked_students_finance_v2', {
                p_parent_id: profile.id
            });
            if (error) throw error;

            setStudents(data || []);
            if (data && data.length > 0 && !selectedStudentId) {
                setSelectedStudentId(data[0].student_id);
            }
        } catch (err: any) {
            setError(formatError(err));
        } finally {
            setLoading(false);
        }
    }, [profile.id, selectedStudentId]);

    // Fetch Cycles
    const fetchCycles = useCallback(async () => {
        const { data } = await supabase.from('academic_years').select('id, year_name, is_current').order('start_date', { ascending: false });
        if (data) setAllCycles(data);
    }, []);

    useEffect(() => {
        fetchCycles();
        fetchStudents();
    }, [fetchCycles, fetchStudents]);

    // Fetch Detail for Selected Student
    const fetchFinanceDetail = useCallback(async () => {
        if (!selectedStudentId) return;

        try {
            // Get Current Cycle first if needed, or rely on backend default
            const { data: detailData, error: detailError } = await supabase.rpc('get_student_finance_detail_v2', {
                p_student_id: selectedStudentId,
                p_cycle_id: activeCycle // null defaults to current
            });

            if (detailError) throw detailError;
            setFinanceDetail(detailData);
            if (!activeCycle && detailData.cycle_id) setActiveCycle(detailData.cycle_id);

        } catch (err: any) {
            console.error(err);
            // Don't block UI, just show partial data if possible
        }
    }, [selectedStudentId, activeCycle]);

    useEffect(() => {
        if (selectedStudentId) {
            fetchFinanceDetail();
        }
    }, [selectedStudentId, fetchFinanceDetail]);


    // Mock Payment Handler
    const handlePayNow = async (invoiceId: string, amount: number) => {
        setIsPaymentProcessing(true);
        try {
            // 1. Initiate Intent
            const { data: intent, error: intentError } = await supabase.rpc('initiate_parent_payment', {
                p_student_id: selectedStudentId,
                p_amount: amount,
                p_invoice_ids: [invoiceId]
            });

            if (intentError) throw intentError;

            // 2. Simulate User Paying on Gateway (Wait 2s)
            await new Promise(r => setTimeout(r, 2000));

            // 3. Simulate Webhook Success
            const { error: hookError } = await supabase.rpc('process_payment_success', {
                p_payment_id: intent.payment_id,
                p_transaction_ref: 'TXN_' + Math.floor(Math.random() * 100000)
            });

            if (hookError) throw hookError;

            // 4. Refresh Data
            await fetchFinanceDetail();
            alert('Payment Successful!');

        } catch (err: any) {
            alert('Payment Failed: ' + err.message);
        } finally {
            setIsPaymentProcessing(false);
        }
    };

    // Manual Payment State
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadData, setUploadData] = useState({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        mode: 'NEFT', // NEFT, UPI, CHEQUE, CASH
        ref: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Mock Payment Logic
    const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);

    const handlePayNow = async (invoiceId: string, amount: number) => {
        if (!selectedStudentId) return;
        setIsPaymentProcessing(true);
        try {
            // 1. Create Payment Intent (Mock)
            const { data: intent, error: intentError } = await supabase.rpc('initiate_parent_payment', {
                p_student_id: selectedStudentId,
                p_amount: amount,
                p_invoice_id: invoiceId
            });

            if (intentError) throw intentError;

            // 2. Simulate User Redirect to Gateway
            // In a real app, window.location.href = intent.payment_url;
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate gateway time

            // 3. Simulate Successful Webhook Callback (for demo purposes)
            const { error: webhookError } = await supabase.rpc('process_payment_success', {
                p_payment_id: intent, // intent returns payment ID in this mock
                p_transaction_id: `TXN_${Date.now()}`
            });

            if (webhookError) throw webhookError;

            // 4. Refresh Data
            await fetchFinanceDetail();
            alert('Payment processed successfully!');

        } catch (err: any) {
            console.error('Payment Error:', err);
            alert('Payment failed: ' + err.message);
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
            alert('Please fill all fields and upload a receipt.');
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Upload File
            const fileExt = uploadFile.name.split('.').pop();
            const fileName = `${selectedStudentId}/${Date.now()}.${fileExt}`;
            const filePath = `receipts/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('documents') // Reusing documents bucket or 'receipts' if exists. Using 'documents' for safety as it likely exists.
                .upload(filePath, uploadFile);

            if (uploadError) throw uploadError;

            // 2. Get Public URL (or signed, but public for now for simplicity of receipt viewing by admin)
            const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);

            // 3. Submit Record
            const { error: dbError } = await supabase.rpc('submit_manual_payment_receipt', {
                p_student_id: selectedStudentId,
                p_amount: parseFloat(uploadData.amount),
                p_transaction_date: uploadData.date,
                p_transaction_ref: uploadData.ref,
                p_payment_mode: uploadData.mode,
                p_proof_url: publicUrl,
                p_invoice_ids: [] // Optional: could link to specific invoices if UI allowed selection
            });

            if (dbError) throw dbError;

            alert('Receipt uploaded successfully! Pending verification.');
            setIsUploadModalOpen(false);
            setUploadFile(null);
            setUploadData({ ...uploadData, amount: '', ref: '' });
            fetchFinanceDetail(); // Refresh to show pending status if applicable

        } catch (err: any) {
            alert('Error uploading receipt: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading && students.length === 0) return (
        <div className="flex justify-center items-center h-64">
            <Spinner />
            <span className="ml-4 text-white/50 text-xs tracking-widest uppercase">Loading Financial Records...</span>
        </div>
    );

    const activeStudent = students.find(s => s.student_id === selectedStudentId);

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4">

            {/* Header / Student Selector */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        <span className="text-[10px] font-black uppercase text-white/40 tracking-[0.4em]">Financial Hub</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-serif font-black text-white tracking-tighter uppercase leading-none">
                        Tuition & <span className="text-emerald-500">Fees.</span>
                    </h2>
                </div>

                {students.length > 1 && (
                    <div className="flex bg-white/5 p-1 rounded-full border border-white/10">
                        {students.map(s => (
                            <button
                                key={s.student_id}
                                onClick={() => setSelectedStudentId(s.student_id)}
                                className={`
                                    px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all
                                    ${selectedStudentId === s.student_id
                                        ? 'bg-emerald-500 text-black shadow-lg'
                                        : 'text-white/40 hover:text-white hover:bg-white/5'}
                                `}
                            >
                                {s.display_name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Financial Summary Cards */}
            {financeDetail && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Outstanding */}
                    <div className="p-8 rounded-[2rem] bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20 relative overflow-hidden group">
                        <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                            <AlertTriangleIcon className="w-24 h-24 text-red-500" />
                        </div>
                        <p className="text-[10px] font-black uppercase text-red-400 tracking-[0.2em] mb-4">Total Outstanding</p>
                        <h3 className="text-4xl font-mono text-white mb-2">
                            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(financeDetail.summary.outstanding)}
                        </h3>
                        <div className="h-1 w-full bg-white/10 rounded-full mt-4 overflow-hidden">
                            <div className="h-full bg-red-500" style={{ width: `${Math.min(100, (financeDetail.summary.outstanding / (financeDetail.summary.total_billed || 1)) * 100)}%` }} />
                        </div>
                    </div>

                    {/* Paid */}
                    <div className="p-8 rounded-[2rem] bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 relative overflow-hidden group">
                        <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                            <CheckCircleIcon className="w-24 h-24 text-emerald-500" />
                        </div>
                        <p className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.2em] mb-4">Total Paid</p>
                        <h3 className="text-4xl font-mono text-white mb-2">
                            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(financeDetail.summary.total_paid)}
                        </h3>
                        <p className="text-xs text-white/40 mt-2 font-medium">
                            {((financeDetail.summary.total_paid / (financeDetail.summary.total_billed || 1)) * 100).toFixed(1)}% Completed
                        </p>
                    </div>

                    {/* Next Due */}
                    <div className="p-8 rounded-[2rem] bg-white/[0.03] border border-white/10 relative overflow-hidden group">
                        <div className="absolute right-0 top-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                            <ClockIcon className="w-24 h-24 text-white" />
                        </div>
                        <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] mb-4">Next Installment</p>
                        {financeDetail.installments.find((i: any) => i.status !== 'paid') ? (
                            <>
                                <h3 className="text-3xl font-mono text-white mb-1">
                                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(financeDetail.installments.find((i: any) => i.status !== 'paid')?.amount || 0)}
                                </h3>
                                <p className="text-xs text-amber-500 mt-2 font-bold uppercase tracking-wider">
                                    Due: {new Date(financeDetail.installments.find((i: any) => i.status !== 'paid')?.due_date).toLocaleDateString()}
                                </p>
                            </>
                        ) : (
                            <h3 className="text-2xl font-serif italic text-white/60">All Cleared</h3>
                        )}
                    </div>
                </div>
            )}

            {/* Installments Table */}
            <div className="bg-[#111218] rounded-[2.5rem] border border-white/5 overflow-hidden">
                <div className="p-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h3 className="text-lg font-serif font-bold text-white uppercase tracking-wider">Installment Schedule</h3>

                    <div className="flex items-center gap-4">
                        {/* Upload Receipt Button */}
                        <button
                            onClick={() => setIsUploadModalOpen(true)}
                            className="px-5 py-2 bg-white/[0.05] hover:bg-white/[0.1] text-white text-[10px] font-black uppercase tracking-widest rounded-full border border-white/10 transition-all flex items-center gap-2"
                        >
                            <UploadIcon className="w-3 h-3" />
                            Upload Receipt
                        </button>

                        {/* Cycle Selector */}
                        <div className="relative">
                            <button
                                onClick={() => setIsCycleMenuOpen(!isCycleMenuOpen)}
                                className="px-6 py-2 bg-white/5 rounded-full border border-white/10 text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-3 hover:bg-white/10 transition-colors"
                            >
                                Cycle: {allCycles.find(c => c.id === activeCycle)?.year_name || 'Current'}
                                <div className={`w-0 h-0 border-l-[3px] border-l-transparent border-t-[4px] border-t-white/50 border-r-[3px] border-r-transparent transition-transform ${isCycleMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {isCycleMenuOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className="absolute right-0 top-full mt-2 w-48 bg-[#1a1b23] border border-white/10 rounded-xl shadow-2xl z-20 py-2"
                                    >
                                        {allCycles.map(cycle => (
                                            <button
                                                key={cycle.id}
                                                onClick={() => {
                                                    setActiveCycle(cycle.id);
                                                    setIsCycleMenuOpen(false);
                                                }}
                                                className={`w-full text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-colors ${activeCycle === cycle.id ? 'text-emerald-500' : 'text-white/60'}`}
                                            >
                                                {cycle.year_name} {cycle.is_current && '(Active)'}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-white/30 bg-white/[0.02]">
                                <th className="px-8 py-5">Title</th>
                                <th className="px-8 py-5">Due Date</th>
                                <th className="px-8 py-5 text-right">Amount</th>
                                <th className="px-8 py-5 text-center">Status</th>
                                <th className="px-8 py-5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {financeDetail?.installments.map((inst: any) => (
                                <tr key={inst.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-8 py-6 font-medium text-white/80">{inst.title}</td>
                                    <td className="px-8 py-6 text-sm text-white/50 font-mono">
                                        {new Date(inst.due_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                        {inst.is_overdue && <span className="ml-2 text-[9px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded uppercase tracking-wider">Overdue</span>}
                                    </td>
                                    <td className="px-8 py-6 text-right font-mono text-white/90">
                                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(inst.amount)}
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <span className={`
                                            inline-flex items-center px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest
                                            ${inst.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                                inst.status === 'partial' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                                    'bg-white/5 text-white/40 border border-white/10'}
                                        `}>
                                            {inst.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        {inst.status !== 'paid' && (
                                            <button
                                                onClick={() => handlePayNow(inst.id, inst.amount)}
                                                disabled={isPaymentProcessing}
                                                className="px-5 py-2 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(52,211,153,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                                            >
                                                {isPaymentProcessing ? 'Processing...' : 'Pay Now'}
                                            </button>
                                        )}
                                        {inst.status === 'paid' && (
                                            <button className="text-white/20 hover:text-white transition-colors">
                                                <CreditCardIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {financeDetail?.installments.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-8 py-12 text-center text-white/30 text-xs uppercase tracking-widest italic">
                                        No installments generated for this cycle.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Transaction History (Simplified) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-[#111218] rounded-[2rem] border border-white/5 p-8">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-3">
                        <RefreshIcon className="w-4 h-4 text-white/40" />
                        Recent Transactions
                    </h3>
                    <div className="space-y-4">
                        {financeDetail?.history.length > 0 ? financeDetail.history.map((tx: any) => (
                            <div key={tx.id} className="flex justify-between items-center p-4 bg-white/[0.02] rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <div>
                                    <p className="text-white font-mono text-sm">{tx.ref_id || 'Processing...'}</p>
                                    <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">
                                        {new Date(tx.date).toLocaleDateString()} • {tx.mode}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-emerald-400 font-mono font-bold">
                                        + {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(tx.amount)}
                                    </p>
                                    <span className="text-[9px] text-white/30 uppercase tracking-widest">{tx.status}</span>
                                </div>
                            </div>
                        )) : (
                            <p className="text-white/20 text-xs italic">No transactions found.</p>
                        )}
                    </div>
                </div>
                <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-[2rem] p-8 text-white relative overflow-hidden flex flex-col justify-between min-h-[300px]">
                    <div className="absolute top-0 right-0 p-12 opacity-20">
                        <CreditCardIcon className="w-48 h-48 rotate-12" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-serif font-black uppercase tracking-tight mb-2">Secure Payments</h3>
                        <p className="text-white/70 text-sm max-w-xs leading-relaxed">
                            All institutional payments are processed via our encrypted PCI-DSS compliant gateway. Verification is instant.
                        </p>
                    </div>
                    <div className="relative z-10 mt-8">
                        <div className="flex gap-3 mb-6">
                            {[1, 2, 3].map(i => <div key={i} className="w-8 h-5 bg-white/20 rounded"></div>)}
                        </div>
                        <button className="w-full py-4 bg-white text-indigo-600 font-black text-xs uppercase tracking-[0.2em] rounded-xl hover:bg-white/90 shadow-2xl transition-all">
                            Manage Payment Methods
                        </button>
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
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="bg-[#1a1b23] border border-white/10 rounded-[2rem] p-8 max-w-md w-full relative overflow-hidden shadow-2xl"
                        >
                            <button
                                onClick={() => setIsUploadModalOpen(false)}
                                className="absolute top-6 right-6 text-white/20 hover:text-white transition-colors"
                            >
                                <XIcon className="w-6 h-6" />
                            </button>

                            <h3 className="text-2xl font-serif font-black text-white uppercase tracking-tight mb-6">Upload Receipt</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Amount Paid</label>
                                    <input
                                        type="number"
                                        value={uploadData.amount}
                                        onChange={e => setUploadData({ ...uploadData, amount: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 outline-none focus:border-emerald-500/50 transition-colors font-mono"
                                        placeholder="0.00"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Date</label>
                                        <input
                                            type="date"
                                            value={uploadData.date}
                                            onChange={e => setUploadData({ ...uploadData, date: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Mode</label>
                                        <select
                                            value={uploadData.mode}
                                            onChange={e => setUploadData({ ...uploadData, mode: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50 transition-colors appearance-none"
                                        >
                                            <option value="NEFT">NEFT / RTGS</option>
                                            <option value="UPI">UPI</option>
                                            <option value="CHEQUE">Cheque</option>
                                            <option value="CASH">Cash Deposit</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Transaction Ref / ID</label>
                                    <input
                                        type="text"
                                        value={uploadData.ref}
                                        onChange={e => setUploadData({ ...uploadData, ref: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 outline-none focus:border-emerald-500/50 transition-colors font-mono"
                                        placeholder="UTR / Cheque No."
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Receipt Image / PDF</label>
                                    <div className="relative group">
                                        <input
                                            type="file"
                                            onChange={handleFileSelect}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            accept="image/*,.pdf"
                                        />
                                        <div className="w-full bg-white/5 border border-dashed border-white/10 rounded-xl p-6 flex flex-col items-center justify-center gap-2 group-hover:bg-white/[0.08] transition-colors">
                                            <UploadIcon className="w-6 h-6 text-white/30 group-hover:text-emerald-500 transition-colors" />
                                            <span className="text-[10px] text-white/40 uppercase tracking-widest">
                                                {uploadFile ? uploadFile.name : 'Click to Upload'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleManualSubmit}
                                    disabled={isSubmitting}
                                    className="w-full py-4 mt-4 bg-emerald-500 text-black font-black uppercase tracking-[0.2em] rounded-xl hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? 'Submitting...' : 'Submit Receipt'}
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
