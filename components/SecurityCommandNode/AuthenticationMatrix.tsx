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

const ControlRow: React.FC<{ label: string; value: string | number; meta?: string; color?: string }> = ({ label, value, meta, color }) => (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.03] last:border-0">
        <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{label}</p>
            <p className="text-[11px] font-black text-white/40 uppercase tracking-widest italic">{meta}</p>
        </div>
        <div className={`text-[14px] font-bold tracking-tight ${color || 'text-white'}`}>
            {value}
        </div>
    </div>
);

const AuthenticationMatrix: React.FC<AuthenticationMatrixProps> = ({
    lastPasswordChange,
    failedAttempts,
    onResetCredentials,
    onSuspendGateway
}) => {
    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl p-7 flex flex-col gap-6 shadow-sm">
            <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Authentication Controls</h3>
                <KeyIcon className="w-5 h-5 text-white/20" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-1">
                    <ControlRow label="Rotation Lifecycle" value={lastPasswordChange} meta="PWD_LAST_ROTATED" />
                    <ControlRow label="Handshake status" value="Secured" meta="MFA_UPLINK" color="text-emerald-500" />
                </div>
                <div className="space-y-1">
                    <ControlRow label="Anomaly tracking" value={failedAttempts} meta="FAILED_ATTEMPTS" color={failedAttempts > 0 ? 'text-amber-500' : 'text-white/60'} />
                    <ControlRow label="Network Rep" value="Verified" meta="IP_REPUTATION" color="text-emerald-500" />
                </div>
            </div>

            <div className="flex gap-4 pt-2">
                <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={onResetCredentials}
                    className="flex-1 py-3.5 bg-primary text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-3 shadow-lg shadow-primary/20"
                >
                    <RefreshCwIcon className="w-4 h-4" /> Reset Credentials
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={onSuspendGateway}
                    className="flex-1 py-3.5 border border-white/10 text-white/40 text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-white/5 hover:text-white transition-all flex items-center justify-center gap-3"
                >
                    <ShieldAlertIcon className="w-4 h-4" /> Suspend Gateway
                </motion.button>
            </div>
        </div>
    );
};

export default AuthenticationMatrix;
