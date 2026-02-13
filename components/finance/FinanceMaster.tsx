
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
    onNewStructure: () => void;
    onEditStructure: (fs: FeeStructure) => void;
    currency: CurrencyCode;
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

const FinanceMaster: React.FC<FinanceMasterProps> = ({
    feeStructures,
    onNewStructure,
    onEditStructure,
    currency
}) => {
    const [expandedCard, setExpandedCard] = useState<string | null>('fee_structures');

    const toggleCard = (id: string) => {
        setExpandedCard(expandedCard === id ? null : id);
    };

    return (
        <div className="space-y-8 pb-12">
            {/* Header / Intro */}
            <div className="bg-[#12141c] p-12 rounded-[3.5rem] border border-white/5 shadow-3xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-24 opacity-[0.02] pointer-events-none group-hover:scale-110 transition-transform duration-1000 rotate-12">
                    <BookIcon className="w-64 h-64 text-primary" />
                </div>
                <div className="flex flex-col md:flex-row justify-between items-center gap-12 relative z-10">
                    <div className="space-y-6 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-4">
                            <div className="h-[1px] w-10 bg-primary/40" />
                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.5em]">Global Financial Control Center</span>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-serif font-black text-white tracking-tighter leading-none uppercase">Configuration <span className="text-white/20 italic font-medium lowercase">node.</span></h2>
                        <p className="text-white/40 font-serif italic text-lg max-w-2xl leading-relaxed">Harmonize institutional fee structures, payment plan protocols, and global fiscal compliance policies from a single authoritative node.</p>
                    </div>
                    <button
                        onClick={onNewStructure}
                        className="px-12 py-6 bg-primary text-white font-black text-[11px] uppercase tracking-[0.4em] rounded-2xl shadow-3xl hover:bg-primary/90 transition-all flex items-center gap-4 active:scale-95 shadow-primary/20 ring-1 ring-white/20"
                    >
                        <PlusIcon className="w-5 h-5" /> Initialize New Protocol
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {/* Fee Structures Accordion */}
                <ConfigCard
                    title="Institutional Fee Structures"
                    description="Curated grade-wise billing cycles & currency nodes"
                    icon={<BookIcon className="w-7 h-7" />}
                    isExpanded={expandedCard === 'fee_structures'}
                    onToggle={() => toggleCard('fee_structures')}
                >
                    <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-8 pt-6">
                        {feeStructures.map(fs => (
                            <div key={fs.id} className="bg-black/40 border border-white/[0.04] rounded-3xl p-8 hover:border-white/10 transition-all group/item relative overflow-hidden">
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
                                        <p className="text-[9px] font-black text-white/10 uppercase tracking-widest mb-1">Cumulative Value</p>
                                        <span className="text-3xl font-black text-white font-mono tracking-tighter">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: fs.currency as CurrencyCode, minimumFractionDigits: 0 }).format(fs.components?.reduce((a, c) => a + Number(c.amount), 0) || 0)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </ConfigCard>

                {/* Other Modules as Static placeholders for UI/UX flow */}
                {[
                    { id: 'payment_plans', title: 'Payment Plan Protocols', desc: 'Installment matrices & automated collection workflows', icon: <CreditCardIcon className="w-7 h-7" /> },
                    { id: 'discounts', title: 'Discount & Waiver Policies', desc: 'Rule-based financial relief & early-bird incentives', icon: <UsersIcon className="w-7 h-7" /> },
                    { id: 'scholarships', title: 'Scholarship Mapping', desc: 'Merit-based allowance & financial aid configuration', icon: <VersionIcon className="w-7 h-7" /> },
                    { id: 'tax', title: 'Fiscal Compliance & Tax', desc: 'Global tax node orchestration & regional compliance rules', icon: <SecurityIcon className="w-7 h-7" /> }
                ].map(mod => (
                    <ConfigCard
                        key={mod.id}
                        title={mod.title}
                        description={mod.desc}
                        icon={mod.icon}
                        isExpanded={expandedCard === mod.id}
                        onToggle={() => toggleCard(mod.id)}
                    >
                        <div className="py-20 flex flex-col items-center justify-center gap-8 opacity-20 group-hover:opacity-40 transition-opacity">
                            <VersionIcon className="w-16 h-16 animate-spin-slow" />
                            <p className="text-[12px] font-black uppercase tracking-[0.8em] text-white/40">Synchronizing Module Data...</p>
                        </div>
                    </ConfigCard>
                ))}
            </div>
        </div>
    );
};

export default FinanceMaster;
