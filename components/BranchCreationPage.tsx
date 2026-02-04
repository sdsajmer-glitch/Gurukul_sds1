
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase, formatError } from '../services/supabase';
import { SchoolBranch, UserProfile, SchoolAdminProfileData, BuiltInRoles } from '../types';
import Spinner from './common/Spinner';
import { SchoolIcon } from './icons/SchoolIcon';
import { PlusIcon } from './icons/PlusIcon';
import { XIcon } from './icons/XIcon';
import { UsersIcon } from './icons/UsersIcon';
import { PhoneIcon } from './icons/PhoneIcon';
import { MailIcon } from './icons/MailIcon';
import ConfirmationModal from './common/ConfirmationModal';
import { countries, statesByCountry, citiesByState } from './data/locations';
import { LocationIcon } from './icons/LocationIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { GlobeIcon } from './icons/GlobeIcon';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { CheckoutIcon } from './icons/CheckoutIcon';
import { EditIcon } from './icons/EditIcon';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';

interface BranchCreationPageProps {
    onNext?: () => void;
    profile?: UserProfile;
    onBack?: () => void;
    hideHero?: boolean;
    initialBranch?: SchoolBranch | null;
}

const FloatingLabelInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string, icon?: React.ReactNode, action?: React.ReactNode, error?: string, hint?: string }> = ({ label, icon, action, error, hint, className, ...props }) => (
    <div className="relative group/input w-full space-y-1.5">
        <div className="relative">
            <div className={`absolute top-1/2 -translate-y-1/2 left-4 transition-colors duration-300 z-10 pointer-events-none
                ${error ? 'text-red-500' : 'text-white/20 group-focus-within/input:text-primary'}`}>
                {icon}
            </div>
            <input
                {...props}
                placeholder=" "
                className={`peer block w-full rounded-2xl border bg-white/[0.02] px-4 py-4 pl-12 ${action ? 'pr-14' : ''} text-[15px] text-white font-medium transition-all duration-300
                    ${error
                        ? 'border-red-500/50 bg-red-500/[0.02] focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                        : 'border-white/5 hover:border-white/10 focus:border-primary/50 focus:bg-white/[0.04] focus:ring-4 focus:ring-primary/10'} 
                    focus:outline-none placeholder-transparent ${className}`}
            />
            <label className={`absolute left-11 top-0 -translate-y-1/2 bg-[#0a0a0b] px-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 pointer-events-none
                peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-bold peer-placeholder-shown:text-white/20 peer-placeholder-shown:tracking-normal
                peer-focus:top-0 peer-focus:text-[10px] peer-focus:font-black peer-focus:tracking-[0.2em]
                ${error ? 'text-red-500' : 'text-primary'}`}>
                {label} {props.required && <span className="text-red-500/50 ml-1 mt-1">*</span>}
            </label>
            {action && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex items-center">
                    {action}
                </div>
            )}
        </div>
        {error ? (
            <p className="flex items-center gap-1.5 px-1 text-[10px] font-bold text-red-500 uppercase tracking-wider animate-in fade-in slide-in-from-top-1">
                <XIcon className="w-3 h-3" /> {error}
            </p>
        ) : hint && (
            <p className="px-1 text-[10px] font-medium text-white/20 uppercase tracking-widest leading-relaxed">
                {hint}
            </p>
        )}
    </div>
);

const InstitutionalSelect: React.FC<{
    label: string,
    icon?: React.ReactNode,
    error?: string,
    hint?: string,
    value: string,
    onChange: (value: string) => void,
    options: { value: string, label: string }[],
    disabled?: boolean,
    required?: boolean,
    className?: string,
    searchable?: boolean
}> = ({ label, icon, value, onChange, options, error, hint, disabled, required, className, searchable = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const filteredOptions = useMemo(() => {
        if (!searchable || !searchTerm) return options;
        const lowerTerm = searchTerm.toLowerCase();
        return options.filter(opt => opt.label.toLowerCase().includes(lowerTerm));
    }, [options, searchTerm, searchable]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && searchable && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
        if (!isOpen) setSearchTerm('');
    }, [isOpen, searchable]);

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className={`relative group/select w-full space-y-1.5 ${className || ''}`} ref={containerRef}>
            <div className="relative">
                <div className={`absolute top-1/2 -translate-y-1/2 left-4 transition-colors duration-300 z-10 pointer-events-none
                    ${error ? 'text-red-500' : 'text-white/20 group-focus-within/select:text-primary'}
                    ${isOpen ? 'text-primary' : ''}`}>
                    {icon}
                </div>

                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    className={`peer block w-full text-left rounded-2xl border bg-white/[0.02] px-4 py-4 pl-12 pr-10 text-[15px] font-medium transition-all duration-300
                        ${error
                            ? 'border-red-500/50 bg-red-500/[0.02] focus:border-red-500 ring-4 ring-red-500/10'
                            : isOpen
                                ? 'border-primary/50 bg-white/[0.04] ring-4 ring-primary/10'
                                : 'border-white/5 hover:border-white/10'} 
                        ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                        ${selectedOption ? 'text-white' : 'text-white/20'}`}
                >
                    {selectedOption ? selectedOption.label : "Select Option..."}
                </button>

                <label className={`absolute left-11 top-0 -translate-y-1/2 bg-[#0a0a0b] px-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 pointer-events-none z-20
                    ${error ? 'text-red-500' : isOpen ? 'text-primary' : 'text-primary/60'}`}>
                    {label} {required && <span className="text-red-500/50 ml-1 mt-1">*</span>}
                </label>

                <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-500
                    ${error ? 'text-red-500' : (isOpen ? 'text-primary rotate-180' : 'text-white/20 group-hover/select:text-white/40')}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="absolute z-[100] mt-3 w-full bg-[#0a0a0b] rounded-2xl border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-2xl ring-1 ring-white/10 origin-top"
                        >
                            {searchable && (
                                <div className="p-3 border-b border-white/5 bg-white/[0.01]">
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Filter records..."
                                        className="w-full pl-4 pr-4 py-3 text-[11px] rounded-xl bg-black border border-white/5 focus:border-primary/50 outline-none text-white placeholder:text-white/10 font-black uppercase tracking-widest"
                                    />
                                </div>
                            )}

                            <div className="max-h-60 overflow-y-auto p-2 custom-scrollbar">
                                {filteredOptions.length > 0 ? (
                                    filteredOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => {
                                                onChange(option.value);
                                                setIsOpen(false);
                                            }}
                                            className={`w-full flex items-center gap-3 px-4 py-3.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all duration-200 group mb-1 last:mb-0
                                                ${value === option.value
                                                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                                    : 'text-white/30 hover:bg-white/[0.05] hover:text-white'
                                                }`}
                                        >
                                            <span className="flex-grow text-left truncate">{option.label}</span>
                                            {value === option.value && <CheckCircleIcon className="w-3.5 h-3.5 text-white animate-in zoom-in-50" />}
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-5 py-10 flex flex-col items-center gap-3 text-white/20 italic">
                                        <XIcon className="w-6 h-6 opacity-20" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-center">No segments found</span>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            {error ? (
                <p className="flex items-center gap-1.5 px-1 text-[10px] font-bold text-red-500 uppercase tracking-wider animate-in fade-in slide-in-from-top-1">
                    <XIcon className="w-3 h-3" /> {error}
                </p>
            ) : hint && (
                <p className="px-1 text-[10px] font-medium text-white/20 uppercase tracking-widest leading-relaxed">
                    {hint}
                </p>
            )}
        </div>
    );
};

export const BranchCreationPage: React.FC<BranchCreationPageProps> = ({ onNext, profile, onBack, hideHero = false, initialBranch }) => {
    const [branches, setBranches] = useState<SchoolBranch[]>([]);
    const [schoolData, setSchoolData] = useState<SchoolAdminProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<SchoolBranch | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isResolvingAddress, setIsResolvingAddress] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);
    const [deletingBranch, setDeletingBranch] = useState<SchoolBranch | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isFinishing, setIsFinishing] = useState(false);

    const isMounted = useRef(true);

    const [formData, setFormData] = useState({
        name: '', address: '', country: 'India', city: '', state: '',
        adminName: '', adminPhone: '', adminEmail: '', isMain: false
    });

    const isHeadOfficeAdmin = useMemo(() => {
        return profile?.role === BuiltInRoles.SCHOOL_ADMINISTRATION;
    }, [profile]);

    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    const handleBranchUpdate = (updatedBranch: SchoolBranch, isDelete: boolean = false) => {
        if (!isMounted.current) return;
        if (isDelete) {
            setBranches(prev => prev.filter(b => b.id !== updatedBranch.id));
        } else {
            setBranches(prev => {
                const exists = prev.some(b => b.id === updatedBranch.id);
                const newBranches = exists
                    ? prev.map(b => (b.id === updatedBranch.id ? updatedBranch : b))
                    : [...prev, updatedBranch];
                return newBranches.sort((a, b) => (b.is_main_branch ? 1 : 0) - (a.is_main_branch ? 1 : 0));
            });
        }
    };

    const fetchInitialData = useCallback(async (isUpdate = false) => {
        if (!isMounted.current) return;
        if (!isUpdate) setLoading(true);
        setError(null);
        try {
            const [branchRes, schoolRes] = await Promise.all([
                supabase.rpc('get_school_branches'),
                profile?.id ? supabase.from('school_admin_profiles').select('*').eq('user_id', profile.id).maybeSingle() : Promise.resolve({ data: null, error: null })
            ]);

            if (branchRes.error) throw branchRes.error;
            if (schoolRes.error && schoolRes.error.code !== 'PGRST116') throw schoolRes.error;

            if (isMounted.current) {
                const currentBranches = (branchRes.data || []).sort((a: SchoolBranch, b: SchoolBranch) => (b.is_main_branch ? 1 : 0) - (a.is_main_branch ? 1 : 0));
                setBranches(currentBranches);
                if (schoolRes.data) setSchoolData(schoolRes.data);
            }
        } catch (err: any) {
            if (isMounted.current) setError(formatError(err));
        } finally {
            if (isMounted.current && !isUpdate) setLoading(false);
        }
    }, [profile?.id]);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    // Initialize Form Data from Prop (Critical for Edit Mode in Modal)
    useEffect(() => {
        if (initialBranch) {
            setEditingBranch(initialBranch);
            setFormData({
                name: initialBranch.name,
                address: initialBranch.address,
                country: initialBranch.country || 'India',
                state: initialBranch.state || '',
                city: initialBranch.city || '',
                adminName: initialBranch.admin_name || '',
                adminPhone: initialBranch.admin_phone || '',
                adminEmail: initialBranch.admin_email || '',
                isMain: initialBranch.is_main_branch
            });
        } else if (hideHero) {
            // Reset for "Create New" in modal
            setEditingBranch(null);
            setFormData({
                name: '', address: '', country: 'India', city: '', state: '',
                adminName: '', adminPhone: '', adminEmail: '', isMain: false
            });
        }
    }, [initialBranch, hideHero]);

    const isDirty = useMemo(() => {
        const base = editingBranch ? {
            name: editingBranch.name, address: editingBranch.address, country: editingBranch.country || 'India', state: editingBranch.state || '', city: editingBranch.city || '',
            adminName: editingBranch.admin_name || '', adminPhone: editingBranch.admin_phone || '', adminEmail: editingBranch.admin_email || '', isMain: editingBranch.is_main_branch
        } : {
            name: '', address: '', country: 'India', city: '', state: '',
            adminName: '', adminPhone: '', adminEmail: '', isMain: branches.length === 0
        };
        // Simple string comparison for dirty check
        return JSON.stringify(formData) !== JSON.stringify(base);
    }, [formData, editingBranch, branches.length]);

    const formErrors = useMemo(() => {
        const errors: Record<string, string> = {};
        if (!formData.name.trim()) errors.name = "Designation required";
        if (!formData.address.trim()) errors.address = "Geo-location required";
        if (!formData.country) errors.country = "Select jurisdiction";
        if (!formData.state) errors.state = "Select administrative state";
        if (!formData.city) errors.city = "Select city node";

        if (formData.adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail)) {
            errors.adminEmail = "Invalid protocol email";
        }
        if (!formData.adminEmail) errors.adminEmail = "Protocol email required";
        if (!formData.adminName) errors.adminName = "Administrator identity required";

        return errors;
    }, [formData]);

    const isFormValid = Object.keys(formErrors).length === 0;

    const handleOpenCreate = (currentSchoolData: SchoolAdminProfileData | null = schoolData) => {
        if (!isMounted.current) return;
        setEditingBranch(null);
        const isHeadOffice = branches.length === 0;
        setFormData({
            name: (isHeadOffice && currentSchoolData?.school_name) || '',
            address: (isHeadOffice && currentSchoolData?.address) || '',
            country: (isHeadOffice && currentSchoolData?.country) || 'India',
            state: (isHeadOffice && currentSchoolData?.state) || '',
            city: (isHeadOffice && currentSchoolData?.city) || '',
            adminName: (isHeadOffice && currentSchoolData?.admin_contact_name) || '',
            adminPhone: (isHeadOffice && currentSchoolData?.admin_contact_phone) || '',
            adminEmail: (isHeadOffice && currentSchoolData?.admin_contact_email) || '',
            isMain: isHeadOffice
        });
        setModalError(null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        if (isDirty && !window.confirm("Unsaved changes will be discarded. Continue?")) {
            return;
        }
        setIsModalOpen(false);
    };

    const handleOpenEdit = (branch: SchoolBranch) => {
        if (!isMounted.current) return;
        setEditingBranch(branch);
        setFormData({
            name: branch.name, address: branch.address, country: branch.country || 'India', state: branch.state || '', city: branch.city || '',
            adminName: branch.admin_name || '', adminPhone: branch.admin_phone || '', adminEmail: branch.admin_email || '', isMain: branch.is_main_branch
        });
        setModalError(null);
        setIsModalOpen(true);
    };

    const handleResolveAddress = async () => {
        if (!formData.address?.trim()) return;
        setIsResolvingAddress(true);
        setModalError(null);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
            const prompt = `Based on the street address "${formData.address}", identify the city, state, and country. 
            Output ONLY strictly as a valid JSON object: {"city": "string", "state": "string", "country": "string"}.
            Country must be exactly one of: ${countries.join(', ')}.`;

            // Use gemini-2.5-flash as primary (project standard), but ready for property vs function response
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { tools: [{ googleMaps: {} }] }
            });

            // Defensive extraction: SDKs vary between .text (property) and .text() (function)
            let text = "";
            try {
                if (typeof response.text === 'function') {
                    text = await response.text();
                } else if (typeof response.response?.text === 'function') {
                    text = await response.response.text();
                } else {
                    text = response.text || "";
                }
            } catch (e) {
                console.warn("Direct text extraction failed, trying raw response access", e);
                text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
            }

            console.log('Auto-fill resolution result:', text);

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                setFormData(prev => ({
                    ...prev,
                    city: data.city || prev.city,
                    state: data.state || prev.state,
                    country: data.country || prev.country
                }));
                setModalError(null); // Explicitly clear on success
            } else {
                console.warn('No JSON found in AI response:', text);
                setModalError("Unable to locate address metadata. Please enter manually.");
            }
        } catch (err: any) {
            console.error("Address auto-fill error:", err);
            const errorMsg = err.message?.toLowerCase() || "";
            if (errorMsg.includes('404') || errorMsg.includes('not found')) {
                setModalError("Identity Protocol (AI) offline. Please enter location manually.");
            } else if (errorMsg.includes('limit') || errorMsg.includes('429')) {
                setModalError("AI Rate limit reached. Please wait a moment or enter manually.");
            } else {
                setModalError("Unable to auto-fill details. Please enter manually.");
            }
        } finally {
            setIsResolvingAddress(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setModalError(null);
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

            if (editingBranch) {
                const { data, error } = await supabase.rpc('update_school_branch', { ...payload, p_branch_id: editingBranch.id });
                if (error) throw error;
                if (isMounted.current) handleBranchUpdate(data[0]);
            } else {
                const { data, error } = await supabase.rpc('create_school_branch', payload);
                if (error) throw error;
                if (isMounted.current) handleBranchUpdate(data[0]);
            }
            if (isMounted.current) {
                setIsModalOpen(false);
                if (onNext) onNext();
            }
        } catch (err: any) {
            if (isMounted.current) setModalError(formatError(err));
        } finally {
            if (isMounted.current) setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingBranch) return;
        setIsDeleting(true);
        const { error } = await supabase.rpc('delete_school_branch', { p_branch_id: deletingBranch.id });

        if (isMounted.current) {
            if (error) {
                alert(`Failed to delete: ${formatError(error)}`);
            } else {
                handleBranchUpdate(deletingBranch, true);
            }
            setIsDeleting(false);
            setDeletingBranch(null);
        }
    };

    const handleFinish = () => {
        if (isFinishing || !onNext) return;
        setIsFinishing(true);
        onNext();
    };

    const handleCountryChange = (val: string) => setFormData({ ...formData, country: val, state: '', city: '' });
    const handleStateChange = (val: string) => setFormData({ ...formData, state: val, city: '' });
    const availableStates = useMemo(() => formData.country ? statesByCountry[formData.country] || [] : [], [formData.country]);
    const availableCities = useMemo(() => formData.state ? citiesByState[formData.state] || [] : [], [formData.state]);

    const jurisdictionOptions = useMemo(() => countries.map(c => ({ value: c, label: c })), []);
    const stateOptions = useMemo(() => availableStates.map(s => ({ value: s, label: s })), [availableStates]);
    const cityOptions = useMemo(() => availableCities.map(c => ({ value: c, label: c })), [availableCities]);

    const renderForm = () => (
        <form onSubmit={handleSave} className="space-y-12 animate-in fade-in duration-500 overflow-visible pb-10">
            {modalError && (
                <div className="bg-red-500/10 text-red-500 p-5 rounded-2xl text-[11px] font-black uppercase tracking-widest border border-red-500/20 flex items-center gap-4 animate-in shake">
                    <div className="p-2 bg-red-500/10 rounded-lg">
                        <XIcon className="w-4 h-4" />
                    </div>
                    <span>{modalError}</span>
                </div>
            )}

            <div className="space-y-14">
                {/* Node Architecture Group */}
                <div className="group/section space-y-8">
                    <div className="flex items-center gap-4 transition-transform group-hover/section:translate-x-1 duration-300">
                        <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.05)]">
                            <SchoolIcon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <h4 className="text-[11px] font-black uppercase text-white tracking-[0.3em]">Node Architecture</h4>
                            <p className="text-[9px] font-medium text-white/20 uppercase tracking-widest mt-1">Configure campus hardware identity</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                        <FloatingLabelInput
                            label="Campus Designation"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                            error={formErrors.name}
                            hint="Physical name of the institution or branch"
                            icon={<SchoolIcon className="w-4 h-4" />}
                        />
                        <FloatingLabelInput
                            label="Geo-location Address"
                            value={formData.address}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                            required
                            error={formErrors.address}
                            hint="Enter street address for automated satellite positioning"
                            icon={<LocationIcon className="w-4 h-4" />}
                            action={
                                <button
                                    type="button"
                                    onClick={handleResolveAddress}
                                    disabled={isResolvingAddress || !formData.address.trim()}
                                    className="px-4 py-2 bg-primary/5 hover:bg-primary/10 text-primary rounded-xl transition-all disabled:opacity-30 border border-primary/10 flex items-center gap-2 group/btn"
                                >
                                    {isResolvingAddress ? <Spinner size="sm" /> : (
                                        <>
                                            <SparklesIcon className="w-4 h-4 transition-transform group-hover/btn:scale-125" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Auto-Position</span>
                                        </>
                                    )}
                                </button>
                            }
                        />
                    </div>
                </div>

                {/* Geo-Location Group */}
                <div className="group/section space-y-8">
                    <div className="flex items-center gap-4 transition-transform group-hover/section:translate-x-1 duration-300">
                        <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                            <LocationIcon className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div>
                            <h4 className="text-[11px] font-black uppercase text-white tracking-[0.3em]">Geo-Location</h4>
                            <p className="text-[9px] font-medium text-white/20 uppercase tracking-widest mt-1">Regional jurisdiction mapping</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <InstitutionalSelect
                            label="Jurisdiction"
                            required
                            value={formData.country}
                            onChange={handleCountryChange}
                            options={jurisdictionOptions}
                            error={formErrors.country}
                            icon={<GlobeIcon className="w-4 h-4" />}
                            searchable
                        />

                        <InstitutionalSelect
                            label="Administrative State"
                            required
                            value={formData.state}
                            onChange={handleStateChange}
                            disabled={!formData.country}
                            options={stateOptions}
                            error={formErrors.state}
                            icon={<LocationIcon className="w-4 h-4" />}
                            searchable
                        />

                        {availableCities.length > 0 ? (
                            <InstitutionalSelect
                                className="md:col-span-2"
                                label="Sync City"
                                required
                                value={formData.city}
                                onChange={val => setFormData({ ...formData, city: val })}
                                disabled={!formData.state}
                                options={cityOptions}
                                error={formErrors.city}
                                icon={<LocationIcon className="w-4 h-4" />}
                                searchable
                            />
                        ) : (
                            <FloatingLabelInput className="md:col-span-2" label="Sync City" required value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} disabled={!formData.state} error={formErrors.city} icon={<LocationIcon className="w-4 h-4" />} />
                        )}
                    </div>
                </div>

                {/* Access Authority Group */}
                <div className="group/section space-y-8">
                    <div className="flex items-center gap-4 transition-transform group-hover/section:translate-x-1 duration-300">
                        <div className="p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/20">
                            <UsersIcon className="w-4 h-4 text-purple-500" />
                        </div>
                        <div>
                            <h4 className="text-[11px] font-black uppercase text-white tracking-[0.3em]">Access Authority</h4>
                            <p className="text-[9px] font-medium text-white/20 uppercase tracking-widest mt-1">Administrative credentials & contact</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <FloatingLabelInput
                            label="Administrator Identity"
                            value={formData.adminName}
                            onChange={e => setFormData({ ...formData, adminName: e.target.value })}
                            required
                            error={formErrors.adminName}
                            hint="Full legal name of the node administrator"
                            icon={<UsersIcon className="w-4 h-4" />}
                        />
                        <FloatingLabelInput
                            label="Secure Contact"
                            type="tel"
                            value={formData.adminPhone}
                            onChange={e => setFormData({ ...formData, adminPhone: e.target.value })}
                            hint="Verified contact number for emergency protocol"
                            icon={<PhoneIcon className="w-4 h-4" />}
                        />
                        <div className="md:col-span-2">
                            <FloatingLabelInput
                                label="Protocol Email"
                                type="email"
                                required
                                value={formData.adminEmail}
                                onChange={e => setFormData({ ...formData, adminEmail: e.target.value })}
                                error={formErrors.adminEmail}
                                hint="Primary communication channel (strictly for administrative alerts)"
                                icon={<MailIcon className="w-4 h-4" />}
                            />
                        </div>
                    </div>
                </div>

                {isHeadOfficeAdmin && (
                    <div
                        className={`flex items-start gap-5 p-6 rounded-[2rem] border transition-all duration-500 cursor-pointer ${formData.isMain ? 'bg-primary/5 border-primary/20 shadow-[0_0_50px_rgba(var(--primary),0.1)] scale-[1.01]' : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.03] hover:border-white/10'}`}
                        onClick={() => setFormData({ ...formData, isMain: !formData.isMain })}
                    >
                        <div className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-500 ${formData.isMain ? 'bg-primary border-primary shadow-[0_0_15px_rgba(var(--primary),0.5)]' : 'bg-black/40 border-white/10'}`}>
                            {formData.isMain && <CheckCircleIcon className="w-4 h-4 text-white" />}
                        </div>
                        <div className="flex-grow">
                            <p className="font-black text-[11px] uppercase tracking-[0.2em] text-white">Central Authority Node</p>
                            <p className="text-[10px] text-white/30 font-medium mt-1 uppercase tracking-widest leading-relaxed">Designate this location as the primary Institutional Headquarters</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="pt-10 flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-white/5 bg-[#0a0a0b]/80 backdrop-blur-xl sticky bottom-0 z-30 py-4 -mx-10 px-10">
                <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-8 py-3 text-[10px] font-black text-white/30 uppercase tracking-[0.3em] hover:text-white transition-all order-2 sm:order-1"
                >
                    Discard Configuration
                </button>
                <button
                    type="submit"
                    disabled={isSaving || !isFormValid}
                    className={`h-14 px-12 rounded-2xl font-black text-[11px] uppercase tracking-[0.25em] transition-all duration-500 flex items-center justify-center gap-4 group/submit order-1 sm:order-2 w-full sm:w-auto
                        ${!isFormValid
                            ? 'bg-white/5 text-white/10 cursor-not-allowed border border-white/5'
                            : 'bg-primary text-white shadow-2xl shadow-primary/20 hover:scale-[1.02] hover:shadow-primary/40 active:scale-[0.98]'}`}
                >
                    {isSaving ? (
                        <>
                            <Spinner size="sm" />
                            <span>Processing...</span>
                        </>
                    ) : (
                        <>
                            <CheckCircleIcon className="w-5 h-5 transition-transform group-hover/submit:scale-110" />
                            <span>{editingBranch ? 'Update Node Metrics' : 'Initialize Node'}</span>
                        </>
                    )}
                </button>
            </div>
        </form>
    );

    if (hideHero) return <div className="bg-[#0a0a0b]">{renderForm()}</div>;

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 animate-in fade-in duration-500 pb-20">
            {/* HERO SECTION */}
            {!hideHero && (
                <div className="relative rounded-[2.5rem] bg-[#0a0a0b] border border-white/10 p-10 md:p-14 mb-14 overflow-hidden shadow-2xl group">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                    <div className="absolute -right-20 -top-20 opacity-[0.03] pointer-events-none group-hover:scale-105 transition-transform duration-1000">
                        <SchoolIcon className="w-96 h-96 text-white" />
                    </div>

                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-12">
                        <div className="flex-grow">
                            <h1 className="text-5xl md:text-6xl font-sans font-black text-white tracking-tight uppercase leading-none mb-4 italic">
                                Network <span className="text-white/20 not-italic">Map</span>
                            </h1>
                            <p className="text-sm font-medium text-white/40 max-w-2xl leading-relaxed border-l-2 border-primary/20 pl-6">
                                Establish and maintain the distributed infrastructure of your institution. Secure, single-entry protocol for all satellite campuses.
                            </p>
                        </div>

                        <button
                            onClick={() => handleOpenCreate()}
                            className="bg-primary hover:bg-primary/90 text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:shadow-primary/5 transition-all transform hover:-translate-y-1 active:scale-95 flex items-center gap-3"
                        >
                            <PlusIcon className="w-5 h-5" /> Expand Network
                        </button>
                    </div>
                </div>
            )}

            {/* ACTION BAR */}
            <div className="flex justify-between items-center mb-12 px-2">
                {onBack && (
                    <button onClick={onBack} className="flex items-center gap-3 text-white/20 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest">
                        <ChevronLeftIcon className="w-4 h-4" /> Return to Command
                    </button>
                )}

                {onNext && branches.length > 0 && (
                    <button onClick={handleFinish} className="flex items-center gap-4 text-emerald-500 hover:text-emerald-400 font-black text-[10px] uppercase tracking-widest">
                        Finalize Architecture <CheckoutIcon className="w-4 h-4" />
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center p-40">
                    <Spinner size="lg" className="text-primary" />
                </div>
            ) : branches.length === 0 ? (
                <div onClick={() => handleOpenCreate()} className="border-2 border-dashed border-white/5 rounded-[3rem] p-32 flex flex-col items-center justify-center text-center gap-8 group cursor-pointer hover:bg-white/[0.01] transition-all">
                    <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center text-white/10 group-hover:text-primary transition-all duration-500">
                        <SchoolIcon className="w-10 h-10" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tight">Empty Framework</h3>
                        <p className="text-sm text-white/20 font-medium">Initialize the primary head office node to begin.</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {branches.map(branch => (
                        <div key={branch.id} className="bg-[#0a0a0b] border border-white/5 rounded-[2rem] p-8 space-y-8 group hover:border-white/10 transition-all">
                            <div className="flex justify-between items-start">
                                <div className={`p-4 rounded-2xl ${branch.is_main_branch ? 'bg-primary/10 text-primary' : 'bg-white/5 text-white/40'}`}>
                                    <SchoolIcon className="w-6 h-6" />
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleOpenEdit(branch)} className="p-2 text-white/20 hover:text-white"><EditIcon className="w-4 h-4" /></button>
                                    {!branch.is_main_branch && (
                                        <button onClick={() => setDeletingBranch(branch)} className="p-2 text-white/20 hover:text-red-500"><XIcon className="w-4 h-4" /></button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white tracking-tight uppercase leading-none mb-2">{branch.name}</h3>
                                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest flex items-center gap-2">
                                    <LocationIcon className="w-3 h-3" /> {branch.city}, {branch.state}
                                </p>
                            </div>
                            <div className="pt-6 border-t border-white/5 flex justify-between items-center">
                                <span className={`text-[9px] font-black uppercase tracking-widest ${branch.is_main_branch ? 'text-primary' : 'text-white/20'}`}>
                                    {branch.is_main_branch ? 'Head Office' : 'Satellite Node'}
                                </span>
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-black text-white/40 uppercase">
                                    {branch.admin_name?.[0] || '?'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-50 flex items-center justify-center p-0 md:p-10 animate-in fade-in duration-500" onClick={handleCloseModal}>
                    <div
                        className="bg-[#0a0a0b] w-full max-w-4xl h-full md:h-auto md:max-h-[95vh] rounded-none md:rounded-[3rem] border-0 md:border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="px-10 py-10 border-b border-white/5 flex justify-between items-center bg-white/[0.02] relative overflow-hidden shrink-0">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                            <div>
                                <h3 className="text-3xl font-black text-white uppercase tracking-tight italic flex items-center gap-4">
                                    <div className="p-2 bg-primary/20 rounded-lg">
                                        <SchoolIcon className="w-6 h-6 text-primary" />
                                    </div>
                                    Initialize <span className="text-white/20 not-italic tracking-normal">Node</span>
                                </h3>
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 mt-3 ml-12">
                                    Configure hardware identity & admin access
                                </p>
                            </div>
                            <button onClick={handleCloseModal} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-white/40 hover:text-white transition-all transform hover:rotate-90 duration-500">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-grow p-10 overflow-y-auto custom-scrollbar bg-black/40">
                            {renderForm()}
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={!!deletingBranch}
                onClose={() => setDeletingBranch(null)}
                onConfirm={handleDelete}
                title="Decommission Node"
                message={`Permanently terminate connection to "${deletingBranch?.name}"?`}
                confirmText="Terminate Node"
                loading={isDeleting}
            />
        </div>
    );
};