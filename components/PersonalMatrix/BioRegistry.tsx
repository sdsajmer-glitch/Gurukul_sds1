import React from 'react';
import { motion } from 'framer-motion';
import { UserIcon } from '../icons/UserIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { GlobeIcon } from '../icons/GlobeIcon';

interface BioRegistryProps {
    firstName: string;
    lastName: string;
    dob: string;
    nationality: string;
    languages: string;
    isEditing?: boolean;
    onChange?: (field: string, val: string) => void;
}

const DataField: React.FC<{ label: string; value: string; meta: string }> = ({ label, value, meta }) => (
    <div className="py-4 border-b border-white/[0.03] last:border-0 group/field">
        <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-1">{label}</p>
        <div className="flex items-center justify-between">
            <span className="text-[14px] font-bold text-white/80 tracking-tight">{value || 'N/A'}</span>
            <span className="text-[9px] font-black text-white/[0.05] uppercase tracking-widest italic group-hover/field:text-primary/20 transition-colors uppercase">{meta}</span>
        </div>
    </div>
);

const BioRegistry: React.FC<BioRegistryProps> = ({
    firstName,
    lastName,
    dob,
    nationality,
    languages
}) => {
    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl p-8 shadow-sm space-y-8">
            <div className="flex items-center justify-between border-b border-white/5 pb-5">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary ring-1 ring-primary/20 shadow-lg">
                        <UserIcon className="w-5 h-5" />
                    </div>
                    <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Personal Details</h3>
                </div>
                <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">Profile Record</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                <DataField label="First Name" value={firstName} meta="Legal Name" />
                <DataField label="Last Name" value={lastName} meta="Legal Name" />
                <DataField label="Date of Birth" value={dob} meta="Verified" />
                <DataField label="Nationality" value={nationality} meta="Identity" />
                <DataField label="Languages" value={languages} meta="Communication" />
                <DataField label="Gender" value="Male" meta="Profile" />
            </div>
        </div>
    );
};

export default BioRegistry;
