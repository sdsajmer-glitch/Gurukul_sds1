
import React, { useState, useEffect, useRef } from 'react';
import { supabase, formatError } from '../../services/supabase';
import { StudentForAdmin } from '../../types';
import Spinner from '../common/Spinner';
import { XIcon } from '../icons/XIcon';
import { UserIcon } from '../icons/UserIcon';
import { PhoneIcon } from '../icons/PhoneIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { LocationIcon } from '../icons/LocationIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { LockIcon } from '../icons/LockIcon';
import { RefreshIcon } from '../icons/RefreshIcon';

import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { PlusIcon } from '../icons/PlusIcon';

// Simple Switch Component
const Switch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        className={`
            relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-white/10 transition-colors duration-500 ease-in-out focus:outline-none
            ${checked ? 'bg-[#7c3aed] shadow-[0_0_15px_rgba(124,58,237,0.4)]' : 'bg-white/5'}
            ${disabled ? 'opacity-20 cursor-not-allowed' : 'hover:border-white/20'}
        `}
    >
        <span
            aria-hidden="true"
            className={`
                pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xl transition duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
                ${checked ? 'translate-x-5' : 'translate-x-0'}
            `}
        />
    </button>
);

interface EditStudentDetailsModalProps {
    student: StudentForAdmin;
    onClose: () => void;
    onSave: () => void;
}

const FloatingInput: React.FC<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> & { label: string, icon?: React.ReactNode, isSynced?: boolean, isTextArea?: boolean }> = ({ label, icon, isSynced, isTextArea, className, readOnly, ...props }) => {
    const inputClasses = `
        peer block w-full rounded-2xl border bg-black/40 px-5 py-4 pl-12 text-sm text-white shadow-inner
        focus:border-white/20 focus:ring-4 focus:ring-white/5 focus:outline-none placeholder-transparent transition-all duration-500
        ${readOnly ? 'opacity-40 cursor-default border-transparent' : 'border-white/5 hover:border-white/10'} 
        ${className}
    `;

    return (
        <div className="relative group w-full">
            <div className={`absolute ${isTextArea ? 'top-5' : 'top-1/2 -translate-y-1/2'} left-5 text-white/20 transition-colors z-10 pointer-events-none`}>
                {icon}
            </div>

            {isTextArea ? (
                <textarea
                    {...(props as any)}
                    readOnly={readOnly}
                    placeholder=" "
                    className={`${inputClasses} resize-none h-28 pt-5`}
                />
            ) : (
                <input
                    {...(props as any)}
                    readOnly={readOnly}
                    placeholder=" "
                    className={inputClasses}
                />
            )}

            <label className={`
                absolute left-10 ${isTextArea ? 'top-5' : 'top-0 -translate-y-1/2'} bg-[#0c0e12] px-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 transition-all duration-500
                peer-placeholder-shown:top-5 peer-placeholder-shown:text-[13px] peer-placeholder-shown:font-medium peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-white/40
                peer-focus:top-0 peer-focus:text-[10px] peer-focus:font-black peer-focus:uppercase peer-focus:tracking-[0.2em] peer-focus:text-white/80 pointer-events-none
                ${isTextArea ? 'peer-placeholder-shown:top-5' : ''}
            `}>
                {label}
            </label>

            {isSynced && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none animate-in fade-in zoom-in duration-700">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black bg-[#7c3aed]/10 text-[#a78bfa] border border-[#7c3aed]/20 uppercase tracking-widest shadow-[0_0_20px_rgba(124,58,237,0.1)] backdrop-blur-md">
                        <LockIcon className="w-3.5 h-3.5" /> Synced
                    </div>
                </div>
            )}
        </div>
    );
};

const EditStudentDetailsModal: React.FC<EditStudentDetailsModalProps> = ({ student, onClose, onSave }) => {
    // Robust Date Parsing
    const parseDate = (d?: string) => {
        if (!d) return '';
        try {
            const dateObj = new Date(d);
            if (isNaN(dateObj.getTime())) return '';
            return dateObj.toISOString().split('T')[0];
        } catch (e) {
            return '';
        }
    };

    // Form State - Initialized with current student context
    const [formData, setFormData] = useState({
        display_name: student.display_name || '',
        student_id_number: student.student_id_number || '',
        grade: student.grade || '',
        date_of_birth: parseDate(student.date_of_birth),
        gender: student.gender || '',
        phone: student.phone || '',
        address: student.address || '',
        parent_guardian_details: student.parent_guardian_details || '',
    });

    // Reactive Refresh: If student prop updates while modal is open, sync non-dirty fields
    useEffect(() => {
        if (student) {
            setFormData(prev => ({
                ...prev,
                display_name: prev.display_name || student.display_name || '',
                student_id_number: prev.student_id_number || student.student_id_number || '',
                grade: prev.grade || student.grade || '',
                date_of_birth: prev.date_of_birth || parseDate(student.date_of_birth),
                gender: prev.gender || student.gender || '',
                phone: prev.phone || student.phone || '',
                address: prev.address || student.address || '',
                parent_guardian_details: prev.parent_guardian_details || student.parent_guardian_details || '',
            }));
        }
    }, [student]);

    // Sync Logic State
    const [syncWithParent, setSyncWithParent] = useState(true);
    const [parentData, setParentData] = useState<any>(null);
    const [isFetchingParent, setIsFetchingParent] = useState(false);
    const [manualParentEmail, setManualParentEmail] = useState('');
    const [isLinking, setIsLinking] = useState(false);

    // UI State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    // Handle Escape key to close modal
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !loading && !isLinking) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [loading, isLinking, onClose]);

    // Fetch Student Contact Details - Enhanced Robust Implementation
    const fetchParent = async () => {
        if (!student?.id) {
            console.warn('Cannot fetch contact data: student ID is missing');
            return;
        }
        setIsFetchingParent(true);
        setError(null);
        try {
            // Use the new unified RPC that properly fetches from all sources
            const { data, error: rpcError } = await supabase.rpc('get_student_contact_details', { p_student_id: student.id });

            if (rpcError) {
                throw new Error(rpcError.message);
            }

            if (data && data.found) {
                setParentData(data);
                if (isMounted.current) setSyncWithParent(true);
            } else {
                // Ultimate fallback: direct queries
                console.log('RPC found no contact data, initiating fallback queries...');
                await performFallbackFetch();
            }
        } catch (e: any) {
            console.error("Contact fetch exception:", e);
            // Try fallback on error
            await performFallbackFetch();
        } finally {
            if (isMounted.current) setIsFetchingParent(false);
        }
    };

    // Fallback fetch when RPC fails
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
                if (isMounted.current) setSyncWithParent(true);
                return;
            }

            // Try enquiry
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
                if (isMounted.current) setSyncWithParent(true);
                return;
            }

            // Try direct student profile
            const { data: studentProfile } = await supabase
                .from('student_profiles')
                .select('*')
                .eq('user_id', student.id)
                .maybeSingle();

            if (studentProfile) {
                setParentData({
                    found: true,
                    student_phone: studentProfile.phone,
                    parent_name: null,
                    parent_phone: null,
                    address: studentProfile.address,
                    parent_guardian_details: studentProfile.parent_guardian_details,
                    is_unlinked: true
                });
                if (isMounted.current) setSyncWithParent(true);
                return;
            }

            if (isMounted.current) setSyncWithParent(false);
        } catch (e) {
            console.error("Fallback fetch error:", e);
            if (isMounted.current) setSyncWithParent(false);
        }
    };

    useEffect(() => {
        fetchParent();
    }, [student.id]);

    // Manual Parent Lookup by Email
    const handleManualLinkByEmail = async () => {
        if (!manualParentEmail || !manualParentEmail.includes('@')) {
            setError('Please enter a valid parent email address.');
            return;
        }

        setIsLinking(true);
        setError(null);
        try {
            // Search for parent profile by email
            const { data: profile, error: profileErr } = await supabase
                .from('profiles')
                .select('id, display_name, email, phone')
                .ilike('email', manualParentEmail.trim())
                .or(`role.eq.Parent,role.eq."Parent/Guardian"`)
                .maybeSingle();

            if (profileErr) throw profileErr;

            if (profile) {
                // We found a parent! Now fetch their full parent record
                const { data: parentProfile } = await supabase
                    .from('parent_profiles')
                    .select('*')
                    .eq('user_id', profile.id)
                    .maybeSingle();

                const resolvedData = {
                    found: true,
                    name: profile.display_name,
                    email: profile.email,
                    phone: profile.phone,
                    relationship: parentProfile?.relationship_to_student || 'Parent',
                    address: parentProfile?.address,
                    city: parentProfile?.city,
                    state: parentProfile?.state,
                    country: parentProfile?.country,
                    pin_code: parentProfile?.pin_code,
                    parent_id: profile.id
                };

                setParentData(resolvedData);
                setSyncWithParent(true);

                // Opt-in: Automatically create the link in student_parents table to persist this lookup
                await supabase.from('student_parents').insert({
                    student_id: student.id,
                    parent_id: profile.id,
                    is_primary: true
                }).select();

                console.log('Manual link established successfully');
            } else {
                setError('No parent profile found with that email. Please ensure the parent has registered.');
            }
        } catch (e) {
            console.error("Manual link error:", e);
            setError("Failed to link parent identity.");
        } finally {
            setIsLinking(false);
        }
    };

    // Apply Sync Effect - Carefully merge parent data
    useEffect(() => {
        if (syncWithParent && parentData) {
            // Construct Address
            const addressParts = [
                parentData.address,
                parentData.city,
                parentData.state,
                parentData.country,
                parentData.pin_code
            ].filter(Boolean);
            const fullAddress = addressParts.join(', ').trim();

            // Construct Guardian Details - use parent_name from RPC
            const guardianInfo = parentData.parent_name ? `${parentData.parent_name} (${parentData.parent_relationship || 'Guardian'})` : '';

            setFormData(prev => {
                // Only update if there's actual data to sync, otherwise keep current
                const updates: any = {};
                // Use student_phone from RPC, fallback to parent_phone
                if (parentData.student_phone) updates.phone = parentData.student_phone;
                else if (parentData.parent_phone) updates.phone = parentData.parent_phone;
                if (fullAddress) updates.address = fullAddress;
                if (guardianInfo) updates.parent_guardian_details = guardianInfo;

                if (Object.keys(updates).length > 0) {
                    return { ...prev, ...updates };
                }
                return prev;
            });
        }
    }, [syncWithParent, parentData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
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
            const { error: rpcError } = await supabase.rpc('update_student_details_admin', {
                p_student_id: student.id,
                p_display_name: formData.display_name,
                p_phone: formData.phone,
                p_dob: formData.date_of_birth || null,
                p_gender: formData.gender,
                p_address: formData.address,
                p_parent_details: formData.parent_guardian_details,
                p_student_id_number: formData.student_id_number,
                p_grade: formData.grade
            });

            if (rpcError) throw rpcError;

            onSave();
            onClose();
        } catch (err: any) {
            if (isMounted.current) setError(formatError(err));
        } finally {
            if (isMounted.current) setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-500" onClick={onClose}>
            <div className="bg-[#0c0e12] w-full max-w-2xl rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/5 flex flex-col overflow-hidden animate-in zoom-in-95 duration-500 ring-1 ring-white/10" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="p-10 border-b border-white/5 bg-white/[0.02] flex justify-between items-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#7c3aed] blur-[80px] opacity-10 -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative z-10">
                        <h3 className="font-bold text-2xl text-white tracking-tight">Edit Student Profile</h3>
                        <p className="text-sm text-white/40 mt-1 uppercase tracking-wider font-medium">Update information & synchronize with parent data.</p>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-full hover:bg-white/10 text-white/20 hover:text-white transition-all duration-300">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-10 space-y-12 overflow-y-auto max-h-[75vh] custom-scrollbar bg-transparent">
                    {error && (
                        <div className="bg-red-500/10 text-red-500 p-5 rounded-2xl text-xs font-black uppercase tracking-widest border border-red-500/20 flex items-center gap-3 animate-in shake">
                            <span className="text-lg">!</span> {error}
                        </div>
                    )}

                    {/* Identity Section */}
                    <section className="space-y-8">
                        <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                            <div className="h-8 w-8 flex items-center justify-center bg-white/[0.03] text-white/40 rounded-xl border border-white/5">
                                <UserIcon className="w-4 h-4" />
                            </div>
                            <h4 className="text-[10px] font-black uppercase text-white/30 tracking-[0.4em]">Identity & Academic</h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <FloatingInput label="Full Name" name="display_name" value={formData.display_name} onChange={handleChange} required icon={<UserIcon className="w-4 h-4" />} />
                            <FloatingInput label="Student ID" name="student_id_number" value={formData.student_id_number} onChange={handleChange} icon={<div className="w-4 h-4 font-black text-[9px] flex items-center justify-center border border-current rounded uppercase">ID</div>} />
                            <FloatingInput label="Grade / Class" name="grade" value={formData.grade} onChange={handleChange} required icon={<div className="w-4 h-4 font-black text-[9px] flex items-center justify-center uppercase">Gr</div>} />

                            <div className="relative group">
                                <select name="gender" value={formData.gender} onChange={handleChange} className="w-full h-[58px] rounded-2xl border border-white/5 bg-black/40 px-5 pl-12 text-sm text-white shadow-inner focus:border-white/20 focus:ring-4 focus:ring-white/5 outline-none appearance-none cursor-pointer transition-all duration-500">
                                    <option value="" className="bg-[#0c0e12]">Select Gender...</option>
                                    <option value="Male" className="bg-[#0c0e12]">Male</option>
                                    <option value="Female" className="bg-[#0c0e12]">Female</option>
                                    <option value="Other" className="bg-[#0c0e12]">Other</option>
                                </select>
                                <div className="absolute top-1/2 -translate-y-1/2 left-5 text-white/20 pointer-events-none transition-colors group-focus-within:text-white/40"><UserIcon className="w-4 h-4" /></div>
                                <label className="absolute left-10 top-0 -translate-y-1/2 bg-[#0c0e12] px-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Gender</label>
                            </div>

                            <FloatingInput label="Date of Birth" type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} icon={<CalendarIcon className="w-4 h-4" />} />
                        </div>
                    </section>

                    {/* Contact & Guardian Section */}
                    <section className="space-y-8 pb-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                            <div className="flex items-center gap-4">
                                <div className="h-8 w-8 flex items-center justify-center bg-white/[0.03] text-white/40 rounded-xl border border-white/5">
                                    <UsersIcon className="w-4 h-4" />
                                </div>
                                <h4 className="text-[10px] font-black uppercase text-white/30 tracking-[0.4em]">Contact & Guardian</h4>
                            </div>

                            {/* Sync Toggle */}
                            <div className="flex items-center gap-5 bg-white/[0.02] p-2 pl-5 rounded-[1.5rem] border border-white/5 shadow-inner group/sync">
                                {isFetchingParent && <Spinner size="sm" className="text-[#7c3aed]" />}
                                <div className="flex flex-col items-end">
                                    <label className={`text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-500 ease-in-out ${syncWithParent ? 'text-[#7c3aed]' : 'text-white/20'}`}>
                                        {syncWithParent ? 'Auto-Sync Active' : 'Manual Entry'}
                                    </label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={syncWithParent}
                                        onChange={(checked) => {
                                            setSyncWithParent(checked);
                                            if (checked) fetchParent(); // Re-validate on toggle ON
                                        }}
                                        disabled={isFetchingParent}
                                    />
                                    {syncWithParent && (
                                        <button
                                            type="button"
                                            onClick={() => fetchParent()}
                                            disabled={isFetchingParent}
                                            className="p-2 rounded-xl bg-white/5 text-white/20 hover:text-white hover:bg-white/10 transition-all active:scale-90 flex items-center justify-center -mr-1"
                                            title="Force Re-sync Identity"
                                        >
                                            <RefreshIcon className={`w-3.5 h-3.5 ${isFetchingParent ? 'animate-spin text-[#7c3aed]' : ''}`} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {!parentData?.found && !isFetchingParent && (
                            <div className="space-y-6">
                                <div className="p-6 bg-amber-500/5 border border-amber-500/15 rounded-[2rem] text-amber-500 flex flex-col gap-6 font-medium shadow-2xl relative overflow-hidden group/warning">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 group-hover/warning:scale-150 transition-transform duration-1000"></div>
                                    <div className="flex items-start gap-4">
                                        <div className="p-2.5 bg-amber-500/10 rounded-xl">
                                            <AlertTriangleIcon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-grow">
                                            <h5 className="text-[11px] font-black uppercase tracking-[0.2em] mb-1">Identity Sync Failure</h5>
                                            <p className="text-[10px] text-white/40 leading-relaxed uppercase tracking-widest font-bold">
                                                No linked parent profile found. Manual entry required for identity synchronization unless explicitly linked.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col md:flex-row gap-4 pt-2 border-t border-white/5 mt-2">
                                        <div className="flex-grow relative">
                                            <input
                                                type="email"
                                                placeholder="SEARCH PARENT EMAIL..."
                                                value={manualParentEmail}
                                                onChange={(e) => setManualParentEmail(e.target.value)}
                                                className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-5 text-[10px] font-bold tracking-widest outline-none focus:border-amber-500/50 focus:bg-white/[0.08] transition-all placeholder:text-white/20"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleManualLinkByEmail}
                                            disabled={isLinking || !manualParentEmail}
                                            className="px-8 h-12 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 disabled:opacity-30"
                                        >
                                            {isLinking ? <Spinner size="sm" className="text-amber-500" /> : <><PlusIcon className="w-4 h-4" /> Resolve Identity</>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <FloatingInput
                                label="Student Phone"
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                icon={<PhoneIcon className="w-4 h-4" />}
                                readOnly={syncWithParent && parentData?.found}
                                isSynced={syncWithParent && parentData?.found}
                            />
                            <FloatingInput
                                label="Guardian Name / Relationship"
                                name="parent_guardian_details"
                                value={formData.parent_guardian_details}
                                onChange={handleChange}
                                icon={<UsersIcon className="w-4 h-4" />}
                                readOnly={syncWithParent && parentData?.found}
                                isSynced={syncWithParent && parentData?.found}
                            />
                        </div>

                        <FloatingInput
                            label="Residential Address"
                            name="address"
                            value={formData.address}
                            onChange={handleChange as any}
                            icon={<LocationIcon className="w-4 h-4" />}
                            isTextArea
                            readOnly={syncWithParent && parentData?.found}
                            isSynced={syncWithParent && parentData?.found}
                        />
                    </section>

                    {/* Action Bar */}
                    <div className="pt-10 flex justify-end gap-5 border-t border-white/5 sticky bottom-0 z-20 pb-5 bg-transparent backdrop-blur-xl">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-8 py-4 font-black text-[10px] uppercase tracking-[0.3em] text-white/30 hover:text-white transition-all duration-300 active:scale-95"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="relative group overflow-hidden px-12 py-4 bg-[#7c3aed] text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl shadow-[0_15px_45px_rgba(124,58,237,0.3)] hover:bg-[#6d28d9] transition-all transform active:scale-[0.95] flex items-center justify-center gap-3"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                            {loading ? <Spinner size="sm" className="text-white" /> : <><CheckCircleIcon className="w-4 h-4" /> Save Changes</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditStudentDetailsModal;
