import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../../services/supabase';
import { ShieldCheckIcon } from '../../icons/ShieldCheckIcon';
import { LockIcon } from '../../icons/LockIcon';
import { CalculatorIcon } from '../../icons/CalculatorIcon';
import { AlertTriangleIcon } from '../../icons/AlertTriangleIcon';

interface GovernanceProps {
    settings: any;
    onUpdate: () => void;
    onChange: (key: string, value: any) => void;
    isSaving?: boolean;
    canModify?: boolean; // New prop for RBAC
}

const FoundationGovernanceCard: React.FC<GovernanceProps> = ({ settings, branchId, onUpdate, onChange, isSaving, canModify = true }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [confirmModal, setConfirmModal] = useState<{ show: boolean, key: string, label: string } | null>(null);

    const handleToggle = (key: string, currentValue: boolean, label: string) => {
        if (isSaving || !canModify) return;

        // Critical rules like Tax require confirmation
        if (!currentValue && (key === 'tax_enabled' || key === 'installment_strict_mode')) {
            setConfirmModal({ show: true, key, label });
        } else {
            onChange(key, !currentValue);
        }
    };

    const confirmToggle = () => {
        if (confirmModal) {
            onChange(confirmModal.key, true);
            setConfirmModal(null);
        }
    };

    return (
        <div className="w-full bg-[#12141c] border border-white/5 rounded-[2rem] overflow-hidden transition-all hover:border-white/10 group">
            <div
                className="p-8 flex items-center justify-between cursor-pointer bg-white/[0.02]"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 group-hover:scale-105 transition-transform">
                        <ShieldCheckIcon className="w-8 h-8 text-indigo-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-2xl font-serif font-black text-white uppercase tracking-tight">Foundation Governance</h3>
                            <span className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                                Core Layer
                            </span>
                        </div>
                        <p className="text-sm text-white/40 font-medium">Global Activity Parameters & Fiscal Settings</p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    {!canModify && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                            <LockIcon className="w-4 h-4 text-amber-500/50" />
                            <span className="text-[10px] font-black text-amber-500/50 uppercase tracking-widest">Read Only Mode</span>
                        </div>
                    )}
                    <div className={`w-10 h-10 rounded-full border border-white/10 flex items-center justify-center transition-transform duration-500 ${isExpanded ? 'rotate-180 bg-white/5' : 'rotate-0'}`}>
                        <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
            </div>

            <motion.div
                initial={false}
                animate={{ height: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
                transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
                className="overflow-hidden"
            >
                <div className="p-8 pt-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    {/* Tax Mode Toggle */}
                    <div className={`relative p-6 rounded-3xl border transition-all duration-300 ${settings?.tax_enabled ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-white/[0.02] border-white/5 opacity-80'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl ${settings?.tax_enabled ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/30'}`}>
                                <CalculatorIcon className="w-6 h-6" />
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${settings?.tax_enabled ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-white/20'}`}>
                                    {settings?.tax_enabled ? 'Active' : 'Inactive'}
                                </span>
                                <div
                                    className={`relative inline-flex items-center ${isSaving || !canModify ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                    onClick={() => handleToggle('tax_enabled', settings?.tax_enabled, 'Fiscal Tax Matrix')}
                                >
                                    <div className={`w-11 h-6 rounded-full transition-colors ${settings?.tax_enabled ? 'bg-indigo-500' : 'bg-white/10'} ${isSaving || !canModify ? 'opacity-30' : ''}`}></div>
                                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings?.tax_enabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </div>
                            </div>
                        </div>
                        <h4 className="text-lg font-bold text-white mb-1">Fiscal Tax Matrix</h4>
                        <p className="text-xs text-white/40 leading-relaxed">Enable regional tax calculation (GST/VAT) on invoice generation. Requires configured tax codes.</p>
                    </div>

                    {/* Installment Logic */}
                    <div className={`relative p-6 rounded-3xl border transition-all duration-300 ${settings?.installment_strict_mode ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/[0.02] border-white/5 opacity-80'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl ${settings?.installment_strict_mode ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/30'}`}>
                                <ShieldCheckIcon className="w-6 h-6" />
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${settings?.installment_strict_mode ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-white/20'}`}>
                                    {settings?.installment_strict_mode ? 'Strict' : 'Flexible'}
                                </span>
                                <div
                                    className={`relative inline-flex items-center ${isSaving || !canModify ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                    onClick={() => handleToggle('installment_strict_mode', settings?.installment_strict_mode, 'Installment Logic')}
                                >
                                    <div className={`w-11 h-6 rounded-full transition-colors ${settings?.installment_strict_mode ? 'bg-purple-500' : 'bg-white/10'} ${isSaving || !canModify ? 'opacity-30' : ''}`}></div>
                                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings?.installment_strict_mode ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </div>
                            </div>
                        </div>
                        <h4 className="text-lg font-bold text-white mb-1">Installment Logic</h4>
                        <p className="text-xs text-white/40 leading-relaxed">Enforce strict approval workflows for discount waivers &gt; 10%.</p>
                    </div>

                    {/* Late Fee Protocol */}
                    <div className={`relative p-6 rounded-3xl border transition-all duration-300 ${settings?.late_fee_enabled ? 'bg-pink-500/10 border-pink-500/30' : 'bg-white/[0.02] border-white/5 opacity-80'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl ${settings?.late_fee_enabled ? 'bg-pink-500 text-white' : 'bg-white/5 text-white/30'}`}>
                                <AlertTriangleIcon className="w-6 h-6" />
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${settings?.late_fee_enabled ? 'bg-pink-500/20 text-pink-400' : 'bg-white/5 text-white/20'}`}>
                                    {settings?.late_fee_enabled ? 'Auto' : 'Manual'}
                                </span>
                                <div
                                    className={`relative inline-flex items-center ${isSaving || !canModify ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                    onClick={() => handleToggle('late_fee_enabled', settings?.late_fee_enabled, 'Late Fee Protocol')}
                                >
                                    <div className={`w-11 h-6 rounded-full transition-colors ${settings?.late_fee_enabled ? 'bg-pink-500' : 'bg-white/10'} ${isSaving || !canModify ? 'opacity-30' : ''}`}></div>
                                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings?.late_fee_enabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </div>
                            </div>
                        </div>
                        <h4 className="text-lg font-bold text-white mb-1">Late Fee Protocol</h4>
                        <p className="text-xs text-white/40 leading-relaxed">Auto-apply penalty charges on invoices past due date (+7 days).</p>
                    </div>

                    {/* Ledger Lock (Read Only) */}
                    <div className="relative p-6 rounded-3xl border bg-white/[0.02] border-white/5 opacity-60 hover:opacity-100 transition-opacity">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 rounded-xl bg-white/5 text-white/30">
                                <LockIcon className="w-6 h-6" />
                            </div>
                            <span className="px-2 py-1 rounded-lg bg-white/5 text-[9px] font-black text-white/30 uppercase tracking-widest">Global Lock</span>
                        </div>
                        <h4 className="text-lg font-bold text-white mb-1">Ledger Lock Date</h4>
                        <p className="text-xs text-white/40 leading-relaxed mb-2">Prevents modification of fiscal records prior to:</p>
                        <div className="flex items-center gap-3">
                            <div className="text-sm font-mono text-white/60 bg-black/20 px-3 py-1.5 rounded-lg inline-block">
                                {settings?.ledger_lock_date || 'NOT_SET'}
                            </div>
                            {settings?.updated_at && (
                                <div className="text-[9px] text-white/20 uppercase tracking-tighter">
                                    Last Sync: {new Date(settings.updated_at).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Confirmation Modal */}
            {confirmModal?.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[#1a1d29] border border-white/10 p-8 rounded-[2rem] max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 mb-6">
                            <AlertTriangleIcon className="w-8 h-8 text-amber-500" />
                        </div>
                        <h3 className="text-2xl font-serif font-black text-white uppercase tracking-tight mb-3">Critical Governance Rule</h3>
                        <p className="text-white/60 text-sm leading-relaxed mb-8">
                            You are about to enable <span className="text-white font-bold">{confirmModal.label}</span>.
                            This is a core financial rule that will affect calculations across the entire institution.
                            The system will validate dependencies upon saving.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setConfirmModal(null)}
                                className="flex-1 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 font-bold uppercase tracking-widest text-[10px] transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmToggle}
                                className="flex-1 px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold uppercase tracking-widest text-[10px] transition-all shadow-lg"
                            >
                                Proced
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FoundationGovernanceCard;
