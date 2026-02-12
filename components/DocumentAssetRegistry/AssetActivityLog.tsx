import React from 'react';
import { motion } from 'framer-motion';
import { ClockIcon } from '../icons/ClockIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { FileTextIcon } from '../icons/FileTextIcon';
import { RefreshCwIcon } from '../icons/RefreshCwIcon';

const activities = [
    { id: '1', type: 'ARCHIVE', title: 'Asset Archived', timestamp: '2h ago', details: 'PhD_Certification_Quantum.pdf encrypted and registered.', icon: <FileTextIcon className="w-3.5 h-3.5" />, color: 'text-primary' },
    { id: '2', type: 'VERIFY', title: 'Identity Verified', timestamp: 'Yesterday', details: 'Institutional check completed for Master_Degree.pdf', icon: <ShieldCheckIcon className="w-3.5 h-3.5" />, color: 'text-emerald-500' },
    { id: '3', type: 'UPDATE', title: 'Metadata Sync', timestamp: '3 days ago', details: 'Batch update performed on 4 document descriptors.', icon: <RefreshCwIcon className="w-3.5 h-3.5" />, color: 'text-amber-500' },
    { id: '4', type: 'ACCESS', title: 'Secure Access', timestamp: 'Jan 12', details: 'Admin retrieved and decrypted Experience_Record.pdf', icon: <ClockIcon className="w-3.5 h-3.5" />, color: 'text-white/40' }
];

const AssetActivityLog: React.FC = () => {
    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl h-full flex flex-col shadow-sm overflow-hidden">
            <div className="px-8 py-5 border-b border-white/5 bg-white/[0.01]">
                <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Vault Activity</h3>
                <p className="text-[10px] font-medium text-white/20 uppercase tracking-widest italic">Archival trace log</p>
            </div>

            <div className="flex-grow p-8 space-y-8 overflow-y-auto custom-scrollbar">
                {activities.map((activity, i) => (
                    <div key={activity.id} className="flex gap-5 relative group/item">
                        {i !== activities.length - 1 && (
                            <div className="absolute left-[17px] top-8 w-px h-[calc(100%+32px)] bg-white/5" />
                        )}

                        <div className={`w-9 h-9 rounded-lg border border-white/10 bg-white/[0.03] flex items-center justify-center shrink-0 z-10 transition-all group-hover/item:border-white/20 ${activity.color}`}>
                            {activity.icon}
                        </div>

                        <div className="space-y-1 min-w-0">
                            <div className="flex justify-between items-center gap-3">
                                <h5 className="text-[11px] font-bold text-white/80 uppercase tracking-tight truncate">{activity.title}</h5>
                                <span className="text-[9px] font-medium text-white/10 uppercase tracking-widest shrink-0">{activity.timestamp}</span>
                            </div>
                            <p className="text-[10px] font-medium text-white/20 leading-relaxed italic line-clamp-2">
                                {activity.details}
                            </p>
                            <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-white/20">
                                {activity.type}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-6 border-t border-white/5 bg-white/[0.01]">
                <button className="w-full py-4 bg-white/[0.02] border border-white/10 rounded-xl text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] hover:bg-white/5 hover:text-white transition-all">
                    Generate Audit Report
                </button>
            </div>
        </div>
    );
};

export default AssetActivityLog;
