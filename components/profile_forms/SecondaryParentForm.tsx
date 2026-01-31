import React, { useState, useMemo, useEffect } from 'react';
import Spinner from '../common/Spinner';
import { UserIcon } from '../icons/UserIcon';
import { MailIcon } from '../icons/MailIcon';
import { PhoneIcon } from '../icons/PhoneIcon';
import { FloatingPremiumInput, PremiumSelect } from '../common/Inputs';

interface SecondaryParentData {
    name: string;
    relationship: string;
    gender: string;
    email: string;
    phone: string;
}

interface FormProps {
    initialData: SecondaryParentData;
    onSave: (data: SecondaryParentData) => void;
    onCancel: () => void;
    loading: boolean;
    primaryRelationship?: string;
}

const SecondaryParentForm: React.FC<FormProps> = ({ initialData, onSave, onCancel, loading, primaryRelationship }) => {
    const [formData, setFormData] = useState(initialData);

    const availableRelationships = useMemo(() => {
        if (primaryRelationship === 'Father') return ['Mother', 'Guardian', 'Other'];
        if (primaryRelationship === 'Mother') return ['Father', 'Guardian', 'Other'];
        const allRelationships = ['Father', 'Mother', 'Guardian', 'Other'];
        return primaryRelationship ? allRelationships.filter(r => r !== primaryRelationship) : allRelationships;
    }, [primaryRelationship]);

    useEffect(() => {
        if (!initialData.relationship) {
            if (primaryRelationship === 'Father') setFormData(prev => ({ ...prev, relationship: 'Mother' }));
            else if (primaryRelationship === 'Mother') setFormData(prev => ({ ...prev, relationship: 'Father' }));
        }
    }, [initialData.relationship, primaryRelationship]);


    useEffect(() => {
        if (formData.relationship && !availableRelationships.includes(formData.relationship)) {
            setFormData(prev => ({ ...prev, relationship: '' }));
        }
    }, [availableRelationships, formData.relationship]);

    useEffect(() => {
        const relationship = formData.relationship;
        let newGender = '';
        if (relationship === 'Father') newGender = 'Male';
        else if (relationship === 'Mother') newGender = 'Female';
        if (newGender && formData.gender !== newGender) setFormData(prev => ({ ...prev, gender: newGender }));
    }, [formData.relationship, formData.gender]);

    const isGenderDisabled = formData.relationship === 'Father' || formData.relationship === 'Mother';

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="p-10 rounded-[2.5rem] bg-white/[0.03] border border-white/10 space-y-10 animate-in fade-in zoom-in duration-500">
            <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <UserIcon className="w-6 h-6" />
                </div>
                <div className="flex-grow">
                    <h3 className="text-[11px] font-black uppercase text-white/30 tracking-[0.4em]">Secondary Node Registry</h3>
                    <p className="text-lg font-serif font-black text-white italic tracking-tight">Co-Guardian Specification</p>
                </div>
            </div>

            <div className="space-y-8">
                <FloatingPremiumInput
                    label="Canonical Name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    icon={<UserIcon className="w-5 h-5" />}
                    className="!bg-white/[0.03]"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <PremiumSelect
                        label="Identity Linkage"
                        name="relationship"
                        value={formData.relationship}
                        onChange={handleChange}
                        required
                        icon={<UserIcon className="w-5 h-5" />}
                        className="!bg-white/[0.03]"
                    >
                        <option value="" disabled className="bg-slate-900">Select Relationship...</option>
                        {availableRelationships.map(rel => (
                            <option key={rel} value={rel} className="bg-slate-900">{rel}</option>
                        ))}
                    </PremiumSelect>

                    <PremiumSelect
                        label="Gender Assignment"
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                        disabled={isGenderDisabled}
                        icon={<UserIcon className="w-5 h-5" />}
                        className="!bg-white/[0.03]"
                    >
                        <option value="" disabled className="bg-slate-900">Select Gender...</option>
                        <option value="Male" className="bg-slate-900">Male</option>
                        <option value="Female" className="bg-slate-900">Female</option>
                        <option value="Other" className="bg-slate-900">Other</option>
                    </PremiumSelect>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FloatingPremiumInput
                        label="Comm Identifier (Email)"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        icon={<MailIcon className="w-5 h-5" />}
                        className="!bg-white/[0.03]"
                    />
                    <FloatingPremiumInput
                        label="Mobile Linkage"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        icon={<PhoneIcon className="w-5 h-5" />}
                        className="!bg-white/[0.03]"
                    />
                </div>
            </div>

            <div className="flex justify-end items-center gap-8 pt-6 border-t border-white/5">
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 hover:text-white transition-all"
                >
                    Abort Registry
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="h-16 px-12 bg-white text-black rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.3em] hover:bg-primary hover:text-white transition-all shadow-3xl flex items-center min-w-[200px] justify-center active:scale-95 group"
                >
                    {loading ? <Spinner size="sm" /> : (
                        <div className="flex items-center gap-3">
                            Confirm Sync
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">&rarr;</span>
                        </div>
                    )}
                </button>
            </div>
        </form>
    );
};

export default SecondaryParentForm;