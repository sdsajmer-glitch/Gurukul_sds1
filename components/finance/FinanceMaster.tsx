
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
        { key: 'coa', label: 'Chart of Accounts', desc: 'Accounting Backbone', status: 'SYNCHRONIZED', icon: <SecurityIcon className="w-4 h-4" /> },
        { key: 'structures', label: 'Fee Protocols', desc: 'Billing Matrices', status: readiness?.hasStructures ? 'ACTIVE' : 'PENDING', icon: <BookIcon className="w-4 h-4" /> },
        { key: 'mapping', label: 'Student Mapping', desc: 'Node Assignment', status: readiness?.hasAssignments ? 'MAPPED' : 'EMPTY', icon: <UsersIcon className="w-4 h-4" /> },
        { key: 'ledger', label: 'Global Ledger', desc: 'Mass Invoicing', status: readiness?.hasLedger ? 'LIVE' : 'WAITING', icon: <CreditCardIcon className="w-4 h-4" /> }
    ];

    const percentage = readiness?.isSetupComplete ? 100 : (readiness?.percentage || (readiness?.hasStructures ? (readiness?.hasAssignments ? 85 : 65) : 35));

    return (
        <div className="bg-[#12141c]/40 backdrop-blur-3xl p-12 rounded-[4rem] border border-white/5 shadow-[0_64px_128px_-32px_rgba(0,0,0,0.6)] relative overflow-hidden group mb-12">
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-primary/10 transition-all duration-1000"></div>

            <div className="flex flex-col xl:flex-row justify-between items-center gap-16 relative z-10">
                <div className="flex-1 space-y-10 w-full">
                    <div className="flex items-center gap-8">
                        <div className="w-20 h-20 bg-gradient-to-br from-amber-500/20 to-amber-500/5 rounded-3xl flex items-center justify-center text-amber-500 ring-1 ring-amber-500/30 shadow-[0_20px_40px_-10px_rgba(245,158,11,0.2)] transform group-hover:rotate-6 transition-transform">
                            <SecurityIcon className="w-10 h-10 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="px-3 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-[0.3em] rounded-lg border border-amber-500/20">Operational Readiness</span>
                                <span className="text-white/20 text-[10px] uppercase font-black tracking-widest">Protocol v4.0.2</span>
                            </div>
                            <h2 className="text-5xl font-serif font-black text-white uppercase tracking-tighter leading-none">Institutional Setup <span className="text-amber-500/80 italic font-medium">Readiness</span></h2>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {checklist.map((item, idx) => {
                            const isDone = (item.key === 'coa') ||
                                (item.key === 'structures' && readiness?.hasStructures) ||
                                (item.key === 'mapping' && readiness?.hasAssignments) ||
                                (item.key === 'ledger' && readiness?.hasLedger);

                            return (
                                <motion.div
                                    key={idx}
                                    whileHover={{ y: -5, backgroundColor: 'rgba(255,255,255,0.03)' }}
                                    className={`p-6 rounded-3xl border transition-all flex flex-col gap-6 ${isDone ? 'bg-emerald-500/[0.03] border-emerald-500/20' : 'bg-white/[0.01] border-white/5 opacity-40'}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDone ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/5 text-white/10'}`}>
                                            {item.icon}
                                        </div>
                                        <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${isDone ? 'text-emerald-500' : 'text-white/20'}`}>{item.status}</span>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-1">{item.label}</p>
                                        <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.3em] leading-none">{item.desc}</p>
                                    </div>
                                    {isDone && (
                                        <div className="h-1 w-full bg-emerald-500/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 w-full"></div>
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                <div className="w-full xl:w-96 flex flex-col items-center gap-10 p-10 bg-white/[0.02] border border-white/5 rounded-[3rem] shadow-inner relative">
                    <div className="relative w-56 h-56 flex items-center justify-center">
                        <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-[40px] opacity-40 animate-pulse"></div>
                        <svg className="w-full h-full -rotate-90 relative z-10" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" className="text-white/[0.03]" />
                            <motion.circle
                                cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4"
                                initial={{ strokeDashoffset: 283 }}
                                animate={{ strokeDashoffset: 283 - (283 * percentage) / 100 }}
                                strokeDasharray={283}
                                className="text-amber-500"
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                            <span className="text-6xl font-serif font-black text-white tracking-tighter">{percentage}<span className="text-2xl text-amber-500">%</span></span>
                            <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mt-2">Matrix Synthesis</span>
                        </div>
                    </div>

                    <div className="space-y-4 w-full">
                        <button
                            onClick={onNew}
                            className="w-full py-5 bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] uppercase tracking-[0.4em] rounded-2xl shadow-[0_24px_48px_-12px_rgba(245,158,11,0.4)] transition-all items-center gap-3 flex justify-center transform active:scale-95 group/btn"
                        >
                            Continue Setup <ArrowRightIcon className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                        </button>
                        <p className="text-[9px] text-center text-white/20 uppercase font-black tracking-[0.3em]">Institutional Verification Required</p>
                    </div>
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
        <div className="space-y-12 pb-24">
            {/* Top Readiness Navigator */}
            {(!readiness?.isSetupComplete || readiness?.percentage < 100) && <ReadinessNavigator readiness={readiness} onNew={onNewStructure} />}

            {/* Foundation Navigation Stats - Operational Hub */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                    { label: 'Fiscal Matrix', status: 'ACTIVE PERIOD', icon: <VersionIcon className="w-5 h-5" />, color: 'text-emerald-500', bg: 'bg-emerald-500/10', desc: 'Q1-2026 Sync', complexity: 'Medium Risk' },
                    { label: 'Registry Map', status: feeStructures.length > 0 ? `${feeStructures.length} PROTOCOLS` : 'EMPTY', icon: <BookIcon className="w-5 h-5" />, color: feeStructures.length > 0 ? 'text-emerald-500' : 'text-amber-500', bg: feeStructures.length > 0 ? 'bg-emerald-500/10' : 'bg-amber-500/10', desc: 'Institutional Billing', complexity: 'Governance Locked' },
                    { label: 'Audit Security', status: 'ENABLED', icon: <SecurityIcon className="w-5 h-5" />, color: 'text-emerald-500', bg: 'bg-emerald-500/10', desc: 'Forensic Logic', complexity: 'AES-256 Auth' },
                    { label: 'Global Ledger', status: 'VERIFIED', icon: <CreditCardIcon className="w-5 h-5" />, color: 'text-emerald-500', bg: 'bg-emerald-500/10', desc: 'Posting Balance Index', complexity: 'Settled Node' }
                ].map((step, i) => (
                    <motion.div
                        key={i}
                        whileHover={{ scale: 1.02 }}
                        className="bg-[#12141c]/60 border border-white/5 rounded-[3rem] p-10 flex flex-col gap-8 group hover:border-primary/20 transition-all relative overflow-hidden backdrop-blur-xl shadow-2xl"
                    >
                        <div className="absolute top-0 right-0 p-10 opacity-[0.02] group-hover:opacity-[0.08] group-hover:scale-125 transition-all duration-700">{step.icon}</div>
                        <div className={`w-14 h-14 rounded-[1.5rem] ${step.bg} ${step.color} flex items-center justify-center shadow-inner ring-1 ring-white/10 group-hover:ring-primary/40 transition-all`}>
                            {step.icon}
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">{step.label}</h4>
                                <span className="text-[8px] font-black text-white/10 uppercase tracking-widest">{step.complexity}</span>
                            </div>
                            <p className={`text-lg font-serif font-black uppercase tracking-tight ${step.color}`}>{step.status}</p>
                            <p className="text-[10px] font-medium text-white/10 mt-2 uppercase tracking-[0.2em] italic">{step.desc}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-16">
                {/* 1. Foundation Governance: Chart of Accounts */}
                <ConfigCard
                    title="Foundation Governance"
                    description="Core accounting rules, CoA hierarchy & fiscal policies"
                    icon={<SecurityIcon className="w-7 h-7" />}
                    isExpanded={expandedCard === 'foundation'}
                    onToggle={() => toggleCard('foundation')}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-8">
                        <div className="space-y-8">
                            <div className="flex justify-between items-center ml-1">
                                <h5 className="text-[11px] font-black text-white/40 uppercase tracking-[0.4em]">Master Chart of Accounts (CoA)</h5>
                                <button className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline underline-offset-4">Advanced Mapping</button>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                {[
                                    { code: '1000', name: 'ASSETS', sub: 'Current Assets, Banks, Receivables', type: 'asset', color: 'text-emerald-500' },
                                    { code: '2000', name: 'LIABILITIES', sub: 'Deferred Revenue, Deposits', type: 'liability', color: 'text-amber-500' },
                                    { code: '4000', name: 'REVENUE', sub: 'Tuition Fees, Transport, Lab', type: 'revenue', color: 'text-primary' },
                                    { code: '5000', name: 'EXPENSES', sub: 'Payroll, Maintenance, Utilities', type: 'expense', color: 'text-red-500' }
                                ].map(acc => (
                                    <div key={acc.code} className="bg-white/[0.02] border border-white/5 p-8 rounded-[2rem] flex justify-between items-center group/acc hover:bg-white/[0.04] hover:border-primary/20 transition-all shadow-xl">
                                        <div className="flex items-center gap-6">
                                            <span className={`text-[11px] font-black ${acc.color} bg-white/5 px-4 py-2 rounded-xl border border-white/5 font-mono`}>{acc.code}</span>
                                            <div>
                                                <p className="text-sm font-black text-white uppercase tracking-[0.1em]">{acc.name}</p>
                                                <p className="text-[10px] text-white/20 uppercase tracking-tight mt-1">{acc.sub}</p>
                                            </div>
                                        </div>
                                        <ArrowRightIcon className="w-4 h-4 text-white/5 group-hover/acc:text-primary transition-all translate-x-0 group-hover/acc:translate-x-1" />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-primary/[0.08] to-transparent rounded-[3.5rem] border border-white/10 p-12 flex flex-col justify-center text-center space-y-8 relative overflow-hidden shadow-3xl">
                            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/20 rounded-full blur-[100px] opacity-30"></div>
                            <VersionIcon className="w-20 h-20 text-primary/30 mx-auto animate-spin-slow" />
                            <div className="space-y-4">
                                <h6 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Automatic Harmony Engine</h6>
                                <p className="text-white/40 text-[13px] leading-relaxed max-w-sm mx-auto font-medium">Transactional entropy is reduced by mapping every billing event to the Chart of Accounts in real-time. Lock institutional rules before the next fiscal freeze.</p>
                            </div>
                            <button className="px-12 py-5 bg-white text-black hover:bg-white/90 font-black text-[11px] uppercase tracking-[0.4em] rounded-2xl shadow-2xl transition-all mx-auto transform hover:-translate-y-1 active:scale-95">
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
                    <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-10 pt-8">
                        {feeStructures.map(fs => (
                            <motion.div
                                key={fs.id}
                                whileHover={{ y: -8 }}
                                className="bg-[#1a1c26]/60 backdrop-blur-2xl border border-white/[0.05] rounded-[3rem] p-10 hover:border-primary/40 transition-all group/item relative overflow-hidden shadow-3xl"
                            >
                                <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover/item:opacity-[0.1] group-hover/item:scale-125 transition-all duration-1000">
                                    <VersionIcon className="w-32 h-32 text-primary -rotate-12" />
                                </div>
                                <div className="flex justify-between items-start mb-12 relative z-10">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <span className="px-3 py-1 bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest rounded-lg border border-primary/20">{fs.academic_year}</span>
                                            <span className="text-[10px] text-white/20 font-black uppercase tracking-[0.2em]">Structural ID: {fs.id.toString().slice(-6)}</span>
                                        </div>
                                        <h4 className="text-3xl font-serif font-black text-white group-hover/item:text-primary transition-colors tracking-tight uppercase leading-[0.9]">{fs.name}</h4>
                                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">Target: GRADE_{fs.target_grade}</p>
                                    </div>
                                    <button
                                        onClick={() => onEditStructure(fs)}
                                        className="p-4 bg-white/5 text-white/20 rounded-2xl hover:text-white hover:bg-white/10 transition-all border border-white/5 group-hover/item:border-primary/20"
                                    >
                                        <EditIcon className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="flex justify-between items-end mb-10 relative z-10 border-b border-white/5 pb-10">
                                    <div className="space-y-3">
                                        <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em]">Protocol Integrity</p>
                                        <span className={`inline-block px-4 py-2 rounded-xl text-[10px] font-black tracking-[0.2em] uppercase border ${fs.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                            {fs.status}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em] mb-2">Component Cloud</p>
                                        <div className="flex items-baseline justify-end gap-2">
                                            <span className="text-5xl font-black text-white font-serif italic tracking-tighter drop-shadow-xl">{fs.components?.length || 0}</span>
                                            <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Nodes</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center relative z-10">
                                    <div className="flex flex-col gap-2">
                                        <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em]">Sync Status</p>
                                        <div className="flex -space-x-3">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className="w-10 h-10 rounded-full bg-black/40 border-2 border-[#1a1c26] flex items-center justify-center text-[10px] font-black text-white/20 ring-1 ring-white/5 group-hover/item:ring-primary/40 transition-all">
                                                    <UsersIcon className="w-5 h-5 opacity-40" />
                                                </div>
                                            ))}
                                            <div className="h-10 px-4 rounded-full bg-primary/10 border-2 border-[#1a1c26] flex items-center justify-center text-[10px] font-black text-primary uppercase tracking-widest ring-1 ring-primary/20">
                                                {readiness?.hasAssignments ? 'MAPPED' : 'EMPTY'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right space-y-2">
                                        <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em]">Cumulative Node Value</p>
                                        <span className="text-3xl font-black text-white font-mono tracking-tighter bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                                            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: fs.currency as CurrencyCode, minimumFractionDigits: 0 }).format(fs.components?.reduce((a, c) => a + Number(c.amount), 0) || 0)}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                        <button
                            onClick={onNewStructure}
                            className="bg-white/[0.01] border-2 border-dashed border-white/5 rounded-[3rem] p-10 flex flex-col items-center justify-center gap-6 hover:bg-primary/[0.03] hover:border-primary/40 transition-all group/new min-h-[400px]"
                        >
                            <div className="w-20 h-20 rounded-[2rem] bg-white/5 flex items-center justify-center text-white/20 group-hover/new:bg-primary/20 group-hover/new:text-primary transition-all ring-1 ring-white/10 group-hover/new:ring-primary/40">
                                <PlusIcon className="w-8 h-8" />
                            </div>
                            <div className="text-center">
                                <p className="text-lg font-serif font-black text-white/30 uppercase tracking-tight group-hover/new:text-white transition-colors">Initialize New Protocol</p>
                                <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.4em] mt-2 italic">Forge new structural billing nodes</p>
                            </div>
                        </button>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 pt-8">
                        {paymentProtocols.length > 0 ? (
                            paymentProtocols.map(p => (
                                <motion.div
                                    key={p.id}
                                    whileHover={{ y: -5 }}
                                    className="bg-white/[0.02] border border-white/5 p-10 rounded-[3rem] space-y-8 hover:border-amber-500/30 transition-all group/pp relative shadow-2xl"
                                >
                                    <div className="flex justify-between items-center text-[10px] font-black text-white/10 uppercase tracking-[0.4em]">
                                        <span>Node: {p.id.slice(0, 8)}</span>
                                        <SecurityIcon className={`w-5 h-5 ${p.is_active ? 'text-emerald-500' : 'text-red-500'} opacity-40 group-hover/pp:opacity-100 transition-opacity`} />
                                    </div>
                                    <h4 className="text-2xl font-serif font-black text-white uppercase tracking-tighter leading-tight">{p.name}</h4>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="p-6 bg-black/40 border border-white/5 rounded-[2rem] shadow-inner">
                                            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-3">Grace Protocol</p>
                                            <p className="text-lg font-black text-white tracking-widest">{p.grace_period_days} <span className="text-[10px] text-white/40 italic">DAYS</span></p>
                                        </div>
                                        <div className="p-6 bg-black/40 border border-white/5 rounded-[2rem] shadow-inner">
                                            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-3">Penalty Node</p>
                                            <p className="text-lg font-black text-amber-500 font-mono italic tracking-widest">{p.penalty_type === 'percentage' ? `${p.penalty_value}%` : `${currency} ${p.penalty_value}`}</p>
                                        </div>
                                    </div>
                                    <div className="pt-8 border-t border-white/5 flex justify-between items-center text-[11px] uppercase font-black tracking-[0.3em]">
                                        <span className="text-white/20">Frequency Logic</span>
                                        <span className="text-primary/80 italic">{p.compounding_frequency}</span>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="col-span-full py-24 flex flex-col items-center justify-center gap-8 opacity-40 border-2 border-dashed border-white/5 rounded-[4rem] group hover:bg-white/[0.01] hover:border-white/10 transition-all">
                                <div className="p-8 bg-white/5 rounded-[2.5rem] ring-1 ring-white/10 group-hover:bg-amber-500/10 group-hover:ring-amber-500/20 transition-all">
                                    <CreditCardIcon className="w-16 h-16 text-white/10 group-hover:text-amber-500/40 animate-pulse" />
                                </div>
                                <div className="text-center space-y-4">
                                    <p className="text-xl font-serif font-black text-white/30 uppercase tracking-tighter">No Operational Protocols Defined</p>
                                    <button onClick={onNewProtocol} className="px-12 py-5 bg-white/5 hover:bg-white/10 text-white font-black text-[11px] uppercase tracking-[0.4em] rounded-2xl border border-white/10 transition-all font-serif italic shadow-2xl transform active:scale-95">
                                        Initialize Protocol Node
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </ConfigCard>

                {/* 4. Discount & Adjustment Rules */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                    <ConfigCard
                        title="Discount & Waiver Rules"
                        description="Rule-based hardship incentives & sibling relief nodes"
                        icon={<UsersIcon className="w-7 h-7" />}
                        isExpanded={expandedCard === 'discounts'}
                        onToggle={() => toggleCard('discounts')}
                    >
                        <div className="space-y-6 pt-8">
                            {adjustmentRules.length > 0 ? (
                                adjustmentRules.map(r => (
                                    <motion.div
                                        key={r.id}
                                        whileHover={{ x: 5 }}
                                        className="bg-[#12141c] border border-white/5 p-8 rounded-[2.5rem] flex justify-between items-center group/rule hover:border-emerald-500/40 hover:bg-emerald-500/[0.02] transition-all shadow-2xl relative overflow-hidden"
                                    >
                                        <div className="absolute inset-y-0 left-0 w-1 bg-emerald-500/0 group-hover/rule:bg-emerald-500/40 transition-all"></div>
                                        <div className="flex items-center gap-8">
                                            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500/40 border border-emerald-500/20 group-hover/rule:text-emerald-500 transition-all">
                                                <SecurityIcon className="w-7 h-7" />
                                            </div>
                                            <div>
                                                <p className="text-lg font-black text-white uppercase tracking-tight leading-none mb-2">{r.rule_name}</p>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Priority: <span className="text-primary/60">{r.value_priority}</span></span>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-white/10"></span>
                                                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">{r.is_stackable ? 'Stackable Matrix' : 'Exclusive Protocol'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-3">
                                            <span className="text-lg font-black text-emerald-500 bg-emerald-500/10 px-6 py-3 rounded-2xl border border-emerald-500/30 font-serif italic tracking-tighter shadow-lg">
                                                {r.calculation_type === 'percentage' ? `${r.value}% OFF` : `-${currency} ${r.value}`}
                                            </span>
                                            {r.requires_approval && (
                                                <div className="flex items-center gap-2">
                                                    <ClockIcon className="w-3 h-3 text-amber-500" />
                                                    <span className="text-[8px] font-black text-amber-500 uppercase tracking-[0.2em]">Verification Loop Required</span>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                <div className="py-24 flex flex-col items-center justify-center gap-6 opacity-30 border-2 border-dashed border-white/5 rounded-[3.5rem] hover:bg-white/[0.01] transition-all group">
                                    <UsersIcon className="w-16 h-16 text-white/10 group-hover:text-primary transition-all animate-bounce" />
                                    <p className="text-[11px] font-black uppercase text-white/40 tracking-[0.5em]">Awaiting Rule Deployment</p>
                                    <button onClick={onNewRule} className="px-10 py-4 bg-white/5 hover:bg-white/10 text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl border border-white/10 transition-all font-serif italic">
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
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-8">
                            {[
                                { name: 'Direct Institutional Tax', rate: '18', code: 'GST-S', desc: 'Standard Educational Service Tax' },
                                { name: 'Education Surcharge', rate: '2', code: 'EDU-C', desc: 'Regional Development Cess' }
                            ].map((t, i) => (
                                <motion.div
                                    key={i}
                                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.02)' }}
                                    className="bg-black/40 border border-white/5 p-10 rounded-[3rem] space-y-6 hover:border-primary/40 transition-all shadow-3xl relative overflow-hidden group/tax"
                                >
                                    <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-[60px] opacity-0 group-hover/tax:opacity-20 transition-opacity"></div>
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col">
                                            <span className="text-6xl font-serif font-black text-white tracking-widest italic drop-shadow-2xl">{t.rate}<span className="text-2xl text-primary">%</span></span>
                                            <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] mt-2">{t.name}</p>
                                        </div>
                                        <span className="text-[10px] font-black text-primary bg-primary/10 px-4 py-2 rounded-xl border border-primary/30 uppercase tracking-widest">{t.code}</span>
                                    </div>
                                    <p className="text-[9px] font-medium text-white/20 uppercase tracking-[0.3em] border-t border-white/5 pt-6">{t.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    </ConfigCard>
                </div>
            </div>
        </div>
    );
};

export default FinanceMaster;
