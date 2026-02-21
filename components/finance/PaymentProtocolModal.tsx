
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon } from '../icons/PlusIcon';
import { ShieldCheckIcon as SecurityIcon } from '../icons/ShieldCheckIcon';
import { RefreshIcon as VersionIcon } from '../icons/RefreshIcon';
import { CreditCardIcon } from '../icons/CreditCardIcon';
import { supabase } from '../../services/supabase';

interface PaymentProtocolModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    branchId: any;
}

const PaymentProtocolModal: React.FC<PaymentProtocolModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    branchId
}) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        grace_period_days: 0,
        penalty_type: 'fixed',
        penalty_value: 0,
        compounding_frequency: 'one-time'
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase.from('finance_payment_protocols').insert([{
                ...formData,
                branch_id: branchId
            }]);

            if (error) throw error;
            onSuccess();
        } catch (err) {
            console.error("Protocol Initialization Failure:", err);
            alert("Failed to save settings. Ensure branch ID sync is valid.");
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
                                <CreditCardIcon className="w-48 h-48 -rotate-12" />
                            </div>
                            <div className="flex items-center gap-6 relative z-10">
                                <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 ring-1 ring-amber-500/30">
                                    <SecurityIcon className="w-8 h-8" />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Late Fee <span className="text-amber-500">Settings</span></h2>
                                    <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.5em] mt-1">Institutional Late Fee Rules v1.0</p>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <form onSubmit={handleSubmit} className="p-10 space-y-8">
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest pl-1">Settings Name</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="e.g., Standard Installment Latency"
                                        className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-white placeholder:text-white/10 focus:border-amber-500/30 transition-all outline-none"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest pl-1">Grace Period (Days)</label>
                                        <input
                                            type="number"
                                            className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-white outline-none focus:border-amber-500/30 transition-all"
                                            value={formData.grace_period_days}
                                            onChange={e => setFormData({ ...formData, grace_period_days: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest pl-1">Compounding</label>
                                        <select
                                            className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-white outline-none focus:border-amber-500/30 transition-all appearance-none"
                                            value={formData.compounding_frequency}
                                            onChange={e => setFormData({ ...formData, compounding_frequency: e.target.value })}
                                        >
                                            <option value="one-time">One-Time Fine</option>
                                            <option value="daily">Daily Compound</option>
                                            <option value="monthly">Monthly Compound</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest pl-1">Penalty Type</label>
                                        <div className="flex bg-white/[0.03] p-1.5 rounded-2xl border border-white/5">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, penalty_type: 'fixed' })}
                                                className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${formData.penalty_type === 'fixed' ? 'bg-amber-500 text-black shadow-lg' : 'text-white/30 hover:text-white'}`}
                                            >
                                                Fixed Value
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, penalty_type: 'percentage' })}
                                                className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${formData.penalty_type === 'percentage' ? 'bg-amber-500 text-black shadow-lg' : 'text-white/30 hover:text-white'}`}
                                            >
                                                Percentage %
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest pl-1">Penalty Value</label>
                                        <input
                                            required
                                            type="number"
                                            step="0.01"
                                            className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-white outline-none focus:border-amber-500/30 transition-all font-mono"
                                            value={formData.penalty_value}
                                            onChange={e => setFormData({ ...formData, penalty_value: parseFloat(e.target.value) })}
                                        />
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
                                    className="flex-1 px-10 py-5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black text-[10px] uppercase tracking-[0.4em] rounded-2xl transition-all flex items-center justify-center gap-3 shadow-2xl shadow-amber-900/40"
                                >
                                    {loading ? <VersionIcon className="w-4 h-4 animate-spin" /> : <PlusIcon className="w-4 h-4" />}
                                    Save Settings
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default PaymentProtocolModal;
