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

        let tableName = '';
        switch (role) {
            case BuiltInRoles.SCHOOL_ADMINISTRATION: tableName = 'school_admin_profiles'; break;
            case BuiltInRoles.PARENT_GUARDIAN: tableName = 'parent_profiles'; break;
            case BuiltInRoles.TEACHER: tableName = 'teacher_profiles'; break;
            case BuiltInRoles.STUDENT: tableName = 'student_profiles'; break;
        }

        let fetchedData: any = {};
        if (tableName) {
            const { data } = await supabase.from(tableName).select('*').eq('user_id', profile.id).maybeSingle();
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
            setIsFetchingInitialData(false);
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

    if (isFetchingInitialData) return <div className="flex justify-center p-20"><Spinner size="lg" className="text-primary" /></div>;

    const roleLabels: Record<string, string> = {
        [BuiltInRoles.SCHOOL_ADMINISTRATION]: 'Institutional Command',
        [BuiltInRoles.PARENT_GUARDIAN]: 'Guardian Proxy',
        [BuiltInRoles.TEACHER]: 'Faculty Hub',
        [BuiltInRoles.STUDENT]: 'Scholar Portal'
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-12 pb-32">

            {/* Identity Header Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative bg-white/[0.03] backdrop-blur-[40px] rounded-[3rem] overflow-hidden border border-white/10 shadow-3xl"
            >
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] -mr-32 -mt-32" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 blur-[100px] -ml-32 -mb-32" />

                <div className="p-10 md:p-16 flex flex-col md:flex-row items-center gap-10 md:gap-16 relative z-10">
                    <motion.div
                        whileHover={{ scale: 1.05, rotate: 5 }}
                        className="w-32 h-32 md:w-44 md:h-44 rounded-[2.5rem] bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center text-5xl font-serif font-black text-white shadow-2xl relative group"
                    >
                        <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
                        <span className="relative z-10">{(formData.display_name || 'U').charAt(0).toUpperCase()}</span>
                    </motion.div>

                    <div className="flex-grow text-center md:text-left space-y-6">
                        <div className="space-y-2">
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-primary font-black uppercase tracking-[0.4em] text-[10px]"
                            >
                                Establish Identity Node
                            </motion.p>
                            <h2 className="text-4xl md:text-6xl font-serif font-black text-white tracking-tighter leading-none">
                                {formData.display_name || 'Protocol Unknown'}
                            </h2>
                        </div>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                            <span className="px-5 py-2 bg-white/5 border border-white/10 rounded-full text-white/50 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                <ShieldCheckIcon className="w-3.5 h-3.5 text-primary" />
                                {roleLabels[role] || role}
                            </span>
                            <span className="px-5 py-2 bg-white/5 border border-white/10 rounded-full text-white/50 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Synchronized
                            </span>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="px-10 md:px-16 border-t border-white/10 flex gap-12 bg-black/20">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`py-8 text-[10px] font-black uppercase tracking-[0.3em] relative transition-all group ${activeTab === 'details' ? 'text-white' : 'text-white/30 hover:text-white/50'}`}
                    >
                        Core Registry
                        {activeTab === 'details' && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full shadow-[0_0_20px_rgba(var(--primary),0.8)]"
                            />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('contact')}
                        className={`py-8 text-[10px] font-black uppercase tracking-[0.3em] relative transition-all group ${activeTab === 'contact' ? 'text-white' : 'text-white/30 hover:text-white/50'}`}
                    >
                        Contact & Node
                        {activeTab === 'contact' && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full shadow-[0_0_20px_rgba(var(--primary),0.8)]"
                            />
                        )}
                    </button>
                </div>
            </motion.div>

            {error && (
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-red-500/10 border border-red-500/20 text-red-500 p-8 rounded-[2rem] flex items-center gap-6"
                >
                    <div className="w-12 h-12 bg-red-500/20 rounded-2xl flex items-center justify-center">
                        <XIcon className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-[0.2em]">{error}</span>
                </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-16">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="bg-white/[0.02] backdrop-blur-[20px] border border-white/5 rounded-[3.5rem] p-10 md:p-16 shadow-2xl relative overflow-hidden"
                    >
                        {/* Interactive Grid Background for Form */}
                        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '30px 30px' }} />

                        {role === BuiltInRoles.PARENT_GUARDIAN ? (
                            <ParentForm formData={formData} handleChange={handleFormChange} activeTab={activeTab} />
                        ) : role === BuiltInRoles.TEACHER ? (
                            <TeacherForm formData={formData} handleChange={handleFormChange} photoPreviewUrl={null} onPhotoChange={() => { }} currentUserId={profile.id} isRestrictedView={true} />
                        ) : role === BuiltInRoles.SCHOOL_ADMINISTRATION ? (
                            <SchoolAdminForm formData={formData} handleChange={handleFormChange} isInitialCreation={false} />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <FloatingPremiumInput label="Full Legal Name" name="display_name" value={formData.display_name} onChange={handleFormChange} icon={<UserIcon className="w-5 h-5" />} />
                                <FloatingPremiumInput label="Contact Number" name="phone" value={formData.phone} onChange={handleFormChange} icon={<PhoneIcon className="w-5 h-5" />} />
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* Submit Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-10">
                    {showBackButton ? (
                        <button
                            type="button"
                            onClick={onBack}
                            disabled={loading}
                            className="group text-[10px] font-black text-white/30 hover:text-white transition-all uppercase tracking-[0.3em] flex items-center gap-4 disabled:opacity-20"
                        >
                            <ChevronLeftIcon className="w-5 h-5 transition-transform group-hover:-translate-x-2" />
                            Return to Selection
                        </button>
                    ) : <div />}

                    <button
                        type="submit"
                        disabled={loading || !isFormValid}
                        className={`
                            h-20 px-16 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.3em] transition-all flex items-center gap-4 group relative overflow-hidden
                            ${!isFormValid || loading
                                ? 'bg-white/5 text-white/10 cursor-not-allowed border border-white/5'
                                : 'bg-primary text-white shadow-[0_20px_50px_rgba(139,92,246,0.3)] hover:scale-105 active:scale-95 hover:shadow-primary/50'
                            }
                        `}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                        {loading ? <Spinner size="sm" className="text-white" /> : <><CheckCircleIcon className="w-5 h-5" /> Finalize Node Initialization</>}
                    </button>
                </div>
            </form>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-center py-10"
            >
                <div className="inline-flex items-center gap-3 px-8 py-3 bg-white/5 rounded-full border border-white/10">
                    <ShieldCheckIcon className="w-4 h-4 text-primary" />
                    <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">
                        Encryption Protocol: AES-256 Bit Shared Identity Key
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