import React, { useState, useEffect } from 'react';
import { Invoice } from '../../types';
import { motion } from 'framer-motion';
import { XIcon } from '../icons/XIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { SchoolIcon } from '../icons/SchoolIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { StorageService, BUCKETS } from '../../services/storage';
import Spinner from '../common/Spinner';

interface InvoicePreviewModalProps {
    invoice: Invoice;
    onClose: () => void;
    onDownload?: () => void;
}

const formatCurrency = (amount: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2
    }).format(amount || 0);
};

const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({ invoice, onClose }) => {
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAsset = async () => {
            if (!invoice.pdf_path) {
                setLoading(false);
                return;
            }
            try {
                // ENSURE WE ARE FETCHING FROM THE EXPENSES BUCKET
                const url = await StorageService.getSignedUrl(BUCKETS.EXPENSES, invoice.pdf_path);
                setSignedUrl(url);
            } catch (e) {
                console.error("Asset decryption failure:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchAsset();
    }, [invoice.pdf_path]);

    const handleDownload = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[3000] flex items-center justify-center p-0 md:p-6 lg:p-10 animate-in fade-in duration-500" onClick={onClose}>
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #invoice-artifact-container, #invoice-artifact-container * { visibility: visible; }
                    #invoice-artifact-container {
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
                }
            `}</style>

            <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-[#0f1115] w-full max-w-[1400px] h-full md:h-[90vh] md:rounded-[4rem] shadow-[0_120px_240px_-40px_rgba(0,0,0,1)] flex flex-col overflow-hidden border border-white/10 ring-1 ring-white/5"
                onClick={e => e.stopPropagation()}
            >
                {/* Header Context */}
                <div className="p-8 border-b border-white/5 bg-white/[0.01] flex justify-between items-center no-print">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-primary/10 rounded-2xl text-primary shadow-xl border border-primary/20">
                            <SchoolIcon className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-xl font-serif font-black text-white tracking-tight uppercase leading-none">Institutional Artifact Review</h3>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-widest">{invoice.invoice_id}</span>
                                <div className="w-1 h-1 rounded-full bg-white/10"></div>
                                <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Digital Ledger Entry</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-2xl hover:bg-white/5 text-white/30 hover:text-white transition-all border border-transparent hover:border-white/10"><XIcon className="w-6 h-6" /></button>
                </div>

                {/* Main Content: Split Viewer */}
                <div className="flex-grow flex flex-col lg:flex-row overflow-hidden">

                    {/* Left Pane: Actual Document Viewer */}
                    <div className="flex-1 bg-black/40 border-r border-white/5 relative flex items-center justify-center p-8 no-print">
                        {loading ? (
                            <div className="text-center space-y-6">
                                <Spinner size="lg" className="text-primary" />
                                <p className="text-[10px] font-black uppercase text-white/20 tracking-[0.5em] animate-pulse">Decrypting Asset</p>
                            </div>
                        ) : signedUrl ? (
                            <div className="w-full h-full rounded-3xl overflow-hidden shadow-3xl ring-1 ring-white/10 bg-white/5">
                                {invoice.pdf_path?.toLowerCase().endsWith('.pdf') ? (
                                    <iframe src={`${signedUrl}#toolbar=0`} className="w-full h-full border-none" title="Invoice PDF" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center p-4">
                                        <img src={signedUrl} alt="Invoice Artifact" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center opacity-20 space-y-4">
                                <ShieldCheckIcon className="w-20 h-20 mx-auto" />
                                <p className="font-serif italic text-lg">Identity Handshake Failure: Artifact unreachable.</p>
                            </div>
                        )}
                    </div>

                    {/* Right Pane: Summary Document (Printable) */}
                    <div id="invoice-artifact-container" className="w-full lg:w-[480px] flex-shrink-0 bg-white overflow-y-auto custom-scrollbar p-12 md:p-16 space-y-16 relative">
                        {/* Security Watermark */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] rotate-[-25deg]">
                            <ShieldCheckIcon className="w-96 h-96 text-slate-900" />
                        </div>

                        <div className="relative z-10 space-y-10">
                            <div className="space-y-4">
                                <h4 className="text-4xl font-serif font-black text-slate-900 uppercase tracking-tighter leading-[0.85]">UNIVERSEPI <br />ACADEMY.</h4>
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Central Registry Node • HO_DEPLOY_24</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pt-1">Validated by Fiscal Protocol v25.0</p>
                                </div>
                            </div>

                            <div className="flex justify-between items-end border-t border-slate-100 pt-10">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Temporal Node</p>
                                    <p className="text-base font-black text-slate-900 uppercase tracking-widest">{new Date(invoice.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                </div>
                                <span className={`px-5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.3em] border shadow-sm ${invoice.status === 'FINAL' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                    }`}>{invoice.status || 'FINAL'}</span>
                            </div>

                            <div className="space-y-10 py-10 border-y border-slate-100">
                                <div>
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-6">Manifest Description</h5>
                                    <p className="text-xl font-black text-slate-900 uppercase tracking-tight leading-snug">Institutional Operational Allocation</p>
                                    <p className="text-xs text-slate-400 font-bold mt-2 uppercase tracking-widest">Internal Disbursement Logic</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400 font-bold uppercase tracking-wider">Base Magnitude</span>
                                        <span className="text-slate-800 font-mono font-black">{formatCurrency(invoice.base_amount, invoice.currency)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400 font-bold uppercase tracking-wider">Governance Levy (18%)</span>
                                        <span className="text-slate-800 font-mono font-black">{formatCurrency(invoice.tax_amount, invoice.currency)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-10 flex flex-col items-end gap-10">
                                <div className="text-right">
                                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em] mb-4">Grand Valuation</p>
                                    <p className="text-[56px] font-black text-slate-900 tracking-tighter font-serif leading-none">{formatCurrency(invoice.total_amount, invoice.currency)}</p>
                                </div>

                                <div className="w-full pt-10 border-t border-slate-900 flex justify-between items-end">
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Signature Node</p>
                                        <p className="font-serif italic text-2xl text-slate-900 opacity-90 tracking-tight border-b-2 border-slate-100 pb-1">Institutional Core</p>
                                    </div>
                                    <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center text-white shadow-xl">
                                        <ShieldCheckIcon className="w-8 h-8" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-8 border-t border-white/5 bg-black/40 flex flex-col sm:flex-row justify-between items-center gap-6 no-print z-30">
                    <div className="flex items-center gap-4 text-white/30">
                        <div className="relative">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]"></div>
                            <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">Verified by Audit Protocol</span>
                    </div>
                    <div className="flex gap-4 w-full sm:w-auto">
                        <button onClick={onClose} className="px-8 py-3 text-[10px] font-black text-white/30 hover:text-white uppercase tracking-[0.2em] transition-all">Dismiss</button>
                        <button
                            onClick={handleDownload}
                            className="flex-1 sm:flex-none px-10 py-5 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-4 active:scale-95 transform hover:-translate-y-1 shadow-indigo-600/20 border border-white/10"
                        >
                            <DownloadIcon className="w-5 h-5" /> Download Artifact
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default InvoicePreviewModal;