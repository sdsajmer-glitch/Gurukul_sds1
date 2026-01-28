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
        initial={{ opacity: 0, scale: 0.9, y: 30, filter: 'blur(10px)' }}
        animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: 0.9, y: -20, filter: 'blur(10px)' }}
        className="relative overflow-hidden rounded-[3rem] border border-red-500/30 bg-[#0a0000]/60 backdrop-blur-[40px] p-10 shadow-[0_64px_128px_-16px_rgba(239,68,68,0.3)] group mb-12 ring-1 ring-red-500/20"
    >
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.05] via-transparent to-transparent opacity-50" />
        <div className="absolute top-0 right-0 p-8">
            <button onClick={onClear} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-red-500/40 hover:text-red-500 hover:bg-red-500/10 hover:rotate-90 transition-all duration-500">
                <XIcon className="w-6 h-6" />
            </button>
        </div>
        <div className="flex gap-10 items-start relative z-10">
            <div className="w-20 h-20 rounded-[2rem] bg-red-500/10 flex items-center justify-center text-red-500 shadow-[inset_0_0_20px_rgba(239,68,68,0.2)] border border-red-500/20 shrink-0 group-hover:scale-110 transition-transform duration-700">
                <AlertTriangleIcon className="w-10 h-10 animate-pulse text-red-500" />
            </div>
            <div className="space-y-4">
                <div className="flex items-center gap-4">
                    <p className="text-[11px] font-black uppercase text-red-500 tracking-[0.8em]">CRITICAL PROTOCOL EXCEPTION</p>
                    <div className="h-[2px] w-24 bg-gradient-to-r from-red-500/40 to-transparent" />
                </div>
                <div className="space-y-2">
                    <p className="text-2xl font-serif italic text-white/90 leading-tight">
                        {message}
                    </p>
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        <p className="text-[10px] font-black uppercase text-red-500/40 tracking-[0.4em]">System Synchronization Integrity Failure</p>
                    </div>
                </div>
            </div>
        </div>
        {/* Animated telemetry artifact */}
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-[100px] animate-pulse pointer-events-none" />
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

    const handleFinish = async () => {
        if (isFinishing || !onNext) return;
        setIsFinishing(true);
        try {
            const { error: finishError } = await supabase.rpc('complete_branch_step');
            if (finishError) throw finishError;
            onNext();
        } catch (err: any) {
            alert(`Finalization Error: ${formatError(err)}`);
            setIsFinishing(false);
        }
    };

    const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, country: e.target.value, state: '', city: '' });
    const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, state: e.target.value, city: '' });
    const availableStates = useMemo(() => formData.country ? statesByCountry[formData.country] || [] : [], [formData.country]);
    const availableCities = useMemo(() => formData.state ? citiesByState[formData.state] || [] : [], [formData.state]);

    return (
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-10 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* Header matching the image's "CONFIGURE NODE" style */}
            <div className="flex items-center justify-between py-8 mb-12 border-b border-white/[0.05]">
                <div className="flex items-center gap-4">
                    <div className="h-2 w-2 rounded-full bg-primary/60 blur-[2px] animate-pulse" />
                    <p className="text-[11px] font-black uppercase tracking-[0.4em] text-white/30">Configure Node</p>
                </div>
                {onBack && (
                    <button onClick={onBack} className="text-white/20 hover:text-white transition-all">
                        <XIcon className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className="text-center max-w-3xl mx-auto mb-20">
                <motion.h1
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    className="text-6xl md:text-9xl font-serif font-black text-white tracking-tighter uppercase leading-[0.9]"
                >
                    Branch <span className="text-white/5 italic">Registry.</span>
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 1 }}
                    className="text-white/30 mt-8 text-xl font-serif italic leading-relaxed max-w-xl mx-auto"
                >
                    Start by defining your <strong className="text-white/60">Head Office Node</strong>, then synchronize additional satellite campuses to the global network.
                </motion.p>
            </div>

            <div className="relative mb-20 p-2 bg-white/[0.02] border border-white/5 rounded-[3.5rem] backdrop-blur-3xl overflow-hidden group shadow-[0_32px_128px_-24px_rgba(0,0,0,0.8)]">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-primary/[0.03]" />
                <div className="relative flex flex-col sm:flex-row justify-between items-center gap-6 p-10 z-10">
                    <div className="flex items-center gap-4">
                        <motion.button
                            whileHover={{ scale: 1.05, backgroundColor: 'rgba(var(--primary), 0.15)' }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleOpenCreate()}
                            disabled={loading}
                            className="bg-primary/5 border border-primary/20 text-primary-foreground/80 px-10 py-5 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.4em] flex items-center gap-4 transition-all"
                        >
                            <PlusIcon className="w-5 h-5 text-primary" /> New Institutional Node
                        </motion.button>
                    </div>

                    <div className="flex items-center gap-4">
                        {onNext && branches.length > 0 && (
                            <motion.button
                                whileHover={{ scale: 1.02, boxShadow: "0 0 40px rgba(var(--primary), 0.4)" }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleFinish}
                                disabled={isFinishing}
                                className="bg-primary text-primary-foreground px-12 py-5 rounded-[2rem] font-black text-[12px] uppercase tracking-[0.4em] flex items-center gap-4 transition-all shadow-[0_20px_60px_-10px_rgba(var(--primary),0.5)] min-w-[300px] justify-center"
                            >
                                {isFinishing ? <><Spinner size="sm" className="text-current" /> Finalizing...</> : <>Synchronize Registry <span className="text-xl">&rarr;</span></>}
                            </motion.button>
                        )}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center p-40 space-y-10">
                    <div className="relative">
                        <div className="absolute -inset-10 bg-primary/20 rounded-full blur-[60px] animate-pulse" />
                        <Spinner size="xl" className="text-primary relative z-10" />
                    </div>
                    <div className="space-y-3 text-center">
                        <p className="text-[11px] font-black uppercase text-white/10 tracking-[1em] animate-pulse">Scanning Registry</p>
                        <p className="text-[9px] font-black uppercase text-primary/40 tracking-[0.5em]">Synchronizing Geographic Nodes</p>
                    </div>
                </div>
            ) : error ? (
                <DiagnosticErrorConsole message={error} onClear={() => setError(null)} />
            ) : branches.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-40 bg-[#0a0b10]/40 border-2 border-dashed border-white/5 rounded-[5rem] text-center hover:bg-primary/[0.02] hover:border-primary/40 transition-all duration-1000 cursor-pointer group relative overflow-hidden shadow-inner"
                    onClick={() => handleOpenCreate()}
                >
                    <div className="absolute inset-0 bg-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                    <div className="relative mb-14">
                        <div className="absolute inset-0 bg-primary/30 rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-all duration-1000 group-hover:scale-150" />
                        <div className="relative w-32 h-32 bg-white/[0.02] rounded-[3rem] flex items-center justify-center border border-white/5 shadow-2xl transition-all duration-700 group-hover:bg-primary/20 group-hover:scale-110 group-hover:-rotate-12 group-hover:border-primary/40">
                            <SchoolIcon className="w-14 h-14 text-white/5 group-hover:text-primary transition-all duration-700" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-4xl md:text-6xl font-serif font-black text-white/20 tracking-tighter uppercase leading-none group-hover:text-white transition-all duration-700">
                            Protocol <span className="text-white/5 italic group-hover:text-primary">Initialization.</span>
                        </h3>
                        <p className="text-white/10 text-xl font-serif italic max-w-lg mx-auto leading-relaxed group-hover:text-white/30 transition-all duration-700">
                            No geographic nodes detected. Let's begin by establishing your <strong className="text-white/40 group-hover:text-white">Institutional Head Office</strong>.
                        </p>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="mt-14 px-14 py-6 bg-primary text-primary-foreground font-black text-[13px] uppercase tracking-[0.5em] rounded-[2rem] shadow-[0_40px_80px_-20px_rgba(var(--primary),0.5)] transition-all"
                    >
                        Create Head Office
                    </motion.button>
                </motion.div>
            ) : (
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{
                        hidden: { opacity: 0 },
                        visible: {
                            opacity: 1,
                            transition: { staggerChildren: 0.15 }
                        }
                    }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12"
                >
                    {branches.map((branch, idx) => (
                        <motion.div
                            key={branch.id}
                            variants={{
                                hidden: { opacity: 0, y: 50, scale: 0.95 },
                                visible: { opacity: 1, y: 0, scale: 1 }
                            }}
                            className="group relative bg-[#0d0e12]/80 backdrop-blur-[40px] border border-white/5 hover:border-primary/40 rounded-[3.5rem] p-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] hover:shadow-primary/10 transition-all duration-700 flex flex-col h-full min-h-[440px] overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />

                            {/* Hover scanline effect */}
                            <div className="absolute inset-x-0 h-[2px] bg-primary/20 top-0 translate-y-[-100%] group-hover:translate-y-[22000%] transition-transform duration-[4000ms] pointer-events-none blur-[1px]" />

                            <div className="flex justify-between items-start mb-10 relative z-10">
                                <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all duration-700 ${branch.is_main_branch ? 'bg-primary/20 text-primary shadow-[0_0_40px_rgba(var(--primary),0.3)] border border-primary/30 rotate-3' : 'bg-white/5 text-white/20 border border-white/10'}`}>
                                    <SchoolIcon className="w-10 h-10" />
                                </div>
                                <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
                                    <button onClick={() => handleOpenEdit(branch)} className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center text-white/40 hover:text-white transition-all backdrop-blur-xl border border-white/10"><EditIcon className="w-5 h-5" /></button>
                                    {!branch.is_main_branch && (
                                        <button onClick={() => setDeletingBranch(branch)} className="w-12 h-12 bg-red-500/5 hover:bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500/40 hover:text-red-500 transition-all backdrop-blur-xl border border-red-500/10"><XIcon className="w-5 h-5" /></button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2 mb-10 relative z-10">
                                <h3 className="text-3xl font-serif font-black text-white/90 group-hover:text-white truncate leading-none uppercase tracking-tighter transition-all">{branch.name}</h3>
                                <div className="flex items-center gap-3 text-[10px] font-black uppercase text-white/30 tracking-[0.3em]">
                                    <div className="w-2 h-2 rounded-full bg-primary/40" />
                                    <span className="truncate">{[branch.city, branch.state].filter(Boolean).join(' • ')}</span>
                                </div>
                            </div>

                            <div className="flex mb-10 relative z-10">
                                {branch.is_main_branch ? (
                                    <span className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-[0.3em] border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                                        <CheckCircleIcon className="w-4 h-4" /> Head Office
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-white/5 text-white/20 text-[10px] font-black uppercase tracking-[0.3em] border border-white/10 italic">
                                        Satellite Node
                                    </span>
                                )}
                            </div>

                            {/* ACCESS PROTOCOL VAULT - Matching the purple look in image */}
                            <div className="mb-10 p-8 bg-black/40 rounded-[2.5rem] border border-white/5 relative group/vault overflow-hidden transition-all group-hover:border-primary/40 group-hover:bg-black/60">
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.05] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute top-0 right-0 p-5">
                                    <div className="flex items-center gap-2 text-[9px] font-black text-white/10 uppercase tracking-[0.4em] group-hover/vault:text-primary/40 transition-colors">
                                        <HashIcon className="w-3 h-3" /> Encrypted
                                    </div>
                                </div>
                                <p className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em] mb-4">Access Protocol Key</p>
                                <div className="flex items-center justify-between gap-4">
                                    <code className="text-2xl font-mono font-black text-primary tracking-[0.3em] group-hover:text-white transition-colors duration-500 uppercase">{branch.access_key || '••••••••'}</code>
                                    <button
                                        onClick={() => {
                                            if (branch.access_key) {
                                                navigator.clipboard.writeText(branch.access_key);
                                                alert('Protocol Key Sequestered to Clipboard');
                                            }
                                        }}
                                        className="p-3 rounded-2xl bg-white/5 hover:bg-primary hover:text-primary-foreground text-white/20 transition-all border border-white/5 hover:border-primary shadow-xl"
                                        title="Copy Access Key"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                    </button>
                                </div>
                            </div>

                            <div className="mt-auto pt-8 border-t border-white/[0.03] flex items-center gap-6 relative z-10">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary/20 to-primary/5 flex items-center justify-center text-primary text-sm font-black shadow-inner border border-primary/10 transition-transform group-hover:scale-110">
                                    {branch.admin_name ? branch.admin_name.charAt(0).toUpperCase() : '?'}
                                </div>
                                <div className="overflow-hidden space-y-1">
                                    <p className="text-[11px] font-black text-white/50 uppercase tracking-[0.3em] truncate group-hover:text-white transition-colors">{branch.admin_name || 'NO CUSTODIAN'}</p>
                                    <p className="text-[10px] font-medium text-white/10 italic truncate font-serif">{branch.admin_email || '—'}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}

                    <motion.button
                        variants={{
                            hidden: { opacity: 0, scale: 0.9 },
                            visible: { opacity: 1, scale: 1 }
                        }}
                        onClick={() => handleOpenCreate()}
                        className="flex flex-col items-center justify-center p-14 rounded-[4rem] border-2 border-dashed border-white/5 bg-white/[0.01] hover:border-primary/40 hover:bg-primary/[0.04] transition-all duration-1000 group relative overflow-hidden h-full min-h-[440px] shadow-2xl"
                    >
                        <div className="absolute inset-0 bg-primary/[0.02] opacity-0 group-hover:opacity-100 transition-all duration-1000" />
                        <div className="relative mb-12">
                            <div className="absolute inset-0 bg-primary/20 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-all duration-1000 group-hover:scale-150" />
                            <div className="relative w-24 h-24 rounded-[2.5rem] bg-white/[0.02] flex items-center justify-center border border-white/5 shadow-2xl transition-all duration-1000 group-hover:bg-primary/20 group-hover:scale-110 group-hover:rotate-12 group-hover:border-primary/40">
                                <PlusIcon className="w-10 h-10 text-white/10 group-hover:text-primary transition-all duration-700" />
                            </div>
                        </div>
                        <span className="text-[12px] font-black text-white/10 uppercase tracking-[0.5em] group-hover:text-white transition-all duration-700 relative z-10">Initialize New Node</span>

                        <div className="absolute top-12 left-12 w-8 h-8 border-t-2 border-l-2 border-white/5 rounded-tl-2xl group-hover:border-primary/40 transition-all duration-700" />
                        <div className="absolute bottom-12 right-12 w-8 h-8 border-b-2 border-r-2 border-white/5 rounded-br-2xl group-hover:border-primary/40 transition-all duration-700" />
                    </motion.button>
                </motion.div>
            )}

            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/98 backdrop-blur-[100px] flex items-center justify-center z-[200] p-4 sm:p-8" onClick={() => setIsModalOpen(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 40 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 40 }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            className="bg-[#050608] w-full max-w-5xl rounded-[4rem] shadow-[0_0_120px_-20px_rgba(0,0,0,1)] border border-primary/20 flex flex-col max-h-[94vh] relative overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="absolute inset-0 bg-primary/[0.01] pointer-events-none" />
                            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

                            <div className="px-14 py-12 border-b border-white/[0.03] bg-white/[0.01] flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-10">
                                    <div className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center text-primary shadow-[inset_0_0_30px_rgba(var(--primary),0.2)] border border-primary/20">
                                        <PlusIcon className="w-10 h-10" />
                                    </div>
                                    <div>
                                        <h3 className="text-4xl font-serif font-black text-white tracking-tighter uppercase leading-none">
                                            {editingBranch ? 'Manage' : 'Initialize'} <span className="text-white/5 italic">{editingBranch ? 'Node.' : (branches.length === 0 ? 'Head Office.' : 'Satellite.')}</span>
                                        </h3>
                                        <div className="flex items-center gap-3 mt-3">
                                            <div className="h-[2px] w-12 bg-primary/40" />
                                            <p className="text-[10px] font-black tracking-[0.6em] text-primary/40 uppercase">Geographic Identity Registry</p>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="w-14 h-14 rounded-full bg-white/5 text-white/20 hover:text-white hover:bg-red-500/20 hover:rotate-90 transition-all flex items-center justify-center border border-white/5">
                                    <XIcon className="w-8 h-8" />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="flex flex-col flex-grow overflow-hidden">
                                <div className="flex-grow overflow-y-auto px-14 py-14 space-y-20 custom-scrollbar select-text">
                                    <AnimatePresence>
                                        {modalError && <DiagnosticErrorConsole message={modalError} onClear={() => setModalError(null)} />}
                                    </AnimatePresence>

                                    <div className="space-y-12">
                                        <div className="flex items-center gap-6 px-4">
                                            <div className="h-8 w-[3px] bg-primary/60 rounded-full" />
                                            <div className="space-y-1">
                                                <h4 className="text-[12px] font-black uppercase text-white/40 tracking-[0.5em]">Identity & Infrastructure</h4>
                                                <p className="text-[10px] font-serif italic text-white/10">Define the unique topological markers for this campus node.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                                            <div className="md:col-span-12">
                                                <FloatingLabelInput
                                                    label="Formal Campus Designation"
                                                    value={formData.name}
                                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                    required
                                                    icon={<SchoolIcon className="w-6 h-6" />}
                                                />
                                            </div>
                                            <div className="md:col-span-12">
                                                <FloatingLabelInput
                                                    label="Geospatial Street Address"
                                                    value={formData.address}
                                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                                    required
                                                    icon={<LocationIcon className="w-6 h-6" />}
                                                    action={
                                                        <button
                                                            type="button"
                                                            onClick={handleResolveAddress}
                                                            disabled={isResolvingAddress || !formData.address.trim()}
                                                            className="p-4 bg-primary/10 text-primary hover:bg-primary/20 rounded-2xl border border-primary/20 backdrop-blur-xl transition-all disabled:opacity-20 shadow-xl group/spark"
                                                        >
                                                            {isResolvingAddress ? <Spinner size="sm" /> : <SparklesIcon className="w-6 h-6 group-hover/spark:rotate-12 transition-transform" />}
                                                        </button>
                                                    }
                                                />
                                            </div>

                                            <div className="md:col-span-6">
                                                <StyledSelect label="National Domain" required value={formData.country} onChange={handleCountryChange} icon={<GlobeIcon className="w-6 h-6" />}>
                                                    {countries.map(c => <option key={c} value={c}>{c}</option>)}
                                                </StyledSelect>
                                            </div>

                                            <div className="md:col-span-6">
                                                <StyledSelect label="Regional Protocol" required value={formData.state} onChange={handleStateChange} disabled={!formData.country} icon={<LocationIcon className="w-6 h-6" />}>
                                                    <option value="">Select State</option>
                                                    {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
                                                </StyledSelect>
                                            </div>

                                            <div className="md:col-span-12">
                                                {availableCities.length > 0 ? (
                                                    <StyledSelect label="Primary Municipality" required value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} disabled={!formData.state} icon={<LocationIcon className="w-6 h-6" />}>
                                                        <option value="">Select City</option>
                                                        {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </StyledSelect>
                                                ) : (
                                                    <FloatingLabelInput label="Municipality Node" required value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} disabled={!formData.state} icon={<LocationIcon className="w-6 h-6" />} />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-12">
                                        <div className="flex items-center gap-6 px-4">
                                            <div className="h-8 w-[3px] bg-emerald-500/40 rounded-full" />
                                            <div className="space-y-1">
                                                <h4 className="text-[12px] font-black uppercase text-white/40 tracking-[0.5em]">Security Custodian</h4>
                                                <p className="text-[10px] font-serif italic text-white/10">Designate the primary administrator responsible for this node's integrity.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                                            <div className="md:col-span-6"><FloatingLabelInput label="Custodian Legal Name" value={formData.adminName} onChange={e => setFormData({ ...formData, adminName: e.target.value })} icon={<UsersIcon className="w-6 h-6" />} /></div>
                                            <div className="md:col-span-6"><FloatingLabelInput label="Direct Telecom Telemetry" type="tel" value={formData.adminPhone} onChange={e => setFormData({ ...formData, adminPhone: e.target.value })} icon={<PhoneIcon className="w-6 h-6" />} /></div>
                                            <div className="md:col-span-12"><FloatingLabelInput label="Institutional Email Node" type="email" required value={formData.adminEmail} onChange={e => setFormData({ ...formData, adminEmail: e.target.value })} icon={<MailIcon className="w-6 h-6" />} /></div>
                                        </div>
                                    </div>

                                    {isHeadOfficeAdmin && (
                                        <motion.div
                                            whileHover={{ scale: 1.01 }}
                                            className={`flex items-start gap-8 p-12 rounded-[3.5rem] border transition-all cursor-pointer relative overflow-hidden group/opt ${formData.isMain ? 'bg-primary/[0.05] border-primary/40 shadow-[0_32px_64px_-16px_rgba(var(--primary),0.2)]' : 'bg-white/[0.01] border-white/5 hover:border-primary/20'}`}
                                            onClick={() => setFormData({ ...formData, isMain: !formData.isMain })}
                                        >
                                            <div className="absolute inset-x-0 h-px top-0 bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover/opt:opacity-100 transition-opacity" />
                                            <div className={`mt-1 w-10 h-10 rounded-2xl border flex items-center justify-center transition-all duration-700 shrink-0 ${formData.isMain ? 'bg-primary border-primary rotate-0 scale-110 shadow-[0_0_20px_rgba(var(--primary),0.6)]' : 'bg-white/5 border-white/10 rotate-12'}`}>
                                                {formData.isMain && <CheckCircleIcon className="w-6 h-6 text-primary-foreground" />}
                                            </div>
                                            <div className="relative z-10 space-y-2">
                                                <p className="text-[16px] font-black uppercase text-white tracking-[0.2em] group-hover/opt:text-primary transition-colors">Authorize as Institutional Headquarters</p>
                                                <p className="text-[14px] font-medium text-white/20 italic leading-relaxed font-serif">This node will be designated as the central synchronization headquarters for the entire registry network.</p>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>

                                <div className="px-14 py-12 border-t border-white/[0.03] bg-white/[0.01] flex flex-col md:flex-row justify-between items-center gap-10 shrink-0">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="text-[11px] font-black uppercase tracking-[0.6em] text-white/5 hover:text-red-500/40 transition-all order-2 md:order-1 flex items-center gap-4">
                                        <div className="w-2 h-2 rounded-full bg-red-500/20" />
                                        Abort Protocol
                                    </button>
                                    <motion.button
                                        whileHover={{ scale: 1.02, boxShadow: "0 0 60px rgba(var(--primary), 0.5)" }}
                                        whileTap={{ scale: 0.98 }}
                                        type="submit"
                                        disabled={isSaving}
                                        className="w-full md:w-auto px-20 py-7 bg-primary text-primary-foreground rounded-[2.5rem] font-black text-[14px] uppercase tracking-[0.5em] shadow-[0_40px_80px_-20px_rgba(var(--primary),0.6)] hover:bg-primary/90 flex items-center justify-center gap-6 transition-all order-1 md:order-2"
                                    >
                                        {isSaving ? <Spinner size="sm" className="text-white" /> : (
                                            <>
                                                {editingBranch ? 'Sync Protocol' : 'Initialize Node'}
                                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border border-white/20">
                                                    <CheckCircleIcon className="w-5 h-5" />
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

            <ConfirmationModal
                isOpen={!!deletingBranch}
                onClose={() => setDeletingBranch(null)}
                onConfirm={handleDelete}
                title="Deconstruct Node"
                message={`Are you sure you want to permanently deconstruct the "${deletingBranch?.name}" branch node? This protocol cannot be reversed once initiated.`}
                confirmText="Terminate Node"
                loading={isDeleting}
            />
        </div>
    );
};