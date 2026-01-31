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
import { GoogleGenAI } from '@google/genai';

interface BranchCreationPageProps {
    onNext?: () => void;
    profile?: UserProfile;
    onBack?: () => void;
}

const FloatingLabelInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string, icon?: React.ReactNode, action?: React.ReactNode }> = ({ label, icon, action, className, ...props }) => (
    <div className="relative group">
        <div className="absolute top-1/2 -translate-y-1/2 left-4 text-muted-foreground/60 group-focus-within:text-primary transition-colors duration-200 z-10 pointer-events-none">
            {icon}
        </div>
        <input
            {...props}
            placeholder=" "
            className={`peer block w-full rounded-xl border border-input bg-background px-4 py-3.5 pl-11 ${action ? 'pr-12' : ''} text-sm text-foreground shadow-sm transition-all duration-200 hover:border-primary/50 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none placeholder-transparent ${className}`}
        />
        <label className="absolute left-11 top-0 -translate-y-1/2 bg-card/95 px-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 transition-all duration-200 
            peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-placeholder-shown:normal-case peer-placeholder-shown:text-muted-foreground/60
            peer-focus:top-0 peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:text-primary pointer-events-none">
            {label}
        </label>
        {action && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20">
                {action}
            </div>
        )}
    </div>
);

const StyledSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string, icon?: React.ReactNode }> = ({ label, icon, children, className, ...props }) => (
    <div className="relative group">
        <div className="absolute top-1/2 -translate-y-1/2 left-4 text-muted-foreground/60 group-focus-within:text-primary transition-colors duration-200 z-10 pointer-events-none">
            {icon}
        </div>
        <select
            {...props}
            className={`peer block w-full appearance-none rounded-xl border border-input bg-background px-4 py-3.5 pl-11 text-sm text-foreground shadow-sm transition-all duration-200 hover:border-primary/50 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none cursor-pointer ${className}`}
        >
            {children}
        </select>
        <label className="absolute left-11 top-0 -translate-y-1/2 bg-card/95 px-1.5 text-[10px] font-bold uppercase tracking-wider text-primary transition-all duration-200 pointer-events-none">
            {label}
        </label>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground group-hover:text-foreground transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </div>
    </div>
);

import { motion, AnimatePresence } from 'framer-motion';

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

    const handleFinish = async () => {
        if (isFinishing || !onNext) return;
        setIsFinishing(true);
        try {
            const { error: finishError } = await supabase.rpc('complete_branch_step');
            if (finishError) throw finishError;
            onNext();
        } catch (err: any) {
            console.error("Finishing error:", err);
            setIsFinishing(false);
            alert("Failed to finalize onboarding. Please ensure you have added at least one branch.");
        }
    };

    const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, country: e.target.value, state: '', city: '' });
    const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, state: e.target.value, city: '' });
    const availableStates = useMemo(() => formData.country ? statesByCountry[formData.country] || [] : [], [formData.country]);
    const availableCities = useMemo(() => formData.state ? citiesByState[formData.state] || [] : [], [formData.state]);

    return (
        <div className="w-full max-w-[1400px] mx-auto px-6">

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center max-w-3xl mx-auto mb-16 space-y-6"
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-3 px-6 py-2 bg-primary/10 rounded-full border border-primary/20 mb-4"
                >
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-primary text-[10px] font-black uppercase tracking-[0.3em]">Network Component Deployment</span>
                </motion.div>
                <h2 className="text-5xl md:text-7xl font-serif font-black text-white tracking-tighter leading-none">Node Registry</h2>
                <p className="text-white/40 text-lg font-medium leading-relaxed italic max-w-2xl mx-auto">
                    Start by defining your Head Office, then add any additional satellite campuses to your network.
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12 p-6 bg-white/[0.03] backdrop-blur-2xl rounded-[2.5rem] border border-white/10 shadow-2xl"
            >
                <div className="flex items-center gap-4 px-4">
                    {onBack && (
                        <button
                            onClick={onBack}
                            disabled={isFinishing}
                            className="group flex items-center gap-4 text-[10px] font-black text-white/30 hover:text-white transition-all uppercase tracking-[0.3em] disabled:opacity-50"
                        >
                            <ChevronLeftIcon className="w-5 h-5 transition-transform group-hover:-translate-x-2" />
                            Return
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-6 px-4">
                    <button
                        onClick={() => handleOpenCreate()}
                        disabled={loading}
                        className="px-8 py-4 bg-white/5 hover:bg-white hover:text-black text-white/70 text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl transition-all flex items-center gap-3 border border-white/10 shadow-xl"
                    >
                        <PlusIcon className="w-4 h-4" /> Deploy Branch
                    </button>
                    {onNext && branches.length > 0 && (
                        <button
                            onClick={handleFinish}
                            disabled={isFinishing}
                            className="bg-primary text-white px-10 py-4 rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.3em] flex items-center gap-3 transition-all hover:shadow-[0_20px_50px_rgba(var(--primary),0.3)] hover:scale-105 active:scale-95 min-w-[220px] justify-center"
                        >
                            {isFinishing ? <><Spinner size="sm" className="text-current" /> Finalizing...</> : <>Synchronize Network &rarr;</>}
                        </button>
                    )}
                </div>
            </motion.div>

            {loading ? (
                <div className="flex justify-center p-40"><Spinner size="lg" className="text-primary" /></div>
            ) : error ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-10 bg-red-500/10 text-red-500 border border-red-500/20 rounded-[2.5rem] text-center font-black uppercase tracking-[0.2em]">{error}</motion.div>
            ) : branches.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-32 bg-white/[0.02] border border-white/5 rounded-[4rem] text-center hover:bg-white/[0.04] transition-all cursor-pointer group" onClick={() => handleOpenCreate()}>
                    <div className="w-32 h-32 bg-white/5 rounded-[2.5rem] flex items-center justify-center mb-10 shadow-2xl border border-white/10 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 relative">
                        <div className="absolute inset-0 bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        <SchoolIcon className="w-12 h-12 text-white/20 group-hover:text-primary transition-colors relative z-10" />
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-3xl font-serif font-black text-white tracking-tight uppercase">Network Initialization</h3>
                        <p className="text-white/30 text-sm font-medium max-w-md mx-auto leading-relaxed">
                            No nodes detected in the registry. Let's start by establishing your <strong>Primary Head Office</strong>.
                        </p>
                    </div>
                    <button className="mt-12 px-12 py-5 bg-primary text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-[1.5rem] shadow-2xl hover:shadow-primary/50 hover:-translate-y-1 transition-all">
                        Launch Head Office
                    </button>
                </motion.div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {branches.map((branch, idx) => (
                        <motion.div
                            key={branch.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            whileHover={{ y: -5 }}
                            className="group relative bg-white/[0.03] backdrop-blur-3xl border border-white/10 hover:border-primary/50 rounded-[3rem] p-10 shadow-3xl hover:shadow-primary/10 transition-all duration-500 flex flex-col min-h-[400px]"
                        >
                            <div className="flex justify-between items-start mb-10">
                                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-2xl border transition-all ${branch.is_main_branch ? 'bg-primary/10 text-primary border-primary/30' : 'bg-white/5 text-white/20 border-white/10 group-hover:bg-primary/5 group-hover:text-primary group-hover:border-primary/20'}`}>
                                    <SchoolIcon className="w-8 h-8" />
                                </div>
                                <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                    <button onClick={() => handleOpenEdit(branch)} className="w-10 h-10 bg-white/5 hover:bg-white hover:text-black rounded-xl flex items-center justify-center transition-all border border-white/10"><EditIcon className="w-4 h-4" /></button>
                                    {!branch.is_main_branch && (
                                        <button onClick={() => setDeletingBranch(branch)} className="w-10 h-10 bg-white/5 hover:bg-red-500 hover:text-white rounded-xl flex items-center justify-center transition-all border border-white/10"><XIcon className="w-4 h-4" /></button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4 mb-8">
                                <h3 className="text-2xl font-serif font-black text-white truncate leading-none">{branch.name}</h3>
                                <div className="flex items-center gap-3 text-white/30 text-[10px] font-black uppercase tracking-widest">
                                    <LocationIcon className="w-4 h-4 text-primary" />
                                    <span className="truncate">{[branch.city, branch.state].filter(Boolean).join(' • ')}</span>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-3 mb-10">
                                {branch.is_main_branch ? (
                                    <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-[0.2em] border border-primary/20 shadow-lg shadow-primary/10">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                        Primary Node
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/5 text-white/30 text-[9px] font-black uppercase tracking-[0.2em] border border-white/10">
                                        Satellite Instance
                                    </span>
                                )}
                            </div>

                            <div className="mt-auto pt-10 border-t border-white/5 flex items-center gap-5">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-primary flex items-center justify-center text-white text-sm font-black shadow-2xl">
                                    {branch.admin_name ? branch.admin_name.charAt(0) : '?'}
                                </div>
                                <div className="overflow-hidden space-y-1">
                                    <p className="text-[10px] font-black text-white uppercase tracking-widest truncate">{branch.admin_name || 'Protocol Admin'}</p>
                                    <p className="text-[9px] text-white/30 font-bold tracking-tight truncate">{branch.admin_email || 'PENDING SYNC'}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}

                    <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.02 }}
                        whileActive={{ scale: 0.98 }}
                        onClick={() => handleOpenCreate()}
                        className="flex flex-col items-center justify-center p-10 rounded-[3rem] border-2 border-dashed border-white/10 hover:border-primary/50 hover:bg-white/[0.02] transition-all group min-h-[400px] relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-20 h-20 rounded-[2rem] bg-white/5 group-hover:bg-primary group-hover:text-white flex items-center justify-center text-white/20 transition-all duration-500 mb-6 shadow-2xl border border-white/10 group-hover:border-primary group-hover:rotate-90">
                            <PlusIcon className="w-10 h-10" />
                        </div>
                        <span className="font-black text-[11px] text-white/30 group-hover:text-white uppercase tracking-[0.4em] transition-colors relative z-10">Expand Network Reach</span>
                    </motion.button>
                </div>
            )}

            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl" onClick={() => setIsModalOpen(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-[#0c0d0e] w-full max-w-4xl rounded-[4rem] shadow-3xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}
                        >
                            <div className="px-16 py-12 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                                <div className="space-y-2">
                                    <h3 className="text-4xl font-serif font-black text-white tracking-tighter uppercase leading-none">
                                        {editingBranch ? 'Edit Node config' : (branches.length === 0 ? 'Initialize Primary' : 'Deploy Instance')}
                                    </h3>
                                    <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Protocol Specification & Credentials</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="w-14 h-14 rounded-full bg-white/5 hover:bg-white hover:text-black flex items-center justify-center transition-all border border-white/10 text-white/40">
                                    <XIcon className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="flex flex-col flex-grow overflow-hidden relative">
                                <div className="flex-grow overflow-y-auto p-16 space-y-16 custom-scrollbar">
                                    {modalError && (
                                        <motion.div initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="bg-red-500/10 text-red-500 p-8 rounded-[2.5rem] text-[10px] font-black uppercase tracking-[0.2em] border border-red-500/20 flex items-center gap-6">
                                            <XIcon className="w-6 h-6" /> {modalError}
                                        </motion.div>
                                    )}

                                    <div className="space-y-10">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                                <SchoolIcon className="w-5 h-5 text-primary" />
                                            </div>
                                            <h4 className="text-[11px] font-black uppercase text-white/30 tracking-[0.4em]">Campus Architecture</h4>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                            <div className="md:col-span-2">
                                                <FloatingLabelInput
                                                    label="Canonical Branch Name"
                                                    value={formData.name}
                                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                    required
                                                    icon={<SchoolIcon className="w-4 h-4" />}
                                                    className="!bg-white/[0.03]"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <FloatingLabelInput
                                                    label="Spatial Coordinates (Street Address)"
                                                    value={formData.address}
                                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                                    required
                                                    icon={<LocationIcon className="w-4 h-4" />}
                                                    className="!bg-white/[0.03]"
                                                    action={
                                                        <button
                                                            type="button"
                                                            onClick={handleResolveAddress}
                                                            disabled={isResolvingAddress || !formData.address.trim()}
                                                            className="w-10 h-10 flex items-center justify-center text-primary bg-primary/5 hover:bg-primary/20 rounded-xl transition-all disabled:opacity-30 border border-primary/20"
                                                        >
                                                            {isResolvingAddress ? <Spinner size="sm" /> : <SparklesIcon className="w-5 h-5" />}
                                                        </button>
                                                    }
                                                />
                                            </div>

                                            <StyledSelect label="Jurisdictional Origin" required value={formData.country} onChange={handleCountryChange} icon={<GlobeIcon className="w-4 h-4" />} className="!bg-white/[0.03]">
                                                {countries.map(c => <option key={c} value={c}>{c}</option>)}
                                            </StyledSelect>

                                            <StyledSelect label="State / Province" required value={formData.state} onChange={handleStateChange} disabled={!formData.country} icon={<LocationIcon className="w-4 h-4" />} className="!bg-white/[0.03]">
                                                <option value="">Select State</option>
                                                {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
                                            </StyledSelect>

                                            {availableCities.length > 0 ? (
                                                <StyledSelect className="md:col-span-2 !bg-white/[0.03]" label="Metropolitan Node" required value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} disabled={!formData.state} icon={<LocationIcon className="w-4 h-4" />}>
                                                    <option value="">Select City</option>
                                                    {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                                                </StyledSelect>
                                            ) : (
                                                <FloatingLabelInput className="md:col-span-2 !bg-white/[0.03]" label="City" required value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} disabled={!formData.state} icon={<LocationIcon className="w-4 h-4" />} />
                                            )}
                                        </div>
                                    </div>

                                    <div className="h-px bg-white/5 w-full"></div>

                                    <div className="space-y-10">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                                                <UsersIcon className="w-5 h-5 text-indigo-500" />
                                            </div>
                                            <h4 className="text-[11px] font-black uppercase text-white/30 tracking-[0.4em]">Node Command Credentials</h4>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                            <FloatingLabelInput label="Administrative ID" value={formData.adminName} onChange={e => setFormData({ ...formData, adminName: e.target.value })} icon={<UsersIcon className="w-4 h-4" />} className="!bg-white/[0.03]" />
                                            <FloatingLabelInput label="Protocol Comm Link" type="tel" value={formData.adminPhone} onChange={e => setFormData({ ...formData, adminPhone: e.target.value })} icon={<PhoneIcon className="w-4 h-4" />} className="!bg-white/[0.03]" />
                                            <div className="md:col-span-2"><FloatingLabelInput label="Canonical Auth Email" type="email" required value={formData.adminEmail} onChange={e => setFormData({ ...formData, adminEmail: e.target.value })} icon={<MailIcon className="w-4 h-4" />} className="!bg-white/[0.03]" /></div>
                                        </div>
                                    </div>

                                    {isHeadOfficeAdmin && (
                                        <div
                                            className={`flex items-start gap-6 p-8 rounded-[2.5rem] border transition-all cursor-pointer ${formData.isMain ? 'bg-primary/10 border-primary/50 shadow-2xl shadow-primary/10' : 'bg-white/[0.03] border-white/10 hover:border-primary/30'}`}
                                            onClick={() => setFormData({ ...formData, isMain: !formData.isMain })}
                                        >
                                            <div className={`mt-1 w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all ${formData.isMain ? 'bg-primary border-primary shadow-lg shadow-primary/30' : 'bg-transparent border-white/20'}`}>
                                                {formData.isMain && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                            </div>
                                            <div className="space-y-2">
                                                <p className="font-black text-[11px] text-white uppercase tracking-[0.2em]">Institutional Command Center</p>
                                                <p className="text-xs text-white/30 font-medium leading-relaxed">Designate this branch as the primary headquarters for your entire network registry.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-12 border-t border-white/5 bg-white/[0.01] flex justify-end gap-10">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-10 py-5 text-[10px] font-black uppercase tracking-[0.4em] text-white/30 hover:text-white transition-all">Abort</button>
                                    <button type="submit" disabled={isSaving} className="px-16 py-5 bg-white text-black rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.3em] hover:bg-primary hover:text-white transition-all shadow-3xl flex items-center min-w-[200px] justify-center active:scale-95 group">
                                        {isSaving ? <Spinner size="sm" /> : (
                                            <div className="flex items-center gap-3">
                                                {editingBranch ? 'Commit Changes' : 'Execute Deployment'}
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity">&rarr;</span>
                                            </div>
                                        )}
                                    </button>
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
                message={`Are you sure you want to permanently deconstruct the "${deletingBranch?.name}" branch from the registry? Partitioned data will be irrecoverable.`}
                confirmText="Yes, Execute Deconstruction"
                loading={isDeleting}
            />
        </div>
    );
};