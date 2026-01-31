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
import { FloatingPremiumInput, PremiumSelect } from '../common/Inputs';
import { motion, AnimatePresence } from 'framer-motion';

const MONTHS = [
    { value: 'January', label: 'January' }, { value: 'February', label: 'February' },
    { value: 'March', label: 'March' }, { value: 'April', label: 'April' },
    { value: 'May', label: 'May' }, { value: 'June', label: 'June' },
    { value: 'July', label: 'July' }, { value: 'August', label: 'August' },
    { value: 'September', label: 'September' }, { value: 'October', label: 'October' },
    { value: 'November', label: 'November' }, { value: 'December', label: 'December' },
];

const GRADES = [
    { value: 'Pre-K', label: 'Pre-Kindergarten' },
    { value: 'KG', label: 'Kindergarten' },
    ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Grade ${i + 1}` })),
];

const SectionHeader: React.FC<{ title: string, subtitle: string, icon: React.ReactNode }> = ({ title, subtitle, icon }) => (
    <div className="flex items-start gap-5 mb-10">
        <div className="p-4 rounded-[1.25rem] bg-primary/10 border border-primary/20 text-primary shadow-lg shadow-primary/5">
            {icon}
        </div>
        <div>
            <h3 className="text-sm font-black text-white uppercase tracking-[0.3em]">{title}</h3>
            <p className="text-[11px] text-white/30 font-medium tracking-widest italic mt-1">{subtitle}</p>
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
        if (onTabChange) onTabChange(tab);
        else setInternalTab(tab);
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
            Values for country must match the closest official name from: India, USA, etc.`;

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

    const availableStates = useMemo(() => formData.country ? statesByCountry[formData.country] || [] : [], [formData.country]);
    const availableCities = useMemo(() => formData.state ? citiesByState[formData.state] || [] : [], [formData.state]);

    return (
        <div className="space-y-12 w-full animate-in fade-in slide-in-from-bottom-8 duration-1000 max-w-6xl mx-auto pb-24">

            {/* --- CINEMATIC HERO SECTION --- */}
            <div className="relative rounded-[3rem] overflow-hidden bg-white/[0.02] border border-white/5 shadow-3xl group">
                <div className="h-64 md:h-80 bg-black relative group/banner">
                    {bannerPreview ? (
                        <img src={bannerPreview} alt="School Banner" className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-1000" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center overflow-hidden">
                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,var(--primary)_0%,transparent_70%)] animate-pulse" />
                            <div className="absolute inset-0 opacity-[0.05] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                            <div className="text-center z-10">
                                <SchoolIcon className="w-20 h-20 text-white/5 mx-auto mb-4" />
                                <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">Assign Institutional Banner</p>
                            </div>
                        </div>
                    )}
                    <div
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover/banner:opacity-100 transition-all duration-500 flex items-center justify-center cursor-pointer backdrop-blur-md"
                        onClick={() => bannerInputRef.current?.click()}
                    >
                        <span className="text-white font-black text-[11px] uppercase tracking-[0.3em] flex items-center gap-4 bg-white/10 px-10 py-5 rounded-[2rem] border border-white/20 hover:bg-white/20 transition-all transform hover:scale-105 shadow-2xl">
                            <UploadIcon className="w-5 h-5" /> Upload Neural Mask
                        </span>
                    </div>
                    <input type="file" ref={bannerInputRef} onChange={handleBannerChange} accept="image/*" className="hidden" />

                    <div className="absolute top-8 right-8 flex gap-4">
                        <div className="bg-emerald-500/10 backdrop-blur-xl border border-emerald-500/20 text-emerald-500 px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            Operational
                        </div>
                    </div>
                </div>

                <div className="px-10 md:px-16 pb-12 pt-0 relative">
                    <div className="flex flex-col md:flex-row items-center md:items-end gap-12 -mt-24">
                        <div className="relative group/logo flex-shrink-0">
                            <div className="w-48 h-48 rounded-[2.5rem] border-[8px] border-[#08090a] shadow-4xl flex items-center justify-center overflow-hidden bg-background relative z-10 transition-all duration-700 group-hover/logo:scale-105 group-hover/logo:rotate-1">
                                {logoPreview ? (
                                    <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-center p-6 bg-slate-900 w-full h-full flex flex-col items-center justify-center">
                                        <SchoolIcon className="w-16 h-16 text-white/10 mb-3" />
                                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20">Logo Sync</span>
                                    </div>
                                )}
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity cursor-pointer backdrop-blur-md"
                                >
                                    <UploadIcon className="w-10 h-10 text-white" />
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleLogoChange} accept="image/*" className="hidden" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-primary w-12 h-12 rounded-2xl z-20 shadow-2xl flex items-center justify-center text-white border-4 border-[#08090a] animate-bounce">
                                <SparklesIcon className="w-6 h-6" />
                            </div>
                        </div>

                        <div className="flex-grow w-full pt-4 md:pb-6 space-y-3 text-center md:text-left">
                            <label className="block text-[11px] font-black text-white/20 uppercase tracking-[0.5em] mb-2 leading-none">Canonical Institutional Identifier</label>
                            <input
                                name="school_name"
                                value={formData.school_name || ''}
                                onChange={handleChange}
                                placeholder="ENTER INSTITUTION NAME"
                                className="w-full bg-transparent border-none p-0 text-4xl md:text-6xl font-serif font-black text-white placeholder:text-white/[0.03] focus:ring-0 focus:outline-none transition-all tracking-tighter leading-tight"
                            />
                        </div>
                    </div>
                </div>

                <div className="px-10 md:px-16 bg-white/[0.01] border-t border-white/5">
                    <div className="flex overflow-x-auto scrollbar-hide gap-12">
                        {[
                            { id: 'details', label: 'Core Registry', icon: <SchoolIcon className="w-4 h-4" /> },
                            { id: 'contact', label: 'Auth Proxy', icon: <UsersIcon className="w-4 h-4" /> },
                            { id: 'academic', label: 'Protocol Config', icon: <DocumentTextIcon className="w-4 h-4" /> },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => handleTabSwitch(tab.id as TabType)}
                                className={`
                                    flex items-center gap-3 py-8 text-[11px] font-black uppercase tracking-[0.3em] transition-all whitespace-nowrap border-b-2
                                    ${currentTab === tab.id
                                        ? 'border-primary text-primary opacity-100'
                                        : 'border-transparent text-white/30 hover:text-white/60'
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

            <div className="pt-4">
                <AnimatePresence mode="wait">
                    {currentTab === 'details' && (
                        <motion.div
                            key="details"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="bg-white/[0.02] rounded-[3rem] border border-white/5 shadow-2xl p-10 md:p-14"
                        >
                            <SectionHeader
                                title="Node Location & Deployment"
                                subtitle="Specify the primary physical coordinates for this institutional vertex."
                                icon={<LocationIcon className="w-6 h-6 text-primary" />}
                            />

                            <div className="space-y-10">
                                <FloatingPremiumInput
                                    label="Full Physical Address"
                                    name="address"
                                    value={formData.address || ''}
                                    onChange={handleChange}
                                    required
                                    isTextArea
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

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                                    <PremiumSelect
                                        label="Sovereign Territory"
                                        name="country"
                                        value={formData.country || ''}
                                        onChange={(e) => {
                                            handleChange(e);
                                            handleChange({ target: { name: 'state', value: '' } } as any);
                                            handleChange({ target: { name: 'city', value: '' } } as any);
                                        }}
                                        icon={<GlobeIcon className="w-5 h-5" />}
                                    >
                                        <option value="" disabled className="bg-slate-900">Select Country...</option>
                                        {countries.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                                    </PremiumSelect>

                                    <PremiumSelect
                                        label="Regional Sector (State)"
                                        name="state"
                                        value={formData.state || ''}
                                        onChange={(e) => {
                                            handleChange(e);
                                            handleChange({ target: { name: 'city', value: '' } } as any);
                                        }}
                                        disabled={!formData.country}
                                        icon={<LocationIcon className="w-5 h-5" />}
                                    >
                                        <option value="" disabled className="bg-slate-900">Select State...</option>
                                        {availableStates.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                                    </PremiumSelect>

                                    <PremiumSelect
                                        label="Locality Node (City)"
                                        name="city"
                                        value={formData.city || ''}
                                        onChange={handleChange}
                                        disabled={!formData.state}
                                        icon={<LocationIcon className="w-5 h-5" />}
                                    >
                                        <option value="" disabled className="bg-slate-900">Select City...</option>
                                        {availableCities.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                                    </PremiumSelect>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {currentTab === 'contact' && (
                        <motion.div
                            key="contact"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="bg-white/[0.02] rounded-[3rem] border border-white/5 shadow-2xl p-10 md:p-14"
                        >
                            <SectionHeader
                                title="Authoritative Admin Proxy"
                                subtitle="Primary cryptographic and administrative contact for this institution."
                                icon={<UsersIcon className="w-6 h-6 text-primary" />}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <FloatingPremiumInput label="Canonical Admin Name" name="admin_contact_name" value={formData.admin_contact_name || ''} onChange={handleChange} required icon={<UsersIcon className="w-5 h-5" />} />
                                <FloatingPremiumInput label="Authority Level (Designation)" name="admin_designation" value={formData.admin_designation || ''} onChange={handleChange} required placeholder="e.g. Director General" icon={<CheckCircleIcon className="w-5 h-5" />} />
                                <div className="md:col-span-2">
                                    <FloatingPremiumInput label="Official Auth Email" type="email" name="admin_contact_email" value={formData.admin_contact_email || ''} onChange={handleChange} required icon={<MailIcon className="w-5 h-5" />} />
                                </div>
                                <div className="flex gap-6 md:col-span-2">
                                    <div className="w-40">
                                        <PremiumSelect label="Code" name="admin_contact_phone_country_code" value={formData.admin_contact_phone_country_code || '+91'} onChange={handleChange} icon={<PhoneIcon className="w-4 h-4" />}>
                                            {countryCodes.map(c => <option key={c.code} value={c.dial_code} className="bg-slate-900">{c.code} {c.dial_code}</option>)}
                                        </PremiumSelect>
                                    </div>
                                    <FloatingPremiumInput label="Encrypted Comm Link (Phone)" type="tel" name="admin_contact_phone_local" value={formData.admin_contact_phone_local || ''} onChange={handleChange} required className="flex-grow" />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {currentTab === 'academic' && (
                        <motion.div
                            key="academic"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="bg-white/[0.02] rounded-[3rem] border border-white/5 shadow-2xl p-10 md:p-14"
                        >
                            <SectionHeader
                                title="Academic Protocol Config"
                                subtitle="Define the scholastic architecture and organizational structure."
                                icon={<DocumentTextIcon className="w-6 h-6 text-primary" />}
                            />

                            <div className="space-y-12">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <PremiumSelect label="Education Board Protocol" name="academic_board" value={formData.academic_board || ''} onChange={handleChange} required icon={<BookIcon className="w-4 h-4" />}>
                                        <option value="" disabled className="bg-slate-900">Select Board...</option>
                                        <option value="CBSE" className="bg-slate-900">CBSE (Central Board)</option>
                                        <option value="ICSE" className="bg-slate-900">ICSE (Indian Certificate)</option>
                                        <option value="IB" className="bg-slate-900">IB (International Baccalaureate)</option>
                                        <option value="IGCSE" className="bg-slate-900">Cambridge (IGCSE)</option>
                                        <option value="State Board" className="bg-slate-900">State Board</option>
                                        <option value="Other" className="bg-slate-900">Other</option>
                                    </PremiumSelect>
                                    <FloatingPremiumInput label="Affiliation Hash/School Code" name="affiliation_number" value={formData.affiliation_number || ''} onChange={handleChange} placeholder="e.g. AFF-8300" icon={<HashIcon className="w-5 h-5" />} />
                                </div>

                                <div className="h-px bg-white/5 w-full" />

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                                    <PremiumSelect label="Institution Archetype" name="school_type" value={formData.school_type || ''} onChange={handleChange} icon={<UsersIcon className="w-4 h-4" />}>
                                        <option value="" disabled className="bg-slate-900">Select Type...</option>
                                        <option value="Co-Educational" className="bg-slate-900">Co-Educational</option>
                                        <option value="Boys" className="bg-slate-900">Boys School</option>
                                        <option value="Girls" className="bg-slate-900">Girls School</option>
                                    </PremiumSelect>
                                    <PremiumSelect label="Cycle Start" name="academic_year_start" value={formData.academic_year_start || ''} onChange={handleChange} icon={<CalendarIcon className="w-4 h-4" />}>
                                        <option value="" disabled className="bg-slate-900">Start Month...</option>
                                        {MONTHS.map(m => <option key={m.value} value={m.value} className="bg-slate-900">{m.label}</option>)}
                                    </PremiumSelect>
                                    <PremiumSelect label="Cycle End" name="academic_year_end" value={formData.academic_year_end || ''} onChange={handleChange} icon={<CalendarIcon className="w-4 h-4" />}>
                                        <option value="" disabled className="bg-slate-900">End Month...</option>
                                        {MONTHS.map(m => <option key={m.value} value={m.value} className="bg-slate-900">{m.label}</option>)}
                                    </PremiumSelect>
                                </div>

                                <div className="p-10 rounded-[2.5rem] bg-primary/5 border border-primary/10">
                                    <h4 className="text-[10px] font-black text-white uppercase tracking-[0.4em] mb-10 flex items-center gap-4">
                                        <LayersIcon className="w-5 h-5 text-primary" /> Grade Spectrum Capacity
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <PremiumSelect label="Origin Grade (Lowest)" name="grade_range_start" value={formData.grade_range_start || ''} onChange={handleChange}>
                                            <option value="" disabled className="bg-slate-900">Select Grade...</option>
                                            {GRADES.map(g => <option key={g.value} value={g.value} className="bg-slate-900">{g.label}</option>)}
                                        </PremiumSelect>
                                        <PremiumSelect label="Terminal Grade (Highest)" name="grade_range_end" value={formData.grade_range_end || ''} onChange={handleChange}>
                                            <option value="" disabled className="bg-slate-900">Select Grade...</option>
                                            {GRADES.map(g => <option key={g.value} value={g.value} className="bg-slate-900">{g.label}</option>)}
                                        </PremiumSelect>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default SchoolAdminForm;
