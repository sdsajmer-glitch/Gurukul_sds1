
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCardIcon } from '../../icons/CreditCardIcon';
import { CalendarIcon } from '../../icons/CalendarIcon';
import { PlusIcon } from '../../icons/PlusIcon';
import { ChevronDownIcon } from '../../icons/ChevronDownIcon';
import { ArrowRightIcon } from '../../icons/ArrowRightIcon';
import PaymentPlanWizard from '../wizards/PaymentPlanWizard';

interface ProtocolCardProps {
    protocols: any[];
    onRefresh: () => void;
    branchId: number | null;
}

const PaymentPlanProtocolCard: React.FC<ProtocolCardProps> = ({ protocols, onRefresh, branchId }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [wizardOpen, setWizardOpen] = useState(false);
    const [editingProtocol, setEditingProtocol] = useState<any>(null);

    const handleNew = () => {
        setEditingProtocol(null);
        setWizardOpen(true);
    };

    const handleEdit = (protocol: any) => {
        setEditingProtocol(protocol);
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
                        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 group-hover:scale-105 transition-transform">
                            <CreditCardIcon className="w-8 h-8 text-purple-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h3 className="text-2xl font-serif font-black text-white uppercase tracking-tight">Payment Plans</h3>
                                <span className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/30 text-[10px] font-bold text-purple-400 uppercase tracking-widest">
                                    {protocols.length} Active
                                </span>
                            </div>
                            <p className="text-sm text-white/40 font-medium">Installment Logistics & Due Date Mapping</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleNew(); }}
                            className="hidden md:flex px-5 py-2.5 bg-white/[0.05] border border-white/10 hover:bg-purple-500 hover:text-black hover:border-purple-500 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all items-center gap-2 active:scale-95 z-10"
                        >
                            <PlusIcon className="w-4 h-4" />
                            <span>Add Plan</span>
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
                    <div className="p-8 pt-0">
                        {protocols.length === 0 ? (
                            <div className="p-12 text-center border-2 border-dashed border-white/10 rounded-3xl">
                                <CreditCardIcon className="w-12 h-12 text-white/20 mx-auto mb-4" />
                                <h4 className="text-white font-bold text-lg mb-2">No Payment Plans</h4>
                                <p className="text-white/40 text-sm mb-6">Define installment plans (Monthly, Quarterly, etc.) to offer flexibility.</p>
                                <button
                                    onClick={handleNew}
                                    className="px-6 py-3 bg-purple-500 hover:bg-purple-400 text-black font-bold rounded-xl text-xs uppercase tracking-widest transition-colors"
                                >
                                    Create Installment Plan
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {protocols.map((protocol, idx) => (
                                    <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 relative overflow-hidden hover:bg-white/[0.04] transition-all group/card">
                                        <div className="flex justify-between items-start mb-6 relative z-10">
                                            <div>
                                                <h4 className="text-lg font-bold text-white mb-1">{protocol.name}</h4>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-purple-400 font-mono bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 uppercase tracking-wider">{protocol.type}</span>
                                                    <span className="text-xs text-white/30">• {protocol.total_splits} Splits</span>
                                                </div>
                                            </div>
                                            <div className="p-2 bg-white/5 rounded-lg">
                                                <CalendarIcon className="w-5 h-5 text-white/40" />
                                            </div>
                                        </div>

                                        {/* Visual Timeline */}
                                        <div className="relative z-10 mb-6">
                                            <div className="flex justify-between text-[10px] font-black uppercase text-white/20 mb-2 tracking-widest">
                                                <span>Start</span>
                                                <span>Completion</span>
                                            </div>
                                            <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden flex">
                                                {protocol.splits && protocol.splits.map((split: any, i: number) => (
                                                    <div
                                                        key={i}
                                                        className="h-full bg-purple-500/40 border-r border-black/20 first:rounded-l-full last:rounded-r-full hover:bg-purple-400 transition-colors"
                                                        style={{ width: `${split.percentage}%` }}
                                                        title={`${split.label}: ${split.percentage}%`}
                                                    />
                                                ))}
                                                {/* Fallback if splits not loaded yet */}
                                                {!protocol.splits && Array.from({ length: protocol.total_splits }).map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className="h-full bg-purple-500/40 border-r border-black/20 first:rounded-l-full last:rounded-r-full"
                                                        style={{ width: `${100 / protocol.total_splits}%` }}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        {/* Edit Action */}
                                        <div className="flex justify-end relative z-10">
                                            <button
                                                onClick={() => handleEdit(protocol)}
                                                className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white flex items-center gap-2 transition-colors"
                                            >
                                                Configure Plan <ArrowRightIcon className="w-3 h-3" />
                                            </button>
                                        </div>

                                        {/* Decor */}
                                        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover/card:bg-purple-500/10 transition-colors duration-500"></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Wizard Modal */}
            {wizardOpen && (
                <PaymentPlanWizard
                    onClose={() => setWizardOpen(false)}
                    onSuccess={handleWizardSuccess}
                    branchId={branchId}
                    editingProtocol={editingProtocol}
                />
            )}
        </>
    );
};

export default PaymentPlanProtocolCard;
