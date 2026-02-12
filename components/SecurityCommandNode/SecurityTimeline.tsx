import React, { useState } from 'react';
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
    const [filter, setFilter] = useState('ALL');

    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl h-full flex flex-col shadow-sm overflow-hidden">
            <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Security Activity</h3>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest hidden lg:inline">Filters:</span>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="bg-white/5 border border-white/10 text-[9px] font-bold text-white/40 uppercase tracking-widest px-3 py-1.5 rounded-lg outline-none cursor-pointer hover:bg-white/10 appearance-none"
                    >
                        <option value="ALL">ALL LOGS</option>
                        <option value="CRITICAL">DANGER</option>
                        <option value="SUCCESS">AUTH</option>
                    </select>
                </div>
            </div>

            <div className="flex-grow p-8 space-y-8 overflow-y-auto custom-scrollbar">
                {mockEvents.map((event, i) => (
                    <div key={event.id} className="flex gap-5 relative group/item">
                        {i !== mockEvents.length - 1 && (
                            <div className="absolute left-[17px] top-8 w-px h-[calc(100%+32px)] bg-white/5" />
                        )}

                        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 z-10 transition-all ${event.severity === 'info' ? 'bg-white/[0.03] border-white/10 text-white/20' :
                                event.severity === 'warning' ? 'bg-amber-500/5 border-amber-500/10 text-amber-500' :
                                    'bg-red-500/5 border-red-500/10 text-red-500'
                            }`}>
                            {event.type === 'success' && <ShieldCheckIcon className="w-3.5 h-3.5" />}
                            {event.type === 'alert' && <ShieldAlertIcon className="w-3.5 h-3.5" />}
                            {event.type === 'update' && <RefreshCwIcon className="w-3.5 h-3.5" />}
                            {event.type === 'critical' && <ShieldAlertIcon className="w-3.5 h-3.5" />}
                        </div>

                        <div className="space-y-1 min-w-0">
                            <div className="flex justify-between items-center gap-3">
                                <h5 className={`text-[12px] font-bold uppercase tracking-tight truncate ${event.severity === 'critical' ? 'text-red-500' : 'text-white/80'
                                    }`}>{event.title}</h5>
                                <span className="text-[10px] font-medium text-white/10 uppercase tracking-widest shrink-0">{event.timestamp}</span>
                            </div>
                            <p className="text-[11px] font-medium text-white/20 leading-relaxed italic line-clamp-2">
                                {event.details}
                            </p>
                            <div className={`mt-2 inline-flex items-center px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${event.severity === 'info' ? 'bg-white/5 border-white/10 text-white/20' :
                                    event.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500/60' :
                                        'bg-red-500/10 border-red-500/20 text-red-500/60'
                                }`}>
                                {event.type.toUpperCase()}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-6 border-t border-white/5 bg-white/[0.01]">
                <button className="w-full py-4 bg-white/[0.02] border border-white/10 rounded-xl text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] hover:bg-white/5 hover:text-white transition-all">
                    Generate Forensic Ledger
                </button>
            </div>
        </div>
    );
};

export default SecurityTimeline;
