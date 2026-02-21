import React, { useMemo, useState, useEffect } from 'react';
import { ParentProfileData } from '../../types';
import { UserIcon } from '../icons/UserIcon';
import { PhoneIcon } from '../icons/PhoneIcon';
import { GlobeIcon } from '../icons/GlobeIcon';
import { LocationIcon } from '../icons/LocationIcon';
import { HomeIcon } from '../icons/HomeIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { ArrowRightIcon } from '../icons/ArrowRightIcon';
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

const PremiumFloatingInput: React.FC<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> & {
    label: string;
    icon?: React.ReactNode;
    isTextArea?: boolean;
    isSynced?: boolean;
    action?: React.ReactNode;
    helperText?: string;
    cornerHint?: string;
}> = ({ label, icon, isTextArea, isSynced, action, className, helperText, cornerHint, ...props }) => (
    <div className="relative group w-full mb-1">
        {label && (
            <div className="flex justify-between items-center mb-3 px-1">
                <label className={`text-[10px] font-black uppercase tracking-[0.3em] transition-all duration-500 italic
                    ${isSynced ? 'text-primary' : 'text-white/30 group-focus-within:text-primary'}`}>
                    {label}
                </label>
                {cornerHint && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-white/10">{cornerHint}</span>
                )}
            </div>
        )}

        <div className="relative">
            {icon && (
                <div className={`absolute ${isTextArea ? 'top-6' : 'top-1/2 -translate-y-1/2'} left-8 flex items-center justify-center transition-all duration-500 z-10 pointer-events-none 
                    ${isSynced ? 'text-primary' : 'text-white/15 group-focus-within:text-primary group-focus-within:scale-110'}`}>
                    {icon}
                </div>
            )}

            {isTextArea ? (
                <textarea
                    {...(props as any)}
                    placeholder=" "
                    className={`peer block w-full h-[140px] rounded-[2rem] border-2 transition-all duration-500 px-8 pl-18 pr-6 pt-5 pb-5 text-[14px] font-bold outline-none placeholder-transparent resize-none shadow-[inner_0_2px_4px_rgba(0,0,0,0.3)]
                        ${isSynced
                            ? 'border-primary/20 bg-primary/[0.03] text-white shadow-[0_0_30px_rgba(var(--primary),0.1)]'
                            : 'border-white/5 bg-[#0a0a0b] text-white hover:border-white/10 hover:bg-white/[0.02] focus:border-primary/40 focus:bg-[#121212] focus:ring-4 focus:ring-primary/10'
                        } 
                        ${className} ${icon ? 'pl-20' : ''}`}
                />
            ) : (
                <input
                    {...props}
                    placeholder=" "
                    className={`peer block w-full h-[68px] rounded-[1.8rem] border-2 transition-all duration-500 px-8 text-[14px] font-bold outline-none placeholder-transparent shadow-[inner_0_2px_4px_rgba(0,0,0,0.3)]
                        ${isSynced
                            ? 'border-primary/20 bg-primary/[0.03] text-white shadow-[0_0_30px_rgba(var(--primary),0.1)]'
                            : 'border-white/5 bg-[#0a0a0b] text-white hover:border-white/10 hover:bg-white/[0.02] focus:border-primary/40 focus:bg-[#121212] focus:ring-4 focus:ring-primary/10'
                        } 
                        ${className} ${icon ? 'pl-20' : ''}`}
                />
            )}

            {action && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20">
                    {action}
                </div>
            )}

            {isSynced && !action && (
                <div className="absolute right-6 top-1/2 -translate-y-1/2 animate-in zoom-in slide-in-from-left-2 duration-500">
                    <CheckCircleIcon className="w-5 h-5 text-primary" />
                </div>
            )}
        </div>

        {helperText && (
            <p className="mt-3 ml-4 text-[9px] text-white/15 font-bold uppercase tracking-[0.15em] opacity-0 -translate-y-1 group-focus-within:opacity-100 group-focus-within:translate-y-0 transition-all duration-500">
                {helperText}
            </p>
        )}
    </div>
);

interface FormProps {
    formData: Partial<ParentProfileData & { phone: string; display_name: string; }>;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    activeTab: 'details' | 'contact';
    isStrictReadOnly?: boolean;
}

const ParentForm: React.FC<FormProps> = ({ formData, handleChange, activeTab, isStrictReadOnly }) => {
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

    // Tab 1: Guardian Identity
    if (activeTab === 'details') {
        return (
            <div className="animate-in fade-in slide-in-from-right-8 duration-700 space-y-12 pb-24">

                {/* Core Registry Card */}
                <div className="relative group/card">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-[3.5rem] -z-10 blur-xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-1000" />

                    <div className="bg-[#0f1115]/80 backdrop-blur-2xl border border-white/5 rounded-[3.5rem] p-10 md:p-14 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                            <UsersIcon className="w-64 h-64" />
                        </div>

                        <div className="flex items-center gap-6 mb-12 relative z-10">
                            <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.1)]">
                                <UserIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-[0.2em] italic">Core Registry</h3>
                                <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.15em] mt-1">Primary Guardian Authority Node</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 relative z-10">
                            <PremiumFloatingInput
                                label="Full Legal Name"
                                name="display_name"
                                value={formData.display_name}
                                onChange={handleChange}
                                required
                                icon={<UserIcon className="w-5 h-5" />}
                                disabled={isStrictReadOnly}
                                helperText="Must match government ID"
                            />

                            <CustomSelect
                                label="Relationship Status"
                                value={formData.relationship_to_student || ''}
                                onChange={handleSelectChange('relationship_to_student')}
                                options={[{ value: 'Father', label: 'Father' }, { value: 'Mother', label: 'Mother' }, { value: 'Guardian', label: 'Legal Guardian' }, { value: 'Other', label: 'Authorized Affiliate' }]}
                                icon={<UsersIcon className="w-5 h-5" />}
                                disabled={isStrictReadOnly}
                                placeholder="Select Relation..."
                            />

                            <CustomSelect
                                label="Gender Node"
                                value={formData.gender || ''}
                                onChange={handleSelectChange('gender')}
                                options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Diverse' }, { value: 'Prefer not to say', label: 'Prefer not to say' }]}
                                icon={<UserIcon className="w-5 h-5" />}
                                disabled={isStrictReadOnly}
                            />

                            <CustomSelect
                                label="Family Magnitude"
                                value={String(formData.number_of_children || '1')}
                                onChange={handleSelectChange('number_of_children')}
                                options={[{ value: '1', label: 'Single Child' }, { value: '2', label: '2 Children' }, { value: '3', label: '3 Children' }, { value: '4', label: '4+ Children' }]}
                                icon={<UsersIcon className="w-5 h-5" />}
                                disabled={isStrictReadOnly}
                            />
                        </div>
                    </div>
                </div>

                {/* Auxiliary Guardian Card */}
                <div className="relative group/aux">
                    <div className="bg-[#0a0a0b]/60 backdrop-blur-xl border border-white/5 rounded-[3.5rem] p-10 md:p-14 shadow-xl hover:bg-[#0a0a0b]/80 transition-all duration-500 relative">

                        <div className="flex items-center justify-between mb-12">
                            <div className="flex items-center gap-6">
                                <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 text-white/30">
                                    <UsersIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white/60 uppercase tracking-[0.2em] italic">Auxiliary Guardian</h3>
                                    <p className="text-[10px] text-white/20 font-bold uppercase tracking-[0.15em] mt-1">Optional Emergency Contact</p>
                                </div>
                            </div>
                            <span className="px-4 py-2 rounded-full border border-white/5 bg-white/[0.02] text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Optional</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                            <PremiumFloatingInput
                                label="Auxiliary Name"
                                name="secondary_parent_name"
                                value={formData.secondary_parent_name || ''}
                                onChange={handleChange}
                                icon={<UserIcon className="w-5 h-5" />}
                                disabled={isStrictReadOnly}
                                helperText="Authorized emergency contact"
                            />

                            <CustomSelect
                                label="Affiliation"
                                value={formData.secondary_parent_relationship || ''}
                                onChange={(val) => handleChange({ target: { name: 'secondary_parent_relationship', value: val } } as any)}
                                options={[{ value: 'Father', label: 'Father' }, { value: 'Mother', label: 'Mother' }, { value: 'Guardian', label: 'Legal Guardian' }]}
                                icon={<UsersIcon className="w-5 h-5" />}
                                disabled={isStrictReadOnly}
                                placeholder="Not Selected"
                            />

                            <PremiumFloatingInput
                                label="Contact Node"
                                name="secondary_parent_phone"
                                value={formData.secondary_parent_phone || ''}
                                onChange={handleChange}
                                icon={<PhoneIcon className="w-5 h-5" />}
                                disabled={isStrictReadOnly}
                            />

                            <CustomSelect
                                label="Gender Identity"
                                value={formData.secondary_parent_gender || ''}
                                onChange={(val) => handleChange({ target: { name: 'secondary_parent_gender', value: val } } as any)}
                                options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Diverse' }]}
                                icon={<UserIcon className="w-5 h-5" />}
                                disabled={isStrictReadOnly}
                                placeholder="Not Selected"
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Tab 2: Contact & Node
    return (
        <div className="animate-in fade-in slide-in-from-right-8 duration-700 space-y-12 pb-24">

            {/* Sync Header */}
            <div className="rounded-[3rem] bg-gradient-to-r from-indigo-900/20 to-[#0a0a0b] border border-indigo-500/20 p-10 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group/sync">
                <div className="absolute inset-0 bg-indigo-600/5 blur-3xl opacity-50 group-hover/sync:opacity-100 transition-opacity" />

                <div className="flex items-center gap-8 relative z-10">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full" />
                        <div className="relative h-16 w-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/30 text-indigo-400 shadow-2xl">
                            <GlobeIcon className="w-7 h-7" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-[0.2em] italic">
                            Contact <span className="text-indigo-400">& Node</span>
                        </h3>
                        <p className="text-[11px] text-white/30 font-bold uppercase tracking-[0.2em] mt-2 flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full ${syncStatus ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
                            {syncStatus || 'Institutional Global Positioning System'}
                        </p>
                    </div>
                </div>

                <div className="relative z-10">
                    <button
                        type="button"
                        onClick={handleAutoLocate}
                        disabled={isLocating || isStrictReadOnly}
                        className="group/btn relative overflow-hidden rounded-2xl bg-indigo-600 px-8 py-4 font-black text-[11px] uppercase tracking-[0.3em] text-white shadow-2xl transition-all hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover/btn:animate-[shimmer_1.5s_infinite]" />
                        <span className="flex items-center gap-3">
                            {isLocating ? <Spinner size="sm" className="text-white" /> : <LocateFixedIcon className="w-4 h-4" />}
                            Auto-Sync Identity
                        </span>
                    </button>
                    {syncError && (
                        <p className={`absolute top-full mt-3 right-0 text-[9px] font-bold uppercase tracking-wider ${syncError.isWarning ? 'text-amber-400' : 'text-red-400'}`}>
                            {syncError.message}
                        </p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Contact Column */}
                <div className="bg-[#0f1115]/80 backdrop-blur border border-white/5 rounded-[3.5rem] p-10 flex flex-col gap-10 hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-4 pb-6 border-b border-white/5">
                        <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)]" />
                        <h4 className="text-[12px] font-black text-white/40 uppercase tracking-[0.3em]">Communication Node</h4>
                    </div>

                    <PremiumFloatingInput
                        label="Primary Mobile"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        icon={<PhoneIcon className="w-5 h-5" />}
                        disabled={isStrictReadOnly}
                        helperText="Emergency Alert System Linked"
                        cornerHint="Req"
                    />

                    <CustomSelect
                        label="Territory / Region"
                        value={formData.country || ''}
                        onChange={handleSelectChange('country')}
                        options={countries.map(c => ({ value: c, label: c }))}
                        icon={<GlobeIcon className="w-5 h-5" />}
                        placeholder="Select Region..."
                        searchable
                        isSynced={syncedFields.has('country')}
                        disabled={isStrictReadOnly}
                    />
                </div>

                {/* Address Column */}
                <div className="bg-[#0f1115]/80 backdrop-blur border border-white/5 rounded-[3.5rem] p-10 flex flex-col gap-10 hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-4 pb-6 border-b border-white/5">
                        <div className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.8)]" />
                        <h4 className="text-[12px] font-black text-white/40 uppercase tracking-[0.3em]">Residential Node</h4>
                    </div>

                    <PremiumFloatingInput
                        label="Full Address"
                        name="address"
                        value={formData.address}
                        onChange={handleChange as any}
                        isTextArea
                        isSynced={syncedFields.has('address')}
                        icon={<LocationIcon className="w-5 h-5" />}
                        disabled={isStrictReadOnly}
                        helperText="Official Geo-Coordinates"
                        action={
                            !isStrictReadOnly && (
                                <button
                                    type="button"
                                    onClick={handleResolveAddress}
                                    disabled={isResolving || !formData.address?.trim()}
                                    className="p-3 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors disabled:opacity-0 disabled:pointer-events-none"
                                    title="Auto-Resolve"
                                >
                                    {isResolving ? <Spinner size="sm" /> : <SparklesIcon className="w-4 h-4" />}
                                </button>
                            )
                        }
                    />
                </div>
            </div>

            {/* Data Mapping */}
            <div className="bg-[#0f1115]/80 backdrop-blur border border-white/5 rounded-[3.5rem] p-10 hover:border-white/10 transition-colors">
                <div className="flex items-center gap-4 mb-10 pb-6 border-b border-white/5">
                    <div className="h-2 w-2 rounded-full bg-indigo-400 shadow-[0_0_15px_rgba(129,140,248,0.8)]" />
                    <h4 className="text-[12px] font-black text-white/40 uppercase tracking-[0.3em]">Regional Mapping</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <CustomSelect
                        label="State / Province"
                        value={formData.state || ''}
                        onChange={handleSelectChange('state')}
                        options={availableStates.map(s => ({ value: s, label: s }))}
                        icon={loadingStates ? <Spinner size="sm" /> : <LocationIcon className="w-5 h-5" />}
                        disabled={!formData.country || isStrictReadOnly}
                        searchable
                        isSynced={syncedFields.has('state')}
                        placeholder={!formData.country ? "Disabled" : "Select State"}
                    />

                    <CustomSelect
                        label="City / District"
                        value={formData.city || ''}
                        onChange={handleSelectChange('city')}
                        options={availableCities.map(c => ({ value: c, label: c }))}
                        icon={loadingCities ? <Spinner size="sm" /> : <LocationIcon className="w-5 h-5" />}
                        disabled={!formData.state || isStrictReadOnly}
                        searchable
                        isSynced={syncedFields.has('city')}
                        placeholder={!formData.state ? "Disabled" : "Select City"}
                    />

                    <PremiumFloatingInput
                        label="Postal Code"
                        name="pin_code"
                        value={formData.pin_code}
                        onChange={handleChange}
                        isSynced={syncedFields.has('pin_code')}
                        icon={<LocationIcon className="w-5 h-5" />}
                        disabled={isStrictReadOnly}
                    />
                </div>
            </div>
        </div>
    );
};

export default ParentForm;
