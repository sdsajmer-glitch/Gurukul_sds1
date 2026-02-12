import React, { useState, useEffect, useMemo } from 'react';
import { supabase, formatError } from '../../services/supabase';
import Spinner from '../common/Spinner';
import { XIcon } from '../icons/XIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { BookIcon } from '../icons/BookIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { ChevronLeftIcon } from '../icons/ChevronLeftIcon';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { LockIcon } from '../icons/LockIcon';
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
    const [initializing, setInitializing] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [academicYears, setAcademicYears] = useState<any[]>([]);
    const [templates, setTemplates] = useState<FeeStructure[]>([]);

    const [formData, setFormData] = useState({
        name: '',
        academicYear: '',
        targetGrade: '1',
        description: '',
        currency: 'INR' as CurrencyCode,
        isDefault: false,
        type: 'Standard'
    });

    const [components, setComponents] = useState<{ id?: number; name: string; amount: string; frequency: string; is_mandatory: boolean; category: string }[]>([
        { name: 'TUITION_FEES', amount: '0', frequency: 'Monthly', is_mandatory: true, category: 'Tuition' }
    ]);

    useEffect(() => {
        const fetchExternalData = async () => {
            setInitializing(true);
            try {
                const bid = branchId !== null ? Number(branchId) : null;

                // Fetch Academic Years
                const { data: years } = await supabase
                    .from('academic_years')
                    .select('*')
                    .order('start_date', { ascending: false });

                if (years) {
                    setAcademicYears(years);
                    if (!isEditMode && years.length > 0) {
                        setFormData(prev => ({ ...prev, academicYear: years[0].year_name }));
                    }
                }

                // Fetch Existing Structures for "Cloning/Template" functionality
                let query = supabase.from('fee_structures').select('*, components:fee_components(*)');
                if (bid) query = query.eq('branch_id', bid);

                const { data: existing } = await query.limit(10);
                if (existing) setTemplates(existing);

            } catch (err) {
                console.error("Data synchronization failed:", err);
            } finally {
                setInitializing(false);
            }
        };

        fetchExternalData();
    }, [branchId, isEditMode]);

    useEffect(() => {
        if (editingStructure) {
            setFormData({
                name: editingStructure.name,
                academicYear: editingStructure.academic_year,
                targetGrade: editingStructure.target_grade,
                description: (editingStructure as any).description || '',
                currency: editingStructure.currency as CurrencyCode,
                isDefault: (editingStructure as any).is_default || false,
                type: (editingStructure as any).type || 'Standard'
            });

            if (editingStructure.components && editingStructure.components.length > 0) {
                setComponents(editingStructure.components.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    amount: c.amount.toString(),
                    frequency: c.frequency,
                    is_mandatory: c.is_mandatory,
                    category: c.category || 'Tuition'
                })));
            }
        }
    }, [editingStructure]);

    const handleAddComponent = () => {
        if (isLocked) return;
        setComponents([...components, { name: '', amount: '0', frequency: 'Monthly', is_mandatory: false, category: 'Tuition' }]);
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

    const handleApplyTemplate = (template: FeeStructure) => {
        setFormData({
            ...formData,
            name: `${template.name} (CLONED)`,
            currency: template.currency as CurrencyCode,
            type: (template as any).type || 'Standard',
            description: (template as any).description || ''
        });

        if (template.components && template.components.length > 0) {
            setComponents(template.components.map((c: any) => ({
                name: c.name,
                amount: c.amount.toString(),
                frequency: c.frequency,
                is_mandatory: c.is_mandatory,
                category: c.category || 'Tuition'
            })));
        }
    };

    const isStep1Valid = formData.name.trim().length >= 3 && formData.academicYear.length > 0;
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
                        type: formData.type,
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
                        type: formData.type,
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
                is_mandatory: c.is_mandatory,
                category: c.category
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
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="bg-[#0f1016] w-full max-w-4xl rounded-3xl shadow-2xl border border-white/5 flex flex-col overflow-hidden max-h-[92vh] font-sans relative"
                onClick={e => e.stopPropagation()}
            >
                {/* Background ambient glow */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                {/* Header */}
                <div className="px-8 py-6 border-b border-white/5 bg-[#0f1016]/80 backdrop-blur-lg flex justify-between items-center relative z-20">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${isLocked ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'} border border-white/5`}>
                            {isLocked ? <LockIcon className="w-6 h-6" /> : <BookIcon className="w-6 h-6" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-white/40">Step 0{step} / 03</span>
                            </div>
                            <h3 className="text-xl font-bold text-white tracking-tight">
                                {isLocked ? 'Immutable Fee Structure' : isEditMode ? 'Edit Fee Structure' : 'New Fee Structure'}
                            </h3>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-grow overflow-y-auto custom-scrollbar p-8 relative z-10">
                    {/* Error Display */}
                    {error && (
                        <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
                            <AlertTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-200">{error}</p>
                        </div>
                    )}

                    {/* Locked Warning */}
                    {isLocked && (
                        <div className="mb-8 p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-start gap-3">
                            <LockIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-200/80">This specific structure is locked as it has been used in active billing cycles. Modifications are restricted to preserve financial data integrity.</p>
                        </div>
                    )}

                    {/* Loading State */}
                    {initializing && (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Spinner size="lg" className="text-primary" />
                            <p className="text-[10px] font-black uppercase text-white/20 tracking-[0.5em]">Synchronizing Registry Nodes...</p>
                        </div>
                    )}

                    {/* Step 1: Core Registry */}
                    {step === 1 && !initializing && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                            <div>
                                <h4 className="text-2xl font-bold text-white mb-2">Core Registry</h4>
                                <p className="text-white/40 text-sm">Define the primary identification and applicability of this fee structure.</p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block ml-1">Structure Designation</label>
                                    <input
                                        disabled={isLocked}
                                        type="text"
                                        placeholder="e.g. GRADE 10 GENERAL 2025"
                                        className="w-full bg-[#1A1D25] border border-white/5 rounded-xl px-5 py-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all font-semibold uppercase tracking-wide disabled:opacity-50"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                                    />
                                    <p className="text-[10px] text-white/30 ml-1">A unique identifier for this fee structure.</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block ml-1">Structure Type</label>
                                    <div className="flex gap-2 p-1 bg-[#1A1D25] rounded-xl border border-white/5">
                                        {['Standard', 'Package', 'Transport'].map(t => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, type: t })}
                                                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${formData.type === t ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block ml-1">Academic Cycle</label>
                                        <div className="relative">
                                            <select
                                                disabled={isLocked}
                                                className="w-full bg-[#1A1D25] border border-white/5 rounded-xl px-5 py-3.5 text-white/90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 uppercase text-sm font-semibold appearance-none cursor-pointer disabled:opacity-50"
                                                value={formData.academicYear}
                                                onChange={e => setFormData({ ...formData, academicYear: e.target.value })}
                                            >
                                                {academicYears.length > 0 ? (
                                                    academicYears.map(y => (
                                                        <option key={y.id} value={y.year_name}>{y.year_name} {y.is_current ? '(CURRENT)' : ''}</option>
                                                    ))
                                                ) : (
                                                    <option value="2025-2026">2025-2026 (STATIC_FALLBACK)</option>
                                                )}
                                            </select>
                                            <ChevronDownIcon className="w-4 h-4 text-white/30 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block ml-1">Target Grade</label>
                                        <div className="relative">
                                            <select
                                                disabled={isLocked}
                                                className="w-full bg-[#1A1D25] border border-white/5 rounded-xl px-5 py-3.5 text-white/90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 uppercase text-sm font-semibold appearance-none cursor-pointer disabled:opacity-50"
                                                value={formData.targetGrade}
                                                onChange={e => setFormData({ ...formData, targetGrade: e.target.value })}
                                            >
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map(g => (
                                                    <option key={g} value={String(g)}>GRADE {g}</option>
                                                ))}
                                            </select>
                                            <ChevronDownIcon className="w-4 h-4 text-white/30 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block ml-1">Currency Matrix</label>
                                        <div className="grid grid-cols-2 gap-2 p-1 bg-[#1A1D25] rounded-xl border border-white/5">
                                            {['INR', 'USD'].map(curr => (
                                                <button
                                                    disabled={isLocked}
                                                    key={curr}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, currency: curr as CurrencyCode })}
                                                    className={`py-2 rounded-lg text-[10px] font-black transition-all ${formData.currency === curr
                                                        ? 'bg-primary text-white shadow-lg ring-1 ring-white/10'
                                                        : 'text-white/20 hover:text-white/40'
                                                        } disabled:opacity-50 uppercase tracking-widest`}
                                                >
                                                    {curr}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div
                                    onClick={() => !isLocked && setFormData(f => ({ ...f, isDefault: !f.isDefault }))}
                                    className={`group p-5 rounded-2xl border transition-all cursor-pointer flex items-center gap-4 ${formData.isDefault
                                        ? 'bg-primary/5 border-primary/30'
                                        : 'bg-[#1A1D25]/50 border-white/5 hover:border-white/10 hover:bg-[#1A1D25]'
                                        }`}
                                >
                                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${formData.isDefault ? 'bg-primary border-primary' : 'border-white/20 group-hover:border-primary/50'
                                        }`}>
                                        {formData.isDefault && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <p className={`text-sm font-bold uppercase tracking-wide ${formData.isDefault ? 'text-white' : 'text-white/70'}`}>Set as Default Structure</p>
                                            <ShieldCheckIcon className={`w-5 h-5 ${formData.isDefault ? 'text-primary' : 'text-white/10'}`} />
                                        </div>
                                        <p className="text-xs text-white/40 mt-1">Automatically assign this structure to new students enrolled in Grade {formData.targetGrade}.</p>
                                    </div>
                                </div>

                                {/* Template Cloning Zone */}
                                {!isLocked && !isEditMode && templates.length > 0 && (
                                    <div className="space-y-4 pt-4 border-t border-white/5">
                                        <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] block ml-1">Cloning Protocol (Optional)</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {templates.map(t => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => handleApplyTemplate(t)}
                                                    className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-primary/5 hover:border-primary/30 transition-all text-left group"
                                                >
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{t.academic_year}</span>
                                                        <SparklesIcon className="w-3 h-3 text-white/10 group-hover:text-primary transition-colors" />
                                                    </div>
                                                    <p className="text-xs font-bold text-white uppercase truncate">{t.name}</p>
                                                    <p className="text-[9px] text-white/20 mt-1">{t.components?.length || 0} Components Identified</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Ledger Nodes */}
                    {step === 2 && !initializing && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                                <div>
                                    <h4 className="text-2xl font-bold text-white mb-2">Fee Components</h4>
                                    <p className="text-white/40 text-sm">Define each line item that makes up the total fee structure.</p>
                                </div>
                                {!isLocked && (
                                    <button
                                        onClick={handleAddComponent}
                                        className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white font-semibold text-xs uppercase tracking-wider rounded-xl border border-white/10 transition-all flex items-center gap-2"
                                    >
                                        <PlusIcon className="w-4 h-4" /> Add Component
                                    </button>
                                )}
                            </div>

                            <div className="space-y-4">
                                {components.map((comp, idx) => (
                                    <div key={idx} className="flex flex-col xl:flex-row gap-4 p-5 bg-[#1A1D25]/40 border border-white/5 rounded-2xl hover:border-white/10 transition-colors group">
                                        <div className="flex-grow space-y-1.5">
                                            <div className="flex gap-2">
                                                <div className="w-1/3">
                                                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider pl-1">Category</label>
                                                    <select
                                                        disabled={isLocked}
                                                        className="w-full bg-transparent border-b border-white/10 py-2 text-xs font-bold text-white focus:outline-none focus:border-primary uppercase tracking-wide disabled:opacity-50"
                                                        value={comp.category}
                                                        onChange={e => updateComponent(idx, 'category', e.target.value)}
                                                    >
                                                        {['Tuition', 'Books', 'Uniform', 'Transport', 'Hostel', 'Exam', 'Misc'].map(c => <option key={c} value={c} className="bg-black text-white">{c}</option>)}
                                                    </select>
                                                </div>
                                                <div className="w-2/3">
                                                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider pl-1">Identifier</label>
                                                    <input
                                                        disabled={isLocked}
                                                        type="text"
                                                        placeholder="TUITION_FEE"
                                                        className="w-full bg-transparent border-b border-white/10 py-2 text-base font-bold text-white placeholder:text-white/10 focus:outline-none focus:border-primary uppercase tracking-wide disabled:opacity-50 font-mono"
                                                        value={comp.name}
                                                        onChange={e => updateComponent(idx, 'name', e.target.value.toUpperCase().replace(/\s/g, '_'))}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-4 w-full xl:w-auto">
                                            <div className="w-1/2 xl:w-48 space-y-1.5">
                                                <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider pl-1">Amount</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs font-bold">
                                                        {formData.currency === 'INR' ? '₹' : '$'}
                                                    </span>
                                                    <input
                                                        disabled={isLocked}
                                                        type="number"
                                                        className="w-full bg-[#0f1016] border border-white/10 rounded-lg py-2.5 pl-8 pr-4 text-right font-mono text-sm font-bold text-white focus:outline-none focus:border-primary disabled:opacity-50"
                                                        value={comp.amount}
                                                        onChange={e => updateComponent(idx, 'amount', e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            <div className="w-1/2 xl:w-40 space-y-1.5">
                                                <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider pl-1">Frequency</label>
                                                <div className="relative">
                                                    <select
                                                        disabled={isLocked}
                                                        className="w-full bg-[#0f1016] border border-white/10 rounded-lg py-2.5 px-3 pr-8 text-xs font-bold text-white focus:outline-none focus:border-primary appearance-none cursor-pointer disabled:opacity-50 uppercase"
                                                        value={comp.frequency}
                                                        onChange={e => updateComponent(idx, 'frequency', e.target.value)}
                                                    >
                                                        {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                                                    </select>
                                                    <ChevronDownIcon className="w-3 h-3 text-white/30 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                </div>
                                            </div>
                                        </div>

                                        {!isLocked && (
                                            <div className="flex items-end justify-end pb-1.5">
                                                <button
                                                    onClick={() => handleRemoveComponent(idx)}
                                                    className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="p-6 bg-[#1A1D25] rounded-2xl flex items-center justify-between border border-white/5 shadow-inner">
                                <span className="text-sm font-bold text-white/50 uppercase tracking-wide">Total Annual Projection</span>
                                <span className="text-3xl font-bold text-primary font-mono tracking-tight">
                                    {formatCurrency(totalYearlyAmount, formData.currency)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Success */}
                    {step === 3 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center animate-in zoom-in-95 duration-500">
                            <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 ring-1 ring-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
                                <CheckCircleIcon className="w-10 h-10 text-emerald-500" />
                            </div>
                            <h4 className="text-3xl font-bold text-white mb-3">Ready to Deploy</h4>
                            <p className="text-white/40 max-w-md leading-relaxed mx-auto">
                                The fee structure <strong className="text-white">{formData.name}</strong> has been configured successfully.
                                Review the details before finalizing.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 bg-[#0f1016] flex justify-between items-center relative z-20">
                    <button
                        onClick={() => step > 1 ? setStep(step - 1) : onClose()}
                        className="px-6 py-3 text-xs font-bold text-white/40 hover:text-white uppercase tracking-wider transition-colors flex items-center gap-2"
                        disabled={loading}
                    >
                        {step > 1 && <ChevronLeftIcon className="w-4 h-4" />}
                        {step === 1 ? 'Cancel' : 'Back'}
                    </button>

                    <div className="flex gap-3">
                        {step === 3 ? (
                            <>
                                <button
                                    onClick={() => handleFinalize(false)}
                                    disabled={loading || isLocked}
                                    className="px-8 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
                                >
                                    Save Draft
                                </button>
                                <button
                                    onClick={() => handleFinalize(true)}
                                    disabled={loading || isLocked}
                                    className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {loading ? <Spinner size="sm" className="text-white" /> : 'Deploy Structure'}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setStep(step + 1)}
                                disabled={loading || (step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)}
                                className="px-8 py-3.5 bg-primary hover:bg-primary/90 text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                Next Step <ChevronRightIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default FeeMasterWizard;