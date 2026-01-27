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

import PremiumFloatingInput from '../common/PremiumFloatingInput';

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
    const [syncError, setSyncError] = useState<{ message: string, isWarning: boolean, detail?: string } | null>(null);
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
        setSyncStatus('Synchronizing Geocodes...');
        setSyncError(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
            const prompt = `System: You are an advanced geospatial address normalization node.
            Task: Extract structured residency data from the following address string.
            Address: "${formData.address}"
            
            Strict Requirements:
            1. Country MUST be one of: ${countries.join(', ')}.
            2. State MUST be a valid administrative department/state in that country.
            3. City MUST be a major urban center in that state.
            4. PIN Code must be the numeric postal code identified.
            
            Output strictly as a valid JSON object with the following keys: "city", "state", "country", "pin".
            Example: {"city": "New York", "state": "New York", "country": "United States", "pin": "10001"}
            
            JSON Output:`;

            const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: prompt
            });

            const text = response.text || '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                const foundFields: string[] = [];

                if (data.country) {
                    handleSelectChange('country', false)(data.country);
                    foundFields.push('country');
                }
                if (data.state) {
                    handleSelectChange('state', false)(data.state);
                    foundFields.push('state');
                }
                if (data.city) {
                    handleSelectChange('city', false)(data.city);
                    foundFields.push('city');
                }
                if (data.pin) {
                    handleChange({ target: { name: 'pin_code', value: data.pin } } as any);
                    foundFields.push('pin_code');
                }

                setSyncedFields(prev => new Set([...Array.from(prev), ...foundFields]));
                setSyncStatus(`Registry Updated: ${foundFields.length} Nodes Synchronized.`);
                setTimeout(() => setSyncStatus(''), 4000);
            } else {
                throw new Error("Geospatial parse failure.");
            }
        } catch (err) {
            console.error("Resolve failed", err);
            setSyncError({
                message: "Sync Interrupted.",
                detail: "The registry could not resolve this address automatically. Manual node entry is required.",
                isWarning: true
            });
        } finally {
            setIsResolving(false);
        }
    };

    const handleAutoLocate = async () => {
        setIsLocating(true);
        setSyncStatus('Establishing Satellite Link...');
        setSyncError(null);
        setSyncedFields(new Set());

        if (!navigator.geolocation) {
            setSyncError({ message: "Telemetry Fault.", detail: "Geolocation nodes are disabled or unsupported by your device.", isWarning: false });
            setIsLocating(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
                const prompt = `Identify official address for coordinates: ${latitude}, ${longitude}. 
                Output strictly as a valid JSON object with the following keys: "address", "city", "state", "country", "pin_code".
                Example: {"address": "1600 Amphitheatre Parkway", "city": "Mountain View", "state": "California", "country": "United States", "pin_code": "94043"}
                
                JSON Output:`;

                const response = await ai.models.generateContent({
                    model: 'gemini-1.5-flash',
                    contents: prompt
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

                    setSyncStatus('Terminal Registry Synchronized.');
                    setTimeout(() => setSyncStatus(''), 4000);
                }
            } catch (err: any) {
                setSyncError({ message: "Sync Timeout.", detail: "Spatial telemetry failed. Please enter residency nodes manually.", isWarning: true });
            } finally {
                setIsLocating(false);
            }
        }, () => {
            setSyncError({ message: "Access Denied.", detail: "Residency sync requires location permissions. Check browser protocols.", isWarning: true });
            setIsLocating(false);
        });
    };

    if (activeTab === 'details') {
        return (
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-12"
            >
                <div className="flex items-center justify-between mb-4 group/header">
                    <div className="flex items-center gap-6">
                        <div className="p-5 bg-primary/10 rounded-[1.5rem] text-primary border border-primary/20 shadow-[0_0_30px_rgba(var(--primary),0.1)] group-hover/header:shadow-[0_0_40px_rgba(var(--primary),0.25)] transition-all duration-700">
                            <UsersIcon className="w-7 h-7" />
                        </div>
                        <div>
                            <h3 className="text-[13px] font-black text-white tracking-[0.3em] uppercase glow-text mb-1">Guardian Identity</h3>
                            <p className="text-[11px] text-white/30 font-bold tracking-widest">Institutional verification & relationship nodes.</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-16 bg-white/[0.02] p-10 rounded-[3rem] border border-white/5 shadow-inner">
                    <PremiumFloatingInput label="Full Legal Name" name="display_name" value={formData.display_name} onChange={handleChange} required icon={<UserIcon />} />

                    <CustomSelect
                        label="Relationship Status"
                        value={formData.relationship_to_student || ''}
                        onChange={handleSelectChange('relationship_to_student')}
                        options={[{ value: 'Father', label: 'Father' }, { value: 'Mother', label: 'Mother' }, { value: 'Guardian', label: 'Legal Guardian' }, { value: 'Other', label: 'Authorized Affiliate' }]}
                        icon={<UsersIcon />}
                    />

                    <CustomSelect
                        label="Gender"
                        value={formData.gender || ''}
                        onChange={handleSelectChange('gender')}
                        options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Diverse' }, { value: 'Prefer not to say', label: 'Prefer not to say' }]}
                        icon={<UserIcon />}
                    />

                    <CustomSelect
                        label="Family Size"
                        value={String(formData.number_of_children || '1')}
                        onChange={handleSelectChange('number_of_children')}
                        options={[{ value: '1', label: 'Single Child' }, { value: '2', label: '2 Children' }, { value: '3', label: '3 Children' }, { value: '4', label: '4+ Children' }]}
                        icon={<UsersIcon />}
                    />
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-12"
        >
            <div className="flex items-center justify-between gap-10 p-12 rounded-[3.5rem] bg-indigo-500/[0.04] border border-indigo-500/20 relative overflow-hidden group/loc shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-3xl">
                {/* Advanced Telemetry Background */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-[120px] group-hover/loc:scale-150 transition-transform duration-1000 animate-pulse" />
                <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-blue-500/5 rounded-full blur-[100px]" />

                <div className="flex items-center gap-10 relative z-10">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500/20 rounded-[2rem] blur-xl animate-pulse" />
                        <div className="relative p-6 bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 rounded-[2rem] text-indigo-400 border border-indigo-500/30 shadow-2xl">
                            <HomeIcon className="w-8 h-8" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-[15px] font-black text-white tracking-[0.4em] uppercase mb-2 glow-text">Registry Synchronization</h3>
                        <p className="text-[12px] text-white/40 font-bold tracking-[0.05em] min-h-[1.5em] flex items-center max-w-md leading-relaxed">
                            {syncStatus ? (
                                <span className="text-indigo-400 animate-pulse font-black drop-shadow-[0_0_10px_rgba(129,140,248,0.5)]">{syncStatus}</span>
                            ) : 'Establish a high-fidelity satellite uplink to auto-populate residency nodes.'}
                        </p>
                    </div>
                </div>

                <motion.button
                    whileHover={{ scale: 1.02, boxShadow: '0 0 40px rgba(99,102,241,0.2)' }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={handleAutoLocate}
                    disabled={isLocating}
                    className={`h-[72px] px-12 rounded-[2rem] font-black text-[13px] uppercase tracking-[0.3em] transition-all duration-700 border-2 relative z-10 overflow-hidden flex items-center justify-center
                        ${isLocating
                            ? 'bg-indigo-500/20 text-indigo-100 border-indigo-400/40'
                            : 'bg-white/5 text-white/70 border-white/10 hover:border-indigo-400/50 hover:text-white hover:bg-indigo-600/10'
                        }
                    `}
                >
                    {isLocating ? (
                        <div className="flex items-center gap-4">
                            <Spinner size="sm" className="text-indigo-100" />
                            <span className="animate-pulse">Locking Signal...</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-5">
                            <LocateFixedIcon className="w-6 h-6 transition-transform group-hover/loc:rotate-180 duration-1000" />
                            Initialize Sync
                        </div>
                    )}
                </motion.button>
            </div>

            <div className="space-y-12 bg-white/[0.01] p-10 rounded-[3rem] border border-white/[0.03]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <PremiumFloatingInput
                        label="Primary Mobile"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        icon={<PhoneIcon />}
                    />

                    <CustomSelect
                        label="Country"
                        value={formData.country || ''}
                        onChange={handleSelectChange('country')}
                        options={countries.map(c => ({ value: c, label: c }))}
                        icon={<GlobeIcon />}
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
                        icon={<LocationIcon />}
                        action={
                            <motion.button
                                whileHover={{ scale: 1.1, rotate: 15 }}
                                whileTap={{ scale: 0.9 }}
                                type="button"
                                onClick={handleResolveAddress}
                                disabled={isResolving || !formData.address?.trim()}
                                className="p-4 bg-primary/10 text-primary rounded-2xl transition-all shadow-xl shadow-primary/10 hover:shadow-primary/30 border border-primary/20 backdrop-blur-md"
                                title="Auto-fill city, state, country"
                            >
                                {isResolving ? <Spinner size="sm" /> : <SparklesIcon className="w-5 h-5" />}
                            </motion.button>
                        }
                    />
                </div>

                {/* Ultra-World-Class Symmetrical Registry Grid: 4-4-4 Sibling Architecture */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-x-12 gap-y-16 items-end">
                    <div className="md:col-span-4 transition-all duration-700 hover:scale-[1.015] group/state">
                        <CustomSelect
                            label="State Protocol"
                            value={formData.state || ''}
                            onChange={handleSelectChange('state')}
                            options={availableStates.map(s => ({ value: s, label: s }))}
                            icon={loadingStates ? <Spinner size="sm" /> : <LocationIcon />}
                            disabled={!formData.country}
                            searchable
                            isSynced={syncedFields.has('state')}
                        />
                    </div>
                    <div className="md:col-span-4 transition-all duration-700 hover:scale-[1.015] group/city">
                        <CustomSelect
                            label="City Module"
                            value={formData.city || ''}
                            onChange={handleSelectChange('city')}
                            options={availableCities.map(c => ({ value: c, label: c }))}
                            icon={loadingCities ? <Spinner size="sm" /> : <LocationIcon />}
                            disabled={!formData.state}
                            searchable
                            isSynced={syncedFields.has('city')}
                        />
                    </div>
                    <div className="md:col-span-4 transition-all duration-700 hover:scale-[1.015] group/pin">
                        <PremiumFloatingInput
                            label="PIN NODE"
                            name="pin_code"
                            value={formData.pin_code}
                            onChange={handleChange}
                            isSynced={syncedFields.has('pin_code')}
                            icon={<LocationIcon />}
                            className="ring-2 ring-white/5 hover:ring-primary/40 transition-all duration-500 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.4)]"
                        />
                    </div>
                </div>
            </div>

            {syncError && (
                <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`p-10 rounded-[3rem] border-2 flex items-start gap-8 transition-all duration-700 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)] backdrop-blur-3xl relative overflow-hidden
                        ${syncError.isWarning
                            ? 'bg-amber-500/[0.05] border-amber-500/20 text-amber-100'
                            : 'bg-red-500/[0.05] border-red-500/20 text-red-100'
                        }`}
                >
                    <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] ${syncError.isWarning ? 'bg-amber-500/10' : 'bg-red-500/10'}`} />

                    <div className={`p-5 rounded-2xl flex-shrink-0 border ${syncError.isWarning ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-red-500/20 border-red-500/30 text-red-400'}`}>
                        {syncError.isWarning ? <AlertTriangleIcon className="w-8 h-8" /> : <XCircleIcon className="w-8 h-8" />}
                    </div>
                    <div className="space-y-3 relative z-10">
                        <h4 className="text-[14px] font-black uppercase tracking-[0.3em] font-serif">{syncError.message}</h4>
                        <p className="text-[12px] opacity-70 font-medium leading-relaxed tracking-wide max-w-2xl">{syncError.detail}</p>
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
};

export default ParentForm;
