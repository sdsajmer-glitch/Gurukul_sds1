import React, { useState, useEffect, useMemo } from 'react';
import { supabase, formatError } from '../services/supabase';
import { SchoolBranch, SchoolAdminProfileData } from '../types';
import Spinner from './common/Spinner';
import { SchoolIcon } from './icons/SchoolIcon';
import { LocationIcon } from './icons/LocationIcon';
import { GlobeIcon } from './icons/GlobeIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { ShieldCheckIcon as ShieldIcon } from './icons/ShieldCheckIcon';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon';
import { countries, statesByCountry, citiesByState } from './data/locations';
import { GoogleGenAI } from '@google/genai';

interface BranchFormProps {
    branch?: SchoolBranch | null;
    schoolProfile: SchoolAdminProfileData | null;
    onSave: (branch: SchoolBranch) => void;
    onCancel: () => void;
    readOnly?: boolean;
    onEditMode?: () => void;
}

const FloatingLabelInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string, icon?: React.ReactNode, action?: React.ReactNode, readOnly?: boolean }> = ({ label, icon, action, className, readOnly, ...props }) => (
    <div className="relative group w-full">
        {label && (
            <label className="absolute left-10 top-0 -translate-y-1/2 bg-[#050608] px-2 text-[10px] font-black uppercase tracking-[0.3em] text-white/30 group-focus-within:text-primary transition-all duration-300 z-20">
                {label}
            </label>
        )}
        <div className="absolute top-1/2 -translate-y-1/2 left-6 text-white/10 group-focus-within:text-primary transition-all duration-500 z-10 pointer-events-none">
            {icon}
        </div>
        <input
            {...props}
            disabled={readOnly}
            placeholder=" "
            className={`peer block w-full h-[64px] rounded-[1.5rem] border border-white/5 ${readOnly ? 'bg-transparent border-transparent' : 'bg-white/[0.01]'} px-6 pl-14 ${action ? 'pr-16' : ''} text-sm text-white font-medium shadow-inner transition-all duration-500 hover:border-white/10 focus:border-primary/50 focus:ring-8 focus:ring-primary/5 focus:outline-none placeholder-transparent ${className}`}
        />
        {action && !readOnly && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20">
                {action}
            </div>
        )}
    </div>
);

const StyledSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string, icon?: React.ReactNode, readOnly?: boolean }> = ({ label, icon, children, className, readOnly, ...props }) => (
    <div className="relative group w-full">
        {label && (
            <label className="absolute left-10 top-0 -translate-y-1/2 bg-[#050608] px-2 text-[10px] font-black uppercase tracking-[0.3em] text-white/30 group-focus-within:text-primary transition-all duration-300 z-20">
                {label}
            </label>
        )}
        <div className="absolute top-1/2 -translate-y-1/2 left-6 text-white/10 group-focus-within:text-primary transition-all duration-500 z-10 pointer-events-none">
            {icon}
        </div>
        <select
            {...props}
            disabled={readOnly}
            className={`peer block w-full h-[64px] appearance-none rounded-[1.5rem] border border-white/5 ${readOnly ? 'bg-transparent border-transparent cursor-default' : 'bg-white/[0.01] hover:border-white/10 focus:border-primary/50 focus:ring-8 focus:ring-primary/5 cursor-pointer'} px-6 pl-14 text-sm text-white font-medium shadow-inner transition-all duration-500 focus:outline-none ${className}`}
        >
            {children}
        </select>
        {!readOnly && (
            <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-white/10 group-focus-within:text-primary transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </div>
        )}
    </div>
);

export const BranchForm: React.FC<BranchFormProps> = ({ branch, schoolProfile, onSave, onCancel, readOnly, onEditMode }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isResolvingAddress, setIsResolvingAddress] = useState(false);

    const [formData, setFormData] = useState({
        name: '', address: '', country: 'India', city: '', state: '',
        adminName: '', adminPhone: '', adminEmail: '', isMain: false
    });

    useEffect(() => {
        if (branch) {
            setFormData({
                name: branch.name, address: branch.address, country: branch.country || 'India', state: branch.state || '', city: branch.city || '',
                adminName: branch.admin_name || '', adminPhone: branch.admin_phone || '', adminEmail: branch.admin_email || '', isMain: branch.is_main_branch
            });
        } else if (schoolProfile) {
            // New branch defaults for head office
            setFormData({
                name: schoolProfile.school_name || '',
                address: schoolProfile.address || '',
                country: schoolProfile.country || 'India',
                state: schoolProfile.state || '',
                city: schoolProfile.city || '',
                adminName: schoolProfile.admin_contact_name || '',
                adminPhone: schoolProfile.admin_contact_phone || '',
                adminEmail: schoolProfile.admin_contact_email || '',
                isMain: false
            });
        }
    }, [branch, schoolProfile]);

    const handleResolveAddress = async () => {
        if (!formData.address.trim()) return;
        setIsResolvingAddress(true);
        setError(null);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
            const prompt = `Based on the street address "${formData.address}", identify the city, state, and country.
            Output ONLY strictly as a valid JSON object: {"city": "string", "state": "string", "country": "string"}.
            Important: The "country" must match one of these: ${countries.join(', ')}. The "state" must match a valid state in that country.`;

            const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: prompt,
            });

            const text = response.text || '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                setFormData(prev => ({
                    ...prev,
                    city: data.city || prev.city,
                    state: data.state || prev.state,
                    country: data.country || prev.country
                }));
            }
        } catch (err) {
            console.error("Address auto-fill error:", err);
            setError("Unable to auto-fill address details. Please enter manually.");
        } finally {
            setIsResolvingAddress(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;
        setIsSaving(true);
        setError(null);
        try {
            const payload = {
                p_name: formData.name,
                p_address: formData.address,
                p_city: formData.city,
                p_state: formData.state,
                p_country: formData.country,
                p_contact_number: " ",
                p_is_main: formData.isMain,
                p_email: formData.adminEmail,
                p_admin_name: formData.adminName,
                p_admin_phone: formData.adminPhone,
                p_admin_email: formData.adminEmail
            };

            if (branch) {
                const { data, error } = await supabase.rpc('update_school_branch', { ...payload, p_branch_id: branch.id });
                if (error) throw error;
                onSave(data[0]);
            } else {
                const { data, error } = await supabase.rpc('create_school_branch', payload);
                if (error) throw error;
                onSave(data[0]);
            }
        } catch (err: any) {
            setError(formatError(err));
        } finally {
            setIsSaving(false);
        }
    };

    const availableStates = useMemo(() => formData.country ? statesByCountry[formData.country] || [] : [], [formData.country]);
    const availableCities = useMemo(() => formData.state ? citiesByState[formData.state] || [] : [], [formData.state]);

    return (
        <form onSubmit={handleSubmit} className="space-y-16">
            {error && (
                <div className="p-8 rounded-[2rem] border border-red-500/20 bg-red-500/5 text-red-500 text-[11px] font-black uppercase tracking-[0.3em] flex items-center gap-4">
                    <AlertTriangleIcon className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <div className="grid grid-cols-1 gap-12">
                {/* Section 01: Core Identity */}
                <div className="space-y-10">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-[1px] bg-primary/40" />
                        <p className="text-[11px] font-black uppercase tracking-[0.6em] text-primary">01. Core Identity</p>
                    </div>
                    <FloatingLabelInput
                        label="Institution Identity"
                        icon={<SchoolIcon className="w-5 h-5" />}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        readOnly={readOnly}
                    />
                </div>

                {/* Section 02: Geo-Topical Registry */}
                <div className="space-y-10">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-[1px] bg-primary/40" />
                        <p className="text-[11px] font-black uppercase tracking-[0.6em] text-primary">02. Geo-Topical Registry</p>
                    </div>
                    <FloatingLabelInput
                        label="Geographical Signature (Address)"
                        icon={<LocationIcon className="w-5 h-5" />}
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        action={
                            <button
                                type="button"
                                onClick={handleResolveAddress}
                                disabled={isResolvingAddress}
                                className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-lg active:scale-95"
                            >
                                {isResolvingAddress ? <Spinner size="sm" className="text-primary" /> : <SparklesIcon className="w-5 h-5" />}
                            </button>
                        }
                        required
                        readOnly={readOnly}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                        <StyledSelect label="Country" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value, state: '', city: '' })} icon={<GlobeIcon className="w-5 h-5" />} readOnly={readOnly}>
                            {countries.map(c => <option key={c} value={c}>{c}</option>)}
                        </StyledSelect>
                        <StyledSelect label="State" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value, city: '' })} disabled={!formData.country} icon={<LocationIcon className="w-5 h-5" />} readOnly={readOnly}>
                            <option value="">Select State</option>
                            {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
                        </StyledSelect>
                        {availableCities.length > 0 || readOnly ? (
                            <StyledSelect label="City" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} disabled={!formData.state} icon={<LocationIcon className="w-5 h-5" />} readOnly={readOnly}>
                                <option value="">Select City</option>
                                {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                            </StyledSelect>
                        ) : (
                            <FloatingLabelInput label="City" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} disabled={!formData.state} icon={<LocationIcon className="w-5 h-5" />} readOnly={readOnly} />
                        )}
                    </div>
                </div>

                {/* Section 03: Node Administrator */}
                <div className="space-y-10">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-[1px] bg-primary/40" />
                        <p className="text-[11px] font-black uppercase tracking-[0.6em] text-primary">03. Node Administrator</p>
                    </div>
                    <FloatingLabelInput label="Admin Protocol Name" icon={<ShieldIcon className="w-5 h-5" />} value={formData.adminName} onChange={(e) => setFormData({ ...formData, adminName: e.target.value })} required readOnly={readOnly} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <FloatingLabelInput label="Comms Channel (Phone)" icon={<div className="font-mono text-[10px] text-white opacity-20">+91</div>} value={formData.adminPhone} onChange={(e) => setFormData({ ...formData, adminPhone: e.target.value })} required readOnly={readOnly} />
                        <FloatingLabelInput label="Secure Signal (Email)" icon={<GlobeIcon className="w-5 h-5 opacity-20" />} value={formData.adminEmail} onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })} type="email" required readOnly={readOnly} />
                    </div>
                </div>

                {/* Section 04: Matrix Authority */}
                <div className="space-y-10">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-[1px] bg-primary/40" />
                        <p className="text-[11px] font-black uppercase tracking-[0.6em] text-primary">04. Matrix Authority</p>
                    </div>
                    <div
                        onClick={() => !readOnly && setFormData({ ...formData, isMain: !formData.isMain })}
                        className={`group relative p-10 rounded-[2.5rem] border transition-all ${readOnly ? 'cursor-default' : 'cursor-pointer'} overflow-hidden ${formData.isMain ? 'bg-primary/5 border-primary/30' : 'bg-white/[0.01] border-white/5 hover:border-white/10'}`}
                    >
                        <div className="flex items-center gap-8 relative z-10">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${formData.isMain ? 'bg-primary text-white shadow-[0_0_30px_rgba(139,92,246,0.5)]' : 'bg-white/5 text-white/20'}`}>
                                <ShieldIcon className="w-7 h-7" />
                            </div>
                            <div>
                                <p className={`text-[13px] font-black uppercase tracking-[0.3em] ${formData.isMain ? 'text-primary' : 'text-white/40'}`}>Central Command Node</p>
                                <p className="text-[10px] font-black text-white/10 uppercase tracking-widest mt-1">Designate this branch as the master network hub</p>
                            </div>
                        </div>
                        {formData.isMain && <div className="absolute inset-0 bg-primary/10 blur-[60px]" />}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="pt-12 border-t border-white/[0.05] flex items-center justify-between gap-10">
                {readOnly ? (
                    <>
                        <button type="button" onClick={onCancel} className="btn-secondary-premium px-12 border-none">Close Details</button>
                        <button type="button" onClick={onEditMode} className="btn-primary-premium flex items-center gap-6 px-16 text-[13px]">
                            Edit Configuration
                            <div className="w-px h-6 bg-white/20 mx-2" />
                            <SparklesIcon className="w-6 h-6 opacity-40" />
                        </button>
                    </>
                ) : (
                    <>
                        <button type="button" onClick={onCancel} className="btn-secondary-premium px-12 border-none">Cancel</button>
                        <button type="submit" disabled={isSaving} className="btn-primary-premium flex items-center gap-6 px-16 text-[13px]">
                            {isSaving ? <Spinner size="sm" className="text-white" /> : (
                                <>
                                    {branch ? 'Sync Protocol' : 'Initialize Node'}
                                    <div className="w-px h-6 bg-white/20 mx-2" />
                                    <SparklesIcon className="w-6 h-6 opacity-40" />
                                </>
                            )}
                        </button>
                    </>
                )}
            </div>
        </form>
    );
};
