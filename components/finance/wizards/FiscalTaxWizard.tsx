import React, { useState, useEffect } from 'react';
import { supabase, formatError } from '../../../services/supabase';
import Spinner from '../../common/Spinner';
import { XIcon } from '../../icons/XIcon';
import { CheckCircleIcon } from '../../icons/CheckCircleIcon';
import { CalculatorIcon } from '../../icons/CalculatorIcon';
import { AlertTriangleIcon } from '../../icons/AlertTriangleIcon';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface TaxRule {
    id: string;
    name: string;
    code: string;
    rate_percentage: number;
    is_inclusive: boolean;
    description: string;
    target_components: string[] | null;
    is_active: boolean;
}

interface FiscalTaxWizardProps {
    onClose: () => void;
    onSuccess: () => void;
    branchId: number | null;
    editingRule?: TaxRule | null;
}

const FiscalTaxWizard: React.FC<FiscalTaxWizardProps> = ({ onClose, onSuccess, branchId, editingRule }) => {
    const isEditMode = !!editingRule;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        rate: '',
        isInclusive: false,
        description: '',
        targetComponents: '' // Comma separated
    });

    useEffect(() => {
        if (editingRule) {
            setFormData({
                name: editingRule.name,
                code: editingRule.code,
                rate: String(editingRule.rate_percentage),
                isInclusive: editingRule.is_inclusive,
                description: editingRule.description || '',
                targetComponents: editingRule.target_components ? editingRule.target_components.join(', ') : ''
            });
        }
    }, [editingRule]);

    const handleSave = async () => {
        if (!formData.name || !formData.code || !formData.rate) {
            setError("Name, Code, and Rate are required.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const targets = formData.targetComponents
                ? formData.targetComponents.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0)
                : null;

            const { error: rpcError } = await supabase.rpc('upsert_tax_rule', {
                p_branch_id: branchId,
                p_name: formData.name,
                p_code: formData.code.toUpperCase(),
                p_rate_percentage: parseFloat(formData.rate),
                p_is_inclusive: formData.isInclusive,
                p_description: formData.description,
                p_target_components: targets,
                p_id: editingRule?.id
            });

            if (rpcError) throw rpcError;
            onSuccess();
        } catch (err: any) {
            console.error("Save Tax Rule Error:", err);
            setError(formatError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-2xl bg-[#0c0e14] border border-white/10 rounded-[2rem] flex flex-col shadow-2xl relative overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                        <div className="flex items-center gap-6">
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
                                <CalculatorIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-serif font-black text-white uppercase tracking-tight">
                                    {isEditMode ? 'Edit Tax Rule' : 'New Tax Rule'}
                                </h2>
                                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Fiscal Compliance Configuration</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-8 relative space-y-6">
                        {error && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 text-red-200 text-sm">
                                <AlertTriangleIcon className="w-5 h-5 shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Tax Name</label>
                                <input
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-4 text-white font-bold focus:border-indigo-500/50 outline-none transition-all placeholder:text-white/20"
                                    placeholder="e.g. VAT 5%"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Tax Code</label>
                                <input
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                                    className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-4 text-white font-mono uppercase font-bold focus:border-indigo-500/50 outline-none transition-all placeholder:text-white/20"
                                    placeholder="e.g. VAT-05"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Rate Percentage %</label>
                                <input
                                    type="number"
                                    value={formData.rate}
                                    onChange={e => setFormData({ ...formData, rate: e.target.value })}
                                    className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-4 text-white font-mono text-lg font-bold focus:border-indigo-500/50 outline-none transition-all text-right"
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Type</label>
                                <div className="flex gap-2 p-1 bg-white/[0.03] rounded-xl border border-white/5">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, isInclusive: false })}
                                        className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all ${!formData.isInclusive ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/30 hover:text-white'}`}
                                    >
                                        Exclusive (Add On)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, isInclusive: true })}
                                        className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all ${formData.isInclusive ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/30 hover:text-white'}`}
                                    >
                                        Inclusive (Absorb)
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Target Components (Optional)</label>
                            <input
                                value={formData.targetComponents}
                                onChange={e => setFormData({ ...formData, targetComponents: e.target.value })}
                                className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-4 text-white font-mono text-sm focus:border-indigo-500/50 outline-none transition-all placeholder:text-white/20 uppercase"
                                placeholder="e.g. TUITION, TRANSPORT (Leave empty for invoice level)"
                            />
                            <p className="text-[10px] text-white/30 pl-1">Comma separated codes of components this tax applies to automatically.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-4 text-white/80 text-sm focus:border-indigo-500/50 outline-none transition-all resize-none h-24"
                                placeholder="Optional description..."
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-8 border-t border-white/5 bg-white/[0.02] flex justify-end gap-4">
                        <button
                            disabled={loading}
                            onClick={handleSave}
                            className="px-8 py-3 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                        >
                            {loading ? <Spinner size="sm" className="text-white" /> : <><CheckCircleIcon className="w-4 h-4" /> Save Tax Rule</>}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default FiscalTaxWizard;
