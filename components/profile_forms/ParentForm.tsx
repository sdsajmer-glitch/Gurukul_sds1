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
            <label className={`absolute left-11 top-0 -translate-y-1/2 bg-[#0a0a0b] px-2 text-[10px] font-black uppercase tracking-[0.2em] z-20 transition-all duration-500 pointer-events-none rounded-lg
                ${isSynced ? 'text-primary' : 'text-white/40 group-focus-within:text-primary group-focus-within:scale-105'}`}>
                {label}
            </label>
        )}
        <div className={`absolute ${isTextArea ? 'top-6' : 'top-1/2 -translate-y-1/2'} left-4 text-white/20 group-focus-within:text-primary transition-all duration-500 z-10 pointer-events-none ${isSynced ? 'text-primary' : ''}`}>
            {icon}
        </div>
        {isTextArea ? (
            <textarea
                {...(props as any)}
                placeholder=" "
                className={`peer block w-full h-32 rounded-2xl border transition-all duration-500 px-6 pl-12 pr-12 pt-8 pb-4 text-[15px] font-medium outline-none placeholder-transparent resize-none shadow-inner
                    ${isSynced
                        ? 'border-primary/30 bg-primary/5 text-white shadow-[0_0_30px_rgba(var(--primary),0.1)]'
                        : 'border-white/5 bg-white/[0.02] text-white hover:border-white/10 hover:bg-white/[0.04] focus:border-primary/40 focus:bg-black/40 focus:ring-[12px] focus:ring-primary/5'
                    } 
                    ${className}`}
            />
        ) : (
            <input
                {...props}
                placeholder=" "
                className={`peer block w-full h-[64px] rounded-2xl border transition-all duration-500 px-6 pl-12 pt-2 text-[15px] font-medium outline-none placeholder-transparent shadow-inner
                    ${isSynced
                        ? 'border-primary/30 bg-primary/5 text-white shadow-[0_0_30px_rgba(var(--primary),0.1)]'
                        : 'border-white/5 bg-white/[0.02] text-white hover:border-white/10 hover:bg-white/[0.04] focus:border-primary/40 focus:bg-black/40 focus:ring-[12px] focus:ring-primary/5'
                    } 
                    ${className}`}
            />
        )}
        {action && (
            <div className="absolute right-4 top-4 z-30">
                {action}
            </div>
        )}
        {isSynced && !action && (
            <div className="absolute right-5 top-1/2 -translate-y-1/2 animate-in zoom-in duration-500">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/40 blur-md rounded-full" />
                    <CheckCircleIcon className="w-6 h-6 text-primary relative z-10" />
                </div>
            </div>
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

    if (activeTab === 'details') {
        return (
            <div className="animate-in fade-in slide-in-from-right-4 duration-700 space-y-12">
                {/* Primary Guardian Section */}
                <div className="relative group">
                    <div className="flex items-center gap-5 mb-8">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                            <div className="relative p-4 bg-gradient-to-br from-[#1a1c22] to-[#0f1116] rounded-2xl text-primary border border-primary/20 shadow-2xl ring-1 ring-white/5">
                                <UsersIcon className="w-6 h-6" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-base font-black text-white tracking-[0.2em] uppercase italic">
                                Guardian <span className="text-primary">Identity</span>
                            </h3>
                            <p className="text-[10px] text-white/30 font-bold tracking-[0.15em] uppercase mt-1">Primary Registry & Authority Node</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10 bg-white/[0.01] p-8 rounded-[2rem] border border-white/[0.03] backdrop-blur-sm">
                        <PremiumFloatingInput
                            label="Full Legal Name"
                            name="display_name"
                            value={formData.display_name}
                            onChange={handleChange}
                            required
                            icon={<UserIcon className="w-4 h-4" />}
                            disabled={isStrictReadOnly}
                        />

                        <CustomSelect
                            label="Relationship Status"
                            value={formData.relationship_to_student || ''}
                            onChange={handleSelectChange('relationship_to_student')}
                            options={[{ value: 'Father', label: 'Father' }, { value: 'Mother', label: 'Mother' }, { value: 'Guardian', label: 'Legal Guardian' }, { value: 'Other', label: 'Authorized Affiliate' }]}
                            icon={<UsersIcon className="w-4 h-4" />}
                            disabled={isStrictReadOnly}
                            placeholder="Select Relation..."
                        />

                        <CustomSelect
                            label="Gender Node"
                            value={formData.gender || ''}
                            onChange={handleSelectChange('gender')}
                            options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Diverse' }, { value: 'Prefer not to say', label: 'Prefer not to say' }]}
                            icon={<UserIcon className="w-4 h-4" />}
                            disabled={isStrictReadOnly}
                        />

                        <CustomSelect
                            label="Family Magnitude"
                            value={String(formData.number_of_children || '1')}
                            onChange={handleSelectChange('number_of_children')}
                            options={[{ value: '1', label: 'Single Child' }, { value: '2', label: '2 Children' }, { value: '3', label: '3 Children' }, { value: '4', label: '4+ Children' }]}
                            icon={<UsersIcon className="w-4 h-4" />}
                            disabled={isStrictReadOnly}
                        />
                    </div>
                </div>

                {/* Secondary Parent Section - Auxiliary Identity */}
                <div className="relative pt-12 border-t border-dashed border-white/10">
                    <div className="flex items-center gap-5 mb-8">
                        <div className="p-4 bg-white/[0.03] rounded-2xl text-white/20 border border-white/10 ring-1 ring-white/5">
                            <UsersIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-4">
                                <h3 className="text-sm font-black text-white/70 tracking-[0.2em] uppercase italic">Auxiliary Guardian</h3>
                                <span className="px-3 py-1 rounded-full text-[8px] font-black bg-white/5 text-white/40 border border-white/5 uppercase tracking-[0.2em] shadow-inner">Optional Node</span>
                            </div>
                            <p className="text-[10px] text-white/20 font-bold tracking-[0.1em] uppercase mt-1.5">Emergency contact & secondary authority.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10 px-8 py-10 bg-black/20 rounded-[2rem] border border-white/5 opacity-80 hover:opacity-100 transition-all duration-500 group/aux">
                        <PremiumFloatingInput
                            label="Legal Name"
                            name="secondary_parent_name"
                            value={formData.secondary_parent_name || ''}
                            onChange={handleChange}
                            icon={<UserIcon className="w-4 h-4" />}
                            disabled={isStrictReadOnly}
                            className="bg-transparent"
                        />

                        <CustomSelect
                            label="Affiliation"
                            value={formData.secondary_parent_relationship || ''}
                            onChange={(val) => handleChange({ target: { name: 'secondary_parent_relationship', value: val } } as any)}
                            options={[{ value: 'Father', label: 'Father' }, { value: 'Mother', label: 'Mother' }, { value: 'Guardian', label: 'Legal Guardian' }]}
                            icon={<UsersIcon className="w-4 h-4" />}
                            disabled={isStrictReadOnly}
                            placeholder="Not Selected"
                        />

                        <PremiumFloatingInput
                            label="Contact Node"
                            name="secondary_parent_phone"
                            value={formData.secondary_parent_phone || ''}
                            onChange={handleChange}
                            icon={<PhoneIcon className="w-4 h-4" />}
                            disabled={isStrictReadOnly}
                            className="bg-transparent"
                        />

                        <CustomSelect
                            label="Gender Identity"
                            value={formData.secondary_parent_gender || ''}
                            onChange={(val) => handleChange({ target: { name: 'secondary_parent_gender', value: val } } as any)}
                            options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Diverse' }]}
                            icon={<UserIcon className="w-4 h-4" />}
                            disabled={isStrictReadOnly}
                            placeholder="Not Selected"
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-700 space-y-12">
            <div className="flex items-center justify-between gap-6 p-8 rounded-[2rem] bg-gradient-to-br from-[#1a1c22] to-[#0a0a0b] border border-white/5 relative overflow-hidden group hover:border-[#333] transition-all duration-500 shadow-2xl">
                <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                <div className="flex items-center gap-5 relative z-10">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full opacity-50" />
                        <div className="relative p-4 bg-indigo-500/10 rounded-2xl text-indigo-400 border border-indigo-500/20 shadow-2xl ring-1 ring-white/5">
                            <HomeIcon className="w-6 h-6" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-base font-black text-white tracking-[0.2em] uppercase italic">
                            Residency <span className="text-indigo-400">&</span> Contact
                        </h3>
                        <p className="text-[10px] text-white/30 font-bold tracking-[0.15em] uppercase mt-1">{syncStatus || 'Institutional Telemetry & Mapping'}</p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleAutoLocate}
                    disabled={isLocating || isStrictReadOnly}
                    className={`h-[48px] px-8 rounded-xl font-black text-[10px] uppercase tracking-[0.25em] transition-all duration-500 border backdrop-blur-md relative z-10
                        ${isLocating
                            ? 'bg-primary/20 text-primary border-primary/40 animate-pulse'
                            : isStrictReadOnly
                                ? 'bg-white/5 text-white/10 border-white/5 cursor-not-allowed hidden'
                                : 'bg-white/5 text-white/60 border-white/10 hover:border-primary/40 hover:text-white hover:bg-white/10 active:scale-[0.98] shadow-2xl hover:shadow-primary/10'
                        }
                    `}
                >
                    {isLocating ? <Spinner size="sm" className="text-primary" /> : <><LocateFixedIcon className="w-4 h-4 inline mr-2 transform group-hover:rotate-90 transition-transform duration-700" /> Sync Node</>}
                </button>
            </div>

            <div className="space-y-16">
                {/* Section 1: Primary Contact */}
                <div className="space-y-8 glass-panel p-8 rounded-[2.5rem] bg-white/[0.01] border border-white/[0.03]">
                    <div className="flex items-center gap-4 pb-4 border-b border-white/[0.05]">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.8)]" />
                        <h4 className="text-[11px] font-black text-white/60 uppercase tracking-[0.25em]">Uplink Parameters</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <PremiumFloatingInput
                            label="Primary Mobile Node"
                            name="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={handleChange}
                            required
                            icon={<PhoneIcon className="w-4 h-4" />}
                            disabled={isStrictReadOnly}
                        />

                        <CustomSelect
                            label="Territory / Region"
                            value={formData.country || ''}
                            onChange={handleSelectChange('country')}
                            options={countries.map(c => ({ value: c, label: c }))}
                            icon={<GlobeIcon className="w-4 h-4" />}
                            placeholder="Select Region..."
                            searchable
                            isSynced={syncedFields.has('country')}
                            disabled={isStrictReadOnly}
                        />
                    </div>
                </div>

                {/* Section 2: Residential Address */}
                <div className="space-y-8 glass-panel p-8 rounded-[2.5rem] bg-white/[0.01] border border-white/[0.03]">
                    <div className="flex items-center gap-4 pb-4 border-b border-white/[0.05]">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
                        <h4 className="text-[11px] font-black text-white/60 uppercase tracking-[0.25em]">Physical Registry</h4>
                    </div>
                    <PremiumFloatingInput
                        label="Full Institutional Address"
                        name="address"
                        value={formData.address}
                        onChange={handleChange as any}
                        isTextArea
                        isSynced={syncedFields.has('address')}
                        icon={<LocationIcon className="w-4 h-4" />}
                        disabled={isStrictReadOnly}
                        action={
                            !isStrictReadOnly && (
                                <button
                                    type="button"
                                    onClick={handleResolveAddress}
                                    disabled={isResolving || !formData.address?.trim()}
                                    className="px-4 py-2 flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.2em] text-primary bg-primary/5 border border-primary/20 hover:bg-primary/10 rounded-xl transition-all duration-300 disabled:opacity-0 disabled:pointer-events-none shadow-lg hover:shadow-primary/5 active:scale-95"
                                    title="Auto-fill city, state, country"
                                >
                                    {isResolving ? <Spinner size="sm" /> : <><SparklesIcon className="w-4 h-4" /> <span>Provision Data</span></>}
                                </button>
                            )
                        }
                    />
                </div>

                {/* Section 3: Regional Mapping */}
                <div className="space-y-8 glass-panel p-8 rounded-[2.5rem] bg-white/[0.01] border border-white/[0.03]">
                    <div className="flex items-center gap-4 pb-4 border-b border-white/[0.05]">
                        <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.8)]" />
                        <h4 className="text-[11px] font-black text-white/60 uppercase tracking-[0.25em]">Mapping Protocol</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10 relative z-20">
                        <CustomSelect
                            label="State / Province"
                            value={formData.state || ''}
                            onChange={handleSelectChange('state')}
                            options={availableStates.map(s => ({ value: s, label: s }))}
                            icon={loadingStates ? <Spinner size="sm" /> : <LocationIcon className="w-4 h-4" />}
                            disabled={!formData.country || isStrictReadOnly}
                            searchable
                            isSynced={syncedFields.has('state')}
                            placeholder={!formData.country ? "Select Country First" : "Select State"}
                        />
                        <CustomSelect
                            label="City / District"
                            value={formData.city || ''}
                            onChange={handleSelectChange('city')}
                            options={availableCities.map(c => ({ value: c, label: c }))}
                            icon={loadingCities ? <Spinner size="sm" /> : <LocationIcon className="w-4 h-4" />}
                            disabled={!formData.state || isStrictReadOnly}
                            searchable
                            isSynced={syncedFields.has('city')}
                            placeholder={!formData.state ? "Select State First" : "Select City"}
                        />
                        <PremiumFloatingInput
                            label="Postal Code"
                            name="pin_code"
                            value={formData.pin_code}
                            onChange={handleChange}
                            isSynced={syncedFields.has('pin_code')}
                            icon={<LocationIcon className="w-4 h-4" />}
                            disabled={isStrictReadOnly}
                        />
                    </div>
                    <div className="flex items-center justify-center gap-3 pt-6">
                        <div className="h-px flex-grow bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
                        <p className="text-[9px] text-white/20 font-black uppercase tracking-[0.3em] text-center px-4">
                            * Institutional transport node correlation protocol
                        </p>
                        <div className="h-px flex-grow bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ParentForm;
