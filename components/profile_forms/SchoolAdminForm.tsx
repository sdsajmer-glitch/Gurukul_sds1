import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SchoolAdminProfileData } from '../../types';
import { countries, statesByCountry, citiesByState } from '../data/locations';
import { countryCodes } from '../data/countryCodes';
import { SchoolIcon } from '../icons/SchoolIcon';
import { LocationIcon } from '../icons/LocationIcon';
import { GlobeIcon } from '../icons/GlobeIcon';
import { MailIcon } from '../icons/MailIcon';
import { PhoneIcon } from '../icons/PhoneIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { UserIcon } from '../icons/UserIcon';
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

import PremiumFloatingInput from '../common/PremiumFloatingInput';

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

    const logoInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    const availableStates = useMemo(() => formData.country ? statesByCountry[formData.country] || [] : [], [formData.country]);
    const availableCities = useMemo(() => formData.state ? citiesByState[formData.state] || [] : [], [formData.state]);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const reader = new FileReader();
            reader.onloadend = () => setLogoPreview(reader.result as string);
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const reader = new FileReader();
            reader.onloadend = () => setBannerPreview(reader.result as string);
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleResolveAddress = async () => {
        if (!formData.address?.trim()) return;
        setIsResolving(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `From the street address "${formData.address}", extract city, state, country. Output JSON: {"city": "string", "state": "string", "country": "string"}.`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            const text = response.text || '';
            const data = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
            if (data.city) handleChange({ target: { name: 'city', value: data.city } } as any);
            if (data.state) handleChange({ target: { name: 'state', value: data.state } } as any);
            if (data.country) handleChange({ target: { name: 'country', value: data.country } } as any);
        } catch (err) { console.error(err); } finally { setIsResolving(false); }
    };

    return (
        <div className="space-y-16">
            {/* HERETIC ELEVATION: Institution Banner & Identity */}
            <div className="relative rounded-[3rem] overflow-hidden bg-[#0f111a] border border-white/5 shadow-3xl group">
                <div className="h-64 md:h-80 relative overflow-hidden group/banner">
                    {bannerPreview ? (
                        <img src={bannerPreview} alt="School Banner" className="w-full h-full object-cover transition-transform duration-1000 group-hover/banner:scale-110" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#0a0b10] via-primary/5 to-[#0a0b10] flex items-center justify-center">
                            <div className="absolute inset-0 opacity-[0.05] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                            <div className="text-center z-10 space-y-4">
                                <div className="p-6 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl mx-auto shadow-2xl">
                                    <SchoolIcon className="w-10 h-10 text-white/20" />
                                </div>
                                <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.4em]">Protocol Banner Node</p>
                            </div>
                        </div>
                    )}
                    <div
                        onClick={() => bannerInputRef.current?.click()}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover/banner:opacity-100 transition-all cursor-pointer backdrop-blur-md flex flex-col items-center justify-center space-y-3"
                    >
                        <div className="p-4 rounded-3xl bg-white/10 border border-white/20 shadow-2xl"><UploadIcon className="w-8 h-8 text-white" /></div>
                        <span className="text-white font-black text-[10px] uppercase tracking-widest">Update Banner Node</span>
                    </div>
                    <input type="file" ref={bannerInputRef} onChange={handleBannerChange} hidden accept="image/*" />
                </div>

                <div className="px-12 pb-12 relative">
                    <div className="flex flex-col md:flex-row items-center md:items-end gap-12 -mt-24">
                        <div className="relative group/logo">
                            <div className="w-48 h-48 rounded-[3.5rem] bg-gradient-to-br from-primary/40 to-transparent p-[2px] shadow-[0_40px_80px_-20px_rgba(0,0,0,1)] ring-8 ring-[#0f111a]">
                                <div className="w-full h-full rounded-[3.4rem] bg-[#0a0b10] flex items-center justify-center overflow-hidden relative">
                                    {logoPreview ? <img src={logoPreview} className="w-full h-full object-cover" /> : <SchoolIcon className="w-16 h-16 text-white/10" />}
                                    <div
                                        onClick={() => logoInputRef.current?.click()}
                                        className="absolute inset-0 bg-black/80 opacity-0 group-hover/logo:opacity-100 transition-all cursor-pointer backdrop-blur-sm flex items-center justify-center"
                                    >
                                        <UploadIcon className="w-8 h-8 text-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-grow w-full md:pb-6 text-center md:text-left">
                            <p className="text-primary text-[10px] font-black uppercase tracking-[0.4em] mb-4 glow-text">Institutional Recognition Node</p>
                            <input
                                name="school_name"
                                value={formData.school_name || ''}
                                onChange={handleChange}
                                placeholder="Formal Entity Name"
                                className="w-full bg-transparent text-4xl md:text-6xl font-black text-white placeholder:text-white/5 focus:outline-none tracking-tighter leading-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Tab Navigation Hub */}
                <div className="px-12 border-t border-white/[0.03] flex items-center justify-between bg-black/40 backdrop-blur-3xl relative">
                    <div className="flex gap-12 overflow-x-auto scrollbar-hide">
                        {[
                            { id: 'details', label: 'Institutional Registry', icon: <SchoolIcon /> },
                            { id: 'contact', label: 'Admin Protocol', icon: <UsersIcon /> },
                            { id: 'academic', label: 'Academic Meta', icon: <DocumentTextIcon /> },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabSwitch(tab.id as TabType)}
                                className={`py-10 text-[11px] font-black uppercase tracking-[0.3em] relative transition-all duration-700 group/tab flex items-center gap-4 ${currentTab === tab.id ? 'text-primary' : 'text-white/20 hover:text-white/60'}`}
                            >
                                <span className="opacity-40">{React.cloneElement(tab.icon as React.ReactElement, { className: 'w-4 h-4' })}</span>
                                <span className="relative z-10">{tab.label}</span>
                                {currentTab === tab.id && (
                                    <motion.div layoutId="activeSchoolTab" className="absolute bottom-0 left-0 w-full h-[4px] bg-primary rounded-t-full shadow-[0_0_40px_rgba(var(--primary),0.8)]" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Protocol Modules */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentTab}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                    {currentTab === 'details' && (
                        <div className="space-y-16">
                            <div className="flex items-center gap-8 group/module">
                                <div className="p-5 bg-blue-500/10 rounded-3xl text-blue-400 border border-blue-500/20 shadow-2xl">
                                    <LocationIcon className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-[13px] font-black text-white tracking-[0.4em] uppercase glow-text">Geospatial Registry</h3>
                                    <p className="text-[11px] text-white/30 font-bold tracking-widest mt-1">Institutional coordinates and headquarters telemetry.</p>
                                </div>
                            </div>

                            <div className="bg-white/[0.02] p-12 rounded-[3.5rem] border border-white/5 shadow-inner space-y-12">
                                <PremiumFloatingInput
                                    label="Global Positioning Address"
                                    name="address"
                                    value={formData.address || ''}
                                    onChange={handleChange}
                                    required
                                    icon={<LocationIcon />}
                                    isTextArea
                                    action={
                                        <button onClick={handleResolveAddress} disabled={isResolving} className="p-4 bg-primary/10 text-primary rounded-2xl border border-primary/20 backdrop-blur-xl">
                                            {isResolving ? <Spinner size="sm" /> : <SparklesIcon className="w-5 h-5" />}
                                        </button>
                                    }
                                />

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                                    <CustomSelect
                                        label="National Domain"
                                        options={countries.map(c => ({ label: c, value: c }))}
                                        value={formData.country || 'India'}
                                        onChange={(v) => handleChange({ target: { name: 'country', value: v } } as any)}
                                        icon={<GlobeIcon />}
                                        searchable
                                    />
                                    <CustomSelect
                                        label="Regional Node"
                                        options={availableStates.map(s => ({ label: s, value: s }))}
                                        value={formData.state || ''}
                                        onChange={(v) => handleChange({ target: { name: 'state', value: v } } as any)}
                                        disabled={!formData.country}
                                        icon={<LocationIcon />}
                                        searchable
                                    />
                                    <CustomSelect
                                        label="Primary Municipality"
                                        options={availableCities.map(c => ({ label: c, value: c }))}
                                        value={formData.city || ''}
                                        onChange={(v) => handleChange({ target: { name: 'city', value: v } } as any)}
                                        disabled={!formData.state}
                                        icon={<LocationIcon />}
                                        searchable
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {currentTab === 'contact' && (
                        <div className="space-y-16">
                            <div className="flex items-center gap-8 group/module">
                                <div className="p-5 bg-purple-500/10 rounded-3xl text-purple-400 border border-purple-500/20 shadow-2xl">
                                    <UsersIcon className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-[13px] font-black text-white tracking-[0.4em] uppercase glow-text">Administrative Custodian</h3>
                                    <p className="text-[11px] text-white/30 font-bold tracking-widest mt-1">High-level synchronization node for institutional protocols.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 bg-white/[0.02] p-12 rounded-[3.5rem] border border-white/5">
                                <PremiumFloatingInput label="Custodian Legal Name" name="admin_contact_name" value={formData.admin_contact_name || ''} onChange={handleChange} required icon={<UserIcon />} />
                                <PremiumFloatingInput label="Professional Designation" name="admin_designation" value={formData.admin_designation || ''} onChange={handleChange} required icon={<CheckCircleIcon />} />
                                <div className="md:col-span-2">
                                    <PremiumFloatingInput label="Institutional Email Node" type="email" name="admin_contact_email" value={formData.admin_contact_email || ''} onChange={handleChange} required icon={<MailIcon />} />
                                </div>
                                <div className="md:col-span-2 flex gap-8">
                                    <div className="w-[180px]">
                                        <CustomSelect
                                            label="Telecom Code"
                                            options={countryCodes.map(c => ({ value: c.dial_code, label: `${c.code} ${c.dial_code}` }))}
                                            value={formData.admin_contact_phone_country_code || '+91'}
                                            onChange={(v) => handleChange({ target: { name: 'admin_contact_phone_country_code', value: v } } as any)}
                                            icon={<PhoneIcon />}
                                            searchable
                                        />
                                    </div>
                                    <div className="flex-grow">
                                        <PremiumFloatingInput label="Primary Telemetry Number" name="admin_contact_phone_local" value={formData.admin_contact_phone_local || ''} onChange={handleChange} icon={<PhoneIcon />} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentTab === 'academic' && (
                        <div className="space-y-16">
                            <div className="flex items-center gap-8 group/module">
                                <div className="p-5 bg-amber-500/10 rounded-3xl text-amber-400 border border-amber-500/20 shadow-2xl">
                                    <DocumentTextIcon className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-[13px] font-black text-white tracking-[0.4em] uppercase glow-text">Instructional Meta-Engine</h3>
                                    <p className="text-[11px] text-white/30 font-bold tracking-widest mt-1">Curriculum boards, grade structures, and session cycles.</p>
                                </div>
                            </div>

                            <div className="space-y-12">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 bg-white/[0.02] p-12 rounded-[3.5rem] border border-white/5">
                                    <CustomSelect
                                        label="Pedagogical Board"
                                        options={[
                                            { value: 'CBSE', label: 'CBSE (Central Core)' },
                                            { value: 'ICSE', label: 'ICSE (Indian Standard)' },
                                            { value: 'IB', label: 'IB (Global Baccalaureate)' },
                                            { value: 'State Board', label: 'Regional State Board' },
                                        ]}
                                        value={formData.academic_board || ''}
                                        onChange={(v) => handleChange({ target: { name: 'academic_board', value: v } } as any)}
                                        icon={<BookIcon />}
                                        searchable
                                    />
                                    <PremiumFloatingInput label="Institutional Registry Code" name="affiliation_number" value={formData.affiliation_number || ''} onChange={handleChange} icon={<HashIcon />} />

                                    <CustomSelect
                                        label="Demographic Nexus"
                                        options={[{ value: 'Co-Educational', label: 'Co-Educational' }, { value: 'Boys', label: 'Boys School' }, { value: 'Girls', label: 'Girls School' }]}
                                        value={formData.school_type || ''}
                                        onChange={(v) => handleChange({ target: { name: 'school_type', value: v } } as any)}
                                        icon={<UsersIcon />}
                                    />

                                    <div className="grid grid-cols-2 gap-8">
                                        <CustomSelect label="Session Start" options={MONTHS} value={formData.academic_year_start || ''} onChange={(v) => handleChange({ target: { name: 'academic_year_start', value: v } } as any)} icon={<CalendarIcon />} searchable />
                                        <CustomSelect label="Session End" options={MONTHS} value={formData.academic_year_end || ''} onChange={(v) => handleChange({ target: { name: 'academic_year_end', value: v } } as any)} icon={<CalendarIcon />} searchable />
                                    </div>
                                </div>

                                <div className="bg-emerald-500/[0.03] p-12 rounded-[3.5rem] border border-emerald-500/10 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px]" />
                                    <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em] mb-10 flex items-center gap-4">
                                        <LayersIcon className="w-5 h-5" /> Grade Spectrum Nodes
                                    </h4>
                                    <div className="grid grid-cols-2 gap-12 relative z-10">
                                        <CustomSelect label="Terminal Grade Node (Low)" options={GRADES} value={formData.grade_range_start || ''} onChange={(v) => handleChange({ target: { name: 'grade_range_start', value: v } } as any)} searchable />
                                        <CustomSelect label="Terminal Grade Node (High)" options={GRADES} value={formData.grade_range_end || ''} onChange={(v) => handleChange({ target: { name: 'grade_range_end', value: v } } as any)} searchable />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
            <input type="file" ref={logoInputRef} onChange={handleLogoChange} hidden accept="image/*" />
        </div>
    );
};

export default SchoolAdminForm;
