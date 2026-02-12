import React from 'react';
import { MailIcon } from '../icons/MailIcon';
import { PhoneIcon } from '../icons/PhoneIcon';
import { MapPinIcon } from '../icons/MapPinIcon';
import { AlertCircleIcon } from '../icons/AlertCircleIcon';
import { CommunicationIcon } from '../icons/CommunicationIcon';

interface LiaisonConnectivityProps {
    email: string;
    phone: string;
    address: string;
    emergencyContact: string;
    emergencyPhone: string;
    prefCommunication: string;
}

const ContactBlock: React.FC<{ label: string; value: string; icon: React.ReactNode; color?: string }> = ({ label, value, icon, color }) => (
    <div className="bg-white/[0.01] border border-white/5 rounded-xl p-5 flex flex-col gap-3 transition-all hover:bg-white/[0.02] group">
        <div className="flex items-center gap-3">
            <div className="text-white/20 group-hover:text-primary transition-colors">{icon}</div>
            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">{label}</p>
        </div>
        <p className={`text-[13px] font-bold tracking-tight truncate ${color || 'text-white/80'}`}>{value || 'NOT_DECLARED'}</p>
    </div>
);

const LiaisonConnectivity: React.FC<LiaisonConnectivityProps> = ({
    email,
    phone,
    address,
    emergencyContact,
    emergencyPhone,
    prefCommunication
}) => {
    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl p-8 shadow-sm flex flex-col gap-8">
            <div className="flex items-center justify-between border-b border-white/5 pb-5">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary ring-1 ring-primary/20">
                        <PhoneIcon className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                        <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Liaison Connectivity</h3>
                        <p className="text-[9px] font-medium text-white/20 uppercase tracking-widest">Global Communications Hub</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse outline outline-4 outline-emerald-500/10" />
                    <span className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-widest">Uplink Active</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
                <ContactBlock
                    label="Digital Correspondence"
                    value={email}
                    icon={<MailIcon className="w-3.5 h-3.5" />}
                />
                <ContactBlock
                    label="Emergency Failover"
                    value={emergencyContact}
                    color="text-primary"
                    icon={<AlertCircleIcon className="w-3.5 h-3.5" />}
                />
                <ContactBlock
                    label="Primary Voice Node"
                    value={phone}
                    icon={<PhoneIcon className="w-3.5 h-3.5" />}
                />
                <ContactBlock
                    label="Tactical Contact"
                    value={emergencyPhone}
                    color="text-amber-500"
                    icon={<PhoneIcon className="w-3.5 h-3.5" />}
                />
                <ContactBlock
                    label="Logistics Anchor"
                    value={address}
                    icon={<MapPinIcon className="w-3.5 h-3.5" />}
                />
                <ContactBlock
                    label="Comm Preference"
                    value={prefCommunication}
                    icon={<CommunicationIcon className="w-3.5 h-3.5" />}
                />
            </div>
        </div>
    );
};

export default LiaisonConnectivity;
