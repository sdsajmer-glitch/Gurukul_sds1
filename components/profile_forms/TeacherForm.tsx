import React from 'react';
import { motion } from 'framer-motion';
import { TeacherProfileData } from '../../types';
import { UserIcon } from '../icons/UserIcon';
import { BookIcon } from '../icons/BookIcon';
import { MailIcon } from '../icons/MailIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { LayersIcon } from '../icons/LayersIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import CustomSelect from '../common/CustomSelect';

interface FormProps {
    formData: Partial<TeacherProfileData & { display_name: string }>;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    photoPreviewUrl: string | null;
    onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    currentUserId: string;
    isRestrictedView?: boolean;
}

import PremiumFloatingInput from '../common/PremiumFloatingInput';

const TeacherForm: React.FC<FormProps> = ({ formData, handleChange, photoPreviewUrl, onPhotoChange, currentUserId, isRestrictedView }) => {

    const handleSelectChange = (name: string) => (value: string) => {
        handleChange({ target: { name, value } } as any);
    };

    return (
        <div className="space-y-16">
            {/* Identity & Photo Module */}
            <div className="flex flex-col md:flex-row gap-12 items-start">
                <div className="relative group shrink-0">
                    <div className="w-40 h-40 rounded-[2.5rem] bg-gradient-to-br from-primary/30 to-transparent p-[2px] shadow-2xl">
                        <div className="w-full h-full rounded-[2.4rem] bg-[#0a0b10] flex items-center justify-center overflow-hidden relative">
                            {photoPreviewUrl ?
                                <img src={photoPreviewUrl} alt="Profile Preview" className="h-full w-full object-cover" /> :
                                <div className="text-white/10"><UserIcon className="w-16 h-16" /></div>
                            }
                            <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-sm">
                                <SparklesIcon className="w-8 h-8 text-white mb-2" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-white">Identity Scan</span>
                                <input type="file" onChange={onPhotoChange} accept="image/*" className="sr-only" />
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex-grow w-full space-y-8">
                    <div className="flex items-center gap-6 mb-2">
                        <div className="p-4 bg-primary/10 rounded-2xl text-primary border border-primary/20">
                            <LayersIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-[12px] font-black text-white tracking-[0.3em] uppercase glow-text mb-1">Pedagogical Node</h3>
                            <p className="text-[10px] text-white/30 font-bold tracking-widest">Core personal and academic synchronization.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <PremiumFloatingInput
                            label="Legal Full Name"
                            name="display_name"
                            value={formData.display_name || ''}
                            onChange={handleChange}
                            required
                            icon={<UserIcon />}
                        />
                        <PremiumFloatingInput
                            label="Primary Subject"
                            name="subject"
                            value={formData.subject || ''}
                            onChange={handleChange}
                            required
                            icon={<BookIcon />}
                            readOnly={isRestrictedView}
                        />
                    </div>
                </div>
            </div>

            {/* Academic Credentials Module */}
            <div className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10 bg-white/[0.02] p-10 rounded-[3rem] border border-white/5 shadow-inner">
                    <PremiumFloatingInput
                        label="Date of Birth"
                        name="date_of_birth"
                        type="date"
                        value={formData.date_of_birth || ''}
                        onChange={handleChange}
                        readOnly={isRestrictedView}
                        icon={<CalendarIcon />}
                    />
                    <CustomSelect
                        label="Gender Protocol"
                        value={formData.gender || ''}
                        onChange={handleSelectChange('gender')}
                        options={[
                            { value: 'Male', label: 'Male' },
                            { value: 'Female', label: 'Female' },
                            { value: 'Other', label: 'Other' },
                            { value: 'Prefer not to say', label: 'Prefer not to say' }
                        ]}
                        disabled={isRestrictedView}
                        icon={<UserIcon />}
                    />
                    <PremiumFloatingInput
                        label="Qualification"
                        name="qualification"
                        value={formData.qualification || ''}
                        onChange={handleChange}
                        icon={<CheckCircleIcon />}
                        placeholder="e.g. PhD in Astrophysics"
                    />
                </div>
            </div>

            {/* Employment Synchronization Module */}
            <div className="space-y-10">
                <div className="flex items-center gap-6 mb-2">
                    <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-400 border border-indigo-500/20">
                        <UsersIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-[12px] font-black text-white tracking-[0.3em] uppercase mb-1">Institutional Tenure</h3>
                        <p className="text-[10px] text-white/30 font-bold tracking-widest">Contractual and departmental telemetry.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 bg-indigo-500/[0.02] p-10 rounded-[3rem] border border-indigo-500/5 shadow-inner">
                    <PremiumFloatingInput
                        label="Tenure Start Date"
                        name="date_of_joining"
                        type="date"
                        value={formData.date_of_joining || ''}
                        onChange={handleChange}
                        readOnly={isRestrictedView}
                        icon={<CalendarIcon />}
                    />
                    <PremiumFloatingInput
                        label="Experience Vectors"
                        name="experience_years"
                        type="number"
                        value={formData.experience_years || ''}
                        onChange={handleChange}
                        placeholder="e.g., 5 Years"
                        readOnly={isRestrictedView}
                        icon={<LayersIcon />}
                    />
                    <PremiumFloatingInput
                        label="Specializations"
                        name="specializations"
                        value={formData.specializations || ''}
                        onChange={handleChange}
                        placeholder="e.g., Quantum Computing"
                        icon={<SparklesIcon />}
                    />
                    <PremiumFloatingInput
                        label="Identity Bio"
                        name="bio"
                        value={formData.bio || ''}
                        onChange={handleChange as any}
                        isTextArea
                        placeholder="Professional orientation summary..."
                        icon={<MailIcon />}
                    />
                </div>
            </div>

            {/* Administrative Telemetry - Only for Admin Mode */}
            {!isRestrictedView && (
                <div className="space-y-10 p-10 rounded-[3rem] bg-emerald-500/[0.03] border border-emerald-500/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px]" />

                    <div className="flex items-center gap-6 mb-2 relative z-10">
                        <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20">
                            <CheckCircleIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-[12px] font-black text-white tracking-[0.3em] uppercase mb-1">Admin Protocols</h3>
                            <p className="text-[10px] text-white/30 font-bold tracking-widest">restricted fiscal and organizational nodes.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
                        <PremiumFloatingInput
                            label="Department Node"
                            name="department"
                            value={formData.department || ''}
                            onChange={handleChange}
                            placeholder="e.g. Science"
                            icon={<LayersIcon />}
                        />
                        <PremiumFloatingInput
                            label="Designation Vector"
                            name="designation"
                            value={formData.designation || ''}
                            onChange={handleChange}
                            placeholder="e.g. HOD"
                            icon={<CheckCircleIcon />}
                        />
                        <PremiumFloatingInput
                            label="Fiscal Remuneration"
                            name="salary"
                            value={formData.salary || ''}
                            onChange={handleChange}
                            placeholder="Institutional allocation..."
                            icon={<CheckCircleIcon />}
                        />
                        <PremiumFloatingInput
                            label="Registry Bank Node"
                            name="bank_details"
                            value={formData.bank_details || ''}
                            onChange={handleChange}
                            placeholder="Routing & IBAN..."
                            icon={<CheckCircleIcon />}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherForm;
