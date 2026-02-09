
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, formatError } from '../../services/supabase';
import { StudentForAdmin, BuiltInRoles } from '../../types';
import Spinner from '../common/Spinner';
import { XIcon } from '../icons/XIcon';
import { UserIcon } from '../icons/UserIcon';
import { PhoneIcon } from '../icons/PhoneIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { LocationIcon } from '../icons/LocationIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { RefreshCwIcon } from '../icons/RefreshCwIcon';

interface EditStudentDetailsModalProps {
    student: StudentForAdmin;
    onClose: () => void;
    onSave: () => void;
}

// --- Floating Input Component (Premium Node) ---

interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
    label: string;
    icon?: React.ReactNode;
    isTextArea?: boolean;
    isLoading?: boolean;
    source?: string;
    isAutoFilled?: boolean;
}

const FloatingInput: React.FC<FloatingInputProps> = ({
    label, icon, isTextArea, className, readOnly, isLoading, source, isAutoFilled, ...props
}) => {
    const [isFocused, setIsFocused] = useState(false);

    const inputClasses = `
        peer block w-full rounded-2xl border bg-black/40 px-5 py-4 pl-12 text-sm text-white shadow-inner
        focus:outline-none placeholder-transparent transition-all duration-500
        ${readOnly ? 'opacity-40 cursor-default border-transparent' : 'border-white/5 hover:border-white/10'} 
        ${isLoading ? 'animate-pulse border-[#7c3aed]/20' : ''}
        ${isFocused ? 'border-[#7c3aed]/30 ring-4 ring-[#7c3aed]/5' : ''}
        ${isAutoFilled ? 'bg-[#7c3aed]/5 border-[#7c3aed]/10' : ''}
        ${className}
    `;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative group w-full"
        >
            {/* Holographic Focus Border */}
            <AnimatePresence>
                {isFocused && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="absolute -inset-[1px] bg-gradient-to-r from-[#7c3aed]/30 via-transparent to-[#7c3aed]/30 rounded-[17px] blur-[2px] pointer-events-none z-0"
                    />
                )}
            </AnimatePresence>

            {/* Icon Node */}
            <div className={`absolute ${isTextArea ? 'top-5' : 'top-1/2 -translate-y-1/2'} left-5 transition-colors z-10 pointer-events-none ${isFocused ? 'text-[#7c3aed]' : 'text-white/20'}`}>
                {isLoading ? <Spinner size="sm" className="text-[#a78bfa]" /> : icon}
            </div>

            {isTextArea ? (
                <textarea
                    {...(props as any)}
                    readOnly={readOnly}
                    placeholder=" "
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    className={`${inputClasses} resize-none h-28 pt-5 relative z-10`}
                />
            ) : (
                <input
                    {...(props as any)}
                    readOnly={readOnly}
                    placeholder=" "
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    className={`${inputClasses} relative z-10`}
                />
            )}

            {/* Premium Label */}
            <label className={`
                absolute left-10 ${isTextArea ? 'top-5' : 'top-0 -translate-y-1/2'} bg-[#0c0e12] px-2 text-[10px] font-black uppercase tracking-[0.25em] transition-all duration-500 z-20
                peer-placeholder-shown:top-5 peer-placeholder-shown:text-[13px] peer-placeholder-shown:font-medium peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal
                peer-focus:top-0 peer-focus:text-[10px] peer-focus:font-black peer-focus:uppercase peer-focus:tracking-[0.25em] 
                ${isFocused ? 'text-[#a78bfa]' : 'text-white/40'}
                peer-placeholder-shown:text-white/40
                pointer-events-none
                ${isTextArea ? 'peer-placeholder-shown:top-5' : ''}
            `}>
                {label}
            </label>

            {/* Registry Badge */}
            <AnimatePresence>
                {source && !isLoading && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none z-20"
                    >
                        <span className="px-3 py-1 rounded-full bg-[#7c3aed]/10 border border-[#7c3aed]/20 text-[7px] font-black text-[#a78bfa] uppercase tracking-tighter backdrop-blur-md">
                            Registry: {source}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

const EditStudentDetailsModal: React.FC<EditStudentDetailsModalProps> = ({ student, onClose, onSave }) => {
    // 1. Context & User Resolution
    const [userRole, setUserRole] = useState<string | null>(null);
    const [isCheckingRole, setIsCheckingRole] = useState(true);

    useEffect(() => {
        const resolveUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
                setUserRole(data?.role || null);
            }
            setIsCheckingRole(false);
        };
        resolveUser();
    }, []);

    const isSchoolAdmin = userRole === BuiltInRoles.SCHOOL_ADMINISTRATION || userRole === 'School Administration';

    // Robust Date Parsing
    const parseDate = (d?: string) => {
        if (!d || d === '0') return '';
        try {
            const dateObj = new Date(d);
            if (isNaN(dateObj.getTime())) return '';
            return dateObj.toISOString().split('T')[0];
        } catch (e) {
            return '';
        }
    };

    const sanitizeVal = (v: any) => {
        if (v === '0' || v === 0 || !v) return '';
        const s = String(v).trim();
        return (s === '0' || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null') ? '' : s;
    };

    // Form State
    const [formData, setFormData] = useState({
        display_name: sanitizeVal(student.display_name),
        student_id_number: sanitizeVal(student.student_id_number),
        grade: sanitizeVal(student.grade),
        date_of_birth: parseDate(student.date_of_birth),
        gender: sanitizeVal(student.gender),
        phone: sanitizeVal(student.phone),
        address: sanitizeVal(student.address),
        parent_guardian_details: sanitizeVal(student.parent_guardian_details),
        enrollment_status: student.enrollment_status || 'Active',
    });

    // Reactive Refresh
    useEffect(() => {
        if (student) {
            setFormData(prev => ({
                ...prev,
                display_name: sanitizeVal(student.display_name) || prev.display_name,
                student_id_number: sanitizeVal(student.student_id_number) || prev.student_id_number,
                grade: sanitizeVal(student.grade) || prev.grade,
                date_of_birth: parseDate(student.date_of_birth) || prev.date_of_birth,
                gender: sanitizeVal(student.gender) || prev.gender,
                phone: sanitizeVal(student.phone) || prev.phone,
                address: sanitizeVal(student.address) || prev.address,
                parent_guardian_details: sanitizeVal(student.parent_guardian_details) || prev.parent_guardian_details,
                enrollment_status: student.enrollment_status || prev.enrollment_status,
            }));
        }
    }, [student]);
    // Riverside Registry Sync: Force re-fetch on mount explicitly
    useEffect(() => {
        fetchParent();
    }, [student.id]);

    const [parentData, setParentData] = useState<any>(null);
    const [isFetchingParent, setIsFetchingParent] = useState(false);
    const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());

    // UI State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    // Handle Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !loading) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [loading, onClose]);

    const fetchParent = async () => {
        if (!student?.id) return;
        setIsFetchingParent(true);
        setError(null);
        try {
            const { data, error: rpcError } = await supabase.rpc('get_student_contact_details', { p_student_id: student.id });
            if (rpcError) throw new Error(rpcError.message);

            if (data && data.found) {
                setParentData(data);
            } else {
                await performFallbackFetch();
            }
        } catch (e: any) {
            console.error("Contact fetch exception:", e);
            await performFallbackFetch();
        } finally {
            if (isMounted.current) setIsFetchingParent(false);
        }
    };

    const performFallbackFetch = async () => {
        try {
            const { data: admissionLink } = await supabase
                .from('admissions')
                .select('*')
                .or(`student_user_id.eq.${student.id}${student.admission_id ? `,id.eq.${student.admission_id}` : ''}`)
                .maybeSingle();

            if (admissionLink) {
                setParentData({
                    found: true,
                    student_phone: admissionLink.student_phone || admissionLink.phone,
                    parent_name: admissionLink.parent_name,
                    parent_phone: admissionLink.parent_phone,
                    parent_email: admissionLink.parent_email,
                    relationship: 'Parent',
                    address: admissionLink.address,
                    city: admissionLink.city,
                    state: admissionLink.state,
                    country: admissionLink.country,
                    pin_code: admissionLink.pin_code,
                    parent_id: admissionLink.parent_id,
                    is_unlinked: !admissionLink.parent_id
                });
                return;
            }

            const { data: enquiryData } = await supabase
                .from('enquiries')
                .select('*')
                .eq('user_id', student.id)
                .maybeSingle();

            if (enquiryData) {
                setParentData({
                    found: true,
                    student_phone: enquiryData.student_phone || enquiryData.phone,
                    parent_name: enquiryData.parent_name,
                    parent_phone: enquiryData.parent_phone,
                    parent_email: enquiryData.parent_email,
                    relationship: 'Parent',
                    address: enquiryData.address,
                    city: enquiryData.city,
                    state: enquiryData.state,
                    country: enquiryData.country,
                    pin_code: enquiryData.pin_code,
                    is_unlinked: true
                });
                return;
            }

            const { data: studentProfile } = await supabase
                .from('student_profiles')
                .select('*')
                .eq('user_id', student.id)
                .maybeSingle();

            if (studentProfile) {
                setParentData({
                    found: true,
                    student_phone: studentProfile.phone,
                    address: studentProfile.address,
                    parent_guardian_details: studentProfile.parent_guardian_details,
                    is_unlinked: true
                });
                return;
            }
        } catch (e) {
            console.error("Fallback fetch error:", e);
        }
    };


    useEffect(() => {
        if (parentData) {
            const addressParts = [
                parentData.address,
                parentData.city,
                parentData.state,
                parentData.country,
                parentData.pin_code
            ].filter(Boolean);
            const fullAddress = addressParts.join(', ').trim();

            // Sanitize Guardian Info to avoid '0' or numeric placeholders
            const pName = parentData.parent_name || parentData.name;
            const sanitizedName = (pName && pName !== '0' && pName !== 0) ? pName : '';

            const guardianInfo = sanitizedName
                ? `${sanitizedName} (${parentData.parent_relationship || parentData.relationship || 'Guardian'})`
                : '';

            const bestPhone = parentData.student_phone || parentData.parent_phone || parentData.phone || '';
            const normalizedPhone = (bestPhone && bestPhone !== '0') ? bestPhone : '';

            setFormData(prev => {
                const newFields = new Set(autoFilledFields);
                const updates: any = {};

                if ((!prev.phone || prev.phone === '0') && normalizedPhone) {
                    updates.phone = normalizedPhone;
                    newFields.add('phone');
                }
                if (!prev.address && fullAddress) {
                    updates.address = fullAddress;
                    newFields.add('address');
                }
                // More aggressive update for guardian details
                if ((!prev.parent_guardian_details || prev.parent_guardian_details === '0' || prev.parent_guardian_details.length < 5) && guardianInfo) {
                    updates.parent_guardian_details = guardianInfo;
                    newFields.add('parent_guardian_details');
                }

                if (Object.keys(updates).length > 0) {
                    setAutoFilledFields(newFields);
                    return { ...prev, ...updates };
                }
                return prev;
            });
        }
    }, [parentData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.display_name?.trim()) {
            setError('Student name is required');
            return;
        }
        if (!formData.grade?.trim()) {
            setError('Grade/Class is required');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // UNLOCKED: Allow full profile updates for all authorized admin roles
            const updatePayload = {
                p_student_id: student.id,
                p_display_name: formData.display_name,
                p_phone: formData.phone,
                p_dob: formData.date_of_birth || null,
                p_gender: formData.gender,
                p_address: formData.address,
                p_parent_details: formData.parent_guardian_details,
                p_student_id_number: formData.student_id_number,
                p_grade: formData.grade,
                p_enrollment_status: formData.enrollment_status
            };

            const { error: rpcError } = await supabase.rpc('update_student_details_admin', updatePayload);

            if (rpcError) throw rpcError;

            onSave();
            onClose();
        } catch (err: any) {
            if (isMounted.current) setError(formatError(err));
        } finally {
            if (isMounted.current) setLoading(false);
        }
    };

    if (isCheckingRole) {
        return (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[100]">
                <Spinner size="lg" className="text-primary" />
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[100] p-4 font-sans"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-[#0c0e12] w-full max-w-2xl rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col overflow-hidden ring-1 ring-white/5 relative"
                onClick={e => e.stopPropagation()}
            >
                {/* Visual Accent Decoration */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-[1px] bg-gradient-to-r from-transparent via-[#7c3aed]/50 to-transparent"></div>

                {/* Header */}
                <div className="p-12 border-b border-white/5 bg-white/[0.01] flex justify-between items-center relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#7c3aed]/5 blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative z-10">
                        <motion.h3
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="font-black text-3xl text-white tracking-tight flex items-center gap-3"
                        >
                            Edit Student Profile
                        </motion.h3>
                        <div className="flex items-center gap-1.5 mt-1.5">
                            <p className="text-[11px] text-white/40 uppercase font-bold tracking-[0.3em]">
                                Registry Update
                            </p>
                            <span className="text-white/10 mx-1">|</span>
                            {isSchoolAdmin ? (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        fetchParent();
                                    }}
                                    className="flex items-center gap-2 text-[11px] text-indigo-400 hover:text-indigo-300 uppercase font-black tracking-[0.3em] transition-all group/sync active:scale-95"
                                >
                                    <div className="relative">
                                        <RefreshCwIcon className={`w-3 h-3 ${isFetchingParent ? 'animate-spin' : 'group-sync:rotate-180'} transition-transform duration-700`} />
                                        {!isFetchingParent && (
                                            <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(99,102,241,1)]"></span>
                                        )}
                                    </div>
                                    Sync Identity Node
                                </button>
                            ) : (
                                <p className="text-[11px] text-white/40 uppercase font-bold tracking-[0.3em]">
                                    Sync Identity Node
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3.5 rounded-2xl hover:bg-white/5 text-white/20 hover:text-white transition-all duration-300 border border-transparent hover:border-white/5 group"
                    >
                        <XIcon className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-12 space-y-16 overflow-y-auto max-h-[70vh] custom-scrollbar bg-transparent">
                    {/* Restriction Notice */}
                    {isSchoolAdmin && (
                        <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-6 flex items-start gap-4">
                            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                                <ShieldCheckIcon className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Restricted Access Protocol</p>
                                <p className="text-[11px] text-white/40 leading-relaxed font-medium">
                                    Your institutional role permits viewing the full profile.
                                    However, modifications are restricted to <b>Enrollment Status</b> to ensure data integrity across the Parent Vault.
                                </p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-red-500/10 text-red-400 p-6 rounded-3xl text-xs font-black uppercase tracking-widest border border-red-500/20 flex items-center gap-4"
                        >
                            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-sm font-black">!</div>
                            {error}
                        </motion.div>
                    )}

                    {/* Identity Section */}
                    <section className="space-y-10">
                        <div className="flex items-center gap-5">
                            <div className="h-10 w-10 flex items-center justify-center bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
                                <UserIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-grow">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="text-[11px] font-black uppercase text-white/50 tracking-[0.5em]">Identity & Lifecycle</h4>
                                    {isSchoolAdmin && <span className="text-[9px] font-black text-amber-500/50 uppercase tracking-widest">Institution Registry</span>}
                                </div>
                                <div className="h-px bg-white/5 w-full"></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            {/* Enrollment Status - ALWAYS EDITABLE */}
                            <div className="relative group/status md:col-span-2">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-[#7c3aed]/20 to-transparent rounded-2xl blur opacity-0 group-hover/status:opacity-100 transition-opacity"></div>
                                <select
                                    name="enrollment_status"
                                    value={formData.enrollment_status}
                                    onChange={handleChange}
                                    className="peer w-full h-[64px] rounded-2xl border border-white/10 bg-black/60 px-5 pl-12 text-sm text-white shadow-xl focus:outline-none focus:border-[#7c3aed]/50 focus:ring-4 focus:ring-[#7c3aed]/10 transition-all duration-500 appearance-none cursor-pointer relative z-10"
                                >
                                    <option value="Enrolled" className="bg-[#0c0e12]">Enrolled (Initial Node)</option>
                                    <option value="Active" className="bg-[#0c0e12]">Active (Standard)</option>
                                    <option value="Inactive" className="bg-[#0c0e12]">Inactive / Suspended</option>
                                    <option value="Withdrawn" className="bg-[#0c0e12]">Withdrawn / Left</option>
                                    <option value="Alumni" className="bg-[#0c0e12]">Alumni</option>
                                </select>
                                <div className="absolute top-1/2 -translate-y-1/2 left-5 text-[#a78bfa] pointer-events-none z-20"><ActivityIcon className="w-4 h-4" /></div>
                                <label className="absolute left-10 top-0 -translate-y-1/2 bg-[#0c0e12] px-2 text-[10px] font-black uppercase tracking-[0.25em] text-[#a78bfa] z-20">Student ID Status</label>
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-[#a78bfa] z-20">
                                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                            </div>

                            <FloatingInput label="Full Name" name="display_name" value={formData.display_name} onChange={handleChange} required icon={<UserIcon className="w-4 h-4" />} readOnly={isSchoolAdmin} placeholder={isSchoolAdmin ? "Protocol Missing" : "Legal Name"} />
                            <FloatingInput label="Student ID" name="student_id_number" value={formData.student_id_number} onChange={handleChange} icon={<div className="font-black text-[9px] border border-current rounded-sm px-1">SID</div>} readOnly={isSchoolAdmin} placeholder={isSchoolAdmin ? "Unassigned" : "SID-XXXX-XXXX"} />

                            <FloatingInput label="Grade / Class" name="grade" value={formData.grade} onChange={handleChange} required icon={<div className="font-black text-[9px]">G / C</div>} readOnly={isSchoolAdmin} placeholder={isSchoolAdmin ? "Not Placed" : "e.g. 10"} />

                            <div className="relative group/select">
                                <select
                                    name="gender"
                                    value={formData.gender}
                                    onChange={handleChange}
                                    disabled={isSchoolAdmin}
                                    className={`peer w-full h-[58px] rounded-2xl border border-white/5 bg-black/40 px-5 pl-12 text-sm text-white shadow-inner focus:outline-none focus:border-[#7c3aed]/30 focus:ring-4 focus:ring-[#7c3aed]/5 transition-all duration-500 appearance-none relative z-10 ${isSchoolAdmin ? 'cursor-default opacity-40' : 'cursor-pointer'}`}
                                >
                                    <option value="" className="bg-[#0c0e12]">Select Gender...</option>
                                    <option value="Male" className="bg-[#0c0e12]">Male</option>
                                    <option value="Female" className="bg-[#0c0e12]">Female</option>
                                    <option value="Other" className="bg-[#0c0e12]">Other</option>
                                </select>
                                <div className="absolute top-1/2 -translate-y-1/2 left-5 text-white/20 pointer-events-none transition-colors group-focus-within/select:text-[#7c3aed] z-20"><UserIcon className="w-4 h-4" /></div>
                                <label className="absolute left-10 top-0 -translate-y-1/2 bg-[#0c0e12] px-2 text-[10px] font-black uppercase tracking-[0.25em] text-white/40 transition-all duration-500 peer-focus:text-[#a78bfa] z-20">Gender</label>
                                {!isSchoolAdmin && (
                                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-white/20 group-hover/select:text-white/40 transition-colors z-20">
                                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                )}
                            </div>

                            <FloatingInput label="Date of Birth" type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} icon={<CalendarIcon className="w-4 h-4" />} readOnly={isSchoolAdmin} />
                        </div>
                    </section>

                    {/* Contact & Guardian Section */}
                    <section className="space-y-10">
                        <div className="flex items-center gap-5">
                            <div className="h-10 w-10 flex items-center justify-center bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
                                <UsersIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-grow">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="text-[11px] font-black uppercase text-white/50 tracking-[0.5em]">Contact & Guardian</h4>
                                    {isSchoolAdmin && <span className="text-[9px] font-black text-emerald-500/50 uppercase tracking-widest">Institutional Registry</span>}
                                </div>
                                <div className="h-px bg-white/5 w-full"></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <FloatingInput
                                label="Student Phone"
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                icon={<PhoneIcon className="w-4 h-4" />}
                                isLoading={isFetchingParent && !formData.phone}
                                isAutoFilled={autoFilledFields.has('phone')}
                                source={autoFilledFields.has('phone') ? (parentData?.found ? 'Admission' : 'Registry') : undefined}
                                readOnly={isSchoolAdmin}
                                placeholder={isSchoolAdmin ? "Link Missing" : "Student Contact"}
                            />
                            <FloatingInput
                                label="Guardian Identity"
                                name="parent_guardian_details"
                                value={formData.parent_guardian_details}
                                onChange={handleChange}
                                icon={<UsersIcon className="w-4 h-4" />}
                                isLoading={isFetchingParent && !formData.parent_guardian_details}
                                isAutoFilled={autoFilledFields.has('parent_guardian_details')}
                                source={autoFilledFields.has('parent_guardian_details') ? (parentData?.found ? 'Parent Vault' : 'Registry') : undefined}
                                readOnly={isSchoolAdmin}
                                placeholder={isSchoolAdmin ? "Initializing Link..." : "Primary Guardian Name"}
                            />
                        </div>

                        <FloatingInput
                            label="Residential Address"
                            name="address"
                            value={formData.address}
                            onChange={handleChange as any}
                            icon={<LocationIcon className="w-4 h-4" />}
                            isTextArea
                            isLoading={isFetchingParent && !formData.address}
                            isAutoFilled={autoFilledFields.has('address')}
                            source={autoFilledFields.has('address') ? (parentData?.found ? 'Institutional' : 'Registry') : undefined}
                            readOnly={isSchoolAdmin}
                            placeholder={isSchoolAdmin ? "Residential Index Missing" : "Full Address Details"}
                        />
                    </section>
                </form>

                {/* Action Bar */}
                <div className="p-10 flex justify-end items-center gap-8 border-t border-white/5 bg-white/[0.01] shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-8 py-4 font-black text-[11px] uppercase tracking-[0.4em] text-white/30 hover:text-white transition-all duration-300 active:scale-95 border border-transparent hover:border-white/5 rounded-2xl"
                        disabled={loading}
                    >
                        Cancel
                    </button>

                    <motion.button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={loading}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="relative group px-16 py-5 bg-[#7c3aed] text-white font-black text-[12px] uppercase tracking-[0.4em] rounded-[1.5rem] shadow-[0_20px_50px_rgba(124,58,237,0.4)] hover:shadow-[0_25px_60px_rgba(124,58,237,0.6)] transition-all flex items-center justify-center gap-4 overflow-hidden"
                    >
                        {/* Shimmer Effect */}
                        <motion.div
                            animate={{ x: ["100%", "-100%"] }}
                            transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"
                        />

                        {loading ? (
                            <Spinner size="sm" className="text-white" />
                        ) : (
                            <>
                                <CheckCircleIcon className="w-5 h-5 group-hover:scale-125 transition-transform duration-500" />
                                <span>{isSchoolAdmin ? 'Update Status' : 'Save Changes'}</span>
                            </>
                        )}
                    </motion.button>
                </div>
            </motion.div>
        </div>
    );
};

export default EditStudentDetailsModal;
