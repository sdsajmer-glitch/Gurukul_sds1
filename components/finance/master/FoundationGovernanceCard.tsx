import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../../services/supabase';
import { ShieldCheckIcon } from '../../icons/ShieldCheckIcon';
import { LockIcon } from '../../icons/LockIcon';
import { RefreshCwIcon } from '../../icons/RefreshCwIcon'; // Acts as Toggle/Cycle
import { CalculatorIcon } from '../../icons/CalculatorIcon';
import { AlertTriangleIcon } from '../../icons/AlertTriangleIcon';
import { CheckCircleIcon } from '../../icons/CheckCircleIcon';

interface GovernanceProps {
    settings: any;
    branchId: number | null;
    onUpdate: () => void;
}

const FoundationGovernanceCard: React.FC<GovernanceProps> = ({ settings, branchId, onUpdate }) => {
    const [isExpanded, setIsExpanded] = useState(true); // Default open for priority
    const [loading, setLoading] = useState(false);

    const toggleSetting = async (key: string, currentValue: boolean) => {
        if (!branchId) return;
        setLoading(true);
        try {
            // Optimistic update logic would go here ideally, but for safety we await
            const updates = {
                ...settings,
                [key]: !currentValue
            };

            // Call the upsert RPC (Assuming update_finance_global_settings handles individual or full updates)
            // Ideally we should have a more granular update or pass specific params.
            // Using the existing RPC signature:
            const { error } = await supabase.rpc('update_finance_global_settings', {
                p_branch_id: branchId,
                p_is_tax_enabled: key === 'is_tax_enabled' ? !currentValue : settings.is_tax_enabled,
                p_approval_enabled: key === 'approval_hierarchy_enabled' ? !currentValue : settings.approval_hierarchy_enabled,
                p_late_fee_enabled: key === 'auto_late_fee_enabled' ? !currentValue : settings.auto_late_fee_enabled,
                p_version_control: settings.version_control_active // Assuming this exists or defaults
            });

            if (error) throw error;
            onUpdate();
        } catch (err) {
            console.error("Governance Update Failed:", err);
        } finally {
            setLoading(false);
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
                <div className={`w-10 h-10 rounded-full border border-white/10 flex items-center justify-center transition-transform duration-500 ${isExpanded ? 'rotate-180 bg-white/5' : 'rotate-0'}`}>
                    <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
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
                    <div className={`relative p-6 rounded-3xl border transition-all duration-300 ${settings?.is_tax_enabled ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-white/[0.02] border-white/5'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl ${settings?.is_tax_enabled ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/30'}`}>
                                <CalculatorIcon className="w-6 h-6" />
                            </div>
                            <div className="relative inline-flex items-center cursor-pointer" onClick={() => !loading && toggleSetting('is_tax_enabled', settings?.is_tax_enabled)}>
                                <div className={`w-11 h-6 rounded-full transition-colors ${settings?.is_tax_enabled ? 'bg-indigo-500' : 'bg-white/10'}`}></div>
                                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings?.is_tax_enabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </div>
                        </div>
                        <h4 className="text-lg font-bold text-white mb-1">Fiscal Tax Matrix</h4>
                        <p className="text-xs text-white/40 leading-relaxed">Enable regional tax calculation (GST/VAT) on invoice generation.</p>
                    </div>

                    {/* Approval Hierarchy */}
                    <div className={`relative p-6 rounded-3xl border transition-all duration-300 ${settings?.approval_hierarchy_enabled ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/[0.02] border-white/5'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl ${settings?.approval_hierarchy_enabled ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/30'}`}>
                                <ShieldCheckIcon className="w-6 h-6" />
                            </div>
                            <div className="relative inline-flex items-center cursor-pointer" onClick={() => !loading && toggleSetting('approval_hierarchy_enabled', settings?.approval_hierarchy_enabled)}>
                                <div className={`w-11 h-6 rounded-full transition-colors ${settings?.approval_hierarchy_enabled ? 'bg-purple-500' : 'bg-white/10'}`}></div>
                                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings?.approval_hierarchy_enabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </div>
                        </div>
                        <h4 className="text-lg font-bold text-white mb-1">Installment Logic</h4>
                        <p className="text-xs text-white/40 leading-relaxed">Enforce strict approval workflows for discount waivers > 10%.</p>
                    </div>

                    {/* Late Fee Protocol */}
                    <div className={`relative p-6 rounded-3xl border transition-all duration-300 ${settings?.auto_late_fee_enabled ? 'bg-pink-500/10 border-pink-500/30' : 'bg-white/[0.02] border-white/5'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl ${settings?.auto_late_fee_enabled ? 'bg-pink-500 text-white' : 'bg-white/5 text-white/30'}`}>
                                <AlertTriangleIcon className="w-6 h-6" />
                            </div>
                            <div className="relative inline-flex items-center cursor-pointer" onClick={() => !loading && toggleSetting('auto_late_fee_enabled', settings?.auto_late_fee_enabled)}>
                                <div className={`w-11 h-6 rounded-full transition-colors ${settings?.auto_late_fee_enabled ? 'bg-pink-500' : 'bg-white/10'}`}></div>
                                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings?.auto_late_fee_enabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                            </div>
                        </div>
                        <h4 className="text-lg font-bold text-white mb-1">Late Fee Protocol</h4>
                        <p className="text-xs text-white/40 leading-relaxed">Auto-apply penalty charges on invoices past due date (+7 days).</p>
                    </div>

                    {/* Ledger Lock (Read Only) */}
                    <div className="relative p-6 rounded-3xl border bg-white/[0.02] border-white/5 opacity-60">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 rounded-xl bg-white/5 text-white/30">
                                <LockIcon className="w-6 h-6" />
                            </div>
                            <span className="px-2 py-1 rounded-lg bg-white/5 text-[9px] font-black text-white/30 uppercase tracking-widest">Global Lock</span>
                        </div>
                        <h4 className="text-lg font-bold text-white mb-1">Ledger Lock Date</h4>
                        <p className="text-xs text-white/40 leading-relaxed mb-2">Prevents modification of fiscal records prior to:</p>
                        <div className="text-sm font-mono text-white/60 bg-black/20 px-3 py-1.5 rounded-lg inline-block">
                            {settings?.ledger_lock_date || 'NOT_SET'}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default FoundationGovernanceCard;
