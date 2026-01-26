import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase, formatError } from '../../services/supabase';
import { BUCKETS, StorageService } from '../../services/storage';
import Spinner from '../common/Spinner';
import { XIcon } from '../icons/XIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { FileTextIcon } from '../icons/FileTextIcon';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { EyeIcon } from '../icons/EyeIcon';
import { motion, AnimatePresence } from 'framer-motion';

interface AddExpenseModalProps {
    onClose: () => void;
    onSave: () => void;
    branchId: number | null;
}

const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ onClose, onSave, branchId }) => {
    const [formData, setFormData] = useState({
        categoryId: '',
        amount: '',
        vendor_name: '',
        expense_date: new Date().toISOString().split('T')[0],
        description: '', 
        payment_mode: 'Online Transfer',
    });
    
    const [categories, setCategories] = useState<any[]>([]);
    const [loadingMetadata, setLoadingMetadata] = useState(false);
    const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [receiptNo, setReceiptNo] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchMetadata = useCallback(async () => {
        setLoadingMetadata(true);
        try {
            const { data: catRes } = await supabase.from('expense_categories').select('*').order('name');
            if (catRes) setCategories(catRes);
        } catch (err) {
            console.error("Metadata Sync Failure:", err);
        } finally {
            setLoadingMetadata(false);
        }
    }, []);

    useEffect(() => {
        fetchMetadata();
    }, [fetchMetadata]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 10 * 1024 * 1024) {
                setError("Artifact payload exceeds 10MB limit.");
                return;
            }
            setInvoiceFile(file);
            setError(null);
        }
    };

    const handlePreviewLocal = () => {
        if (!invoiceFile) return;
        const url = URL.createObjectURL(invoiceFile);
        window.open(url, '_blank');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const catId = parseInt(formData.categoryId);
        if (isNaN(catId)) {
            setError("Identity Exception: Select a Center Node (Category) from the registry.");
            return;
        }

        setLoading(true);
        setError(null);
        
        try {
            // PROTOCOL: branchId must be validated to avoid RLS/FK faults
            if (branchId === null || branchId === undefined) {
                throw new Error("Handshake Failure: No active branch context detected.");
            }

            const numericAmount = parseFloat(formData.amount);
            if (isNaN(numericAmount) || numericAmount <= 0) {
                throw new Error("Magnitude Error: Positive allocation magnitude required.");
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Security Exception: Authenticated session node expired.");

            let filePath = null;
            if (invoiceFile) {
                const catName = categories.find(c => c.id.toString() === formData.categoryId)?.name || 'uncategorized';
                filePath = StorageService.getExpensePath(branchId, catName, invoiceFile.name);
                
                // CRITICAL: Upload artifact to 'expenses' bucket. 
                // Ensure storage RLS policies allow authenticated inserts.
                const { error: uploadError } = await supabase.storage.from(BUCKETS.EXPENSES).upload(filePath, invoiceFile);
                if (uploadError) {
                    console.error("Artifact Upload Fault:", uploadError);
                    throw new Error(`Storage Protocol Failure: ${uploadError.message || 'Unauthorized access to expenses bucket.'}`);
                }
            }

            // ATOMIC SYNC: Using RPC (v3) with SECURITY DEFINER to seal the record.
            const { data, error: rpcError } = await supabase.rpc('admin_record_expense_v3', {
                p_branch_id: Number(branchId),
                p_category_id: catId,
                p_amount: numericAmount,
                p_vendor_name: formData.vendor_name.trim() || 'Internal Disbursement',
                p_expense_date: formData.expense_date,
                p_description: formData.description.trim().toUpperCase(),
                p_payment_mode: formData.payment_mode,
                p_recorded_by: user.id,
                p_file_name: invoiceFile?.name || null,
                p_storage_path: filePath,
                p_file_size: invoiceFile?.size || null,
                p_mime_type: invoiceFile?.type || null
            });
            
            if (rpcError) throw rpcError;
            
            if (data && data.success) {
                setReceiptNo(`EXP-${data.id}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`);
                setSuccess(true);
                setTimeout(() => {
                    onSave();
                    onClose();
                }, 2500);
            } else {
                throw new Error(data?.message || "Fiscal registry rejected the payload.");
            }
        } catch (err: any) {
            setError(formatError(err));
        } finally {
            setLoading(false);
        }
    };

    const isFormValid = formData.categoryId && formData.amount && formData.description;

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[200] flex items-center justify-center p-4 animate-in fade-in duration-500" onClick={onClose}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.98, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-[#0a0a0c] w-full max-w-2xl rounded-[3.5rem] shadow-[0_64px_128px_-24px_rgba(0,0,0,1)] border border-white/10 flex flex-col overflow-hidden max-h-[95vh] ring-1 ring-white/5" 
                onClick={e => e.stopPropagation()}
            >
                <AnimatePresence mode="wait">
                    {success ? (
                        <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-20 text-center space-y-12">
                            <div className="relative inline-block">
                                <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full"></div>
                                <div className="relative w-32 h-32 bg-emerald-500/10 text-emerald-500 rounded-[3rem] flex items-center justify-center mx-auto border border-emerald-500/20 shadow-inner ring-8 ring-emerald-500/5">
                                    <CheckCircleIcon animate className="w-16 h-16"/>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-4xl font-serif font-black text-white uppercase tracking-tighter leading-none">Entry Logged.</h3>
                                <p className="text-white/40 font-serif italic text-lg leading-relaxed">Disbursement successfully archived in ledger.</p>
                            </div>
                            <div className="bg-black/60 p-10 rounded-[2.5rem] border border-white/5 shadow-inner max-w-xs mx-auto relative overflow-hidden">
                                <p className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em] mb-4">Registry Trace</p>
                                <p className="text-3xl font-mono font-black text-primary tracking-widest uppercase leading-none">{receiptNo}</p>
                            </div>
                        </motion.div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col h-full">
                            <header className="p-10 border-b border-white/5 bg-white/[0.02] flex justify-between items-center relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent opacity-40 pointer-events-none"></div>
                                <div className="flex items-center gap-6 relative z-10">
                                    <div className="p-4 bg-primary/10 rounded-2xl text-primary shadow-inner border border-primary/20 ring-4 ring-primary/5">
                                        <BriefcaseIcon className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-serif font-black text-white tracking-tight uppercase leading-none">Record Expense</h2>
                                        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em] mt-2">Verified Institutional Disbursement</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 relative z-10">
                                     <div className="flex items-center gap-3 bg-black/60 border border-white/5 px-4 py-2.5 rounded-xl shadow-inner">
                                        <CalendarIcon className="w-3.5 h-3.5 text-white/20"/>
                                        <input 
                                            type="date" 
                                            value={formData.expense_date} 
                                            onChange={e => setFormData({...formData, expense_date: e.target.value})} 
                                            required 
                                            className="bg-transparent text-[11px] font-mono font-black text-white outline-none cursor-pointer uppercase tracking-widest"
                                        />
                                    </div>
                                    <button onClick={onClose} type="button" className="p-2.5 rounded-xl hover:bg-white/5 text-white/40 transition-all"><XIcon className="w-5 h-5"/></button>
                                </div>
                            </header>

                            <main className="p-10 space-y-12 overflow-y-auto custom-scrollbar flex-grow bg-[#0a0a0c]">
                                {error && (
                                    <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-[2rem] flex items-center gap-4 shadow-2xl animate-in shake">
                                        <AlertTriangleIcon className="w-6 h-6 text-red-500 shrink-0" />
                                        <div className="flex-grow">
                                            <p className="text-[9px] font-black uppercase text-red-500/60 tracking-widest mb-1">Fiscal Sync Protocol Failure</p>
                                            <p className="text-xs font-bold text-red-400 leading-relaxed uppercase tracking-wider">{error}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.4em] ml-1">Center Node (Category)</label>
                                    <div className="relative">
                                        <select 
                                            value={formData.categoryId} 
                                            onChange={e => setFormData({...formData, categoryId: e.target.value})} 
                                            className="w-full h-16 px-6 text-[13px] font-black text-white bg-black/40 border border-white/5 rounded-2xl outline-none appearance-none cursor-pointer uppercase tracking-[0.2em] focus:border-primary/50 focus:ring-8 focus:ring-primary/5 transition-all shadow-inner"
                                            required
                                        >
                                            <option value="" disabled className="bg-[#0a0a0c]">SELECT AN ITEM IN THE LIST...</option>
                                            {categories.map(c => <option key={c.id} value={c.id} className="bg-[#0a0a0c]">{c.name.replace(/_/g, ' ')}</option>)}
                                        </select>
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-white/20"><ChevronDownIcon className="w-4 h-4"/></div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.4em] ml-1">Magnitude</label>
                                    <div className="bg-[#12141c]/50 border border-white/5 p-2 rounded-[2rem] shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]">
                                        <div className="relative group/amount">
                                            <span className="absolute left-10 top-1/2 -translate-y-1/2 text-4xl font-serif font-black text-primary opacity-40">₹</span>
                                            <input 
                                                type="number" 
                                                value={formData.amount} 
                                                onChange={e => setFormData({...formData, amount: e.target.value})} 
                                                required 
                                                className="w-full h-28 pl-24 pr-12 text-5xl md:text-6xl font-mono font-black text-white bg-transparent border-none focus:ring-0 text-right tracking-tighter placeholder:text-white/5" 
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <label className="text-[9px] font-black uppercase text-white/20 tracking-[0.4em] ml-1">Identifier / Purpose</label>
                                        <div className="relative">
                                            <FileTextIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/10" />
                                            <input 
                                                type="text" 
                                                value={formData.description} 
                                                onChange={e => setFormData({...formData, description: e.target.value.toUpperCase()})} 
                                                className="w-full h-14 pl-12 pr-4 bg-black/40 border border-white/5 rounded-xl text-sm font-bold text-white focus:bg-black/60 outline-none uppercase tracking-widest shadow-inner placeholder:text-white/5" 
                                                placeholder="E.G. FACILITY_MAINTENANCE"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-[9px] font-black uppercase text-white/20 tracking-[0.4em] ml-1">Vendor Context</label>
                                        <div className="relative">
                                            <UsersIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/10" />
                                            <input 
                                                type="text" 
                                                value={formData.vendor_name} 
                                                onChange={e => setFormData({...formData, vendor_name: e.target.value.toUpperCase()})} 
                                                className="w-full h-14 pl-12 pr-4 bg-black/40 border border-white/5 rounded-xl text-sm font-bold text-white focus:bg-black/60 outline-none uppercase tracking-widest shadow-inner placeholder:text-white/5" 
                                                placeholder="PROVIDER_NAME"
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                     <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.4em] ml-1">Artifact Sync (Invoice)</label>
                                     <div 
                                        className={`p-10 border-2 border-dashed rounded-[2.5rem] text-center cursor-pointer transition-all duration-700 bg-black/40 ${invoiceFile ? 'border-emerald-500/40 bg-emerald-500/[0.03]' : 'border-white/5 hover:border-primary/40 hover:bg-white/[0.01]'}`}
                                        onClick={() => fileInputRef.current?.click()}
                                     >
                                        <div className={`p-4 rounded-xl w-fit mx-auto mb-4 ${invoiceFile ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-white/5 text-white/20'}`}>
                                            <UploadIcon className="w-6 h-6"/>
                                        </div>
                                        <div className="flex flex-col items-center gap-2">
                                            <p className={`text-xl font-serif font-black transition-colors uppercase tracking-tight ${invoiceFile ? 'text-white' : 'text-white/20'}`}>
                                                {invoiceFile ? invoiceFile.name : 'BIND ARCHIVE PAYLOAD'}
                                            </p>
                                            {invoiceFile && (
                                                <button 
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handlePreviewLocal(); }}
                                                    className="flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase text-white/40 hover:text-primary transition-all backdrop-blur-md"
                                                >
                                                    <EyeIcon className="w-3.5 h-3.5" /> Preview Selected
                                                </button>
                                            )}
                                        </div>
                                        {invoiceFile && (
                                            <div className="flex items-center justify-center gap-2 mt-4 animate-in fade-in zoom-in-95">
                                                <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">✔ Encrypted Storage Prepared</span>
                                            </div>
                                        )}
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                                     </div>
                                </div>
                            </main>

                            <footer className="p-10 border-t border-white/5 bg-black/60 flex flex-col md:flex-row justify-between items-center gap-8 relative z-30">
                                <button type="button" onClick={onClose} className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20 hover:text-white transition-all order-2 md:order-1">Abort Procedure</button>
                                <button 
                                    type="submit" 
                                    disabled={loading || !isFormValid} 
                                    className={`w-full md:w-auto px-20 py-7 text-xs font-black uppercase tracking-[0.5em] rounded-[2rem] transition-all transform active:scale-95 disabled:opacity-20 flex items-center justify-center gap-5 ring-8 group shadow-2xl shadow-primary/10 ${
                                        isFormValid 
                                        ? 'bg-primary text-white hover:bg-primary/90 ring-primary/5' 
                                        : 'bg-white/5 text-white/20 cursor-not-allowed grayscale border border-white/5'
                                    }`}
                                >
                                    {loading ? <Spinner size="sm" className="text-white" /> : <><ShieldCheckIcon className="w-5 h-6 group-hover:rotate-12 transition-transform duration-500" /> Confirm Allocation</>}
                                </button>
                            </footer>
                        </form>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default AddExpenseModal;