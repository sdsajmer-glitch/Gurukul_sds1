import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Role, BuiltInRoles, UserProfile } from '../types';
import { supabase, formatError } from '../services/supabase';
import Spinner from './common/Spinner';
import SchoolAdminForm from './profile_forms/SchoolAdminForm';
import ParentForm from './profile_forms/ParentForm';
import StudentForm from './profile_forms/StudentForm';
import TeacherForm from './profile_forms/TeacherForm';
import { UserIcon } from './icons/UserIcon';
import { PhoneIcon } from './icons/PhoneIcon';
import { ShieldCheckIcon } from './icons/ShieldCheckIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { XIcon } from './icons/XIcon';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon';
import { motion, AnimatePresence } from 'framer-motion';
import PremiumFloatingInput from './common/PremiumFloatingInput';

interface ProfileCreationPageProps {
    profile: UserProfile;
    role: Role;
    onComplete: () => void;
    onBack: () => void;
    showBackButton: boolean;
}

export const ProfileCreationPage: React.FC<ProfileCreationPageProps> = ({ profile, role, onComplete, onBack, showBackButton }) => {
    const [formData, setFormData] = useState<any>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isFetchingInitialData, setIsFetchingInitialData] = useState(true);
    const [activeTab, setActiveTab] = useState<'details' | 'contact'>('details');

    const isMounted = useRef(true);
    useEffect(() => { return () => { isMounted.current = false; }; }, []);

    const fetchExistingProfileData = useCallback(async () => {
        if (!isMounted.current) return;
        setIsFetchingInitialData(true);

        try {
            let tableName = '';
            switch (role) {
                case BuiltInRoles.SCHOOL_ADMINISTRATION: tableName = 'school_admin_profiles'; break;
                case BuiltInRoles.PARENT_GUARDIAN: tableName = 'parent_profiles'; break;
                case BuiltInRoles.TEACHER: tableName = 'teacher_profiles'; break;
                case BuiltInRoles.STUDENT: tableName = 'student_profiles'; break;
            }

            let fetchedData: any = {};
            if (tableName) {
                const { data, error } = await supabase.from(tableName).select('*').eq('user_id', profile.id).maybeSingle();
                if (error) {
                    console.error("Error fetching usage profile:", error);
                    // Don't throw, just ignore and let user create new
                }
                if (data) fetchedData = data;
            }

            if (isMounted.current) {
                setFormData({
                    ...fetchedData,
                    phone: profile.phone || '',
                    display_name: profile.display_name || '',
                    email: profile.email || '',
                    country: fetchedData.country || 'India'
                });
            }
        } catch (error) {
            console.error("Critical error in profile fetch:", error);
        } finally {
            if (isMounted.current) {
                setIsFetchingInitialData(false);
            }
        }
    }, [role, profile.id, profile.display_name, profile.phone, profile.email]);

    useEffect(() => { fetchExistingProfileData(); }, [fetchExistingProfileData]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };

    const isFormValid = useMemo(() => {
        if (!formData.display_name?.trim()) return false;
        if (role === BuiltInRoles.PARENT_GUARDIAN && !formData.relationship_to_student) return false;
        return true;
    }, [formData, role]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid) {
            setError("Mandatory identity parameters are missing.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            if (role === BuiltInRoles.TEACHER) {
                const { error: tError } = await supabase.rpc('upsert_teacher_profile', {
                    p_user_id: profile.id,
                    p_display_name: formData.display_name,
                    p_email: profile.email,
                    p_phone: formData.phone,
                    p_department: formData.department,
                    p_designation: formData.designation,
                    p_subject: formData.subject,
                    p_qualification: formData.qualification,
                    p_experience: Number(formData.experience_years) || 0,
                    p_doj: formData.date_of_joining || new Date().toISOString().split('T')[0]
                });
                if (tError) throw tError;
            } else if (role === BuiltInRoles.PARENT_GUARDIAN) {
                const { error: pError } = await supabase.from('parent_profiles').upsert({
                    user_id: profile.id,
                    relationship_to_student: formData.relationship_to_student,
                    gender: formData.gender,
                    number_of_children: Number(formData.number_of_children) || 1,
                    address: formData.address,
                    city: formData.city,
                    state: formData.state,
                    country: formData.country,
                    pin_code: formData.pin_code
                });
                if (pError) throw pError;
            } else if (role === BuiltInRoles.SCHOOL_ADMINISTRATION) {
                const { error: sError } = await supabase.from('school_admin_profiles').upsert({
                    user_id: profile.id,
                    school_name: formData.school_name,
                    address: formData.address,
                    city: formData.city,
                    state: formData.state,
                    country: formData.country,
                    admin_contact_name: formData.admin_contact_name,
                    admin_contact_phone: formData.admin_contact_phone,
                    onboarding_step: 'pricing'
                });
                if (sError) throw sError;
            }

            const { error: profileError } = await supabase.from('profiles').update({
                display_name: formData.display_name,
                phone: formData.phone,
                profile_completed: role !== BuiltInRoles.SCHOOL_ADMINISTRATION,
                role: role
            }).eq('id', profile.id);

            if (profileError) throw profileError;

            if (isMounted.current) {
                setLoading(false);
                onComplete();
            }
        } catch (err: any) {
            if (isMounted.current) {
                setError(formatError(err));
                setLoading(false);
            }
        }
    };

    if (isFetchingInitialData) return <div className="flex justify-center p-20"><Spinner size="lg" /></div>;

    return (
        <div className="w-full max-w-4xl mx-auto space-y-12 pb-32 font-sans relative">
            {/* Ambient Ambient Background Atmosphere */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
                <div className="absolute -top-1/4 -left-1/4 w-[1000px] h-[1000px] bg-primary/5 rounded-full blur-[150px]" />
                <div className="absolute top-1/2 -right-1/4 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[130px]" />
            </div>

            {/* Profile Header Block - Cinematic Elevation */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="relative bg-[#0f111a]/80 backdrop-blur-3xl rounded-[3rem] overflow-hidden border border-white/5 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] group"
            >
                {/* Decorative Surface Layer */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />

                <div className="relative px-8 md:px-12 pb-12 pt-24">
                    <div className="flex flex-col md:flex-row items-center md:items-end gap-10 md:gap-14">
                        {/* Avatar Node */}
                        <motion.div
                            whileHover={{ scale: 1.05, rotate: 2 }}
                            className="relative group cursor-pointer"
                        >
                            <div className="w-44 h-44 rounded-[3.5rem] bg-gradient-to-br from-primary/30 via-primary/10 to-transparent p-[2px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">
                                <div className="w-full h-full rounded-[3.4rem] bg-[#0a0b10] flex items-center justify-center overflow-hidden relative">
                                    <span className="text-6xl font-black text-white/90 tracking-tighter glow-text">
                                        {formData?.display_name?.charAt(0) || 'U'}
                                    </span>
                                    <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                </div>
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-primary rounded-2xl flex items-center justify-center border-4 border-[#030407] shadow-xl">
                                <UserIcon className="w-5 h-5 text-white" />
                            </div>
                        </motion.div>

                        {/* Text Content */}
                        <div className="flex-grow text-center md:text-left space-y-4">
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-md"
                            >
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">{role?.replace('_', ' / ') || 'Identity Node'}</span>
                            </motion.div>

                            <motion.h1
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="text-5xl md:text-7xl font-black text-gradient leading-none tracking-tight pb-2"
                            >
                                {formData?.display_name || 'Protocol Node'}
                            </motion.h1>

                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                className="flex flex-wrap items-center justify-center md:justify-start gap-6 text-white/30 text-[11px] font-bold uppercase tracking-widest"
                            >
                                <span className="flex items-center gap-2">
                                    <span className="text-white/10 uppercase">Registry ID:</span>
                                    <span className="text-white/60 font-mono tracking-tighter">{profile.id.slice(0, 8).toUpperCase()}</span>
                                </span>
                                <span className="w-1 h-1 rounded-full bg-white/10" />
                                <span className="flex items-center gap-2 text-white/60">
                                    Encrypted Verification Secure Node
                                </span>
                            </motion.div>
                        </div>

                        {/* Step Indicator */}
                        <div className="hidden lg:flex flex-col items-end gap-3 pb-4">
                            <div className="flex gap-1.5">
                                <div className="w-10 h-1.5 rounded-full bg-primary glow-box" />
                                <div className="w-4 h-1.5 rounded-full bg-white/10" />
                                <div className="w-4 h-1.5 rounded-full bg-white/10" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Creation Protocol 1/3</span>
                        </div>
                    </div>
                </div>

                {/* Vertical Navigation Nodes - Restored & Polished */}
                <div className="px-12 border-t border-white/[0.03] flex items-center justify-between bg-black/20 backdrop-blur-3xl relative">
                    <div className="flex gap-12">
                        {[
                            { id: 'details', label: 'Core Registry' },
                            { id: 'contact', label: 'Contact & Node' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`py-10 text-[11px] font-black uppercase tracking-[0.3em] relative transition-all duration-700 group/tab ${activeTab === tab.id ? 'text-primary' : 'text-white/20 hover:text-white/60'}`}
                            >
                                <span className="relative z-10">{tab.label}</span>
                                {activeTab === tab.id && (
                                    <motion.div
                                        layoutId="activeTabIndicator"
                                        className="absolute bottom-0 left-0 w-full h-[4px] bg-primary rounded-t-full shadow-[0_0_40px_rgba(var(--primary),0.8)]"
                                    />
                                )}
                                <div className="absolute inset-0 bg-primary/5 scale-x-0 group-hover/tab:scale-x-100 transition-transform origin-left duration-500" />
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-4 text-white/20 font-black uppercase text-[9px] tracking-[0.4em]">
                        <span className="animate-pulse">Live Signal</span>
                        <div className="w-2 h-2 rounded-full bg-emerald-500/40" />
                    </div>
                </div>
            </motion.div>

            {error && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="premium-card p-10 border-red-500/20 bg-red-500/5 text-red-200 flex items-center gap-8 ring-1 ring-red-500/20"
                >
                    <div className="p-5 bg-red-500/20 rounded-3xl border border-red-500/30">
                        <XIcon className="w-8 h-8 text-red-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-red-400/60 mb-2">Protocol Exception Triggered</p>
                        <span className="text-base font-bold opacity-90 leading-tight block">{error}</span>
                    </div>
                </motion.div>
            )}

            <form onSubmit={handleSubmit} className="relative z-10">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="premium-card p-12 md:p-16 space-y-16 relative"
                    >
                        {/* Ambient Card Atmosphere */}
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

                        {role === BuiltInRoles.PARENT_GUARDIAN ? (
                            <ParentForm formData={formData} handleChange={handleFormChange} activeTab={activeTab} />
                        ) : role === BuiltInRoles.TEACHER ? (
                            <TeacherForm formData={formData} handleChange={handleFormChange} photoPreviewUrl={null} onPhotoChange={() => { }} currentUserId={profile.id} isRestrictedView={true} />
                        ) : role === BuiltInRoles.SCHOOL_ADMINISTRATION ? (
                            <SchoolAdminForm formData={formData} handleChange={handleFormChange} isInitialCreation={false} />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <PremiumFloatingInput label="Full Identity Name" name="display_name" value={formData.display_name} onChange={handleFormChange as any} icon={<UserIcon />} />
                                <PremiumFloatingInput label="Communication Node" name="phone" value={formData.phone} onChange={handleFormChange as any} icon={<PhoneIcon />} />
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* REDESIGNED ACTION ZONE: Fixed Desktop Action Bar */}
                <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-4xl z-[450]">
                    <motion.div
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                        className="p-4 bg-[#0a0b10]/95 backdrop-blur-[50px] border border-white/10 rounded-[3rem] shadow-[0_60px_100px_-20px_rgba(0,0,0,1)] ring-1 ring-white/20 flex items-center justify-between"
                    >
                        <div className="flex items-center min-w-[140px]">
                            {showBackButton ? (
                                <button
                                    type="button"
                                    onClick={onBack}
                                    className="group h-[72px] px-10 rounded-[2rem] text-[11px] font-black text-white/30 hover:text-white hover:bg-white/5 transition-all uppercase tracking-[0.4em] flex items-center gap-6"
                                >
                                    <ChevronLeftIcon className="w-5 h-5 transition-transform group-hover:-translate-x-2" />
                                    <span className="hidden sm:inline">Return</span>
                                </button>
                            ) : <div className="ml-10" />}
                        </div>

                        <div className="flex flex-col items-center gap-1.5 text-center">
                            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-primary glow-text">Verification Protocol Active</span>
                            <span className="text-[10px] font-bold text-white/20 tracking-wider">Identity node encryption: 4096-bit RSA</span>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={loading || !isFormValid}
                            className={`h-[76px] px-14 rounded-[2rem] font-black text-[15px] uppercase tracking-[0.3em] transition-all flex items-center gap-6 group relative overflow-hidden ${!isFormValid || loading
                                ? 'bg-white/5 text-white/10 cursor-not-allowed border border-white/5'
                                : 'bg-primary text-white shadow-[0_30px_60px_-10px_rgba(var(--primary),0.6)] hover:shadow-[0_40px_80px_-10px_rgba(var(--primary),0.8)]'
                                }`}
                        >
                            {loading ? (
                                <Spinner size="sm" className="text-white" />
                            ) : (
                                <>
                                    <span className="relative z-10">Complete Sync</span>
                                    <CheckCircleIcon className="w-6 h-6 transition-all group-hover:scale-125 group-hover:rotate-6 relative z-10" />
                                    {isFormValid && !loading && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                    )}
                                </>
                            )}
                        </motion.button>
                    </motion.div>
                </div>
            </form>

            {/* Bottom Footer Spacer */}
            <div className="h-80" />

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-center pb-20 opacity-30"
            >
                <div className="inline-flex items-center gap-5 px-10 py-4 rounded-3xl bg-[#0a0b10]/40 border border-white/5 shadow-inner">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse glow-box shadow-emerald-500/50" />
                    <p className="text-[11px] font-black tracking-[0.4em] text-white/60 uppercase">
                        End-to-End Encrypted Registry Access
                    </p>
                </div>
            </motion.div>
        </div>
    );
};
