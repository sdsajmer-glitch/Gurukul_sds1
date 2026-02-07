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
import { LockIcon } from './icons/LockIcon';
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
    const [saving, setSaving] = useState(false); // Changed from loading to saving
    const [isDirty, setIsDirty] = useState(false);
    const [isStrictReadOnly, setIsStrictReadOnly] = useState(false);

    useEffect(() => {
        const checkIdentityContext = async () => {
            if (role !== BuiltInRoles.PARENT_GUARDIAN) return;

            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // Check for existence in school_admin_profiles - this is the source of truth for administrative identity
                const { data, error } = await supabase
                    .from('school_admin_profiles')
                    .select('user_id')
                    .eq('user_id', user.id)
                    .maybeSingle();

                // Source of Truth: Branch-based administrators are restricted from mutating Parent data
                // to prevent cross-node profile misuse. School-level administrators (those who
                // established the node with no branch assignment) retain mutation authority.
                if (!error && data && !!profile.branch_id) {
                    console.log('Branch-based administrative identity detected. Restricting Parent Portal mutation access.');
                    setIsStrictReadOnly(true);
                } else {
                    console.log('Identity verified: Administrative lock exempt or not detected.');
                    setIsStrictReadOnly(false);
                }
            } catch (e) {
                console.error('Identity handshake failed:', e);
            }
        };
        checkIdentityContext();
    }, [role]);

    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
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
            const data: any = {
                ...fetchedData,
                phone: profile.phone || fetchedData.phone || '',
                display_name: profile.display_name || fetchedData.display_name || '',
                email: profile.email || fetchedData.email || '',
                country: fetchedData.country || 'India'
            };

            // AUTO-FILL: School Admin specific contact details
            if (role === BuiltInRoles.SCHOOL_ADMINISTRATION) {
                data.admin_contact_name = data.admin_contact_name || profile.display_name || '';
                data.admin_designation = data.admin_designation || 'Director';
                data.admin_contact_email = data.admin_contact_email || profile.email || '';

                // Prioritize existing node phone over master profile phone for splitting
                const phoneToSplit = data.admin_contact_phone || profile.phone || '';
                if (phoneToSplit && !data.admin_contact_phone_local) {
                    const phoneStr = phoneToSplit;
                    if (phoneStr.startsWith('+')) {
                        // Simple split assumption: first 3 chars for code if it looks like +91
                        data.admin_contact_phone_country_code = phoneStr.slice(0, 3);
                        data.admin_contact_phone_local = phoneStr.slice(3);
                    } else {
                        data.admin_contact_phone_local = phoneStr;
                        data.admin_contact_phone_country_code = '+91';
                    }
                }

                // ACADEMIC DEFAULTS: Fast-track typical Indian school setups
                data.academic_board = data.academic_board || 'CBSE';
                data.school_type = data.school_type || 'Co-Educational';
                data.academic_year_start = data.academic_year_start || 'July';
                data.academic_year_end = data.academic_year_end || 'March';
                data.grade_range_start = data.grade_range_start || 'Pre-K';
                data.grade_range_end = data.grade_range_end || '12';
            }

            setFormData(data);
            setIsFetchingInitialData(false);
            setIsDirty(false); // Reset dirty state after fetching
        }
    }, [role, profile.id, profile.display_name, profile.phone, profile.email]);

    useEffect(() => { fetchExistingProfileData(); }, [fetchExistingProfileData]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
        setIsDirty(true); // Mark form as dirty on change
    };

    const isFormValid = useMemo(() => {
        if (role === BuiltInRoles.SCHOOL_ADMINISTRATION) {
            // Required fields for School Admin
            if (!formData.school_name?.trim()) return false;
            if (!formData.address?.trim()) return false;
            if (!formData.admin_contact_name?.trim()) return false;
            if (!formData.admin_contact_email?.trim()) return false;
            if (!formData.admin_contact_phone_local?.trim()) return false;
            if (!formData.academic_board?.trim()) return false;
            return true;
        }

        if (!formData.display_name?.trim()) return false;
        if (role === BuiltInRoles.PARENT_GUARDIAN && !formData.relationship_to_student) return false;
        return true;
    }, [formData, role]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('=== FORM SUBMISSION STARTED ===');
        console.log('Current formData:', formData);
        console.log('Current role:', role);

        if (isStrictReadOnly) {
            setError("Access Restricted: Administrative nodes cannot mutate Parent data from this portal.");
            return;
        }

        // Detailed validation with specific error messages
        if (role === BuiltInRoles.SCHOOL_ADMINISTRATION) {
            console.log('Validating School Admin fields...');

            if (!formData.school_name?.trim()) {
                console.error('Validation failed: school_name missing');
                setError("Institution Name is required");
                return;
            }
            if (!formData.address?.trim()) {
                console.error('Validation failed: address missing');
                setError("Street Address is required");
                return;
            }
            if (!formData.admin_contact_name?.trim()) {
                console.error('Validation failed: admin_contact_name missing');
                setError("Primary Administrator Name is required");
                return;
            }
            if (!formData.admin_contact_email?.trim()) {
                console.error('Validation failed: admin_contact_email missing');
                setError("Administrator Email is required");
                return;
            }
            if (!formData.admin_contact_phone_local?.trim()) {
                console.error('Validation failed: admin_contact_phone_local missing');
                setError("Administrator Phone Number is required");
                return;
            }
            if (!formData.academic_board?.trim()) {
                console.error('Validation failed: academic_board missing');
                setError("Education Board is required");
                return;
            }

            console.log('✅ All validations passed!');
        } else if (!isFormValid) {
            console.error('Validation failed: isFormValid is false');
            setError("Mandatory identity parameters are missing.");
            return;
        }

        console.log('Setting saving state...');
        setSaving(true); // Changed from setLoading to setSaving
        setError(null);
        setSuccess(null);

        try {
            const isEditMode = profile.profile_completed;
            console.log('Is Edit Mode:', isEditMode);
            console.log('Profile ID:', profile.id);

            if (role === BuiltInRoles.TEACHER) {
                console.log('Processing Teacher profile...');
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
                if (tError) {
                    console.error('Teacher profile error:', tError);
                    throw tError;
                }
                console.log('✅ Teacher profile saved');
            } else if (role === BuiltInRoles.PARENT_GUARDIAN) {
                console.log('Processing Parent profile...');
                const { error: pError } = await supabase.rpc('upsert_parent_profile', {
                    p_user_id: profile.id,
                    p_display_name: formData.display_name,
                    p_relationship: formData.relationship_to_student,
                    p_gender: formData.gender,
                    p_num_children: Number(formData.number_of_children) || 1,
                    p_address: formData.address,
                    p_city: formData.city,
                    p_state: formData.state,
                    p_country: formData.country,
                    p_pin_code: formData.pin_code,
                    p_secondary_parent_name: formData.secondary_parent_name || null,
                    p_secondary_parent_relationship: formData.secondary_parent_relationship || null,
                    p_secondary_parent_gender: formData.secondary_parent_gender || null,
                    p_secondary_parent_phone: formData.secondary_parent_phone || null,
                    p_secondary_parent_email: formData.secondary_parent_email || null
                });
                if (pError) {
                    console.error('Parent profile error:', pError);
                    throw pError;
                }
                console.log('✅ Parent profile saved');
            } else if (role === BuiltInRoles.STUDENT) {
                console.log('Processing Student profile...');
                const { error: stError } = await supabase.rpc('upsert_student_profile', {
                    p_user_id: profile.id,
                    p_display_name: formData.display_name,
                    p_grade: formData.grade,
                    p_gender: formData.gender,
                    p_dob: formData.date_of_birth || new Date().toISOString().split('T')[0]
                });
                if (stError) {
                    console.error('Student profile error:', stError);
                    throw stError;
                }
                console.log('✅ Student profile saved');
            } else if (role === BuiltInRoles.SCHOOL_ADMINISTRATION) {
                console.log('Processing School Admin profile...');
                console.log('Raw formData:', JSON.stringify(formData, null, 2));

                // Validate phone number construction
                const phoneCountryCode = formData.admin_contact_phone_country_code?.trim() || '+91';
                const phoneLocal = formData.admin_contact_phone_local?.trim() || '';

                if (!phoneLocal) {
                    console.error('Phone local number is empty!');
                    throw new Error('Administrator phone number is required');
                }

                const fullPhoneNumber = phoneCountryCode + phoneLocal;
                console.log('Constructed phone number:', fullPhoneNumber);

                // Store in formData.phone so it's accessible for profiles table update
                formData.phone = fullPhoneNumber;

                // Prepare complete payload with all fields - ensure no undefined values
                const payload: any = {
                    user_id: profile.id,
                    school_name: formData.school_name?.trim() || null,
                    address: formData.address?.trim() || null,
                    city: formData.city?.trim() || null,
                    state: formData.state?.trim() || null,
                    country: formData.country?.trim() || 'India',
                    admin_contact_name: formData.admin_contact_name?.trim() || null,
                    admin_designation: formData.admin_designation?.trim() || 'Director',
                    admin_contact_email: formData.admin_contact_email?.trim() || null,
                    admin_contact_phone: fullPhoneNumber,
                    academic_board: formData.academic_board?.trim() || null,
                    school_type: formData.school_type?.trim() || null,
                    academic_year_start: formData.academic_year_start?.trim() || null,
                    academic_year_end: formData.academic_year_end?.trim() || null,
                    grade_range_start: formData.grade_range_start?.trim() || null,
                    grade_range_end: formData.grade_range_end?.trim() || null,
                    onboarding_step: 'completed' // Mark as completed after profile creation
                };

                // Validate required fields are not null
                const requiredFields = ['school_name', 'address', 'admin_contact_name', 'admin_contact_email', 'admin_contact_phone', 'academic_board'];
                const missingFields = requiredFields.filter(field => !payload[field]);

                if (missingFields.length > 0) {
                    console.error('Missing required fields:', missingFields);
                    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
                }

                console.log('School Admin Payload (validated):', JSON.stringify(payload, null, 2));
                console.log('Attempting upsert with user_id:', profile.id);

                const { data: upsertData, error: sError } = await supabase
                    .from('school_admin_profiles')
                    .upsert(payload, {
                        onConflict: 'user_id'
                    })
                    .select();

                if (sError) {
                    console.error('❌ School Admin upsert error:', sError);
                    console.error('Error code:', sError.code);
                    console.error('Error message:', sError.message);
                    console.error('Error details:', sError.details);
                    console.error('Error hint:', sError.hint);
                    throw sError;
                }

                if (!upsertData || upsertData.length === 0) {
                    console.error('❌ Upsert returned no data');
                    throw new Error('Profile save failed - no data returned');
                }

                console.log('✅ School Admin profile saved successfully:', upsertData);
            } else if (role === BuiltInRoles.TRANSPORT_STAFF) {
                console.log('Processing Transport Staff profile...');
                const { error: trError } = await supabase.rpc('upsert_transport_profile', {
                    p_user_id: profile.id,
                    p_display_name: formData.display_name,
                    p_vehicle_details: formData.vehicle_details,
                    p_license_info: formData.license_info
                });
                if (trError) {
                    console.error('Transport profile error:', trError);
                    throw trError;
                }
                console.log('✅ Transport profile saved');
            } else if (role === BuiltInRoles.ECOMMERCE_OPERATOR) {
                console.log('Processing E-commerce profile...');
                const { error: ecError } = await supabase.rpc('upsert_ecommerce_profile', {
                    p_user_id: profile.id,
                    p_display_name: formData.display_name,
                    p_store_name: formData.store_name,
                    p_business_type: formData.business_type
                });
                if (ecError) {
                    console.error('E-commerce profile error:', ecError);
                    throw ecError;
                }
                console.log('✅ E-commerce profile saved');
            }

            // Sync the master profile completed status
            const finalDisplayName = role === BuiltInRoles.SCHOOL_ADMINISTRATION
                ? (formData.admin_contact_name || formData.display_name)
                : formData.display_name;

            // For school admins, use the constructed phone number. For others, use what's in formData.
            const finalPhone = role === BuiltInRoles.SCHOOL_ADMINISTRATION ? formData.phone : formData.phone;
            // Actually, for School Admin, formData.phone was just assigned fullPhoneNumber.
            // But let's be explicit and robust.
            const phoneToSync = role === BuiltInRoles.SCHOOL_ADMINISTRATION ? (formData.phone || '') : (formData.phone || '');

            console.log('Updating master profile...');
            console.log('Final display name:', finalDisplayName);
            console.log('Final phone number:', phoneToSync);
            console.log('Profile completed: true');

            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .update({
                    display_name: finalDisplayName,
                    phone: phoneToSync,
                    profile_completed: true,
                    role: role
                })
                .eq('id', profile.id)
                .select();

            if (profileError) {
                console.error('Profile update error:', profileError);
                throw profileError;
            }
            console.log('✅ Master profile updated:', profileData);

            if (isMounted.current) {
                console.log('Component still mounted, updating UI...');
                setSaving(false); // Changed from setLoading to setSaving
                setIsDirty(false); // Reset dirty state after successful save

                // Show success message
                setError(null);
                setSuccess(isEditMode ? "Profile metrics updated successfully" : "Setup protocol completed successfully");

                // Trigger parent update with a slight delay to allow the "Wow" animation to finish
                console.log('Scheduling onComplete()...');
                setTimeout(() => {
                    if (isMounted.current) {
                        if (onComplete) onComplete();
                        if (isEditMode) setSuccess(null);
                    }
                }, 2500);
            }

            console.log('=== FORM SUBMISSION COMPLETED SUCCESSFULLY ===');
        } catch (err: any) {
            console.error('=== FORM SUBMISSION ERROR ===');
            console.error('Error object:', err);
            console.error('Error message:', err.message);
            console.error('Error details:', err.details);
            console.error('Error hint:', err.hint);
            console.error('Error code:', err.code);

            if (isMounted.current) {
                setError(formatError(err));
                setSaving(false); // Changed from setLoading to setSaving
            }
        }
    };

    if (isFetchingInitialData) return <div className="flex justify-center p-20"><Spinner size="lg" /></div>;

    const isLimitedBranchAdmin = role === BuiltInRoles.SCHOOL_ADMINISTRATION && !!profile.branch_id;

    return (
        <div className="w-full max-w-2xl mx-auto space-y-8 pb-32 font-sans">
            {role !== BuiltInRoles.SCHOOL_ADMINISTRATION && (
                <div
                    className="relative bg-[#0a0a0b] overflow-hidden rounded-[2.5rem] border border-white/5 shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 group"
                >
                    {/* Subtle aesthetic background elements */}
                    <div className="absolute top-0 left-0 w-full h-[200px] bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/[0.03] rounded-full blur-[80px] pointer-events-none group-hover:bg-primary/[0.05] transition-colors duration-700" />

                    <div className="p-10 flex flex-col items-center relative z-10">
                        <div className="w-28 h-28 rounded-full bg-[#111] border-4 border-[#1a1a1a] flex items-center justify-center text-3xl font-bold text-white shadow-2xl mb-6 relative group/avatar overflow-hidden">
                            <span className="relative z-10 group-hover/avatar:scale-110 transition-transform duration-500">{(formData.display_name || 'U').charAt(0).toUpperCase()}</span>
                            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-500" />
                        </div>

                        <div className="text-center space-y-2">
                            <h2 className="text-3xl font-bold text-white tracking-tight">
                                {formData.display_name || 'New Identity'}
                            </h2>
                            <div className="flex items-center justify-center gap-2">
                                <div className="px-3 py-1 bg-white/5 rounded-full border border-white/5 flex items-center gap-2">
                                    <ShieldCheckIcon className="w-3 h-3 text-primary" />
                                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-[0.2em]">{role}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-2 pb-2 bg-black/20">
                        <div className="flex p-1 bg-white/[0.03] border border-white/5 rounded-[1.8rem] relative">
                            {/* Animated Background Indicator */}
                            <div
                                className="absolute top-1 bottom-1 bg-[#1a1a1a] rounded-[1.5rem] border border-white/5 shadow-lg transition-all duration-500 ease-out"
                                style={{
                                    left: activeTab === 'details' ? '4px' : '50%',
                                    width: 'calc(50% - 4px)',
                                    opacity: 1
                                }}
                            />

                            <button
                                type="button"
                                onClick={() => setActiveTab('details')}
                                className={`flex-1 py-4 text-[11px] font-bold uppercase tracking-widest relative z-10 transition-all duration-300 flex items-center justify-center gap-2
                                    ${activeTab === 'details' ? 'text-white' : 'text-white/30 hover:text-white/60'}`}
                            >
                                <UserIcon className={`w-3.5 h-3.5 ${activeTab === 'details' ? 'text-primary' : 'opacity-0'}`} />
                                Core Registry
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('contact')}
                                className={`flex-1 py-4 text-[11px] font-bold uppercase tracking-widest relative z-10 transition-all duration-300 flex items-center justify-center gap-2
                                    ${activeTab === 'contact' ? 'text-white' : 'text-white/30 hover:text-white/60'}`}
                            >
                                <PhoneIcon className={`w-3.5 h-3.5 ${activeTab === 'contact' ? 'text-primary' : 'opacity-0'}`} />
                                Contact & Node
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {
                error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-5 rounded-2xl flex items-center gap-4 animate-in shake">
                        <XIcon className="w-5 h-5 shrink-0" />
                        <span className="text-xs font-semibold uppercase tracking-wider">{error}</span>
                    </div>
                )
            }

            {/* Premium Success Overlay */}
            {
                success && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-500">
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />
                        <div className="relative bg-[#0a0a0b] border border-white/10 w-full max-w-md rounded-[3rem] p-12 text-center shadow-3xl overflow-hidden animate-in zoom-in-95 duration-500">
                            {/* Background Sparkle */}
                            <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/20 rounded-full blur-[80px]" />
                            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-[80px]" />

                            <div className="relative z-10 space-y-8">
                                <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.1)]">
                                    <CheckCircleIcon className="w-12 h-12 text-emerald-500 animate-in zoom-in-50 duration-700" />
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-3xl font-serif font-black text-white tracking-tight uppercase italic transition-all">
                                        Identity <span className="text-emerald-500">Secured</span>
                                    </h3>
                                    <p className="text-sm font-medium text-white/40 leading-relaxed uppercase tracking-widest px-4">
                                        {success}
                                    </p>
                                </div>

                                <div className="pt-8 border-t border-white/5 flex flex-col items-center gap-4">
                                    <div className="flex items-center gap-3 py-2 px-5 bg-white/5 rounded-full border border-white/10">
                                        <Spinner size="sm" className="text-primary" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
                                            Accessing Command Center...
                                        </span>
                                    </div>
                                    <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.3em]">Institutional Node Handshake: 100%</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Progress Checklist for School Admin */}
            {
                role === BuiltInRoles.SCHOOL_ADMINISTRATION && !profile.profile_completed && (
                    <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <ShieldCheckIcon className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Setup Progress</h3>
                                <p className="text-xs text-white/40 mt-0.5">Complete all required fields to proceed</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Institution Details */}
                            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                                <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    Institution Details
                                </h4>
                                <div className="space-y-2">
                                    <div className={`flex items-center gap-2 text-xs ${formData.school_name?.trim() ? 'text-emerald-400' : 'text-white/30'}`}>
                                        {formData.school_name?.trim() ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-white/20" />}
                                        <span>Institution Name</span>
                                    </div>
                                    <div className={`flex items-center gap-2 text-xs ${formData.address?.trim() ? 'text-emerald-400' : 'text-white/30'}`}>
                                        {formData.address?.trim() ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-white/20" />}
                                        <span>Street Address</span>
                                    </div>
                                </div>
                            </div>

                            {/* Node Management */}
                            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                                <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    Node Management
                                </h4>
                                <div className="space-y-2">
                                    <div className={`flex items-center gap-2 text-xs ${formData.admin_contact_name?.trim() ? 'text-emerald-400' : 'text-white/30'}`}>
                                        {formData.admin_contact_name?.trim() ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-white/20" />}
                                        <span>Admin Name</span>
                                    </div>
                                    <div className={`flex items-center gap-2 text-xs ${formData.admin_contact_email?.trim() ? 'text-emerald-400' : 'text-white/30'}`}>
                                        {formData.admin_contact_email?.trim() ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-white/20" />}
                                        <span>Admin Email</span>
                                    </div>
                                    <div className={`flex items-center gap-2 text-xs ${formData.admin_contact_phone_local?.trim() ? 'text-emerald-400' : 'text-white/30'}`}>
                                        {formData.admin_contact_phone_local?.trim() ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-white/20" />}
                                        <span>Phone Number</span>
                                    </div>
                                </div>
                            </div>

                            {/* Academic Settings */}
                            <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                                <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    Academic Settings
                                </h4>
                                <div className="space-y-2">
                                    <div className={`flex items-center gap-2 text-xs ${formData.academic_board?.trim() ? 'text-emerald-400' : 'text-white/30'}`}>
                                        {formData.academic_board?.trim() ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-white/20" />}
                                        <span>Education Board</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-4 pt-4 border-t border-white/5">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Completion</span>
                                <span className="text-xs font-bold text-primary">
                                    {Math.round(([
                                        formData.school_name?.trim(),
                                        formData.address?.trim(),
                                        formData.admin_contact_name?.trim(),
                                        formData.admin_contact_email?.trim(),
                                        formData.admin_contact_phone_local?.trim(),
                                        formData.academic_board?.trim()
                                    ].filter(Boolean).length / 6) * 100)}%
                                </span>
                            </div>
                            <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-500 rounded-full"
                                    style={{
                                        width: `${([
                                            formData.school_name?.trim(),
                                            formData.address?.trim(),
                                            formData.admin_contact_name?.trim(),
                                            formData.admin_contact_email?.trim(),
                                            formData.admin_contact_phone_local?.trim(),
                                            formData.academic_board?.trim()
                                        ].filter(Boolean).length / 6) * 100}%`
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )
            }

            <form onSubmit={handleSubmit} className="space-y-10">
                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 md:p-10 shadow-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                    {role === BuiltInRoles.PARENT_GUARDIAN ? (
                        <ParentForm formData={formData} handleChange={handleFormChange} activeTab={activeTab} isStrictReadOnly={isStrictReadOnly} />
                    ) : role === BuiltInRoles.TEACHER ? (
                        <TeacherForm formData={formData} handleChange={handleFormChange} photoPreviewUrl={null} onPhotoChange={() => { }} currentUserId={profile.id} isRestrictedView={true} />
                    ) : role === BuiltInRoles.SCHOOL_ADMINISTRATION ? (
                        isLimitedBranchAdmin ? (
                            <div className="space-y-8">
                                <div className="p-6 bg-primary/5 border border-primary/20 rounded-2xl flex items-center gap-4 mb-4">
                                    <div className="p-3 bg-primary/10 rounded-xl">
                                        <ShieldCheckIcon className="w-8 h-8 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Node Restricted Access</p>
                                        <p className="text-sm text-foreground/60 font-medium">You are an authorized administrator for <strong>{formData.school_name || 'your assigned branch'}</strong>.</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <FloatingPremiumInput label="Full Legal Name" name="display_name" value={formData.display_name} onChange={handleFormChange} icon={<UserIcon className="w-4 h-4" />} />
                                    <FloatingPremiumInput label="Contact Number" name="phone" value={formData.phone} onChange={handleFormChange} icon={<PhoneIcon className="w-4 h-4" />} />
                                </div>
                            </div>
                        ) : (
                            <SchoolAdminForm formData={formData} handleChange={handleFormChange} isInitialCreation={false} />
                        )
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <FloatingPremiumInput label="Full Legal Name" name="display_name" value={formData.display_name} onChange={handleFormChange} icon={<UserIcon className="w-4 h-4" />} />
                            <FloatingPremiumInput label="Contact Number" name="phone" value={formData.phone} onChange={handleFormChange} icon={<PhoneIcon className="w-4 h-4" />} />
                        </div>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-8 mt-12 px-2 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
                    {showBackButton ? (
                        <button type="button" onClick={onBack} className="group text-[11px] font-bold text-white/30 hover:text-white transition-all uppercase tracking-widest flex items-center gap-2.5">
                            <ChevronLeftIcon className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Return to Selection
                        </button>
                    ) : <div />}

                    {/* Replaced the original button with the new structure */}
                    {/* Restored Submit Button */}
                    <button
                        type="submit"
                        disabled={saving || !isDirty || isStrictReadOnly || !isFormValid}
                        className={`px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 transform active:scale-95 shadow-2xl relative group overflow-hidden ${saving || !isDirty || isStrictReadOnly || !isFormValid ? 'bg-white/5 text-white/10 cursor-not-allowed grayscale' : 'bg-primary text-white shadow-primary/20 hover:bg-primary/90'}`}
                    >
                        <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-[-20deg]" />
                        {saving ? <Spinner size="sm" /> : (
                            <div className="flex items-center justify-center gap-3">
                                <ShieldCheckIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                <span>{isStrictReadOnly ? 'Access Restricted' : `Update ${role} Protocol`}</span>
                            </div>
                        )}
                    </button>
                </div>
            </form>

            {
                isStrictReadOnly && (
                    <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                        <LockIcon className="w-4 h-4 text-amber-500" />
                        <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest">
                            Institutional Policy: Administrative nodes cannot mutate Parent data from this portal.
                        </p>
                    </div>
                )
            }

            <div className="text-center py-4 opacity-40 animate-in fade-in duration-1000 delay-300">
                <p className="text-[11px] font-medium tracking-wide flex items-center justify-center gap-2 text-white/60">
                    <ShieldCheckIcon className="w-3.5 h-3.5" />
                    Your information is encrypted and used only for institutional verification.
                </p>
            </div>
        </div >
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