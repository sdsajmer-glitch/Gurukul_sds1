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
        <div className="w-full max-w-[1240px] mx-auto px-6 pb-32 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            {/* Image Header Style */}
            <div className="flex items-center justify-between py-8 mb-20 border-b border-white/[0.03]">
                <span className="text-[11px] font-black uppercase tracking-[0.5em] text-white/80">Configure Node</span>
                {onBack && (
                    <button onClick={onBack} className="text-white/20 hover:text-white transition-all transform hover:rotate-90 duration-500">
                        <XIcon className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Cinematic Hero Section */}
            <div className="relative text-center mb-32 group">
                {/* Ambient Backdrop Logic */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] hero-spotlight opacity-50 blur-[100px] pointer-events-none" />

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="relative z-10"
                >
                    <h1 className="text-[6rem] md:text-[9rem] font-serif font-black text-white tracking-tighter leading-[0.75] mb-0 drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                        BRANCH
                    </h1>
                    <h1 className="text-[6rem] md:text-[9rem] font-serif font-black text-ghost tracking-tighter leading-[0.75] mb-12">
                        REGISTRY.
                    </h1>

                    <div className="max-w-xl mx-auto space-y-6">
                        <p className="text-white/40 text-[16px] font-serif italic leading-relaxed">
                            Start by defining your <strong className="text-white/70">Head Office Node</strong>, then synchronize additional satellite campuses to the global network.
                        </p>

                        <div className="flex items-center justify-center gap-4">
                            <div className="h-px w-12 bg-white/5" />
                            <span className="text-[9px] font-black uppercase tracking-[0.6em] text-white/20">Institutional Matrix v2.0</span>
                            <div className="h-px w-12 bg-white/5" />
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Institutional Command Pill: Precision Glass */}
            <div className="relative max-w-2xl mx-auto mb-32 p-1 bg-white/[0.02] border border-white/[0.05] rounded-[3.5rem] shadow-[0_64px_128px_-32px_rgba(0,0,0,0.6)] backdrop-blur-xl group/pill">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                    <span className="text-[9px] font-black uppercase tracking-[0.4em] text-primary/40">Network Integrity: Active</span>
                </div>

                <div className="flex items-center p-6 gap-6">
                    <button
                        onClick={() => handleOpenCreate()}
                        disabled={loading}
                        className="flex-1 py-6 px-10 glass-stroke rounded-3xl text-[10px] font-black uppercase tracking-[0.4em] text-white/30 hover:text-white hover:bg-white/5 hover:border-white/20 transition-all duration-500 shadow-xl"
                    >
                        New Institutional Node
                    </button>

                    {onNext && branches.length > 0 && (
                        <button
                            onClick={handleFinish}
                            disabled={isFinishing}
                            className="flex-1 py-6 px-10 bg-primary text-primary-foreground rounded-3xl text-[10px] font-black uppercase tracking-[0.4em] shadow-[0_24px_48px_-12px_rgba(var(--primary),0.4)] flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-all duration-500"
                        >
                            {isFinishing ? <Spinner size="sm" /> : <>Synchronize Registry &rarr;</>}
                        </button>
                    )}
                </div>

                {/* Subtle Scanline Overlay for the initial state */}
                {branches.length === 0 && !loading && <div className="scanline opacity-20" />}
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-8">
                    <Spinner size="xl" className="text-primary/20" />
                    <div className="space-y-4 text-center">
                        <p className="text-[12px] font-black uppercase tracking-[1em] text-white/5 animate-pulse">Scanning Registry Topology</p>
                    </div>
                </div>
            ) : error ? (
                <DiagnosticErrorConsole message={error} onClear={() => setError(null)} />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 px-10 pb-40">
                    {branches.map((branch, idx) => (
                        <motion.div
                            key={branch.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1, duration: 0.8 }}
                            whileHover={{ y: -8 }}
                            className="group relative bg-[#0a0b0f] glass-stroke node-shadow hover:node-glow rounded-[4rem] p-12 flex flex-col items-center text-center min-h-[520px] transition-all duration-700"
                        >
                            {/* Header Zone: Anchored Shield */}
                            <div className="relative w-full flex flex-col items-center mb-12">
                                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                                <div className="w-20 h-28 bg-primary/[0.03] border border-primary/10 rounded-full flex items-center justify-center text-primary mt-4 mb-10 shadow-[inset_0_0_30px_rgba(var(--primary),0.05)]">
                                    <SchoolIcon className="w-10 h-10 group-hover:scale-110 transition-transform duration-700" />
                                </div>

                                <h3 className="text-4xl font-serif font-black text-white tracking-tighter mb-4 group-hover:text-primary transition-colors duration-500 uppercase">
                                    {branch.name}
                                </h3>

                                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/[0.03] bg-white/[0.01]">
                                    <LocationIcon className="w-3 h-3 text-white/20" />
                                    <span className="text-[10px] font-mono font-bold text-white/30 uppercase tracking-[0.2em]">
                                        {branch.city} • {branch.state}
                                    </span>
                                </div>
                            </div>

                            {/* Telemetry Zone: Intentional Space */}
                            <div className="flex-grow flex flex-col items-center justify-center space-y-8 mb-12">
                                {branch.is_main_branch ? (
                                    <div className="px-8 py-3 rounded-full border border-emerald-500/30 bg-emerald-500/5 flex items-center gap-4 shadow-[0_0_40px_rgba(16,185,129,0.15)]">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,1)]" />
                                        <span className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.4em]">Head Office Node</span>
                                    </div>
                                ) : (
                                    <div className="px-8 py-3 rounded-full border border-white/5 bg-white/[0.02] flex items-center gap-4">
                                        <div className="w-2 h-2 rounded-full bg-white/20" />
                                        <span className="text-[11px] font-black text-white/30 uppercase tracking-[0.4em]">Satellite Node</span>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 text-white/5 font-mono text-[9px] uppercase tracking-widest">
                                    <span>Established Sequence</span>
                                    <span className="w-10 h-px bg-white/5" />
                                    <span>{new Date(branch.created_at).getFullYear()}</span>
                                </div>
                            </div>

                            {/* Infrastructure Zone: The Vault Strip */}
                            <div className="w-full space-y-8">
                                <div className="w-full py-8 px-6 bg-black/40 rounded-[2.5rem] border border-white/[0.02] relative overflow-hidden group/vault transition-all duration-700 hover:bg-black/80 hover:border-primary/20">
                                    <div className="flex flex-col gap-4 relative z-10 text-center items-center">
                                        <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em]">Primary Protocol Key</p>
                                        <code className="text-4xl font-mono font-black text-primary tracking-[0.3em] block transition-colors duration-700 group-hover/vault:text-white">
                                            {branch.access_key?.slice(0, 4) || 'ED7B'}
                                        </code>
                                    </div>
                                    <div className="absolute top-0 right-0 p-6 opacity-10">
                                        <HashIcon className="w-6 h-6" />
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent opacity-0 group-hover/vault:opacity-100 transition-opacity" />
                                </div>

                                {/* Control Surface */}
                                <div className="flex justify-center gap-6 opacity-0 group-hover:opacity-100 transition-all duration-700 translate-y-4 group-hover:translate-y-0">
                                    <button
                                        onClick={() => handleOpenEdit(branch)}
                                        className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/10 transform active:scale-95 transition-all duration-500"
                                    >
                                        <EditIcon className="w-5 h-5" />
                                    </button>
                                    {!branch.is_main_branch && (
                                        <button
                                            onClick={() => setDeletingBranch(branch)}
                                            className="w-14 h-14 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-center justify-center text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transform active:scale-95 transition-all duration-500"
                                        >
                                            <XIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}

                    <motion.button
                        whileHover={{ scale: 0.98, y: -4 }}
                        onClick={() => handleOpenCreate()}
                        className="flex flex-col items-center justify-center p-12 rounded-[4rem] border-2 border-dashed border-white/5 bg-white/[0.01] hover:border-primary/20 hover:bg-white/[0.02] transition-all min-h-[520px] group relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-primary/[0.01] opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10 space-y-12 text-center items-center flex flex-col">
                            <div className="w-24 h-24 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mx-auto group-hover:scale-110 group-hover:bg-primary/5 group-hover:border-primary/20 transition-all duration-700 shadow-2xl">
                                <PlusIcon className="w-10 h-10 text-white/5 group-hover:text-primary transition-colors" />
                            </div>
                            <div className="space-y-4">
                                <p className="text-xl font-serif italic text-white/10 group-hover:text-white/40 transition-colors uppercase tracking-widest">Topology Expansion</p>
                                <p className="text-[10px] font-black uppercase tracking-[1em] text-white/5">Initialize Node</p>
                            </div>
                        </div>
                    </motion.button>
                </div>
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
                                            <div className="h-8 w-[3px] bg-primary/40 rounded-full" />
                                            <div className="space-y-1">
                                                <h4 className="text-[12px] font-black uppercase text-white/40 tracking-[0.5em]">Security Custodian</h4>
                                                <p className="text-[10px] font-serif italic text-white/10">Designate the primary administrator responsible for this node's integrity.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                            <div className="md:col-span-1"><FloatingLabelInput label="Custodian Legal Name" value={formData.adminName} onChange={e => setFormData({ ...formData, adminName: e.target.value })} icon={<UsersIcon className="w-6 h-6" />} /></div>
                                            <div className="md:col-span-1"><FloatingLabelInput label="Direct Telecom Telemetry" type="tel" value={formData.adminPhone} onChange={e => setFormData({ ...formData, adminPhone: e.target.value })} icon={<PhoneIcon className="w-6 h-6" />} /></div>
                                            <div className="md:col-span-2"><FloatingLabelInput label="Institutional Email Node" type="email" required value={formData.adminEmail} onChange={e => setFormData({ ...formData, adminEmail: e.target.value })} icon={<MailIcon className="w-6 h-6" />} /></div>
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
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 hover:text-white transition-all order-2 md:order-1 flex items-center gap-4 group"
                                    >
                                        <div className="w-2 h-2 rounded-full bg-red-500/20 group-hover:bg-red-500 transition-colors" />
                                        Abort Initialization
                                    </button>
                                    <motion.button
                                        whileHover={{ scale: 1.02, boxShadow: "0 0 60px rgba(var(--primary), 0.4)" }}
                                        whileTap={{ scale: 0.98 }}
                                        type="submit"
                                        disabled={isSaving}
                                        className="w-full md:w-auto px-16 py-6 bg-primary text-primary-foreground rounded-2xl font-black text-[12px] uppercase tracking-[0.4em] shadow-[0_32px_64px_-16px_rgba(var(--primary),0.5)] hover:bg-primary/90 flex items-center justify-center gap-6 transition-all order-1 md:order-2"
                                    >
                                        {isSaving ? <Spinner size="sm" className="text-white" /> : (
                                            <>
                                                {editingBranch ? 'Sync Protocol' : 'Initialize Node'}
                                                <CheckCircleIcon className="w-5 h-5 opacity-40" />
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