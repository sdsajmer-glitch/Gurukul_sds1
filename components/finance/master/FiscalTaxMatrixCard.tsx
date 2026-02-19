import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCardIcon } from '../../icons/CreditCardIcon';
import { PlusIcon } from '../../icons/PlusIcon';
import { ChevronDownIcon } from '../../icons/ChevronDownIcon';
import { EditIcon } from '../../icons/EditIcon';
import FiscalTaxWizard from '../wizards/FiscalTaxWizard';

interface TaxCardProps {
    taxes: any[];
    onRefresh: () => void;
    branchId: number | null;
}

const FiscalTaxMatrixCard: React.FC<TaxCardProps> = ({ taxes, onRefresh, branchId }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [wizardOpen, setWizardOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<any>(null);

    const handleNew = () => {
        setEditingRule(null);
        setWizardOpen(true);
    };

    const handleEdit = (tax: any) => {
        setEditingRule(tax);
        setWizardOpen(true);
    };

    const handleWizardSuccess = () => {
        setWizardOpen(false);
        onRefresh();
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
                        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 group-hover:scale-105 transition-transform">
                            <CreditCardIcon className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h3 className="text-2xl font-serif font-black text-white uppercase tracking-tight">Fiscal Tax Matrix</h3>
                                <span className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                                    {taxes.length} Nodes
                                </span>
                            </div>
                            <p className="text-sm text-white/40 font-medium">GST, VAT & Regional Tax Compliance</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleNew(); }}
                            className="hidden md:flex px-5 py-2.5 bg-white/[0.05] border border-white/10 hover:bg-indigo-500 hover:text-black hover:border-indigo-500 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all items-center gap-2 active:scale-95 z-10"
                        >
                            <PlusIcon className="w-4 h-4" />
                            <span>Define Tax</span>
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
                        {taxes.length === 0 ? (
                            <div className="col-span-full p-12 text-center border-2 border-dashed border-white/10 rounded-3xl">
                                <CreditCardIcon className="w-12 h-12 text-white/20 mx-auto mb-4" />
                                <h4 className="text-white font-bold text-lg mb-2">No Active Tax Nodes</h4>
                                <p className="text-white/40 text-sm mb-6">Setup GST/VAT or other tax components for invoices.</p>
                                <button
                                    onClick={handleNew}
                                    className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 text-black font-bold rounded-xl text-xs uppercase tracking-widest transition-colors"
                                >
                                    Initialize Tax Layer
                                </button>
                            </div>
                        ) : (
                            taxes.map((tax, idx) => (
                                <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 relative overflow-hidden hover:bg-white/[0.04] transition-all group/card">
                                    <div className="flex justify-between items-start mb-6 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                                                <span className="font-mono text-xs font-black">{tax.code}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleEdit(tax)}
                                            className="text-white/20 hover:text-white transition-colors"
                                        >
                                            <EditIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <h4 className="text-lg font-bold text-white mb-1 relative z-10">{tax.name}</h4>
                                    <div className="text-3xl font-serif font-black text-indigo-400 mb-2 relative z-10">{tax.rate_percentage}%</div>
                                    <div className="text-[10px] text-white/30 uppercase tracking-widest relative z-10">
                                        {tax.is_inclusive ? 'Inclusive (Absorbed)' : 'Exclusive (Added)'}
                                    </div>

                                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover/card:scale-110 transition-transform duration-500 pointer-events-none">
                                        <CreditCardIcon className="w-24 h-24" />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Wizard Modal */}
            {wizardOpen && (
                <FiscalTaxWizard
                    onClose={() => setWizardOpen(false)}
                    onSuccess={handleWizardSuccess}
                    branchId={branchId}
                    editingRule={editingRule}
                />
            )}
        </>
    );
};

export default FiscalTaxMatrixCard;
