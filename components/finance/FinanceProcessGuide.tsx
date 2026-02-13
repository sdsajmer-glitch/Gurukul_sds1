
import React from 'react';
import { motion } from 'framer-motion';
import { XIcon } from '../icons/XIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { TrendingUpCustomIcon as TrendingUpIcon } from '../icons/TrendingUpIcon';
import { CreditCardIcon } from '../icons/CreditCardIcon';
import { WorkflowIcon } from '../icons/WorkflowIcon';
import { ArrowRightIcon } from '../icons/ArrowRightIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';

interface FinanceProcessGuideProps {
    onClose: () => void;
}

const FinanceProcessGuide: React.FC<FinanceProcessGuideProps> = ({ onClose }) => {
    const steps = [
        {
            title: "Phase 1: Master Protocol Initialization",
            description: "Define institutional fee structures, components, and grade-wise mapping rules in the 'Master' console.",
            icon: <WorkflowIcon className="w-6 h-6" />,
            color: "text-blue-500",
            bg: "bg-blue-500/10"
        },
        {
            title: "Phase 2: Operational Ledger Generation",
            description: "Synchronize student nodes. The system automatically assigns fee protocols based on enrollment status and grade context.",
            icon: <ActivityIcon className="w-6 h-6" />,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10"
        },
        {
            title: "Phase 3: Transactional Execution",
            description: "Record settlements via UPI, Stripe, or Manual protocols. Every transaction generates a forensic receipt and immutable audit log.",
            icon: <CreditCardIcon className="w-6 h-6" />,
            color: "text-amber-500",
            bg: "bg-amber-500/10"
        },
        {
            title: "Phase 4: Matrix Reconciliation",
            description: "Run the 'Reconcile Matrix' to perform a real-time audit of liquidity, collection efficiency, and integrity scores.",
            icon: <ShieldCheckIcon className="w-6 h-6" />,
            color: "text-purple-500",
            bg: "bg-purple-500/10"
        }
    ];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12 overflow-hidden"
        >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl" onClick={onClose} />

            <motion.div
                initial={{ scale: 0.9, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, y: 20, opacity: 0 }}
                className="relative w-full max-w-5xl h-full max-h-[800px] bg-[#12141c] border border-white/10 rounded-[4rem] shadow-3xl overflow-hidden flex flex-col ring-1 ring-white/10"
            >
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 p-24 opacity-[0.03] pointer-events-none">
                    <WorkflowIcon className="w-96 h-96 text-primary" />
                </div>

                {/* Header */}
                <div className="p-12 border-b border-white/5 flex justify-between items-center relative z-10 bg-white/[0.01]">
                    <div>
                        <h2 className="text-4xl font-serif font-black text-white uppercase tracking-tight">Institutional <span className="text-primary italic">Process</span> Guide</h2>
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] mt-3 underline decoration-primary/40 underline-offset-8">Financial Operations Standard Operating Procedure</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-red-500/20 hover:text-red-500 transition-all active:scale-95"
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-12 space-y-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {steps.map((step, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="group p-10 bg-white/[0.02] border border-white/5 rounded-[3rem] hover:border-primary/20 transition-all relative overflow-hidden h-full"
                            >
                                <div className={`absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-700`}>
                                    {step.icon}
                                </div>
                                <div className="space-y-6 relative z-10">
                                    <div className={`p-5 w-fit rounded-2xl ${step.bg} ${step.color} border border-white/5`}>
                                        {step.icon}
                                    </div>
                                    <div className="space-y-3">
                                        <h4 className="text-xl font-serif font-black text-white uppercase tracking-tight">{step.title}</h4>
                                        <p className="text-sm text-white/40 leading-relaxed font-serif italic">{step.description}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Pro-Tip / Security Note */}
                    <div className="p-10 bg-amber-500/[0.03] border border-amber-500/20 rounded-[3rem] flex flex-col md:flex-row items-center gap-10">
                        <div className="p-6 bg-amber-500/10 rounded-3xl border border-amber-500/20">
                            <AlertTriangleIcon className="w-10 h-10 text-amber-500" />
                        </div>
                        <div className="space-y-2">
                            <h5 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">Governance Protocol Notice</h5>
                            <p className="text-white/60 font-serif italic">Always ensure that the <span className="text-white font-bold">Academic Cycle</span> is set to 'Active' before initiating ledger generation. Desynchronized cycles can lead to reconciliation magnitude errors.</p>
                        </div>
                        <button className="px-8 py-4 bg-white text-black font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl hover:bg-amber-100 transition-all whitespace-nowrap active:scale-95">
                            Verify Cycles
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-12 border-t border-white/5 bg-white/[0.01] flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4 text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">
                        <ShieldCheckIcon className="w-4 h-4 text-emerald-500/40" />
                        <span>System Version: 25.0.53 • Forensic Ledger Enabled</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-10 py-5 bg-primary text-white font-black text-[10px] uppercase tracking-[0.4em] rounded-2xl shadow-2xl hover:bg-primary/90 transition-all active:scale-95 ring-1 ring-white/20"
                    >
                        Acknowledge Protocol
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default FinanceProcessGuide;
