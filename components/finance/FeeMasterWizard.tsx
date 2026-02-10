import React, { useState, useEffect, useMemo } from 'react';
import { supabase, formatError } from '../../services/supabase';
import Spinner from '../common/Spinner';
import { XIcon } from '../icons/XIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { BookIcon } from '../icons/BookIcon';
import { DollarSignIcon } from '../icons/DollarSignIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { ChevronLeftIcon } from '../icons/ChevronLeftIcon';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { TrendingUpCustomIcon } from '../icons/TrendingUpIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { LockIcon } from '../icons/LockIcon';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { FeeStructure, CurrencyCode } from '../../types';

interface FeeMasterWizardProps {
    onClose: () => void;
    onSuccess: () => void;
    branchId: number | null;
    editingStructure?: FeeStructure | null;
}

const FREQUENCIES = ['One-time', 'Monthly', 'Quarterly', 'Annually'];

const formatCurrency = (amount: number, currency: CurrencyCode = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
};

const FeeMasterWizard: React.FC<FeeMasterWizardProps> = ({ onClose, onSuccess, branchId, editingStructure }) => {
    const isEditMode = !!editingStructure;
    const isLocked = !!(editingStructure as any)?.is_version_locked;
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [aiGenerating, setAiGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        academicYear: '2025-2026',
        targetGrade: '1',
        description: '',
        currency: 'INR' as CurrencyCode,
        isDefault: false
    });

    const [components, setComponents] = useState<{ id?: number; name: string; amount: string; frequency: string; is_mandatory: boolean }[]>([
        { name: 'TUITION_FEES', amount: '0', frequency: 'Monthly', is_mandatory: true }
    ]);

    useEffect(() => {
        if (editingStructure) {
            setFormData({
                name: editingStructure.name,
                academicYear: editingStructure.academic_year,
                targetGrade: editingStructure.target_grade,
                description: (editingStructure as any).description || '',
                currency: editingStructure.currency as CurrencyCode,
                isDefault: (editingStructure as any).is_default || false
            });

            if (editingStructure.components && editingStructure.components.length > 0) {
                setComponents(editingStructure.components.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    amount: c.amount.toString(),
                    frequency: c.frequency,
                    is_mandatory: c.is_mandatory
                })));
            }
        }
    }, [editingStructure]);

    const handleAddComponent = () => {
        if (isLocked) return;
        setComponents([...components, { name: '', amount: '0', frequency: 'Monthly', is_mandatory: false }]);
    };

    const handleRemoveComponent = (index: number) => {
        if (isLocked || components.length === 1) return;
        setComponents(components.filter((_, i) => i !== index));
    };

    const updateComponent = (index: number, field: string, value: any) => {
        if (isLocked) return;
        const newComponents = [...components];
        (newComponents[index] as any)[field] = value;
        setComponents(newComponents);
    };

    const totalYearlyAmount = useMemo(() => {
        return components.reduce((acc, c) => {
            const amount = Number(c.amount) || 0;
            let multiplier = 1;
            if (c.frequency === 'Monthly') multiplier = 12;
            else if (c.frequency === 'Quarterly') multiplier = 4;
            else if (c.frequency === 'Annually') multiplier = 1;
            return acc + (amount * multiplier);
        }, 0);
    }, [components]);

    const isStep1Valid = formData.name.trim().length >= 3;
    const isStep2Valid = components.every(c => c.name.trim().length > 0 && Number(c.amount) >= 0);

    const handleFinalize = async (publish: boolean = false) => {
        if (isLocked) {
            onClose();
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const bid = (branchId === undefined || branchId === null) ? null : Number(branchId);
            let structureId: number;

            // 1. If this is set as default, we need to clear other defaults for this grade/branch first
            if (formData.isDefault) {
                const { error: clearError } = await supabase
                    .from('fee_structures')
                    .update({ is_default: false })
                    .match({ branch_id: bid, target_grade: formData.targetGrade });

                if (clearError) console.warn("Failed to clear other defaults:", clearError);
            }

            // 2. Insert or Update Structure
            if (isEditMode && editingStructure) {
                const { error: structError } = await supabase
                    .from('fee_structures')
                    .update({
                        name: formData.name,
                        academic_year: formData.academicYear,
                        target_grade: formData.targetGrade,
                        description: formData.description,
                        currency: formData.currency,
                        is_default: formData.isDefault,
                        status: publish ? 'Active' : 'Draft'
                    })
                    .eq('id', editingStructure.id);

                if (structError) throw structError;
                structureId = editingStructure.id;

                // Clear components to re-insert them (Clean sync protocol)
                const { error: delError } = await supabase.from('fee_components').delete().eq('structure_id', structureId);
                if (delError) throw delError;
            } else {
                const { data: struct, error: structError } = await supabase
                    .from('fee_structures')
                    .insert({
                        name: formData.name,
                        academic_year: formData.academicYear,
                        target_grade: formData.targetGrade,
                        description: formData.description,
                        currency: formData.currency,
                        is_default: formData.isDefault,
                        status: publish ? 'Active' : 'Draft',
                        branch_id: bid
                    })
                    .select()
                    .single();

                if (structError) throw structError;
                if (!struct) throw new Error("Synchronization established but no registry payload returned.");
                structureId = struct.id;
            }

            // 3. Insert Components
            const componentsPayload = components.map(c => ({
                structure_id: structureId,
                name: c.name || 'MISC_FEE',
                amount: Number(c.amount) || 0,
                frequency: c.frequency,
                is_mandatory: c.is_mandatory
            }));

            const { error: compError } = await supabase.from('fee_components').insert(componentsPayload);
            if (compError) throw compError;

            // 4. Success Protocol
            onSuccess();
        } catch (err: any) {
            console.error("Master Architect Protocol Failure:", err);
            setError(formatError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-[#0c0d12] w-full max-w-3xl rounded-[2.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,1)] border border-white/10 flex flex-col overflow-hidden max-h-[95vh] ring-1 ring-white/5 font-sans"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-7 border-b border-white/5 bg-[#12141c]/60 backdrop-blur-md flex justify-between items-center relative z-20">
                    <div className="flex items-center gap-5">
                        <div className="p-2.5 bg-primary/10 rounded-xl text-primary shadow-inner border border-primary/20 ring-4 ring-primary/5">
                            {isLocked ? <LockIcon className="w-5 h-5 text-amber-500" /> : <BookIcon className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className="text-[9px] font-black text-white/30 uppercase tracking-[0.35em] mb-0.5">Phase 0{step} of 03</h3>
                            <p className="text-xl font-serif font-black text-white tracking-tight uppercase leading-none">
                                {isLocked ? 'Immutable Node Architecture' : isEditMode ? 'Refining Architecture' : 'Provisioning Node'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-xl hover:bg-white/5 text-white/20 hover:text-white transition-all border border-transparent hover:border-white/10 active:scale-90"><XIcon className="w-6 h-6" /></button>
                </div>

                <div className="flex-grow overflow-y-auto custom-scrollbar p-7 md:p-12 bg-transparent relative">
                    {error && (
                        <div className="mb-10 p-8 bg-red-500/10 border border-red-500/20 rounded-[2.5rem] flex items-start gap-5 animate-in slide-in-from-top-4 duration-500 shadow-2xl">
                            <div className="p-4 bg-red-500/20 rounded-2xl text-red-500 shadow-inner">
                                <AlertTriangleIcon className="w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase text-red-500 tracking-[0.3em]">Institutional Protocol Failure</p>
                                <p className="text-sm font-medium text-white/70 leading-relaxed italic">{error}</p>
                            </div>
                        </div>
                    )}

                    {isLocked && (
                        <div className="mb-10 p-6 bg-amber-500/5 border border-amber-500/20 rounded-[2rem] flex items-start gap-4 animate-in slide-in-from-top-2">
                            <div className="p-3 bg-amber-500/10 rounded-lg text-amber-500">
                                <LockIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-amber-500 tracking-[0.2em] mb-1">Architecture Locked</p>
                                <p className="text-sm font-medium text-white/60 leading-relaxed font-serif italic">This structure has been utilized for active billing cycles. Parameters are now immutable to preserve ledger integrity.</p>
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-10 animate-in slide-in-from-right-8 duration-500 relative z-10">
                            <div className="space-y-3">
                                <span className="text-[9px] font-black uppercase text-primary/60 tracking-[0.4em] ml-1">Core Registry Parameters</span>
                                <h4 className="text-4xl md:text-5xl font-serif font-black text-white tracking-tighter uppercase leading-[0.85]">
                                    CORE <span className="text-white/20">REGISTRY.</span>
                                </h4>
                            </div>

                            <div className="space-y-10">
                                <div className="p-6 bg-[#12141c]/50 border border-white/5 rounded-[2rem] shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
                                    <div className="space-y-4">
                                        <label className="text-[9px] font-black uppercase text-white/20 tracking-[0.4em] ml-1">Node Designation</label>
                                        <input
                                            disabled={isLocked}
                                            type="text"
                                            className={`w-full bg-black/40 border border-white/5 rounded-xl p-6 md:p-8 text-lg md:text-2xl font-serif font-black text-white focus:ring-4 focus:ring-primary/5 focus:border-primary/40 outline-none transition-all shadow-inner uppercase tracking-wide placeholder:text-white/5 disabled:opacity-50`}
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <label className="text-[9px] font-black uppercase text-white/20 tracking-[0.4em] ml-1">Monetary Standard</label>
                                        <div className="grid grid-cols-2 gap-3 p-1.5 bg-black/60 border border-white/5 rounded-xl shadow-inner">
                                            {['INR', 'USD'].map(curr => (
                                                <button
                                                    disabled={isLocked}
                                                    key={curr}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, currency: curr as CurrencyCode })}
                                                    className={`py-3 rounded-lg text-[10px] font-black tracking-[0.25em] uppercase transition-all duration-300 ${formData.currency === curr ? 'bg-primary text-white shadow-lg scale-[1.02] z-10' : 'text-white/20 hover:text-white/40'} disabled:opacity-50`}
                                                >
                                                    {curr}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-[9px] font-black uppercase text-white/20 tracking-[0.4em] ml-1">Academic Target</label>
                                        <div className="relative group">
                                            <select
                                                disabled={isLocked}
                                                className="w-full h-[52px] bg-black/60 border border-white/5 rounded-xl px-6 text-[10px] font-black text-white focus:border-primary/40 outline-none appearance-none cursor-pointer uppercase tracking-[0.3em] shadow-inner transition-all hover:bg-black/80 disabled:opacity-50"
                                                value={formData.targetGrade}
                                                onChange={e => setFormData({ ...formData, targetGrade: e.target.value })}
                                            >
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map(g => (
                                                    <option key={g} value={String(g)}>GRADE {g} CONTEXT</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-white/10 group-hover:text-primary transition-colors"><ChevronDownIcon className="w-4 h-4" /></div>
                                        </div>
                                    </div>
                                </div>

                                <div className={`p-6 rounded-[1.8rem] border transition-all cursor-pointer flex items-center justify-between group ${formData.isDefault ? 'bg-primary/5 border-primary/20' : 'bg-white/[0.01] border-white/5 hover:border-white/10'}`} onClick={() => !isLocked && setFormData(f => ({ ...f, isDefault: !f.isDefault }))}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-6 h-6 rounded border transition-colors flex items-center justify-center ${formData.isDefault ? 'bg-primary border-primary' : 'bg-black/20 border-white/10 group-hover:border-primary/40'}`}>
                                            {formData.isDefault && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white uppercase tracking-tight">Set as Grade Default</p>
                                            <p className="text-[10px] text-white/20 font-medium">Auto-assigns to new students in Grade {formData.targetGrade}.</p>
                                        </div>
                                    </div>
                                    <ShieldCheckIcon className={`w-5 h-5 transition-colors ${formData.isDefault ? 'text-primary' : 'text-white/10'}`} />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-12 animate-in slide-in-from-right-8 duration-500 relative z-10">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
                                <div className="space-y-2">
                                    <span className="text-[9px] font-black uppercase text-primary/60 tracking-[0.4em] ml-1">Ledger Definition</span>
                                    <h4 className="text-5xl font-serif font-black text-white tracking-tighter uppercase leading-[0.85]">LEDGER <span className="text-white/20 italic tracking-widest">NODES.</span></h4>
                                </div>
                                {!isLocked && (
                                    <button
                                        onClick={handleAddComponent}
                                        className="px-8 py-4 bg-primary text-white text-[10px] font-black uppercase tracking-[0.35em] rounded-2xl shadow-xl hover:bg-primary/90 transition-all transform active:scale-95 border border-white/10 ring-4 ring-primary/5"
                                    >
                                        <PlusIcon className="w-5 h-5" /> Add Entity
                                    </button>
                                )}
                            </div>

                            <div className="space-y-4 max-w-6xl">
                                {components.map((comp, idx) => (
                                    <div key={idx} className="flex flex-col lg:flex-row items-center gap-6 p-7 bg-white/[0.01] border border-white/5 rounded-2xl group hover:border-primary/30 transition-all duration-500 shadow-xl relative overflow-hidden">
                                        <div className="flex-grow min-w-0 relative z-10">
                                            <input
                                                disabled={isLocked}
                                                type="text"
                                                placeholder="ENTITY IDENTIFIER"
                                                className="w-full bg-transparent border-none p-0 text-2xl font-serif font-black text-white focus:ring-0 placeholder:text-white/5 uppercase tracking-tighter leading-none disabled:opacity-50"
                                                value={comp.name}
                                                onChange={e => updateComponent(idx, 'name', e.target.value.toUpperCase().replace(/\s/g, '_'))}
                                            />
                                        </div>
                                        <div className="w-full lg:w-56 relative z-10">
                                            <div className="relative group/input">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-primary opacity-60">{formData.currency === 'INR' ? '₹' : '$'}</span>
                                                <input
                                                    disabled={isLocked}
                                                    type="number"
                                                    className="w-full bg-black/40 border border-white/5 rounded-xl p-4 pl-10 text-xl font-mono font-black text-white text-right focus:border-primary/40 outline-none transition-all shadow-inner disabled:opacity-50"
                                                    value={comp.amount}
                                                    onChange={e => updateComponent(idx, 'amount', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="w-full lg:w-48 relative z-10">
                                            <div className="relative">
                                                <select
                                                    disabled={isLocked}
                                                    className="w-full bg-black/40 border border-white/5 rounded-xl p-4 text-[9px] font-black uppercase tracking-[0.35em] text-white/60 appearance-none cursor-pointer text-center focus:border-primary/40 outline-none shadow-inner transition-all hover:bg-black/60 disabled:opacity-50"
                                                    value={comp.frequency}
                                                    onChange={e => updateComponent(idx, 'frequency', e.target.value)}
                                                >
                                                    {FREQUENCIES.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/10 group-hover:text-primary transition-colors"><ChevronDownIcon className="w-4 h-4" /></div>
                                            </div>
                                        </div>
                                        {!isLocked && (
                                            <button
                                                onClick={() => handleRemoveComponent(idx)}
                                                className="p-3 text-white/5 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all active:scale-90 flex-shrink-0"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="p-12 bg-[#0d0f14] border border-white/5 rounded-[2.5rem] flex flex-col lg:flex-row justify-between items-center gap-10 relative overflow-hidden group shadow-2xl">
                                <div className="relative z-10 text-center lg:text-right">
                                    <span className="text-[clamp(48px,5vw,84px)] font-black text-primary font-mono tracking-tighter drop-shadow-[0_0_40px_rgba(var(--primary),0.4)] leading-none">{formatCurrency(totalYearlyAmount, formData.currency)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="text-center space-y-14 py-16 animate-in zoom-in-98 duration-700 relative z-10">
                            <div className="relative inline-block group">
                                <div className="absolute inset-0 bg-emerald-500/10 blur-[100px] rounded-full animate-pulse"></div>
                                <div className="relative w-32 h-32 bg-emerald-500/10 text-emerald-500 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-[0_0_60px_rgba(16,185,129,0.1)] border border-emerald-500/20 ring-4 ring-emerald-500/5 group-hover:scale-105 transition-transform duration-700">
                                    <CheckCircleIcon animate className="w-16 h-16" />
                                </div>
                            </div>

                            <div className="max-w-3xl mx-auto space-y-4">
                                <h4 className="text-4xl md:text-6xl font-serif font-black text-white tracking-tighter uppercase leading-[0.85]">SEAL <span className="text-white/20 italic">PROTOCOL.</span></h4>
                                <p className="text-xl text-white/40 font-serif italic leading-relaxed max-w-xl mx-auto">Financial Node <strong>{formData.name}</strong> is architected and ready for institutional synchronization.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-7 border-t border-white/5 bg-[#08090a] flex flex-col md:flex-row justify-between items-center gap-6 relative z-30">
                    <button
                        onClick={() => step > 1 ? setStep(step - 1) : onClose()}
                        className="px-8 py-4 text-[10px] font-black text-white/20 uppercase tracking-[0.5em] hover:text-white transition-all flex items-center gap-3 group"
                        disabled={loading}
                    >
                        {step === 1 ? 'Abort Sequence' : <><ChevronLeftIcon className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Previous Phase</>}
                    </button>

                    <div className="flex flex-col items-center gap-3 w-full md:w-auto">
                        <div className="flex gap-4 w-full">
                            {step === 3 && (
                                <button
                                    onClick={() => handleFinalize(true)}
                                    disabled={loading || isLocked}
                                    className="flex-1 md:flex-none px-10 py-5 bg-emerald-600 text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-emerald-500/20 hover:bg-emerald-500 transition-all active:scale-95 disabled:opacity-30"
                                >
                                    {loading ? <Spinner size="sm" className="text-white" /> : 'Sync & Activate'}
                                </button>
                            )}
                            <button
                                onClick={() => step === 3 ? handleFinalize(false) : setStep(step + 1)}
                                disabled={loading || (step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)}
                                className={`flex-1 md:flex-none px-14 py-5 bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-[0.4em] rounded-2xl shadow-[0_30px_60px_-12px_rgba(var(--primary),0.4)] hover:bg-primary/90 transition-all transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-30 disabled:transform-none flex items-center justify-center gap-4 ring-4 ring-primary/5`}
                            >
                                {loading ? <Spinner size="sm" className="text-white" /> : step === 3 ? (isLocked ? 'Close' : 'Store Draft') : <>Next Phase <ChevronRightIcon className="w-4 h-4" /></>}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default FeeMasterWizard;