import React from 'react';
import { motion } from 'framer-motion';
import { UserIcon } from '../icons/UserIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { StarIcon } from '../icons/StarIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';

interface PersonalSummaryStripProps {
    age: string | number;
    experience: string | number;
    bloodGroup: string;
    gender: string;
    religion: string;
}

const SummaryItem: React.FC<{ label: string; value: string | number; icon?: React.ReactNode; color?: string }> = ({ label, value, icon, color }) => (
    <div className="flex-1 min-w-[140px] bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col gap-1 transition-all hover:bg-white/[0.04]">
        <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">{label}</p>
        <div className="flex items-center gap-2">
            {icon && <span className="text-white/40">{icon}</span>}
            <span className={`text-[13px] font-bold tracking-tight ${color || 'text-white/80'}`}>{value}</span>
        </div>
    </div>
);

const PersonalSummaryStrip: React.FC<PersonalSummaryStripProps> = ({
    age,
    experience,
    bloodGroup,
    gender,
    religion
}) => {
    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl p-6 shadow-sm overflow-hidden">
            <div className="flex flex-nowrap items-center gap-4 overflow-x-auto custom-scrollbar-horizontal pb-2 lg:pb-0">
                <SummaryItem
                    label="Chronological Age"
                    value={`${age} YEARS`}
                    icon={<UserIcon className="w-3.5 h-3.5" />}
                />
                <SummaryItem
                    label="Tenure Experience"
                    value={`${experience} YEARS`}
                    color="text-primary/60"
                    icon={<ClockIcon className="w-3.5 h-3.5" />}
                />
                <SummaryItem
                    label="Vital Group"
                    value={bloodGroup || 'O+'}
                    color="text-red-400"
                    icon={<ShieldCheckIcon className="w-3.5 h-3.5" />}
                />
                <SummaryItem
                    label="Identity Matrix"
                    value={`${gender.toUpperCase()} / ${religion.toUpperCase()}`}
                    icon={<StarIcon className="w-3.5 h-3.5" />}
                />
                <div className="flex-1 min-w-[200px] bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col gap-1 text-right ml-auto">
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Profile Integrity</p>
                    <p className="text-[12px] font-bold text-emerald-500 tracking-tight uppercase">Identity_Verified</p>
                </div>
            </div>
        </div>
    );
};

export default PersonalSummaryStrip;
