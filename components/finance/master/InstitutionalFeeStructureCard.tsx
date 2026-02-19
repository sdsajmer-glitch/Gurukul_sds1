import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookIcon } from '../../icons/BookIcon';
import { PlusIcon } from '../../icons/PlusIcon';
import { UsersIcon } from '../../icons/UsersIcon';
import { ChevronDownIcon } from '../../icons/ChevronDownIcon';
import { EditIcon } from '../../icons/EditIcon';
import { ShieldCheckIcon } from '../../icons/ShieldCheckIcon';
import { LockIcon } from '../../icons/LockIcon';
import { TrashIcon } from '../../icons/TrashIcon';
import FeeStructureWizard from '../wizards/FeeStructureWizard';

// Define local interfaces matching the wizard
import { FeeStructure } from '../../../types';

interface FeeStructureCardProps {
    structures: FeeStructure[];
    currency: string;
    onRefresh: () => void;
    branchId: number | null;
}

const InstitutionalFeeStructureCard: React.FC<FeeStructureCardProps> = ({
    structures,
    currency,
    onRefresh,
    branchId
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [wizardOpen, setWizardOpen] = useState(false);
    const [editingStructure, setEditingStructure] = useState<FeeStructure | null>(null);

    const handleNew = () => {
        setEditingStructure(null);
        setWizardOpen(true);
    };

    const handleEdit = (structure: FeeStructure) => {
        setEditingStructure(structure);
        setWizardOpen(true);
    };

    const handleWizardSuccess = () => {
        setWizardOpen(false);
        onRefresh();
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount || 0);
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
                        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:scale-105 transition-transform">
                            <BookIcon className="w-8 h-8 text-emerald-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h3 className="text-2xl font-serif font-black text-white uppercase tracking-tight">Institutional Fee Structures</h3>
                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                                    {structures.filter(s => s.status === 'Active').length} Active Nodes
                                </span>
                            </div>
                            <p className="text-sm text-white/40 font-medium">Global Grade-Wise Billing Matrix & Components</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={(e) => { e.stopPropagation(); handleNew(); }}
                            className="hidden md:flex px-5 py-2.5 bg-white/[0.05] border border-white/10 hover:bg-emerald-500 hover:text-black hover:border-emerald-500 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all items-center gap-2 active:scale-95 z-10"
                        >
                            <PlusIcon className="w-4 h-4" />
                            <span>Create Structure</span>
                        </button>
                        <div className={`w-10 h-10 rounded-full border border-white/10 flex items-center justify-center transition-transform duration-500 ${isExpanded ? 'rotate-180 bg-white/5' : 'rotate-0'}`}>
                            <ChevronDownIcon className="w-4 h-4 text-white/40" />
                        </div>
                    </div>
                </div>

                {/* Content */}
                <motion.div
                    initial={false}
                    animate={{ height: isExpanded ? 'auto' : 0 }}
                    transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
                    className="overflow-hidden"
                >
                    <div className="p-8 pt-0 space-y-4">
                        {structures.length === 0 ? (
                            <div className="p-12 text-center border-2 border-dashed border-white/10 rounded-3xl">
                                <BookIcon className="w-12 h-12 text-white/20 mx-auto mb-4" />
                                <h4 className="text-white font-bold text-lg mb-2">No Fee Structures Defined</h4>
                                <p className="text-white/40 text-sm mb-6">Initialize a fee structure to start billing students.</p>
                                <button
                                    onClick={handleNew}
                                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs uppercase tracking-widest transition-colors"
                                >
                                    Initialize First Protocol
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {structures.map((structure) => (
                                    <div
                                        key={structure.id}
                                        className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl hover:bg-white/[0.04] hover:border-white/10 transition-all group/card relative overflow-hidden"
                                    >
                                        <div className="flex justify-between items-start mb-6 relative z-10">
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="text-lg font-bold text-white tracking-wide">{structure.name}</span>
                                                    {structure.status === 'Active' ? (
                                                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-widest rounded border border-emerald-500/20 flex items-center gap-1">
                                                            <ShieldCheckIcon className="w-3 h-3" /> Active
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 bg-white/10 text-white/40 text-[9px] font-black uppercase tracking-widest rounded border border-white/10">
                                                            Draft
                                                        </span>
                                                    )}
                                                    {structure.is_locked && <LockIcon className="w-3 h-3 text-amber-500" />}
                                                </div>
                                                <div className="flex items-center gap-2 text-white/40 text-xs">
                                                    <span className="px-2 py-1 bg-white/5 rounded-md uppercase tracking-wider font-bold">Grade {structure.target_grade}</span>
                                                    <span>•</span>
                                                    <span className="font-mono">{structure.academic_year}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-serif font-black text-white tracking-tight">
                                                    {formatCurrency(structure.total_amount || 0)}
                                                </div>
                                                <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold mt-1">Total / Year</div>
                                            </div>
                                        </div>

                                        {/* Metrics Strip */}
                                        <div className="flex items-center gap-4 py-4 border-t border-b border-white/5 mb-4 relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                                                    <UsersIcon className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="text-white font-bold text-sm">{(structure as any).student_count || 0}</div>
                                                    <div className="text-[9px] text-white/30 uppercase tracking-widest">Active Links</div>
                                                </div>
                                            </div>
                                            <div className="w-px h-8 bg-white/5"></div>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                                                    <BookIcon className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="text-white font-bold text-sm">{(structure as any).section_count || 0}</div>
                                                    <div className="text-[9px] text-white/30 uppercase tracking-widest">Sections</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 relative z-10">
                                            <button
                                                onClick={() => handleEdit(structure)}
                                                className="flex-1 py-3 bg-white/[0.03] border border-white/5 hover:bg-white/10 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 transition-all flex items-center justify-center gap-2 group/btn"
                                            >
                                                {structure.is_locked ? (
                                                    <><BookIcon className="w-3 h-3" /> View Protocol</>
                                                ) : (
                                                    <><EditIcon className="w-3 h-3 group-hover/btn:text-emerald-400 transition-colors" /> Configure Matrix</>
                                                )}
                                            </button>
                                        </div>

                                        {/* Decor */}
                                        <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover/card:scale-125 transition-transform duration-700 pointer-events-none">
                                            <BookIcon className="w-32 h-32" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Wizard Modal */}
            {wizardOpen && (
                <FeeStructureWizard
                    onClose={() => setWizardOpen(false)}
                    onSuccess={handleWizardSuccess}
                    branchId={branchId}
                    editingStructure={editingStructure}
                />
            )}
        </>
    );
};

export default InstitutionalFeeStructureCard;
