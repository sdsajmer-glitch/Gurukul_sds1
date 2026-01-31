import React, { useMemo, useState } from 'react';
import { ParentProfileData } from '../../types';
import { UserIcon } from '../icons/UserIcon';
import { PhoneIcon } from '../icons/PhoneIcon';
import { GlobeIcon } from '../icons/GlobeIcon';
import { LocationIcon } from '../icons/LocationIcon';
import { HomeIcon } from '../icons/HomeIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { countries, statesByCountry, citiesByState } from '../data/locations';
import Spinner from '../common/Spinner';
import { GoogleGenAI } from '@google/genai';
import { FloatingPremiumInput, PremiumSelect } from '../common/Inputs';

const LocateFixedIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
    </svg>
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

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Based on the residential address "${formData.address}", extract or identify city, state, and country.
            Output Strictly as valid JSON: {"city": "string", "state": "string", "country": "string"}.
            Country must match one of: India, USA, Dubai, etc.`;

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
        } finally {
            setIsResolving(false);
        }
    };

    const handleAutoLocate = async () => {
        setIsLocating(true);
        setSyncStatus('Resolving Telemetry...');
        setSyncedFields(new Set());

        if (!navigator.geolocation) {
            setIsLocating(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const prompt = `Identify official address for coordinates: ${latitude}, ${longitude}. 
                Output JSON: {"address": string, "city": string, "state": string, "country": string, "pin_code": string}.`;

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
                console.error(err);
            } finally {
                setIsLocating(false);
            }
        }, () => {
            setIsLocating(false);
        });
    };

    if (activeTab === 'details') {
        return (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-10">
                <div className="flex items-center gap-5 mb-2">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/5">
                        <UsersIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">Guardian Identity</h3>
                        <p className="text-[11px] text-white/30 font-medium tracking-widest italic">Institutional role and relationship specification.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FloatingPremiumInput label="Canonical Legal Name" name="display_name" value={formData.display_name} onChange={handleChange} required icon={<UserIcon className="w-5 h-5" />} />

                    <PremiumSelect
                        label="Identity Linkage (Relationship)"
                        name="relationship_to_student"
                        value={formData.relationship_to_student || ''}
                        onChange={(e) => handleSelectChange('relationship_to_student')(e.target.value)}
                        icon={<UsersIcon className="w-5 h-5" />}
                    >
                        <option value="" disabled className="bg-slate-900">Select Relationship...</option>
                        <option value="Father" className="bg-slate-900">Father</option>
                        <option value="Mother" className="bg-slate-900">Mother</option>
                        <option value="Guardian" className="bg-slate-900">Legal Guardian</option>
                        <option value="Other" className="bg-slate-900">Authorized Affiliate</option>
                    </PremiumSelect>

                    <PremiumSelect
                        label="Gender Assignment"
                        name="gender"
                        value={formData.gender || ''}
                        onChange={(e) => handleSelectChange('gender')(e.target.value)}
                        icon={<UserIcon className="w-5 h-5" />}
                    >
                        <option value="" disabled className="bg-slate-900">Select Gender...</option>
                        <option value="Male" className="bg-slate-900">Male</option>
                        <option value="Female" className="bg-slate-900">Female</option>
                        <option value="Other" className="bg-slate-900">Diverse</option>
                        <option value="Prefer not to say" className="bg-slate-900">Prefer not to say</option>
                    </PremiumSelect>

                    <PremiumSelect
                        label="Nuclear Unit Size (Children)"
                        name="number_of_children"
                        value={String(formData.number_of_children || '1')}
                        onChange={(e) => handleSelectChange('number_of_children')(e.target.value)}
                        icon={<UsersIcon className="w-5 h-5" />}
                    >
                        <option value="1" className="bg-slate-900">Single Child</option>
                        <option value="2" className="bg-slate-900">2 Children</option>
                        <option value="3" className="bg-slate-900">3 Children</option>
                        <option value="4" className="bg-slate-900">4+ Children</option>
                    </PremiumSelect>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-10">
            <div className="flex items-center justify-between gap-6 p-8 rounded-[2rem] bg-white/[0.03] border border-white/10 relative overflow-hidden group">
                <div className="flex items-center gap-5 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <HomeIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">Residency & Telemetry</h3>
                        <p className="text-[11px] text-white/30 font-medium tracking-widest italic">{syncStatus || 'Primary contact node registry.'}</p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleAutoLocate}
                    disabled={isLocating}
                    className={`h-14 px-8 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all duration-300 border shadow-2xl
                        ${isLocating
                            ? 'bg-primary/20 text-primary border-primary/40 animate-pulse'
                            : 'bg-white/5 text-white/40 border-white/10 hover:border-primary/40 hover:text-white active:scale-95'
                        }
                    `}
                >
                    {isLocating ? <Spinner size="sm" className="text-primary" /> : <div className="flex items-center gap-3"><LocateFixedIcon className="w-4 h-4" /> Locate Node</div>}
                </button>
            </div>

            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <FloatingPremiumInput
                        label="Primary Comm Link (Mobile)"
                        name="phone"
                        type="tel"
                        value={formData.phone || ''}
                        onChange={handleChange}
                        required
                        icon={<PhoneIcon className="w-5 h-5" />}
                    />

                    <PremiumSelect
                        label="Sovereign Territory"
                        name="country"
                        value={formData.country || ''}
                        onChange={(e) => handleSelectChange('country')(e.target.value)}
                        icon={<GlobeIcon className="w-5 h-5" />}
                        isSynced={syncedFields.has('country')}
                    >
                        <option value="" disabled className="bg-slate-900">Select Region...</option>
                        {countries.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                    </PremiumSelect>
                </div>

                <FloatingPremiumInput
                    label="Canonical Residential Address"
                    name="address"
                    value={formData.address || ''}
                    onChange={handleChange as any}
                    isTextArea
                    isSynced={syncedFields.has('address')}
                    icon={<LocationIcon className="w-5 h-5" />}
                    action={
                        <button
                            type="button"
                            onClick={handleResolveAddress}
                            disabled={isResolving || !formData.address?.trim()}
                            className="p-3 text-primary hover:bg-primary/10 rounded-2xl transition-all disabled:opacity-30 flex items-center gap-2"
                        >
                            {isResolving ? <Spinner size="sm" /> : <><SparklesIcon className="w-5 h-5" /><span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Identify</span></>}
                        </button>
                    }
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <PremiumSelect
                        label="Regional Sector (State)"
                        name="state"
                        value={formData.state || ''}
                        onChange={(e) => handleSelectChange('state')(e.target.value)}
                        icon={loadingStates ? <Spinner size="sm" /> : <LocationIcon className="w-5 h-5" />}
                        disabled={!formData.country}
                        isSynced={syncedFields.has('state')}
                    >
                        <option value="" disabled className="bg-slate-900">Select State...</option>
                        {availableStates.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                    </PremiumSelect>
                    <PremiumSelect
                        label="Locality Node (City)"
                        name="city"
                        value={formData.city || ''}
                        onChange={(e) => handleSelectChange('city')(e.target.value)}
                        icon={loadingCities ? <Spinner size="sm" /> : <LocationIcon className="w-5 h-5" />}
                        disabled={!formData.state}
                        isSynced={syncedFields.has('city')}
                    >
                        <option value="" disabled className="bg-slate-900">Select City...</option>
                        {availableCities.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                    </PremiumSelect>
                    <FloatingPremiumInput
                        label="Identity Hash (Pin Code)"
                        name="pin_code"
                        value={formData.pin_code || ''}
                        onChange={handleChange}
                        isSynced={syncedFields.has('pin_code')}
                        icon={<LocationIcon className="w-5 h-5" />}
                    />
                </div>
            </div>
        </div>
    );
};

export default ParentForm;
