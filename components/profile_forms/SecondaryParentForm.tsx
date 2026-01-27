import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PremiumFloatingInput from '../common/PremiumFloatingInput';
import CustomSelect from '../common/CustomSelect';
import Spinner from '../common/Spinner';
import { UserIcon } from '../icons/UserIcon';
import { MailIcon } from '../icons/MailIcon';
import { PhoneIcon } from '../icons/PhoneIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';

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
        const all = ['Father', 'Mother', 'Guardian', 'Other'];
        if (!primaryRelationship) return all;
        return all.filter(r => r !== primaryRelationship);
    }, [primaryRelationship]);

    useEffect(() => {
        if (!initialData.name && !formData.relationship) {
            if (primaryRelationship === 'Father') {
                setFormData(prev => ({ ...prev, relationship: 'Mother', gender: 'Female' }));
            } else if (primaryRelationship === 'Mother') {
                setFormData(prev => ({ ...prev, relationship: 'Father', gender: 'Male' }));
            }
        }
    }, [initialData.name, primaryRelationship]);

    const handleSelectChange = (name: string) => (value: string) => {
        setFormData(prev => {
            const next = { ...prev, [name]: value };
            if (name === 'relationship') {
                if (value === 'Father') next.gender = 'Male';
                else if (value === 'Mother') next.gender = 'Female';
            }
            return next;
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="relative group space-y-12"
        >
            {/* Background Glow */}
            <div className="absolute -inset-4 bg-primary/5 rounded-[4rem] blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-1000" />

            <div className="relative bg-[#0a0b10]/60 backdrop-blur-3xl p-10 rounded-[3.5rem] border border-white/5 shadow-2xl space-y-12">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-primary/10 rounded-2xl text-primary border border-primary/20">
                            <UsersIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-[12px] font-black text-white tracking-[0.3em] uppercase mb-1">Affiliate Protocol</h3>
                            <p className="text-[10px] text-white/30 font-bold tracking-widest uppercase">Secondary administrative guardian contact.</p>
                        </div>
                    </div>
                    <div className="px-6 py-2 rounded-full bg-white/5 border border-white/5 text-[9px] font-black text-white/20 uppercase tracking-widest">
                        Secondary Node
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="md:col-span-2">
                        <PremiumFloatingInput
                            label="Guardian Full Legal Name"
                            name="name"
                            type="text"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            icon={<UserIcon />}
                        />
                    </div>

                    <CustomSelect
                        label="Relationship Node"
                        value={formData.relationship}
                        onChange={handleSelectChange('relationship')}
                        options={availableRelationships.map(r => ({ value: r, label: r }))}
                        icon={<UsersIcon />}
                        placeholder="Select Relationship..."
                    />

                    <CustomSelect
                        label="Gender Matrix"
                        value={formData.gender}
                        onChange={handleSelectChange('gender')}
                        disabled={formData.relationship === 'Father' || formData.relationship === 'Mother'}
                        options={[
                            { value: 'Male', label: 'Male' },
                            { value: 'Female', label: 'Female' },
                            { value: 'Other', label: 'Diverse' },
                            { value: 'Prefer not to say', label: 'Hidden' }
                        ]}
                        icon={<UserIcon />}
                        placeholder="Select Gender..."
                    />

                    <PremiumFloatingInput
                        label="Communication Email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        icon={<MailIcon />}
                    />

                    <PremiumFloatingInput
                        label="Mobile Terminal"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        icon={<PhoneIcon />}
                    />
                </div>

                <div className="flex justify-end items-center gap-6 pt-6 pt-12 border-t border-white/5">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30 hover:text-white/60 transition-all px-8 py-4"
                    >
                        Abort Sync
                    </button>
                    <motion.button
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        type="submit"
                        disabled={loading}
                        className="h-[64px] px-12 rounded-2xl bg-primary text-white font-black text-[13px] uppercase tracking-[0.3em] shadow-[0_20px_40px_-10px_rgba(var(--primary),0.4)] hover:shadow-[0_30px_60px_-10px_rgba(var(--primary),0.6)] flex items-center gap-4 transition-all disabled:opacity-50"
                    >
                        {loading ? <Spinner size="sm" /> : (
                            <>
                                <CheckCircleIcon className="w-5 h-5" />
                                Validate & Seal
                            </>
                        )}
                    </motion.button>
                </div>
            </div>
        </motion.form>
    );
};

export default SecondaryParentForm;