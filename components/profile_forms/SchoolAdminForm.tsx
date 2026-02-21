import React, { useState, useRef, useMemo } from 'react';
import { SchoolAdminProfileData } from '../../types';
import { countries, statesByCountry, citiesByState } from '../data/locations';
import { countryCodes } from '../data/countryCodes';
import { SchoolIcon } from '../icons/SchoolIcon';
import { LocationIcon } from '../icons/LocationIcon';
import { GlobeIcon } from '../icons/GlobeIcon';
import { MailIcon } from '../icons/MailIcon';
import { PhoneIcon } from '../icons/PhoneIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { DocumentTextIcon } from '../icons/DocumentTextIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { BookIcon } from '../icons/BookIcon';
import { HashIcon } from '../icons/HashIcon';
import { LayersIcon } from '../icons/LayersIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import CustomSelect from '../common/CustomSelect';
import { GoogleGenAI } from '@google/genai';
import Spinner from '../common/Spinner';

// --- Constants ---
const MONTHS = [
    { value: 'January', label: 'January' },
    { value: 'February', label: 'February' },
    { value: 'March', label: 'March' },
    { value: 'April', label: 'April' },
    { value: 'May', label: 'May' },
    { value: 'June', label: 'June' },
    { value: 'July', label: 'July' },
    { value: 'August', label: 'August' },
    { value: 'September', label: 'September' },
    { value: 'October', label: 'October' },
    { value: 'November', label: 'November' },
    { value: 'December', label: 'December' },
];

const GRADES = [
    { value: 'Pre-K', label: 'Pre-Kindergarten' },
    { value: 'KG', label: 'Kindergarten' },
    ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Grade ${i + 1}` })),
];

// --- Styled Components ---

const PremiumInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string; icon?: React.ReactNode; action?: React.ReactNode; fullWidth?: boolean }> = ({ label, icon, action, fullWidth, className, ...props }) => (
    <div className={`relative group ${fullWidth ? 'w-full' : ''}`}>
        <div className="absolute top-[32px] -translate-y-1/2 left-[20px] text-muted-foreground/30 group-focus-within:text-primary transition-all duration-300 z-20 pointer-events-none group-focus-within:scale-110">
            {icon}
        </div>
        <input
            {...props}
            placeholder=" "
            className={`peer block w-full h-[64px] rounded-2xl border-2 border-white/5 bg-black/40 px-6 ${icon ? 'pl-14' : 'pl-6'} ${action ? 'pr-14' : ''} pt-6 pb-2 text-[15px] text-foreground font-semibold shadow-inner transition-all duration-300 hover:bg-black/60 hover:border-white/10 focus:border-primary/50 focus:ring-8 focus:ring-primary/5 focus:outline-none placeholder-transparent ${className}`}
        />
        <label className={`absolute left-6 top-[32px] z-10 origin-[0] -translate-y-7 scale-75 transform text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 duration-300 pointer-events-none
            peer-placeholder-shown:translate-y-[-50%] peer-placeholder-shown:scale-100 peer-placeholder-shown:text-sm peer-placeholder-shown:font-bold peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal
            peer-focus:-translate-y-7 peer-focus:scale-75 peer-focus:text-[10px] peer-focus:font-black peer-focus:uppercase peer-focus:tracking-[0.2em] peer-focus:text-primary ${icon ? 'peer-placeholder-shown:left-14' : ''}`}>
            {label}
        </label>
        {action && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30">
                {action}
            </div>
        )}
        <div className="absolute inset-0 rounded-2xl bg-primary/5 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none blur-xl"></div>
    </div>
);

const SectionHeader: React.FC<{ title: string, subtitle: string, icon: React.ReactNode, colorClass: string }> = ({ title, subtitle, icon, colorClass }) => (
    <div className="flex items-center gap-5 mb-10 pb-6 border-b border-white/5">
        <div className={`p-4 rounded-[1.5rem] ${colorClass} shadow-[0_0_30px_rgba(0,0,0,0.2)] ring-1 ring-white/10 group-hover:scale-110 transition-transform duration-500`}>
            {icon}
        </div>
        <div>
            <h3 className="text-2xl font-serif font-black text-white tracking-tight uppercase">{title}</h3>
            <p className="text-[11px] text-muted-foreground font-bold tracking-widest uppercase opacity-60 mt-1">{subtitle}</p>
        </div>
    </div>
);

type TabType = 'details' | 'contact' | 'academic';

interface FormProps {
    formData: Partial<SchoolAdminProfileData & { admin_contact_phone_country_code?: string; admin_contact_phone_local?: string; }>;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    isInitialCreation: boolean;
    activeTab?: TabType;
    onTabChange?: (tab: TabType) => void;
}

const SchoolAdminForm: React.FC<FormProps> = ({ formData, handleChange, isInitialCreation, activeTab, onTabChange }) => {
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [bannerPreview, setBannerPreview] = useState<string | null>(null);
    const [internalTab, setInternalTab] = useState<TabType>('details');
    const [isResolving, setIsResolving] = useState(false);

    const currentTab = activeTab !== undefined ? activeTab : internalTab;

    const handleTabSwitch = (tab: TabType) => {
        if (onTabChange) {
            onTabChange(tab);
        } else {
            setInternalTab(tab);
        }
    };

    const fileInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => setLogoPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => setBannerPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleResolveAddress = async () => {
        if (!formData.address?.trim()) return;
        setIsResolving(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `From the street address "${formData.address}", extract or identify the city, state, and country.
            Output Strictly as valid JSON: {"city": "string", "state": "string", "country": "string"}.
            Values for country must match the closest official name from: ${countries.join(', ')}.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { tools: [{ googleMaps: {} }] }
            });

            const text = response.text || '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                if (data.city) handleChange({ target: { name: 'city', value: data.city } } as any);
                if (data.state) handleChange({ target: { name: 'state', value: data.state } } as any);
                if (data.country) handleChange({ target: { name: 'country', value: data.country } } as any);
            }
        } catch (err) {
            console.error("Auto-fill failed", err);
        } finally {
            setIsResolving(false);
        }
    };

    // Location Logic
    const availableStates = useMemo(() => formData.country ? statesByCountry[formData.country] || [] : [], [formData.country]);
    const availableCities = useMemo(() => formData.state ? citiesByState[formData.state] || [] : [], [formData.state]);

    const handleCountrySelect = (val: string) => {
        handleChange({ target: { name: 'country', value: val } } as any);
        handleChange({ target: { name: 'state', value: '' } } as any);
        handleChange({ target: { name: 'city', value: '' } } as any);
    };

    const handleStateSelect = (val: string) => {
        handleChange({ target: { name: 'state', value: val } } as any);
        handleChange({ target: { name: 'city', value: '' } } as any);
    };

    const handleGenerateCode = () => {
        if (!formData.school_name) return;
        // Take initials of school name + random 4 digits
        const prefix = formData.school_name
            .split(' ')
            .filter(word => word.length > 0)
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 4);

        const random = Math.floor(1000 + Math.random() * 9000);
        const generatedCode = `${prefix}-${random}`;

        handleChange({ target: { name: 'affiliation_number', value: generatedCode } } as any);
    };

    return (
        <div className="space-y-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto pb-20">

            {/* --- HERO SECTION --- */}
            <div className="relative rounded-3xl overflow-hidden bg-card border border-border shadow-xl group">
                {/* Banner Area */}
                <div className="h-40 md:h-52 bg-muted relative group/banner transition-all duration-500">
                    {bannerPreview ? (
                        <img src={bannerPreview} alt="School Banner" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                            <div className="text-center z-10">
                                <SchoolIcon className="w-12 h-12 text-white/10 mx-auto mb-2" />
                                <p className="text-white/20 text-xs font-medium uppercase tracking-widest">Add Cover Photo</p>
                            </div>
                        </div>
                    )}
                    <div
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover/banner:opacity-100 transition-all duration-300 flex items-center justify-center cursor-pointer backdrop-blur-[2px]"
                        onClick={() => bannerInputRef.current?.click()}
                    >
                        <span className="text-white font-bold text-xs flex items-center gap-2 bg-white/20 px-5 py-2.5 rounded-full border border-white/30 hover:bg-white/30 transition-all transform hover:scale-105 backdrop-blur-md shadow-lg">
                            <UploadIcon className="w-4 h-4" /> Upload Banner
                        </span>
                    </div>
                    <input type="file" ref={bannerInputRef} onChange={handleBannerChange} accept="image/*" className="hidden" />

                    {/* Status Badges Overlay */}
                    <div className="absolute top-4 right-4 flex gap-2">
                        <div className="bg-black/60 backdrop-blur-md border border-white/10 text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-lg flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                            85%
                        </div>
                        <div className="bg-white/90 backdrop-blur-md border border-white/50 text-slate-900 px-3 py-1 rounded-full text-[10px] font-bold shadow-lg uppercase tracking-wider">
                            Draft
                        </div>
                    </div>
                </div>

                {/* Identity Area */}
                <div className="px-6 md:px-10 pb-6 pt-0 relative">
                    <div className="flex flex-col md:flex-row items-start md:items-end gap-6 -mt-14">
                        {/* Logo */}
                        <div className="relative group/logo flex-shrink-0">
                            <div className={`w-32 h-32 rounded-3xl border-[4px] border-card shadow-2xl flex items-center justify-center overflow-hidden bg-background relative z-10 transition-transform duration-300 group-hover/logo:scale-[1.02] ${!logoPreview ? 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900' : ''}`}>
                                {logoPreview ? (
                                    <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-center p-4">
                                        <SchoolIcon className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground/50">Upload Logo</span>
                                    </div>
                                )}
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity cursor-pointer backdrop-blur-[1px]"
                                >
                                    <UploadIcon className="w-6 h-6 text-white" />
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleLogoChange} accept="image/*" className="hidden" />
                            </div>
                            <div className="absolute bottom-1 right-1 bg-blue-500 border-[3px] border-card w-7 h-7 rounded-full z-20 shadow-md flex items-center justify-center text-white" title="Upload Required">
                                <span className="text-lg font-bold leading-none mb-0.5">+</span>
                            </div>
                        </div>

                        {/* Title Input */}
                        <div className="flex-grow w-full pt-1 md:pb-2 space-y-1">
                            <label className="block text-[10px] font-extrabold text-muted-foreground/80 uppercase tracking-[0.2em] mb-0.5 pl-0.5">Institution Name</label>
                            <input
                                name="school_name"
                                value={formData.school_name || ''}
                                onChange={handleChange}
                                placeholder="Enter Official School Name"
                                className="w-full bg-transparent border-b-2 border-transparent hover:border-border focus:border-primary p-0 text-2xl md:text-4xl font-black text-foreground placeholder:text-muted-foreground/20 focus:ring-0 focus:outline-none transition-all font-serif tracking-tight leading-tight"
                            />
                        </div>
                    </div>
                </div>

                {/* Modern Tabs */}
                <div className="px-6 md:px-10 mt-2 bg-muted/40 backdrop-blur-sm border-t border-border/60">
                    <div className="flex overflow-x-auto scrollbar-hide gap-6 md:gap-10">
                        {[
                            { id: 'details', label: 'Institution Details', icon: <SchoolIcon className="w-3.5 h-3.5" /> },
                            { id: 'contact', label: 'Contact Info', icon: <UsersIcon className="w-3.5 h-3.5" /> },
                            { id: 'academic', label: 'Academic Settings', icon: <DocumentTextIcon className="w-3.5 h-3.5" /> },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => handleTabSwitch(tab.id as TabType)}
                                className={`
                                    flex items-center gap-2 py-4 text-xs font-bold border-b-[3px] transition-all whitespace-nowrap uppercase tracking-wider
                                    ${currentTab === tab.id
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted-foreground/70 hover:text-foreground hover:border-border'
                                    }
                                `}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- FORM CONTENT --- */}
            <div className="pt-2">

                {currentTab === 'details' && (
                    <div className="bg-card rounded-3xl border border-border/60 shadow-sm p-8 md:p-10 animate-in fade-in slide-in-from-right-4 duration-500">
                        <SectionHeader
                            title="Location & Headquarters"
                            subtitle="Set the official address for correspondence and mapping."
                            icon={<LocationIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
                            colorClass="bg-blue-50 dark:bg-blue-900/20"
                        />

                        <div className="space-y-6 max-w-4xl">
                            <PremiumInput
                                label="Street Address"
                                name="address"
                                value={formData.address || ''}
                                onChange={handleChange}
                                required
                                icon={<LocationIcon className="w-5 h-5" />}
                                fullWidth
                                action={
                                    <button
                                        type="button"
                                        onClick={handleResolveAddress}
                                        disabled={isResolving || !formData.address?.trim()}
                                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-all disabled:opacity-30 disabled:grayscale"
                                        title="Auto-fill Location"
                                    >
                                        {isResolving ? <Spinner size="sm" /> : <SparklesIcon className="w-5 h-5" />}
                                    </button>
                                }
                            />

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <CustomSelect
                                    label="Country"
                                    placeholder="Select Country"
                                    options={countries.map(c => ({ label: c, value: c }))}
                                    value={formData.country || 'India'}
                                    onChange={handleCountrySelect}
                                    icon={<GlobeIcon className="w-4 h-4" />}
                                    searchable
                                />
                                <CustomSelect
                                    label="State"
                                    placeholder="Select State"
                                    options={availableStates.map(s => ({ label: s, value: s }))}
                                    value={formData.state || ''}
                                    onChange={handleStateSelect}
                                    disabled={!formData.country}
                                    icon={<LocationIcon className="w-4 h-4" />}
                                    searchable
                                />
                                <CustomSelect
                                    label="City"
                                    placeholder="Select City"
                                    options={availableCities.map(c => ({ label: c, value: c }))}
                                    value={formData.city || ''}
                                    onChange={(val) => handleChange({ target: { name: 'city', value: val } } as any)}
                                    disabled={!formData.state}
                                    icon={<LocationIcon className="w-4 h-4" />}
                                    searchable
                                />
                            </div>
                        </div>
                    </div>
                )}

                {currentTab === 'contact' && (
                    <div className="bg-card rounded-3xl border border-border/60 shadow-sm p-8 md:p-10 animate-in fade-in slide-in-from-right-4 duration-500">
                        <SectionHeader
                            title="Primary Administrator"
                            subtitle="Main contact for technical and administrative issues."
                            icon={<UsersIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />}
                            colorClass="bg-purple-50 dark:bg-purple-900/20"
                        />

                        {isInitialCreation && (
                            <div className="bg-primary/5 border border-primary/20 rounded-[2rem] p-6 mb-10 flex items-center gap-5 animate-in zoom-in duration-500">
                                <div className="p-3 bg-primary/10 rounded-2xl">
                                    <CheckCircleIcon className="w-8 h-8 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-black uppercase tracking-widest text-primary">Identity Synchronized</p>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed font-medium">Your primary administrator details have been provisioned from your secure identity node.</p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
                            <PremiumInput
                                label="Full Legal Name"
                                name="admin_contact_name"
                                value={formData.admin_contact_name || ''}
                                onChange={handleChange}
                                required
                                icon={<UsersIcon className="w-5 h-5" />}
                            />

                            <PremiumInput
                                label="Official Designation"
                                name="admin_designation"
                                value={formData.admin_designation || ''}
                                onChange={handleChange}
                                required
                                placeholder="e.g. Director"
                                icon={<CheckCircleIcon className="w-5 h-5" />}
                            />

                            <div className="md:col-span-2">
                                <PremiumInput
                                    label="Official Communication Email"
                                    type="email"
                                    name="admin_contact_email"
                                    value={formData.admin_contact_email || ''}
                                    onChange={handleChange}
                                    required
                                    icon={<MailIcon className="w-5 h-5" />}
                                />
                            </div>

                            <div className="flex gap-4 md:col-span-2">
                                <div className="w-[140px] flex-shrink-0">
                                    <CustomSelect
                                        label="Dial Code"
                                        placeholder="+91"
                                        options={countryCodes.map(c => ({ value: c.dial_code, label: `${c.code} ${c.dial_code}` }))}
                                        value={formData.admin_contact_phone_country_code || '+91'}
                                        onChange={(val) => handleChange({ target: { name: 'admin_contact_phone_country_code', value: val } } as any)}
                                        icon={<PhoneIcon className="w-4 h-4" />}
                                        searchable
                                    />
                                </div>
                                <div className="flex-grow">
                                    <PremiumInput
                                        label="Primary Phone Number"
                                        type="tel"
                                        name="admin_contact_phone_local"
                                        value={formData.admin_contact_phone_local || ''}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {currentTab === 'academic' && (
                    <div className="bg-card rounded-[3rem] border border-white/5 shadow-2xl p-10 md:p-14 animate-in fade-in slide-in-from-right-10 duration-700 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full filter blur-[80px] -mr-32 -mt-32 pointer-events-none group-hover:bg-amber-500/10 transition-colors duration-700"></div>

                        <SectionHeader
                            title="Academic Standard"
                            subtitle="Configure global education boards, institutional session, and grade bandwidth."
                            icon={<DocumentTextIcon className="w-8 h-8 text-amber-500" />}
                            colorClass="bg-amber-500/10"
                        />

                        <div className="space-y-12 max-w-5xl relative z-10">
                            {/* Board & Affiliation */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-amber-500/70 tracking-[0.3em] pl-1">Education Board</label>
                                    <CustomSelect
                                        label=""
                                        placeholder="Select Board"
                                        options={[
                                            { value: 'CBSE', label: 'CBSE (Central Board)' },
                                            { value: 'ICSE', label: 'ICSE (Indian Certificate)' },
                                            { value: 'IB', label: 'IB (International Baccalaureate)' },
                                            { value: 'IGCSE', label: 'Cambridge (IGCSE)' },
                                            { value: 'State Board', label: 'State Board' },
                                            { value: 'Other', label: 'Other' },
                                        ]}
                                        value={formData.academic_board || ''}
                                        onChange={(val) => handleChange({ target: { name: 'academic_board', value: val } } as any)}
                                        icon={<BookIcon className="w-4 h-4 text-amber-500/50" />}
                                        required
                                        searchable
                                    />
                                </div>

                                <div className="space-y-2 group/aff">
                                    <div className="flex items-center justify-between mb-1 px-1">
                                        <label className="text-[10px] font-black uppercase text-amber-500/70 tracking-[0.3em]">Affiliation Control</label>
                                        {formData.school_name && !formData.affiliation_number && (
                                            <span className="text-[9px] font-bold text-amber-500/40 animate-pulse">Synchronize with Identity?</span>
                                        )}
                                    </div>
                                    <PremiumInput
                                        label="Grant / School Code"
                                        name="affiliation_number"
                                        value={formData.affiliation_number || ''}
                                        onChange={handleChange}
                                        placeholder="e.g. 830012"
                                        icon={<HashIcon className="w-5 h-5" />}
                                        action={
                                            <button
                                                type="button"
                                                onClick={handleGenerateCode}
                                                disabled={!formData.school_name}
                                                className={`p-2 rounded-xl transition-all ${formData.school_name ? 'text-amber-500 hover:bg-amber-500/10 hover:scale-110 active:scale-95' : 'text-white/10 cursor-not-allowed'}`}
                                                title="Generate from School Name"
                                            >
                                                <SparklesIcon className="w-5 h-5" />
                                            </button>
                                        }
                                    />
                                    <div className="mt-4 p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10 invisible group-hover/aff:visible animate-in fade-in duration-300">
                                        <p className="text-[10px] text-amber-500/60 font-medium leading-relaxed italic">
                                            Handshake Tip: Link your official Educational Board affiliation code to sync global records.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent w-full"></div>

                            {/* School Type & Session */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em] pl-1">Institution Type</label>
                                    <CustomSelect
                                        label=""
                                        placeholder="Select Type"
                                        options={[
                                            { value: 'Co-Educational', label: 'Co-Educational' },
                                            { value: 'Boys', label: 'Boys School' },
                                            { value: 'Girls', label: 'Girls School' },
                                        ]}
                                        value={formData.school_type || ''}
                                        onChange={(val) => handleChange({ target: { name: 'school_type', value: val } } as any)}
                                        icon={<UsersIcon className="w-4 h-4 text-white/20" />}
                                    />
                                </div>

                                <div className="lg:col-span-2 space-y-2">
                                    <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em] pl-1">Academic Session Cycle</label>
                                    <div className="grid grid-cols-2 gap-6 p-4 bg-white/[0.02] rounded-3xl border border-white/5 shadow-inner">
                                        <CustomSelect
                                            label="Session Start"
                                            placeholder="Start Month"
                                            options={MONTHS}
                                            value={formData.academic_year_start || ''}
                                            onChange={(val) => handleChange({ target: { name: 'academic_year_start', value: val } } as any)}
                                            icon={<CalendarIcon className="w-4 h-4 text-primary/50" />}
                                            searchable
                                        />
                                        <CustomSelect
                                            label="Session End"
                                            placeholder="End Month"
                                            options={MONTHS}
                                            value={formData.academic_year_end || ''}
                                            onChange={(val) => handleChange({ target: { name: 'academic_year_end', value: val } } as any)}
                                            icon={<CalendarIcon className="w-4 h-4 text-primary/50" />}
                                            searchable
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Grades BANDWIDTH */}
                            <div className="relative group/grades p-8 bg-black/40 rounded-[2.5rem] border border-white/5 shadow-2xl transition-all hover:bg-black/50 overflow-hidden">
                                <div className="absolute top-0 left-0 w-2 h-full bg-primary/20"></div>
                                <h4 className="text-[10px] font-black text-primary/80 mb-8 flex items-center gap-3 uppercase tracking-[0.4em]">
                                    <LayersIcon className="w-4 h-4" /> Operational Grade Bandwidth
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest pl-1">Starting Milestone</p>
                                        <CustomSelect
                                            label="Lowest Grade"
                                            placeholder="Start Grade"
                                            options={GRADES}
                                            value={formData.grade_range_start || ''}
                                            onChange={(val) => handleChange({ target: { name: 'grade_range_start', value: val } } as any)}
                                            searchable
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest pl-1">Terminal Milestone</p>
                                        <CustomSelect
                                            label="Highest Grade"
                                            placeholder="End Grade"
                                            options={GRADES}
                                            value={formData.grade_range_end || ''}
                                            onChange={(val) => handleChange({ target: { name: 'grade_range_end', value: val } } as any)}
                                            searchable
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SchoolAdminForm;
