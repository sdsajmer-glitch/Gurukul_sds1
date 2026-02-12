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

const SecurityModuleWrapper: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, icon, children, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="bg-white/[0.01] border border-white/5 rounded-[3.5rem] overflow-hidden transition-all duration-500 hover:border-white/10">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-10 flex items-center justify-between group md:hidden"
            >
                <div className="flex items-center gap-6">
                    <div className="p-3 rounded-xl bg-white/[0.03] text-white/20 group-hover:text-primary transition-all">
                        {icon}
                    </div>
                    <h4 className="text-xl font-serif font-black text-white uppercase tracking-tighter italic">{title}</h4>
                </div>
                <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
                    <ChevronDownIcon className="w-6 h-6 text-white/20" />
                </motion.div>
            </button>
            <div className="hidden md:block">
                {children}
            </div>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="md:hidden"
                    >
                        <div className="p-2 pt-0">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const SecurityCommandNode: React.FC<SecurityCommandNodeProps> = ({ teacher }) => {
    const [isTimelineVisible, setIsTimelineVisible] = useState(true);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-12 pb-24"
        >
            {/* Layer 1: Security Summary Header */}
            <SecuritySummaryHeader
                status="Active"
                mfaEnabled={true}
                riskScore="Low"
                activeSessions={3}
                lastLogin="Alpha Sector / 2h ago"
            />

            {/* Main Operational Grid */}
            <div className={`grid grid-cols-1 ${isTimelineVisible ? 'xl:grid-cols-3' : 'xl:grid-cols-1'} gap-12 px-2 transition-all duration-700`}>

                {/* Left Columns - Prime Operations */}
                <div className={`${isTimelineVisible ? 'xl:col-span-2' : 'xl:col-span-1'} space-y-12`}>

                    {/* Layer 2: Authentication Matrix */}
                    <SecurityModuleWrapper title="Cred Registry" icon={<ActivityIcon className="w-5 h-5" />}>
                        <AuthenticationMatrix
                            lastPasswordChange="Jan 12, 2024"
                            failedAttempts={0}
                            onResetCredentials={() => alert('Credential reset protocol initiated.')}
                            onSuspendGateway={() => alert('Gateway suspension protocol pending confirmation.')}
                        />
                    </SecurityModuleWrapper>

                    {/* Layer 3: Session & Device Control */}
                    <SecurityModuleWrapper title="Live Handshakes" icon={<ActivityIcon className="w-5 h-5" />}>
                        <SessionControlPanel />
                    </SecurityModuleWrapper>

                    {/* Layer 4: Governance Actions Panel */}
                    <SecurityModuleWrapper title="Revocation Protocol" icon={<ActivityIcon className="w-5 h-5" />}>
                        <GovernanceActions />
                    </SecurityModuleWrapper>
                </div>

                {/* Right Column - Audit & Intelligence */}
                <div className={`h-full ${isTimelineVisible ? 'block' : 'hidden'}`}>
                    {/* Layer 5: Activity Timeline Intelligence */}
                    <div className="sticky top-12 h-[calc(100vh-150px)] min-h-[600px]">
                        <div className="h-full relative">
                            {/* Collapse Button for Timeline on Desktop */}
                            <button
                                onClick={() => setIsTimelineVisible(false)}
                                className="absolute -left-16 top-10 p-3 bg-white/5 border border-white/10 rounded-xl text-white/20 hover:text-white hover:bg-white/10 transition-all hidden xl:flex"
                            >
                                <ChevronDownIcon className="w-5 h-5 rotate-90" />
                            </button>
                            <SecurityTimeline />
                        </div>
                    </div>
                </div>

                {/* Re-open timeline toggle if hidden */}
                {!isTimelineVisible && (
                    <button
                        onClick={() => setIsTimelineVisible(true)}
                        className="fixed right-10 bottom-10 p-6 bg-primary text-white rounded-full shadow-3xl z-50 animate-bounce"
                    >
                        <ActivityIcon className="w-6 h-6" />
                    </button>
                )}

                {/* Mobile Tablet Timeline Trigger (if collapsed) */}
                <div className="xl:hidden">
                    <button
                        onClick={() => setIsTimelineVisible(!isTimelineVisible)}
                        className="w-full py-6 bg-white/[0.02] border border-white/5 rounded-3xl text-[10px] font-black text-white/20 uppercase tracking-[0.4em] flex items-center justify-center gap-4"
                    >
                        <ActivityIcon className="w-5 h-5" /> {isTimelineVisible ? 'Hide Forensic Log' : 'Show Forensic Log'}
                    </button>
                    {isTimelineVisible && <div className="mt-12 h-[600px]"><SecurityTimeline /></div>}
                </div>
            </div>
        </motion.div>
    );
};

export default SecurityCommandNode;
