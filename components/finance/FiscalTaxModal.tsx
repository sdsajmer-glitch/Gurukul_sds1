import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon } from '../../icons/PlusIcon';
import { CalculatorIcon } from '../../icons/CalculatorIcon';
import { RefreshIcon as VersionIcon } from '../../icons/RefreshIcon';
import { supabase } from '../../../services/supabase';

interface FiscalTaxModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    branchId: number | null;
}

const FiscalTaxModal: React.FC<FiscalTaxModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    branchId
}) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        tax_name: '',
        tax_code: '',
        tax_rate: 0
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!branchId) return;
        setLoading(true);
        try {
            const { error } = await supabase.rpc('upsert_finance_tax_node', {
                p_branch_id: branchId,
                p_tax_name: formData.tax_name,
                p_tax_code: formData.tax_code,
                p_tax_rate: formData.tax_rate
            });

            if (error) throw error;
            onSuccess();
        } catch (err) {
            console.error("Tax Deployment Failure:", err);
            alert("Failed to deploy tax node. Verify branch connectivity.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-2xl"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-lg bg-[#0a0c10] border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)]"
                    >
                        {/* Header */}
                        <div className="p-10 border-b border-white/5 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-10 opacity-[0.02]">
                                <CalculatorIcon className="w-48 h-48 -rotate-12 text-indigo-500" />
                            </div>
                            <div className="flex items-center gap-6 relative z-10">
                                <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500 ring-1 ring-indigo-500/30">
                                    <CalculatorIcon className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Fiscal <span className="text-indigo-500">Tax</span> Node</h2>
                                    <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.5em] mt-1">Compliance Matrix v1.0</p>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <form onSubmit={handleSubmit} className="p-10 space-y-8">
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest pl-1">Tax Nomenclature</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="e.g., Goods & Services Tax"
                                        className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-white placeholder:text-white/10 focus:border-indigo-500/30 transition-all outline-none"
                                        value={formData.tax_name}
                                        onChange={e => setFormData({ ...formData, tax_name: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest pl-1">Tax Code</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="GST-18"
                                            className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-white uppercase font-mono placeholder:text-white/10 focus:border-indigo-500/30 transition-all outline-none"
                                            value={formData.tax_code}
                                            onChange={e => setFormData({ ...formData, tax_code: e.target.value.toUpperCase() })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest pl-1">Rate Percentage</label>
                                        <div className="relative">
                                            <input
                                                required
                                                type="number"
                                                step="0.01"
                                                placeholder="18.00"
                                                className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-white font-mono placeholder:text-white/10 focus:border-indigo-500/30 transition-all outline-none pr-12"
                                                value={formData.tax_rate}
                                                onChange={e => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) })}
                                            />
                                            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-white/20 font-bold">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-white/5 flex gap-4">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-10 py-5 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    disabled={loading}
                                    type="submit"
                                    className="flex-1 px-10 py-5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-black font-black text-[10px] uppercase tracking-[0.4em] rounded-2xl transition-all flex items-center justify-center gap-3 shadow-2xl shadow-indigo-900/40"
                                >
                                    {loading ? <VersionIcon className="w-4 h-4 animate-spin" /> : <PlusIcon className="w-4 h-4" />}
                                    Deploy Node
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default FiscalTaxModal;
