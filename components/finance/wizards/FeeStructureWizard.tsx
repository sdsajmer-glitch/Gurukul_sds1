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
    const getCurrencySymbol = (currency: string) => {
        switch (currency) {
            case 'USD': return '$';
            case 'EUR': return '€';
            case 'GBP': return '£';
            default: return '₹';
        }
    };

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
        academicYear: '', // Will be set by init
        targetGrade: '1',
        description: '',
        currency: 'INR',
        isDefault: false,
        type: 'Standard' as const
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
                const { data: years, error: yearsError } = await supabase
                    .from('academic_years')
                    .select('year_name')
                    .order('start_date', { ascending: false });

                const finalYears = (years && years.length > 0)
                    ? years
                    : [{ year_name: '2024-2025' }, { year_name: '2025-2026' }, { year_name: '2026-2027' }];

                setAcademicYears(finalYears);

                if (!isEditMode) {
                    // Set current year if found, else first year
                    const currentYear = years?.find(y => (y as any).is_current)?.year_name || finalYears[0].year_name;
                    setFormData(prev => ({ ...prev, academicYear: currentYear }));
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

    const STRUCTURE_TYPES = [
        { value: 'Standard', label: 'Standard', desc: 'Default fee plan for regular students', icon: '📘' },
        { value: 'Premium', label: 'Premium', desc: 'Enhanced plan with extra facilities', icon: '💎' },
        { value: 'Scholarship', label: 'Scholarship', desc: 'Reduced or waived fees for merit/need', icon: '🎓' },
    ];

    const CATEGORIES = ['Tuition', 'Transport', 'Lab', 'Library', 'Sports', 'Extracurricular', 'Hostel', 'Examination', 'Infrastructure', 'Other'];

    const stepConfig = [
        { num: 1, label: 'Protocol Setup', desc: 'Name, grade, year & type' },
        { num: 2, label: 'Fee Components', desc: 'Define fee breakdown' },
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.08,
                delayChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 15, scale: 0.98 },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: { type: 'spring' as const, stiffness: 300, damping: 25 }
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4" onClick={onClose}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                    className="w-full max-w-5xl h-[90vh] bg-[#0a0c12] border border-white/[0.06] rounded-3xl flex flex-col shadow-2xl relative overflow-hidden"
                    onClick={e => e.stopPropagation()}
                >
                    {/* ─── Header ─── */}
                    <div className="px-8 py-6 border-b border-white/[0.04] flex justify-between items-center bg-gradient-to-r from-indigo-500/[0.03] to-transparent relative">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_0%_50%,rgba(99,102,241,0.06),transparent_60%)] pointer-events-none" />
                        <div className="flex items-center gap-5 relative z-10">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
                                <BookIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-serif font-bold text-white tracking-tight">
                                    {isEditMode ? 'Edit Fee Protocol' : 'New Fee Protocol'}
                                </h2>
                                <div className="flex items-center gap-3 mt-0.5">
                                    <span className="text-[10px] font-bold text-white/25 uppercase tracking-[0.2em]">Master Control Layer</span>
                                    {isLocked && (
                                        <span className="px-2 py-0.5 bg-amber-500/15 text-amber-500 text-[9px] font-bold rounded-md uppercase flex items-center gap-1">
                                            <LockIcon className="w-3 h-3" /> Locked
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2.5 hover:bg-white/[0.06] rounded-xl transition-colors text-white/30 hover:text-white relative z-10">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* ─── Step Indicator ─── */}
                    <div className="px-8 py-4 border-b border-white/[0.03] bg-white/[0.01]">
                        <div className="flex items-center gap-0 max-w-md mx-auto">
                            {stepConfig.map((s, i) => (
                                <React.Fragment key={s.num}>
                                    <button
                                        onClick={() => !isLocked && setStep(s.num)}
                                        className={`flex items-center gap-3 group transition-all ${step >= s.num ? 'opacity-100' : 'opacity-40 hover:opacity-60'}`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === s.num
                                            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 ring-4 ring-indigo-500/10'
                                            : step > s.num
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                : 'bg-white/[0.04] text-white/30 border border-white/[0.06]'
                                            }`}>
                                            {step > s.num ? <CheckCircleIcon className="w-4 h-4" /> : s.num}
                                        </div>
                                        <div className="text-left hidden sm:block">
                                            <p className={`text-xs font-bold ${step === s.num ? 'text-white' : 'text-white/40'}`}>{s.label}</p>
                                            <p className="text-[9px] text-white/20">{s.desc}</p>
                                        </div>
                                    </button>
                                    {i < stepConfig.length - 1 && (
                                        <div className={`flex-1 h-px mx-4 transition-colors ${step > s.num ? 'bg-emerald-500/30' : 'bg-white/[0.06]'}`} />
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    {/* ─── Content ─── */}
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
                        {/* Error Banner */}
                        {error && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 bg-red-500/10 border border-red-500/20 flex gap-3 text-red-200 text-sm rounded-2xl items-start">
                                <AlertTriangleIcon className="w-5 h-5 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Protocol Error</p>
                                    <p className="text-sm text-red-300/80">{error}</p>
                                </div>
                            </motion.div>
                        )}

                        {/* Validation Errors */}
                        {validationErrors.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-5 bg-amber-500/[0.06] border border-amber-500/[0.15] rounded-2xl">
                                <h4 className="flex items-center gap-2 text-amber-500 font-bold mb-3 uppercase text-[10px] tracking-[0.2em]">
                                    <AlertTriangleIcon className="w-4 h-4" /> Validation Failed
                                </h4>
                                <ul className="space-y-2">
                                    {validationErrors.map((err, i) => (
                                        <li key={i} className="text-amber-200/70 text-sm flex items-start gap-2.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                            {err}
                                        </li>
                                    ))}
                                </ul>
                            </motion.div>
                        )}

                        <AnimatePresence mode="wait">
                            {step === 1 && (
                                <motion.div
                                    key="step1"
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit={{ opacity: 0, x: -20 }}
                                    className="max-w-3xl mx-auto space-y-8 pb-8"
                                >
                                    {/* Row 1: Name + Grade */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <motion.div variants={itemVariants} className="space-y-2.5">
                                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] pl-1">Protocol Name</label>
                                            <div className="relative group">
                                                <div className="absolute -inset-[1px] bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity blur-sm" />
                                                <input
                                                    disabled={isLocked}
                                                    value={formData.name}
                                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                    className="w-full bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.06] rounded-2xl p-4 text-white text-base font-bold focus:border-indigo-500/50 focus:ring-0 outline-none transition-all placeholder:text-white/10 relative z-10"
                                                    placeholder="e.g. GRADE 10 STANDARD"
                                                />
                                            </div>
                                        </motion.div>
                                        <motion.div variants={itemVariants} className="space-y-2.5">
                                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] pl-1">Target Grade</label>
                                            <div className="relative group/select">
                                                <div className="absolute inset-0 bg-indigo-500/5 rounded-2xl opacity-0 group-hover/select:opacity-100 transition-opacity pointer-events-none" />
                                                <select
                                                    disabled={isLocked}
                                                    value={formData.targetGrade}
                                                    onChange={e => setFormData({ ...formData, targetGrade: e.target.value })}
                                                    className="w-full bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.06] rounded-2xl p-4 pr-12 text-white font-bold uppercase outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer transition-all appearance-none relative z-10"
                                                >
                                                    {[...Array(12)].map((_, i) => <option key={i} value={String(i + 1)} className="bg-[#0c0e14]">Grade {i + 1}</option>)}
                                                    <option value="Pre-K" className="bg-[#0c0e14]">Pre-K</option>
                                                    <option value="Nursery" className="bg-[#0c0e14]">Nursery</option>
                                                    <option value="LKG" className="bg-[#0c0e14]">LKG</option>
                                                    <option value="UKG" className="bg-[#0c0e14]">UKG</option>
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/20 group-hover/select:text-indigo-400 z-20 transition-colors">
                                                    <ChevronDownIcon className="w-5 h-5" />
                                                </div>
                                            </div>
                                        </motion.div>
                                    </div>

                                    {/* Row 2: Academic Year + Currency */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <motion.div variants={itemVariants} className="space-y-2.5">
                                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] pl-1">Academic Year</label>
                                            <div className="relative group/select">
                                                <div className="absolute inset-0 bg-indigo-500/5 rounded-2xl opacity-0 group-hover/select:opacity-100 transition-opacity pointer-events-none" />
                                                <select
                                                    disabled={isLocked}
                                                    value={formData.academicYear}
                                                    onChange={e => setFormData({ ...formData, academicYear: e.target.value })}
                                                    className="w-full bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.06] rounded-2xl p-4 pr-12 text-white font-bold uppercase outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer transition-all appearance-none relative z-10"
                                                >
                                                    {academicYears.length > 0 ? (
                                                        academicYears.map(y => <option key={y.year_name} value={y.year_name} className="bg-[#0c0e14]">{y.year_name}</option>)
                                                    ) : (
                                                        <option value="" className="bg-[#0c0e14]">No Years Configured</option>
                                                    )}
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/20 group-hover/select:text-indigo-400 z-20 transition-colors">
                                                    <ChevronDownIcon className="w-5 h-5" />
                                                </div>
                                            </div>
                                        </motion.div>
                                        <motion.div variants={itemVariants} className="space-y-2.5">
                                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] pl-1">Currency</label>
                                            <div className="flex gap-1.5 p-1.5 bg-white/[0.03] backdrop-blur-md rounded-2xl border border-white/[0.06]">
                                                {['INR', 'USD', 'EUR', 'GBP'].map(c => (
                                                    <button
                                                        key={c}
                                                        type="button"
                                                        disabled={isLocked}
                                                        onClick={() => setFormData({ ...formData, currency: c })}
                                                        className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 relative overflow-hidden group/btn ${formData.currency === c
                                                            ? 'text-white shadow-[0_0_20px_rgba(99,102,241,0.2)]'
                                                            : 'text-white/25 hover:text-white/60'
                                                            }`}
                                                    >
                                                        {formData.currency === c && (
                                                            <motion.div
                                                                layoutId="activeCurrency"
                                                                className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-indigo-600"
                                                                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                                                            />
                                                        )}
                                                        <span className="relative z-10">{c}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </motion.div>
                                    </div>

                                    {/* Row 3: Structure Type */}
                                    <motion.div variants={itemVariants} className="space-y-2.5">
                                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] pl-1">Structure Type</label>
                                        <div className="grid grid-cols-3 gap-4">
                                            {STRUCTURE_TYPES.map(t => (
                                                <button
                                                    key={t.value}
                                                    type="button"
                                                    disabled={isLocked}
                                                    onClick={() => setFormData({ ...formData, type: t.value as any })}
                                                    className={`p-5 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden group/type ${formData.type === t.value
                                                        ? 'bg-indigo-500/[0.08] border-indigo-500/40 ring-1 ring-indigo-500/20 shadow-lg shadow-indigo-500/5'
                                                        : 'bg-white/[0.02] border-white/[0.05] hover:border-white/[0.12] hover:bg-white/[0.04]'
                                                        }`}
                                                >
                                                    {formData.type === t.value && (
                                                        <div className="absolute top-0 right-0 p-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-3 mb-2.5">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all duration-300 ${formData.type === t.value ? 'bg-indigo-500/20 scale-110 shadow-inner' : 'bg-white/[0.04]'}`}>
                                                            {t.icon}
                                                        </div>
                                                        <span className={`text-sm font-bold tracking-tight ${formData.type === t.value ? 'text-white' : 'text-white/60'}`}>{t.label}</span>
                                                    </div>
                                                    <p className={`text-[10px] leading-relaxed font-medium ${formData.type === t.value ? 'text-indigo-300/60' : 'text-white/20'}`}>{t.desc}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>

                                    {/* Row 4: Description */}
                                    <motion.div variants={itemVariants} className="space-y-2.5">
                                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] pl-1 flex justify-between">
                                            <span>Description <span className="text-white/15 normal-case tracking-normal ml-1">(optional)</span></span>
                                            <span className="text-[9px] text-white/10 font-mono tracking-normal">{formData.description.length}/200</span>
                                        </label>
                                        <div className="relative group">
                                            <div className="absolute -inset-[1px] bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity blur-sm" />
                                            <textarea
                                                disabled={isLocked}
                                                value={formData.description}
                                                onChange={e => setFormData({ ...formData, description: e.target.value.slice(0, 200) })}
                                                rows={3}
                                                className="w-full bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.06] rounded-2xl p-4 text-sm text-white/80 focus:border-indigo-500/50 focus:ring-0 outline-none transition-all resize-none placeholder:text-white/10 relative z-10"
                                                placeholder="Brief description of this fee protocol, e.g. Standard tuition with lab and transport for Grade 10 students..."
                                            />
                                        </div>
                                    </motion.div>

                                    {/* Default toggle */}
                                    <motion.div variants={itemVariants} className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/[0.05] rounded-3xl hover:bg-white/[0.03] transition-colors group/toggle">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${formData.isDefault ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/[0.04] text-white/20'}`}>
                                                <CheckCircleIcon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white/80 tracking-tight">Set as Default Protocol</p>
                                                <p className="text-[10px] text-white/30 mt-0.5">Auto-assign to new students enrolled in the target grade</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={isLocked}
                                            onClick={() => setFormData({ ...formData, isDefault: !formData.isDefault })}
                                            className={`relative w-11 h-6 rounded-full transition-all duration-300 ${formData.isDefault ? 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'bg-white/10 hover:bg-white/15'}`}
                                        >
                                            <motion.div
                                                animate={{ x: formData.isDefault ? 22 : 2 }}
                                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                                className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md"
                                            />
                                        </button>
                                    </motion.div>
                                </motion.div>
                            )}

                            {step === 2 && (
                                <motion.div
                                    key="step2"
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6 pb-8"
                                >
                                    {/* Header Row */}
                                    <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-2">
                                        <div>
                                            <h3 className="text-xl font-serif font-bold text-white tracking-tight">Fee Components</h3>
                                            <p className="text-white/30 text-[11px] mt-1.5 leading-relaxed max-w-md">Define the granular breakdown of this protocol. Each component supports independent frequency and GL alignment.</p>
                                        </div>
                                        {!isLocked && (
                                            <button
                                                onClick={handleAddComponent}
                                                className="px-6 py-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-indigo-500 hover:text-white transition-all duration-300 flex items-center gap-2.5 shadow-lg shadow-indigo-500/5 group"
                                            >
                                                <PlusIcon className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" /> Add Component
                                            </button>
                                        )}
                                    </motion.div>

                                    {/* Component Cards */}
                                    <div className="space-y-4">
                                        {components.map((comp, idx) => {
                                            const annualized = (Number(comp.amount) || 0) * (comp.frequency === 'Monthly' ? 12 : comp.frequency === 'Quarterly' ? 4 : 1);
                                            return (
                                                <motion.div
                                                    key={idx}
                                                    variants={itemVariants}
                                                    className="p-6 bg-white/[0.02] border border-white/[0.05] rounded-3xl group hover:border-indigo-500/30 hover:bg-white/[0.03] transition-all duration-300 relative overflow-hidden"
                                                >
                                                    <div className="flex items-start gap-5">
                                                        {/* Index badge */}
                                                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/[0.08] flex items-center justify-center text-indigo-400 font-mono text-sm font-bold border border-indigo-500/[0.1] shrink-0 mt-1 shadow-inner">
                                                            {idx + 1}
                                                        </div>

                                                        {/* Fields Grid */}
                                                        <div className="flex-1 grid grid-cols-12 gap-x-6 gap-y-5">
                                                            {/* Name */}
                                                            <div className="col-span-12 sm:col-span-3">
                                                                <label className="text-[9px] text-white/20 uppercase font-bold tracking-[0.15em] block mb-2 px-1">Component Name</label>
                                                                <input
                                                                    disabled={isLocked}
                                                                    value={comp.name}
                                                                    onChange={e => updateComponent(idx, 'name', e.target.value.toUpperCase())}
                                                                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-indigo-500/50 uppercase placeholder:text-white/10 transition-all shadow-sm"
                                                                    placeholder="e.g. TUITION"
                                                                />
                                                            </div>
                                                            {/* Amount */}
                                                            <div className="col-span-6 sm:col-span-2">
                                                                <label className="text-[9px] text-white/20 uppercase font-bold tracking-[0.15em] block mb-2 px-1">Amount</label>
                                                                <div className="relative group/input">
                                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-400 font-bold text-sm">{getCurrencySymbol(formData.currency)}</span>
                                                                    <input
                                                                        disabled={isLocked}
                                                                        type="number"
                                                                        value={comp.amount}
                                                                        onChange={e => updateComponent(idx, 'amount', e.target.value)}
                                                                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-8 pr-3 py-3 text-sm font-mono font-bold text-white outline-none focus:border-indigo-500/50 text-right transition-all"
                                                                    />
                                                                </div>
                                                            </div>
                                                            {/* Frequency */}
                                                            <div className="col-span-6 sm:col-span-2">
                                                                <label className="text-[9px] text-white/20 uppercase font-bold tracking-[0.15em] block mb-2 px-1">Frequency</label>
                                                                <div className="relative">
                                                                    <select
                                                                        disabled={isLocked}
                                                                        value={comp.frequency}
                                                                        onChange={e => updateComponent(idx, 'frequency', e.target.value)}
                                                                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-[11px] font-bold text-white outline-none focus:border-indigo-500/50 cursor-pointer transition-all appearance-none"
                                                                    >
                                                                        {FREQUENCIES.map(f => <option key={f} value={f} className="bg-[#0c0e14]">{f}</option>)}
                                                                    </select>
                                                                    <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none group-hover/select:text-indigo-400" />
                                                                </div>
                                                            </div>
                                                            {/* Category */}
                                                            <div className="col-span-6 sm:col-span-2">
                                                                <label className="text-[9px] text-white/20 uppercase font-bold tracking-[0.15em] block mb-2 px-1">Category</label>
                                                                <div className="relative">
                                                                    <select
                                                                        disabled={isLocked}
                                                                        value={comp.category}
                                                                        onChange={e => updateComponent(idx, 'category', e.target.value)}
                                                                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-[11px] font-bold text-white outline-none focus:border-indigo-500/50 cursor-pointer transition-all appearance-none"
                                                                    >
                                                                        {CATEGORIES.map(c => <option key={c} value={c} className="bg-[#0c0e14]">{c}</option>)}
                                                                    </select>
                                                                    <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
                                                                </div>
                                                            </div>
                                                            {/* GL Code */}
                                                            <div className="col-span-6 sm:col-span-2">
                                                                <label className="text-[9px] text-white/20 uppercase font-bold tracking-[0.15em] block mb-2 px-1">GL Code</label>
                                                                <input
                                                                    disabled={isLocked}
                                                                    value={comp.gl_code}
                                                                    onChange={e => updateComponent(idx, 'gl_code', e.target.value)}
                                                                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-[11px] font-mono font-bold text-indigo-400 outline-none focus:border-indigo-500/50 uppercase placeholder:text-white/10 transition-all"
                                                                    placeholder="ACC-001"
                                                                />
                                                            </div>
                                                            {/* Delete */}
                                                            <div className="col-span-12 sm:col-span-1 flex items-end justify-end pb-1">
                                                                {!isLocked && (
                                                                    <button
                                                                        onClick={() => removeComponent(idx)}
                                                                        disabled={components.length <= 1}
                                                                        className="p-2.5 text-white/10 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed group/del"
                                                                    >
                                                                        <TrashIcon className="w-5 h-5 group-hover/del:scale-110 transition-transform" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Annual estimate chip */}
                                                    {comp.frequency !== 'One-time' && Number(comp.amount) > 0 && (
                                                        <div className="mt-4 ml-14 flex items-center gap-3">
                                                            <div className="h-px w-8 bg-white/[0.05]" />
                                                            <span className="text-[10px] text-white/15 uppercase font-bold tracking-widest">Annual projection:</span>
                                                            <span className="text-[11px] font-mono font-bold text-emerald-400/80 bg-emerald-500/5 px-2.5 py-1 rounded-lg border border-emerald-500/10 shadow-sm">{formatCurrency(annualized, formData.currency)}</span>
                                                        </div>
                                                    )}
                                                </motion.div>
                                            );
                                        })}
                                    </div>

                                    {/* Total Summary Card */}
                                    <motion.div variants={itemVariants} className="p-8 bg-gradient-to-br from-indigo-500/[0.08] via-indigo-600/[0.03] to-purple-500/[0.05] border border-indigo-500/20 rounded-[2rem] flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mt-6 shadow-2xl relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(99,102,241,0.1),transparent_50%)]" />
                                        <div className="relative z-10">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                                <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-[0.3em]">Institutional Revenue Projection</p>
                                            </div>
                                            <p className="text-white/40 text-[11px] leading-relaxed max-w-sm">Aggregated annual value for {formData.name} across {components.length} components for the {formData.academicYear} session.</p>
                                        </div>
                                        <div className="relative z-10 text-left md:text-right">
                                            <motion.p
                                                key={totalAmount}
                                                initial={{ y: 10, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                className="text-4xl md:text-5xl font-serif font-black text-white tracking-tight drop-shadow-2xl"
                                            >
                                                {formatCurrency(totalAmount, formData.currency)}
                                            </motion.p>
                                            {totalAmount > 0 && (
                                                <div className="flex items-center md:justify-end gap-3 mt-2">
                                                    <span className="text-[10px] text-white/20 uppercase font-bold tracking-widest">Budgeted Monthly:</span>
                                                    <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/10">{formatCurrency(Math.round(totalAmount / 12), formData.currency)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* ─── Footer ─── */}
                    <div className="px-8 py-5 border-t border-white/[0.04] bg-white/[0.015] flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            {step > 1 ? (
                                <button onClick={() => setStep(step - 1)} className="text-white/30 hover:text-white text-[10px] font-bold uppercase tracking-[0.15em] flex items-center gap-2 px-4 py-3 hover:bg-white/[0.04] rounded-xl transition-all">
                                    <ChevronLeftIcon className="w-4 h-4" /> Back
                                </button>
                            ) : <div className="hidden sm:block" />}

                            {/* Live total pill visible on step 1 */}
                            {step === 1 && totalAmount > 0 && (
                                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] rounded-lg border border-white/[0.05]">
                                    <span className="text-[9px] text-white/20 uppercase tracking-wider">Est. Total:</span>
                                    <span className="text-xs font-mono font-bold text-indigo-400">{formatCurrency(totalAmount, formData.currency)}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 w-full sm:w-auto">
                            {step < 2 ? (
                                <button
                                    onClick={() => {
                                        if (!formData.name.trim()) { setError('Protocol name is required.'); return; }
                                        setError(null);
                                        setStep(step + 1);
                                    }}
                                    className="w-full sm:w-auto px-8 py-3.5 bg-indigo-500 hover:bg-indigo-400 text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                                >
                                    Continue <ChevronRightIcon className="w-4 h-4" />
                                </button>
                            ) : (
                                <>
                                    <button
                                        disabled={loading || isLocked}
                                        onClick={() => handleSave(false)}
                                        className="w-full sm:w-auto px-6 py-3.5 bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white text-[10px] font-bold uppercase tracking-[0.15em] rounded-xl transition-all border border-white/[0.06] disabled:opacity-40"
                                    >
                                        Save Draft
                                    </button>
                                    <button
                                        disabled={loading || isLocked}
                                        onClick={() => handleSave(true)}
                                        className="w-full sm:w-auto px-8 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-40"
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
