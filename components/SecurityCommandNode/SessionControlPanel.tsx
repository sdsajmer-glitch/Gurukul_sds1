import React from 'react';
import { motion } from 'framer-motion';
import { TrashIcon } from '../icons/TrashIcon';
import { MonitorIcon } from '../icons/MonitorIcon';
import { SmartphoneIcon } from '../icons/SmartphoneIcon';
import { MapPinIcon } from '../icons/MapPinIcon';
import { ActivityIcon } from '../icons/ActivityIcon';

interface Session {
    id: string;
    device: string;
    type: 'desktop' | 'mobile';
    location: string;
    lastActive: string;
    isCurrent: boolean;
}

const mockSessions: Session[] = [
    { id: '1', device: 'MacBook Pro 16" - Chrome/macOS', type: 'desktop', location: '103.xxx.xxx.xxx (Alpha)', lastActive: 'Active Now', isCurrent: true },
    { id: '2', device: 'iPhone 15 Pro - App/iOS', type: 'mobile', location: '103.xxx.xxx.xxx (Mobile)', lastActive: '12m ago', isCurrent: false },
    { id: '3', device: 'Windows PC - Edge/Windows', type: 'desktop', location: '122.xxx.xxx.xxx (Terminal)', lastActive: '4h ago', isCurrent: false }
];

const SessionControlPanel: React.FC = () => {
    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Active Sessions</h3>
                <button className="px-4 py-1.5 border border-red-500/20 text-red-500/60 text-[9px] font-bold uppercase tracking-widest rounded-lg hover:bg-red-500 hover:text-white transition-all">
                    Revoke All
                </button>
            </div>

            <div className="divide-y divide-white/5">
                {mockSessions.map((session) => (
                    <motion.div
                        key={session.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`px-8 py-3.5 flex items-center justify-between group h-14 transition-all hover:bg-white/[0.01] ${session.isCurrent ? 'bg-primary/5' : ''}`}
                    >
                        <div className="flex items-center gap-6 flex-1 min-w-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${session.isCurrent ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-white/[0.03] border-white/10 text-white/20'}`}>
                                {session.type === 'desktop' ? <MonitorIcon className="w-4 h-4" /> : <SmartphoneIcon className="w-4 h-4" />}
                            </div>

                            <div className="grid grid-cols-12 flex-1 gap-4 items-center min-w-0 text-[12px]">
                                <div className="col-span-5 min-w-0">
                                    <span className="font-bold text-white truncate block">{session.device}</span>
                                </div>
                                <div className="col-span-3 min-w-0 hidden md:block text-white/40 font-medium">
                                    <span className="truncate flex items-center gap-1.5 italic"><MapPinIcon className="w-3 h-3" /> {session.location}</span>
                                </div>
                                <div className="col-span-4 text-right pr-6 lg:pr-12 min-w-0">
                                    <span className="text-white/60 font-medium">{session.lastActive}</span>
                                </div>
                            </div>
                        </div>

                        <div className="w-24 flex justify-end">
                            {!session.isCurrent ? (
                                <button className="p-2.5 rounded-lg text-white/20 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            ) : (
                                <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em] px-2 py-0.5 bg-primary/10 rounded-md">ACTIVE</span>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default SessionControlPanel;
