import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../services/supabase';
import FoundationGovernanceCard from './master/FoundationGovernanceCard';
import InstitutionalFeeStructureCard from './master/InstitutionalFeeStructureCard';
import PaymentPlanProtocolCard from './master/PaymentPlanProtocolCard';
import DiscountWaiverCard from './master/DiscountWaiverCard';
import FiscalTaxMatrixCard from './master/FiscalTaxMatrixCard';
import { SparklesIcon } from '../icons/SparklesIcon';
import { FeeStructure } from '../../types';

interface MasterControlProps {
    feeStructures: FeeStructure[];
    paymentProtocols: any[];
    adjustmentRules: any[];
    masterState: any; // Contains taxes, approvals, readiness etc.
    currency: string;
    branchId: number | null;
    onNewStructure: () => void;
    onEditStructure: (fs: FeeStructure) => void;
    onNewProtocol: () => void;
    onNewRule: () => void;
    onNewTax: () => void; // Need to bubble this up
    onUpdate: () => void;
    userRole?: string; // New prop for RBAC
}

const MasterControlPanel: React.FC<MasterControlProps> = ({
    feeStructures,
    paymentProtocols,
    adjustmentRules,
    masterState,
    currency,
    branchId,
    onNewStructure,
    onEditStructure,
    onNewProtocol,
    onNewRule,
    onNewTax, // Fixed duplicate identifier
    onUpdate,
    userRole
}) => {

    // Extract data from masterState
    const initialSettings = masterState?.settings || {};
    const taxes = masterState?.taxes || [];

    // RBAC: Check if user has institutional authority to modify governance
    const canModify = React.useMemo(() => {
        if (!userRole) return false;
        const role = userRole.toLowerCase();
        return role.includes('admin') ||
            role.includes('finance') ||
            role === 'accountant' ||
            role === 'principal';
    }, [userRole]);

    const [localSettings, setLocalSettings] = useState(initialSettings);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Update local state when masterState changes
    useEffect(() => {
        if (masterState?.settings) {
            setLocalSettings(masterState.settings);
        }
    }, [masterState?.settings]);

    const handleSettingChange = (key: string, value: any) => {
        if (!canModify) {
            alert("Unauthorized: You do not have permissions to modify institutional governance.");
            return;
        }
        setLocalSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleGlobalSave = async () => {
        if (!branchId || isSaving) return;
        if (!canModify) {
            alert("Unauthorized: Configuration changes restricted to Finance Administrators.");
            return;
        }
        setIsSaving(true);
        try {
            const { data, error } = await supabase.rpc('save_finance_governance_settings', {
                p_branch_id: branchId,
                p_tax_enabled: localSettings.tax_enabled || false,
                p_installment_strict_mode: localSettings.installment_strict_mode || false,
                p_late_fee_enabled: localSettings.late_fee_enabled || false,
                p_ledger_lock_date: localSettings.ledger_lock_date || null
            });

            if (error) throw error;

            if (data?.success) {
                // Success feedback
                onUpdate();
                // You could show a toast here if a toast context is available
                alert("Governance settings saved successfully and audit logs created.");
            } else {
                throw new Error(data?.error || "Save failed");
            }
        } catch (err: any) {
            console.error("Global Save Failed:", err.message);
            alert("Error: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSyncStudents = async () => {
        if (!branchId || isSyncing) return;
        if (!canModify) {
            alert("Unauthorized: Database synchronization requires administrative clearance.");
            return;
        }
        setIsSyncing(true);
        try {
            const { data, error } = await supabase.rpc('fn_sync_student_finance_profiles', {
                p_branch_id: branchId
            });

            if (error) throw error;

            // Optional: Notification or refresh
            console.log("Sync Result:", data);

            // You might want to trigger a refresh or show a toast here
            onUpdate();
        } catch (err: any) {
            console.error("Sync Failed:", err.message);
            // Handle error (show toast)
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Header / Intro */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-serif font-black text-white uppercase tracking-tight mb-2">Finance Master Control</h2>
                    <p className="text-sm text-white/40 font-medium">Configure institutional protocols, policies, fee structures, and compliance frameworks.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleSyncStudents}
                        disabled={isSyncing}
                        className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-400 transition-all flex items-center gap-2"
                    >
                        {isSyncing ? (
                            <>
                                <div className="w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                                Syncing...
                            </>
                        ) : (
                            <>
                                <SparklesIcon className="w-4 h-4" />
                                Sync Student Database
                            </>
                        )}
                    </button>
                    <button className="px-4 py-2 bg-white/[0.03] border border-white/10 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all">
                        History
                    </button>
                    <button className="px-4 py-2 bg-white/[0.03] border border-white/10 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all">
                        Audit
                    </button>
                    <button
                        onClick={handleGlobalSave}
                        disabled={isSaving || !canModify}
                        className={`px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 ${(isSaving || !canModify) ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                    >
                        {!canModify && <div className="w-3 h-3 border border-white/20 rounded-full flex items-center justify-center text-[8px] font-bold">L</div>}
                        {isSaving ? (
                            <>
                                <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                Saving...
                            </>
                        ) : 'Global Save'}
                    </button>
                </div>
            </div>

            {/* Stacked Smart Cards */}
            <FoundationGovernanceCard
                settings={localSettings}
                branchId={branchId}
                onUpdate={onUpdate}
                onChange={handleSettingChange}
                isSaving={isSaving}
                canModify={canModify} // Pass down RBAC state
            />

            <InstitutionalFeeStructureCard
                structures={feeStructures}
                currency={currency}
                onRefresh={onUpdate}
                branchId={branchId}
            />

            <PaymentPlanProtocolCard
                protocols={paymentProtocols}
                onRefresh={onUpdate}
                branchId={branchId}
            />

            <DiscountWaiverCard
                rules={adjustmentRules}
                onRefresh={onUpdate}
                branchId={branchId}
            />

            <FiscalTaxMatrixCard
                taxes={taxes}
                onRefresh={onUpdate}
                branchId={branchId}
            />

            <div className="h-24"></div> {/* Spacer */}
        </div >
    );
};

export default MasterControlPanel;
