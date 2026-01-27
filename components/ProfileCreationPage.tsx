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
                    onboarding_step: 'completed'
                });
                if (sError) throw sError;
            }

            const { error: profileError } = await supabase.from('profiles').update({
                display_name: formData.display_name,
                phone: formData.phone,
                profile_completed: true,
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
        <div className="w-full max-w-2xl mx-auto space-y-10 pb-32 font-sans relative">
            {/* Ambient Background Glows */}
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute top-1/2 -right-24 w-80 h-80 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative bg-slate-900/60 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden border border-white/5 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] group"
            >
                {/* Decorative Pattern Layer */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />

                <div className="p-10 md:p-12 flex flex-col items-center relative z-10">
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="relative mb-8"
                    >
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse-slow" />
                        <div className="w-28 h-28 rounded-full bg-gradient-to-b from-white/10 to-transparent border border-white/10 flex items-center justify-center text-4xl font-bold text-white shadow-2xl relative z-10 group/avatar overflow-hidden">
                            <span className="relative z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                                {(formData.display_name || 'U').charAt(0).toUpperCase()}
                            </span>
                            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-500" />
                            {/* Subtle Shimmer Effect */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover/avatar:translate-x-full transition-transform duration-1000" />
                        </div>
                    </motion.div>

                    <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight text-center bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                        {formData.display_name || 'New Identity'}
                    </h2>

                    <div className="flex items-center gap-3 px-4 py-1.5 bg-primary/10 rounded-full border border-primary/20 mt-5 backdrop-blur-md shadow-lg shadow-primary/5 transition-all hover:bg-primary/20 cursor-default">
                        <ShieldCheckIcon className="w-3.5 h-3.5 text-primary" />
                        <span className="text-primary text-[10px] font-black uppercase tracking-[0.25em]">
                            {role}
                        </span>
                    </div>
                </div>

                <div className="px-10 border-t border-white/5 flex justify-center gap-12 bg-black/40 backdrop-blur-md">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`py-5 text-[11px] font-bold uppercase tracking-widest relative transition-all duration-300 group/tab ${activeTab === 'details' ? 'text-primary' : 'text-white/20 hover:text-white/50'}`}
                    >
                        <span className="relative z-10">Core Registry</span>
                        {activeTab === 'details' && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 w-full h-[3px] bg-primary rounded-t-full shadow-[0_0_20px_rgba(var(--primary),0.8)]"
                            />
                        )}
                        <div className="absolute bottom-0 left-0 w-full h-0 bg-primary/10 group-hover/tab:h-full transition-all duration-300 rounded-lg -z-10" />
                    </button>
                    <button
                        onClick={() => setActiveTab('contact')}
                        className={`py-5 text-[11px] font-bold uppercase tracking-widest relative transition-all duration-300 group/tab ${activeTab === 'contact' ? 'text-primary' : 'text-white/20 hover:text-white/50'}`}
                    >
                        <span className="relative z-10">Contact & Node</span>
                        {activeTab === 'contact' && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 w-full h-[3px] bg-primary rounded-t-full shadow-[0_0_20px_rgba(var(--primary),0.8)]"
                            />
                        )}
                        <div className="absolute bottom-0 left-0 w-full h-0 bg-primary/10 group-hover/tab:h-full transition-all duration-300 rounded-lg -z-10" />
                    </button>
                </div>
            </motion.div>

            {error && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-red-500/10 border border-red-500/20 text-red-500 p-6 rounded-3xl flex items-center gap-5 shadow-2xl backdrop-blur-xl"
                >
                    <div className="p-2 bg-red-500/20 rounded-full">
                        <XIcon className="w-5 h-5 shrink-0" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-0.5">Configuration Error</p>
                        <span className="text-xs font-bold">{error}</span>
                    </div>
                </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-12">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.4, ease: "easeInOut" }}
                        className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-10 md:p-12 shadow-[0_40px_80px_-32px_rgba(0,0,0,0.5)] space-y-10 relative overflow-hidden"
                    >
                        {/* Internal Form Mesh Gradient */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

                        {role === BuiltInRoles.PARENT_GUARDIAN ? (
                            <ParentForm formData={formData} handleChange={handleFormChange} activeTab={activeTab} />
                        ) : role === BuiltInRoles.TEACHER ? (
                            <TeacherForm formData={formData} handleChange={handleFormChange} photoPreviewUrl={null} onPhotoChange={() => { }} currentUserId={profile.id} isRestrictedView={true} />
                        ) : role === BuiltInRoles.SCHOOL_ADMINISTRATION ? (
                            <SchoolAdminForm formData={formData} handleChange={handleFormChange} isInitialCreation={false} />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <FloatingPremiumInput label="Full Legal Name" name="display_name" value={formData.display_name} onChange={handleFormChange} icon={<UserIcon className="w-4 h-4" />} />
                                <FloatingPremiumInput label="Contact Number" name="phone" value={formData.phone} onChange={handleFormChange} icon={<PhoneIcon className="w-4 h-4" />} />
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-10 mt-12 px-4">
                    {showBackButton ? (
                        <button
                            type="button"
                            onClick={onBack}
                            className="group text-[11px] font-black text-white/20 hover:text-primary transition-all uppercase tracking-[0.3em] flex items-center gap-4 py-2"
                        >
                            <div className="p-2 bg-white/5 rounded-full group-hover:bg-primary/10 transition-colors">
                                <ChevronLeftIcon className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                            </div>
                            Return to Selection
                        </button>
                    ) : <div />}

                    <motion.button
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={loading || !isFormValid}
                        className={`h-[60px] px-12 rounded-2xl font-black text-[13px] uppercase tracking-[0.2em] transition-all flex items-center gap-4 group relative overflow-hidden ${!isFormValid || loading
                            ? 'bg-white/5 text-white/10 cursor-not-allowed border border-white/5'
                            : 'bg-primary text-primary-foreground shadow-[0_20px_40px_-12px_rgba(var(--primary),0.5)]'
                            }`}
                    >
                        {loading ? (
                            <Spinner size="sm" className="text-white" />
                        ) : (
                            <>
                                <CheckCircleIcon className="w-5 h-5 transition-transform group-hover:scale-110" />
                                <span className="relative z-10">Complete Setup</span>
                                {!loading && isFormValid && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                )}
                            </>
                        )}
                    </motion.button>
                </div>
            </form>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ delay: 1 }}
                className="text-center py-8"
            >
                <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-2xl bg-white/5 border border-white/5">
                    <ShieldCheckIcon className="w-4 h-4 text-emerald-500" />
                    <p className="text-[11px] font-bold tracking-widest text-white/60 uppercase">
                        End-to-End Encrypted Verification Node
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

const FloatingPremiumInput = ({ label, icon, ...props }: any) => (
    <div className="relative group w-full">
        <div className="absolute top-1/2 -translate-y-1/2 left-4 text-white/20 group-focus-within:text-primary transition-colors duration-300 z-10 pointer-events-none">{icon}</div>
        <input
            {...props}
            placeholder=" "
            className="peer block w-full h-[48px] rounded-xl border border-white/10 bg-black/20 px-5 pl-12 text-[15px] text-white font-medium focus:ring-4 focus:ring-primary/5 focus:border-primary/40 transition-all outline-none"
        />
        <label className="absolute left-12 top-0 -translate-y-1/2 bg-slate-900/90 px-1.5 text-[10px] font-bold uppercase text-white/30 tracking-[0.2em] peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-[14px] peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-focus:top-0 peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:text-primary transition-all duration-300 pointer-events-none">
            {label}
        </label>
    </div>
);