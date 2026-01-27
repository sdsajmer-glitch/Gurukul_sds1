import React from 'react';
import { motion } from 'framer-motion';
import { StudentProfileData, UserProfile } from '../../types';
import { UserIcon } from '../icons/UserIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { LockIcon } from '../icons/LockIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { LayersIcon } from '../icons/LayersIcon';
import PremiumFloatingInput from '../common/PremiumFloatingInput';
import CustomSelect from '../common/CustomSelect';

interface FormProps {
    formData: Partial<StudentProfileData & { applicant_name: string, date_of_birth: string, gender: string }>;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    profile: UserProfile;
}

const StudentForm: React.FC<FormProps> = ({ formData, handleChange, profile }) => {

    const handleSelectChange = (name: string) => (value: string) => {
        handleChange({ target: { name, value } } as any);
    };

    return (
        <div className="space-y-16">
            {/* Identity Scanning Module */}
            <div className="space-y-10">
                <div className="flex items-center gap-6 mb-2">
                    <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20">
                        <UserIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-[12px] font-black text-white tracking-[0.3em] uppercase glow-text mb-1">Scholar Identity Node</h3>
                        <p className="text-[10px] text-white/30 font-bold tracking-widest">Core biometric and institutional telemetry.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 bg-white/[0.02] p-10 rounded-[3rem] border border-white/5 shadow-inner">
                    <PremiumFloatingInput
                        label="Validated Full Name"
                        name="applicant_name"
                        value={formData.applicant_name || ''}
                        readOnly
                        icon={<UserIcon />}
                        action={<LockIcon className="w-4 h-4 text-white/10" />}
                    />

                    <PremiumFloatingInput
                        label="Allocated Grade Node"
                        name="grade"
                        value={formData.grade || ''}
                        readOnly
                        icon={<LayersIcon />}
                        action={<LockIcon className="w-4 h-4 text-white/10" />}
                    />

                    <PremiumFloatingInput
                        label="Birth Chronology"
                        name="date_of_birth"
                        type="date"
                        value={formData.date_of_birth || ''}
                        onChange={handleChange as any}
                        required
                        icon={<CalendarIcon />}
                    />

                    <CustomSelect
                        label="Gender Orientation"
                        value={formData.gender || ''}
                        onChange={handleSelectChange('gender')}
                        options={[
                            { value: 'Male', label: 'Male Vector' },
                            { value: 'Female', label: 'Female Vector' },
                            { value: 'Other', label: 'Diverse Matrix' }
                        ]}
                        icon={<UserIcon />}
                        placeholder="Select Orientation..."
                    />
                </div>
            </div>

            {/* Guardian Linkage Visualization */}
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-indigo-500/20 rounded-[3rem] blur-2xl opacity-0 group-hover:opacity-100 transition-all duration-1000" />
                <div className="relative bg-[#0a0b10] p-10 rounded-[3rem] border border-white/5 flex flex-col md:flex-row items-center gap-10 shadow-2xl">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-[2rem] bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
                            <UsersIcon className="w-10 h-10" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-black border-4 border-[#0a0b10]">
                            <SparklesIcon className="w-4 h-4" />
                        </div>
                    </div>

                    <div className="flex-grow text-center md:text-left space-y-2">
                        <div className="flex items-center justify-center md:justify-start gap-4">
                            <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Active Guardian Anchor</h4>
                            <div className="h-px w-20 bg-primary/20" />
                        </div>
                        <p className="text-2xl font-black text-white tracking-tight">{profile.display_name}</p>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4 opacity-40">
                            <p className="text-[11px] font-bold tracking-widest uppercase">{profile.email}</p>
                            <span className="w-1 h-1 rounded-full bg-white/20 self-center" />
                            <p className="text-[11px] font-bold tracking-widest uppercase">Verified Access Node</p>
                        </div>
                    </div>

                    <div className="px-8 py-4 rounded-2xl bg-white/5 border border-white/5 text-[10px] font-black text-white/20 uppercase tracking-widest hidden lg:block">
                        Linked Protocol: 0x77...SYNC
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentForm;
