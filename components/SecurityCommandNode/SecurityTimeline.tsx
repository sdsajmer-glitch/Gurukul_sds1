import React from 'react';
import { motion } from 'framer-motion';
import { ClockIcon } from '../icons/ClockIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { ShieldAlertIcon } from '../icons/ShieldAlertIcon';
import { RefreshCwIcon } from '../icons/RefreshCwIcon';

interface SecurityEvent {
    id: string;
    type: 'success' | 'alert' | 'update' | 'critical';
    title: string;
    timestamp: string;
    details: string;
    severity: 'info' | 'warning' | 'critical';
}

const mockEvents: SecurityEvent[] = [
    { id: '1', type: 'success', title: 'Successful Uplink', timestamp: '2h ago', details: 'Authorized session established via Alpha Sector / Chrome-macOS', severity: 'info' },
    { id: '2', type: 'update', title: 'Credential Rotation', timestamp: 'Yesterday', details: 'Administrative password recalibration finalized via Secure Portal', severity: 'info' },
    { id: '3', type: 'alert', title: 'Auth Anomaly Detected', timestamp: '2 days ago', details: 'Blocked failed login attempt from unauthorized IP: 184.xx.xx.xx', severity: 'warning' },
    { id: '4', type: 'critical', title: 'MFA De-synchronization', timestamp: '1 week ago', details: 'Manual MFA reset performed by Lead Admin Security Protocol', severity: 'critical' },
    { id: '5', type: 'update', title: 'Device Enrollment', timestamp: 'Jan 24', details: 'New institutional device (iPhone 15 Pro) tethered to record', severity: 'info' }
];

const SecurityTimeline: React.FC = () => {
    return (
        <div className="p-10 bg-white/[0.01] border border-white/5 rounded-[3.5rem] shadow-3xl h-full flex flex-col group">
            <div className="flex items-center justify-between mb-12">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-3 opacity-40">
                        <div className="w-8 h-0.5 bg-violet-500"></div>
                        <span className="text-[10px] font-black text-white uppercase tracking-[0.5em]">Forensic Log Audit</span>
                    </div>
                    <h3 className="text-2xl font-serif font-black text-white uppercase tracking-tighter italic">Terminal History.</h3>
                </div>
                <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/10 text-violet-400">
                    <ClockIcon className="w-5 h-5" />
                </div>
            </div>

            <div className="flex-grow space-y-10 custom-scrollbar overflow-y-auto pr-4">
                {mockEvents.map((event, i) => (
                    <div key={event.id} className="flex gap-8 relative group/item">
                        {i !== mockEvents.length - 1 && (
                            <div className="absolute left-[23px] top-10 w-px h-[calc(100%+24px)] bg-white/5 transition-colors group-hover/item:bg-white/10" />
                        )}

                        <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 z-10 transition-all ${event.severity === 'info' ? 'bg-white/[0.02] border-white/5 text-white/20 group-hover/item:border-primary/40 group-hover/item:text-primary' :
                                event.severity === 'warning' ? 'bg-amber-500/5 border-amber-500/20 text-amber-500' :
                                    'bg-red-500/5 border-red-500/20 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.1)]'
                            }`}>
                            {event.type === 'success' && <ShieldCheckIcon className="w-5 h-5" />}
                            {event.type === 'alert' && <ShieldAlertIcon className="w-5 h-5" />}
                            {event.type === 'update' && <RefreshCwIcon className="w-5 h-5" />}
                            {event.type === 'critical' && <ShieldAlertIcon className="w-5 h-5" />}
                        </div>

                        <div className="space-y-2 pt-1">
                            <div className="flex justify-between items-center gap-4">
                                <h5 className={`text-[11px] font-black uppercase tracking-widest ${event.severity === 'critical' ? 'text-red-500' : 'text-white/60 group-hover/item:text-white'
                                    }`}>{event.title}</h5>
                                <span className="text-[9px] font-black text-white/10 uppercase tracking-widest shrink-0">{event.timestamp}</span>
                            </div>
                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.05em] leading-relaxed max-w-md italic">
                                {event.details}
                            </p>
                            <div className="pt-2">
                                <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${event.severity === 'info' ? 'bg-white/5 border-white/10 text-white/30' :
                                        event.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                                            'bg-red-500/10 border-red-500/20 text-red-500'
                                    }`}>
                                    LOG_{event.severity.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <button className="w-full mt-12 py-5 bg-white/[0.02] border border-white/5 rounded-2xl text-[10px] font-black text-white/20 uppercase tracking-[0.4em] hover:bg-white/5 hover:text-white transition-all shadow-inner">
                Extract Encrypted Ledger
            </button>
        </div>
    );
};

export default SecurityTimeline;
