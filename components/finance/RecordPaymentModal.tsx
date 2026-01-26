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
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[3000] flex items-center justify-center p-4 animate-in fade-in duration-500" onClick={onClose}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.98, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-[#0c0d12] w-full max-w-[520px] rounded-[3.5rem] shadow-[0_80px_160px_-24px_rgba(0,0,0,1)] border border-white/10 overflow-hidden flex flex-col ring-1 ring-white/5" 
                onClick={e => e.stopPropagation()}
            >
                <AnimatePresence mode="wait">
                    {success ? (
                        <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-16 text-center space-y-12">
                            <div className="relative inline-block">
                                 <div className="absolute inset-0 bg-emerald-500/20 blur-[80px] rounded-full"></div>
                                 <div className="relative w-32 h-32 bg-emerald-500/10 text-emerald-500 rounded-[3rem] flex items-center justify-center mx-auto border border-emerald-500/20 shadow-inner ring-8 ring-emerald-500/5">
                                    <CheckCircleIcon animate className="w-16 h-16"/>
                                 </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-4xl font-serif font-black text-white uppercase tracking-tight leading-none">Sync Confirmed.</h3>
                                <p className="text-white/40 font-serif italic text-xl leading-relaxed">Settlement registered and ledger reconciled.</p>
                            </div>
                            <div className="bg-black/60 p-10 rounded-[2.5rem] border border-white/5 shadow-inner relative overflow-hidden">
                                 <p className="text-[10px] font-black uppercase text-white/20 tracking-[0.5em] mb-4">Registry Token</p>
                                 <p className="text-3xl font-mono font-black text-primary tracking-[0.2em] uppercase leading-none">{receiptNo}</p>
                            </div>
                        </motion.div>
                    ) : isAuthorizing ? (
                        <motion.div key="authorizing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-24 text-center space-y-10">
                            <div className="relative flex justify-center">
                                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse"></div>
                                <Spinner size="lg" className="text-primary" />
                            </div>
                            <div className="animate-pulse space-y-3">
                                <h4 className="text-2xl font-serif font-black text-white uppercase tracking-tight">Integrating Pulse</h4>
                                <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.4em]">Sealing Transaction Node...</p>
                            </div>
                        </motion.div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col">
                            <header className="p-10 border-b border-white/[0.04] bg-white/[0.02] flex justify-between items-center relative overflow-hidden group">
                                <div className="flex items-center gap-6 relative z-10">
                                    <div className="p-4 bg-[#1a1c24] rounded-2xl text-primary shadow-inner border border-white/5 group-hover:rotate-6 transition-all duration-700 ring-2 ring-primary/5">
                                        <DollarSignIcon className="w-7 h-7 font-black"/>
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-3xl font-serif font-black text-white uppercase tracking-tight leading-none">SYNC SETTLEMENT</h3>
                                        <p className="text-[11px] font-black text-primary uppercase tracking-[0.4em] leading-none mt-1">{studentName}</p>
                                    </div>
                                </div>
                                <button type="button" onClick={onClose} className="p-3 rounded-full hover:bg-white/5 text-white/40 hover:text-white transition-all"><XIcon className="w-6 h-6 opacity-40"/></button>
                            </header>

                            <main className="p-10 space-y-10 bg-transparent relative z-10">
                                {error && (
                                    <div className="p-8 bg-red-500/10 border border-red-500/30 rounded-[2.2rem] flex flex-col gap-4 shadow-2xl animate-in shake">
                                        <div className="flex items-center gap-3">
                                            <AlertTriangleIcon className="w-6 h-6 text-red-500 shrink-0" />
                                            <p className="text-[11px] font-black uppercase text-red-500 tracking-widest">Protocol Sync Failure</p>
                                        </div>
                                        <p className="text-[13px] font-bold text-red-400 leading-relaxed uppercase tracking-wider">{error}</p>
                                    </div>
                                )}

                                {isStandby && (
                                    <div className="p-8 bg-[#f59e0b]/5 border border-[#f59e0b]/20 rounded-[2.2rem] flex items-start gap-5 shadow-sm animate-in slide-in-from-top-2">
                                        <div className="p-3 rounded-2xl bg-[#f59e0b]/10">
                                            <InfoIcon className="w-6 h-6 text-[#f59e0b] mt-0.5 shrink-0" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-black uppercase text-[#f59e0b] tracking-[0.2em]">REGISTRY STANDBY</p>
                                            <p className="text-[13px] text-white/30 mt-2 leading-relaxed font-medium">No pending liability nodes found. Settlement will be recorded as <strong>Unallocated Advance</strong>.</p>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em] ml-2">TARGET LIABILITY MODULE</label>
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
                                            className="w-full bg-black border border-white/10 rounded-[1.8rem] p-7 text-[15px] font-black text-white focus:ring-[15px] focus:ring-primary/5 focus:border-primary/40 outline-none cursor-pointer shadow-2xl uppercase tracking-widest transition-all disabled:opacity-30 appearance-none"
                                        >
                                            {fetching ? (
                                                <option disabled>SYNCHRONIZING REGISTRY...</option>
                                            ) : invoices.length > 0 ? (
                                                <>
                                                    <option value="ADVANCE">UNALLOCATED ADVANCE / PRE-PAY</option>
                                                    {invoices.map(inv => (
                                                        <option key={inv.id} value={inv.id}>
                                                            {inv.description.toUpperCase()} — ₹{inv.amount_due} PENDING
                                                        </option>
                                                    ))}
                                                </>
                                            ) : (
                                                <option value="ADVANCE">UNALLOCATED ADVANCE / PRE-PAY</option>
                                            )}
                                        </select>
                                        <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-4">
                                            <div className="w-px h-6 bg-white/10" />
                                            <div className="flex items-center gap-2">
                                                <ReceiptIcon className="w-5 h-5 text-white/10" />
                                                <ChevronDownIcon className="w-5 h-5 text-white/40" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em] ml-2">SETTLEMENT MAGNITUDE</label>
                                        <div className="relative group">
                                            <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-3">
                                                <span className="text-2xl font-black text-primary font-serif">₹</span>
                                            </div>
                                            <input 
                                                type="number" step="0.01" value={amount} 
                                                onChange={e => { setAmount(e.target.value); setError(null); }} 
                                                className="w-full h-24 bg-black border border-white/[0.05] rounded-[1.8rem] p-6 pl-14 text-3xl font-mono font-black text-white focus:ring-[15px] focus:ring-primary/5 focus:border-primary/40 outline-none shadow-inner transition-all placeholder:text-white/5" 
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em] ml-2">CHANNEL VECTOR</label>
                                        <div className="relative group">
                                            <select 
                                                value={method} 
                                                onChange={e => setMethod(e.target.value)} 
                                                className="w-full h-24 bg-black border border-white/[0.05] rounded-[1.8rem] px-8 text-[12px] font-black uppercase tracking-[0.3em] text-white focus:ring-[15px] focus:ring-primary/5 focus:border-primary/40 outline-none shadow-inner appearance-none cursor-pointer transition-all"
                                            >
                                                <option value="ONLINE TRANS">ONLINE TRANS</option>
                                                <option value="CASH PROTOCOL">CASH PROTOCOL</option>
                                                <option value="INSTITUTIONAL CHECK">INSTITUTIONAL CHECK</option>
                                                <option value="ELECTRONIC CLEARING">ELECTRONIC CLEARING</option>
                                            </select>
                                            <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-white/10 group-hover:text-primary transition-colors"><ChevronDownIcon className="w-5 h-5" /></div>
                                        </div>
                                    </div>
                                </div>
                            </main>

                            <footer className="p-10 bg-black border-t border-white/[0.04] flex flex-col md:flex-row justify-between items-center gap-10 relative z-30">
                                <button type="button" onClick={onClose} className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 hover:text-white transition-all active:scale-95">ABORT PROCEDURE</button>
                                <button 
                                    type="submit" 
                                    disabled={loading || fetching} 
                                    className="relative w-full md:w-auto min-w-[300px] h-20 bg-primary text-white font-black text-[12px] uppercase tracking-[0.3em] rounded-[2.2rem] shadow-[0_32px_64px_-16px_rgba(var(--primary),0.6)] hover:bg-[#8B5CF6] transition-all transform active:scale-95 disabled:opacity-20 flex items-center justify-center gap-5 ring-8 ring-primary/5 group overflow-hidden"
                                >
                                    {loading ? <Spinner size="sm" className="text-white" /> : <><ShieldCheckIcon className="w-5 h-5 opacity-50" /> AUTHORIZE SETTLEMENT</>}
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10 overflow-hidden"><motion.div className="h-full bg-white/40" animate={{ x: ['-100%', '100%'] }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} /></div>
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