import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlertIcon } from '../icons/ShieldAlertIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { XIcon } from '../icons/XIcon';

const GovernanceActions: React.FC = () => {
    const [confirmAction, setConfirmAction] = useState<'restrict' | 'suspend' | 'expel' | null>(null);

    const actions = [
        { id: 'restrict', title: 'Restrict Access (Temporary)', description: 'Limit node accessibility to primary core functions only. 24h grace period for verification.', severity: 'Amber', icon: <AlertTriangleIcon className="w-5 h-5" /> },
        { id: 'suspend', title: 'Institutional Suspension', description: 'Immediate gateway lockdown. All active sessions invalidated. Re-auth requires manual admin override.', severity: 'High', icon: <ShieldAlertIcon className="w-5 h-5" /> },
        { id: 'expel', title: 'Access Revocation (Expulsion)', description: 'Final resignation protocols and permanent record archival. This process is irreversible.', severity: 'Critical', icon: <TrashIcon className="w-5 h-5" /> }
    ];

    return (
        <div className="p-12 bg-red-950/5 border border-red-500/10 rounded-[4rem] shadow-3xl space-y-12 relative overflow-hidden group">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-red-500/5 blur-[100px] rounded-full group-hover:bg-red-500/10 transition-all duration-[3s]" />

            <div className="relative z-10 flex items-center justify-between">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-3 opacity-40">
                        <div className="w-8 h-0.5 bg-red-500"></div>
                        <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.5em]">Escalation Layer</span>
                    </div>
                    <h3 className="text-3xl font-serif font-black text-white uppercase tracking-tighter italic">Revocation Protocol.</h3>
                </div>
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500">
                    <ShieldAlertIcon className="w-6 h-6" />
                </div>
            </div>

            <div className="space-y-6 relative z-10">
                {actions.map((action) => (
                    <div key={action.id} className="p-10 bg-black/40 border border-white/5 rounded-[3.5rem] flex items-center justify-between group/action hover:border-red-500/30 transition-all shadow-2xl">
                        <div className="flex items-center gap-8">
                            <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center transition-all ${action.id === 'restrict' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                                    action.id === 'suspend' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' :
                                        'bg-red-500/10 border-red-500/20 text-red-500 group-hover/action:bg-red-500 group-hover/action:text-white'
                                }`}>
                                {action.icon}
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-4">
                                    <h5 className="text-sm font-black text-white uppercase tracking-widest">{action.title}</h5>
                                    <span className="px-3 py-1 bg-white/5 text-[8px] font-black text-white/30 uppercase tracking-widest rounded-lg">{action.severity}_SEVERITY</span>
                                </div>
                                <p className="text-[11px] font-bold text-white/20 uppercase tracking-[0.05em] leading-relaxed max-w-xl italic">
                                    {action.description}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setConfirmAction(action.id as any)}
                            className="px-8 ml-8 py-4 bg-white/[0.03] border border-white/5 text-white/40 text-[9px] font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-white/10 hover:text-white transition-all shadow-inner"
                        >
                            Execute Protocol
                        </button>
                    </div>
                ))}
            </div>

            <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.2em] relative z-10 italic">
                * All revocation actions are logged immediately for audit compliance. Secondary authorization may be required for Class 1 protocols.
            </p>

            <AnimatePresence>
                {confirmAction && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-8"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="max-w-xl w-full bg-[#0c0d12] border border-red-500/20 rounded-[4rem] p-16 shadow-[0_0_100px_rgba(239,68,68,0.1)] space-y-12 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-16 opacity-[0.03] pointer-events-none">
                                <AlertTriangleIcon className="w-48 h-48 text-red-500" />
                            </div>

                            <div className="space-y-6 relative z-10">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 rounded-[1.5rem] bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                                        <AlertTriangleIcon className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h4 className="text-3xl font-serif font-black text-white uppercase tracking-tighter italic">Confirm Execution.</h4>
                                        <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.4em]">Irreversible Governance Command</p>
                                    </div>
                                </div>
                                <p className="text-sm font-bold text-white/40 leading-relaxed italic">
                                    You are about to initiate the <span className="text-white font-black">{confirmAction.toUpperCase()}</span> protocol for this faculty node. This action will be logged under your administrative ID and cannot be rolled back via standard terminal commands.
                                </p>
                            </div>

                            <div className="space-y-6 relative z-10">
                                <textarea
                                    placeholder="Enter administrative justification for this override..."
                                    className="w-full p-8 bg-black/60 border border-white/5 rounded-[2rem] text-xs text-white/60 focus:ring-4 focus:ring-red-500/10 outline-none h-32 resize-none italic font-bold placeholder:text-white/10"
                                />
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setConfirmAction(null)}
                                        className="flex-grow py-5 border border-white/5 rounded-2xl text-[10px] font-black text-white/30 uppercase tracking-[0.3em] hover:bg-white/5 transition-all"
                                    >
                                        Abort Protocol
                                    </button>
                                    <button className="flex-grow py-5 bg-red-500 text-white rounded-2xl text-[10px] font-black text-white uppercase tracking-[0.3em] shadow-3xl shadow-red-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                                        Authorize & Execute
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default GovernanceActions;
