import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TeacherExtended } from '../../types';
import SecuritySummaryHeader from './SecuritySummaryHeader';
import AuthenticationMatrix from './AuthenticationMatrix';
import SessionControlPanel from './SessionControlPanel';
import GovernanceActions from './GovernanceActions';
import SecurityTimeline from './SecurityTimeline';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { ActivityIcon } from '../icons/ActivityIcon';

interface SecurityCommandNodeProps {
    teacher: TeacherExtended;
}

const SecurityCommandNode: React.FC<SecurityCommandNodeProps> = ({ teacher }) => {
    const [isMobileTimelineOpen, setIsMobileTimelineOpen] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-8 w-full max-w-[1440px] mx-auto pb-32"
        >
            {/* 🏫 SECTION HEADER LAYER */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 px-2">
                <div className="space-y-1">
                    <div className="flex items-center gap-3 opacity-40">
                        <div className="w-8 h-px bg-primary/40" />
                        <span className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Security Management</span>
                    </div>
                    <h2 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Security.</h2>
                    <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em]">Manage administrative access and login history.</p>
                </div>

                <div className="flex items-center gap-4 bg-white/[0.02] border border-white/5 rounded-xl px-5 py-3 shadow-inner">
                    <div className="flex flex-col text-right">
                        <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">System Status</span>
                        <span className="text-[11px] font-black text-emerald-500 uppercase tracking-widest">System Verified</span>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                        <ActivityIcon className="w-4 h-4" />
                    </div>
                </div>
            </div>

            {/* 🏫 SUMMARY STRIP (Horizontal) */}
            <SecuritySummaryHeader
                status="Active"
                mfaEnabled={true}
                riskScore="Low"
                activeSessions={3}
                lastLogin="Alpha Sector / 2h ago"
                deviceCount={4}
            />

            {/* 🏫 MAIN OPERATIONAL GRID (7/3 Split) */}
            <div className="grid grid-cols-12 gap-8 items-start px-1">

                {/* 8-COLUMN MAIN CONTENT (70% weight approx) */}
                <div className="col-span-12 xl:col-span-8 space-y-8">

                    {/* Layer 2: Active Sessions (Data-grid style) */}
                    <div className="transition-all duration-200 hover:translate-y-[-4px]">
                        <SessionControlPanel />
                    </div>

                    {/* Layer 3: Authentication Constraints */}
                    <div className="transition-all duration-200 hover:translate-y-[-4px]">
                        <AuthenticationMatrix
                            lastPasswordChange="Jan 12, 2024"
                            failedAttempts={0}
                            onResetCredentials={() => alert('Credential reset initiated.')}
                            onSuspendGateway={() => alert('System access suspension authorized.')}
                        />
                    </div>

                    {/* Layer 4: Access Control Actions (Restrained Danger Zone) */}
                    <div className="transition-all duration-200 hover:translate-y-[-4px]">
                        <GovernanceActions />
                    </div>
                </div>

                {/* 4-COLUMN AUXILIARY PANEL (30% weight approx) */}
                <div className="hidden xl:block xl:col-span-4 h-full">
                    <div className="sticky top-8 h-[calc(100vh-280px)] min-h-[680px] transition-all duration-200 hover:translate-y-[-4px]">
                        <SecurityTimeline />
                    </div>
                </div>

                {/* Mobile Tablet Accordion (Single Column Stacking) */}
                <div className="col-span-12 xl:hidden">
                    <div className="bg-[#14161c] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                        <button
                            onClick={() => setIsMobileTimelineOpen(!isMobileTimelineOpen)}
                            className="w-full p-6 flex items-center justify-between group bg-white/[0.01]"
                        >
                            <div className="flex items-center gap-4">
                                <ActivityIcon className="w-4 h-4 text-white/20 group-hover:text-primary transition-colors" />
                                <h4 className="text-[13px] font-bold text-white uppercase tracking-wider">Security Logs</h4>
                            </div>
                            <motion.div
                                animate={{ rotate: isMobileTimelineOpen ? 180 : 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            >
                                <ChevronDownIcon className="w-4 h-4 text-white/20" />
                            </motion.div>
                        </button>
                        <AnimatePresence initial={false}>
                            {isMobileTimelineOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 620, opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                    className="border-t border-white/5"
                                >
                                    <SecurityTimeline />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Footer Metadata */}
            <div className="flex items-center justify-between px-6 opacity-20 pt-8 border-t border-white/5">
                <p className="text-[9px] font-bold text-white uppercase tracking-[0.4em]">System Version: 9.099</p>
                <div className="flex gap-10">
                    <p className="text-[9px] font-bold text-white uppercase tracking-[0.4em]">GDPR / NIST COMPLIANT</p>
                    <p className="text-[9px] font-bold text-white uppercase tracking-[0.4em]">Audit Signature: {teacher.id.slice(0, 12).toUpperCase()}</p>
                </div>
            </div>
        </motion.div>
    );
};

export default SecurityCommandNode;
