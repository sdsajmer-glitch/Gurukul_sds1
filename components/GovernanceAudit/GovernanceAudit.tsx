import React from 'react';
import { motion } from 'framer-motion';
import { TeacherExtended } from '../../types';
import AuditSummaryStrip from './AuditSummaryStrip';
import AuditLogRegistry from './AuditLogRegistry';
import ComplianceScorecard from './ComplianceScorecard';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { ActivityIcon } from '../icons/ActivityIcon';

interface GovernanceAuditProps {
    teacher: TeacherExtended;
}

const GovernanceAudit: React.FC<GovernanceAuditProps> = ({ teacher }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-8 w-full max-w-[1440px] mx-auto pb-32"
        >
            {/* 🏫 SECTION HEADER LAYER */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 px-2">
                <div className="space-y-1">
                    <div className="flex items-center gap-3 opacity-40">
                        <div className="w-8 h-px bg-primary/40" />
                        <span className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Archives & Vault</span>
                    </div>
                    <h2 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Governance <span className="text-white/20 italic font-medium">Audit.</span></h2>
                    <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em]">Institutional Stewardship, Compliance Matrix & Immutable Ledger</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="px-4 py-2 bg-primary/5 border border-primary/10 rounded-xl flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">Watcher_Node Online</span>
                    </div>
                </div>
            </div>

            {/* 🏫 SUMMARY STRIP */}
            <AuditSummaryStrip
                integrityScore={98.5}
                auditCount={124}
                lastRevision="Today, 14:20"
                complianceStatus="ISO-27001_ACTIVE"
            />

            {/* 🏫 MAIN OPERATIONAL GRID (8/4 Split) */}
            <div className="grid grid-cols-12 gap-8 items-start px-1">

                {/* 8-COLUMN MAIN CONTENT (70% weight approx) */}
                <div className="col-span-12 xl:col-span-8 space-y-8">
                    <div className="transition-all duration-200 hover:translate-y-[-4px]">
                        <AuditLogRegistry />
                    </div>
                </div>

                {/* 4-COLUMN AUXILIARY PANEL (30% weight approx) */}
                <div className="hidden xl:block xl:col-span-4 h-full">
                    <div className="sticky top-8 space-y-8">
                        {/* Compliance Card */}
                        <div className="transition-all hover:translate-y-[-2px]">
                            <ComplianceScorecard />
                        </div>

                        {/* Stewardship Timeline / Authorization Node */}
                        <div className="p-10 bg-[#14161c] border border-white/5 rounded-[2.5rem] shadow-sm space-y-8 transition-all hover:translate-y-[-4px]">
                            <div className="flex items-center justify-between border-b border-white/5 pb-5">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary ring-1 ring-primary/20">
                                        <ShieldCheckIcon className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Authorization</h3>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <p className="text-[10px] font-medium text-white/20 uppercase tracking-widest leading-relaxed">
                                    Faculty record requires dual-governor authorization for Tier-1 attribute mutation.
                                </p>
                                <div className="pt-4 flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                    <span className="text-[10px] font-black text-white/10 uppercase tracking-widest">Awaiting Governor Key...</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default GovernanceAudit;
