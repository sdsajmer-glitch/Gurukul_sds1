import React from 'react';
import { motion } from 'framer-motion';
import { XIcon } from '../icons/XIcon';
import { BookIcon } from '../icons/BookIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { CreditCardIcon } from '../icons/CreditCardIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { KeyIcon } from '../icons/KeyIcon';

interface FinanceWorkflowGuideProps {
    onClose: () => void;
}

const steps = [
    {
        phase: "Phase 1: Architecture",
        color: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
        items: [
            { id: 1, title: 'Master Architect', desc: 'Define grade-specific fee structures with periodic components.', icon: <BookIcon className="w-5 h-5" /> },
            { id: 2, title: 'Fee Setup', desc: 'Assign structures to student profiles to initialize their account.', icon: <KeyIcon className="w-5 h-5" /> },
        ]
    },
    {
        phase: "Phase 2: Operations",
        color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
        items: [
            { id: 3, title: 'Settlement Node', desc: 'Record payments from parents against specific invoices or as advances.', icon: <CreditCardIcon className="w-5 h-5" /> },
            { id: 4, title: 'Forensic Reconcile', desc: 'Database triggers rebuild summary accounts on every settlement pulse.', icon: <ShieldCheckIcon className="w-5 h-5" /> },
        ]
    },
    {
        phase: "Phase 3: Institutional Health",
        color: "bg-purple-500/10 border-purple-500/20 text-purple-400",
        items: [
            { id: 5, title: 'Disbursement Sync', desc: 'Log institutional expenses and archive receipt artifacts.', icon: <BriefcaseIcon className="w-5 h-5" /> },
            { id: 6, title: 'Audit Analytics', desc: 'Real-time monitoring of collection rates and liquidity burn.', icon: <ActivityIcon className="w-5 h-5" /> },
        ]
    }
];

const FinanceWorkflowGuide: React.FC<FinanceWorkflowGuideProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/98 backdrop-blur-3xl z-[500] flex items-center justify-center p-6 animate-in fade-in duration-500" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "circOut" }}
                className="bg-[#0c0d12] w-full max-w-6xl rounded-[4rem] shadow-[0_120px_240px_-60px_rgba(0,0,0,1)] border border-white/10 flex flex-col overflow-hidden max-h-[92vh] ring-1 ring-white/10 relative"
                onClick={e => e.stopPropagation()}
            >
                {/* Background Ambient Artifacts */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                <div className="p-14 border-b border-white/[0.04] bg-white/[0.01] backdrop-blur-3xl flex justify-between items-start relative z-10 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.04] to-transparent pointer-events-none"></div>
                    <div className="space-y-4 relative z-10">
                        <div className="flex items-center gap-5">
                            <div className="p-4 bg-primary/10 rounded-2xl text-primary border border-primary/20 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                                <SparklesIcon className="w-7 h-7" />
                            </div>
                            <h2 className="text-4xl font-serif font-black text-white tracking-tighter uppercase leading-none">EQUILIBRIUM <span className="text-white/20 italic">PROTOCOL.</span></h2>
                        </div>
                        <p className="text-white/40 font-medium font-serif italic text-xl leading-relaxed max-w-2xl">End-to-End School Capital Management & Security Framework.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-4 rounded-2xl hover:bg-white/5 text-white/20 hover:text-white transition-all border border-transparent hover:border-white/10 group active:scale-90"
                    >
                        <XIcon className="w-8 h-8 group-hover:rotate-90 transition-transform duration-500" />
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto p-14 bg-transparent custom-scrollbar space-y-20 relative z-10">
                    {steps.map((section, idx) => (
                        <div key={idx} className="relative">
                            <div className="flex items-center gap-8 mb-12">
                                <div className="h-px w-20 bg-gradient-to-r from-transparent to-white/10" />
                                <h3 className="text-[12px] font-black text-white/30 uppercase tracking-[0.6em] whitespace-nowrap">{section.phase}</h3>
                                <div className="h-px flex-grow bg-gradient-to-l from-transparent to-white/10" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                {section.items.map((step) => (
                                    <div key={step.id} className={`p-10 rounded-[3.5rem] border transition-all duration-700 group relative overflow-hidden bg-white/[0.01] ${section.color} hover:bg-white/[0.04] hover:-translate-y-2 shadow-3xl`}>
                                        <div className="flex items-start justify-between mb-8 relative z-10">
                                            <div className="p-5 bg-black/60 rounded-[1.5rem] shadow-inner border border-white/5 group-hover:scale-110 group-hover:border-white/20 transition-all duration-700">
                                                <div className="group-hover:text-white transition-colors">
                                                    {step.icon}
                                                </div>
                                            </div>
                                            <span className="text-8xl font-serif font-black opacity-[0.03] absolute right-0 top-0 select-none italic group-hover:opacity-[0.06] transition-opacity">{step.id}</span>
                                        </div>
                                        <h4 className="font-serif font-black text-2xl text-white mb-4 uppercase tracking-tight group-hover:text-primary transition-colors">{step.title}</h4>
                                        <p className="text-base text-white/40 leading-relaxed font-serif italic group-hover:text-white/60 transition-colors">{step.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div className="p-14 bg-primary/[0.02] rounded-[4rem] border border-primary/20 flex flex-col md:flex-row items-center gap-14 relative overflow-hidden group shadow-3xl">
                        <div className="absolute -top-20 -right-20 p-20 opacity-[0.02] group-hover:scale-125 transition-all duration-[2000ms] rotate-12"><ShieldCheckIcon className="w-80 h-80 text-primary" /></div>
                        <div className="p-8 bg-primary/10 rounded-[2.5rem] text-primary border border-primary/20 shadow-[0_0_50px_rgba(59,130,246,0.2)] ring-[16px] ring-primary/5 group-hover:rotate-12 transition-all duration-1000">
                            <ShieldCheckIcon className="w-10 h-10" />
                        </div>
                        <div className="relative z-10 flex-grow text-center md:text-left space-y-4">
                            <h4 className="font-serif font-black text-3xl text-white tracking-tighter uppercase">Registry Integrity Engine</h4>
                            <p className="text-lg text-white/30 leading-loose max-w-3xl font-serif italic">
                                Universepi OS utilizes a forensic reconciliation engine that rebuilds student ledger summary nodes on every settlement heartbeat. This ensures that billed vs paid vs outstanding values are always in perfect equilibrium with raw transaction data.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-10 border-t border-white/5 bg-black/60 text-center relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.8em] text-white/20 whitespace-nowrap"> INSTITUTIONAL GRADE FINANCE NODE V25.0 DEPLOYMENT FRAMEWORK • AUTHORITATIVE DOCUMENTATION</p>
                </div>
            </motion.div>
        </div>
    );
};

export default FinanceWorkflowGuide;