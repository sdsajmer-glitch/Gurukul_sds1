
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
import { NodeRegistry } from './network/NodeRegistry';
import { NodeCard } from './network/NodeCard';
import { ExpandNetworkCard } from './network/ExpandNetworkCard';
import { motion, AnimatePresence } from 'framer-motion';

interface BranchCreationPageProps {
    onNext?: () => void;
    profile?: UserProfile;
    onBack?: () => void;
    hideHero?: boolean;
    initialBranch?: SchoolBranch | null;
}

const FloatingLabelInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string, icon?: React.ReactNode, action?: React.ReactNode, error?: string, hint?: string }> = ({ label, icon, action, error, hint, className, ...props }) => {
    const [isFocused, setIsFocused] = useState(false);
    const hasValue = props.value !== undefined && props.value !== '';

    return (
        <div className={`relative group/input w-full transition-all duration-500 ease-out ${className || ''}`}>
            <div className={`relative rounded-2xl border transition-all duration-500 bg-[#0c0c0d] overflow-hidden
                ${error
                    ? 'border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.05)] bg-red-500/[0.01]'
                    : isFocused
                        ? 'border-primary shadow-[0_0_20px_rgba(var(--primary),0.1)] bg-white/[0.02]'
                        : 'border-white/5 hover:border-white/10 shadow-none'}
            `}>
                <div className={`absolute top-1/2 -translate-y-1/2 left-5 transition-all duration-300 z-10 pointer-events-none
                    ${error ? 'text-red-400' : isFocused ? 'text-primary' : 'text-white/20'}`}>
                    {icon}
                </div>

                <input
                    {...props}
                    onFocus={(e) => {
                        setIsFocused(true);
                        props.onFocus?.(e);
                    }}
                    onBlur={(e) => {
                        setIsFocused(false);
                        props.onBlur?.(e);
                    }}
                    placeholder=" "
                    className={`peer block w-full bg-transparent px-5 py-5 pl-12 ${action ? 'pr-16' : ''} text-[15px] text-white font-medium transition-all duration-300 focus:outline-none placeholder-transparent`}
                />

                <label className={`absolute left-11 transition-all duration-300 pointer-events-none z-20 font-bold
                    ${(isFocused || hasValue)
                        ? 'top-2.5 text-[10px] uppercase tracking-[0.2em]'
                        : 'top-1/2 -translate-y-1/2 text-[15px] font-medium tracking-normal'}
                    ${error ? 'text-red-400' : isFocused ? 'text-primary' : 'text-white/20'}`}>
                    {label} {props.required && <span className="text-red-500/50 inline-block align-top mt-0.5 ml-0.5">*</span>}
                </label>

                {action && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex items-center">
                        {action}
                    </div>
                )}
            </div>

            {/* Enhanced Error & Hint Messaging */}
            <div className="min-h-[24px] mt-1.5 px-1 overflow-hidden">
                <AnimatePresence mode="wait">
                    {error ? (
                        <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex items-center gap-1.5 text-[11px] font-medium text-red-400/90"
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                            {error}
                        </motion.p>
                    ) : hint ? (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-[10px] font-medium text-white/20 uppercase tracking-[0.1em] leading-relaxed"
                        >
                            {hint}
                        </motion.p>
                    ) : null}
                </AnimatePresence>
            </div>
        </div>
    );
};

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
    const hasValue = !!value;

    return (
        <div className={`relative group/select w-full ${className || ''}`} ref={containerRef}>
            <div className={`relative rounded-2xl border transition-all duration-500 bg-[#0c0c0d] overflow-visible
                ${error
                    ? 'border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.05)] bg-red-500/[0.01]'
                    : isOpen
                        ? 'border-primary shadow-[0_0_20px_rgba(var(--primary),0.15)] bg-white/[0.02]'
                        : 'border-white/5 hover:border-white/10 shadow-none'}
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
            `}>
                <div className={`absolute top-1/2 -translate-y-1/2 left-5 transition-all duration-300 z-10 pointer-events-none
                    ${error ? 'text-red-400' : isOpen ? 'text-primary' : 'text-white/20'}`}>
                    {icon}
                </div>

                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    className={`peer block w-full text-left bg-transparent px-5 py-6 pl-12 pr-10 text-[15px] font-medium transition-all duration-300 focus:outline-none rounded-2xl
                        ${selectedOption ? 'text-white' : 'text-white/20'}`}
                >
                    {selectedOption ? selectedOption.label : "Select Option..."}
                </button>

                <label className={`absolute left-11 transition-all duration-300 pointer-events-none z-20 font-bold
                    ${(isOpen || hasValue)
                        ? 'top-2.5 text-[10px] uppercase tracking-[0.2em]'
                        : 'top-1/2 -translate-y-1/2 text-[15px] font-medium tracking-normal'}
                    ${error ? 'text-red-400' : isOpen ? 'text-primary' : 'text-white/20'}`}>
                    {label} {required && <span className="text-red-500/50 inline-block align-top mt-0.5 ml-0.5">*</span>}
                </label>

                <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-500
                    ${error ? 'text-red-400' : (isOpen ? 'text-primary rotate-180' : 'text-white/20 group-hover/select:text-white/40')}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="absolute z-[100] mt-3 w-full bg-[#0c0c0d] rounded-2xl border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-3xl ring-1 ring-white/10 origin-top left-0"
                        >
                            {searchable && (
                                <div className="p-3 border-b border-white/5 bg-white/[0.01]">
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Filter records..."
                                        className="w-full pl-4 pr-4 py-3 text-[11px] rounded-xl bg-black/60 border border-white/5 focus:border-primary/50 outline-none text-white placeholder:text-white/10 font-black uppercase tracking-widest"
                                    />
                                </div>
                            )}

                            <div className="max-h-64 overflow-y-auto p-2 custom-scrollbar">
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

            <div className="min-h-[24px] mt-1.5 px-1 overflow-hidden">
                <AnimatePresence mode="wait">
                    {error ? (
                        <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex items-center gap-1.5 text-[11px] font-medium text-red-400/90"
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                            {error}
                        </motion.p>
                    ) : hint ? (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-[10px] font-medium text-white/20 uppercase tracking-[0.1em] leading-relaxed"
                        >
                            {hint}
                        </motion.p>
                    ) : null}
                </AnimatePresence>
            </div>
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
        if (!formData.name.trim()) errors.name = "School/Campus name required";
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
        const defaultName = currentSchoolData?.school_name || '';

        setFormData({
            name: defaultName,
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
        setModalError(null);
        let addressToResolve = formData.address;

        if (!addressToResolve?.trim()) {
            setIsResolvingAddress(true);
            try {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        timeout: 10000,
                        enableHighAccuracy: true
                    });
                });
                const { latitude, longitude } = position.coords;
                addressToResolve = `${latitude}, ${longitude}`;
            } catch (err) {
                setModalError("Unable to access GPS location. Please enter address manually.");
                setIsResolvingAddress(false);
                return;
            }
        }

        setIsResolvingAddress(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
            const prompt = `Based on the location input "${addressToResolve}" (which could be an address or coordinates), identify the precise street address, city, state, and country. 
            Output strictly as a valid JSON object: {"address": "full street address", "city": "city name", "state": "state name", "country": "country name"}.
            
            Contextual Requirements:
            1. Country MUST be one of: ${countries.join(', ')}.
            2. State MUST be a valid administrative subdivision for that country.
            3. If coordinates were provided, reverse-geocode them to a human-readable street address.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                tools: [{ googleMaps: {} }]
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
                    address: data.address || prev.address,
                    city: data.city || prev.city,
                    state: data.state || prev.state,
                    country: data.country || prev.country
                }));
                setModalError(null);
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
        <form onSubmit={handleSave} className="flex flex-col h-full bg-[#0a0a0b]">
            {/* Scrollable Form Body */}
            <div className="flex-grow relative overflow-hidden group/scroll">
                {/* Top Fade */}
                <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-[#0a0a0b] to-transparent z-20 pointer-events-none transition-opacity duration-300 group-hover/scroll:opacity-100 opacity-60" />

                <div className="h-full overflow-y-auto custom-scrollbar p-10 space-y-16">
                    {modalError && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-red-500/[0.03] border border-red-500/10 rounded-[2rem] p-6 flex items-center gap-5"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0">
                                <XIcon className="w-5 h-5 text-red-500" />
                            </div>
                            <div className="space-y-1">
                                <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">Initialization Blocked</h5>
                                <p className="text-[11px] font-medium text-red-500/60 leading-relaxed uppercase tracking-widest">{modalError}</p>
                            </div>
                        </motion.div>
                    )}

                    <div className="space-y-20">
                        {/* Node Architecture Group */}
                        <div className="group/section">
                            <div className="flex items-center gap-5 mb-10">
                                <div className="w-12 h-12 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center transition-all duration-500 group-hover/section:bg-primary/10 group-hover/section:scale-110 shadow-[0_0_20px_rgba(var(--primary),0.05)]">
                                    <SchoolIcon className="w-5 h-5 text-primary" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-[13px] font-black uppercase text-white tracking-[0.3em]">Node Architecture</h4>
                                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Primary School Identity Setup</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-10">
                                <FloatingLabelInput
                                    label="School/Campus Name"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    error={formErrors.name}
                                    hint="Official Institutional identification name"
                                    icon={<SchoolIcon className="w-4 h-4" />}
                                />
                                <FloatingLabelInput
                                    label="Geo-location Address"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    required
                                    error={formErrors.address}
                                    hint="Full physical address for spatial verification"
                                    icon={<LocationIcon className="w-4 h-4" />}
                                    action={
                                        <button
                                            type="button"
                                            onClick={handleResolveAddress}
                                            disabled={isResolvingAddress || !formData.address.trim()}
                                            className="px-5 py-2.5 bg-primary/5 hover:bg-primary/10 text-primary rounded-xl transition-all disabled:opacity-30 border border-primary/10 flex items-center gap-2.5 group/btn"
                                        >
                                            {isResolvingAddress ? <Spinner size="sm" /> : (
                                                <>
                                                    <SparklesIcon className="w-3.5 h-3.5 transition-all group-hover/btn:scale-125 group-hover/btn:rotate-12" />
                                                    <span className="text-[9px] font-black uppercase tracking-[0.15em]">Auto-Detect</span>
                                                </>
                                            )}
                                        </button>
                                    }
                                />
                            </div>
                        </div>

                        {/* Geo-Location Group */}
                        <div className="group/section">
                            <div className="flex items-center gap-5 mb-10">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center transition-all duration-500 group-hover/section:bg-emerald-500/10 group-hover/section:scale-110">
                                    <GlobeIcon className="w-5 h-5 text-emerald-500" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-[13px] font-black uppercase text-white tracking-[0.3em]">Jurisdiction & Boundaries</h4>
                                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Regional Administrative Mapping</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10">
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
                                    <FloatingLabelInput
                                        className="md:col-span-2"
                                        label="Sync City"
                                        required
                                        value={formData.city}
                                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                                        disabled={!formData.state}
                                        error={formErrors.city}
                                        icon={<LocationIcon className="w-4 h-4" />}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Access Authority Group */}
                        <div className="group/section">
                            <div className="flex items-center gap-5 mb-10">
                                <div className="w-12 h-12 rounded-2xl bg-purple-500/5 border border-purple-500/10 flex items-center justify-center transition-all duration-500 group-hover/section:bg-purple-500/10 group-hover/section:scale-110">
                                    <UsersIcon className="w-5 h-5 text-purple-500" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-[13px] font-black uppercase text-white tracking-[0.3em]">Administrative Authority</h4>
                                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Access Control & Identity Oversight</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10">
                                <FloatingLabelInput
                                    label="Administrator Identity"
                                    value={formData.adminName}
                                    onChange={e => setFormData({ ...formData, adminName: e.target.value })}
                                    required
                                    error={formErrors.adminName}
                                    hint="Primary node custodian legal name"
                                    icon={<UsersIcon className="w-4 h-4" />}
                                />
                                <FloatingLabelInput
                                    label="Secure Contact"
                                    type="tel"
                                    value={formData.adminPhone}
                                    onChange={e => setFormData({ ...formData, adminPhone: e.target.value })}
                                    hint="Verified communication for security alerts"
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
                                        hint="Primary administrative alert relay"
                                        icon={<MailIcon className="w-4 h-4" />}
                                    />
                                </div>
                            </div>
                        </div>

                        {isHeadOfficeAdmin && (
                            <div
                                className={`flex items-start gap-6 p-8 rounded-[2.5rem] border transition-all duration-700 cursor-pointer 
                                    ${formData.isMain
                                        ? 'bg-primary/[0.03] border-primary/20 shadow-[0_20px_50px_rgba(var(--primary),0.05)] scale-[1.01]'
                                        : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.02] hover:border-white/10'}`}
                                onClick={() => setFormData({ ...formData, isMain: !formData.isMain })}
                            >
                                <div className={`mt-1 w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all duration-500 
                                    ${formData.isMain
                                        ? 'bg-primary border-primary shadow-[0_0_20px_rgba(var(--primary),0.4)]'
                                        : 'bg-black/40 border-white/10'}`}>
                                    {formData.isMain && <CheckCircleIcon className="w-4 h-4 text-white animate-in zoom-in" />}
                                </div>
                                <div className="flex-grow space-y-1.5">
                                    <p className="font-black text-[12px] uppercase tracking-[0.25em] text-white">Central Authority Node</p>
                                    <p className="text-[11px] text-white/30 font-medium uppercase tracking-[0.1em] leading-relaxed">Designate this node as the Master Institutional Command center</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Fade */}
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#0a0a0b] to-transparent z-20 pointer-events-none transition-opacity duration-300 group-hover/scroll:opacity-100 opacity-60" />
            </div>

            {/* Fixed Sticky Footer */}
            <div className="p-8 border-t border-white/5 bg-[#0d0d0e] flex flex-col sm:flex-row items-center justify-between gap-6 shrink-0 relative z-30">
                <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-10 py-4 text-[11px] font-black text-white/20 uppercase tracking-[0.3em] hover:text-red-400 transition-all duration-300 order-2 sm:order-1 hover:bg-red-500/5 rounded-2xl"
                >
                    Discard Configuration
                </button>
                <button
                    type="submit"
                    disabled={isSaving || !isFormValid}
                    className={`h-16 px-14 rounded-2xl font-black text-[12px] uppercase tracking-[0.3em] transition-all duration-500 flex items-center justify-center gap-4 group/submit order-1 sm:order-2 w-full sm:w-auto overflow-hidden relative
                        ${!isFormValid
                            ? 'bg-white/[0.02] text-white/10 cursor-not-allowed border border-white/5'
                            : 'bg-primary text-white shadow-[0_20px_40px_rgba(var(--primary),0.2)] hover:scale-[1.02] hover:shadow-[0_20px_50px_rgba(var(--primary),0.3)] active:scale-[0.98]'}`}
                >
                    <AnimatePresence mode="wait">
                        {isSaving ? (
                            <motion.div
                                key="saving"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center gap-4"
                            >
                                <Spinner size="sm" />
                                <span>Deploying Node...</span>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="default"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center gap-4"
                            >
                                <CheckCircleIcon className="w-5 h-5 transition-transform group-hover/submit:scale-125" />
                                <span>{editingBranch ? 'Re-Sync Node' : 'Initialize Node'}</span>
                                {!isFormValid && (
                                    <div className="absolute inset-0 bg-red-500/5 flex items-center justify-center opacity-0 group-hover/submit:opacity-100 transition-opacity">
                                        <span className="text-red-400 text-[9px] font-black">Fix Validation Errors</span>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </button>
            </div>
        </form>
    );

    if (hideHero) return <div className="bg-[#0a0a0b]">{renderForm()}</div>;

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 animate-in fade-in duration-500 pb-20">
            {/* ENHANCED HERO SECTION - ENTERPRISE COMMAND CENTER */}
            {!hideHero && (
                <div className="space-y-8 mb-14">
                    {/* Page Header with Clear Hierarchy */}
                    <div className="relative">
                        <div className="flex flex-col gap-3">
                            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tighter leading-none">
                                Institutional Network
                            </h1>
                            <p className="text-sm md:text-base text-white/30 font-medium max-w-3xl leading-relaxed">
                                Centralized oversight and management of distributed institutional nodes. Monitor network health, manage branch governance, and expand your infrastructure with enterprise-grade security.
                            </p>
                        </div>
                    </div>

                    {/* Network Overview - Command Center Metrics */}
                    <div className="relative bg-gradient-to-br from-[#0a0a0b] to-[#0f0f12] border border-white/10 rounded-3xl p-8 md:p-10 overflow-hidden shadow-2xl">
                        {/* Subtle Background Pattern */}
                        <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
                        </div>

                        <div className="relative z-10 space-y-8">
                            {/* Header Row */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                                <div>
                                    <h2 className="text-lg font-black text-white uppercase tracking-wider mb-1.5">Network Overview</h2>
                                    <p className="text-xs text-white/20 font-medium uppercase tracking-widest">Real-time system status</p>
                                </div>

                                {/* Primary Action - Strategic Placement */}
                                <button
                                    onClick={() => handleOpenCreate()}
                                    className="group relative bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 transition-all duration-300 transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 min-h-[56px] focus:outline-none focus:ring-4 focus:ring-primary/50"
                                    aria-label="Expand institutional network by adding a new node"
                                >
                                    <PlusIcon className="w-5 h-5 transition-transform group-hover:rotate-90 duration-300" />
                                    <span>Expand Network</span>
                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-primary/50 to-primary rounded-2xl opacity-0 group-hover:opacity-20 blur transition-opacity duration-300" />
                                </button>
                            </div>

                            {/* Metrics Pills - Scannable & Compact */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {/* Active Nodes Metric */}
                                <div className="group relative bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 rounded-2xl p-6 transition-all duration-300">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                                            <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                                        </div>
                                        <div className="text-right">
                                            <div className="text-3xl md:text-4xl font-black text-white tabular-nums">{branches.filter(b => !b.is_main_branch).length + (branches.some(b => b.is_main_branch) ? 1 : 0)}</div>
                                            <div className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-1">Active Nodes</div>
                                        </div>
                                    </div>
                                    <div className="h-1 bg-emerald-500/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
                                    </div>
                                </div>

                                {/* Head Office Metric */}
                                <div className="group relative bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 rounded-2xl p-6 transition-all duration-300">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="p-2.5 bg-primary/10 rounded-xl">
                                            <SchoolIcon className="w-5 h-5 text-primary" />
                                        </div>
                                        <div className="text-right">
                                            <div className="text-3xl md:text-4xl font-black text-white tabular-nums">{branches.filter(b => b.is_main_branch).length}</div>
                                            <div className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-1">Head Office</div>
                                        </div>
                                    </div>
                                    <div className="h-1 bg-primary/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary rounded-full" style={{ width: branches.some(b => b.is_main_branch) ? '100%' : '0%' }} />
                                    </div>
                                </div>

                                {/* Branches Metric */}
                                <div className="group relative bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 rounded-2xl p-6 transition-all duration-300">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="p-2.5 bg-blue-500/10 rounded-xl">
                                            <GlobeIcon className="w-5 h-5 text-blue-500" />
                                        </div>
                                        <div className="text-right">
                                            <div className="text-3xl md:text-4xl font-black text-white tabular-nums">{branches.filter(b => !b.is_main_branch).length}</div>
                                            <div className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-1">Branches</div>
                                        </div>
                                    </div>
                                    <div className="h-1 bg-blue-500/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${branches.length > 0 ? (branches.filter(b => !b.is_main_branch).length / branches.length) * 100 : 0}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section Header for Node Registry */}
                    <div className="flex items-center justify-between px-2">
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-wider">Node Registry</h2>
                            <p className="text-xs text-white/20 font-medium mt-1">Infrastructure topology and branch governance</p>
                        </div>
                        {onNext && branches.length > 0 && (
                            <button
                                onClick={handleFinish}
                                className="flex items-center gap-3 text-emerald-500 hover:text-emerald-400 font-black text-[10px] uppercase tracking-widest transition-all hover:gap-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 rounded-lg px-3 py-2 min-h-[44px]"
                            >
                                <span>Complete Setup</span>
                                <CheckoutIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Back Navigation - Subtle & Out of Primary Flow */}
            {!hideHero && onBack && (
                <div className="mb-8 px-2">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-white/20 hover:text-white/60 transition-all text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-white/20 rounded-lg px-3 py-2 min-h-[44px]"
                    >
                        <ChevronLeftIcon className="w-3.5 h-3.5" />
                        <span>Back</span>
                    </button>
                </div>
            )}


            {loading ? (
                <div className="flex flex-col items-center justify-center p-32 gap-6">
                    <Spinner size="lg" className="text-primary" />
                    <p className="text-xs text-white/20 font-medium uppercase tracking-widest">Loading network topology...</p>
                </div>
            ) : branches.length === 0 ? (
                <div
                    onClick={() => handleOpenCreate()}
                    className="group relative border-2 border-dashed border-white/10 hover:border-primary/30 rounded-3xl p-16 md:p-24 flex flex-col items-center justify-center text-center gap-8 cursor-pointer transition-all duration-300 hover:bg-white/[0.01] focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                    tabIndex={0}
                    role="button"
                    aria-label="Initialize your first institutional node"
                    onKeyDown={(e) => e.key === 'Enter' && handleOpenCreate()}
                >
                    {/* Animated Icon */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 group-hover:border-primary/30 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                            <PlusIcon className="w-14 h-14 text-white/20 group-hover:text-primary transition-colors duration-300" />
                        </div>
                    </div>

                    {/* Instructional Microcopy */}
                    <div className="space-y-4 max-w-md">
                        <h3 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">Initialize Network</h3>
                        <p className="text-sm md:text-base text-white/30 font-medium leading-relaxed">
                            Begin by establishing your head office node. This serves as the central authority for your institutional network.
                        </p>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-xs font-black uppercase tracking-wider">
                            <SparklesIcon className="w-4 h-4" />
                            <span>Ready to Deploy</span>
                        </div>
                    </div>
                </div>
            ) : (
                <NodeRegistry>
                    {/* Node Cards - Enterprise Infrastructure Design */}
                    {branches.map(branch => (
                        <NodeCard
                            key={branch.id}
                            name={branch.name}
                            location={`${branch.city}, ${branch.state}`}
                            adminName={branch.admin_name}
                            isMain={branch.is_main_branch}
                            onEdit={() => handleOpenEdit(branch)}
                            onDelete={() => setDeletingBranch(branch)}
                        />
                    ))}

                    {/* Add New Node Card - Expansion Affordance */}
                    <ExpandNetworkCard onClick={() => handleOpenCreate()} />
                </NodeRegistry>
            )
            }

            {
                isModalOpen && (
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
                            <div className="flex-grow overflow-hidden relative bg-black/40">
                                {renderForm()}
                            </div>
                        </div>
                    </div>
                )
            }

            <ConfirmationModal
                isOpen={!!deletingBranch}
                onClose={() => setDeletingBranch(null)}
                onConfirm={handleDelete}
                title="Decommission Node"
                message={`Permanently terminate connection to "${deletingBranch?.name}"?`}
                confirmText="Terminate Node"
                loading={isDeleting}
            />
        </div >
    );
};