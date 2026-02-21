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
                                <div className="absolute inset-0 bg-emerald-500/20 blur-[100px] rounded-full"></div>
                                <div className="relative w-40 h-40 bg-emerald-500/10 text-emerald-500 rounded-[3rem] flex items-center justify-center mx-auto border border-emerald-500/20 shadow-inner ring-[12px] ring-emerald-500/5">
                                    <CheckCircleIcon className="w-20 h-20" />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-4xl font-serif font-black text-white uppercase tracking-tighter leading-none">Batch Committed</h3>
                                <p className="text-white/30 text-sm font-medium tracking-wide">{stats?.count} institutional ledger nodes have been initialized.</p>
                            </div>
                        </motion.div>
                    ) : step === 'processing' ? (
                        <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-32 text-center space-y-12">
                            <div className="relative flex justify-center">
                                <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full animate-pulse"></div>
                                <Spinner size="lg" className="text-primary" />
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Integrating Payload</h4>
                                <p className="text-primary/40 text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">Processing Accounts...</p>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="flex flex-col">
                            <header className="p-12 border-b border-white/[0.04] bg-white/[0.01] backdrop-blur-3xl flex justify-between items-center relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] to-transparent"></div>
                                <div className="flex items-center gap-8 relative z-10">
                                    <div className="p-5 bg-primary/10 rounded-[1.5rem] text-primary shadow-2xl border border-primary/20 group-hover:rotate-180 transition-all duration-1000 ring-2 ring-primary/5">
                                        <RefreshIcon className="w-8 h-8" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <h3 className="text-3xl font-serif font-black text-white uppercase tracking-tighter leading-none">Billing Engine</h3>
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Institutional Mass Invoicing</p>
                                        </div>
                                    </div>
                                </div>
                                <button type="button" onClick={onClose} className="p-4 rounded-2xl hover:bg-white/5 text-white/20 hover:text-white transition-all border border-transparent hover:border-white/10 group/close"><XIcon className="w-6 h-6 group-hover/close:rotate-90 transition-transform duration-300 opacity-40" /></button>
                            </header>

                            <main className="p-12 space-y-12 overflow-y-auto flex-grow relative bg-transparent">
                                {error && (
                                    <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-[2.5rem] flex flex-col gap-4 shadow-2xl animate-in shake relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent"></div>
                                        <div className="flex items-center gap-4 relative z-10">
                                            <AlertTriangleIcon className="w-6 h-6 text-red-500 shrink-0" />
                                            <p className="text-[10px] font-black uppercase text-red-500 tracking-[0.4em]">Batch Protocol Violation</p>
                                        </div>
                                        <p className="text-sm font-medium text-red-400 leading-relaxed uppercase tracking-tight relative z-10">{error}</p>
                                    </div>
                                )}

                                <div className="space-y-10">
                                    <div className="space-y-5">
                                        <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.5em] ml-2">Target Registry Segment</label>
                                        <div className="relative group/nexus">
                                            <select
                                                value={formData.classId}
                                                onChange={e => setFormData({ ...formData, classId: e.target.value })}
                                                className="w-full bg-white/[0.02] border border-white/5 rounded-[2rem] p-8 text-[12px] font-black text-white focus:ring-[15px] focus:ring-primary/5 focus:border-primary/40 outline-none cursor-pointer shadow-2xl uppercase tracking-[0.2em] transition-all appearance-none shadow-inner"
                                            >
                                                <option value="" className="bg-[#0c0d12]">SELECT_ACADEMIC_NODE...</option>
                                                {classes.map(c => <option key={c.id} value={c.id} className="bg-[#0c0d12]">{c.name} ({c.academic_year})</option>)}
                                            </select>
                                            <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-6">
                                                <div className="w-px h-8 bg-white/5" />
                                                <SchoolIcon className="w-6 h-6 text-white/20 group-hover/nexus:text-primary transition-colors" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-10">
                                        <div className="space-y-5">
                                            <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.5em] ml-2">Lifecycle Month</label>
                                            <div className="relative group/month">
                                                <select
                                                    value={formData.month}
                                                    onChange={e => setFormData({ ...formData, month: e.target.value })}
                                                    className="w-full bg-white/[0.02] border border-white/5 rounded-[2rem] p-8 text-[12px] font-black text-white focus:ring-[15px] focus:ring-primary/5 focus:border-primary/40 outline-none cursor-pointer shadow-2xl uppercase tracking-[0.2em] transition-all appearance-none shadow-inner"
                                                >
                                                    {MONTHS.map(m => <option key={m} value={m} className="bg-[#0c0d12]">{m.toUpperCase()}</option>)}
                                                </select>
                                                <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none text-white/10 group-hover/month:text-primary transition-colors"><CalendarIcon className="w-6 h-6" /></div>
                                            </div>
                                        </div>
                                        <div className="space-y-5">
                                            <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.5em] ml-2">Final Clearance Date</label>
                                            <div className="relative group/due">
                                                <input
                                                    type="date"
                                                    value={formData.dueDate}
                                                    onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                                                    className="w-full bg-white/[0.02] border border-white/5 rounded-[2rem] p-8 text-[12px] font-black text-white focus:ring-[15px] focus:ring-primary/5 focus:border-primary/40 outline-none shadow-inner transition-all uppercase tracking-widest"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-10 bg-primary/5 border border-primary/20 rounded-[3rem] flex items-start gap-8 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none"></div>
                                    <ShieldCheckIcon className="w-8 h-8 text-primary mt-1 shrink-0 group-hover:scale-110 transition-transform" />
                                    <div className="relative z-10">
                                        <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] mb-2">Protocol Integrity Authorization</p>
                                        <p className="text-[11px] text-white/40 leading-relaxed font-serif italic">
                                            Executing this lifecycle event will generate unique liability modules for all student entities in the selected node. Underlying Fee Masters will be version-locked upon commitment.
                                        </p>
                                    </div>
                                </div>
                            </main>

                            <footer className="p-12 border-t border-white/[0.04] bg-white/[0.01] flex flex-col md:flex-row justify-between items-center gap-10 relative z-30">
                                <button type="button" onClick={onClose} className="text-[10px] font-black uppercase tracking-[0.5em] text-white/10 hover:text-white transition-all order-2 md:order-1 flex items-center gap-3 active:scale-95 group/abort">
                                    <XIcon className="w-4 h-4 group-hover/abort:rotate-90 transition-transform" /> TERMINATE_ENGINE
                                </button>
                                <button
                                    onClick={handleExecute}
                                    disabled={loading || !formData.classId}
                                    className="relative w-full md:w-auto min-w-[340px] h-24 bg-primary text-white font-black text-[12px] uppercase tracking-[0.3em] rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(var(--primary),0.6)] hover:bg-[#8B5CF6] transition-all transform active:scale-95 disabled:opacity-20 flex items-center justify-center gap-6 ring-[12px] ring-primary/5 group overflow-hidden"
                                >
                                    {loading ? <Spinner size="sm" className="text-white" /> : <><ShieldCheckIcon className="w-6 h-6 group-hover:scale-110 transition-transform" /> COMMIT_LIFECYCLE_RUN</>}
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10 overflow-hidden"><motion.div className="h-full bg-white/40" animate={{ x: ['-100%', '100%'] }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} /></div>
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