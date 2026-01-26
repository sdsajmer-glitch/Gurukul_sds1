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
            { id: 1, title: 'Master Architect', desc: 'Define grade-specific fee structures with periodic components.', icon: <BookIcon className="w-5 h-5"/> },
            { id: 2, title: 'Ledger Handshake', desc: 'Assign structures to student nodes to initialize their debt registry.', icon: <KeyIcon className="w-5 h-5"/> },
        ]
    },
    {
        phase: "Phase 2: Operations",
        color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
        items: [
            { id: 3, title: 'Settlement Node', desc: 'Record payments from parents against specific invoices or as advances.', icon: <CreditCardIcon className="w-5 h-5"/> },
            { id: 4, title: 'Forensic Reconcile', desc: 'Database triggers rebuild summary accounts on every settlement pulse.', icon: <ShieldCheckIcon className="w-5 h-5"/> },
        ]
    },
    {
        phase: "Phase 3: Institutional Health",
        color: "bg-purple-500/10 border-purple-500/20 text-purple-400",
        items: [
            { id: 5, title: 'Disbursement Sync', desc: 'Log institutional expenses and archive receipt artifacts.', icon: <BriefcaseIcon className="w-5 h-5"/> },
            { id: 6, title: 'Audit Analytics', desc: 'Real-time monitoring of collection rates and liquidity burn.', icon: <ActivityIcon className="w-5 h-5"/> },
        ]
    }
];

const FinanceWorkflowGuide: React.FC<FinanceWorkflowGuideProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[500] flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#0c0d12] w-full max-w-5xl rounded-[3.5rem] shadow-[0_120px_240px_-40px_rgba(0,0,0,1)] border border-white/10 flex flex-col overflow-hidden max-h-[90vh] ring-1 ring-white/5" 
                onClick={e => e.stopPropagation()}
            >
                <div className="p-10 border-b border-white/5 bg-white/[0.02] flex justify-between items-start">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary border border-primary/20 shadow-inner">
                                <SparklesIcon className="w-5 h-5" />
                            </div>
                            <h2 className="text-3xl font-serif font-black text-white tracking-tighter uppercase leading-none">EQUILIBRIUM <span className="text-white/20 italic">PROTOCOL.</span></h2>
                        </div>
                        <p className="text-white/40 mt-2 font-medium font-serif italic text-lg leading-relaxed">End-to-End Institutional Capital Orchestration Guide.</p>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all border border-transparent hover:border-white/10"><XIcon className="w-6 h-6"/></button>
                </div>

                <div className="flex-grow overflow-y-auto p-12 bg-transparent custom-scrollbar space-y-16">
                    {steps.map((section, idx) => (
                        <div key={idx} className="relative">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="h-px flex-grow bg-white/5" />
                                <h3 className="text-[11px] font-black text-white/30 uppercase tracking-[0.5em] whitespace-nowrap">{section.phase}</h3>
                                <div className="h-px flex-grow bg-white/5" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {section.items.map((step) => (
                                    <div key={step.id} className={`p-8 rounded-[2.8rem] border transition-all duration-700 group relative overflow-hidden bg-white/[0.01] ${section.color} hover:bg-white/[0.04] hover:-translate-y-1 shadow-2xl`}>
                                        <div className="flex items-start justify-between mb-6 relative z-10">
                                            <div className="p-4 bg-black/40 rounded-2xl shadow-inner border border-white/5 group-hover:scale-110 transition-transform duration-700">
                                                {step.icon}
                                            </div>
                                            <span className="text-6xl font-serif font-black opacity-5 absolute right-4 top-2 select-none italic">{step.id}</span>
                                        </div>
                                        <h4 className="font-bold text-xl text-white mb-3 uppercase tracking-tight">{step.title}</h4>
                                        <p className="text-sm opacity-60 leading-relaxed font-medium font-serif italic">{step.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    
                    <div className="p-10 bg-primary/5 rounded-[3rem] border border-primary/20 flex flex-col md:flex-row items-center gap-10 relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000"><ShieldCheckIcon className="w-48 h-48 text-primary" /></div>
                         <div className="p-5 bg-primary/10 rounded-[2rem] text-primary border border-primary/20 shadow-2xl ring-8 ring-primary/5 group-hover:rotate-12 transition-all duration-700">
                             <ShieldCheckIcon className="w-8 h-8"/>
                         </div>
                         <div className="relative z-10 flex-grow text-center md:text-left">
                             <h4 className="font-bold text-xl text-white tracking-tight uppercase">Registry Integrity Engine</h4>
                             <p className="text-base text-white/40 mt-3 leading-loose max-w-2xl font-serif italic">
                                 Gurukul OS utilizes a forensic reconciliation engine that rebuilds student ledger summary nodes on every settlement heartbeat. This ensures that billed vs paid vs outstanding values are always in perfect equilibrium with raw transaction data.
                             </p>
                         </div>
                    </div>
                </div>
                
                <div className="p-10 border-t border-white/5 bg-black/40 text-center">
                    <p className="text-[9px] font-black uppercase tracking-[0.8em] text-white/5"> Institutional Grade Finance Node v25.0 Deployment Framework</p>
                </div>
            </motion.div>
        </div>
    );
};

export default FinanceWorkflowGuide;