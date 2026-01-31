import React from 'react';
import { TeacherProfileData } from '../../types';
import { UserIcon } from '../icons/UserIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { MailIcon } from '../icons/MailIcon';
import { PhoneIcon } from '../icons/PhoneIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { FloatingPremiumInput, PremiumSelect } from '../common/Inputs';

interface FormProps {
    formData: Partial<TeacherProfileData & { display_name: string }>;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    photoPreviewUrl: string | null;
    onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    currentUserId: string;
    isRestrictedView?: boolean;
}

const TeacherForm: React.FC<FormProps> = ({ formData, handleChange, photoPreviewUrl, onPhotoChange, currentUserId, isRestrictedView }) => {
    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Profile Sector */}
            <div className="flex flex-col md:flex-row gap-10 items-center md:items-start p-8 rounded-[3rem] bg-white/[0.02] border border-white/5">
                <div className="relative group">
                    <div className="absolute inset-0 bg-primary/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                    <div className="relative w-32 h-32 rounded-full overflow-hidden bg-white/5 border border-white/10 shadow-2xl transition-transform group-hover:scale-105 duration-500">
                        {photoPreviewUrl ?
                            <img src={photoPreviewUrl} alt="Profile Preview" className="h-full w-full object-cover" /> :
                            <div className="p-8 text-white/10"><UserIcon /></div>
                        }
                    </div>
                    <label htmlFor="photo-upload" className="absolute -bottom-2 right-0 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center cursor-pointer shadow-xl hover:scale-110 active:scale-95 transition-all border-4 border-[#08090a]">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                        <input id="photo-upload" name="photo" type="file" onChange={onPhotoChange} accept="image/*" className="sr-only" />
                    </label>
                </div>

                <div className="flex-grow space-y-6 w-full">
                    <div className="space-y-1">
                        <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">Institutional Faculty Registry</h3>
                        <p className="text-[11px] text-white/30 font-medium tracking-widest italic">Biographical & professional specifications.</p>
                    </div>
                    <FloatingPremiumInput
                        label="Canonical Faculty Name"
                        name="display_name"
                        value={formData.display_name || ''}
                        onChange={handleChange}
                        required
                        icon={<UserIcon className="w-5 h-5" />}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FloatingPremiumInput
                    label="Chronological Marker (DOB)"
                    name="date_of_birth"
                    type="date"
                    value={formData.date_of_birth || ''}
                    onChange={handleChange}
                    readOnly={isRestrictedView}
                    icon={<CalendarIcon className="w-5 h-5" />}
                    className="appearance-none [color-scheme:dark]"
                />
                <PremiumSelect
                    label="Gender Assignment"
                    name="gender"
                    value={formData.gender || ''}
                    onChange={handleChange}
                    disabled={isRestrictedView}
                    icon={<UserIcon className="w-5 h-5" />}
                >
                    <option value="" disabled className="bg-slate-900">Select Gender...</option>
                    <option value="Male" className="bg-slate-900">Male</option>
                    <option value="Female" className="bg-slate-900">Female</option>
                    <option value="Other" className="bg-slate-900">Other</option>
                </PremiumSelect>

                <FloatingPremiumInput
                    label="Primary Academic Domain"
                    name="subject"
                    value={formData.subject || ''}
                    onChange={handleChange}
                    required
                    readOnly={isRestrictedView}
                    icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>}
                />
                <FloatingPremiumInput
                    label="Highest Qualification"
                    name="qualification"
                    value={formData.qualification || ''}
                    onChange={handleChange}
                    icon={<CheckCircleIcon className="w-5 h-5" />}
                />
            </div>

            <div className="h-px bg-white/5 w-full" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FloatingPremiumInput
                    label="Onboarding Date"
                    name="date_of_joining"
                    type="date"
                    value={formData.date_of_joining || ''}
                    onChange={handleChange}
                    readOnly={isRestrictedView}
                    icon={<CalendarIcon className="w-5 h-5" />}
                    className="appearance-none [color-scheme:dark]"
                />
                <FloatingPremiumInput
                    label="Experience Tenure (Years)"
                    name="experience_years"
                    type="number"
                    value={formData.experience_years || ''}
                    onChange={handleChange}
                    readOnly={isRestrictedView}
                    icon={<CheckCircleIcon className="w-5 h-5" />}
                />
            </div>

            {!isRestrictedView && (
                <div className="p-10 rounded-[2.5rem] bg-indigo-500/5 border border-indigo-500/10 space-y-8">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                        </div>
                        <h4 className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.4em]">Administrative Specifications</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <FloatingPremiumInput label="Faculty Department" name="department" value={formData.department || ''} onChange={handleChange} icon={<UsersIcon className="w-5 h-5" />} className="!bg-white/5" />
                        <FloatingPremiumInput label="Designation Level" name="designation" value={formData.designation || ''} onChange={handleChange} icon={<UserIcon className="w-5 h-5" />} className="!bg-white/5" />
                        <FloatingPremiumInput label="Remuneration Protocol" name="salary" value={formData.salary || ''} onChange={handleChange} icon={<CheckCircleIcon className="w-5 h-5" />} className="!bg-white/5" />
                        <FloatingPremiumInput label="Bank Auth Identifier" name="bank_details" value={formData.bank_details || ''} onChange={handleChange} icon={<CheckCircleIcon className="w-5 h-5" />} className="!bg-white/5" />
                    </div>
                </div>
            )}

            <div className="space-y-8">
                <FloatingPremiumInput label="Scientific Specializations" name="specializations" value={formData.specializations || ''} onChange={handleChange} icon={<SparklesIcon className="w-5 h-5" />} />
                <FloatingPremiumInput label="Teaching Philosophy (Bio)" name="bio" value={formData.bio || ''} onChange={handleChange} isTextArea icon={<MailIcon className="w-5 h-5" />} />
            </div>
        </div>
    );
};

export default TeacherForm;
