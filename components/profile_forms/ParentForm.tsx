import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ParentProfileData } from '../../types';
import { UserIcon } from '../icons/UserIcon';
import { PhoneIcon } from '../icons/PhoneIcon';
import { GlobeIcon } from '../icons/GlobeIcon';
import { LocationIcon } from '../icons/LocationIcon';
import { HomeIcon } from '../icons/HomeIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { XCircleIcon } from '../icons/XCircleIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import CustomSelect from '../common/CustomSelect';
import { countries, statesByCountry, citiesByState } from '../data/locations';
import Spinner from '../common/Spinner';
import { GoogleGenAI } from '@google/genai';

const LocateFixedIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
    </svg>
);

const PremiumFloatingInput: React.FC<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> & { label: string; icon?: React.ReactNode; isTextArea?: boolean; isSynced?: boolean; action?: React.ReactNode }> = ({ label, icon, isTextArea, isSynced, action, className, ...props }) => (
    <div className="relative group w-full">
        {label && (
            <label className={`absolute left-11 top-0 -translate-y-1/2 bg-slate-900/90 px-1.5 text-[10px] font-bold uppercase tracking-widest z-20 transition-all duration-300 pointer-events-none
                ${isSynced ? 'text-primary' : 'text-white/30 group-focus-within:text-primary'}`}>
                {label}
            </label>
        )}
        <div className={`absolute ${isTextArea ? 'top-5' : 'top-1/2 -translate-y-1/2'} left-4 text-white/10 group-focus-within:text-primary transition-all duration-300 z-10 pointer-events-none ${isSynced ? 'text-primary/60' : ''}`}>
            {icon}
        </div>
        {isTextArea ? (
            <textarea
                {...(props as any)}
                placeholder=" "
                className={`peer block w-full h-24 rounded-xl border transition-all duration-300 px-5 pl-12 pr-12 pt-5 pb-2 text-[15px] text-white font-medium outline-none placeholder-transparent
                    ${isSynced ? 'border-primary/40 bg-primary/5 shadow-[0_0_15px_rgba(var(--primary),0.05)]' : 'border-white/10 bg-black/30 hover:border-white/20 focus:border-primary/40 focus:ring-4 focus:ring-primary/5'} 
                    ${className}`}
            />
        ) : (
            <input
                {...props}
                placeholder=" "
                className={`peer block w-full h-[48px] rounded-xl border transition-all duration-300 px-5 pl-12 pt-4 pb-1 text-[15px] text-white font-medium outline-none placeholder-transparent
                    ${isSynced ? 'border-primary/40 bg-primary/5 shadow-[0_0_15px_rgba(var(--primary),0.05)]' : 'border-white/10 bg-black/30 hover:border-white/20 focus:border-primary/40 focus:ring-4 focus:ring-primary/5'} 
                    ${className}`}
            />
        )}
        {action && (
            <div className="absolute right-3 top-3 z-30">
                {action}
            </div>
        )}
        {isSynced && !action && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-in zoom-in-95 duration-500">
                <CheckCircleIcon className="w-4 h-4 text-primary shadow-[0_0_10px_rgba(var(--primary),0.4)]" />
            </div>
        )}
    </div>
);

interface FormProps {
    formData: Partial<ParentProfileData & { phone: string; display_name: string; }>;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    activeTab: 'details' | 'contact';
}

const ParentForm: React.FC<FormProps> = ({ formData, handleChange, activeTab }) => {
    const [loadingStates, setLoadingStates] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [isResolving, setIsResolving] = useState(false);
    const [syncStatus, setSyncStatus] = useState<string>('');
    const [syncError, setSyncError] = useState<{ message: string, isWarning: boolean } | null>(null);
    const [syncedFields, setSyncedFields] = useState<Set<string>>(new Set());

    const availableStates = useMemo(() => formData.country ? statesByCountry[formData.country] || [] : [], [formData.country]);
    const availableCities = useMemo(() => formData.state ? citiesByState[formData.state] || [] : [], [formData.state]);

    const handleSelectChange = (name: string, isManual = true) => (value: string) => {
        handleChange({ target: { name, value } } as any);

        if (name === 'relationship_to_student') {
            if (value === 'Father') handleChange({ target: { name: 'gender', value: 'Male' } } as any);
            else if (value === 'Mother') handleChange({ target: { name: 'gender', value: 'Female' } } as any);
        }

        if (isManual) {
            if (name === 'country') {
                setLoadingStates(true);
                handleChange({ target: { name: 'state', value: '' } } as any);
                handleChange({ target: { name: 'city', value: '' } } as any);
                setTimeout(() => setLoadingStates(false), 300);
            }
            if (name === 'state') {
                setLoadingCities(true);
                handleChange({ target: { name: 'city', value: '' } } as any);
                setTimeout(() => setLoadingCities(false), 300);
            }
            const next = new Set(syncedFields);
            next.delete(name);
            setSyncedFields(next);
        }
    };

    const handleResolveAddress = async () => {
        if (!formData.address?.trim()) return;
        setIsResolving(true);
        setSyncStatus('Resolving Address...');
        setSyncError(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Based on the residential address "${formData.address}", extract or identify city, state, and country.
            Output Strictly as valid JSON: {"city": "string", "state": "string", "country": "string"}.
            Country must match one of: ${countries.join(', ')}.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { tools: [{ googleMaps: {} }] }
            });

            const text = response.text || '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                const fields = ['country', 'state', 'city'];
                setSyncedFields(new Set(fields));

                if (data.country) handleSelectChange('country', false)(data.country);
                if (data.state) handleSelectChange('state', false)(data.state);
                if (data.city) handleSelectChange('city', false)(data.city);

                setSyncStatus('Address Resolved.');
                setTimeout(() => setSyncStatus(''), 3000);
            }
        } catch (err) {
            console.error("Resolve failed", err);
            setSyncError({ message: "Auto-fill failed. Please enter manually.", isWarning: true });
        } finally {
            setIsResolving(false);
        }
    };

    const handleAutoLocate = async () => {
        setIsLocating(true);
        setSyncStatus('Resolving Telemetry...');
        setSyncError(null);
        setSyncedFields(new Set());

        if (!navigator.geolocation) {
            setSyncError({ message: "Geolocation not supported.", isWarning: false });
            setIsLocating(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const prompt = `Identify official address for coordinates: ${latitude}, ${longitude}. 
                Output JSON: {"address": string, "city": string, "state": string, "country": string, "pin_code": string}. 
                Country must be full name. Use official registry names.`;

                const response = await ai.models.generateContent({
                    // FIX: Maps grounding is strictly supported on Gemini 2.5 series models only per GenAI guidelines
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: {
                        tools: [{ googleMaps: {} }],
                        toolConfig: { retrievalConfig: { latLng: { latitude, longitude } } }
                    }
                });

                const text = response.text || '';
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const data = JSON.parse(jsonMatch[0]);
                    const fields = ['country', 'state', 'city', 'address', 'pin_code'];
                    setSyncedFields(new Set(fields));

                    if (data.country) handleSelectChange('country', false)(data.country);
                    if (data.state) handleSelectChange('state', false)(data.state);
                    if (data.city) handleSelectChange('city', false)(data.city);
                    if (data.address) handleChange({ target: { name: 'address', value: data.address } } as any);
                    if (data.pin_code) handleChange({ target: { name: 'pin_code', value: data.pin_code } } as any);

                    setSyncStatus('Identity Synced.');
                    setTimeout(() => setSyncStatus(''), 3000);
                }
            } catch (err: any) {
                setSyncError({ message: "Detection failed. Manual entry required.", isWarning: true });
            } finally {
                setIsLocating(false);
            }
        }, () => {
            setSyncError({ message: "Location access denied.", isWarning: true });
            setIsLocating(false);
        });
    };

    if (activeTab === 'details') {
        return (
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-10"
            >
                <div className="flex items-center gap-6 mb-8 group/header">
                    <div className="p-4 bg-primary/10 rounded-2xl text-primary border border-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.15)] group-hover/header:shadow-[0_0_30px_rgba(var(--primary),0.3)] transition-all duration-500">
                        <UsersIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-white tracking-[0.2em] uppercase glow-text">Guardian Identity</h3>
                        <p className="text-xs text-white/40 font-medium tracking-widest mt-1">Institutional verification & relationship nodes.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <PremiumFloatingInput label="Full Legal Name" name="display_name" value={formData.display_name} onChange={handleChange} required icon={<UserIcon className="w-4 h-4" />} />

                    <CustomSelect
                        label="Relationship Status"
                        value={formData.relationship_to_student || ''}
                        onChange={handleSelectChange('relationship_to_student')}
                        options={[{ value: 'Father', label: 'Father' }, { value: 'Mother', label: 'Mother' }, { value: 'Guardian', label: 'Legal Guardian' }, { value: 'Other', label: 'Authorized Affiliate' }]}
                        icon={<UsersIcon className="w-4 h-4" />}
                    />

                    <CustomSelect
                        label="Gender"
                        value={formData.gender || ''}
                        onChange={handleSelectChange('gender')}
                        options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Diverse' }, { value: 'Prefer not to say', label: 'Prefer not to say' }]}
                        icon={<UserIcon className="w-4 h-4" />}
                    />

                    <CustomSelect
                        label="Family Size"
                        value={String(formData.number_of_children || '1')}
                        onChange={handleSelectChange('number_of_children')}
                        options={[{ value: '1', label: 'Single Child' }, { value: '2', label: '2 Children' }, { value: '3', label: '3 Children' }, { value: '4', label: '4+ Children' }]}
                        icon={<UsersIcon className="w-4 h-4" />}
                    />
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-10"
        >
            <div className="flex items-center justify-between gap-8 p-8 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 relative overflow-hidden group/loc">
                {/* Decorative background pulse */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover/loc:scale-150 transition-transform duration-700" />

                <div className="flex items-center gap-6 relative z-10">
                    <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-400 border border-indigo-500/20 shadow-xl">
                        <HomeIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-white tracking-[0.2em] uppercase">Residency & Contact</h3>
                        <p className="text-xs text-white/40 font-medium tracking-widest mt-1">
                            {syncStatus ? (
                                <span className="text-indigo-400 animate-pulse font-bold">{syncStatus}</span>
                            ) : 'Primary contact & telemetry synchronization.'}
                        </p>
                    </div>
                </div>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={handleAutoLocate}
                    disabled={isLocating}
                    className={`h-[48px] px-8 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all duration-500 border relative z-10 overflow-hidden
                        ${isLocating
                            ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40 animate-pulse'
                            : 'bg-white/5 text-white/50 border-white/5 hover:border-indigo-400 hover:text-white hover:shadow-[0_0_20px_rgba(99,102,241,0.2)]'
                        }
                    `}
                >
                    {isLocating ? (
                        <Spinner size="sm" className="text-indigo-400" />
                    ) : (
                        <div className="flex items-center gap-3">
                            <LocateFixedIcon className="w-4 h-4" />
                            Locate Node
                        </div>
                    )}
                </motion.button>
            </div>

            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <PremiumFloatingInput
                        label="Primary Mobile"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        icon={<PhoneIcon className="w-4 h-4" />}
                    />

                    <CustomSelect
                        label="Country"
                        value={formData.country || ''}
                        onChange={handleSelectChange('country')}
                        options={countries.map(c => ({ value: c, label: c }))}
                        icon={<GlobeIcon className="w-4 h-4" />}
                        placeholder="Select Region..."
                        searchable
                        isSynced={syncedFields.has('country')}
                    />
                </div>

                <div className="relative group">
                    <PremiumFloatingInput
                        label="Full Residential Address"
                        name="address"
                        value={formData.address}
                        onChange={handleChange as any}
                        isTextArea
                        isSynced={syncedFields.has('address')}
                        icon={<LocationIcon className="w-4 h-4" />}
                        action={
                            <motion.button
                                whileHover={{ scale: 1.1, rotate: 15 }}
                                whileTap={{ scale: 0.9 }}
                                type="button"
                                onClick={handleResolveAddress}
                                disabled={isResolving || !formData.address?.trim()}
                                className="p-3 bg-primary/10 text-primary rounded-xl transition-all shadow-lg shadow-primary/10 hover:shadow-primary/20 border border-primary/20"
                                title="Auto-fill city, state, country"
                            >
                                {isResolving ? <Spinner size="sm" /> : <SparklesIcon className="w-5 h-5" />}
                            </motion.button>
                        }
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <CustomSelect
                        label="State"
                        value={formData.state || ''}
                        onChange={handleSelectChange('state')}
                        options={availableStates.map(s => ({ value: s, label: s }))}
                        icon={loadingStates ? <Spinner size="sm" /> : <LocationIcon className="w-4 h-4" />}
                        disabled={!formData.country}
                        searchable
                        isSynced={syncedFields.has('state')}
                    />
                    <CustomSelect
                        label="City"
                        value={formData.city || ''}
                        onChange={handleSelectChange('city')}
                        options={availableCities.map(c => ({ value: c, label: c }))}
                        icon={loadingCities ? <Spinner size="sm" /> : <LocationIcon className="w-4 h-4" />}
                        disabled={!formData.state}
                        searchable
                        isSynced={syncedFields.has('city')}
                    />
                    <PremiumFloatingInput
                        label="Pin Code"
                        name="pin_code"
                        value={formData.pin_code}
                        onChange={handleChange}
                        isSynced={syncedFields.has('pin_code')}
                        icon={<LocationIcon className="w-4 h-4" />}
                    />
                </div>
            </div>
        </motion.div>
    );
};

export default ParentForm;
