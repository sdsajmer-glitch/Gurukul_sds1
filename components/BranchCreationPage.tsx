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
import { ShieldCheckIcon as ShieldIcon } from './icons/ShieldCheckIcon';

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
            <label className="absolute left-10 top-0 -translate-y-1/2 bg-[#050608] px-2 text-[10px] font-black uppercase tracking-[0.3em] text-white/30 group-focus-within:text-primary transition-all duration-300 z-20">
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
            <label className="absolute left-10 top-0 -translate-y-1/2 bg-[#050608] px-2 text-[10px] font-black uppercase tracking-[0.3em] text-white/30 group-focus-within:text-primary transition-all duration-300 z-20">
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
    const [copiedBranchId, setCopiedBranchId] = useState<string | null>(null);

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
        <div className="w-full max-w-[1400px] mx-auto px-6 md:px-12 py-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* --- CUSTOM MODULE HEADER --- */}
            <div className="flex items-center justify-between mb-16 px-4">
                <div className="space-y-1">
                    <h2 className="text-[13px] font-black uppercase tracking-[0.5em] text-white">Configure Node</h2>
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/60">Topological Registry Configuration</p>
                </div>
                <button
                    onClick={onBack}
                    className="w-12 h-12 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center text-white/20 hover:text-white hover:border-white/20 transition-all active:scale-95"
                >
                    <XIcon className="w-5 h-5" />
                </button>
            </div>

            <div className="section-divider opacity-50" />

            {/* --- HERO SECTION: EDITORIAL STYLE --- */}
            <div className="text-center space-y-12 mb-24 relative py-12">
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-white/[0.03]" />
                <div className="relative space-y-4">
                    <h1 className="premium-headline text-8xl md:text-[10rem] text-white leading-none tracking-[-0.04em] relative inline-block">
                        Branch
                        <span className="absolute -inset-x-12 top-1/2 -translate-y-1/2 text-ghost text-[12rem] whitespace-nowrap pointer-events-none opacity-20">Registry.</span>
                    </h1>
                    <div className="max-w-2xl mx-auto space-y-6">
                        <p className="text-[13px] font-medium text-white/40 leading-relaxed tracking-wider uppercase">
                            Start by defining your <span className="text-white">Head Office Node</span>, then synchronize additional satellite campuses to the global network.
                        </p>
                        <div className="flex items-center justify-center gap-4 py-4">
                            <div className="h-px w-16 bg-white/5" />
                            <span className="text-[10px] font-black uppercase tracking-[1em] text-white/10">Institutional Matrix v2.4</span>
                            <div className="h-px w-16 bg-white/5" />
                        </div>
                    </div>
                </div>

                {/* --- COMMAND PILL --- */}
                <div className="flex flex-col items-center gap-10">
                    <div className="flex items-center gap-3 px-6 py-2 rounded-full border border-primary/20 bg-primary/5 mb-2">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(139,92,246,1)]" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/80">Network Intensity: Active</span>
                    </div>

                    <div className="inline-flex p-2 rounded-[2rem] border border-white/5 bg-white/[0.02] backdrop-blur-xl gap-2 h-[80px]">
                        <button
                            onClick={() => handleOpenCreate()}
                            className="btn-secondary-premium border-none bg-transparent hover:bg-white/[0.05] h-full"
                        >
                            New Institutional Node
                        </button>
                        <button className="btn-primary-premium h-full px-12">
                            Synchronize Registry
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center min-h-[600px] space-y-16">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-3xl animate-pulse" />
                        <Spinner size="xl" className="text-primary relative z-10" />
                    </div>
                    <p className="text-[13px] font-black uppercase text-primary/40 tracking-[0.8em] animate-pulse">Synchronizing Core Registry...</p>
                </div>
            ) : error ? (
                <DiagnosticErrorConsole message={error} onClear={() => setError(null)} />
            ) : (
                <div className="space-y-40 mb-40">
                    {/* --- NODE GRID: MONOLITHIC --- */}
                    <div className="grid grid-cols-1 gap-32">
                        {branches.map((branch, idx) => (
                            <motion.div
                                key={branch.id}
                                initial={{ opacity: 0, y: 60 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                                className={`enterprise-glass rounded-[5rem] p-16 md:p-24 flex flex-col items-center text-center transition-all duration-1000 min-h-[960px] w-full relative overflow-hidden ${branch.is_main_branch ? 'glow-card-active' : ''}`}
                            >
                                <div className="scanline-subtle" />

                                {/* Status Header Pill */}
                                <div className="mb-20">
                                    {branch.is_main_branch ? (
                                        <div className="py-6 px-12 rounded-full border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-3xl flex items-center justify-center gap-6 shadow-[inset_0_0_40px_rgba(16,185,129,0.05)]">
                                            <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_20px_rgba(16,185,129,1)]" />
                                            <div className="text-left">
                                                <p className="text-[14px] font-black text-emerald-500 uppercase tracking-[0.6em] leading-none">Central Command</p>
                                                <p className="text-[9px] font-black text-emerald-500/40 uppercase tracking-[0.2em] mt-1.5">Global Master Hub</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-6 px-12 rounded-full border border-white/10 bg-white/5 backdrop-blur-2xl flex items-center justify-center gap-6">
                                            <div className="w-4 h-4 rounded-full bg-white/20" />
                                            <div className="text-left">
                                                <p className="text-[14px] font-black text-white/30 uppercase tracking-[0.6em] leading-none">Satellite Node</p>
                                                <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.2em] mt-1.5">Active Campus Registry</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Campus Icon Node */}
                                <div className="relative mb-20 group/icon">
                                    <div className="absolute inset-0 bg-primary/20 blur-[50px] rounded-full scale-150 opacity-0 group-hover/icon:opacity-100 transition-opacity duration-1000" />
                                    <div className="w-48 h-48 rounded-full bg-primary/[0.05] border border-white/5 flex items-center justify-center text-primary shadow-[inset_0_0_80px_rgba(var(--primary),0.1)] group-hover/icon:scale-110 group-hover/icon:border-primary/20 transition-all duration-1000 relative z-10">
                                        <SchoolIcon className="w-24 h-24" />
                                    </div>
                                </div>

                                <div className="space-y-10 mb-24 relative z-10">
                                    <h3 className="premium-headline text-8xl md:text-[10rem] text-white leading-none drop-shadow-2xl">{branch.name}</h3>
                                    <div className="flex items-center justify-center gap-6 p-1 rounded-full bg-white/[0.02] border border-white/5 pr-8 pl-4 py-3 backdrop-blur-xl mx-auto w-fit">
                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                                            <LocationIcon className="w-4 h-4 text-white/40" />
                                        </div>
                                        <span className="text-[13px] font-black text-white/40 uppercase tracking-[0.4em] font-mono">
                                            {branch.city} + {branch.state} + India
                                        </span>
                                    </div>
                                </div>

                                {/* Sync Telemetry Strip */}
                                <div className="w-full max-w-4xl px-12 flex items-center justify-center gap-12 mb-24 opacity-30">
                                    <span className="text-[11px] font-black uppercase tracking-[1em] whitespace-nowrap">Registry Sequence</span>
                                    <div className="h-[2px] flex-grow bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                    <span className="text-[14px] font-mono font-black tracking-[0.4em] text-primary">{new Date(branch.created_at).getFullYear()}</span>
                                    <div className="h-[2px] flex-grow bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                    <span className="text-[11px] font-black uppercase tracking-[1em] whitespace-nowrap">Active Matrix</span>
                                </div>

                                {/* Monolithic Hash Vault */}
                                <div className="w-full max-w-4xl mt-auto py-10">
                                    <div className="bg-[#050608]/80 rounded-[5rem] border border-white/5 p-16 relative overflow-hidden group/vault hover:border-primary/40 transition-all duration-700 shadow-[inset_0_40px_100px_rgba(0,0,0,1)]">
                                        <div className="absolute top-10 left-10 text-[8px] font-mono text-white/5 uppercase tracking-[0.5em] flex flex-col gap-1.5 opacity-40">
                                            <span>Encryption: AES-256-XPN</span>
                                            <span>Protocol: Institutional_V4</span>
                                        </div>
                                        <div className="flex items-center justify-center gap-12 mb-16 scale-110 md:scale-125">
                                            <span className="text-white/5 text-[100px] font-black font-mono leading-none">#</span>
                                            <code className="text-[80px] md:text-[120px] font-mono font-black text-primary tracking-[0.2em] group-hover:text-white transition-colors duration-1000 drop-shadow-[0_0_60px_rgba(var(--primary),0.6)]">
                                                {branch.access_key}
                                            </code>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigator.clipboard.writeText(branch.access_key || '');
                                                setCopiedBranchId(branch.id);
                                                setTimeout(() => setCopiedBranchId(null), 2000);
                                            }}
                                            className="btn-primary-premium h-[80px] px-20 text-[13px] tracking-[0.5em] w-full max-w-xl mx-auto block group-hover:scale-105"
                                        >
                                            {copiedBranchId === branch.id ? 'Core Captured' : 'Secure Protocol Capture'}
                                        </button>
                                        <div className="absolute inset-0 scanline-subtle opacity-[0.05]" />
                                    </div>
                                </div>

                                {/* Floating Action Nodes */}
                                <div className="absolute top-12 right-12 flex flex-col gap-6 opacity-0 group-hover:opacity-100 transition-all duration-1000 translate-x-10 group-hover:translate-x-0">
                                    <button onClick={() => handleOpenEdit(branch)} className="w-16 h-16 rounded-[2rem] bg-white/[0.03] hover:bg-primary/20 hover:text-primary border border-white/5 flex items-center justify-center text-white/30 transition-all shadow-3xl backdrop-blur-3xl transform-gpu hover:scale-110">
                                        <EditIcon className="w-6 h-6" />
                                    </button>
                                    {!branch.is_main_branch && (
                                        <button onClick={() => setDeletingBranch(branch)} className="w-16 h-16 rounded-[2rem] bg-red-500/[0.03] hover:bg-red-500 hover:text-white border border-red-500/10 flex items-center justify-center text-red-500/40 transition-all shadow-3xl backdrop-blur-3xl transform-gpu hover:scale-110">
                                            <XIcon className="w-6 h-6" />
                                        </button>
                                    )}
                                </div>

                                {/* Ambient Decorative Gradients */}
                                <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                                <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                            </motion.div>
                        ))}

                        {/* --- TOPOLOGY EXPANSION: MONOLITHIC --- */}
                        <motion.button
                            whileHover={{ scale: 0.99, y: -12 }}
                            onClick={() => handleOpenCreate()}
                            className="flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[6rem] p-32 min-h-[960px] w-full group hover:border-primary/40 hover:bg-white/[0.01] transition-all duration-1000 relative overflow-hidden"
                        >
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                            <div className="w-48 h-48 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mb-16 group-hover:scale-110 group-hover:border-primary/20 transition-all duration-1000 shadow-inner relative z-10">
                                <PlusIcon className="w-20 h-20 text-white/5 group-hover:text-primary transition-colors" />
                            </div>
                            <div className="space-y-12 relative z-10 w-full text-center">
                                <h4 className="premium-headline text-8xl md:text-[8rem] italic text-white/5 group-hover:text-white/20 transition-all tracking-[-0.02em] leading-tight">Topology<br />Expansion</h4>
                                <div className="flex items-center justify-center gap-8 opacity-20 group-hover:opacity-40 transition-all">
                                    <div className="h-px flex-grow bg-white/20" />
                                    <p className="text-[14px] font-black uppercase tracking-[1.5em] text-white whitespace-nowrap">Initialize Next Node</p>
                                    <div className="h-px flex-grow bg-white/20" />
                                </div>
                            </div>
                        </motion.button>
                    </div>

                    {/* --- PROTOCOL VAULT: REFINED --- */}
                    <div className="space-y-20 py-20">
                        <div className="flex items-center gap-10">
                            <div className="w-16 h-[2px] bg-primary/40" />
                            <h2 className="text-[16px] font-black uppercase tracking-[1em] text-white">Protocol Vault</h2>
                            <div className="flex-grow h-px bg-white/[0.03]" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                            {[
                                { icon: ShieldIcon, label: 'Identity Layer', title: 'Geo-Identity v2.4', badge: 'Secure', color: 'emerald' },
                                { icon: GlobeIcon, label: 'Network Mesh', title: 'Satellite Sync', badge: 'Global', color: 'primary' },
                                { icon: HashIcon, label: 'Data Integrity', title: 'Checksum Protocol', badge: 'Verified', color: 'white' }
                            ].map((item, i) => (
                                <div key={i} className="enterprise-glass rounded-[4rem] p-16 space-y-12 transition-all hover:scale-[1.02] hover:border-primary/40 group relative overflow-hidden min-h-[480px] flex flex-col justify-between">
                                    <div className="space-y-12">
                                        <div className="flex items-center justify-between">
                                            <item.icon className="w-14 h-14 text-white/10 group-hover:text-primary transition-colors" />
                                            <span className={`text-[11px] font-black uppercase px-6 py-2 rounded-full border border-white/5 bg-white/5 text-white/40 group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/20 transition-colors`}>{item.badge}</span>
                                        </div>
                                        <div className="space-y-4">
                                            <p className="text-[11px] font-black uppercase tracking-[0.5em] text-white/20">{item.label}</p>
                                            <p className="premium-headline text-4xl text-white group-hover:text-primary transition-colors">{item.title}</p>
                                        </div>
                                    </div>
                                    <div className="pt-10 border-t border-white/[0.03] flex items-center gap-5 text-[10px] font-mono font-bold text-white/10 uppercase tracking-[0.3em]">
                                        <div className="w-2.5 h-2.5 rounded-full bg-white/10 group-hover:bg-primary group-hover:animate-pulse transition-all" />
                                        <span>Matrix ID: {Math.random().toString(36).substring(7).toUpperCase()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL DESIGN: PREMIUM OVERHAUL --- */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12 backdrop-blur-2xl bg-[#030406]/90"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 40, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.95, y: 40, opacity: 0 }}
                            className="bg-[#0a0b0f] border border-white/10 rounded-[5rem] w-full max-w-7xl h-full max-h-[900px] overflow-hidden flex flex-col shadow-[0_100px_200px_-50px_rgba(0,0,0,1)] relative"
                        >
                            <div className="scanline-subtle opacity-5" />

                            {/* Modal Header */}
                            <div className="p-16 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.01] relative z-10 shrink-0">
                                <div className="space-y-2">
                                    <h2 className="premium-headline text-5xl text-white uppercase">{editingBranch ? 'Sync Protocol' : 'Initialize Node'}</h2>
                                    <p className="text-[12px] font-black uppercase tracking-[0.4em] text-white/20">Institutional Matrix Configuration Registry</p>
                                </div>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="w-20 h-20 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center text-white/20 hover:text-white hover:border-white/20 transition-all hover:bg-white/10"
                                >
                                    <XIcon className="w-8 h-8" />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="flex-grow overflow-hidden flex flex-col relative z-10">
                                <div className="flex-grow overflow-y-auto custom-scrollbar p-16 md:p-24 space-y-20">
                                    {modalError && (
                                        <div className="p-10 rounded-[2rem] border border-red-500/20 bg-red-500/5 text-red-500 text-[12px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4 animate-in fade-in slide-in-from-top-4">
                                            <AlertTriangleIcon className="w-5 h-5 shrink-0" />
                                            <span>{modalError}</span>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                        <div className="space-y-12">
                                            <div className="space-y-8">
                                                <p className="text-[11px] font-black uppercase tracking-[0.6em] text-primary">01. Core Identity</p>
                                                <FloatingLabelInput
                                                    label="Institution Identity"
                                                    icon={<SchoolIcon className="w-5 h-5" />}
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    required
                                                />
                                            </div>

                                            <div className="space-y-8">
                                                <p className="text-[11px] font-black uppercase tracking-[0.6em] text-primary">02. Geo-Topical Registry</p>
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
                                                />
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                                                    <StyledSelect label="Country" value={formData.country} onChange={handleCountryChange} icon={<GlobeIcon className="w-5 h-5" />}>
                                                        {countries.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </StyledSelect>
                                                    <StyledSelect label="State" value={formData.state} onChange={handleStateChange} disabled={!formData.country} icon={<LocationIcon className="w-5 h-5" />}>
                                                        <option value="">Select State</option>
                                                        {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
                                                    </StyledSelect>
                                                    {availableCities.length > 0 ? (
                                                        <StyledSelect label="City" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} disabled={!formData.state} icon={<LocationIcon className="w-5 h-5" />}>
                                                            <option value="">Select City</option>
                                                            {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                                                        </StyledSelect>
                                                    ) : (
                                                        <FloatingLabelInput label="City" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} disabled={!formData.state} icon={<LocationIcon className="w-5 h-5" />} />
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-12">
                                            <div className="space-y-8">
                                                <p className="text-[11px] font-black uppercase tracking-[0.6em] text-primary">03. Node Administrator</p>
                                                <FloatingLabelInput label="Admin Protocol Name" icon={<ShieldIcon className="w-5 h-5" />} value={formData.adminName} onChange={(e) => setFormData({ ...formData, adminName: e.target.value })} required />
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                                    <FloatingLabelInput label="Comms Channel (Phone)" icon={<div className="font-mono text-[10px] text-white opacity-20">+91</div>} value={formData.adminPhone} onChange={(e) => setFormData({ ...formData, adminPhone: e.target.value })} required />
                                                    <FloatingLabelInput label="Secure Signal (Email)" icon={<GlobeIcon className="w-5 h-5 opacity-20" />} value={formData.adminEmail} onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })} type="email" required />
                                                </div>
                                            </div>

                                            <div className="space-y-8">
                                                <p className="text-[11px] font-black uppercase tracking-[0.6em] text-primary">04. Matrix Authority</p>
                                                {isHeadOfficeAdmin && (
                                                    <div
                                                        onClick={() => setFormData({ ...formData, isMain: !formData.isMain })}
                                                        className={`group relative p-10 rounded-[2.5rem] border transition-all cursor-pointer overflow-hidden ${formData.isMain ? 'bg-primary/5 border-primary/30' : 'bg-white/[0.01] border-white/5 hover:border-white/10'}`}
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
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Modal Footer */}
                                <div className="p-16 border-t border-white/[0.05] bg-white/[0.02] flex items-center justify-between gap-10 shrink-0">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary-premium px-12 border-none">Abort Initialization</button>
                                    <button type="submit" disabled={isSaving} className="btn-primary-premium flex items-center gap-6 px-16 text-[13px]">
                                        {isSaving ? <Spinner size="sm" className="text-white" /> : (
                                            <>
                                                {editingBranch ? 'Sync Protocol' : 'Initialize Node'}
                                                <div className="w-px h-6 bg-white/20 mx-2" />
                                                <SparklesIcon className="w-6 h-6 opacity-40" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ConfirmationModal
                isOpen={!!deletingBranch}
                onClose={() => setDeletingBranch(null)}
                onConfirm={handleDelete}
                title="Decommission Node"
                message={`Are you certain you wish to permanently decommission "${deletingBranch?.name}" from the institutional matrix? This action cannot be reversed.`}
                confirmText="Decommission"
                isDestructive
                loading={isDeleting}
            />
        </div>
    );
};