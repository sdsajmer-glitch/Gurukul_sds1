import React from 'react';
import { UserIcon } from '../icons/UserIcon';

interface BiologicalRegistryProps {
    firstName: string;
    lastName: string;
    dob: string;
    nationality: string;
    languages: string;
    gender: string;
    bloodGroup: string;
    religion: string;
}

const BioField: React.FC<{ label: string; value: string; meta: string }> = ({ label, value, meta }) => (
    <div className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0 border-b border-white/[0.02] last:border-0">
        <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.2em]">{label}</p>
        <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-white/80 tracking-tight">{value || 'N/A'}</span>
            <span className="text-[8px] font-bold text-white/[0.04] uppercase tracking-widest italic">{meta}</span>
        </div>
    </div>
);

const BiologicalRegistry: React.FC<BiologicalRegistryProps> = ({
    firstName,
    lastName,
    dob,
    nationality,
    languages,
    gender,
    bloodGroup,
    religion
}) => {
    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl p-8 shadow-sm flex flex-col gap-8 h-full">
            <div className="flex items-center gap-4 border-b border-white/5 pb-5">
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary ring-1 ring-primary/20">
                    <UserIcon className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                    <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Personal Details</h3>
                    <p className="text-[9px] font-medium text-white/20 uppercase tracking-widest">Identity Records</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-x-10 gap-y-1 items-start flex-grow">
                <BioField label="First Name" value={firstName} meta="LEGAL_FIRST" />
                <BioField label="Last Name" value={lastName} meta="LEGAL_LAST" />
                <BioField label="Date of Birth" value={dob} meta="DOB" />
                <BioField label="Assigned Gender" value={gender} meta="BIO_AXIS" />
                <BioField label="Nationality" value={nationality} meta="ORIGIN" />
                <BioField label="Vital Group" value={bloodGroup} meta="SEROLOGY" />
                <BioField label="Linguistic Preference" value={languages} meta="COMM_DEXTERITY" />
                <BioField label="Religion" value={religion} meta="IDENTITY" />
            </div>
        </div>
    );
};

export default BiologicalRegistry;
