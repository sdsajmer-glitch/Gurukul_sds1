import React from 'react';
import { motion } from 'framer-motion';
import { KeyIcon } from '../icons/KeyIcon';
import { ShieldAlertIcon } from '../icons/ShieldAlertIcon';
import { RefreshCwIcon } from '../icons/RefreshCwIcon';

interface AuthenticationMatrixProps {
    lastPasswordChange: string;
    failedAttempts: number;
    onResetCredentials: () => void;
    onSuspendGateway: () => void;
}

const AuthenticationMatrix: React.FC<AuthenticationMatrixProps> = ({
    lastPasswordChange,
    failedAttempts,
    onResetCredentials,
    onSuspendGateway
}) => {
    return (
        <div className="p-10 bg-white/[0.01] border border-white/5 rounded-[3.5rem] shadow-3xl space-y-10 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-[0.02] group-hover:scale-110 group-hover:rotate-6 transition-all duration-[3s] pointer-events-none">
                <KeyIcon className="w-48 h-48" />
            </div>

            <div className="relative z-10 flex items-center justify-between">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-3 opacity-40">
                        <div className="w-8 h-0.5 bg-primary"></div>
                        <span className="text-[10px] font-black text-white uppercase tracking-[0.5em]">Authentication Matrix</span>
                    </div>
                    <h3 className="text-3xl font-serif font-black text-white uppercase tracking-tighter italic">Cred Registry.</h3>
                </div>
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 text-primary">
                    <KeyIcon className="w-6 h-6" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
                <div className="p-8 bg-black/40 rounded-[2.5rem] border border-white/5 space-y-6">
                    <div className="space-y-1">
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Temporal Sync</p>
                        <p className="text-xs font-black text-white/60 uppercase tracking-widest">PWD_LAST_ROTATED</p>
                    </div>
                    <div>
                        <p className="text-2xl font-serif font-black text-white">{lastPasswordChange}</p>
                        <p className="text-[10px] font-bold text-white/10 uppercase tracking-[0.2em] mt-1">Institutional Cycle Logged</p>
                    </div>
                </div>

                <div className={`p-8 rounded-[2.5rem] border space-y-6 transition-all ${failedAttempts > 0 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-black/40 border-white/5'}`}>
                    <div className="space-y-1">
                        <p className={`text-[9px] font-black uppercase tracking-[0.4em] ${failedAttempts > 0 ? 'text-amber-500' : 'text-white/20'}`}>Anomaly Detection</p>
                        <p className="text-xs font-black text-white/60 uppercase tracking-widest">FAILED_HANDSHAKES</p>
                    </div>
                    <div className="flex items-end justify-between">
                        <div>
                            <p className={`text-4xl font-serif font-black ${failedAttempts > 0 ? 'text-amber-500' : 'text-white'}`}>{failedAttempts}</p>
                            <p className="text-[10px] font-bold text-white/10 uppercase tracking-[0.2em] mt-1">Detected Blocked Attempts</p>
                        </div>
                        {failedAttempts > 0 && (
                            <ShieldAlertIcon className="w-8 h-8 text-amber-500 animate-pulse" />
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-6 relative z-10">
                <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onResetCredentials}
                    className="flex-grow px-8 py-5 bg-primary text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-2xl shadow-3xl shadow-primary/20 hover:shadow-primary/30 transition-all flex items-center justify-center gap-4"
                >
                    <RefreshCwIcon className="w-5 h-5" /> Force Credential Reset
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onSuspendGateway}
                    className="flex-grow px-8 py-5 bg-white/5 border border-white/10 text-white/60 text-[11px] font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-4"
                >
                    <ShieldAlertIcon className="w-5 h-5 text-amber-500" /> Suspend Auth Gateway
                </motion.button>
            </div>
        </div>
    );
};

export default AuthenticationMatrix;
