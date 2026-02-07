import React, { useState, useRef, useEffect, useCallback, useReducer } from 'react';
import { supabase } from '../../services/supabase';
import { AdmissionApplication } from '../../types';
import { StorageService, BUCKETS } from '../../services/storage';
import Spinner from '../common/Spinner';
import { XIcon } from '../icons/XIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { UserIcon } from '../icons/UserIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { SchoolIcon } from '../icons/SchoolIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { InfoIcon } from '../icons/InfoIcon';
import { PhoneIcon } from '../icons/PhoneIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { LockIcon } from '../icons/LockIcon';
import { EyeIcon } from '../icons/EyeIcon';
import { LocationIcon } from '../icons/LocationIcon';
import CustomSelect from '../common/CustomSelect';
import PremiumAvatar from '../common/PremiumAvatar';
import clsx from 'clsx';

// --- Types & Utilities ---

const resolveSyncError = (err: any): string => {
    if (!err) return "Identity synchronization protocol failed.";
    let message = typeof err === 'string' ? err : err.message || err.error_description || err.details || '';
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('bucket not found')) return "Critical Configuration Mismatch: Storage bucket missing.";
    if (lowerMessage.includes('invalid input syntax')) return "Identity Type Mismatch: Database schema update required.";

    return message || "Institutional node exception.";
};

// --- Consent State Machine (Red) ---

type ConsentState =
    | 'noConsent'
    | 'consentGranted'
    | 'biometricCaptured'
    | 'enrollmentCompleted';

type ConsentAction =
    | { type: 'GRANT_CONSENT' }
    | { type: 'WITHDRAW_CONSENT' }
    | { type: 'CAPTURE_BIOMETRIC' }
    | { type: 'SUBMIT_SUCCESS' };

const consentReducer = (state: ConsentState, action: ConsentAction): ConsentState => {
    switch (action.type) {
        case 'GRANT_CONSENT':
            return state === 'noConsent' ? 'consentGranted' : state;
        case 'WITHDRAW_CONSENT':
            return 'noConsent'; // Reset to initial state
        case 'CAPTURE_BIOMETRIC':
            return state === 'consentGranted' || state === 'biometricCaptured' ? 'biometricCaptured' : state;
        case 'SUBMIT_SUCCESS':
            return 'enrollmentCompleted';
        default:
            return state;
    }
};

// --- Components ---

const ComplianceSectionHeader: React.FC<{
    title: string;
    icon?: React.ReactNode;
    purpose: string;
    badge?: string;
}> = ({ title, icon, purpose, badge }) => (
    <div className="mb-6 mt-4 border-b border-white/[0.03] pb-3 relative group">
        <div className="flex justify-between items-end mb-1.5">
            <div className="flex items-center gap-2.5">
                {icon && <span className="text-primary/60 group-hover:text-primary transition-colors duration-500">{icon}</span>}
                <h4 className="text-[11px] font-black uppercase tracking-[0.25em] text-white/50 group-hover:text-white/80 transition-colors duration-500">{title}</h4>
            </div>
            {badge && (
                <span className="hidden sm:inline-flex px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/5 text-[9px] font-black uppercase tracking-widest text-white/30 group-hover:text-primary/50 group-hover:border-primary/20 transition-all duration-500">
                    {badge}
                </span>
            )}
        </div>
        <p className="text-[10px] text-primary/40 font-mono tracking-tight uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/30 group-hover:bg-primary group-hover:shadow-[0_0_8px_rgba(var(--primary),0.8)] transition-all duration-500"></span>
            {purpose}
        </p>
        <div className="absolute bottom-0 left-0 w-0 h-[1px] bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0 group-hover:w-full transition-all duration-700"></div>
    </div>
);

const PremiumFloatingInput: React.FC<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> & { label: string; icon?: React.ReactNode; isTextArea?: boolean; isSynced?: boolean; helperText?: string }> = ({ label, icon, isTextArea, isSynced, helperText, className, ...props }) => (
    <div className="relative group w-full mb-1">
        <style>{`
            input:-webkit-autofill,
            input:-webkit-autofill:hover, 
            input:-webkit-autofill:focus, 
            input:-webkit-autofill:active {
                -webkit-box-shadow: 0 0 0 30px #0f1116 inset !important;
                -webkit-text-fill-color: white !important;
                transition: background-color 5000s ease-in-out 0s;
            }
        `}</style>

        <label className={`block mb-2 text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-300 ${isSynced ? 'text-primary' : 'text-white/40 group-focus-within:text-white/70 group-hover:text-white/60'}`}>
            {label} {props.required && <span className="text-accent-error">*</span>}
        </label>

        <div className="relative">
            <div className={`absolute top-[18px] left-4 transition-all duration-300 z-10 pointer-events-none ${isSynced ? 'text-primary' : 'text-white/20 group-focus-within:text-primary group-focus-within:scale-110'}`}>
                {icon}
            </div>

            {isTextArea ? (
                <textarea
                    {...(props as any)}
                    className={clsx(
                        "block w-full rounded-xl border bg-[#0f1116] px-5 pl-12 py-4 text-sm font-medium text-white placeholder-white/5 outline-none transition-all duration-300",
                        "border-white/5 hover:border-white/10 focus:border-primary/50 focus:bg-[#13151a]",
                        "focus:ring-4 focus:ring-primary/10 shadow-inner resize-none min-h-[120px]",
                        className
                    )}
                />
            ) : (
                <input
                    autoComplete="off"
                    data-lpignore="true"
                    {...props}
                    className={clsx(
                        "block w-full h-[52px] rounded-xl border bg-[#0f1116] px-5 pl-12 text-sm font-medium text-white placeholder-white/5 outline-none transition-all duration-300",
                        "border-white/5 hover:border-white/10 focus:border-primary/50 focus:bg-[#13151a]",
                        "focus:ring-4 focus:ring-primary/10 shadow-inner",
                        isSynced && "border-primary/30 bg-primary/5 text-primary",
                        className
                    )}
                />
            )}
        </div>
        {helperText && <p className="mt-2 text-[10px] text-white/20 font-medium flex items-center gap-1.5"><InfoIcon className="w-3 h-3" /> {helperText}</p>}
    </div>
);

interface ChildRegistrationModalProps {
    child: AdmissionApplication | null;
    onClose: () => void;
    onSave: () => Promise<void> | void;
    currentUserId: string;
}

const ChildRegistrationModal: React.FC<ChildRegistrationModalProps> = ({ child, onClose, onSave, currentUserId }) => {
    const isEdit = !!child;

    // --- State Machine ---
    const [consentState, dispatch] = useReducer(consentReducer, 'noConsent');

    const [formData, setFormData] = useState({
        applicant_name: child?.applicant_name || '',
        grade: child?.grade || '',
        date_of_birth: child?.date_of_birth || '',
        gender: child?.gender || 'Male',
        medical_info: child?.medical_info || '',
        emergency_contact: child?.emergency_contact || '',
        address: (child as any)?.address || '',
    });

    // Draggable State
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const modalRef = useRef<HTMLDivElement>(null);

    const [parentProfile, setParentProfile] = useState<{ name: string; email: string; phone: string } | null>(null);
    const [isEmergencySynced, setIsEmergencySynced] = useState(false);
    const [photoPreview, setPhotoPreview] = useState<string | null>(child?.profile_photo_url || null);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    useEffect(() => {
        const fetchParent = async () => {
            const { data } = await supabase.from('profiles').select('display_name, email, phone, branch_id').eq('id', currentUserId).maybeSingle();
            if (data) setParentProfile({
                name: data.display_name || '',
                email: data.email,
                phone: data.phone || '',
                branch_id: data.branch_id
            } as any);
        };
        fetchParent();
    }, [currentUserId]);

    // Drag Logic
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button, input, select, textarea, label')) return;
        setIsDragging(true);
        dragStartPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    }, [position]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return;
        setPosition({ x: e.clientX - dragStartPos.current.x, y: e.clientY - dragStartPos.current.y });
    }, [isDragging]);

    const handleMouseUp = useCallback(() => setIsDragging(false), []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (consentState === 'noConsent') return;
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) return alert("Image exceeds 5MB limit.");
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
            dispatch({ type: 'CAPTURE_BIOMETRIC' });
        }
    };

    const handleSyncEmergency = async () => {
        if (isEmergencySynced) {
            setFormData(prev => ({ ...prev, emergency_contact: '' }));
            setIsEmergencySynced(false);
        } else if (parentProfile) {
            setFormData(prev => ({ ...prev, emergency_contact: `${parentProfile.name} / ${parentProfile.phone || 'No Phone'}` }));
            setIsEmergencySynced(true);
        }
    };

    const handleConsentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const isConsenting = e.target.checked;
        if (isConsenting) {
            dispatch({ type: 'GRANT_CONSENT' });
        } else {
            // IMMEDIATE REVOCATION LOGIC
            setPhotoFile(null);
            setPhotoPreview(child?.profile_photo_url || null);
            dispatch({ type: 'WITHDRAW_CONSENT' });
        }
    };

    const handleSubmitDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        // Strict State Machine Check: Must contain active consent
        if (!formData.applicant_name || !currentUserId || consentState === 'noConsent') return;

        setLoading(true);
        setError(null);
        try {
            let finalPhotoPath = child?.profile_photo_url || null;
            if (photoFile) {
                const storagePath = StorageService.getProfilePath('child', currentUserId);
                const { path } = await StorageService.upload(BUCKETS.PROFILES, storagePath, photoFile);
                finalPhotoPath = path;
            }

            const payload: any = {
                applicant_name: formData.applicant_name,
                grade: formData.grade,
                date_of_birth: formData.date_of_birth,
                gender: formData.gender,
                medical_info: formData.medical_info,
                emergency_contact: formData.emergency_contact,
                address: formData.address,
                profile_photo_url: finalPhotoPath,
                parent_name: parentProfile?.name || '',
                parent_email: parentProfile?.email || '',
                parent_phone: parentProfile?.phone || '',
                branch_id: (parentProfile as any)?.branch_id || null,
            };

            if (isEdit) {
                if (child.source_type === 'Enquiry') {
                    payload.user_id = currentUserId;
                    const { error } = await supabase.from('enquiries').update(payload).eq('id', child.id);
                    if (error) throw error;
                } else {
                    payload.parent_id = currentUserId;
                    payload.status = 'Pending Review';
                    const { error } = await supabase.from('admissions').update(payload).eq('id', child.id);
                    if (error) throw error;
                }
            } else {
                // NEW registrations always start as an Enquiry node
                payload.user_id = currentUserId;
                payload.status = 'NEW';
                payload.id = crypto.randomUUID();
                const { error } = await supabase.from('enquiries').insert(payload);
                if (error) throw error;
            }
            dispatch({ type: 'SUBMIT_SUCCESS' });
        } catch (err: any) {
            setError(resolveSyncError(err));
        } finally {
            setLoading(false);
        }
    };

    const handleFinalizeHandshake = async () => {
        setLoading(true);
        try {
            await onSave();
            onClose();
        } catch (err: any) {
            setError(resolveSyncError(err));
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    // Derived States for UI
    const isConsentActive = consentState === 'consentGranted' || consentState === 'biometricCaptured';
    const canSubmit = consentState === 'biometricCaptured'; // Require biometric for this flow (or refine if optional)

    return (
        <div className="fixed inset-0 bg-[#050608]/95 backdrop-blur-xl z-[150] flex items-center justify-center overflow-hidden animate-in fade-in duration-500">
            <div
                ref={modalRef}
                style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
                className={clsx(
                    "bg-[#0a0a0c]/90 shadow-[0_32px_120px_-10px_rgba(0,0,0,0.8)] backdrop-blur-3xl ring-1 ring-white/[0.08] flex flex-col relative",
                    "w-full h-[95dvh] md:h-[90vh] md:max-w-4xl",
                    "md:rounded-[3rem]",
                    "animate-in zoom-in-95 duration-700 overflow-hidden",
                    isDragging && "scale-[1.005] ring-primary/30 cursor-grabbing duration-200"
                )}
            >
                {consentState !== 'enrollmentCompleted' ? (
                    <form onSubmit={handleSubmitDetails} className="flex flex-col h-full relative z-10 w-full">
                        {/* Header - Fixed */}
                        <div
                            onMouseDown={handleMouseDown}
                            className="shrink-0 px-8 py-7 md:px-12 md:py-8 border-b border-white/[0.03] bg-[#0c0e12]/50 backdrop-blur-md flex justify-between items-center cursor-grab active:cursor-grabbing relative"
                        >
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/20 to-transparent"></div>
                            <div className="flex items-center gap-5">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-[inset_0_0_15px_rgba(var(--primary),0.2)] border border-primary/20 group-hover:scale-110 transition-transform duration-500">
                                    <PlusIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-serif font-black text-white tracking-tight uppercase flex items-center gap-1">Register Child<span className="text-primary animate-pulse">.</span></h3>
                                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em]">Identity Enrollment Node</p>
                                </div>
                            </div>
                            <button type="button" onClick={onClose} className="p-3 rounded-2xl hover:bg-white/5 text-white/20 hover:text-white transition-all duration-300 hover:rotate-90">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Scrollable Body - Flexible */}
                        <div className="flex-1 overflow-y-scroll custom-scrollbar p-6 md:p-10 space-y-10 min-h-0">
                            {error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                    <ShieldCheckIcon className="w-4 h-4" /> {error}
                                </div>
                            )}

                            {/* Privacy Handshake / Consent Checkpoint */}
                            <div className={clsx(
                                "p-6 md:p-8 rounded-[2rem] border transition-all duration-700 relative overflow-hidden group/consent",
                                isConsentActive
                                    ? "bg-primary/[0.08] border-primary/30 shadow-[0_0_50px_rgba(var(--primary),0.15)] ring-1 ring-primary/20"
                                    : "bg-white/[0.02] border-white/5 hover:border-white/10"
                            )}>
                                <div className="absolute -top-24 -right-24 w-60 h-60 bg-primary/10 rounded-full blur-[100px] pointer-events-none group-hover/consent:scale-110 transition-transform duration-1000"></div>
                                <div className="absolute -bottom-24 -left-24 w-40 h-40 bg-primary/5 rounded-full blur-[80px] pointer-events-none"></div>

                                <label className="relative z-10 flex items-start gap-6 cursor-pointer">
                                    <div className="relative mt-1 shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={isConsentActive}
                                            onChange={handleConsentChange}
                                            className="peer appearance-none w-7 h-7 rounded-xl border border-white/10 bg-black/40 checked:bg-primary checked:border-primary transition-all duration-500 cursor-pointer ring-offset-4 ring-offset-[#0a0a0c] group-hover/consent:border-white/20"
                                        />
                                        <CheckCircleIcon className="absolute inset-0 text-[#0a0a0c] w-7 h-7 scale-90 opacity-0 peer-checked:opacity-100 peer-checked:scale-100 transition-all duration-500 pointer-events-none" />
                                    </div>
                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.35em] text-primary mb-2 flex items-center gap-2.5">
                                                <LockIcon className="w-3.5 h-3.5 mb-0.5" /> Identity Protocol Authorization
                                            </h4>
                                            <p className="text-[17px] font-medium text-white/90 leading-tight">
                                                I, the legal guardian, <span className="text-white font-bold decoration-primary/30 underline-offset-4 decoration-2">consent</span> to the collection and encrypted processing of identity and <span className="text-primary font-black tracking-tight">biometric data</span>.
                                            </p>
                                        </div>
                                        <p className="text-xs text-white/30 leading-relaxed max-w-xl font-medium tracking-wide">
                                            This data is used strictly for <span className="text-white/60">Institutional Verification & Safety</span>. Encrypted under AES-256 protocols and stored within secure sovereign nodes.
                                        </p>

                                        <div className="pt-2 flex flex-wrap gap-8 text-[10px] font-black uppercase tracking-[0.2em]">
                                            <button type="button" className="text-primary/40 hover:text-primary transition-all duration-300 flex items-center gap-2 group/btn">
                                                <EyeIcon className="w-4 h-4" />
                                                <span className="border-b border-transparent group-hover/btn:border-primary/40 pb-0.5">Data Visibility</span>
                                            </button>
                                            <button type="button" className="text-primary/40 hover:text-primary transition-all duration-300 flex items-center gap-2 group/btn">
                                                <ShieldCheckIcon className="w-4 h-4" />
                                                <span className="border-b border-transparent group-hover/btn:border-primary/40 pb-0.5">Retention Policy</span>
                                            </button>
                                        </div>
                                    </div>
                                </label>
                            </div>

                            {/* Biometric Section */}
                            <div className="flex flex-col items-center justify-center gap-8 py-10 bg-white/[0.01] rounded-[2.5rem] border border-white/[0.03] relative overflow-hidden transition-all duration-500 group/bio hover:bg-white/[0.02]">
                                {!isConsentActive && (
                                    <div className="absolute inset-0 z-20 bg-[#0a0a0c]/80 backdrop-blur-[4px] flex flex-col items-center justify-center gap-4 animate-in fade-in duration-700 pointer-events-none">
                                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shadow-2xl">
                                            <LockIcon className="w-7 h-7 text-white/20" />
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Guardian Consent Required</p>
                                    </div>
                                )}

                                <div className={clsx("relative group/avatar transition-all duration-1000", !isConsentActive && "blur-md opacity-40")}>
                                    <div className="absolute -inset-8 bg-primary/20 rounded-full blur-3xl opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-1000 animate-pulse"></div>
                                    <div className="absolute -inset-1 bg-gradient-to-br from-primary via-primary/50 to-transparent rounded-full opacity-20 group-hover/avatar:opacity-40 transition-opacity duration-700"></div>
                                    <PremiumAvatar
                                        src={photoPreview}
                                        name={formData.applicant_name || '?'}
                                        size="lg"
                                        className="w-32 h-32 md:w-40 md:h-40 rounded-full ring-8 ring-[#0a0a0c] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)] relative z-10 hover:scale-[1.02] transition-transform duration-700"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => isConsentActive && fileInputRef.current?.click()}
                                        disabled={!isConsentActive}
                                        className="absolute bottom-2 right-2 p-4 bg-primary text-white rounded-2xl shadow-[0_0_30px_rgba(var(--primary),0.5)] ring-4 ring-[#0a0a0c] hover:bg-primary/90 hover:scale-110 active:scale-95 transition-all z-20 disabled:hidden group/upload-btn"
                                    >
                                        <UploadIcon className="w-6 h-6 group-hover/upload-btn:rotate-12 transition-transform" />
                                    </button>
                                </div>
                                <div className={clsx("text-center space-y-2 transition-opacity duration-700", !isConsentActive && "opacity-20")}>
                                    <p className="text-[11px] font-black text-primary uppercase tracking-[0.4em] flex items-center justify-center gap-2.5">
                                        <ShieldCheckIcon className="w-4 h-4 mb-0.5" /> Secure Biometric Identity
                                    </p>
                                    <p className="text-xs text-white/30 font-medium tracking-wide">Encrypted (AES-256) & Access Controlled. <br />Private ledger storage only.</p>
                                </div>
                                <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handlePhotoChange} />
                            </div>

                            <div className="space-y-8">
                                <div>
                                    <ComplianceSectionHeader
                                        title="Child Identity"
                                        icon={<UserIcon className="w-3 h-3" />}
                                        purpose="Used strictly for Identity Verification"
                                        badge="DPDP Compliant"
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <PremiumFloatingInput
                                            label="Full Legal Name"
                                            name="applicant_name"
                                            value={formData.applicant_name}
                                            onChange={handleChange}
                                            required
                                            icon={<UserIcon className="w-4 h-4" />}
                                            placeholder="e.g. Arabella Rose"
                                        />
                                        <PremiumFloatingInput
                                            label="Date of Birth"
                                            name="date_of_birth"
                                            type="date"
                                            value={formData.date_of_birth}
                                            onChange={handleChange}
                                            required
                                            icon={<CalendarIcon className="w-4 h-4" />}
                                            helperText="Needed for age-appropriate placement."
                                        />
                                        <CustomSelect
                                            label="Gender Identity"
                                            value={formData.gender}
                                            onChange={(v) => setFormData(prev => ({ ...prev, gender: v }))}
                                            options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Prefer Not to Say' }]}
                                            icon={<UserIcon className="w-4 h-4" />}
                                        />
                                        <div className="md:col-span-2">
                                            <PremiumFloatingInput
                                                label="Residential Address"
                                                name="address"
                                                value={formData.address}
                                                onChange={handleChange}
                                                icon={<LocationIcon className="w-4 h-4" />}
                                                placeholder="e.g. 123 Sky Tower, Downtown"
                                                helperText="Official residential registry for student records."
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <ComplianceSectionHeader
                                        title="Academic Placement"
                                        icon={<SchoolIcon className="w-3 h-3" />}
                                        purpose="Required for Class Assignment"
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <CustomSelect
                                            label="Target Grade"
                                            value={formData.grade}
                                            onChange={(v) => setFormData(prev => ({ ...prev, grade: v }))}
                                            options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Grade ${i + 1}` }))}
                                            icon={<SchoolIcon className="w-4 h-4" />}
                                            placeholder="Select Grade Level"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between">
                                        <ComplianceSectionHeader
                                            title="Safety & Clinical"
                                            icon={<ShieldCheckIcon className="w-3 h-3" />}
                                            purpose="School Safety Compliance Only"
                                            badge="Restricted Access"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleSyncEmergency}
                                            className="text-[9px] font-bold text-primary hover:text-primary/80 uppercase tracking-widest flex items-center gap-1.5 transition-colors mb-4"
                                        >
                                            <SparklesIcon className="w-3 h-3" /> {isEmergencySynced ? 'Synced' : 'Use My Data'}
                                        </button>
                                    </div>
                                    <div className="space-y-6">
                                        <PremiumFloatingInput
                                            label="Emergency Guardian"
                                            name="emergency_contact"
                                            value={formData.emergency_contact}
                                            onChange={handleChange}
                                            isSynced={isEmergencySynced}
                                            icon={<PhoneIcon className="w-4 h-4" />}
                                            placeholder="Primary Contact Name & Number"
                                            helperText="Used ONLY for urgent security protocols."
                                        />
                                        <PremiumFloatingInput
                                            label="Medical Notes"
                                            name="medical_info"
                                            value={formData.medical_info}
                                            onChange={handleChange}
                                            isTextArea
                                            icon={<InfoIcon className="w-4 h-4" />}
                                            placeholder="List any allergies, conditions, or dietary requirements..."
                                            helperText="Encrypted. Accessible only by authorized medical staff."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer - Fixed */}
                        <div className="shrink-0 p-8 md:p-10 border-t border-white/[0.03] bg-[#0c0e12]/80 backdrop-blur-md flex flex-col md:flex-row justify-between items-center gap-6 relative">
                            <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>

                            <div className="flex items-center gap-3 text-white/20 order-3 md:order-1 md:mr-auto group/secure">
                                <LockIcon className="w-3.5 h-3.5 group-hover/secure:text-primary transition-colors duration-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">Encrypted at rest & in transit</span>
                            </div>

                            <button type="button" onClick={onClose} className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 hover:text-white/60 transition-all duration-300 order-2">
                                Discard
                            </button>
                            <button
                                type="submit"
                                disabled={loading || !formData.applicant_name || !formData.date_of_birth || !canSubmit}
                                className="w-full md:w-auto px-12 py-5 bg-primary hover:bg-primary/90 disabled:opacity-20 disabled:cursor-not-allowed disabled:grayscale text-white rounded-[1.2rem] shadow-[0_10px_40px_-5px_rgba(var(--primary),0.4)] hover:shadow-[0_15px_50px_-5px_rgba(var(--primary),0.6)] flex items-center justify-center gap-4 transition-all duration-500 transform active:scale-[0.98] group/submit order-1 md:order-3 overflow-hidden relative"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                                {loading ? <Spinner size="sm" className="text-white" /> : (
                                    <>
                                        <CheckCircleIcon className="w-5 h-5 group-hover:scale-110 transition-transform duration-500" />
                                        <span className="text-xs font-black uppercase tracking-[0.3em]">Initialize Enrollment</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-10 space-y-10 animate-in zoom-in-95 duration-1000">
                        <div className="relative">
                            <div className="absolute -inset-10 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"></div>
                            <div className="relative flex flex-col items-center">
                                <PremiumAvatar
                                    src={photoPreview}
                                    name={formData.applicant_name}
                                    size="xl"
                                    className="ring-8 ring-emerald-500/10 shadow-[0_0_60px_rgba(16,185,129,0.2)]"
                                />
                                <div className="absolute -bottom-4 bg-emerald-500 text-[#0a0a0c] p-2.5 rounded-2xl shadow-2xl ring-4 ring-[#0a0a0c] animate-bounce">
                                    <CheckCircleIcon className="w-6 h-6" />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4 max-w-md">
                            <h2 className="text-3xl font-serif font-black text-white tracking-tight">Identity Synchronized</h2>
                            <p className="text-white/50 text-sm leading-relaxed">
                                The enrollment node for <strong className="text-white">{formData.applicant_name}</strong> has been successfully broadcast to the institutional ledger.
                            </p>
                        </div>
                        <button
                            onClick={handleFinalizeHandshake}
                            className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold uppercase tracking-widest text-white transition-all"
                        >
                            Close Protocol
                        </button>
                    </div>
                )}
            </div>
            {/* Inject Custom Scrollbar Styles */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.25);
                    border-radius: 10px;
                    border: 2px solid transparent;
                    background-clip: content-box;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: rgba(255, 255, 255, 0.4);
                }
            `}</style>
        </div>
    );
};

export default ChildRegistrationModal;