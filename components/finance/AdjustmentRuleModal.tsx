
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon } from '../icons/PlusIcon';
import { ShieldCheckIcon as SecurityIcon } from '../icons/ShieldCheckIcon';
import { RefreshIcon as VersionIcon } from '../icons/RefreshIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { supabase } from '../../services/supabase';

interface AdjustmentRuleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    branchId: any;
}

const AdjustmentRuleModal: React.FC<AdjustmentRuleModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    branchId
}) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        rule_name: '',
        adjustment_type: 'discount' as 'discount' | 'waiver',
        value_priority: 1,
        calculation_type: 'percentage' as 'percentage' | 'fixed',
        value: 0,
        is_stackable: true,
        requires_approval: true
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase.from('finance_adjustment_rules').insert([{
                ...formData,
                branch_id: branchId
            }]);

            if (error) throw error;
            onSuccess();
        } catch (err) {
            console.error("Rule Deployment Failure:", err);
            alert("Failed to deploy adjustment rule. Verify branch connectivity.");
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
                        className="relative w-full max-w-2xl bg-[#0a0c10] border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)]"
                    >
                        {/* Header */}
                        <div className="p-10 border-b border-white/5 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-10 opacity-[0.02]">
                                <UsersIcon className="w-48 h-48 -rotate-12 text-emerald-500" />
                            </div>
                            <div className="flex items-center gap-6 relative z-10">
                                <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 ring-1 ring-emerald-500/30">
                                    <UsersIcon className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Deploy <span className="text-emerald-500">Adjustment</span></h2>
                                    <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.5em] mt-1">Institutional Incentive Engine v1.0</p>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <form onSubmit={handleSubmit} className="p-10 space-y-8">
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest pl-1">Incentive Description</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="e.g., Global Sibling Relief Policy"
                                        className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-white placeholder:text-white/10 focus:border-emerald-500/30 transition-all outline-none"
                                        value={formData.rule_name}
                                        onChange={e => setFormData({ ...formData, rule_name: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest pl-1">Registry Priority (1-100)</label>
                                        <input
                                            type="number"
                                            className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-white outline-none focus:border-emerald-500/30 transition-all"
                                            value={formData.value_priority}
                                            onChange={e => setFormData({ ...formData, value_priority: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest pl-1">Adjustment Type</label>
                                        <select
                                            className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-white outline-none focus:border-emerald-500/30 transition-all appearance-none"
                                            value={formData.adjustment_type}
                                            onChange={e => setFormData({ ...formData, adjustment_type: e.target.value as any })}
                                        >
                                            <option value="discount">Direct Discount</option>
                                            <option value="waiver">Full/Partial Waiver</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest pl-1">Calculation Logic</label>
                                        <div className="flex bg-white/[0.03] p-1.5 rounded-2xl border border-white/5">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, calculation_type: 'percentage' })}
                                                className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${formData.calculation_type === 'percentage' ? 'bg-emerald-500 text-black shadow-lg' : 'text-white/30 hover:text-white'}`}
                                            >
                                                Percentage %
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, calculation_type: 'fixed' })}
                                                className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${formData.calculation_type === 'fixed' ? 'bg-emerald-500 text-black shadow-lg' : 'text-white/30 hover:text-white'}`}
                                            >
                                                Fixed Amount
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest pl-1">Benefit Value</label>
                                        <input
                                            required
                                            type="number"
                                            step="0.01"
                                            className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-white outline-none focus:border-emerald-500/30 transition-all font-mono"
                                            value={formData.value}
                                            onChange={e => setFormData({ ...formData, value: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-6">
                                    <label className="flex-1 flex items-center justify-between p-5 bg-white/[0.02] border border-white/5 rounded-2xl cursor-pointer group hover:bg-white/[0.04] transition-all">
                                        <div>
                                            <p className="text-[10px] font-black text-white uppercase tracking-widest">Stackable Node</p>
                                            <p className="text-[8px] font-bold text-white/20 uppercase mt-1">Allow blending with other rules</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 accent-emerald-500"
                                            checked={formData.is_stackable}
                                            onChange={e => setFormData({ ...formData, is_stackable: e.target.checked })}
                                        />
                                    </label>
                                    <label className="flex-1 flex items-center justify-between p-5 bg-white/[0.02] border border-white/5 rounded-2xl cursor-pointer group hover:bg-white/[0.04] transition-all">
                                        <div>
                                            <p className="text-[10px] font-black text-white uppercase tracking-widest">Two-Step Verification</p>
                                            <p className="text-[8px] font-bold text-white/20 uppercase mt-1">Requires administrative audit</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 accent-emerald-500"
                                            checked={formData.requires_approval}
                                            onChange={e => setFormData({ ...formData, requires_approval: e.target.checked })}
                                        />
                                    </label>
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
                                    className="flex-1 px-10 py-5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black text-[10px] uppercase tracking-[0.4em] rounded-2xl transition-all flex items-center justify-center gap-3 shadow-2xl shadow-emerald-900/40"
                                >
                                    {loading ? <VersionIcon className="w-4 h-4 animate-spin" /> : <PlusIcon className="w-4 h-4" />}
                                    Deploy Rule Node
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default AdjustmentRuleModal;
