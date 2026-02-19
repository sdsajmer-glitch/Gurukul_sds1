import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { UsersIcon } from '../../icons/UsersIcon'; // Using flexible icon
import { PlusIcon } from '../../icons/PlusIcon';
import { ChevronDownIcon } from '../../icons/ChevronDownIcon';
import { ArrowRightIcon } from '../../icons/ArrowRightIcon';
import { EditIcon } from '../../icons/EditIcon';
import DiscountRuleWizard from '../wizards/DiscountRuleWizard';

interface DiscountCardProps {
    rules: any[];
    onRefresh: () => void;
    branchId: number | null;
}

const DiscountWaiverCard: React.FC<DiscountCardProps> = ({ rules, onRefresh, branchId }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [wizardOpen, setWizardOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<any>(null);

    const handleNew = () => {
        setEditingRule(null);
        setWizardOpen(true);
    };

    const handleEdit = (rule: any) => {
        setEditingRule(rule);
        setWizardOpen(true);
    };

    const handleWizardSuccess = () => {
        setWizardOpen(false);
        onRefresh();
    };

    const getCategoryColor = (category: string) => {
        switch (category?.toLowerCase()) {
            case 'merit': case 'scholarship': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            case 'sibling': case 'discount': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            case 'staff': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            case 'ews': case 'waiver': return 'text-pink-400 bg-pink-500/10 border-pink-500/20';
            case 'late fee': return 'text-red-400 bg-red-500/10 border-red-500/20';
            default: return 'text-white/40 bg-white/5 border-white/10';
        }
    };

    return (
        <>
            <div className="w-full bg-[#12141c] border border-white/5 rounded-[2rem] overflow-hidden transition-all hover:border-white/10 group">
                {/* Header */}
                <div
                    className="p-8 flex items-center justify-between cursor-pointer bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 group-hover:scale-105 transition-transform">
                            <UsersIcon className="w-8 h-8 text-amber-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h3 className="text-2xl font-serif font-black text-white uppercase tracking-tight">Discount & Waiver Rules</h3>
                                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                                    {rules.length} Active
                                </span>
                            </div>
                            <p className="text-sm text-white/40 font-medium">Scholarship Matrix, Sibling Benefits & Staff Protocols</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleNew(); }}
                            className="hidden md:flex px-5 py-2.5 bg-white/[0.05] border border-white/10 hover:bg-amber-500 hover:text-black hover:border-amber-500 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all items-center gap-2 active:scale-95 z-10"
                        >
                            <PlusIcon className="w-4 h-4" />
                            <span>Define Rule</span>
                        </button>
                        <div className={`w-10 h-10 rounded-full border border-white/10 flex items-center justify-center transition-transform duration-500 ${isExpanded ? 'rotate-180 bg-white/5' : 'rotate-0'}`}>
                            <ChevronDownIcon className="w-4 h-4 text-white/40" />
                        </div>
                    </div>
                </div>

                {/* Body */}
                <motion.div
                    initial={false}
                    animate={{ height: isExpanded ? 'auto' : 0 }}
                    transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
                    className="overflow-hidden"
                >
                    <div className="p-8 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {rules.length === 0 ? (
                            <div className="col-span-full p-12 text-center border-2 border-dashed border-white/10 rounded-3xl">
                                <UsersIcon className="w-12 h-12 text-white/20 mx-auto mb-4" />
                                <h4 className="text-white font-bold text-lg mb-2">No Discount Rules Active</h4>
                                <p className="text-white/40 text-sm mb-6">Create rules for scholarships, sibling discounts, or financial aid.</p>
                                <button
                                    onClick={handleNew}
                                    className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs uppercase tracking-widest transition-colors"
                                >
                                    Setup Waiver Logic
                                </button>
                            </div>
                        ) : (
                            rules.map((rule, idx) => (
                                <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 relative overflow-hidden hover:bg-white/[0.04] transition-all group/card">
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className={`px-2 py-1 rounded text-[10px] uppercase font-black tracking-wider border ${getCategoryColor(rule.category)}`}>
                                            {rule.category}
                                        </div>
                                        <button
                                            onClick={() => handleEdit(rule)}
                                            className="text-white/20 hover:text-white transition-colors"
                                        >
                                            <EditIcon className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <h4 className="text-lg font-bold text-white mb-1 relative z-10 truncate">{rule.name}</h4>
                                    <div className="flex items-baseline gap-1 mb-4 relative z-10">
                                        <span className="text-2xl font-serif font-black text-amber-500">
                                            {rule.value_type === 'Percentage' ? `${rule.value}%` : `₹${rule.value}`}
                                        </span>
                                        <span className="text-[10px] text-white/40 uppercase tracking-widest">OFF</span>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-white/30 font-mono relative z-10">
                                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${rule.is_automatic ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                        <span>{rule.is_automatic ? 'Auto-Applied' : 'Manual Application'}</span>
                                    </div>

                                    {/* Decor */}
                                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover/card:scale-110 transition-transform duration-500 pointer-events-none">
                                        <UsersIcon className="w-24 h-24" />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Wizard Modal */}
            {wizardOpen && (
                <DiscountRuleWizard
                    onClose={() => setWizardOpen(false)}
                    onSuccess={handleWizardSuccess}
                    branchId={branchId}
                    editingRule={editingRule}
                />
            )}
        </>
    );
};

export default DiscountWaiverCard;
