import React, { useState, useEffect, useCallback } from 'react';
import { supabase, formatError } from '../../services/supabase';
import Spinner from '../common/Spinner';
import { XIcon } from '../icons/XIcon';
import { DollarSignIcon } from '../icons/DollarSignIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { ReceiptIcon } from '../icons/ReceiptIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { InfoIcon } from '../icons/InfoIcon';
import { motion, AnimatePresence } from 'framer-motion';

interface RecordPaymentModalProps {
    studentId: string;
    studentName: string;
    onClose: () => void;
    onSuccess: () => void;
}

const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({ studentId, studentName, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isAuthorizing, setIsAuthorizing] = useState(false);

    const [invoices, setInvoices] = useState<any[]>([]);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('ADVANCE');
    const [amount, setAmount] = useState<string>('1000');
    const [method, setMethod] = useState('ONLINE TRANS');
    const [receiptNo, setReceiptNo] = useState<string>('');

    const fetchInvoices = useCallback(async () => {
        setFetching(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase.rpc('get_payable_invoices_for_student', {
                p_student_id: studentId
            });

            if (fetchError) {
                if (fetchError.message.includes('function') || fetchError.message.includes('not found')) {
                    setInvoices([]);
                    setSelectedInvoiceId('ADVANCE');
                    return;
                }
                throw fetchError;
            }

            if (data && data.length > 0) {
                setInvoices(data);
                setSelectedInvoiceId(data[0].id.toString());
                setAmount(data[0].amount_due.toString());
            } else {
                setInvoices([]);
                setSelectedInvoiceId('ADVANCE');
                setAmount('1000');
            }
        } catch (err: any) {
            console.error("Registry Sync Failure:", err);
            setError(formatError(err));
        } finally {
            setFetching(false);
        }
    }, [studentId]);

    useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            setError("MAGNITUDE ERROR: Settlement magnitude must be positive.");
            return;
        }

        setLoading(true);
        setIsAuthorizing(true);

        try {
            const isAdvance = selectedInvoiceId === 'ADVANCE';
            const targetInvoiceId = isAdvance ? null : parseInt(selectedInvoiceId);

            // ATOMIC PROTOCOL: RPC record_fee_payment handles invoice status AND forensic reconcile internally.
            const { data, error: rpcError } = await supabase.rpc('record_fee_payment', {
                p_invoice_id: targetInvoiceId,
                p_amount: numAmount,
                p_method: method,
                p_reference: isAdvance ? 'UNALLOCATED_ADVANCE_ENTRY' : 'MANUAL_LEDGER_SYNC',
                p_student_id: studentId
            });

            if (rpcError) throw rpcError;

            if (data && data.success) {
                setReceiptNo(data.receipt_number || `RCP-${data.payment_id}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`);
                setSuccess(true);
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 2400);
            } else {
                throw new Error(data?.message || "Protocol rejection by financial node.");
            }
        } catch (err: any) {
            setError(formatError(err));
            setIsAuthorizing(false);
            setLoading(false);
        }
    };

    const isStandby = !fetching && invoices.length === 0 && !error;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[3000] flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-[#0c0d12] w-full max-w-lg md:max-w-2xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden flex flex-col my-8"
                onClick={e => e.stopPropagation()}
            >
                <AnimatePresence mode="wait">
                    {success ? (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-8 md:p-16 text-center space-y-8 flex flex-col items-center justify-center min-h-[400px]"
                        >
                            <div className="relative">
                                <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full"></div>
                                <div className="relative w-24 h-24 md:w-32 md:h-32 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-inner ring-4 ring-emerald-500/5">
                                    <CheckCircleIcon className="w-12 h-12 md:w-16 md:h-16" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl md:text-3xl font-serif font-bold text-white tracking-tight">Payment Successful</h3>
                                <p className="text-white/40 text-sm font-medium">Transaction recorded and ledger updated.</p>
                            </div>
                            <div className="bg-white/[0.03] p-6 md:p-8 rounded-2xl border border-white/5 w-full max-w-sm mx-auto">
                                <p className="text-[10px] font-bold uppercase text-white/30 tracking-widest mb-2">Receipt Reference</p>
                                <p className="text-xl md:text-2xl font-mono font-bold text-emerald-400 tracking-wider break-all">{receiptNo}</p>
                            </div>
                        </motion.div>
                    ) : isAuthorizing ? (
                        <motion.div
                            key="authorizing"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-16 md:p-32 text-center space-y-8 flex flex-col items-center justify-center min-h-[400px]"
                        >
                            <div className="relative">
                                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse"></div>
                                <Spinner size="lg" className="text-primary relative z-10" />
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-xl md:text-2xl font-serif font-bold text-white">Processing Transaction</h4>
                                <p className="text-primary/60 text-xs font-bold uppercase tracking-widest animate-pulse">Securely updating financial records...</p>
                            </div>
                        </motion.div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col h-full">
                            {/* Header */}
                            <header className="p-6 md:p-8 border-b border-white/[0.06] bg-white/[0.01] flex justify-between items-start md:items-center gap-4 relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] to-transparent pointer-events-none"></div>
                                <div className="flex items-center gap-4 md:gap-6 relative z-10">
                                    <div className="p-3 md:p-4 bg-primary/10 rounded-2xl text-primary border border-primary/20 shadow-lg shrink-0">
                                        <DollarSignIcon className="w-6 h-6 md:w-8 md:h-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl md:text-2xl font-serif font-bold text-white tracking-tight leading-tight">Record Payment</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                            <p className="text-[10px] md:text-xs font-bold text-white/40 uppercase tracking-widest">{studentName}</p>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="p-2 md:p-3 rounded-xl hover:bg-white/5 text-white/30 hover:text-white transition-colors"
                                >
                                    <XIcon className="w-5 h-5 md:w-6 md:h-6" />
                                </button>
                            </header>

                            {/* Main Content */}
                            <main className="p-6 md:p-8 space-y-6 md:space-y-8 flex-grow overflow-y-auto custom-scrollbar">
                                {/* Error Display */}
                                {error && (
                                    <div className="p-4 md:p-6 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-4 animate-in slide-in-from-top-2">
                                        <AlertTriangleIcon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase text-red-500 tracking-widest">Transaction Failed</p>
                                            <p className="text-sm text-red-400 leading-relaxed font-medium">{error}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Warning/Info Display */}
                                {isStandby && (
                                    <div className="p-4 md:p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-4">
                                        <InfoIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase text-amber-500 tracking-widest">No Pending Invoices</p>
                                            <p className="text-sm text-white/50 leading-relaxed">This payment will be recorded as an <strong>Unallocated Advance</strong>.</p>
                                        </div>
                                    </div>
                                )}

                                {/* Form Fields */}
                                <div className="space-y-6">
                                    {/* Invoice Selection */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase text-white/30 tracking-widest ml-1">Payment For</label>
                                        <div className="relative group">
                                            <select
                                                value={selectedInvoiceId}
                                                onChange={e => {
                                                    const invId = e.target.value;
                                                    setSelectedInvoiceId(invId);
                                                    const selected = invoices.find(i => i.id.toString() === invId);
                                                    if (selected) setAmount(selected.amount_due.toString());
                                                    setError(null);
                                                }}
                                                disabled={fetching}
                                                className="w-full bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 rounded-2xl p-4 md:p-5 pr-12 text-sm md:text-base font-medium text-white focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none cursor-pointer transition-all appearance-none"
                                            >
                                                {fetching ? (
                                                    <option disabled>Loading invoices...</option>
                                                ) : invoices.length > 0 ? (
                                                    <>
                                                        <option value="ADVANCE" className="bg-[#1a1d23]">Unallocated Advance (Credit)</option>
                                                        {invoices.map(inv => (
                                                            <option key={inv.id} value={inv.id} className="bg-[#1a1d23]">
                                                                {inv.description} — ₹{inv.amount_due} Due
                                                            </option>
                                                        ))}
                                                    </>
                                                ) : (
                                                    <option value="ADVANCE" className="bg-[#1a1d23]">Unallocated Advance (Credit)</option>
                                                )}
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/30 group-hover:text-white transition-colors">
                                                <ChevronDownIcon className="w-5 h-5" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Amount Input */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase text-white/30 tracking-widest ml-1">Amount</label>
                                            <div className="relative group">
                                                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-primary/80 font-serif text-xl md:text-2xl font-bold">₹</div>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={amount}
                                                    onChange={e => { setAmount(e.target.value); setError(null); }}
                                                    className="w-full bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 rounded-2xl p-4 md:p-5 pl-12 text-lg md:text-xl font-bold text-white focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all placeholder:text-white/10"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>

                                        {/* Payment Method */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase text-white/30 tracking-widest ml-1">Method</label>
                                            <div className="relative group">
                                                <select
                                                    value={method}
                                                    onChange={e => setMethod(e.target.value)}
                                                    className="w-full bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 rounded-2xl p-4 md:p-5 pr-12 text-sm md:text-base font-bold uppercase tracking-wide text-white focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none cursor-pointer transition-all appearance-none"
                                                >
                                                    <option value="ONLINE TRANS" className="bg-[#1a1d23]">Online Transfer</option>
                                                    <option value="CASH PROTOCOL" className="bg-[#1a1d23]">Cash</option>
                                                    <option value="INSTITUTIONAL CHECK" className="bg-[#1a1d23]">Cheque / DD</option>
                                                    <option value="ELECTRONIC CLEARING" className="bg-[#1a1d23]">NEFT / RTGS</option>
                                                    <option value="UPI" className="bg-[#1a1d23]">UPI</option>
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/30 group-hover:text-white transition-colors">
                                                    <ChevronDownIcon className="w-5 h-5" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </main>

                            {/* Footer */}
                            <footer className="p-6 md:p-8 bg-white/[0.02] border-t border-white/[0.06] flex flex-col-reverse md:flex-row justify-between items-center gap-4 md:gap-8">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="w-full md:w-auto px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/5 transition-all text-center"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || fetching}
                                    className="w-full md:w-auto min-w-[200px] px-8 py-4 bg-primary hover:bg-primary/90 text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 relative overflow-hidden"
                                >
                                    {loading ? (
                                        <Spinner size="sm" className="text-white" />
                                    ) : (
                                        <>
                                            <ShieldCheckIcon className="w-4 h-4" />
                                            <span>Confirm Payment</span>
                                        </>
                                    )}
                                </button>
                            </footer>
                        </form>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default RecordPaymentModal;