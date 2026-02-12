import React from 'react';
import { motion } from 'framer-motion';
import { ClockIcon } from '../icons/ClockIcon';
import { UserIcon } from '../icons/UserIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';

interface PersonalKPIStripProps {
    age: number;
    tenure: number;
    role: string;
    authority: string;
}

const KPICapsule: React.FC<{ label: string; value: string | number; icon: React.ReactNode; color?: string }> = ({ label, value, icon, color }) => (
    <div className="flex-1 min-w-[180px] h-[78px] bg-white/[0.01] border border-white/5 rounded-xl px-5 py-4 flex flex-col justify-between transition-all hover:bg-white/[0.03] group relative overflow-hidden">
        <div className="flex justify-between items-start relative z-10">
            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">{label}</p>
            <span className="text-white/10 group-hover:text-primary/40 transition-colors">{icon}</span>
        </div>
        <h5 className={`text-[15px] font-bold tracking-tight uppercase relative z-10 ${color || 'text-white/90'}`}>{value}</h5>
        <div className="absolute bottom-0 left-0 h-[2px] bg-primary/20 w-0 group-hover:w-full transition-all duration-500" />
    </div>
);

const PersonalKPIStrip: React.FC<PersonalKPIStripProps> = ({
    age,
    tenure,
    role,
    authority
}) => {
    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl p-6 shadow-sm overflow-hidden flex flex-col gap-5">
            <div className="flex flex-nowrap items-center gap-4 overflow-x-auto custom-scrollbar-horizontal pb-2 lg:pb-0">
                <KPICapsule
                    label="Chronological Age"
                    value={`${age} YEARS`}
                    icon={<UserIcon className="w-3.5 h-3.5" />}
                />
                <KPICapsule
                    label="Tenure Experience"
                    value={`${tenure} YEARS`}
                    color="text-primary"
                    icon={<ClockIcon className="w-3.5 h-3.5" />}
                />
                <KPICapsule
                    label="Active Role"
                    value={role}
                    icon={<BriefcaseIcon className="w-3.5 h-3.5" />}
                />
                <KPICapsule
                    label="Reporting Authority"
                    value={authority}
                    color="text-emerald-500"
                    icon={<ShieldCheckIcon className="w-3.5 h-3.5" />}
                />
            </div>

            {/* Progress / Info Bar Layer */}
            <div className="flex items-center gap-4 px-1">
                <div className="flex-grow h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '88%' }}
                        className="h-full bg-primary/30 rounded-full"
                    />
                </div>
                <div className="flex gap-4">
                    <span className="text-[8px] font-black text-white/10 uppercase tracking-widest whitespace-nowrap">Profile Integrity: 88%</span>
                    <span className="text-[8px] font-black text-emerald-500/40 uppercase tracking-widest whitespace-nowrap italic">Validated_Node</span>
                </div>
            </div>
        </div>
    );
};

export default PersonalKPIStrip;
