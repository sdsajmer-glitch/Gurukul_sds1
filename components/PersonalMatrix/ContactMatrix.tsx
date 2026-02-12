import React from 'react';
import { motion } from 'framer-motion';
import { MailIcon } from '../icons/MailIcon';
import { PhoneIcon } from '../icons/PhoneIcon';
import { MapPinIcon } from '../icons/MapPinIcon';
import { AlertCircleIcon } from '../icons/AlertCircleIcon';

interface ContactMatrixProps {
    email: string;
    phone: string;
    address: string;
    emergencyContact: string;
    emergencyPhone: string;
}

const ContactField: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
    <div className="flex items-start gap-5 p-5 bg-white/[0.01] border border-white/5 rounded-xl hover:bg-white/[0.02] transition-all group">
        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-white/20 group-hover:text-primary group-hover:border-primary/20 transition-all shadow-inner shrink-0">
            {icon}
        </div>
        <div className="space-y-1 min-w-0">
            <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{label}</p>
            <p className="text-[13px] font-bold text-white/80 truncate leading-tight">{value || 'NOT_DECLARED'}</p>
        </div>
    </div>
);

const ContactMatrix: React.FC<ContactMatrixProps> = ({
    email,
    phone,
    address,
    emergencyContact,
    emergencyPhone
}) => {
    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl p-8 shadow-sm space-y-8">
            <div className="flex items-center justify-between border-b border-white/5 pb-5">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary ring-1 ring-primary/20 shadow-lg">
                        <PhoneIcon className="w-5 h-5" />
                    </div>
                    <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Liaison Connectivity</h3>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-widest">Active uplink</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <ContactField label="Digital Correspondence" value={email} icon={<MailIcon className="w-4 h-4" />} />
                    <ContactField label="Primary Voice Uplink" value={phone} icon={<PhoneIcon className="w-4 h-4" />} />
                    <ContactField label="Logistics Anchor (Address)" value={address} icon={<MapPinIcon className="w-4 h-4" />} />
                </div>

                <div className="p-6 bg-primary/[0.02] border border-primary/10 rounded-2xl flex flex-col justify-between">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <AlertCircleIcon className="w-4 h-4 text-primary" />
                            <h4 className="text-[11px] font-black text-white/60 uppercase tracking-[0.2em]">Emergency Failover</h4>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Authorized Kin</p>
                                <p className="text-sm font-bold text-white/80">{emergencyContact || 'UNREGISTERED'}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Emergency Tactical Phone</p>
                                <p className="text-sm font-bold text-primary">{emergencyPhone || 'UNREGISTERED'}</p>
                            </div>
                        </div>
                    </div>
                    <div className="pt-6 border-t border-white/[0.03] mt-auto">
                        <p className="text-[9px] font-medium text-white/20 italic">Validated Emergency Node v9.2</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactMatrix;
