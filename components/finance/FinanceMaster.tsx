
import React, { useState } from 'react';
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
import { FeeStructure, CurrencyCode } from '../../types';

interface FinanceMasterProps {
    feeStructures: FeeStructure[];
    paymentProtocols?: any[];
    adjustmentRules?: any[];
    onNewStructure: () => void;
    onEditStructure: (fs: FeeStructure) => void;
    onNewProtocol?: () => void;
    onNewRule?: () => void;
    currency: CurrencyCode;
    readiness?: {
        hasStructures: boolean;
        hasAssignments: boolean;
        hasLedger: boolean;
        isSetupComplete: boolean;
        missingSteps: string[];
    };
}

const ConfigCard: React.FC<{
    title: string;
    description: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    isExpanded: boolean;
    onToggle: () => void;
}> = ({ title, description, icon, children, isExpanded, onToggle }) => (
    <div className="bg-[#12141c] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl transition-all duration-500 hover:border-white/10 group">
        <div
            onClick={onToggle}
            className="p-8 md:p-10 flex items-center justify-between cursor-pointer"
        >
            <div className="flex items-center gap-8">
                <div className="p-5 rounded-[1.8rem] bg-white/[0.03] text-white/20 group-hover:text-primary transition-all group-hover:bg-primary/10 border border-white/5 group-hover:border-primary/20">
                    {icon}
                </div>
                <div>
                    <h3 className="text-2xl font-serif font-black text-white uppercase tracking-tight group-hover:text-primary transition-colors">{title}</h3>
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mt-2 group-hover:text-white/40 transition-colors">{description}</p>
                </div>
            </div>
            <div className={`p-4 rounded-full bg-white/5 text-white/20 transition-transform duration-500 ${isExpanded ? 'rotate-180 bg-primary/20 text-primary' : ''}`}>
                <ChevronDownIcon className="w-6 h-6" />
            </div>
        </div>

        <AnimatePresence>
            {isExpanded && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.5, ease: 'circOut' }}
                >
                    <div className="px-10 pb-10 pt-4 border-t border-white/[0.03]">
                        {children}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

const ReadinessNavigator: React.FC<{ readiness: any; onNew: () => void }> = ({ readiness, onNew }) => {
    const checklist = [
        { key: 'coa', label: 'Chart of Accounts', desc: 'Accounting Backbone Initialization' },
        { key: 'structures', label: 'Fee Protocols', desc: 'Grade-wise Billing Matrices' },
        { key: 'compliance', label: 'Fiscal Tax Node', desc: 'Tax & Compliance Configuration' },
        { key: 'audit', label: 'Audit Genesis', desc: 'Forensic Logic Deployment' }
    ];

    const percentage = readiness?.isSetupComplete ? 100 : (readiness?.percentage || (readiness?.hasStructures ? 65 : 35));

    return (
        <div className="bg-[#12141c] p-10 rounded-[3.5rem] border border-amber-500/10 shadow-3xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.03] to-transparent pointer-events-none"></div>
            <div className="flex flex-col xl:flex-row justify-between items-center gap-12 relative z-10">
                <div className="flex-1 space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 ring-1 ring-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                            <SecurityIcon className="w-6 h-6 animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Institutional Setup <span className="text-amber-500">Readiness</span></h2>
                            <p className="text-white/30 text-xs font-black uppercase tracking-[0.4em] mt-1">Global Financial Validation Engine v3.0</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {checklist.map((item, idx) => {
                            const isDone = readiness?.checklist?.[item.key] || (item.key === 'coa') || (item.key === 'structures' && readiness?.hasStructures);
                            return (
                                <div key={idx} className={`p-4 rounded-2xl border transition-all flex items-center gap-4 ${isDone ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/[0.01] border-white/5 opacity-40'}`}>
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isDone ? 'bg-emerald-500 text-white' : 'bg-white/5 text-white/10'}`}>
                                        <VersionIcon className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-white uppercase tracking-widest">{item.label}</p>
                                        <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest leading-none mt-1">{item.desc}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="w-full xl:w-72 flex flex-col items-center gap-6">
                    <div className="relative w-48 h-48 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90">
                            <circle cx="96" cy="96" r="80" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/[0.03]" />
                            <circle cx="96" cy="96" r="80" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={502} strokeDashoffset={502 - (502 * percentage) / 100} className="text-amber-500 transition-all duration-1000 ease-out" strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-4xl font-serif font-black text-white tracking-widest">{percentage}%</span>
                            <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Master Score</span>
                        </div>
                    </div>
                    <button onClick={onNew} className="w-full py-5 bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] uppercase tracking-[0.4em] rounded-2xl shadow-2xl transition-all items-center gap-3 flex justify-center transform active:scale-95 shadow-amber-900/40">
                        Continue Setup <ArrowRightIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

const FinanceMaster: React.FC<FinanceMasterProps> = ({
    feeStructures,
    paymentProtocols = [],
    adjustmentRules = [],
    onNewStructure,
    onNewProtocol,
    onNewRule,
    currency,
    readiness
}) => {
    const [expandedCard, setExpandedCard] = useState<string | null>('fee_structures');

    const toggleCard = (id: string) => {
        setExpandedCard(expandedCard === id ? null : id);
    };

    return (
        <div className="space-y-10 pb-20">
            {/* Top Readiness Navigator */}
            {(!readiness?.isSetupComplete || readiness?.percentage < 100) && <ReadinessNavigator readiness={readiness} onNew={onNewStructure} />}

            {/* Foundation Navigation Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Fiscal Matrix', status: 'ACTIVE PERIOD', icon: <VersionIcon className="w-5 h-5" />, color: 'text-emerald-500', bg: 'bg-emerald-500/10', desc: 'Q1-2026 Sync' },
                    { label: 'Registry Map', status: feeStructures.length > 0 ? `${feeStructures.length} PROTOCOLS` : 'EMPTY', icon: <BookIcon className="w-5 h-5" />, color: feeStructures.length > 0 ? 'text-emerald-500' : 'text-amber-500', bg: feeStructures.length > 0 ? 'bg-emerald-500/10' : 'bg-amber-500/10', desc: 'Institutional Billing' },
                    { label: 'Audit Security', status: 'ENABLED', icon: <SecurityIcon className="w-5 h-5" />, color: 'text-emerald-500', bg: 'bg-emerald-500/10', desc: 'Forensic Logic' },
                    { label: 'Global Ledger', status: 'VERIFIED', icon: <CreditCardIcon className="w-5 h-5" />, color: 'text-emerald-500', bg: 'bg-emerald-500/10', desc: 'Posting Balance Index' }
                ].map((step, i) => (
                    <div key={i} className="bg-[#12141c] border border-white/5 rounded-[2.5rem] p-8 flex flex-col gap-6 group hover:border-white/10 transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:scale-125 transition-transform duration-700">{step.icon}</div>
                        <div className={`w-12 h-12 rounded-2xl ${step.bg} ${step.color} flex items-center justify-center shadow-inner ring-1 ring-white/5`}>
                            {step.icon}
                        </div>
                        <div>
                            <h4 className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mb-1">{step.label}</h4>
                            <p className={`text-sm font-black uppercase tracking-widest ${step.color}`}>{step.status}</p>
                            <p className="text-[10px] font-medium text-white/10 mt-1 uppercase tracking-tight">{step.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-12">
                {/* 1. Foundation Governance: Chart of Accounts */}
                <ConfigCard
                    title="Foundation Governance"
                    description="Core accounting rules, CoA hierarchy & fiscal policies"
                    icon={<SecurityIcon className="w-7 h-7" />}
                    isExpanded={expandedCard === 'foundation'}
                    onToggle={() => toggleCard('foundation')}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 pt-6">
                        <div className="space-y-6">
                            <h5 className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em] ml-1">Master Chart of Accounts (CoA)</h5>
                            <div className="space-y-3">
                                {[
                                    { code: '1000', name: 'ASSETS', sub: 'Current Assets, Banks, Receivables', type: 'asset' },
                                    { code: '2000', name: 'LIABILITIES', sub: 'Deferred Revenue, Deposits', type: 'liability' },
                                    { code: '4000', name: 'REVENUE', sub: 'Tuition Fees, Transport, Lab', type: 'revenue' },
                                    { code: '5000', name: 'EXPENSES', sub: 'Payroll, Maintenance, Utilities', type: 'expense' }
                                ].map(acc => (
                                    <div key={acc.code} className="bg-black/30 border border-white/5 p-6 rounded-3xl flex justify-between items-center group/acc hover:border-primary/30 transition-all">
                                        <div className="flex items-center gap-5">
                                            <span className="text-[10px] font-black text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">{acc.code}</span>
                                            <div>
                                                <p className="text-[12px] font-black text-white uppercase tracking-widest">{acc.name}</p>
                                                <p className="text-[10px] text-white/20 uppercase tracking-tight mt-0.5">{acc.sub}</p>
                                            </div>
                                        </div>
                                        <ArrowRightIcon className="w-4 h-4 text-white/5 group-hover/acc:text-primary transition-colors" />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-primary/5 rounded-[2.5rem] border border-primary/10 p-10 flex flex-col justify-center text-center space-y-6 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
                            <VersionIcon className="w-16 h-16 text-primary/20 mx-auto animate-spin-slow" />
                            <h6 className="text-xl font-serif font-black text-white uppercase tracking-tighter">Automatic Posting Engine</h6>
                            <p className="text-white/40 text-sm leading-relaxed max-w-xs mx-auto">Transactional data effectively maps to the CoA in real-time. Ensure institutional rules are locked before period close.</p>
                            <button className="px-10 py-4 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl border border-white/10 transition-all mx-auto">
                                Configure Posting Rules
                            </button>
                        </div>
                    </div>
                </ConfigCard>

                {/* 2. Fee Structures Accordion */}
                <ConfigCard
                    title="Institutional Fee Structures"
                    description="Curated grade-wise billing cycles & currency nodes"
                    icon={<BookIcon className="w-7 h-7" />}
                    isExpanded={expandedCard === 'fee_structures'}
                    onToggle={() => toggleCard('fee_structures')}
                >
                    <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-8 pt-6">
                        {feeStructures.map(fs => (
                            <div key={fs.id} className="bg-black/40 border border-white/[0.04] rounded-3xl p-8 hover:border-white/10 transition-all group/item relative overflow-hidden shadow-2xl">
                                <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover/item:opacity-[0.06] transition-opacity">
                                    <VersionIcon className="w-20 h-20 text-primary -rotate-12" />
                                </div>
                                <div className="flex justify-between items-start mb-10 relative z-10">
                                    <div>
                                        <h4 className="text-2xl font-serif font-black text-white group-hover/item:text-primary transition-colors tracking-tight uppercase leading-none">{fs.name}</h4>
                                        <div className="flex items-center gap-3 mt-4">
                                            <span className="px-3 py-1.5 rounded-xl bg-white/[0.03] text-[9px] font-black text-white/30 uppercase tracking-widest border border-white/5">{fs.academic_year}</span>
                                            <span className="px-3 py-1.5 rounded-xl bg-white/[0.03] text-[9px] font-black text-white/30 uppercase tracking-widest border border-white/5">Grade {fs.target_grade}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onEditStructure(fs)}
                                        className="p-3 bg-white/[0.03] text-white/20 rounded-xl hover:text-primary transition-colors hover:bg-primary/10 border border-white/5"
                                    >
                                        <EditIcon className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="flex justify-between items-end relative z-10">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black text-white/10 uppercase tracking-widest">Protocol Status</p>
                                        <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase border ${fs.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-white/5 text-white/30 border-white/10 line-through'
                                            }`}>
                                            {fs.status}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-white/10 uppercase tracking-widest mb-1">Total Component Nodes</p>
                                        <div className="flex items-baseline justify-end gap-2">
                                            <span className="text-3xl font-black text-white font-mono tracking-tighter">{fs.components?.length || 0}</span>
                                            <span className="text-[9px] font-black text-white/20 uppercase">Units</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 pt-6 border-t border-white/[0.03] flex justify-between items-center">
                                    <div className="flex -space-x-3">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="w-8 h-8 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center text-[10px] font-black text-white/20">
                                                <UsersIcon className="w-4 h-4 opacity-40" />
                                            </div>
                                        ))}
                                        <div className="w-10 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-[8px] font-black text-primary uppercase tracking-tighter">
                                            {readiness?.hasAssignments ? 'Mapped' : 'Empty'}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-white/10 uppercase tracking-widest mb-1">Cumulative Value</p>
                                        <span className="text-xl font-black text-white font-mono tracking-tighter italic">
                                            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: fs.currency as CurrencyCode, minimumFractionDigits: 0 }).format(fs.components?.reduce((a, c) => a + Number(c.amount), 0) || 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </ConfigCard>

                {/* 3. Payment Plan Protocols */}
                <ConfigCard
                    title="Payment Plan Protocols"
                    description="Late fee matrices, grace periods & installment orchestration"
                    icon={<CreditCardIcon className="w-7 h-7" />}
                    isExpanded={expandedCard === 'payment_plans'}
                    onToggle={() => toggleCard('payment_plans')}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 pt-6">
                        {paymentProtocols.length > 0 ? (
                            paymentProtocols.map(p => (
                                <div key={p.id} className="bg-black/40 border border-white/5 p-8 rounded-[2.5rem] space-y-6 hover:border-amber-500/20 transition-all group/pp">
                                    <div className="flex justify-between items-center text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">
                                        <span>Protocol Node: {p.id.slice(0, 8)}</span>
                                        <SecurityIcon className={`w-4 h-4 ${p.is_active ? 'text-emerald-500' : 'text-red-500'}`} />
                                    </div>
                                    <h4 className="text-xl font-serif font-black text-white uppercase tracking-tighter">{p.name}</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                            <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Grace Period</p>
                                            <p className="text-[12px] font-black text-white">{p.grace_period_days} Days</p>
                                        </div>
                                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                            <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Penalty</p>
                                            <p className="text-[12px] font-black text-amber-500 font-mono italic">{p.penalty_type === 'percentage' ? `${p.penalty_value}%` : `${currency} ${p.penalty_value}`}</p>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-white/5 flex justify-between items-center text-[10px] uppercase font-black tracking-widest">
                                        <span className="text-white/20">Frequency</span>
                                        <span className="text-white/60">{p.compounding_frequency}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full py-16 flex flex-col items-center justify-center gap-6 opacity-30 border-2 border-dashed border-white/5 rounded-[3rem]">
                                <CreditCardIcon className="w-12 h-12 text-white/10 animate-pulse" />
                                <p className="text-[11px] font-black text-white/40 uppercase tracking-[0.5em]">No Operational Protocols Defined</p>
                                <button
                                    onClick={onNewProtocol}
                                    className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white font-black text-[9px] uppercase tracking-widest rounded-xl border border-white/10 transition-all font-serif italic"
                                >
                                    Initialize Protocol Node
                                </button>
                            </div>
                        )}
                    </div>
                </ConfigCard>

                {/* 4. Discount & Adjustment Rules */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <ConfigCard
                        title="Discount & Waiver Rules"
                        description="Rule-based hardship incentives & sibling relief nodes"
                        icon={<UsersIcon className="w-7 h-7" />}
                        isExpanded={expandedCard === 'discounts'}
                        onToggle={() => toggleCard('discounts')}
                    >
                        <div className="space-y-4 pt-4">
                            {adjustmentRules.length > 0 ? (
                                adjustmentRules.map(r => (
                                    <div key={r.id} className="bg-black/40 border border-white/5 p-6 rounded-3xl flex justify-between items-center group/rule hover:border-emerald-500/30 transition-all shadow-xl">
                                        <div className="flex items-center gap-6">
                                            <div className="w-12 h-12 bg-emerald-500/5 rounded-2xl flex items-center justify-center text-emerald-500/40 border border-emerald-500/10">
                                                <SecurityIcon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-[13px] font-black text-white uppercase tracking-widest">{r.rule_name}</p>
                                                <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mt-1">Priority: {r.value_priority} • {r.is_stackable ? 'Stackable' : 'Exclusive'}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-[11px] font-black text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20 font-serif italic">
                                                {r.calculation_type === 'percentage' ? `${r.value}% OFF` : `-${currency} ${r.value}`}
                                            </span>
                                            {r.requires_approval && <span className="text-[7px] font-black text-amber-500 uppercase tracking-widest">Requires Verification</span>}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-12 flex flex-col items-center justify-center gap-4 opacity-20">
                                    <SecurityIcon className="w-10 h-10 animate-bounce" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Rule Deployment</p>
                                    <button
                                        onClick={onNewRule}
                                        className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white font-black text-[9px] uppercase tracking-widest rounded-xl border border-white/10 transition-all font-serif italic mt-2"
                                    >
                                        Deploy Rule Node
                                    </button>
                                </div>
                            )}
                        </div>
                    </ConfigCard>

                    <ConfigCard
                        title="Fiscal Tax Matrix"
                        description="Direct & regional tax node orchestration"
                        icon={<SecurityIcon className="w-7 h-7" />}
                        isExpanded={expandedCard === 'tax'}
                        onToggle={() => toggleCard('tax')}
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-6">
                            {[
                                { name: 'Direct Institutional Tax', rate: '18%', code: 'GST-S' },
                                { name: 'Education Surcharge', rate: '2%', code: 'EDU-C' }
                            ].map((t, i) => (
                                <div key={i} className="bg-black/40 border border-white/5 p-6 rounded-[2rem] space-y-4 hover:border-primary/20 transition-all">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-3xl font-serif font-black text-white tracking-widest italic">{t.rate}</span>
                                        <span className="text-[8px] font-black text-primary bg-primary/10 px-2 py-1 rounded-md border border-primary/20">{t.code}</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-white/50 uppercase tracking-widest leading-none">{t.name}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ConfigCard>
                </div>
            </div>
        </div>
    );
};

export default FinanceMaster;
