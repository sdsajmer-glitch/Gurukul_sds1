import React, { useState, useEffect } from 'react';
import { supabase, formatError } from '../../../services/supabase';
import Spinner from '../../common/Spinner';
import { XIcon } from '../../icons/XIcon';
import { CheckCircleIcon } from '../../icons/CheckCircleIcon';
import { SparklesIcon } from '../../icons/SparklesIcon';
import { AlertTriangleIcon } from '../../icons/AlertTriangleIcon';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface AdjustmentRule {
    id: string;
    name: string;
    category: 'Discount' | 'Scholarship' | 'Waiver' | 'Late Fee';
    value_type: 'Percentage' | 'Fixed';
    value: number;
    is_automatic: boolean;
    target_components: string[] | null;
    is_active: boolean;
}

interface DiscountRuleWizardProps {
    onClose: () => void;
    onSuccess: () => void;
    branchId: number | null;
    editingRule?: AdjustmentRule | null;
}

const CATEGORIES = ['Discount', 'Scholarship', 'Waiver', 'Late Fee'];

const DiscountRuleWizard: React.FC<DiscountRuleWizardProps> = ({ onClose, onSuccess, branchId, editingRule }) => {
    const isEditMode = !!editingRule;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        category: 'Discount',
        valueType: 'Percentage',
        value: '',
        isAutomatic: false,
        targetComponents: '' // Comma separated for now, or just text
    });

    useEffect(() => {
        if (editingRule) {
            setFormData({
                name: editingRule.name,
                category: editingRule.category,
                valueType: editingRule.value_type,
                value: String(editingRule.value),
                isAutomatic: editingRule.is_automatic,
                targetComponents: editingRule.target_components ? editingRule.target_components.join(', ') : ''
            });
        }
    }, [editingRule]);

    const handleSave = async () => {
        if (!formData.name || !formData.value) {
            setError("Name and Value are required.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const targets = formData.targetComponents
                ? formData.targetComponents.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0)
                : null;

            const { error: rpcError } = await supabase.rpc('upsert_adjustment_rule', {
                p_branch_id: branchId,
                p_name: formData.name,
                p_category: formData.category,
                p_value_type: formData.valueType,
                p_value: parseFloat(formData.value),
                p_is_automatic: formData.isAutomatic,
                p_target_components: targets,
                p_id: editingRule?.id
            });

            if (rpcError) throw rpcError;
            onSuccess();
        } catch (err: any) {
            console.error("Save Rule Error:", err);
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
                            <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-500 border border-pink-500/20">
                                <SparklesIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-serif font-black text-white uppercase tracking-tight">
                                    {isEditMode ? 'Edit Adjustment Rule' : 'New Adjustment Rule'}
                                </h2>
                                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Scholarships, Discounts & Waivers</p>
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
                                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Rule Name</label>
                                <input
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-4 text-white font-bold focus:border-pink-500/50 outline-none transition-all placeholder:text-white/20"
                                    placeholder="e.g. Sibling Discount"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Category</label>
                                <select
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-4 text-white font-mono uppercase outline-none bg-[#0c0e14]"
                                >
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Value Type</label>
                                <div className="flex gap-2 p-1 bg-white/[0.03] rounded-xl border border-white/5">
                                    {['Percentage', 'Fixed'].map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, valueType: t })}
                                            className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all ${formData.valueType === t ? 'bg-pink-500 text-white shadow-lg' : 'text-white/30 hover:text-white'}`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">
                                    {formData.valueType === 'Percentage' ? 'Percentage Value %' : 'Fixed Amount'}
                                </label>
                                <input
                                    type="number"
                                    value={formData.value}
                                    onChange={e => setFormData({ ...formData, value: e.target.value })}
                                    className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-4 text-white font-mono text-lg font-bold focus:border-pink-500/50 outline-none transition-all text-right"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Target Components (Optional)</label>
                            <input
                                value={formData.targetComponents}
                                onChange={e => setFormData({ ...formData, targetComponents: e.target.value })}
                                className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-4 text-white font-mono text-sm focus:border-pink-500/50 outline-none transition-all placeholder:text-white/20 uppercase"
                                placeholder="e.g. TUITION, TRANSPORT (Leave empty for all)"
                            />
                            <p className="text-[10px] text-white/30 pl-1">Comma separated codes of components this rule applies to.</p>
                        </div>

                        <div className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                            <input
                                type="checkbox"
                                checked={formData.isAutomatic}
                                onChange={e => setFormData({ ...formData, isAutomatic: e.target.checked })}
                                className="w-5 h-5 rounded border-white/10 bg-white/5 text-pink-500 focus:ring-pink-500/50"
                            />
                            <div>
                                <label className="text-sm font-bold text-white block">Automatic Application</label>
                                <p className="text-xs text-white/40">If checked, system will attempt to apply this automatically based on criteria.</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-8 border-t border-white/5 bg-white/[0.02] flex justify-end gap-4">
                        <button
                            disabled={loading}
                            onClick={handleSave}
                            className="px-8 py-3 bg-pink-500 hover:bg-pink-400 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-pink-500/20 flex items-center gap-2"
                        >
                            {loading ? <Spinner size="sm" className="text-white" /> : <><CheckCircleIcon className="w-4 h-4" /> Save Rule</>}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default DiscountRuleWizard;
