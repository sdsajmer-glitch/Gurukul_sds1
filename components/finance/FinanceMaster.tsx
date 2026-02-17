import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon } from '../icons/PlusIcon';
import { BookIcon } from '../icons/BookIcon';
import { EditIcon } from '../icons/EditIcon';
import { RefreshIcon } from '../icons/RefreshIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { ArrowRightIcon } from '../icons/ArrowRightIcon';
import { CreditCardIcon } from '../icons/CreditCardIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { WorkflowIcon } from '../icons/WorkflowIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { SaveIcon } from '../icons/SaveIcon';
import { RotateCcwIcon } from '../icons/RotateCcwIcon';
import { HistoryIcon } from '../icons/HistoryIcon';
import { SearchIcon } from '../icons/SearchIcon';
import { FilterIcon } from '../icons/FilterIcon';
import { XIcon } from '../icons/XIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';

import { FeeStructure, CurrencyCode } from '../../types';
import { supabase } from '../../services/supabase';

interface FinanceMasterProps {
    feeStructures: FeeStructure[];
    paymentProtocols?: any[];
    adjustmentRules?: any[];
    onNewStructure: () => void;
    onEditStructure: (fs: FeeStructure) => void;
    onNewProtocol?: () => void;
    onNewRule?: () => void;
    currency: CurrencyCode;
    branchId?: number | null;
    onUpdate?: () => void;
    readiness?: any;
    masterState?: {
        settings: any;
        taxes: any[];
        approvals: any[];
        readiness: any;
    };
    onGuide?: () => void;
}

const AccordionItem: React.FC<{
    id: string;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    badge?: string | number;
    color?: string;
}> = ({ id, title, subtitle, icon, isOpen, onToggle, children, badge, color = 'primary' }) => {
    return (
        <div className={`group rounded-3xl border transition-all duration-500 overflow-hidden ${isOpen
            ? 'bg-[#12141c] border-white/10 shadow-2xl ring-1 ring-white/5'
            : 'bg-[#0c0d12] border-white/5 hover:bg-[#12141c] hover:border-white/10'
            }`}>
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-6 md:p-8 text-left outline-none"
            >
                <div className="flex items-center gap-6">
                    <div className={`p-4 rounded-2xl border transition-all duration-300 ${isOpen
                        ? `bg-${color}/10 text-${color} border-${color}/20`
                        : 'bg-white/5 text-white/20 border-white/5 group-hover:text-white group-hover:bg-white/10'
                        }`}>
                        {icon}
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h3 className={`text-xl font-serif font-black uppercase tracking-tight transition-colors ${isOpen ? 'text-white' : 'text-white/60 group-hover:text-white'
                                }`}>
                                {title}
                            </h3>
                            {badge && (
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${isOpen
                                    ? `bg-${color}/10 text-${color} border-${color}/20`
                                    : 'bg-white/5 text-white/30 border-white/10'
                                    }`}>
                                    {badge}
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mt-1">
                            {subtitle}
                        </p>
                    </div>
                </div>

                <div className={`p-3 rounded-full transition-all duration-500 ${isOpen
                    ? 'bg-white/10 text-white rotate-180'
                    : 'bg-transparent text-white/20 group-hover:bg-white/5 group-hover:text-white'
                    }`}>
                    <ChevronDownIcon className="w-5 h-5" />
                </div>
            </button>

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div className="px-6 md:px-8 pb-8 pt-2 border-t border-white/5">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const FinanceMaster: React.FC<FinanceMasterProps> = ({
    feeStructures,
    paymentProtocols = [],
    adjustmentRules = [],
    onNewStructure,
    onEditStructure,
    onNewProtocol,
    onNewRule,
    currency,
    branchId,
    onUpdate,
    masterState,
    readiness,
    onGuide // New prop for process guide
}) => {
    const [expandedSection, setExpandedSection] = useState<string | null>('governance');
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const toggleSection = (id: string) => {
        setExpandedSection(expandedSection === id ? null : id);
        // Auto-scroll to section on open
        if (expandedSection !== id) {
            setTimeout(() => {
                document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    };

    const handleSettingToggle = async (key: string, currentValue: boolean) => {
        if (!branchId || loading) return;
        setLoading(true);
        try {
            const settings = masterState?.settings || {};
            const newSettings = {
                p_branch_id: branchId,
                p_is_tax_enabled: key === 'is_tax_enabled' ? !currentValue : settings.is_tax_enabled,
                p_approval_enabled: key === 'approval_hierarchy_enabled' ? !currentValue : settings.approval_hierarchy_enabled,
                p_late_fee_enabled: key === 'auto_late_fee_enabled' ? !currentValue : settings.auto_late_fee_enabled,
                p_version_control: key === 'version_control_active' ? !currentValue : (settings.version_control_active ?? true)
            };

            await supabase.rpc('update_finance_global_settings', newSettings);
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error("Sync Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const filteredFeeStructures = feeStructures.filter(fs =>
        fs.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fs.target_grade.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const governanceToggles = [
        { key: 'is_tax_enabled', label: 'Fiscal Tax Matrix', desc: 'Enable GST/VAT Calculation', icon: <ShieldCheckIcon className="w-5 h-5" />, active: masterState?.settings?.is_tax_enabled },
        { key: 'payment_plans_enabled', label: 'Installment Logic', desc: 'Allow Split Payments', icon: <CreditCardIcon className="w-5 h-5" />, active: true }, // Visual only for now if not in DB
        { key: 'adjustments_enabled', label: 'Discount Engine', desc: 'Enable Waivers & Scholarships', icon: <UsersIcon className="w-5 h-5" />, active: true },
        { key: 'auto_late_fee_enabled', label: 'Late Fee Protocol', desc: 'Auto-Penalty Engine', icon: <ClockIcon className="w-5 h-5" />, active: masterState?.settings?.auto_late_fee_enabled },
    ];

    // Readiness Alert Helper
    const ReadinessAlert = () => {
        const status = readiness?.status || masterState?.readiness?.status || 'VALIDATED';
        if (status === 'VALIDATED') return null;

        const alerts: Record<string, { title: string; desc: string; action: string; onAction: () => void }> = {
            'YEAR_NOT_ACTIVE': {
                title: 'Academic Year Inactive',
                desc: 'The current academic cycle is not active. Finance operations are halted.',
                action: 'Activate Year',
                onAction: () => console.log('Navigate to Academic Settings')
            },
            'GRADE_MAPPING_MISSING': {
                title: 'Fee Structures Missing',
                desc: 'One or more active grades have no fee structure assigned.',
                action: 'Create Structure',
                onAction: onNewStructure
            },
            'PAYMENT_PLAN_MISSING': {
                title: 'Payment Plans Incomplete',
                desc: 'Fee components or installments are not fully configured.',
                action: 'Configure Plans',
                onAction: onNewProtocol || (() => { })
            }
        };

        const currentAlert = alerts[status] || {
            title: 'System Setup Required',
            desc: 'Finance protocols are not fully initialized.',
            action: 'Run Diagnostics',
            onAction: () => { }
        };

        return (
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_0_40px_-10px_rgba(245,158,11,0.15)] relative overflow-hidden group"
            >
                <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                    <AlertTriangleIcon className="w-32 h-32" />
                </div>

                <div className="flex items-start gap-5 relative z-10">
                    <div className="p-3.5 rounded-xl bg-amber-500/20 text-amber-500 shadow-inner ring-1 ring-amber-500/20">
                        <AlertTriangleIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight mb-1">{currentAlert.title}</h3>
                        <p className="text-xs font-medium text-amber-200/60 uppercase tracking-widest leading-relaxed max-w-lg">{currentAlert.desc}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 relative z-10 w-full md:w-auto">
                    {onGuide && (
                        <button
                            onClick={onGuide}
                            className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all border border-white/5 hover:border-white/10 flex-1 md:flex-none whitespace-nowrap"
                        >
                            View Guide
                        </button>
                    )}
                    <button
                        onClick={currentAlert.onAction}
                        className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 active:scale-95 flex items-center justify-center gap-2 flex-1 md:flex-none group/btn"
                    >
                        <span>{currentAlert.action}</span>
                        <ArrowRightIcon className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                </div>
            </motion.div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto pb-40 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <ReadinessAlert />

            {/* 1. Header Control Strip */}
            <header className="flex flex-col md:flex-row justify-between items-end gap-6 mb-10 pb-8 border-b border-white/5">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary border border-primary/20">
                            <WorkflowIcon className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Configuration Console</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-serif font-black text-white tracking-tighter uppercase mb-2">
                        Finance <span className="text-white/20">Master</span> Control
                    </h1>
                    <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest max-w-2xl leading-relaxed">
                        Configure institutional financial policies, fee structures, and compliance frameworks.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-white/40 transition-all flex items-center gap-2 group">
                        <HistoryIcon className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                        <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest">History</span>
                    </button>
                    <button className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-white/40 transition-all flex items-center gap-2 group">
                        <RotateCcwIcon className="w-4 h-4 group-hover:-rotate-90 transition-transform" />
                        <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest">Reset</span>
                    </button>
                    <button className="px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-black border border-primary transition-all flex items-center gap-2 shadow-lg shadow-primary/20 active:scale-95">
                        <SaveIcon className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Global Save</span>
                    </button>
                </div>
            </header>

            <div className="space-y-6">

                {/* 2. Governance Module */}
                <AccordionItem
                    id="governance"
                    title="Foundation Governance"
                    subtitle="Global authority parameters & fiscal settings"
                    icon={<ShieldCheckIcon className="w-6 h-6" />}
                    isOpen={expandedSection === 'governance'}
                    onToggle={() => toggleSection('governance')}
                    badge="Vital"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {governanceToggles.map((toggle) => (
                            <div
                                key={toggle.key}
                                onClick={() => handleSettingToggle(toggle.key, !!toggle.active)}
                                className={`cursor-pointer p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between min-h-[140px] group ${toggle.active
                                    ? 'bg-primary/5 border-primary/20 hover:border-primary/40'
                                    : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                                    }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className={`p-2.5 rounded-xl ${toggle.active ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/20'
                                        }`}>
                                        {toggle.icon}
                                    </div>
                                    <div className={`w-8 h-4 rounded-full relative transition-all duration-300 ${toggle.active ? 'bg-primary' : 'bg-white/10'
                                        }`}>
                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all duration-300 ${toggle.active ? 'left-[18px]' : 'left-0.5'
                                            }`} />
                                    </div>
                                </div>
                                <div>
                                    <h4 className={`text-xs font-black uppercase tracking-wider mb-1 ${toggle.active ? 'text-white' : 'text-white/40'
                                        }`}>{toggle.label}</h4>
                                    <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{toggle.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </AccordionItem>

                {/* 3. Fee Structures Module */}
                <AccordionItem
                    id="fee_structures"
                    title="Institutional Fee Structures"
                    subtitle="Grade-wise billing matrices & fee components"
                    icon={<BookIcon className="w-6 h-6" />}
                    isOpen={expandedSection === 'fee_structures'}
                    onToggle={() => toggleSection('fee_structures')}
                    badge={feeStructures.length}
                    color="primary"
                >
                    <div className="flex flex-col gap-6">
                        {/* Internal Toolbar */}
                        <div className="flex flex-col lg:flex-row justify-between items-center gap-4 py-2 sticky top-0 z-10 bg-[#12141c]/95 backdrop-blur-md border-b border-white/5 pb-4 mb-2">
                            <div className="relative w-full lg:w-96 group">
                                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-hover:text-primary transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search structure by grade or name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-xs font-bold text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-all uppercase tracking-wide"
                                />
                            </div>
                            <div className="flex gap-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
                                {['ALL', 'ACTIVE', 'DRAFT', 'ARCHIVED'].map((filter) => (
                                    <button key={filter} className="px-4 py-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 text-[9px] font-black text-white/40 hover:text-white uppercase tracking-widest transition-all whitespace-nowrap">
                                        {filter}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Scrollable Grid Container */}
                        <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {filteredFeeStructures.map(fs => (
                                    <div
                                        key={fs.id}
                                        className="group p-5 bg-black/20 border border-white/5 hover:border-primary/30 rounded-2xl transition-all hover:bg-black/40 flex flex-col relative overflow-hidden"
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`w-2 h-2 rounded-full ${(fs.state === 'ACTIVE' || fs.status === 'Active' || fs.status === 'active')
                                                        ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                                        : (fs.state === 'DRAFT' || fs.status === 'Draft' || fs.status === 'draft')
                                                            ? 'bg-amber-500'
                                                            : 'bg-white/20'
                                                        }`} />
                                                    <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">{fs.academic_year}</span>
                                                </div>
                                                <h4 className="text-lg font-serif font-black text-white uppercase tracking-tight group-hover:text-primary transition-colors truncate w-48">{fs.name}</h4>
                                                <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Target: Grade {fs.target_grade}</p>
                                            </div>
                                            <button
                                                onClick={() => onEditStructure(fs)}
                                                className="p-2 rounded-lg bg-white/5 hover:bg-primary hover:text-black text-white/20 transition-all"
                                            >
                                                <EditIcon className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="mt-auto pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Components</p>
                                                <p className="text-lg font-mono font-bold text-white/80">{fs.components?.length || 0}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Revenue</p>
                                                <p className="text-lg font-mono font-bold text-primary">
                                                    {new Intl.NumberFormat('en-IN', {
                                                        style: 'currency', currency: (fs.currency || 'INR') as CurrencyCode,
                                                        minimumFractionDigits: 0, maximumFractionDigits: 0
                                                    }).format(fs.projected_revenue || fs.components?.reduce((a: any, c: any) => a + Number(c.amount), 0) || 0)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Add New Button */}
                                <button
                                    onClick={onNewStructure}
                                    className="min-h-[180px] rounded-2xl border-2 border-dashed border-white/5 hover:border-primary/40 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-4 group/add"
                                >
                                    <div className="p-3 rounded-xl bg-white/5 group-hover/add:bg-primary group-hover/add:text-black text-white/20 transition-all">
                                        <PlusIcon className="w-6 h-6" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-black text-white uppercase tracking-widest group-hover/add:text-primary transition-colors">Create Structure</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </AccordionItem>

                {/* 4. Payment Protocols */}
                <AccordionItem
                    id="payment_protocols"
                    title="Payment Plan Protocols"
                    subtitle="Installment logic & grace periods"
                    icon={<CreditCardIcon className="w-6 h-6" />}
                    isOpen={expandedSection === 'payment_protocols'}
                    onToggle={() => toggleSection('payment_protocols')}
                    badge={paymentProtocols.length}
                >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {paymentProtocols.map(p => (
                            <div key={p.id} className="p-5 rounded-2xl bg-black/20 border border-white/5 flex items-center gap-4 hover:border-white/10 transition-all">
                                <div className="text-2xl font-black text-white/10">L{p.grace_period_days}</div>
                                <div>
                                    <h4 className="text-sm font-black text-white uppercase tracking-tight">{p.name}</h4>
                                    <p className="text-[10px] text-white/30 uppercase tracking-widest">{p.compounding_frequency}</p>
                                </div>
                            </div>
                        ))}
                        <button
                            onClick={onNewProtocol}
                            className="p-5 rounded-2xl border border-dashed border-white/10 hover:border-primary/40 hover:bg-primary/5 flex items-center justify-center gap-3 transition-all group"
                        >
                            <PlusIcon className="w-4 h-4 text-white/20 group-hover:text-primary" />
                            <span className="text-[10px] font-black text-white/30 group-hover:text-white uppercase tracking-widest">Add Protocol</span>
                        </button>
                    </div>
                </AccordionItem>

                {/* 5. Discount Rules */}
                <AccordionItem
                    id="discounts"
                    title="Discount & Waiver Rules"
                    subtitle="Scholarship logic & exemptions"
                    icon={<UsersIcon className="w-6 h-6" />}
                    isOpen={expandedSection === 'discounts'}
                    onToggle={() => toggleSection('discounts')}
                    badge={adjustmentRules.length}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {adjustmentRules.length > 0 ? adjustmentRules.map(r => (
                            <div key={r.id} className="p-4 rounded-xl bg-black/20 border border-white/5 flex justify-between items-center group hover:bg-white/5 transition-all">
                                <div>
                                    <h4 className="text-xs font-black text-white uppercase tracking-wider">{r.rule_name}</h4>
                                    <div className="flex gap-2 mt-1">
                                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[9px] font-bold uppercase tracking-widest">{r.value}{r.calculation_type === 'percentage' ? '%' : ''} OFF</span>
                                    </div>
                                </div>
                                <div className="text-[9px] font-black text-white/20 uppercase tracking-widest">Priority {r.value_priority}</div>
                            </div>
                        )) : (
                            <div className="col-span-2 text-center py-8 opacity-40">
                                <p className="text-[10px] uppercase tracking-widest">No Active Discount Rules</p>
                            </div>
                        )}
                        <button
                            onClick={onNewRule}
                            className="col-span-full py-3 rounded-xl border border-dashed border-white/10 hover:border-primary/40 hover:bg-primary/5 text-[10px] font-black text-white/30 hover:text-white uppercase tracking-widest transition-all"
                        >
                            + Add New Rule Layer
                        </button>
                    </div>
                </AccordionItem>

                {/* 6. Tax Matrix */}
                <AccordionItem
                    id="tax_matrix"
                    title="Fiscal Tax Matrix"
                    subtitle="Regional compliance & tax nodes"
                    icon={<ActivityIcon className="w-6 h-6" />}
                    isOpen={expandedSection === 'tax_matrix'}
                    onToggle={() => toggleSection('tax_matrix')}
                    badge="Auto-Sync"
                >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {(masterState?.taxes || []).map((t, i) => (
                            <div key={t.id} className="p-6 rounded-2xl bg-black/20 border border-white/5 flex flex-col gap-4 relative overflow-hidden group hover:border-primary/20 transition-all">
                                <div className="flex justify-between items-start z-10">
                                    <h4 className="text-4xl font-serif font-black text-white italic">{t.tax_rate}<span className="text-lg text-primary not-italic">%</span></h4>
                                    <span className="text-[9px] font-black bg-white/5 px-2 py-1 rounded text-white/40 uppercase">{t.tax_code}</span>
                                </div>
                                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest z-10">{t.tax_name}</p>
                            </div>
                        ))}
                        <button className="p-6 rounded-2xl border-2 border-dashed border-white/5 hover:border-primary/30 flex flex-col items-center justify-center gap-2 opacity-40 hover:opacity-100 transition-all">
                            <PlusIcon className="w-5 h-5 text-white/40" />
                            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Add Tax Node</span>
                        </button>
                    </div>
                </AccordionItem>

            </div>
        </div>
    );
};

export default FinanceMaster;
