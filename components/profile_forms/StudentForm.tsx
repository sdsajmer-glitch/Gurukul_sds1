
import React from 'react';
import { StudentProfileData, UserProfile } from '../../types';
import { UserIcon } from '../icons/UserIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { FloatingPremiumInput, PremiumSelect } from '../common/Inputs';

interface FormProps {
    formData: Partial<StudentProfileData & { applicant_name: string, date_of_birth: string, gender: string }>;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    profile: UserProfile;
}

const StudentForm: React.FC<FormProps> = ({ formData, handleChange, profile }) => {
    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-5 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <UserIcon className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">Student Identity</h3>
                    <p className="text-[11px] text-white/30 font-medium tracking-widest italic">Core registry specifications.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FloatingPremiumInput
                    label="Canonical Name"
                    name="applicant_name"
                    value={formData.applicant_name || ''}
                    readOnly
                    icon={<UserIcon className="w-5 h-5" />}
                />

                <FloatingPremiumInput
                    label="Academic Grade"
                    name="grade"
                    value={formData.grade || ''}
                    readOnly
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14v7" /></svg>}
                />

                <FloatingPremiumInput
                    label="Chronological Marker (DOB)"
                    name="date_of_birth"
                    type="date"
                    value={formData.date_of_birth || ''}
                    onChange={handleChange}
                    required
                    icon={<CalendarIcon className="w-5 h-5" />}
                    className="appearance-none [color-scheme:dark]"
                />

                <PremiumSelect
                    label="Gender Assignment"
                    name="gender"
                    value={formData.gender || ''}
                    onChange={handleChange}
                    required
                    icon={<UserIcon className="w-5 h-5" />}
                >
                    <option value="" disabled className="bg-slate-900">Select Gender...</option>
                    <option value="Male" className="bg-slate-900">Male</option>
                    <option value="Female" className="bg-slate-900">Female</option>
                    <option value="Other" className="bg-slate-900">Other</option>
                </PremiumSelect>
            </div>

            <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/5 flex items-center gap-6 group hover:bg-white/[0.05] transition-all">
                <div className="w-16 h-16 bg-white/5 rounded-[1.5rem] border border-white/10 flex items-center justify-center text-white/20 group-hover:text-primary group-hover:border-primary/30 transition-all">
                    <UsersIcon className="w-8 h-8" />
                </div>
                <div className="flex-grow">
                    <p className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em] mb-1">Authoritative Proxy (Guardian)</p>
                    <p className="text-xl font-serif font-black text-white tracking-tight">{profile.display_name}</p>
                    <p className="text-[11px] text-white/30 font-medium tracking-widest">{profile.email}</p>
                </div>
                <div className="px-6 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px] font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/5">
                    Verified Sync
                </div>
            </div>
        </div>
    );
};

export default StudentForm;
