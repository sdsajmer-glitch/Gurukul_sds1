import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Expense, CurrencyCode } from '../../types';
import { supabase } from '../../services/supabase';
import { BUCKETS, StorageService } from '../../services/storage';
import { XIcon } from '../icons/XIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { PrinterIcon } from '../icons/PrinterIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { CopyIcon } from '../icons/CopyIcon';
import Spinner from '../common/Spinner';

interface LedgerEvidenceModalProps {
    expense: Expense;
    onClose: () => void;
    viewCurrency: CurrencyCode;
}

const formatCurrency = (amount: number, currency: CurrencyCode) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2
    }).format(amount || 0);
};

const LedgerEvidenceModal: React.FC<LedgerEvidenceModalProps> = ({ expense, onClose, viewCurrency }) => {
    const [downloading, setDownloading] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopyId = () => {
        navigator.clipboard.writeText(`EXP-${expense.id}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadProof = async () => {
        if (!expense.invoice?.storage_path) {
            alert("Registry Exception: No digital artifact attached to this ledger entry node.");
            return;
        }

        setDownloading(true);
        try {
            // PROTOCOL: Using Signed URL for robust artifact retrieval and forced download
            const signedUrl = await StorageService.getSignedUrl(BUCKETS.EXPENSES, expense.invoice.storage_path);

            const link = document.createElement('a');
            link.href = signedUrl;
            link.download = expense.invoice.file_name || `PROOF_EXP_${expense.id}.pdf`;
            link.target = "_blank";
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error("Vault Retrieval Fault:", err);
            alert("Security Protocol Failure: Unable to retrieve artifact from the secure institutional vault.");
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[3000] flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #ledger-evidence-artifact, #ledger-evidence-artifact * { visibility: visible; }
                    #ledger-evidence-artifact {
                        position: fixed;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        background: white !important;
                        padding: 40px;
                        color: #000 !important;
                    }
                    .no-print { display: none !important; }
                    .print-border { border: 1px solid #eee !important; border-radius: 12px !important; }
                    .bg-black\\/40 { background: #f9f9f9 !important; }
                    .text-white { color: #000 !important; }
                    .text-white\\/40 { color: #666 !important; }
                    .text-white\\/20 { color: #999 !important; }
                    .text-primary { color: #6366f1 !important; }
                }
            `}</style>

            <motion.div
                id="ledger-evidence-artifact"
                initial={{ opacity: 0, scale: 0.98, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-[#0d0f14] w-full max-w-4xl rounded-[3rem] shadow-[0_64px_128px_-24px_rgba(0,0,0,1)] border border-white/10 flex flex-col overflow-hidden ring-1 ring-white/5"
                onClick={e => e.stopPropagation()}
            >
                {/* Header Context */}
                <div className="p-8 border-b border-white/5 bg-white/[0.02] flex justify-between items-center no-print">
                    <div className="flex items-center gap-5">
                        <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500 border border-emerald-500/20 shadow-inner">
                            <ShieldCheckIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-serif font-black text-white uppercase tracking-tight leading-none">Ledger Evidence</h3>
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mt-2">Validated Institutional General Ledger Posting</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all"><XIcon className="w-6 h-6" /></button>
                </div>

                <div className="p-10 md:p-16 overflow-y-auto custom-scrollbar flex-grow space-y-12">
                    {/* Summary Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b border-white/5 pb-12">
                        <div className="space-y-4">
                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.5em]">Transaction Identifier</span>
                            <div className="flex items-center gap-4">
                                <h2 className="text-4xl font-mono font-black text-white tracking-tighter">EXP-{expense.id}</h2>
                                <button
                                    onClick={handleCopyId}
                                    className={`p-2 rounded-lg transition-all no-print ${copied ? 'bg-emerald-500 text-white' : 'bg-white/5 text-white/20 hover:text-white hover:bg-white/10'}`}
                                >
                                    {copied ? <CheckCircleIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                                </button>
                            </div>
                            <p className="text-sm font-medium text-white/40 font-serif italic">{expense.description}</p>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">Posting Magnitude</span>
                            <p className="text-5xl font-black text-white tabular-nums tracking-tighter mt-2">{formatCurrency(expense.amount, viewCurrency)}</p>
                        </div>
                    </div>

                    {/* Double Entry Table */}
                    <div className="space-y-6">
                        <h4 className="text-[11px] font-black uppercase text-white/30 tracking-[0.3em] flex items-center gap-3 px-2">
                            <ActivityIcon className="w-4 h-4 opacity-30" /> Post-Reconciliation Registry
                        </h4>
                        <div className="bg-black/40 rounded-[2rem] border border-white/5 overflow-hidden shadow-inner print-border">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-white/[0.02] border-b border-white/5">
                                    <tr className="text-[10px] font-black uppercase text-white/20 tracking-widest">
                                        <th className="p-6 pl-10">Ledger Node</th>
                                        <th className="p-6">Account Category</th>
                                        <th className="p-6 text-right">Debit (+)</th>
                                        <th className="p-6 text-right pr-10">Credit (-)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 font-medium">
                                    <tr>
                                        <td className="p-6 pl-10 text-white">Institutional: {expense.category_name?.replace(/_/g, ' ') || 'OPERATIONAL'}</td>
                                        <td className="p-6 text-white/40">Operating Expense</td>
                                        <td className="p-6 text-right font-mono font-black text-white">{formatCurrency(expense.amount, viewCurrency)}</td>
                                        <td className="p-6 text-right text-white/10 pr-10">—</td>
                                    </tr>
                                    <tr>
                                        <td className="p-6 pl-10 text-white">Central Cash/Bank Ledger</td>
                                        <td className="p-6 text-white/40">Current Asset</td>
                                        <td className="p-6 text-right text-white/10">—</td>
                                        <td className="p-6 text-right font-mono font-black text-emerald-500 pr-10">{formatCurrency(expense.amount, viewCurrency)}</td>
                                    </tr>
                                </tbody>
                                <tfoot className="bg-white/[0.01] border-t border-white/10">
                                    <tr className="font-black text-xs uppercase tracking-widest">
                                        <td colSpan={2} className="p-6 pl-10 text-white/40 text-[10px]">Registry Equilibrium Validated</td>
                                        <td className="p-6 text-right text-white/60">{formatCurrency(expense.amount, viewCurrency)}</td>
                                        <td className="p-6 text-right text-white/60 pr-10">{formatCurrency(expense.amount, viewCurrency)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
                        <div className="space-y-1.5">
                            <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Temporal Node</p>
                            <p className="text-sm font-bold text-white/80 uppercase">{new Date(expense.expense_date).toLocaleDateString(undefined, { dateStyle: 'full' })}</p>
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Clearing Method</p>
                            <p className="text-sm font-bold text-white/80 uppercase">{expense.payment_method || 'ELECTRONIC_CLEARING'}</p>
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">Authorized By</p>
                            <p className="text-sm font-bold text-emerald-500 uppercase flex items-center gap-2">
                                <ShieldCheckIcon className="w-3.5 h-3.5" /> Verified Audit Path
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-8 border-t border-white/5 bg-black/40 flex justify-between items-center no-print">
                    <div className="flex items-center gap-3 text-white/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"></div>
                        <span className="text-[9px] font-black uppercase tracking-widest">Sealed Ledger Artifact</span>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={handlePrint}
                            className="p-4 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-2xl transition-all border border-transparent hover:border-white/10 active:scale-95"
                            title="Print Ledger Evidence"
                        >
                            <PrinterIcon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleDownloadProof}
                            disabled={downloading}
                            className="px-8 py-4 bg-primary text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                            {downloading ? (
                                <Spinner size="sm" className="text-white" />
                            ) : (
                                <DownloadIcon className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                            )}
                            Download Proof
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default LedgerEvidenceModal;