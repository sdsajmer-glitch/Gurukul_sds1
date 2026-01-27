import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase, formatError } from '../services/supabase';
import { SchoolBranch, UserProfile, SchoolAdminProfileData, BuiltInRoles } from '../types';
import Spinner from './common/Spinner';
import { SchoolIcon } from './icons/SchoolIcon';
import { PlusIcon } from './icons/PlusIcon';
import { EditIcon } from './icons/EditIcon';
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
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI } from '@google/genai';
import { HashIcon } from './icons/HashIcon';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon';

interface BranchCreationPageProps {
    onNext?: () => void;
    profile?: UserProfile;
    onBack?: () => void;
}

const DiagnosticErrorConsole: React.FC<{ message: string; onClear: () => void }> = ({ message, onClear }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        className="relative overflow-hidden rounded-[2.5rem] border border-red-500/20 bg-red-500/5 backdrop-blur-3xl p-8 shadow-[0_32px_128px_-16px_rgba(239,68,68,0.25)] group mb-10"
    >
        <div className="absolute top-0 right-0 p-6">
            <button onClick={onClear} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-all duration-300">
                <XIcon className="w-5 h-5" />
            </button>
        </div>
        <div className="flex gap-8 items-start">
            <div className="w-16 h-16 rounded-[1.5rem] bg-red-500/10 flex items-center justify-center text-red-500 shadow-inner border border-red-500/20 shrink-0">
                <AlertTriangleIcon className="w-8 h-8 animate-pulse text-red-500" />
            </div>
            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <p className="text-[11px] font-black uppercase text-red-500 tracking-[0.6em]">Protocol Exception Detected</p>
                    <div className="h-px w-16 bg-red-500/20" />
                </div>
                <p className="text-[15px] font-medium text-red-200/80 leading-relaxed font-mono tracking-tight">
                    {message}
                </p>
            </div>
        </div>
        <div className="absolute -bottom-8 -right-8 w-36 h-36 bg-red-500/10 rounded-full blur-[80px] group-hover:bg-red-500/20 transition-all duration-1000" />
    </motion.div>
);

const FloatingLabelInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string, icon?: React.ReactNode, action?: React.ReactNode }> = ({ label, icon, action, className, ...props }) => (
    <div className="relative group w-full">
        {label && (
            <label className="absolute left-10 top-0 -translate-y-1/2 bg-[#0a0b10] px-2 text-[10px] font-black uppercase tracking-[0.3em] text-white/30 group-focus-within:text-primary transition-all duration-300 z-20">
                {label}
            </label>
        )}
        <div className="absolute top-1/2 -translate-y-1/2 left-6 text-white/10 group-focus-within:text-primary transition-all duration-500 z-10 pointer-events-none">
            {icon}
        </div>
        <input
            {...props}
            placeholder=" "
            className={`peer block w-full h-[64px] rounded-[1.5rem] border border-white/5 bg-white/[0.01] px-6 pl-14 ${action ? 'pr-16' : ''} text-sm text-white font-medium shadow-inner transition-all duration-500 hover:border-white/10 focus:border-primary/50 focus:ring-8 focus:ring-primary/5 focus:outline-none placeholder-transparent ${className}`}
        />
        {action && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20">
                {action}
            </div>
        )}
    </div>
);

const StyledSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string, icon?: React.ReactNode }> = ({ label, icon, children, className, ...props }) => (
    <div className="relative group w-full">
        {label && (
            <label className="absolute left-10 top-0 -translate-y-1/2 bg-[#0a0b10] px-2 text-[10px] font-black uppercase tracking-[0.3em] text-white/30 group-focus-within:text-primary transition-all duration-300 z-20">
                {label}
            </label>
        )}
        <div className="absolute top-1/2 -translate-y-1/2 left-6 text-white/10 group-focus-within:text-primary transition-all duration-500 z-10 pointer-events-none">
            {icon}
        </div>
        <select
            {...props}
            className={`peer block w-full h-[64px] appearance-none rounded-[1.5rem] border border-white/5 bg-white/[0.01] px-6 pl-14 text-sm text-white font-medium shadow-inner transition-all duration-500 hover:border-white/10 focus:border-primary/50 focus:ring-8 focus:ring-primary/5 focus:outline-none cursor-pointer ${className}`}
        >
            {children}
        </select>
        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-white/10 group-focus-within:text-primary transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </div>
    </div>
);

export const BranchCreationPage: React.FC<BranchCreationPageProps> = ({ onNext, profile, onBack }) => {
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
        if (!formData.address.trim()) return;
        setIsResolvingAddress(true);
        setModalError(null);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Based on the street address "${formData.address}", identify the city, state, and country.
            Output ONLY strictly as a valid JSON object: {"city": "string", "state": "string", "country": "string"}.
            Important: The "country" must match one of these: ${countries.join(', ')}. The "state" must match a valid state in that country.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    tools: [{ googleMaps: {} }]
                }
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
            setModalError("Unable to auto-fill address details. Please enter manually.");
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
            if (isMounted.current) setIsModalOpen(false);
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

    const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, country: e.target.value, state: '', city: '' });
    const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, state: e.target.value, city: '' });
    const availableStates = useMemo(() => formData.country ? statesByCountry[formData.country] || [] : [], [formData.country]);
    const availableCities = useMemo(() => formData.state ? citiesByState[formData.state] || [] : [], [formData.state]);

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center max-w-2xl mx-auto mb-10">
                <h1 className="text-4xl font-serif font-extrabold text-foreground tracking-tight">Set Up Your Branches</h1>
                <p className="text-muted-foreground mt-3 text-lg leading-relaxed">
                    Start by defining your Head Office, then add any additional satellite campuses to your network.
                </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-12 bg-white/[0.02] p-6 rounded-[2rem] border border-white/5 backdrop-blur-3xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-primary/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                <div className="relative z-10">
                    {onBack && (
                        <button
                            onClick={onBack}
                            disabled={isFinishing}
                            className="flex items-center gap-3 px-6 py-3 rounded-2xl text-white/40 hover:text-white hover:bg-white/5 transition-all text-xs font-black uppercase tracking-[0.3em] disabled:opacity-20"
                        >
                            <ChevronLeftIcon className="w-4 h-4" />
                            Return <span className="italic opacity-40">Home</span>
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-4 relative z-10">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleOpenCreate()}
                        disabled={loading}
                        className="px-8 py-4 bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-black uppercase tracking-[0.3em] rounded-2xl transition-all flex items-center gap-3 border border-primary/20 shadow-2xl"
                    >
                        <PlusIcon className="w-4 h-4" /> New Branch Node
                    </motion.button>
                    {onNext && branches.length > 0 && (
                        <motion.button
                            whileHover={{ scale: 1.02, boxShadow: "0 20px 40px -10px rgba(var(--primary), 0.5)" }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleFinish}
                            disabled={isFinishing}
                            className="bg-primary text-primary-foreground px-10 py-4 rounded-2xl font-black text-[12px] uppercase tracking-[0.3em] flex items-center gap-4 transition-all shadow-2xl min-w-[240px] justify-center"
                        >
                            {isFinishing ? <><Spinner size="sm" className="text-current" /> Finalizing Node...</> : <>Synchronize Registry &rarr;</>}
                        </motion.button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center p-40 space-y-8">
                    <div className="relative">
                        <div className="absolute -inset-8 bg-primary/20 rounded-full blur-2xl animate-pulse" />
                        <Spinner size="xl" className="text-primary relative z-10" />
                    </div>
                    <p className="text-[11px] font-black uppercase text-white/20 tracking-[0.8em] animate-pulse">Scanning Institutional Ledger</p>
                </div>
            ) : error ? (
                <DiagnosticErrorConsole message={error} onClear={() => setError(null)} />
            ) : branches.length === 0 ? (
                <div
                    className="flex flex-col items-center justify-center py-32 bg-[#0a0b10]/40 border-2 border-dashed border-white/5 rounded-[4rem] text-center hover:bg-white/[0.02] hover:border-primary/40 transition-all duration-1000 cursor-pointer group relative overflow-hidden"
                    onClick={() => handleOpenCreate()}
                >
                    <div className="absolute inset-0 bg-primary/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                    <div className="relative mb-12">
                        <div className="absolute inset-0 bg-primary/30 rounded-[3rem] blur-[50px] opacity-0 group-hover:opacity-100 transition-all duration-1000 group-hover:scale-150" />
                        <div className="relative w-28 h-28 bg-white/[0.02] rounded-[2.5rem] flex items-center justify-center border border-white/5 shadow-2xl transition-all duration-700 group-hover:bg-primary/20 group-hover:scale-110 group-hover:rotate-[15deg] group-hover:border-primary/40">
                            <SchoolIcon className="w-12 h-12 text-white/10 group-hover:text-primary transition-all duration-700" />
                        </div>
                    </div>
                    <h3 className="text-3xl md:text-5xl font-serif font-black text-white/40 tracking-tighter uppercase leading-none group-hover:text-white transition-all duration-700">
                        Protocol <span className="text-white/10 italic group-hover:text-primary">Initialization.</span>
                    </h3>
                    <p className="text-white/20 mt-6 text-lg font-serif italic max-w-lg mx-auto leading-relaxed group-hover:text-white/40 transition-all duration-700">
                        No geographic nodes detected. Let's begin by establishing your <strong className="text-white/40 group-hover:text-white">Institutional Head Office</strong>.
                    </p>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="mt-12 px-12 py-5 bg-primary text-primary-foreground font-black text-[13px] uppercase tracking-[0.4em] rounded-[1.5rem] shadow-[0_32px_64px_-16px_rgba(var(--primary),0.5)] transition-all"
                    >
                        Create Head Office
                    </motion.button>
                </div>
            ) : (
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{
                        hidden: { opacity: 0 },
                        visible: {
                            opacity: 1,
                            transition: { staggerChildren: 0.1 }
                        }
                    }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10"
                >
                    {branches.map((branch, idx) => (
                        <motion.div
                            key={branch.id}
                            variants={{
                                hidden: { opacity: 0, y: 30, scale: 0.95 },
                                visible: { opacity: 1, y: 0, scale: 1 }
                            }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            className="group relative bg-[#0d0e12]/60 backdrop-blur-3xl border border-white/5 hover:border-primary/40 rounded-[3rem] p-10 shadow-2xl hover:shadow-primary/10 transition-all duration-1000 flex flex-col h-full min-h-[360px]"
                        >
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-40" />
                            <div className="flex justify-between items-start mb-8">
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-700 ${branch.is_main_branch ? 'bg-primary/10 text-primary shadow-[0_0_30px_rgba(var(--primary),0.2)]' : 'bg-white/5 text-white/20'}`}>
                                    <SchoolIcon className="w-8 h-8" />
                                </div>
                                <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
                                    <button onClick={() => handleOpenEdit(branch)} className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center text-white/40 hover:text-white transition-all"><EditIcon className="w-4 h-4" /></button>
                                    {!branch.is_main_branch && (
                                        <button onClick={() => setDeletingBranch(branch)} className="w-10 h-10 bg-red-500/5 hover:bg-red-500/10 rounded-xl flex items-center justify-center text-red-500/40 hover:text-red-500 transition-all"><XIcon className="w-4 h-4" /></button>
                                    )}
                                </div>
                            </div>

                            <h3 className="text-2xl font-serif font-black text-white/80 group-hover:text-white truncate mb-2 leading-none uppercase tracking-tighter transition-all">{branch.name}</h3>
                            <div className="flex items-center gap-3 text-[10px] font-black uppercase text-white/20 tracking-[0.2em] mb-8">
                                <LocationIcon className="w-3.5 h-3.5" />
                                <span className="truncate">{[branch.city, branch.state, branch.country].filter(Boolean).join(' • ')}</span>
                            </div>

                            <div className="flex flex-wrap gap-3 mb-10">
                                {branch.is_main_branch ? (
                                    <span className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-[0.2em] border border-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.2)]">
                                        <CheckCircleIcon className="w-3.5 h-3.5" /> HEAD OFFICE
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/5 text-white/20 text-[9px] font-black uppercase tracking-[0.2em] border border-white/5">
                                        SATELLITE NODE
                                    </span>
                                )}
                            </div>

                            <div className="mt-auto pt-8 border-t border-white/[0.03] flex items-center gap-5">
                                <div className="w-12 h-12 rounded-[1rem] bg-gradient-to-tr from-primary/40 to-primary/10 flex items-center justify-center text-white text-sm font-black shadow-2xl relative overflow-hidden group-hover:scale-110 transition-all">
                                    <div className="absolute inset-0 bg-primary/20 blur-md" />
                                    <span className="relative z-10">{branch.admin_name ? branch.admin_name.charAt(0) : '?'}</span>
                                </div>
                                <div className="overflow-hidden space-y-1">
                                    <p className="text-[11px] font-black text-white/80 uppercase tracking-widest truncate">{branch.admin_name || 'NO CUSTODIAN'}</p>
                                    <p className="text-[10px] font-medium text-white/20 italic truncate">{branch.admin_email || '—'}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}

                    {/* Add New Card: Ultra-Premium Focal Point */}
                    <motion.button
                        variants={{
                            hidden: { opacity: 0, scale: 0.9 },
                            visible: { opacity: 1, scale: 1 }
                        }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        onClick={() => handleOpenCreate()}
                        className="flex flex-col items-center justify-center p-14 rounded-[3rem] border border-dashed border-white/10 bg-white/[0.01] hover:border-primary/40 hover:bg-primary/[0.04] transition-all duration-1000 group relative overflow-hidden h-full min-h-[360px] shadow-2xl"
                    >
                        <div className="absolute inset-0 bg-primary/[0.02] opacity-0 group-hover:opacity-100 transition-all duration-1000" />
                        <div className="relative mb-10">
                            <div className="absolute inset-0 bg-primary/20 rounded-[2rem] blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-1000 group-hover:scale-150" />
                            <div className="relative w-20 h-20 rounded-[1.5rem] bg-white/[0.02] flex items-center justify-center border border-white/10 shadow-2xl transition-all duration-1000 group-hover:bg-primary/20 group-hover:scale-110 group-hover:rotate-[15deg] group-hover:border-primary/40">
                                <PlusIcon className="w-8 h-8 text-white/10 group-hover:text-primary transition-all duration-700" />
                            </div>
                        </div>
                        <span className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em] group-hover:text-white transition-all duration-700 relative z-10">Initialize New Node</span>

                        <div className="absolute top-10 left-10 w-4 h-4 border-t border-l border-white/10 rounded-tl-lg group-hover:border-primary/20 transition-all" />
                        <div className="absolute bottom-10 right-10 w-4 h-4 border-b border-r border-white/10 rounded-br-lg group-hover:border-primary/20 transition-all" />
                    </motion.button>
                </motion.div>
            )}

            {isModalOpen && (
                <AnimatePresence>
                    {isModalOpen && (
                        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center z-[200] p-4 overflow-hidden" onClick={() => setIsModalOpen(false)}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                className="bg-[#07080a] w-full max-w-4xl rounded-[4rem] shadow-[0_64px_128px_-24px_rgba(0,0,0,1)] border border-white/10 flex flex-col max-h-[92vh] relative overflow-hidden ring-1 ring-white/5"
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="absolute inset-0 bg-primary/[0.02] pointer-events-none" />

                                {/* Modal Header */}
                                <div className="px-12 py-10 border-b border-white/[0.03] bg-white/[0.01] flex justify-between items-center shrink-0">
                                    <div className="flex items-center gap-8">
                                        <div className="w-16 h-16 bg-primary/10 rounded-[1.5rem] flex items-center justify-center text-primary shadow-inner border border-primary/20">
                                            <PlusIcon className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h3 className="text-3xl font-serif font-black text-white tracking-tighter uppercase leading-none">
                                                {editingBranch ? 'MANAGE' : 'INITIALIZE'} <span className="text-white/20 italic">{editingBranch ? 'NODE.' : (branches.length === 0 ? 'HEAD OFFICE.' : 'SATELLITE.')}</span>
                                            </h3>
                                            <p className="text-[10px] font-black tracking-[0.6em] text-white/10 uppercase mt-2">Geographic Identity Registry</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 rounded-full bg-white/5 text-white/20 hover:text-white hover:bg-white/10 hover:rotate-90 transition-all flex items-center justify-center">
                                        <XIcon className="w-6 h-6" />
                                    </button>
                                </div>

                                <form onSubmit={handleSave} className="flex flex-col flex-grow overflow-hidden select-text">
                                    <div className="flex-grow overflow-y-auto p-12 space-y-16 custom-scrollbar">
                                        <AnimatePresence>
                                            {modalError && <DiagnosticErrorConsole message={modalError} onClear={() => setModalError(null)} />}
                                        </AnimatePresence>

                                        {/* Section 1: Campus Identity */}
                                        <div className="space-y-10">
                                            <div className="flex items-center gap-4 px-2">
                                                <div className="h-6 w-[2px] bg-primary/40 rounded-full" />
                                                <h4 className="text-[11px] font-black uppercase text-white/20 tracking-[0.4em]">Campus Infrastructure Node</h4>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                                <div className="md:col-span-12">
                                                    <FloatingLabelInput
                                                        label="Formal Campus Designation"
                                                        value={formData.name}
                                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                        required
                                                        icon={<SchoolIcon className="w-5 h-5" />}
                                                    />
                                                </div>
                                                <div className="md:col-span-12">
                                                    <FloatingLabelInput
                                                        label="Geospatial Street Address"
                                                        value={formData.address}
                                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                                        required
                                                        icon={<LocationIcon className="w-5 h-5" />}
                                                        action={
                                                            <button
                                                                type="button"
                                                                onClick={handleResolveAddress}
                                                                disabled={isResolvingAddress || !formData.address.trim()}
                                                                className="p-3 bg-primary/10 text-primary hover:bg-primary/20 rounded-2xl border border-primary/20 backdrop-blur-xl transition-all disabled:opacity-20"
                                                            >
                                                                {isResolvingAddress ? <Spinner size="sm" /> : <SparklesIcon className="w-5 h-5 animate-pulse" />}
                                                            </button>
                                                        }
                                                    />
                                                </div>

                                                <div className="md:col-span-6">
                                                    <StyledSelect label="National Domain" required value={formData.country} onChange={handleCountryChange} icon={<GlobeIcon className="w-5 h-5" />}>
                                                        {countries.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </StyledSelect>
                                                </div>

                                                <div className="md:col-span-6">
                                                    <StyledSelect label="Regional Protocol" required value={formData.state} onChange={handleStateChange} disabled={!formData.country} icon={<LocationIcon className="w-5 h-5" />}>
                                                        <option value="">Select State</option>
                                                        {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
                                                    </StyledSelect>
                                                </div>

                                                <div className="md:col-span-12">
                                                    {availableCities.length > 0 ? (
                                                        <StyledSelect label="Primary Municipality" required value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} disabled={!formData.state} icon={<LocationIcon className="w-5 h-5" />}>
                                                            <option value="">Select City</option>
                                                            {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                                                        </StyledSelect>
                                                    ) : (
                                                        <FloatingLabelInput label="Municipality Node" required value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} disabled={!formData.state} icon={<LocationIcon className="w-5 h-5" />} />
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Section 2: Custodian Credentials */}
                                        <div className="space-y-10">
                                            <div className="flex items-center gap-4 px-2">
                                                <div className="h-6 w-[2px] bg-primary/40 rounded-full" />
                                                <h4 className="text-[11px] font-black uppercase text-white/20 tracking-[0.4em]">Administrative Security Custodian</h4>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                                <div className="md:col-span-6"><FloatingLabelInput label="Custodian Legal Name" value={formData.adminName} onChange={e => setFormData({ ...formData, adminName: e.target.value })} icon={<UsersIcon className="w-5 h-5" />} /></div>
                                                <div className="md:col-span-6"><FloatingLabelInput label="Telecom Telemetry" type="tel" value={formData.adminPhone} onChange={e => setFormData({ ...formData, adminPhone: e.target.value })} icon={<PhoneIcon className="w-5 h-5" />} /></div>
                                                <div className="md:col-span-12"><FloatingLabelInput label="Institutional Email Node" type="email" required value={formData.adminEmail} onChange={e => setFormData({ ...formData, adminEmail: e.target.value })} icon={<MailIcon className="w-5 h-5" />} /></div>
                                            </div>
                                        </div>

                                        {isHeadOfficeAdmin && (
                                            <motion.div
                                                whileHover={{ scale: 1.01 }}
                                                className={`flex items-start gap-6 p-10 rounded-[2.5rem] border transition-all cursor-pointer relative overflow-hidden group/opt ${formData.isMain ? 'bg-primary/[0.04] border-primary/30 shadow-[0_32px_64px_-16px_rgba(var(--primary),0.2)]' : 'bg-white/[0.01] border-white/5 hover:border-primary/20'}`}
                                                onClick={() => setFormData({ ...formData, isMain: !formData.isMain })}
                                            >
                                                <div className="absolute inset-0 bg-primary/[0.02] opacity-0 group-hover/opt:opacity-100 transition-opacity" />
                                                <div className={`mt-1 w-7 h-7 rounded-[0.75rem] border flex items-center justify-center transition-all duration-500 shrink-0 ${formData.isMain ? 'bg-primary border-primary rotate-0 scale-110 shadow-[0_0_20px_rgba(var(--primary),0.5)]' : 'bg-white/5 border-white/10 rotate-12'}`}>
                                                    {formData.isMain && <CheckCircleIcon className="w-4 h-4 text-primary-foreground" />}
                                                </div>
                                                <div className="relative z-10">
                                                    <p className="text-[14px] font-black uppercase text-white tracking-[0.2em]">Authorize as Institutional Headquarters</p>
                                                    <p className="text-[12px] font-medium text-white/30 italic mt-2 leading-relaxed">This node will be designated as the central synchronization headquarters for the entire registry.</p>
                                                </div>
                                            </motion.div>
                                        )}
                                    </div>

                                    <div className="px-12 py-10 border-t border-white/[0.03] bg-white/[0.01] flex flex-col md:flex-row justify-between items-center gap-8 shrink-0">
                                        <button type="button" onClick={() => setIsModalOpen(false)} className="text-[11px] font-black uppercase tracking-[0.6em] text-white/10 hover:text-white/40 transition-all order-2 md:order-1">
                                            ABORT <span className="italic">PROTOCOL</span>
                                        </button>
                                        <motion.button
                                            whileHover={{ scale: 1.02, boxShadow: "0 20px 40px -10px rgba(var(--primary), 0.5)" }}
                                            whileTap={{ scale: 0.98 }}
                                            type="submit"
                                            disabled={isSaving}
                                            className="w-full md:w-auto px-16 py-6 bg-primary text-primary-foreground rounded-[1.75rem] font-black text-[13px] uppercase tracking-[0.4em] shadow-2xl hover:bg-primary/90 flex items-center gap-5 transition-all order-1 md:order-2"
                                        >
                                            {isSaving ? <Spinner size="sm" className="text-white" /> : (
                                                <>
                                                    {editingBranch ? 'SYNC UPDATES' : 'INITIALIZE NODE'}
                                                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                                                        <CheckCircleIcon className="w-4 h-4" />
                                                    </div>
                                                </>
                                            )}
                                        </motion.button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            )}

            <ConfirmationModal
                isOpen={!!deletingBranch}
                onClose={() => setDeletingBranch(null)}
                onConfirm={handleDelete}
                title="Delete Branch"
                message={`Are you sure you want to permanently delete the "${deletingBranch?.name}" branch? This action cannot be undone.`}
                confirmText="Yes, Delete Branch"
                loading={isDeleting}
            />
        </div>
    );
};