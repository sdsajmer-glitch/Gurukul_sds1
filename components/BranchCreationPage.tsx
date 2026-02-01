
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

interface BranchCreationPageProps {
    onNext?: () => void;
    profile?: UserProfile;
    onBack?: () => void;
    hideHero?: boolean;
    initialBranch?: SchoolBranch | null;
}

const FloatingLabelInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string, icon?: React.ReactNode, action?: React.ReactNode }> = ({ label, icon, action, className, ...props }) => (
    <div className="relative group/input">
        <div className="absolute top-1/2 -translate-y-1/2 left-4 text-white/20 group-focus-within/input:text-primary transition-colors duration-200 z-10 pointer-events-none">
            {icon}
        </div>
        <input
            {...props}
            placeholder=" "
            className={`peer block w-full rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3.5 pl-11 ${action ? 'pr-12' : ''} text-sm text-foreground transition-all duration-200 hover:border-white/10 focus:border-primary/50 focus:bg-white/[0.04] focus:outline-none placeholder-transparent ${className}`}
        />
        <label className="absolute left-11 top-0 -translate-y-1/2 bg-[#0a0a0b] px-1.5 text-[9px] font-black uppercase tracking-widest text-primary transition-all duration-200 
            peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-xs peer-placeholder-shown:font-bold peer-placeholder-shown:text-white/20
            peer-focus:top-0 peer-focus:text-[9px] peer-focus:font-black peer-focus:text-primary pointer-events-none">
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
    <div className="relative group/select">
        <div className="absolute top-1/2 -translate-y-1/2 left-4 text-white/20 group-focus-within/select:text-primary transition-colors duration-200 z-10 pointer-events-none">
            {icon}
        </div>
        <select
            {...props}
            className={`peer block w-full appearance-none rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3.5 pl-11 text-sm text-foreground transition-all duration-200 hover:border-white/10 focus:border-primary/50 focus:bg-white/[0.04] focus:outline-none cursor-pointer ${className}`}
        >
            {children}
        </select>
        <label className="absolute left-11 top-0 -translate-y-1/2 bg-[#0a0a0b] px-1.5 text-[9px] font-black uppercase tracking-widest text-primary transition-all duration-200 pointer-events-none">
            {label}
        </label>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/20 group-hover/select:text-white/40 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </div>
    </div>
);

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
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
            const prompt = `Based on the street address "${formData.address}", identify the city, state, and country. 
            Output ONLY strictly as a valid JSON object: {"city": "string", "state": "string", "country": "string"}.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
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
            setModalError("Unable to auto-fill details. Please enter manually.");
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

    const renderForm = () => (
        <form onSubmit={handleSave} className="space-y-8 animate-in fade-in duration-300">
            {modalError && (
                <div className="bg-red-500/10 text-red-500 p-4 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-500/20 flex items-center gap-3">
                    <XIcon className="w-4 h-4" /> {modalError}
                </div>
            )}

            <div className="space-y-10">
                {/* Campus Information */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                        <SchoolIcon className="w-4 h-4 text-primary" />
                        <h4 className="text-[10px] font-black uppercase text-white/40 tracking-[0.3em]">Node Architecture</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <FloatingLabelInput
                                label="Campus Designation"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                                icon={<SchoolIcon className="w-4 h-4" />}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <FloatingLabelInput
                                label="Geo-location Address"
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                required
                                icon={<LocationIcon className="w-4 h-4" />}
                                action={
                                    <button
                                        type="button"
                                        onClick={handleResolveAddress}
                                        disabled={isResolvingAddress || !formData.address.trim()}
                                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-30"
                                        title="Resolve Location"
                                    >
                                        {isResolvingAddress ? <Spinner size="sm" /> : <SparklesIcon className="w-5 h-5" />}
                                    </button>
                                }
                            />
                        </div>

                        <StyledSelect label="Jurisdiction" required value={formData.country} onChange={handleCountryChange} icon={<GlobeIcon className="w-4 h-4" />}>
                            {countries.map(c => <option key={c} value={c}>{c}</option>)}
                        </StyledSelect>

                        <StyledSelect label="Administrative State" required value={formData.state} onChange={handleStateChange} disabled={!formData.country} icon={<LocationIcon className="w-4 h-4" />}>
                            <option value="">Select State</option>
                            {availableStates.map(s => <option key={s} value={s}>{s}</option>)}
                        </StyledSelect>

                        {availableCities.length > 0 ? (
                            <StyledSelect className="md:col-span-2" label="Sync City" required value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} disabled={!formData.state} icon={<LocationIcon className="w-4 h-4" />}>
                                <option value="">Select City</option>
                                {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                            </StyledSelect>
                        ) : (
                            <FloatingLabelInput className="md:col-span-2" label="Sync City" required value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} disabled={!formData.state} icon={<LocationIcon className="w-4 h-4" />} />
                        )}
                    </div>
                </div>

                {/* Administrator Credentials */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                        <UsersIcon className="w-4 h-4 text-primary" />
                        <h4 className="text-[10px] font-black uppercase text-white/40 tracking-[0.3em]">Access Authority</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FloatingLabelInput label="Administrator Identity" value={formData.adminName} onChange={e => setFormData({ ...formData, adminName: e.target.value })} icon={<UsersIcon className="w-4 h-4" />} />
                        <FloatingLabelInput label="Secure Contact" type="tel" value={formData.adminPhone} onChange={e => setFormData({ ...formData, adminPhone: e.target.value })} icon={<PhoneIcon className="w-4 h-4" />} />
                        <div className="md:col-span-2">
                            <FloatingLabelInput label="Protocol Email" type="email" required value={formData.adminEmail} onChange={e => setFormData({ ...formData, adminEmail: e.target.value })} icon={<MailIcon className="w-4 h-4" />} />
                        </div>
                    </div>
                </div>

                {isHeadOfficeAdmin && (
                    <div
                        className={`flex items-start gap-4 p-5 rounded-2xl border transition-all cursor-pointer ${formData.isMain ? 'bg-primary/5 border-primary/20 shadow-[0_0_30px_rgba(var(--primary),0.05)]' : 'bg-white/[0.02] border-white/10 hover:border-white/20'}`}
                        onClick={() => setFormData({ ...formData, isMain: !formData.isMain })}
                    >
                        <div className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${formData.isMain ? 'bg-primary border-primary' : 'bg-black border-white/20'}`}>
                            {formData.isMain && <CheckCircleIcon className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div>
                            <p className="font-black text-[10px] uppercase tracking-widest text-white">Central Authority Node</p>
                            <p className="text-[10px] text-white/30 font-medium mt-1 uppercase tracking-tight">Designate as Primary Institutional Headquarters</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="pt-6 flex justify-end gap-4 border-t border-white/5">
                <button type="button" onClick={onBack} className="px-6 py-3 text-[10px] font-black text-white/40 uppercase tracking-widest hover:text-white transition-colors">Discard</button>
                <button type="submit" disabled={isSaving} className="px-10 py-3.5 bg-primary text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:shadow-lg hover:shadow-primary/10 transition-all flex items-center min-w-[160px] justify-center gap-3">
                    {isSaving ? <Spinner size="sm" /> : (editingBranch ? 'Update Node' : 'Initialize Node')}
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
                <div className="fixed inset-0 bg-black/80 backdrop-blur-3xl z-50 flex items-center justify-center p-6" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-[#0a0a0b] w-full max-w-3xl rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-10 py-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight italic">Initialize <span className="text-white/20 not-italic">Node</span></h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 text-white/20 hover:text-white"><XIcon className="w-6 h-6" /></button>
                        </div>
                        <div className="p-10 max-h-[80vh] overflow-y-auto custom-scrollbar">
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