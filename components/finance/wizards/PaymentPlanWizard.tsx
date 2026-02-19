import React, { useState, useEffect, useMemo } from 'react';
import { supabase, formatError } from '../../../services/supabase';
import Spinner from '../../common/Spinner';
import { XIcon } from '../../icons/XIcon';
import { PlusIcon } from '../../icons/PlusIcon';
import { TrashIcon } from '../../icons/TrashIcon';
import { CheckCircleIcon } from '../../icons/CheckCircleIcon';
import { CalendarIcon } from '../../icons/CalendarIcon';
import { ChevronRightIcon } from '../../icons/ChevronRightIcon';
import { ChevronLeftIcon } from '../../icons/ChevronLeftIcon';
import { AlertTriangleIcon } from '../../icons/AlertTriangleIcon';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCardIcon } from '../../icons/CreditCardIcon';

// Types
interface PaymentProtocol {
    id: string;
    name: string;
    type: string;
    total_splits: number;
    description: string;
    splits?: PaymentSplit[];
}

interface PaymentSplit {
    number: number;
    percentage: number;
    offset: number;
    label: string;
}

interface PaymentPlanWizardProps {
    onClose: () => void;
    onSuccess: () => void;
    branchId: number | null;
    editingProtocol?: PaymentProtocol | null;
}

const PaymentPlanWizard: React.FC<PaymentPlanWizardProps> = ({ onClose, onSuccess, branchId, editingProtocol }) => {
    const isEditMode = !!editingProtocol;
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationMessage, setValidationMessage] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        type: 'Monthly',
        description: '',
        totalSplits: 12
    });

    const [splits, setSplits] = useState<PaymentSplit[]>([
        { number: 1, percentage: 100, offset: 0, label: 'Full Payment' }
    ]);

    // Load Edit Data
    useEffect(() => {
        if (editingProtocol) {
            setFormData({
                name: editingProtocol.name,
                type: editingProtocol.type,
                description: editingProtocol.description || '',
                totalSplits: editingProtocol.total_splits
            });
            if (editingProtocol.splits) {
                setSplits(editingProtocol.splits.map(s => ({
                    number: s.number,
                    percentage: Number(s.percentage),
                    offset: s.offset,
                    label: s.label
                })));
            }
        }
    }, [editingProtocol]);

    // Auto-Generate Splits based on Type
    useEffect(() => {
        if (!isEditMode && step === 1) { // Only auto-gen on creation initially
            let newSplits: PaymentSplit[] = [];
            let count = 1;

            if (formData.type === 'Monthly') count = 12;
            else if (formData.type === 'Quartz') count = 4;
            else if (formData.type === 'Term') count = 3;
            else if (formData.type === 'Annual') count = 1;

            if (formData.type !== 'Custom') {
                const pct = parseFloat((100 / count).toFixed(2));
                let totalParams = 0;

                for (let i = 1; i <= count; i++) {
                    let currentPct = pct;
                    if (i === count) currentPct = parseFloat((100 - totalParams).toFixed(2)); // Adjust last to sum 100 exactly
                    totalParams += currentPct;

                    newSplits.push({
                        number: i,
                        percentage: currentPct,
                        offset: (i - 1) * 30, // Rough 30 days per month estimate
                        label: `Installment ${i}`
                    });
                }
                setSplits(newSplits);
                setFormData(prev => ({ ...prev, totalSplits: count }));
            }
        }
    }, [formData.type, isEditMode]);

    const totalPercentage = useMemo(() => splits.reduce((sum, s) => sum + s.percentage, 0), [splits]);

    const handleUpdateSplit = (index: number, field: keyof PaymentSplit, value: any) => {
        const newSplits = [...splits];
        (newSplits[index] as any)[field] = value;
        setSplits(newSplits);
    };

    const handleAddSplit = () => {
        setSplits([...splits, { number: splits.length + 1, percentage: 0, offset: 0, label: `Split ${splits.length + 1}` }]);
    };

    const handleRemoveSplit = (index: number) => {
        if (splits.length <= 1) return;
        setSplits(splits.filter((_, i) => i !== index).map((s, i) => ({ ...s, number: i + 1 })));
    };

    const handleSave = async () => {
        if (Math.round(totalPercentage) !== 100) {
            setValidationMessage(`Total percentage mismatch: ${totalPercentage.toFixed(2)}% (Must be 100%)`);
            return;
        }

        setError(null);
        setValidationMessage(null);
        setLoading(true);

        try {
            const { error } = await supabase.rpc('upsert_payment_protocol', {
                p_branch_id: branchId,
                p_name: formData.name,
                p_type: formData.type,
                p_splits: splits.length,
                p_description: formData.description,
                p_split_data: splits, // JSONB array is auto-handled by Supabase JS client usually, or may need JSON.stringify
                p_id: editingProtocol?.id
            });

            if (error) throw error;
            onSuccess();
        } catch (err: any) {
            console.error("Save Protocol Error:", err);
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
                    className="w-full max-w-4xl h-[85vh] bg-[#0c0e14] border border-white/10 rounded-[2rem] flex flex-col shadow-2xl relative overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                        <div className="flex items-center gap-6">
                            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 border border-purple-500/20">
                                <CreditCardIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-serif font-black text-white uppercase tracking-tight">
                                    {isEditMode ? 'Edit Payment Protocol' : 'New Payment Protocol'}
                                </h2>
                                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Installment Engine Configuration</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-8 relative">
                        {error && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 text-red-200 text-sm">
                                <AlertTriangleIcon className="w-5 h-5 shrink-0" />
                                {error}
                            </div>
                        )}

                        {validationMessage && (
                            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 text-amber-200 text-sm animate-pulse">
                                <AlertTriangleIcon className="w-5 h-5 shrink-0" />
                                {validationMessage}
                            </div>
                        )}

                        {step === 1 && (
                            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Protocol Name</label>
                                        <input
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-4 text-white text-lg font-bold focus:border-purple-500/50 outline-none transition-all"
                                            placeholder="e.g. Standard Monthly Plan"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Plan Structure</label>
                                        <select
                                            value={formData.type}
                                            onChange={e => setFormData({ ...formData, type: e.target.value })}
                                            className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-4 text-white font-mono uppercase outline-none"
                                        >
                                            <option value="Monthly" className="bg-gray-900">Monthly (12 Splits)</option>
                                            <option value="Quartz" className="bg-gray-900">Quartz (4 Splits)</option>
                                            <option value="Term" className="bg-gray-900">Term (3 Splits)</option>
                                            <option value="Annual" className="bg-gray-900">Annual (1 Split)</option>
                                            <option value="Custom" className="bg-gray-900">Custom (Manual Config)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Description</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-4 text-white/80 text-sm focus:border-purple-500/50 outline-none transition-all resize-none h-24"
                                        placeholder="Optional description of this payment plan..."
                                    />
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-4">
                                        <h3 className="text-xl font-bold text-white">Installment Breakdown</h3>
                                        <div className={`px-3 py-1 rounded-lg text-xs font-bold border ${Math.round(totalPercentage) === 100 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                                            Total: {totalPercentage.toFixed(2)}%
                                        </div>
                                    </div>
                                    <button onClick={handleAddSplit} className="px-4 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-purple-500 hover:text-white transition-all flex items-center gap-2">
                                        <PlusIcon className="w-4 h-4" /> Add Split
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {splits.map((split, idx) => (
                                        <div key={idx} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center gap-4 group hover:border-white/10 transition-colors">
                                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/30 font-mono text-xs">
                                                {idx + 1}
                                            </div>

                                            <div className="flex-1 grid grid-cols-12 gap-4">
                                                <div className="col-span-4">
                                                    <label className="text-[9px] text-white/20 uppercase font-black block mb-1">Label</label>
                                                    <input
                                                        value={split.label}
                                                        onChange={e => handleUpdateSplit(idx, 'label', e.target.value)}
                                                        className="w-full bg-transparent border-b border-white/10 py-1 text-sm font-bold text-white outline-none focus:border-purple-500 placeholder:text-white/10"
                                                        placeholder="Installment Label"
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <label className="text-[9px] text-white/20 uppercase font-black block mb-1">Percentage %</label>
                                                    <input
                                                        type="number"
                                                        value={split.percentage}
                                                        onChange={e => handleUpdateSplit(idx, 'percentage', parseFloat(e.target.value))}
                                                        className="w-full bg-transparent border-b border-white/10 py-1 text-sm font-mono text-white outline-none focus:border-purple-500 text-right"
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <label className="text-[9px] text-white/20 uppercase font-black block mb-1">Offset (Days)</label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            value={split.offset}
                                                            onChange={e => handleUpdateSplit(idx, 'offset', parseInt(e.target.value))}
                                                            className="w-full bg-transparent border-b border-white/10 py-1 text-sm font-mono text-purple-400 outline-none focus:border-purple-500 pl-6"
                                                        />
                                                        <CalendarIcon className="w-3 h-3 text-white/30 absolute left-0 top-1.5" />
                                                    </div>
                                                </div>
                                                <div className="col-span-2 flex items-end justify-end">
                                                    <button onClick={() => handleRemoveSplit(idx)} className="p-2 text-white/20 hover:text-red-500 transition-colors">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-8 border-t border-white/5 bg-white/[0.02] flex justify-between items-center">
                        {step > 1 ? (
                            <button onClick={() => setStep(step - 1)} className="text-white/40 hover:text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                                <ChevronLeftIcon className="w-4 h-4" /> Back
                            </button>
                        ) : <div />}

                        <div className="flex gap-4">
                            {step < 2 ? (
                                <button
                                    onClick={() => setStep(step + 1)}
                                    className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2"
                                >
                                    Next Step <ChevronRightIcon className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    disabled={loading}
                                    onClick={handleSave}
                                    className="px-8 py-3 bg-purple-500 hover:bg-purple-400 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-purple-500/20 flex items-center gap-2"
                                >
                                    {loading ? <Spinner size="sm" className="text-white" /> : <><CheckCircleIcon className="w-4 h-4" /> Save Protocol</>}
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default PaymentPlanWizard;
