
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Expense, CurrencyCode } from '../../types';
import { supabase } from '../../services/supabase';
import { BUCKETS } from '../../services/storage';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { FileTextIcon } from '../icons/FileTextIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { ReceiptIcon } from '../icons/ReceiptIcon';
import { CopyIcon } from '../icons/CopyIcon';
import { XCircleIcon } from '../icons/XCircleIcon';
import Spinner from '../common/Spinner';

interface ExpenseRowProps {
    expense: Expense;
    isExpanded: boolean;
    onToggle: () => void;
    onAction: (id: number, status: 'Approved' | 'Rejected') => void;
    onViewLedger: (expense: Expense) => void;
    viewCurrency: CurrencyCode;
}

const formatCurrency = (amount: number, currency: CurrencyCode) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount || 0);
};

const StatusChip: React.FC<{ status: string }> = ({ status }) => {
    const s = String(status).toLowerCase();
    const config = {
        approved: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
        pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    };
    const style = config[s as keyof typeof config] || config.pending;
    return (
        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${style}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s === 'approved' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : s === 'rejected' ? 'bg-red-500' : 'bg-amber-500'}`} />
            {status}
        </span>
    );
};

export const ExpenseDetailContent: React.FC<{ 
    expense: Expense; 
    viewCurrency: CurrencyCode; 
    onAction: (id: number, status: 'Approved' | 'Rejected') => void;
    onViewLedger: (expense: Expense) => void;
}> = ({ expense, viewCurrency, onAction, onViewLedger }) => {
    const [downloading, setDownloading] = useState(false);
    const baseAmount = expense.base_amount || expense.amount * 0.82;
    const taxAmount = expense.tax_amount || expense.amount * 0.18;
    const adjustments = expense.adjustments || 0;

    const timeline = expense.timeline || [
        { id: '1', status: 'Created', label: 'Registry Initialized', timestamp: expense.created_at || expense.expense_date, role: 'Accountant', icon: 'create' },
        { id: '2', status: 'Submitted', label: 'Fiscal Payload Submitted', timestamp: expense.created_at || expense.expense_date, role: 'Accountant', icon: 'submit' },
        { id: '3', status: expense.status, label: `Audit status set to ${expense.status}`, timestamp: new Date().toISOString(), role: 'Admin', icon: 'audit' }
    ];

    const handleDownloadArtifact = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!expense.invoice?.storage_path) return;
        
        setDownloading(true);
        try {
            const { data, error } = await supabase.storage
                .from(BUCKETS.EXPENSES)
                .download(expense.invoice.storage_path);
            
            if (error) throw error;

            const url = window.URL.createObjectURL(data);
            const link = document.createElement('a');
            link.href = url;
            link.download = expense.invoice.file_name || 'receipt.pdf';
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error("Artifact Retrieval Failure:", err);
            alert("Protocol Failure: Unable to fetch artifact from secure vault.");
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="p-8 md:p-12 space-y-12 bg-black/40">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* 1. Magnitude Matrix (Forensic Math) */}
                <div className="space-y-6">
                    <h5 className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em]">Magnitude Matrix</h5>
                    <div className="space-y-4 bg-black/60 p-8 rounded-[2rem] border border-white/5 shadow-inner">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-white/40 font-medium font-serif italic">Base Allocation</span>
                            <span className="font-mono font-black text-white/80 tabular-nums">{formatCurrency(baseAmount, viewCurrency)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-white/40 font-medium font-serif italic">Governance Levy (18%)</span>
                            <span className="font-mono font-black text-white/80 tabular-nums">{formatCurrency(taxAmount, viewCurrency)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-white/40 font-medium font-serif italic">Manual Adjustments</span>
                            <span className="font-mono font-black text-white/80 tabular-nums">{formatCurrency(adjustments, viewCurrency)}</span>
                        </div>
                        <div className="pt-8 border-t border-white/5 flex justify-between items-end">
                            <span className="text-[10px] font-black uppercase text-primary tracking-[0.2em] pb-1">Ledger Total</span>
                            <span className="text-3xl font-black text-white tabular-nums tracking-tighter">{formatCurrency(expense.amount, viewCurrency)}</span>
                        </div>
                    </div>
                </div>

                {/* 2. Counterparty Node */}
                <div className="space-y-6">
                    <h5 className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em]">Counterparty Node</h5>
                    <div className="space-y-8 px-2">
                        <div className="flex items-start gap-5">
                            <div className="p-3.5 rounded-2xl bg-white/5 text-white/30 border border-white/10 shadow-xl"><UsersIcon className="w-5 h-5"/></div>
                            <div>
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">Legal Identity</p>
                                <p className="text-sm font-bold text-white uppercase tracking-tight">{expense.vendor_name || 'INTERNAL_DISBURSEMENT'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-5">
                            <div className="p-3.5 rounded-2xl bg-white/5 text-white/30 border border-white/10 shadow-xl"><ReceiptIcon className="w-5 h-5"/></div>
                            <div>
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">Payment Vector</p>
                                <p className="text-sm font-bold text-white uppercase tracking-tight">{expense.payment_method || 'Electronic Clearing'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-5">
                            <div className="p-3.5 rounded-2xl bg-white/5 text-white/30 border border-white/10 shadow-xl"><ShieldCheckIcon className="w-5 h-5"/></div>
                            <div>
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">Compliance Binding</p>
                                <p className="text-sm font-bold text-white uppercase tracking-tight">{expense.vendor_account || 'SECURED_LEDGER'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Audit Spine (Timeline) */}
                <div className="space-y-6">
                    <h5 className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em]">Audit Spine</h5>
                    <div className="relative pl-8 space-y-10 border-l border-white/5 ml-3">
                        {timeline.map((event, idx) => (
                            <div key={event.id} className="relative">
                                <div className={`absolute -left-[41px] top-1 w-2.5 h-2.5 rounded-full border-2 border-[#0d0f14] ${idx === timeline.length - 1 ? 'bg-primary shadow-[0_0_12px_rgba(var(--primary),0.8)]' : 'bg-white/10'}`}></div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-3">
                                        <p className="text-xs font-black text-white uppercase tracking-widest">{event.status}</p>
                                        <span className="text-[8px] font-black text-white/10 uppercase tracking-[0.25em] px-2 py-0.5 border border-white/5 rounded bg-white/[0.01]">{event.role}</span>
                                    </div>
                                    <p className="text-[11px] text-white/30 font-medium font-serif italic leading-relaxed">{event.label}</p>
                                    <p className="text-[9px] font-mono text-white/10 uppercase tracking-tighter">{new Date(event.timestamp).toLocaleString().toUpperCase()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Artifacts & Action Strip */}
            <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
                <div 
                    onClick={handleDownloadArtifact}
                    className="flex items-center gap-5 group/doc p-5 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:border-primary/20 transition-all cursor-pointer shadow-2xl min-w-[320px]"
                >
                    <div className="p-3.5 bg-[#1a1d23] rounded-2xl text-white/40 group-hover/doc:text-primary transition-colors border border-white/5 shadow-inner flex-shrink-0">
                        {downloading ? <Spinner size="sm"/> : <FileTextIcon className="w-7 h-7"/>}
                    </div>
                    <div className="min-w-0 flex-grow">
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">Fiscal Artifact</p>
                        <p className="text-[11px] font-black text-white/70 uppercase truncate tracking-tight">
                            {expense.invoice?.file_name || 'MISSING_PAYLOAD_ATTACHMENT'}
                        </p>
                    </div>
                    <div className="p-2 ml-4 rounded-xl bg-white/5 text-white/20 group-hover/doc:text-white transition-all shadow-sm flex-shrink-0">
                        <DownloadIcon className="w-5 h-5"/>
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    {expense.status === 'Pending' && (
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={(e) => { e.stopPropagation(); onAction(expense.id, 'Rejected'); }}
                                className="px-10 py-4 rounded-2xl text-[10px] font-black uppercase text-red-500/60 hover:text-white hover:bg-red-600 transition-all border border-red-500/20 tracking-[0.2em] active:scale-95"
                            >
                                Flag Payload
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onAction(expense.id, 'Approved'); }}
                                className="px-12 py-4 bg-emerald-600 text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-emerald-500/20 hover:bg-emerald-500 transition-all transform active:scale-95 border border-white/10"
                            >
                                Authorize Logic
                            </button>
                        </div>
                    )}
                    {expense.status !== 'Pending' && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onViewLedger(expense); }}
                            className="flex-1 md:flex-none px-12 py-4 rounded-[1.5rem] text-[10px] font-black uppercase text-white/40 hover:text-white hover:bg-white/5 border border-white/5 transition-all tracking-[0.3em] shadow-2xl active:scale-95 group"
                        >
                            <div className="flex items-center gap-3">
                                View Ledger Entry <ChevronRightIcon className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all"/>
                            </div>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const ExpenseRow: React.FC<ExpenseRowProps> = ({ expense, isExpanded, onToggle, onAction, onViewLedger, viewCurrency }) => {
    const handleCopyId = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(`EXP-${expense.id}`);
    };

    return (
        <div className={`transition-all duration-700 ${isExpanded ? 'my-12 z-20 scale-[1.01]' : 'z-10'}`}>
            <div 
                className={`
                    relative flex flex-col rounded-[3rem] border transition-all duration-700 overflow-hidden
                    ${isExpanded 
                        ? 'bg-[#0F1217] border-white/20 shadow-[0_64px_128px_-32px_rgba(0,0,0,1)] ring-1 ring-white/5' 
                        : 'bg-[#0A0A0C] border-white/5 hover:bg-white/[0.02] hover:border-white/10 hover:shadow-2xl'
                    }
                `}
            >
                {/* --- HEADER BLOCK --- */}
                <div 
                    onClick={onToggle}
                    className={`p-7 md:p-12 flex items-center justify-between gap-10 cursor-pointer transition-all ${isExpanded ? 'border-b border-white/[0.04]' : ''}`}
                >
                    <div className="flex items-center gap-12 min-w-0">
                        {/* Temporal Node */}
                        <div className="flex flex-col items-center gap-1 shrink-0 px-2">
                            <p className="text-[13px] font-mono font-black text-white/40 uppercase tracking-widest leading-none">
                                {new Date(expense.expense_date).toLocaleDateString('en-GB', { day: '2-digit' })}
                            </p>
                            <p className="text-[10px] font-mono font-black text-white/20 uppercase tracking-[0.2em] leading-none mt-1">
                                {new Date(expense.expense_date).toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}
                            </p>
                        </div>

                        {/* Identification Block */}
                        <div className="hidden sm:block shrink-0">
                            <span className="px-5 py-2.5 bg-white/[0.03] border border-white/5 text-[9px] font-black text-white/30 rounded-xl uppercase tracking-[0.3em] shadow-inner">
                                {expense.category_name?.replace(/_/g, ' ') || 'OPERATIONAL'}
                            </span>
                        </div>

                        <div className="min-w-0 flex-grow">
                            <h4 className={`text-xl font-black truncate uppercase tracking-tight transition-all duration-700 leading-none ${isExpanded ? 'text-primary' : 'text-white/80 group-hover:text-white'}`}>
                                {expense.description}
                            </h4>
                            <div className="flex items-center gap-4 mt-3">
                                <button 
                                    onClick={handleCopyId}
                                    className="flex items-center gap-2 text-[10px] font-mono text-white/20 hover:text-white/40 transition-colors uppercase tracking-[0.3em]"
                                >
                                    REF: EXP-{expense.id} <CopyIcon className="w-3.5 h-3.5 opacity-40" />
                                </button>
                                <span className="w-1 h-1 rounded-full bg-white/10"></span>
                                <span className="text-[10px] font-black text-white/10 uppercase tracking-[0.2em] truncate max-w-[150px]">{expense.vendor_name || 'INTERNAL'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-12 shrink-0">
                        {/* Magnitude Display */}
                        <div className="text-right">
                            <p className={`text-3xl font-black tabular-nums tracking-tighter transition-all duration-500 leading-none ${isExpanded ? 'text-white scale-105' : 'text-white/70'}`}>
                                {formatCurrency(expense.amount, viewCurrency)}
                            </p>
                        </div>
                        
                        <div className="hidden md:block">
                            <StatusChip status={expense.status} />
                        </div>

                        <motion.div 
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                            className={`p-4 rounded-full border transition-all shadow-xl ${isExpanded ? 'bg-primary text-white border-primary shadow-primary/20' : 'bg-white/5 border-white/5 text-white/20'}`}
                        >
                            <ChevronDownIcon className="w-6 h-6" />
                        </motion.div>
                    </div>
                </div>

                {/* --- EXPANDED FORENSIC VIEW --- */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                            className="hidden md:block overflow-hidden"
                        >
                            <ExpenseDetailContent 
                                expense={expense} 
                                viewCurrency={viewCurrency} 
                                onAction={onAction} 
                                onViewLedger={onViewLedger}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

const ChevronRightIcon = ({className}:{className?:string}) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="9 18 15 12 9 6"></polyline></svg>
);

export default ExpenseRow;
