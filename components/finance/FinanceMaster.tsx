
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon } from '../icons/PlusIcon';
import { BookIcon } from '../icons/BookIcon';
import { EditIcon } from '../icons/EditIcon';
import { RefreshIcon as VersionIcon } from '../icons/RefreshIcon';
import { ShieldCheckIcon as SecurityIcon } from '../icons/ShieldCheckIcon';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { ArrowRightIcon } from '../icons/ArrowRightIcon';
import { CreditCardIcon } from '../icons/CreditCardIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { WorkflowIcon } from '../icons/WorkflowIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
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
}

const ConfigCard: React.FC<{
    title: string;
    description: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    isExpanded: boolean;
    onToggle: () => void;
    badge?: string;
}> = ({ title, description, icon, children, isExpanded, onToggle, badge }) => (
    <div className={`bg-[#12141c]/80 backdrop-blur-xl border border-white/5 rounded-[3rem] overflow-hidden shadow-3xl transition-all duration-500 hover:border-white/10 group ${isExpanded ? 'ring-1 ring-primary/20' : ''}`}>
        <div
            onClick={onToggle}
            className="p-10 md:p-12 flex items-center justify-between cursor-pointer"
        >
            <div className="flex items-center gap-10">
                <div className="p-6 rounded-[2rem] bg-white/[0.03] text-white/20 group-hover:text-primary transition-all group-hover:bg-primary/10 border border-white/5 group-hover:border-primary/20 shadow-inner">
                    {icon}
                </div>
                <div>
                    <div className="flex items-center gap-4 mb-2">
                        <h3 className="text-3xl font-serif font-black text-white uppercase tracking-tighter group-hover:text-primary transition-colors">{title}</h3>
                        {badge && <span className="px-3 py-1 bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest rounded-lg border border-primary/20">{badge}</span>}
                    </div>
                    <p className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em] group-hover:text-white/40 transition-colors leading-none">{description}</p>
                </div>
            </div>
            <div className={`p-4 rounded-full bg-white/5 text-white/20 transition-transform duration-500 ${isExpanded ? 'rotate-180 bg-primary/20 text-primary shadow-lg shadow-primary/20' : ''}`}>
                <ChevronDownIcon className="w-6 h-6" />
            </div>
        </div>

        <AnimatePresence>
            {isExpanded && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                    <div className="px-12 pb-12 pt-4 border-t border-white/[0.03]">
                        {children}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

const MasterControlCenter: React.FC<{
    currency: string;
    settings: any;
    branchId: any;
    onUpdate?: () => void
}> = ({ currency, settings, branchId, onUpdate }) => {
    const [loading, setLoading] = useState(false);

    const handleToggle = async (key: string, currentValue: boolean) => {
        if (!branchId || loading) return;
        setLoading(true);
        try {
            const newSettings = {
                is_tax_enabled: key === 'is_tax_enabled' ? !currentValue : settings.is_tax_enabled,
                approval_enabled: key === 'approval_hierarchy_enabled' ? !currentValue : settings.approval_hierarchy_enabled,
                late_fee_enabled: key === 'auto_late_fee_enabled' ? !currentValue : settings.auto_late_fee_enabled,
                version_control: key === 'version_control_active' ? !currentValue : (settings.version_control_active ?? true)
            };

            const { error } = await supabase.rpc('update_finance_global_settings', {
                p_branch_id: branchId,
                p_is_tax_enabled: newSettings.is_tax_enabled,
                p_approval_enabled: newSettings.approval_enabled,
                p_late_fee_enabled: newSettings.late_fee_enabled,
                p_version_control: newSettings.version_control
            });

            if (error) throw error;
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error("Master Sync Failure:", err);
        } finally {
            setLoading(false);
        }
    };

    const toggles = [
        { key: 'is_tax_enabled', label: 'Fiscal Tax Matrix', desc: 'GST/VAT Compliance', icon: <SecurityIcon className="w-5 h-5" />, active: settings?.is_tax_enabled },
        { key: 'approval_hierarchy_enabled', label: 'Approval Hierarchy', desc: 'Authoritative Tiers', icon: <UsersIcon className="w-5 h-5" />, active: settings?.approval_hierarchy_enabled },
        { key: 'auto_late_fee_enabled', label: 'Late Fee Engine', desc: 'Penalty Protocols', icon: <ClockIcon className="w-5 h-5" />, active: settings?.auto_late_fee_enabled },
        { key: 'version_control_active', label: 'State Versioning', desc: 'Audit Persistence', icon: <VersionIcon className="w-5 h-5" />, active: settings?.version_control_active ?? true }
    ];

    return (
        <div className="bg-[#0c0d12] border border-white/5 rounded-[4rem] p-12 mb-16 shadow-[0_64px_128px_-32px_rgba(0,0,0,1)] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent"></div>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-12 mb-12">
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 text-primary rounded-xl border border-primary/20">
                            <WorkflowIcon className="w-6 h-6" />
                        </div>
                        <h2 className="text-5xl font-serif font-black text-white uppercase tracking-tighter">Finance <span className="text-primary italic">Master</span> Control</h2>
                    </div>
                    <p className="text-white/20 text-[11px] font-black uppercase tracking-[0.6em] max-w-xl">Global configuration protocol for institutional financial integrity</p>
                </div>

                <div className="flex flex-wrap gap-6 items-center">
                    <div className="flex flex-col gap-2">
                        <span className="text-[9px] font-black text-white/10 uppercase tracking-widest ml-1">Academic Year</span>
                        <select className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-[11px] font-black text-white uppercase tracking-widest outline-none focus:border-primary/40 transition-all">
                            <option>2025-2026 (Operational)</option>
                            <option>2024-2025 (Historical)</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <span className="text-[9px] font-black text-white/10 uppercase tracking-widest ml-1">Base Currency</span>
                        <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-3">
                            <CreditCardIcon className="w-4 h-4 text-primary" /> {currency}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {toggles.map((toggle) => (
                    <div
                        key={toggle.key}
                        onClick={() => handleToggle(toggle.key, !!toggle.active)}
                        className={`p-8 rounded-[2.5rem] border transition-all cursor-pointer flex flex-col gap-6 group/toggle ${toggle.active ? 'bg-primary/5 border-primary/20' : 'bg-white/[0.02] border-white/5'} ${loading ? 'opacity-50 cursor-wait' : ''}`}
                    >
                        <div className="flex justify-between items-center">
                            <div className={`p-4 rounded-2xl border transition-all ${toggle.active ? 'bg-primary text-black border-primary' : 'bg-white/5 text-white/10 border-white/10'}`}>
                                {toggle.icon}
                            </div>
                            <div className={`w-12 h-6 rounded-full relative transition-all ${toggle.active ? 'bg-primary' : 'bg-white/10'}`}>
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${toggle.active ? 'right-1' : 'left-1'}`}></div>
                            </div>
                        </div>
                        <div>
                            <p className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-1">{toggle.label}</p>
                            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">{toggle.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-12 pt-12 border-t border-white/5 flex flex-col lg:flex-row justify-between items-center gap-12">
                <div className="flex gap-12">
                    <div className="space-y-1">
                        <p className="text-[9px] font-black text-white/10 uppercase tracking-widest">Global Status</p>
                        <p className="text-xs font-black text-emerald-500 uppercase tracking-[0.3em] flex items-center gap-4">
                            Operational <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        </p>
                    </div>
                </div>
                <button className="flex items-center gap-4 px-10 py-5 bg-white/5 hover:bg-white/[0.08] text-white/40 hover:text-white rounded-2xl border border-white/10 transition-all text-[11px] font-black uppercase tracking-[0.4em] group/log">
                    <ActivityIcon className="w-5 h-5 group-hover/log:rotate-12 transition-transform" /> View Activity Registry
                </button>
            </div>
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
    readiness,
    masterState
}) => {
    const [expandedCard, setExpandedCard] = useState<string | null>('fee_structures');

    const toggleCard = (id: string) => {
        setExpandedCard(expandedCard === id ? null : id);
    };

    return (
        <div className="space-y-12 pb-32 max-w-[1600px] mx-auto animate-in fade-in duration-1000">
            {/* 1. MASTER CONTROL CENTER */}
            <MasterControlCenter
                currency={currency}
                settings={masterState?.settings || {}}
                branchId={branchId}
                onUpdate={onUpdate}
            />

            <div className="grid grid-cols-1 gap-12">
                {/* 2. Foundation Governance */}
                <ConfigCard
                    title="Foundation Governance"
                    description="Institutional authority hierarchy & fiscal settlement policies"
                    icon={<SecurityIcon className="w-8 h-8" />}
                    isExpanded={expandedCard === 'foundation'}
                    onToggle={() => toggleCard('foundation')}
                    badge="Structural Backbone"
                >
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-12 pt-6">
                        <div className="xl:col-span-2 space-y-10">
                            <div className="flex justify-between items-center bg-[#1a1c26] p-8 rounded-[2.5rem] border border-white/5">
                                <div>
                                    <h5 className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em] mb-4">Refund & Settlement Protocols</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {[
                                            { label: 'Auto-Refund Validated', active: true },
                                            { label: 'Escalation Node (Principal)', active: true },
                                            { label: 'Fiscal Freeze Date Locked', active: false },
                                            { label: 'Audit Trail Immutability', active: true }
                                        ].map((pol, i) => (
                                            <div key={i} className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                                                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{pol.label}</span>
                                                <div className={`w-3 h-3 rounded-full ${pol.active ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500/40'}`}></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex justify-between items-center px-4">
                                    <h5 className="text-[11px] font-black text-white/40 uppercase tracking-[0.4em]">Governance Hierarchy</h5>
                                    <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:brightness-125 transition-all flex items-center gap-2 underline underline-offset-4">Configure Matrix <ArrowRightIcon className="w-3 h-3" /></button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { level: 'Tier 1 - Operational', role: 'Accountant', auth: 'Daily Posting', color: 'text-emerald-500' },
                                        { level: 'Tier 2 - Structural', role: 'School Admin', auth: 'Waivers & Discounts', color: 'text-amber-500' },
                                        { level: 'Tier 3 - Strategic', role: 'Super Admin', auth: 'Policy & Tax Shift', color: 'text-red-500' },
                                        { level: 'Tier 4 - Sovereign', role: 'Board Node', auth: 'Institutional Lock', color: 'text-primary' }
                                    ].map((tier, idx) => (
                                        <div key={idx} className="bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] flex flex-col gap-6 group/tier hover:bg-white/[0.04] hover:shadow-2xl transition-all">
                                            <div className="flex items-center justify-between">
                                                <span className={`text-[9px] font-black ${tier.color} uppercase tracking-[0.3em]`}>{tier.level}</span>
                                                <SecurityIcon className={`w-5 h-5 ${tier.color} opacity-20`} />
                                            </div>
                                            <div>
                                                <p className="text-xl font-serif font-black text-white tracking-tighter uppercase leading-none mb-2">{tier.role}</p>
                                                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest italic">{tier.auth}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#1a1c26] border border-white/5 rounded-[3.5rem] p-12 flex flex-col items-center justify-center text-center space-y-10 group/inf relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover/inf:opacity-10 transition-opacity">
                                <WorkflowIcon className="w-48 h-48 -rotate-12" />
                            </div>
                            <div className="w-24 h-24 bg-primary/20 rounded-[2.5rem] flex items-center justify-center text-primary shadow-2xl relative z-10">
                                <SecurityIcon className="w-12 h-12" />
                            </div>
                            <div className="space-y-4 relative z-10">
                                <h3 className="text-3xl font-serif font-black text-white tracking-tighter uppercase">Governance Protocol</h3>
                                <p className="text-white/40 text-[13px] leading-relaxed font-medium italic">Every financial mutation is validated against the Authority Matrix before being committed to the immutable global ledger.</p>
                            </div>
                            <button className="w-full py-5 bg-white text-black font-black text-[11px] uppercase tracking-[0.4em] rounded-2xl shadow-3xl hover:bg-white/90 active:scale-95 transition-all relative z-10">
                                Deploy Policy Node
                            </button>
                        </div>
                    </div>
                </ConfigCard>

                {/* 3. Fee Structures */}
                <ConfigCard
                    title="Institutional Fee Structures"
                    description="Grade-wise billing cycles & financial registry protocols"
                    icon={<BookIcon className="w-8 h-8" />}
                    isExpanded={expandedCard === 'fee_structures'}
                    onToggle={() => toggleCard('fee_structures')}
                    badge={`${feeStructures.length} Protocols`}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-10 pt-6">
                        {feeStructures.map(fs => (
                            <motion.div
                                key={fs.id}
                                whileHover={{ y: -10 }}
                                className="bg-[#1a1c26] border border-white/5 rounded-[3rem] p-10 hover:border-primary/40 transition-all group/item shadow-3xl flex flex-col"
                            >
                                <div className="flex justify-between items-start mb-12">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <span className="px-3 py-1 bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest rounded-lg border border-primary/20">{fs.academic_year}</span>
                                            <span className="text-[10px] text-white/20 font-black uppercase tracking-widest">{fs.version_label || 'v1.0'}</span>
                                        </div>
                                        <h4 className="text-3xl font-serif font-black text-white uppercase tracking-tighter group-hover/item:text-primary transition-colors leading-[0.95]">{fs.name}</h4>
                                        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.5em]">LIFECYCLE: {fs.state || 'DRAFT'}</p>
                                    </div>
                                    <button
                                        onClick={() => onEditStructure(fs)}
                                        className="p-4 bg-white/5 text-white/20 rounded-2xl hover:text-primary hover:bg-primary/10 transition-all border border-white/10 group-hover/item:border-primary/40"
                                    >
                                        <EditIcon className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-6 mb-10 pb-10 border-b border-white/5">
                                    <div className="space-y-3">
                                        <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em]">Authority Node</p>
                                        <span className={`inline-flex px-4 py-2 rounded-xl text-[9px] font-black tracking-[0.2em] uppercase border ${fs.state === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' :
                                            fs.state === 'VALIDATED' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                fs.state === 'LOCKED' ? 'bg-primary/10 text-primary border-primary/20' :
                                                    'bg-white/5 text-white/20 border-white/10'
                                            }`}>
                                            {fs.state || fs.status}
                                        </span>
                                    </div>
                                    <div className="text-right space-y-3">
                                        <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em]">Components</p>
                                        <p className="text-4xl font-black text-white font-serif italic tracking-tighter leading-none">{fs.components?.length || 0}</p>
                                    </div>
                                </div>

                                <div className="mt-auto flex justify-between items-center">
                                    <div>
                                        <p className="text-[8px] font-black text-white/10 uppercase tracking-[0.5em] mb-3">Sync Readiness</p>
                                        <div className="h-2 w-32 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary w-2/3"></div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em] mb-2">Projected Revenue</p>
                                        <span className="text-2xl font-black text-white font-mono tracking-tighter">
                                            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: (fs.currency || 'INR') as CurrencyCode, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(fs.projected_revenue || fs.components?.reduce((a: any, c: any) => a + Number(c.amount), 0) || 0)}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-8 pt-8 border-t border-white/[0.03] flex justify-between gap-4">
                                    <button className="flex-1 py-3 bg-white/[0.02] hover:bg-white/5 rounded-xl text-[8px] font-black text-white/20 hover:text-primary uppercase tracking-widest border border-white/5 transition-all">
                                        Impact Map
                                    </button>
                                    <button className="flex-1 py-3 bg-white/[0.02] hover:bg-white/5 rounded-xl text-[8px] font-black text-white/20 hover:text-amber-500 uppercase tracking-widest border border-white/5 transition-all">
                                        Simulation
                                    </button>
                                    <button className="flex-1 py-3 bg-white/5 hover:bg-primary hover:text-black rounded-xl text-[8px] font-black text-white/40 uppercase tracking-widest border border-white/5 transition-all">
                                        {fs.state === 'DRAFT' ? 'Validate' : 'Re-Version'}
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                        <button
                            onClick={onNewStructure}
                            className="bg-white/[0.01] border-2 border-dashed border-white/5 rounded-[3rem] p-12 flex flex-col items-center justify-center gap-8 hover:bg-primary/[0.03] hover:border-primary/20 transition-all group/new min-h-[400px]"
                        >
                            <div className="w-20 h-20 rounded-[2.5rem] bg-white/5 flex items-center justify-center text-white/10 group-hover/new:bg-primary/20 group-hover/new:text-primary transition-all ring-1 ring-white/10 group-hover/new:ring-primary/40 shadow-inner">
                                <PlusIcon className="w-10 h-10" />
                            </div>
                            <div className="text-center space-y-4">
                                <p className="text-xl font-serif font-black text-white/30 uppercase tracking-tighter group-hover/new:text-white transition-colors">Initialize New Protocol</p>
                                <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.5em] italic">Architect new institutional billing node</p>
                            </div>
                        </button>
                    </div>
                </ConfigCard>

                {/* 4. Payment Protocols */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    <ConfigCard
                        title="Payment Plan Protocols"
                        description="Installment matrices, late fee triggers & grace periods"
                        icon={<CreditCardIcon className="w-8 h-8" />}
                        isExpanded={expandedCard === 'payment_plans'}
                        onToggle={() => toggleCard('payment_plans')}
                    >
                        <div className="space-y-6 pt-6">
                            {paymentProtocols.length > 0 ? (
                                paymentProtocols.map(p => (
                                    <div key={p.id} className="bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] flex items-center justify-between group/plan hover:border-primary/20 transition-all">
                                        <div className="flex items-center gap-6">
                                            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-white/20 group-hover/plan:text-primary transition-all font-mono font-bold">L{p.grace_period_days}</div>
                                            <div>
                                                <h4 className="text-lg font-black text-white uppercase tracking-tight leading-none mb-2">{p.name}</h4>
                                                <div className="flex gap-4 items-center">
                                                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest italic">{p.compounding_frequency} Protocol</span>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-white/10"></span>
                                                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Penalty: {p.penalty_value}{p.penalty_type === 'percentage' ? '%' : ''}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`p-3 rounded-xl border ${p.is_active ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                            <ActivityIcon className="w-5 h-5" />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-20 flex flex-col items-center justify-center gap-8 opacity-40 border border-dashed border-white/5 rounded-[3rem]">
                                    <p className="text-[10px] font-black text-white uppercase tracking-[0.4em]">No Payment Protocols Assigned</p>
                                    <button onClick={onNewProtocol} className="px-10 py-4 bg-primary text-black font-black text-[10px] uppercase tracking-widest rounded-xl shadow-2xl active:scale-95 transition-all">Create New Matrix</button>
                                </div>
                            )}
                        </div>
                    </ConfigCard>

                    <ConfigCard
                        title="Discount & Waiver Rules"
                        description="Conditional hardship rules & scholarship nodes"
                        icon={<UsersIcon className="w-8 h-8" />}
                        isExpanded={expandedCard === 'discounts'}
                        onToggle={() => toggleCard('discounts')}
                    >
                        <div className="space-y-6 pt-6">
                            {adjustmentRules.length > 0 ? (
                                adjustmentRules.map(r => (
                                    <div key={r.id} className="bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] flex items-center justify-between group/rule hover:border-emerald-500/30 transition-all">
                                        <div className="flex items-center gap-6">
                                            <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                                                <SecurityIcon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-black text-white uppercase tracking-tight leading-none mb-2">{r.rule_name}</h4>
                                                <div className="flex gap-4 items-center">
                                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Value: {r.value}{r.calculation_type === 'percentage' ? '%' : ''}</span>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-white/10"></span>
                                                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest italic">Priority Node {r.value_priority}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-20 flex flex-col items-center justify-center gap-8 opacity-40 border border-dashed border-white/5 rounded-[3rem]">
                                    <p className="text-[10px] font-black text-white uppercase tracking-[0.4em]">No Adjustment Rules Available</p>
                                    <button onClick={onNewRule} className="px-10 py-4 bg-primary text-black font-black text-[10px] uppercase tracking-widest rounded-xl shadow-2xl active:scale-95 transition-all">Add Rule Layer</button>
                                </div>
                            )}
                        </div>
                    </ConfigCard>
                </div>

                {/* 5. Fiscal Tax Matrix */}
                <ConfigCard
                    title="Fiscal Tax Matrix"
                    description="Institutional tax nodes & regional compliance matrices"
                    icon={<WorkflowIcon className="w-8 h-8" />}
                    isExpanded={expandedCard === 'tax'}
                    onToggle={() => toggleCard('tax')}
                    badge="Compliance Node"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 pt-6">
                        {(masterState?.taxes || []).length > 0 ? masterState.taxes.map((t, i) => (
                            <div key={t.id} className="bg-black/60 border border-white/5 p-10 rounded-[3rem] space-y-8 hover:border-primary/40 transition-all group/tax shadow-2xl overflow-hidden relative">
                                <div className="absolute top-0 right-0 p-8 opacity-[0.05] group-hover/tax:opacity-20 transition-opacity">
                                    <WorkflowIcon className="w-32 h-32 text-primary" />
                                </div>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-6xl font-serif font-black text-white tracking-widest italic">{t.tax_rate}<span className="text-2xl text-primary font-black not-italic ml-2">%</span></p>
                                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em] mt-3">{t.tax_name}</p>
                                    </div>
                                    <span className="px-4 py-2 bg-primary/10 text-primary text-[10px] font-black rounded-xl border border-primary/20">{t.tax_code}</span>
                                </div>
                                <p className="text-[10px] font-medium text-white/20 uppercase tracking-widest leading-relaxed border-t border-white/5 pt-6">Institutional Compliance Node</p>
                            </div>
                        )) : (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-20 border-2 border-dashed border-white/5 rounded-[3rem]">
                                <p className="text-[10px] font-black uppercase tracking-[0.5em]">No Fiscal Nodes Defined</p>
                            </div>
                        )}
                        <button className="bg-white/[0.01] border-2 border-dashed border-white/5 rounded-[3rem] p-10 flex flex-col items-center justify-center gap-6 hover:bg-primary/[0.03] hover:border-primary/20 transition-all opacity-40 hover:opacity-100 min-h-[300px]">
                            <PlusIcon className="w-8 h-8 text-white/10 group-hover:text-primary transition-all" />
                            <p className="text-[11px] font-black uppercase text-white/40 tracking-widest">Append Tax Matrix Node</p>
                        </button>
                    </div>
                </ConfigCard>
            </div>
        </div>
    );
};

export default FinanceMaster;
