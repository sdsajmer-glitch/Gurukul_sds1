import React, { useState, useEffect } from 'react';
import { supabase, formatError } from '../../services/supabase';
import { SchoolClass } from '../../types';
import Spinner from '../common/Spinner';
import { XIcon } from '../icons/XIcon';
import { RefreshIcon } from '../icons/RefreshIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { SchoolIcon } from '../icons/SchoolIcon';
import { motion, AnimatePresence } from 'framer-motion';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface BillingEngineModalProps {
    branchId: number;
    onClose: () => void;
    onSuccess: () => void;
}

const BillingEngineModal: React.FC<BillingEngineModalProps> = ({ branchId, onClose, onSuccess }) => {
    const [step, setStep] = useState<'config' | 'processing' | 'success'>('config');
    const [loading, setLoading] = useState(false);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [error, setError] = useState<string | null>(null);
    
    const [formData, setFormData] = useState({
        classId: '',
        month: MONTHS[new Date().getMonth()],
        year: new Date().getFullYear().toString(),
        dueDate: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString().split('T')[0]
    });

    const [stats, setStats] = useState<{ count: number } | null>(null);

    useEffect(() => {
        const fetchClasses = async () => {
            const { data } = await supabase.from('school_classes').select('*').eq('branch_id', branchId);
            if (data) setClasses(data);
        };
        fetchClasses();
    }, [branchId]);

    const handleExecute = async () => {
        if (!formData.classId || !formData.month || !formData.year) return;
        
        setLoading(true);
        setError(null);
        setStep('processing');

        try {
            const { data, error: rpcError } = await supabase.rpc('admin_generate_bulk_invoices', {
                p_branch_id: branchId,
                p_class_id: parseInt(formData.classId),
                p_billing_month: formData.month,
                p_billing_year: formData.year,
                p_due_date: formData.dueDate
            });

            if (rpcError) throw rpcError;

            if (data.success) {
                setStats({ count: data.invoices_generated });
                setStep('success');
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 3000);
            } else {
                throw new Error(data.message);
            }
        } catch (err: any) {
            setError(formatError(err));
            setStep('config');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[200] flex items-center justify-center p-4 animate-in fade-in duration-500" onClick={onClose}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-[#0c0d12] w-full max-w-xl rounded-[3.5rem] shadow-[0_80px_160px_-24px_rgba(0,0,0,1)] border border-white/10 flex flex-col overflow-hidden ring-1 ring-white/5" 
                onClick={e => e.stopPropagation()}
            >
                <AnimatePresence mode="wait">
                    {step === 'success' ? (
                        <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-20 text-center space-y-12">
                            <div className="relative inline-block">
                                <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full"></div>
                                <div className="relative w-32 h-32 bg-emerald-500/10 text-emerald-500 rounded-[3rem] flex items-center justify-center mx-auto border border-emerald-500/20 shadow-inner ring-8 ring-emerald-500/5">
                                    <CheckCircleIcon animate className="w-16 h-16"/>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-3xl font-serif font-black text-white uppercase tracking-tight leading-none">Cycle Synchronized.</h3>
                                <p className="text-white/40 font-serif italic text-lg leading-relaxed">{stats?.count} Student Ledgers Updated.</p>
                            </div>
                        </motion.div>
                    ) : step === 'processing' ? (
                        <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-24 text-center space-y-10">
                            <Spinner size="lg" className="text-primary mx-auto" />
                            <div className="animate-pulse space-y-3">
                                <h4 className="text-xl font-serif font-black text-white uppercase tracking-tight">Integrating Payload</h4>
                                <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.4em]">Mass Ledger Handshake in Progress...</p>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="flex flex-col">
                            <header className="p-10 border-b border-white/5 bg-white/[0.02] flex justify-between items-center relative group">
                                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none opacity-40"></div>
                                <div className="flex items-center gap-6 relative z-10">
                                    <div className="p-4 bg-primary/10 rounded-2xl text-primary shadow-inner border border-primary/20">
                                        <RefreshIcon className="w-8 h-8"/>
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-serif font-black text-white uppercase tracking-tight leading-none">Billing Cycle</h3>
                                        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em] mt-2">Institutional Mass Invoicing</p>
                                    </div>
                                </div>
                                <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-white/5 text-white/30 hover:text-white transition-all"><XIcon className="w-6 h-6"/></button>
                            </header>

                            <main className="p-10 space-y-10 overflow-y-auto flex-grow relative">
                                {error && (
                                    <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-3xl flex items-start gap-5 shadow-2xl animate-in shake">
                                        <AlertTriangleIcon className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                                        <p className="text-xs font-bold text-red-200/70 leading-relaxed uppercase tracking-wider">{error}</p>
                                    </div>
                                )}

                                <div className="space-y-8">
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase text-white/40 tracking-[0.4em] ml-1">Target Academic Node</label>
                                        <div className="relative group">
                                            <select 
                                                value={formData.classId} 
                                                onChange={e => setFormData({...formData, classId: e.target.value})}
                                                className="w-full bg-black/40 border border-white/5 rounded-2xl p-6 text-[14px] font-black text-white focus:border-primary/50 outline-none appearance-none cursor-pointer shadow-inner uppercase tracking-wider"
                                            >
                                                <option value="">Select Class Section...</option>
                                                {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.academic_year})</option>)}
                                            </select>
                                            <SchoolIcon className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/10 group-hover:text-primary transition-colors pointer-events-none" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black uppercase text-white/40 tracking-[0.4em] ml-1">Period Month</label>
                                            <select 
                                                value={formData.month} 
                                                onChange={e => setFormData({...formData, month: e.target.value})}
                                                className="w-full bg-black/40 border border-white/5 rounded-2xl p-6 text-[14px] font-black text-white focus:border-primary/50 outline-none appearance-none cursor-pointer shadow-inner uppercase tracking-wider"
                                            >
                                                {MONTHS.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black uppercase text-white/40 tracking-[0.4em] ml-1">Due Date</label>
                                            <div className="relative group">
                                                <input 
                                                    type="date"
                                                    value={formData.dueDate}
                                                    onChange={e => setFormData({...formData, dueDate: e.target.value})}
                                                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-6 text-[12px] font-black text-white focus:border-primary/50 outline-none shadow-inner uppercase"
                                                />
                                                <CalendarIcon className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/10 group-hover:text-primary transition-colors pointer-events-none" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 bg-primary/5 border border-primary/20 rounded-3xl flex items-start gap-5">
                                    <ShieldCheckIcon className="w-6 h-6 text-primary mt-1 shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-white uppercase tracking-wider">Protocol Integrity Note</p>
                                        <p className="text-[11px] text-white/40 mt-1 leading-relaxed">Executing this cycle will generate unique liability modules for all students in the selected node. The underlying Fee Master will be version-locked upon commitment.</p>
                                    </div>
                                </div>
                            </main>

                            <footer className="p-10 border-t border-white/5 bg-black/40 flex flex-col md:flex-row justify-between items-center gap-8 relative z-30">
                                <button type="button" onClick={onClose} className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 hover:text-white transition-all order-2 md:order-1">Abort Procedure</button>
                                <button 
                                    onClick={handleExecute} 
                                    disabled={loading || !formData.classId} 
                                    className="w-full md:w-auto px-16 py-6 bg-primary text-primary-foreground font-black text-xs uppercase tracking-[0.5em] rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(var(--primary),0.5)] hover:bg-primary/90 transition-all transform active:scale-95 disabled:opacity-30 flex items-center justify-center gap-5 ring-8 ring-primary/5 group shadow-primary/20"
                                >
                                    {loading ? <Spinner size="sm" className="text-white" /> : <><ShieldCheckIcon className="w-5 h-5 group-hover:rotate-12 transition-transform duration-500" /> Execute Lifecycle Run</>}
                                </button>
                            </footer>
                        </div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default BillingEngineModal;