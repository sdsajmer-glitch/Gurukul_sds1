import React, { useState } from 'react';
import { motion } from 'framer-motion';
import FoundationGovernanceCard from './master/FoundationGovernanceCard';
import InstitutionalFeeStructureCard from './master/InstitutionalFeeStructureCard';
import PaymentPlanProtocolCard from './master/PaymentPlanProtocolCard';
import DiscountWaiverCard from './master/DiscountWaiverCard';
import FiscalTaxMatrixCard from './master/FiscalTaxMatrixCard';
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
    onNewTax,
    onUpdate
}) => {

    // Extract data from masterState
    const settings = masterState?.settings || {};
    const taxes = masterState?.taxes || [];
    // approavls can be added later

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Header / Intro */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-serif font-black text-white uppercase tracking-tight mb-2">Finance Master Control</h2>
                    <p className="text-sm text-white/40 font-medium">Configure institutional protocols, policies, fee structures, and compliance frameworks.</p>
                </div>
                <div className="flex gap-3">
                    <button className="px-4 py-2 bg-white/[0.03] border border-white/10 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all">
                        History
                    </button>
                    <button className="px-4 py-2 bg-white/[0.03] border border-white/10 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all">
                        Audit
                    </button>
                    <button className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg">
                        Global Save
                    </button>
                </div>
            </div>

            {/* Stacked Smart Cards */}
            <FoundationGovernanceCard
                settings={settings}
                branchId={branchId}
                onUpdate={onUpdate}
            />

            <InstitutionalFeeStructureCard
                structures={feeStructures}
                currency={currency}
                onNewStructure={onNewStructure}
                onEditStructure={onEditStructure}
            />

            <PaymentPlanProtocolCard
                protocols={paymentProtocols}
                onNewProtocol={onNewProtocol}
            />

            <DiscountWaiverCard
                rules={adjustmentRules}
                onNewRule={onNewRule}
            />

            <FiscalTaxMatrixCard
                taxes={taxes}
                onNewTax={onNewTax}
            />

            <div className="h-24"></div> {/* Spacer */}
        </div>
    );
};

export default MasterControlPanel;
