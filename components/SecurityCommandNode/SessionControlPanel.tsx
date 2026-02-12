import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrashIcon } from '../icons/TrashIcon';
import { MonitorIcon } from '../icons/MonitorIcon';
import { SmartphoneIcon } from '../icons/SmartphoneIcon';
import { MapPinIcon } from '../icons/MapPinIcon';

interface Session {
    id: string;
    device: string;
    type: 'desktop' | 'mobile';
    location: string;
    lastActive: string;
    isCurrent: boolean;
}

const mockSessions: Session[] = [
    { id: '1', device: 'MacBook Pro 16" - Chrome/macOS', type: 'desktop', location: '103.xxx.xxx.xxx (Alpha Sector)', lastActive: 'Active Now', isCurrent: true },
    { id: '2', device: 'iPhone 15 Pro - App/iOS', type: 'mobile', location: '103.xxx.xxx.xxx (Mobile Uplink)', lastActive: '12m ago', isCurrent: false },
    { id: '3', device: 'Windows PC - Edge/Windows', type: 'desktop', location: '122.xxx.xxx.xxx (Remote Terminal)', lastActive: '4h ago', isCurrent: false }
];

const SessionControlPanel: React.FC = () => {
    return (
        <div className="p-12 bg-[#0a0b10] border border-white/5 rounded-[4rem] shadow-3xl space-y-12">
            <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-3 opacity-40">
                        <div className="w-8 h-0.5 bg-primary"></div>
                        <span className="text-[10px] font-black text-white uppercase tracking-[0.5em]">Session Control Panel</span>
                    </div>
                    <h3 className="text-3xl font-serif font-black text-white uppercase tracking-tighter italic">Live Handshakes.</h3>
                </div>
                <button className="px-6 py-2.5 bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-red-500 hover:text-white transition-all">
                    Global De-Auth (Emergency)
                </button>
            </div>

            <div className="space-y-6">
                {mockSessions.map((session) => (
                    <motion.div
                        key={session.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`p-8 rounded-[2.5rem] border flex items-center justify-between group h-full relative overflow-hidden transition-all ${session.isCurrent ? 'bg-primary/5 border-primary/20 shadow-primary/5' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}
                    >
                        {session.isCurrent && (
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary shadow-[0_0_20px_#3b82f6]" />
                        )}

                        <div className="flex items-center gap-8">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border ${session.isCurrent ? 'bg-primary/10 border-primary/20 text-primary shadow-inner' : 'bg-white/[0.05] border-white/10 text-white/30'}`}>
                                {session.type === 'desktop' ? <MonitorIcon className="w-7 h-7" /> : <SmartphoneIcon className="w-7 h-7" />}
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-4">
                                    <h4 className="text-sm font-black text-white uppercase tracking-widest leading-none translate-y-0.5">{session.device}</h4>
                                    {session.isCurrent && (
                                        <span className="px-3 py-1 bg-primary text-white text-[8px] font-black uppercase tracking-widest rounded-lg">CURRENT_NODE</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-6 text-[10px] font-bold text-white/20 uppercase tracking-widest">
                                    <div className="flex items-center gap-2">
                                        <MapPinIcon className="w-3.5 h-3.5" /> {session.location}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ActivityIcon className="w-3.5 h-3.5" /> {session.lastActive}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {!session.isCurrent && (
                            <button className="p-5 rounded-2xl bg-white/[0.02] text-white/10 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 translate-x-10 group-hover:translate-x-0 duration-500 border border-transparent hover:border-red-500/20">
                                <TrashIcon className="w-6 h-6" />
                            </button>
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default SessionControlPanel;
