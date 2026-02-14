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
        academicYear: '2025-2026', // Set default fallback to ensure validation passes
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

                if (years && years.length > 0) {
                    setAcademicYears(years);
                    if (!isEditMode) {
                        setFormData(prev => ({ ...prev, academicYear: years[0].year_name }));
                    }
                } else {
                    // Force fallback year in state if table is empty
                    setFormData(prev => ({ ...prev, academicYear: '2025-2026' }));
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
                    category: c.category || 'Tuition',
                    gl_code: c.gl_code || '',
                    tax_percentage: c.tax_percentage || 0,
                    is_refundable: c.is_refundable || false
                })));
            }
        }
    }, [editingStructure]);

    const handleAddComponent = () => {
        if (isLocked) return;
        setComponents([...components, {
            name: '',
            amount: '0',
            frequency: 'Monthly',
            is_mandatory: false,
            category: 'Tuition',
            gl_code: '',
            tax_percentage: 0,
            is_refundable: false
        }]);
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
            academicYear: template.academic_year || formData.academicYear, // Sync academic year from template
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
                category: c.category,
                gl_code: c.gl_code,
                tax_percentage: c.tax_percentage || 0,
                is_refundable: c.is_refundable || false
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

                {/* Institutional Header Section */}
                <div className="px-10 py-8 border-b border-white/5 bg-white/[0.01] backdrop-blur-3xl flex justify-between items-center relative z-20 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] to-transparent pointer-events-none"></div>

                    <div className="flex items-center gap-6 relative z-10">
                        <div className={`p-4 rounded-[1.5rem] shadow-2xl ${isLocked ? 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20' : 'bg-primary/10 text-primary ring-1 ring-primary/20'}`}>
                            {isLocked ? <LockIcon className="w-7 h-7" /> : <SparklesIcon className="w-7 h-7" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1.5">
                                <span className="px-3 py-0.5 rounded-lg bg-white/5 text-[9px] font-black uppercase tracking-[0.3em] text-white/40 border border-white/5">Step 0{step} / 03</span>
                                {isLocked && <span className="px-3 py-0.5 rounded-lg bg-amber-500/10 text-[9px] font-black uppercase tracking-[0.3em] text-amber-500 border border-amber-500/20">System Locked</span>}
                            </div>
                            <h3 className="text-2xl font-serif font-black text-white tracking-tight uppercase">
                                {isLocked ? 'Immutable Financial Protocol' : isEditMode ? 'Protocol Configuration' : 'Financial Protocol Architect'}
                            </h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex flex-col items-end">
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Institutional Authority</p>
                            <p className="text-[11px] font-bold text-white/60">FINANCE_ADMIN_NODE</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-3.5 rounded-2xl hover:bg-white/5 text-white/20 hover:text-white transition-all border border-transparent hover:border-white/10 group"
                        >
                            <XIcon className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>
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
                        <div className="space-y-12 animate-in slide-in-from-right-4 duration-500 max-w-3xl mx-auto py-4">
                            <div className="flex items-center gap-6 mb-4">
                                <div className="p-4 bg-primary/10 rounded-2xl text-primary shadow-inner">
                                    <BookIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Registry Architecture</h4>
                                    <p className="text-white/30 text-xs font-medium tracking-wide">Define the institutional nexus and temporal scope for this financial node.</p>
                                </div>
                            </div>

                            <div className="space-y-8">
                                <div className="space-y-3 relative group">
                                    <div className="flex items-center justify-between ml-1">
                                        <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] block">Protocol Designation</label>
                                        <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest">Required_Field</span>
                                    </div>
                                    <input
                                        disabled={isLocked}
                                        type="text"
                                        placeholder="E.G. GRADE_10_GLOBAL_STANDARD_2025"
                                        className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-5 text-white placeholder:text-white/5 focus:outline-none focus:ring-[12px] focus:ring-primary/5 focus:border-primary/40 transition-all font-serif font-black text-lg uppercase tracking-tight disabled:opacity-50 shadow-inner"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] block ml-1">Protocol Category</label>
                                    <div className="flex gap-3 p-1.5 bg-black/40 rounded-2xl border border-white/5 shadow-inner">
                                        {['Standard', 'Package', 'Transport'].map(t => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, type: t })}
                                                className={`flex-1 py-3 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === t ? 'bg-primary text-white shadow-2xl ring-1 ring-white/10' : 'text-white/20 hover:text-white/40 hover:bg-white/[0.02]'}`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] block ml-1">Academic Cycle</label>
                                        <div className="relative group">
                                            <select
                                                disabled={isLocked}
                                                className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-white/80 focus:outline-none focus:ring-[12px] focus:ring-primary/5 focus:border-primary/40 uppercase text-[11px] font-black tracking-widest appearance-none cursor-pointer disabled:opacity-50 transition-all shadow-inner"
                                                value={formData.academicYear}
                                                onChange={e => setFormData({ ...formData, academicYear: e.target.value })}
                                            >
                                                {academicYears.length > 0 ? (
                                                    academicYears.map(y => (
                                                        <option key={y.id} value={y.year_name} className="bg-[#0d0f14]">{y.year_name} {y.is_current ? '(CURRENT)' : ''}</option>
                                                    ))
                                                ) : (
                                                    <option value="2025-2026" className="bg-[#0d0f14]">2025-2026 (STATIC_FALLBACK)</option>
                                                )}
                                            </select>
                                            <ChevronDownIcon className="w-4 h-4 text-white/20 absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-primary transition-colors" />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] block ml-1">Target Registry</label>
                                        <div className="relative group">
                                            <select
                                                disabled={isLocked}
                                                className="w-full bg-black/40 border border-white/5 rounded-2xl px-6 py-4 text-white/80 focus:outline-none focus:ring-[12px] focus:ring-primary/5 focus:border-primary/40 uppercase text-[11px] font-black tracking-widest appearance-none cursor-pointer disabled:opacity-50 transition-all shadow-inner"
                                                value={formData.targetGrade}
                                                onChange={e => setFormData({ ...formData, targetGrade: e.target.value })}
                                            >
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map(g => (
                                                    <option key={g} value={String(g)} className="bg-[#0d0f14]">GRADE {g}</option>
                                                ))}
                                            </select>
                                            <ChevronDownIcon className="w-4 h-4 text-white/20 absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-primary transition-colors" />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] block ml-1">Currency Matrix</label>
                                        <div className="grid grid-cols-2 gap-2 p-1.5 bg-black/40 rounded-2xl border border-white/5 shadow-inner">
                                            {['INR', 'USD'].map(curr => (
                                                <button
                                                    disabled={isLocked}
                                                    key={curr}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, currency: curr as CurrencyCode })}
                                                    className={`py-2.5 rounded-[1.125rem] text-[10px] font-black transition-all ${formData.currency === curr
                                                        ? 'bg-primary text-white shadow-2xl ring-1 ring-white/10'
                                                        : 'text-white/20 hover:text-white/40 hover:bg-white/[0.02]'
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
                                    className={`group p-8 rounded-[2.5rem] border transition-all cursor-pointer flex items-center gap-6 shadow-2xl relative overflow-hidden ${formData.isDefault
                                        ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20'
                                        : 'bg-black/40 border-white/5 hover:border-white/20 hover:bg-black/60 shadow-inner'
                                        }`}
                                >
                                    {formData.isDefault && <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none"></div>}
                                    <div className={`w-8 h-8 rounded-2xl border flex items-center justify-center transition-all ${formData.isDefault ? 'bg-primary border-primary shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'border-white/10 group-hover:border-primary/50'
                                        }`}>
                                        {formData.isDefault && <CheckCircleIcon className="w-5 h-5 text-white" />}
                                    </div>
                                    <div className="flex-1 relative z-10">
                                        <div className="flex items-center justify-between">
                                            <p className={`text-[11px] font-black uppercase tracking-[0.2em] ${formData.isDefault ? 'text-white' : 'text-white/40'}`}>Set as Default Protocol</p>
                                            <ShieldCheckIcon className={`w-6 h-6 transition-colors ${formData.isDefault ? 'text-primary' : 'text-white/10'}`} />
                                        </div>
                                        <p className="text-sm text-white/30 mt-1.5 font-medium">Automatically assign this configuration to new students enrolled in Grade {formData.targetGrade}.</p>
                                    </div>
                                </div>

                                {/* Template Cloning Zone */}
                                {!isLocked && !isEditMode && templates.length > 0 && (
                                    <div className="space-y-6 pt-8 border-t border-white/5">
                                        <div className="flex items-center gap-4 ml-1">
                                            <SparklesIcon className="w-4 h-4 text-primary/40" />
                                            <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] block">Cloning Protocol (Optional)</label>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            {templates.map(t => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => handleApplyTemplate(t)}
                                                    className="p-6 bg-black/40 border border-white/5 rounded-[2.5rem] hover:bg-white/[0.02] hover:border-primary/30 transition-all text-left group shadow-2xl hover:-translate-y-1 active:scale-[0.98] relative overflow-hidden"
                                                >
                                                    <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover:scale-110 transition-transform duration-1000"><LockIcon className="w-20 h-20" /></div>
                                                    <div className="flex justify-between items-center mb-3 relative z-10">
                                                        <span className="px-3 py-1 bg-primary/10 rounded-lg text-[9px] font-black text-primary uppercase tracking-widest ring-1 ring-primary/20">{t.academic_year}</span>
                                                        <SparklesIcon className="w-4 h-4 text-white/10 group-hover:text-primary transition-colors" />
                                                    </div>
                                                    <p className="text-lg font-serif font-black text-white uppercase tracking-tighter truncate mb-1 relative z-10">{t.name}</p>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/20 relative z-10">{t.components?.length || 0} Ledger Nodes Detected</p>
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
                        <div className="space-y-10 animate-in slide-in-from-right-4 duration-500 max-w-3xl mx-auto py-4">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-4">
                                <div className="flex items-center gap-6">
                                    <div className="p-4 bg-primary/10 rounded-2xl text-primary shadow-inner">
                                        <SparklesIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Financial Ledger Nodes</h4>
                                        <p className="text-white/30 text-xs font-medium tracking-wide">Define line items for this institutional financial configuration.</p>
                                    </div>
                                </div>
                                {!isLocked && (
                                    <button
                                        onClick={handleAddComponent}
                                        className="px-6 py-3 bg-primary/10 text-primary font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl border border-primary/20 hover:bg-primary/20 transition-all flex items-center gap-3 transform hover:-translate-y-0.5 active:scale-95 shadow-2xl"
                                    >
                                        <PlusIcon className="w-5 h-5" /> Append Node
                                    </button>
                                )}
                            </div>

                            <div className="space-y-6">
                                {components.map((comp, idx) => (
                                    <div key={idx} className="p-10 bg-black/40 border border-white/5 rounded-[3.5rem] hover:border-white/20 transition-all group shadow-2xl relative overflow-hidden">
                                        <div className="flex flex-col gap-10 relative z-10">
                                            {/* Primary Node Info */}
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                                <div className="md:col-span-3 space-y-3">
                                                    <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] pl-1">Registry Category</label>
                                                    <div className="relative group/select">
                                                        <select
                                                            disabled={isLocked}
                                                            className="w-full bg-white/[0.02] border border-white/5 rounded-2xl px-5 py-4 text-[11px] font-black text-white focus:outline-none focus:ring-[12px] focus:ring-primary/5 focus:border-primary/40 appearance-none cursor-pointer uppercase tracking-widest disabled:opacity-50 transition-all"
                                                            value={comp.category}
                                                            onChange={e => updateComponent(idx, 'category', e.target.value)}
                                                        >
                                                            {['Tuition', 'Books', 'Uniform', 'Transport', 'Hostel', 'Exam', 'Misc'].map(c => <option key={c} value={c} className="bg-[#0d0f14]">{c}</option>)}
                                                        </select>
                                                        <ChevronDownIcon className="w-4 h-4 text-white/10 absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none group-hover/select:text-primary transition-colors" />
                                                    </div>
                                                </div>
                                                <div className="md:col-span-5 space-y-3">
                                                    <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] pl-1">Node Identifier</label>
                                                    <input
                                                        disabled={isLocked}
                                                        type="text"
                                                        placeholder="E.G. TUITION_FEE_Q1"
                                                        className="w-full bg-white/[0.02] border border-white/5 rounded-2xl px-5 py-4 text-[11px] font-mono font-black text-white placeholder:text-white/5 focus:outline-none focus:ring-[12px] focus:ring-primary/5 focus:border-primary/40 uppercase tracking-widest disabled:opacity-50 transition-all shadow-inner"
                                                        value={comp.name}
                                                        onChange={e => updateComponent(idx, 'name', e.target.value.toUpperCase().replace(/\s/g, '_'))}
                                                    />
                                                </div>
                                                <div className="md:col-span-4 space-y-3">
                                                    <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] pl-1">GL Mapping protocol</label>
                                                    <div className="flex gap-2">
                                                        <input
                                                            disabled={isLocked}
                                                            type="text"
                                                            placeholder="COA_CODE (E.G. 4001)"
                                                            className="w-full bg-white/[0.02] border border-white/5 rounded-2xl px-5 py-4 text-[10px] font-mono font-black text-primary placeholder:text-primary/20 focus:outline-none focus:ring-[12px] focus:ring-primary/5 focus:border-primary/40 uppercase tracking-widest disabled:opacity-50 transition-all shadow-inner"
                                                            value={comp.gl_code || ''}
                                                            onChange={e => updateComponent(idx, 'gl_code', e.target.value.toUpperCase())}
                                                        />
                                                        <div className="flex items-center justify-center p-3 bg-primary/5 rounded-xl border border-primary/20 text-primary/40" title="Governance Map Linked">
                                                            <ShieldCheckIcon className="w-5 h-5" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Financial & Attributes Zone */}
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 border-t border-white/[0.03] pt-8">
                                                <div className="md:col-span-3 space-y-3">
                                                    <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] pl-1">Unit Amount</label>
                                                    <div className="relative group/input">
                                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-primary font-black text-xs">
                                                            {formData.currency === 'INR' ? '₹' : '$'}
                                                        </span>
                                                        <input
                                                            disabled={isLocked}
                                                            type="number"
                                                            className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-4 pl-10 pr-5 text-right font-serif font-black text-xl text-white focus:outline-none focus:ring-[12px] focus:ring-primary/5 focus:border-primary/40 disabled:opacity-50 transition-all shadow-inner"
                                                            value={comp.amount}
                                                            onChange={e => updateComponent(idx, 'amount', e.target.value)}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="md:col-span-3 space-y-3">
                                                    <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] pl-1">Billing Cycle</label>
                                                    <div className="relative group/select">
                                                        <select
                                                            disabled={isLocked}
                                                            className="w-full bg-white/[0.02] border border-white/5 rounded-2xl px-5 py-4 text-[11px] font-black text-white focus:outline-none focus:ring-[12px] focus:ring-primary/5 focus:border-primary/40 appearance-none cursor-pointer disabled:opacity-50 uppercase tracking-widest transition-all"
                                                            value={comp.frequency}
                                                            onChange={e => updateComponent(idx, 'frequency', e.target.value)}
                                                        >
                                                            {FREQUENCIES.map(f => <option key={f} value={f} className="bg-[#0d0f14]">{f}</option>)}
                                                        </select>
                                                        <ChevronDownIcon className="w-4 h-4 text-white/10 absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none group-hover/select:text-primary transition-colors" />
                                                    </div>
                                                </div>

                                                <div className="md:col-span-2 space-y-3">
                                                    <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] pl-1">Taxation Index (%)</label>
                                                    <div className="relative group/input">
                                                        <input
                                                            disabled={isLocked}
                                                            type="number"
                                                            placeholder="0"
                                                            className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-4 px-5 text-right font-mono font-black text-xl text-amber-500 placeholder:text-amber-500/10 focus:outline-none focus:ring-[12px] focus:ring-amber-500/5 focus:border-amber-500/40 disabled:opacity-50 transition-all shadow-inner"
                                                            value={comp.tax_percentage || ''}
                                                            onChange={e => updateComponent(idx, 'tax_percentage', Number(e.target.value))}
                                                        />
                                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-amber-500/40 font-black text-xs">%</span>
                                                    </div>
                                                </div>

                                                <div className="md:col-span-4 flex items-end gap-6 pb-1">
                                                    {/* Checkboxes transformed to glass switches */}
                                                    <div className="flex gap-4 flex-1">
                                                        <button
                                                            disabled={isLocked}
                                                            onClick={() => updateComponent(idx, 'is_mandatory', !comp.is_mandatory)}
                                                            className={`flex-1 py-4 rounded-2xl border transition-all text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 ${comp.is_mandatory ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-white/5 border-white/5 text-white/20'}`}
                                                        >
                                                            {comp.is_mandatory ? <CheckCircleIcon className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border border-white/20" />}
                                                            Mandatory
                                                        </button>
                                                        <button
                                                            disabled={isLocked}
                                                            onClick={() => updateComponent(idx, 'is_refundable', !comp.is_refundable)}
                                                            className={`flex-1 py-4 rounded-2xl border transition-all text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 ${comp.is_refundable ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-500' : 'bg-white/5 border-white/5 text-white/20'}`}
                                                        >
                                                            {comp.is_refundable ? <CheckCircleIcon className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border border-white/20" />}
                                                            Refundable
                                                        </button>
                                                    </div>

                                                    {!isLocked && (
                                                        <button
                                                            onClick={() => handleRemoveComponent(idx)}
                                                            className="p-4 text-white/10 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all border border-transparent hover:border-red-500/20 active:scale-90 shadow-xl"
                                                            title="Sever Node"
                                                        >
                                                            <TrashIcon className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-10 bg-primary/5 border border-primary/20 rounded-[2.5rem] flex items-center justify-between shadow-2xl relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none"></div>
                                <div className="relative z-10">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-2">Total Annual Projected Yield</p>
                                    <h5 className="text-sm font-black text-white/40 uppercase tracking-widest">Calculated per instance</h5>
                                </div>
                                <div className="relative z-10 text-right">
                                    <span className="text-4xl font-serif font-black text-white tracking-tighter drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                                        {formatCurrency(totalYearlyAmount, formData.currency)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Success */}
                    {step === 3 && (
                        <div className="flex flex-col items-center justify-center py-20 text-center animate-in zoom-in-95 duration-700 max-w-xl mx-auto">
                            <div className="w-32 h-32 bg-emerald-500/10 rounded-[3rem] flex items-center justify-center mb-10 ring-1 ring-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.2)] relative">
                                <div className="absolute inset-0 bg-emerald-500/5 rounded-[3rem] animate-ping opacity-20"></div>
                                <CheckCircleIcon className="w-12 h-12 text-emerald-500 relative z-10" />
                            </div>
                            <h4 className="text-4xl font-serif font-black text-white uppercase tracking-tighter mb-4">Protocol Finalization Ready</h4>
                            <p className="text-white/30 text-sm font-medium leading-loose">
                                The financial protocol <strong className="text-primary tracking-tight font-black">{formData.name}</strong> has been successfully archived in the institutional registry.
                                <br />
                                Verify the downlink parameters before formal deployment.
                            </p>

                            <div className="grid grid-cols-2 gap-6 w-full mt-12">
                                <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl text-left">
                                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Target Registry</p>
                                    <p className="text-lg font-serif font-black text-white">GRADE {formData.targetGrade}</p>
                                </div>
                                <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl text-left">
                                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Ledger Nodes</p>
                                    <p className="text-lg font-serif font-black text-white">{components.length} ACTIVE</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Institutional Footer */}
                <div className="px-10 py-8 border-t border-white/5 bg-white/[0.01] flex justify-between items-center relative z-20">
                    <button
                        onClick={() => step > 1 ? setStep(step - 1) : onClose()}
                        className="px-8 py-4 text-[10px] font-black text-white/30 hover:text-white uppercase tracking-[0.3em] transition-all flex items-center gap-3 group"
                        disabled={loading}
                    >
                        {step > 1 ? <ChevronLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> : <XIcon className="w-4 h-4" />}
                        {step === 1 ? 'Terminate Process' : 'Previous Module'}
                    </button>

                    <div className="flex gap-4">
                        {step === 3 ? (
                            <>
                                <button
                                    onClick={() => handleFinalize(false)}
                                    disabled={loading || isLocked}
                                    className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl border border-white/5 transition-all disabled:opacity-50"
                                >
                                    Archive as Draft
                                </button>
                                <button
                                    onClick={() => handleFinalize(true)}
                                    disabled={loading || isLocked}
                                    className="px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-emerald-900/40 transition-all flex items-center gap-3 transform hover:-translate-y-1 active:scale-95 disabled:opacity-50"
                                >
                                    {loading ? <Spinner size="sm" className="text-white" /> : <><ShieldCheckIcon className="w-5 h-5" /> Deploy Protocol</>}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setStep(step + 1)}
                                disabled={loading || (step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)}
                                className="px-10 py-4 bg-primary hover:bg-primary/90 text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-primary/30 transition-all flex items-center gap-3 transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                                Synchronize Next <ChevronRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default FeeMasterWizard;