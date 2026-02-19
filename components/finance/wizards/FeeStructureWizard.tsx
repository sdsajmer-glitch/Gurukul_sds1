import React, { useState, useEffect, useMemo } from 'react';
import { supabase, formatError } from '../../../services/supabase';
import Spinner from '../../common/Spinner';
import { XIcon } from '../../icons/XIcon';
import { PlusIcon } from '../../icons/PlusIcon';
import { TrashIcon } from '../../icons/TrashIcon';
import { CheckCircleIcon } from '../../icons/CheckCircleIcon';
import { BookIcon } from '../../icons/BookIcon';
import { ChevronRightIcon } from '../../icons/ChevronRightIcon';
import { ChevronLeftIcon } from '../../icons/ChevronLeftIcon';
import { ChevronDownIcon } from '../../icons/ChevronDownIcon';
import { AlertTriangleIcon } from '../../icons/AlertTriangleIcon';
import { ShieldCheckIcon } from '../../icons/ShieldCheckIcon';
import { SparklesIcon } from '../../icons/SparklesIcon';
import { LockIcon } from '../../icons/LockIcon';
import { motion, AnimatePresence } from 'framer-motion';
import { FeeStructure, FeeComponent } from '../../../types';

// Local type for form state (amount as string)
interface WizardComponent extends Omit<FeeComponent, 'amount'> {
    amount: string;
}

interface FeeStructureWizardProps {
    onClose: () => void;
    onSuccess: () => void;
    branchId: number | null;
    editingStructure?: FeeStructure | null;
}

const FREQUENCIES = ['One-time', 'Monthly', 'Quarterly', 'Annually'];

const formatCurrency = (amount: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
};

const FeeStructureWizard: React.FC<FeeStructureWizardProps> = ({ onClose, onSuccess, branchId, editingStructure }) => {
    const isEditMode = !!editingStructure;
    const isLocked = !!editingStructure?.is_locked;
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        academicYear: '2025-2026',
        targetGrade: '1',
        description: '',
        currency: 'INR',
        isDefault: false,
        type: 'Standard' as const // fix type inference
    });

    const [components, setComponents] = useState<WizardComponent[]>([
        { name: 'TUITION_FEES', amount: '0', frequency: 'Monthly', is_mandatory: true, category: 'Tuition', gl_code: '', tax_percentage: 0, is_refundable: false }
    ]);

    const [academicYears, setAcademicYears] = useState<any[]>([]);

    useEffect(() => {
        const init = async () => {
            setInitializing(true);
            try {
                // Fetch Years
                const { data: years } = await supabase.from('academic_years').select('*').order('start_date', { ascending: false });
                if (years && years.length > 0) {
                    setAcademicYears(years);
                    if (!isEditMode) setFormData(prev => ({ ...prev, academicYear: years[0].year_name }));
                }

                // Load Edit Data
                if (editingStructure) {
                    setFormData({
                        name: editingStructure.name,
                        academicYear: editingStructure.academic_year,
                        targetGrade: editingStructure.target_grade,
                        description: editingStructure.description || '',
                        currency: editingStructure.currency,
                        isDefault: editingStructure.is_default,
                        type: editingStructure.type as any
                    });

                    if (editingStructure.components) {
                        setComponents(editingStructure.components.map(c => ({
                            id: c.id,
                            name: c.name,
                            amount: String(c.amount),
                            frequency: c.frequency,
                            is_mandatory: c.is_mandatory,
                            category: c.category || 'Tuition',
                            gl_code: c.gl_code || '',
                            tax_percentage: c.tax_percentage || 0,
                            is_refundable: c.is_refundable || false
                        })));
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setInitializing(false);
            }
        };
        init();
    }, [editingStructure, isEditMode]);

    // Helpers
    const handleAddComponent = () => {
        if (isLocked) return;
        setComponents([...components, { name: '', amount: '0', frequency: 'Monthly', is_mandatory: false, category: 'Tuition', gl_code: '', tax_percentage: 0, is_refundable: false }]);
    };

    const updateComponent = (index: number, field: string, value: any) => {
        if (isLocked) return;
        const newComponents = [...components];
        (newComponents[index] as any)[field] = value;
        setComponents(newComponents);
    };

    const removeComponent = (index: number) => {
        if (isLocked || components.length === 1) return;
        setComponents(components.filter((_, i) => i !== index));
    };

    const totalAmount = useMemo(() => {
        return components.reduce((acc, c) => {
            let mult = 1;
            if (c.frequency === 'Monthly') mult = 12;
            else if (c.frequency === 'Quarterly') mult = 4;
            return acc + (Number(c.amount) || 0) * mult;
        }, 0);
    }, [components]);

    // Save Logic
    const handleSave = async (activate: boolean = false) => {
        if (!branchId) return;
        setLoading(true);
        setError(null);
        setValidationErrors([]);

        try {
            // 1. Upsert Structure
            const { data: struct, error: structError } = await supabase
                .from('finance_fee_structures')
                .upsert({
                    id: editingStructure?.id, // If undefined, creates new
                    branch_id: branchId,
                    name: formData.name,
                    academic_year: formData.academicYear,
                    target_grade: formData.targetGrade,
                    description: formData.description,
                    currency: formData.currency,
                    is_default: formData.isDefault,
                    type: formData.type,
                    status: editingStructure?.status || 'Draft', // Defaults to Draft, updated later if activate
                    updated_at: new Date()
                })
                .select()
                .single();

            if (structError) throw structError;
            if (!struct) throw new Error("Failed to save structure header");

            // 2. Upsert Components (Delete all and re-insert for simplicity and data integrity in this wizard flow)
            await supabase.from('finance_fee_components').delete().eq('structure_id', struct.id);

            const componentsPayload = components.map(c => ({
                structure_id: struct.id,
                name: c.name,
                amount: Number(c.amount),
                frequency: c.frequency,
                is_mandatory: c.is_mandatory,
                category: c.category,
                gl_code: c.gl_code,
                tax_percentage: c.tax_percentage,
                is_refundable: c.is_refundable
            }));

            const { error: compError } = await supabase.from('finance_fee_components').insert(componentsPayload);
            if (compError) throw compError;

            // 3. If Activate requested, run Validation RPC
            if (activate) {
                const { data: validation, error: rpcError } = await supabase.rpc('fn_activate_finance_structure', {
                    p_structure_id: struct.id,
                    p_user_id: (await supabase.auth.getUser()).data.user?.id
                });

                if (rpcError) throw rpcError;

                if (!validation.success) {
                    setValidationErrors(validation.validation?.errors || ['Unknown validation failure']);
                    setLoading(false);
                    return;
                }
            }

            onSuccess();
        } catch (err: any) {
            console.error("Save failed:", err);
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
                    className="w-full max-w-5xl h-[90vh] bg-[#0c0e14] border border-white/10 rounded-[2rem] flex flex-col shadow-2xl relative overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                        <div className="flex items-center gap-6">
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
                                <BookIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-serif font-black text-white uppercase tracking-tight">
                                    {isEditMode ? 'Edit Fee Protocol' : 'New Fee Protocol'}
                                </h2>
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Master Control Layer</span>
                                    {isLocked && <span className="px-2 py-0.5 bg-amber-500/20 text-amber-500 text-[9px] font-bold rounded uppercase">Locked</span>}
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-8 relative">
                        {/* Error Banner */}
                        {error && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 flex gap-3 text-red-200 text-sm rounded-xl">
                                <AlertTriangleIcon className="w-5 h-5 shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Validation Errors */}
                        {validationErrors.length > 0 && (
                            <div className="mb-6 p-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                                <h4 className="flex items-center gap-2 text-amber-500 font-bold mb-3 uppercase text-xs tracking-widest">
                                    <AlertTriangleIcon className="w-4 h-4" /> Validation Failed
                                </h4>
                                <ul className="space-y-2">
                                    {validationErrors.map((err, i) => (
                                        <li key={i} className="text-amber-200/80 text-sm flex items-start gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                            {err}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {step === 1 && (
                            <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-right-4 duration-500">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Protocol Name</label>
                                        <input
                                            disabled={isLocked}
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-4 text-white text-lg font-bold focus:border-indigo-500/50 outline-none transition-all"
                                            placeholder="e.g. GRADE 10 STANDARD"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Target Grade</label>
                                        <select
                                            disabled={isLocked}
                                            value={formData.targetGrade}
                                            onChange={e => setFormData({ ...formData, targetGrade: e.target.value })}
                                            className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-4 text-white font-mono uppercase outline-none"
                                        >
                                            {[...Array(12)].map((_, i) => <option key={i} value={String(i + 1)} className="bg-gray-900">Grade {i + 1}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Academic Year</label>
                                        <select
                                            disabled={isLocked}
                                            value={formData.academicYear}
                                            onChange={e => setFormData({ ...formData, academicYear: e.target.value })}
                                            className="w-full bg-white/[0.03] border border-white/5 rounded-xl p-4 text-white font-mono uppercase outline-none"
                                        >
                                            {academicYears.map(y => <option key={y.year_name} value={y.year_name} className="bg-gray-900">{y.year_name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-white/30 uppercase tracking-widest pl-1">Currency</label>
                                        <div className="flex gap-2 p-1 bg-white/[0.03] rounded-xl border border-white/5">
                                            {['INR', 'USD'].map(c => (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    disabled={isLocked}
                                                    onClick={() => setFormData({ ...formData, currency: c })}
                                                    className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all ${formData.currency === c ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/30 hover:text-white'}`}
                                                >
                                                    {c}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                                <div className="flex justify-between items-end mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Fee Components</h3>
                                        <p className="text-white/40 text-xs mt-1">Define the breakdown of fees for this structure.</p>
                                    </div>
                                    {!isLocked && (
                                        <button onClick={handleAddComponent} className="px-4 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all flex items-center gap-2">
                                            <PlusIcon className="w-4 h-4" /> Add Component
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    {components.map((comp, idx) => (
                                        <div key={idx} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center gap-4 group hover:border-white/10 transition-colors">
                                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/30 font-mono text-xs">
                                                {idx + 1}
                                            </div>

                                            <div className="flex-1 grid grid-cols-12 gap-4">
                                                <div className="col-span-3">
                                                    <label className="text-[9px] text-white/20 uppercase font-black block mb-1">Name</label>
                                                    <input
                                                        disabled={isLocked}
                                                        value={comp.name}
                                                        onChange={e => updateComponent(idx, 'name', e.target.value.toUpperCase())}
                                                        className="w-full bg-transparent border-b border-white/10 py-1 text-sm font-bold text-white outline-none focus:border-indigo-500 uppercase placeholder:text-white/10"
                                                        placeholder="TUITION"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="text-[9px] text-white/20 uppercase font-black block mb-1">Amount</label>
                                                    <input
                                                        disabled={isLocked}
                                                        type="number"
                                                        value={comp.amount}
                                                        onChange={e => updateComponent(idx, 'amount', e.target.value)}
                                                        className="w-full bg-transparent border-b border-white/10 py-1 text-sm font-mono text-white outline-none focus:border-indigo-500 text-right"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="text-[9px] text-white/20 uppercase font-black block mb-1">Frequency</label>
                                                    <select
                                                        disabled={isLocked}
                                                        value={comp.frequency}
                                                        onChange={e => updateComponent(idx, 'frequency', e.target.value)}
                                                        className="w-full bg-transparent border-b border-white/10 py-1 text-xs text-white outline-none focus:border-indigo-500 bg-[#0c0e14]"
                                                    >
                                                        {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                                                    </select>
                                                </div>
                                                <div className="col-span-3">
                                                    <label className="text-[9px] text-white/20 uppercase font-black block mb-1">GL Code (Account)</label>
                                                    <input
                                                        disabled={isLocked}
                                                        value={comp.gl_code}
                                                        onChange={e => updateComponent(idx, 'gl_code', e.target.value)}
                                                        className="w-full bg-transparent border-b border-white/10 py-1 text-xs font-mono text-indigo-400 outline-none focus:border-indigo-500 uppercase placeholder:text-white/10"
                                                        placeholder="REQ-001"
                                                    />
                                                </div>
                                                <div className="col-span-2 flex items-end justify-end">
                                                    {!isLocked && (
                                                        <button onClick={() => removeComponent(idx)} className="p-2 text-white/20 hover:text-red-500 transition-colors">
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-6 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl flex justify-between items-center mt-6">
                                    <div>
                                        <p className="text-indigo-400 text-xs font-black uppercase tracking-widest">Total Projected Revenue</p>
                                        <p className="text-white/40 text-[10px] uppercase">Per Student / Year</p>
                                    </div>
                                    <p className="text-4xl font-serif font-black text-white tracking-tight">
                                        {formatCurrency(totalAmount, formData.currency)}
                                    </p>
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
                                <>
                                    <button
                                        disabled={loading || isLocked}
                                        onClick={() => handleSave(false)}
                                        className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all border border-white/5"
                                    >
                                        Save Draft
                                    </button>
                                    <button
                                        disabled={loading || isLocked}
                                        onClick={() => handleSave(true)}
                                        className="px-8 py-3 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                                    >
                                        {loading ? <Spinner size="sm" className="text-white" /> : <><ShieldCheckIcon className="w-4 h-4" /> Activate Protocol</>}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default FeeStructureWizard;
