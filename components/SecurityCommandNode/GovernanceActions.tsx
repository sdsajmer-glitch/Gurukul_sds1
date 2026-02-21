import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlertIcon } from '../icons/ShieldAlertIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { XIcon } from '../icons/XIcon';

interface ActionNode {
    id: 'restrict' | 'suspend' | 'expel';
    title: string;
    description: string;
    level: string;
    icon: React.ReactNode;
}

const GovernanceActions: React.FC = () => {
    const [confirmAction, setConfirmAction] = useState<'restrict' | 'suspend' | 'expel' | null>(null);

    const actions: ActionNode[] = [
        { id: 'restrict', title: 'Restrict Access (Temporary)', description: 'Limit account access to core functions.', level: 'Tier 1', icon: <AlertTriangleIcon className="w-4 h-4" /> },
        { id: 'suspend', title: 'Account Suspension', description: 'Immediate access lockdown. All sessions will be signed out.', level: 'Tier 2', icon: <ShieldAlertIcon className="w-4 h-4" /> },
        { id: 'expel', title: 'Permanently Delete', description: 'Move record to permanent archive and delete access.', level: 'Critical', icon: <TrashIcon className="w-4 h-4" /> }
    ];

    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-8 py-5 border-b border-white/5 bg-white/[0.01]">
                <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Access Control Actions</h3>
            </div>

            <div className="p-4 space-y-3">
                {actions.map((action) => (
                    <div key={action.id} className="p-5 bg-black/10 border border-white/5 rounded-xl flex items-center justify-between transition-all hover:border-white/10">
                        <div className="flex items-center gap-5">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${action.id === 'restrict' ? 'bg-amber-500/5 border-amber-500/10 text-amber-500' :
                                action.id === 'suspend' ? 'bg-orange-500/5 border-orange-500/10 text-orange-500' :
                                    'bg-red-500/5 border-red-500/10 text-red-500'
                                }`}>
                                {action.icon}
                            </div>
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-3">
                                    <h5 className="text-[12px] font-bold text-white uppercase tracking-wider">{action.title}</h5>
                                    <span className="px-1.5 py-0.5 bg-white/5 text-[8px] font-bold text-white/30 uppercase tracking-widest rounded">{action.level}</span>
                                </div>
                                <p className="text-[10px] font-medium text-white/20 uppercase tracking-widest italic truncate max-w-[280px] lg:max-w-md">
                                    {action.description}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setConfirmAction(action.id)}
                            className={`px-4 py-2 border text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all ${action.id === 'expel' ? 'border-red-500/20 text-red-500/60 hover:bg-red-500 hover:text-white' : 'border-white/10 text-white/40 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            Execute
                        </button>
                    </div>
                ))}
            </div>

            <AnimatePresence>
                {confirmAction && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-8"
                    >
                        <motion.div
                            initial={{ scale: 0.98, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.98, opacity: 0 }}
                            className="max-w-md w-full bg-[#1c1f26] border border-white/10 rounded-2xl p-8 shadow-2xl space-y-8"
                        >
                            <div className="space-y-4">
                                <h4 className="text-[16px] font-bold text-white uppercase tracking-tight flex items-center gap-3">
                                    <AlertTriangleIcon className="w-5 h-5 text-red-500" /> Confirm Action
                                </h4>
                                <p className="text-[12px] font-medium text-white/40 leading-relaxed italic">
                                    Executing the <span className="text-white font-bold">{confirmAction.toUpperCase()}</span> process will update this record. Administrative approval is required.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <textarea
                                    placeholder="Enter administrative justification..."
                                    className="w-full p-4 bg-black/40 border border-white/5 rounded-xl text-[11px] text-white focus:ring-1 focus:ring-red-500/30 outline-none h-24 resize-none italic"
                                />
                                <div className="flex gap-4">
                                    <button onClick={() => setConfirmAction(null)} className="flex-1 py-3 border border-white/10 rounded-xl text-[10px] font-bold text-white/40 uppercase tracking-widest hover:bg-white/5 transition-all">Cancel</button>
                                    <button className="flex-1 py-3 bg-red-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-red-600/20">Confirm & Apply</button>
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
