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
    <div className="mb-6 mt-4 border-b border-white/5 pb-2">
        <div className="flex justify-between items-end mb-1">
            <div className="flex items-center gap-2">
                {icon && <span className="text-primary/80">{icon}</span>}
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">{title}</h4>
            </div>
            {badge && (
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-[9px] font-medium text-white/30">
                    {badge}
                </span>
            )}
        </div>
        <p className="text-[10px] text-primary/40 font-mono tracking-tight uppercase flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-primary/40"></span>
            {purpose}
        </p>
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

        <label className={`block mb-2 text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-300 ${isSynced ? 'text-primary' : 'text-white/40 group-focus-within:text-white/70'}`}>
            {label} {props.required && <span className="text-accent-error">*</span>}
        </label>

        <div className="relative">
            <div className={`absolute top-4 left-4 transition-colors duration-300 z-10 pointer-events-none ${isSynced ? 'text-primary' : 'text-white/20 group-focus-within:text-primary'}`}>
                {icon}
            </div>

            {isTextArea ? (
                <textarea
                    {...(props as any)}
                    className={clsx(
                        "block w-full rounded-2xl border bg-[#0f1116] px-5 pl-12 py-4 text-sm font-medium text-white placeholder-white/10 outline-none transition-all duration-300",
                        "border-white/5 hover:border-white/10 focus:border-primary/50 focus:bg-[#13151a]",
                        "focus:ring-4 focus:ring-primary/10 shadow-inner resize-none min-h-[100px]",
                        className
                    )}
                />
            ) : (
                <input
                    autoComplete="off"
                    data-lpignore="true"
                    {...props}
                    className={clsx(
                        "block w-full h-[52px] rounded-xl border bg-[#0f1116] px-5 pl-12 text-sm font-medium text-white placeholder-white/10 outline-none transition-all duration-300",
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
                    "bg-[#0a0a0c] shadow-2xl ring-1 ring-white/10 flex flex-col relative",
                    "w-full h-[90dvh] md:h-[85vh] md:max-w-3xl",
                    "md:rounded-[2.5rem]",
                    "animate-in zoom-in-95 duration-500 overflow-hidden",
                    isDragging && "scale-[1.01] shadow-primary/10 cursor-grabbing"
                )}
            >
                {consentState !== 'enrollmentCompleted' ? (
                    <form onSubmit={handleSubmitDetails} className="flex flex-col h-full relative z-10 w-full">
                        {/* Header - Fixed */}
                        <div
                            onMouseDown={handleMouseDown}
                            className="shrink-0 px-6 py-5 md:px-10 md:py-6 border-b border-white/5 bg-[#0c0e12] flex justify-between items-center cursor-grab active:cursor-grabbing"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-[inset_0_0_10px_rgba(var(--primary),0.2)]">
                                    <PlusIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-serif font-black text-white tracking-tight uppercase">Register Child<span className="text-primary">.</span></h3>
                                    <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.3em]">Identity Enrollment Node</p>
                                </div>
                            </div>
                            <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-white/5 text-white/30 hover:text-white transition-colors">
                                <XIcon className="w-5 h-5" />
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
                                "p-6 md:p-8 rounded-[2rem] border transition-all duration-500 relative overflow-hidden",
                                isConsentActive
                                    ? "bg-primary/10 border-primary/30 shadow-[0_0_40px_rgba(var(--primary),0.1)]"
                                    : "bg-white/[0.02] border-white/10 hover:border-white/20"
                            )}>
                                <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-[80px] pointer-events-none"></div>

                                <label className="relative z-10 flex items-start gap-5 cursor-pointer group">
                                    <div className="relative mt-1 shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={isConsentActive}
                                            onChange={handleConsentChange}
                                            className="peer appearance-none w-6 h-6 rounded-lg border border-white/20 bg-black/40 checked:bg-primary checked:border-primary transition-all cursor-pointer ring-offset-2 ring-offset-[#0a0a0c] focus:ring-2 focus:ring-primary/50"
                                        />
                                        <CheckCircleIcon className="absolute inset-0 text-[#0a0a0c] w-6 h-6 scale-90 opacity-0 peer-checked:opacity-100 peer-checked:scale-110 transition-all pointer-events-none" />
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <div>
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80 mb-1.5 flex items-center gap-2">
                                                <LockIcon className="w-3 h-3" /> Identity Protocol Authorization
                                            </h4>
                                            <p className="text-[15px] font-medium text-white/90 leading-relaxed">
                                                I, the legal guardian, <span className="text-white">consent</span> to the collection and encrypted processing of my child's identity and <span className="text-primary/90 font-bold">biometric data</span>.
                                            </p>
                                        </div>
                                        <p className="text-xs text-white/40 leading-relaxed max-w-xl">
                                            This data is used strictly for <span className="text-white/60">Institutional Verification & Safety</span>. I understand I can revoke this consent or request data deletion at any time via the Parent Portal.
                                        </p>

                                        <div className="pt-2 flex flex-wrap gap-6 text-[10px] font-bold uppercase tracking-widest">
                                            <button type="button" className="text-primary/60 hover:text-primary transition-colors flex items-center gap-2 group/btn">
                                                <EyeIcon className="w-3.5 h-3.5" />
                                                <span className="border-b border-white/5 group-hover/btn:border-primary/30 pb-0.5">Data Visibility</span>
                                            </button>
                                            <button type="button" className="text-primary/60 hover:text-primary transition-colors flex items-center gap-2 group/btn">
                                                <ShieldCheckIcon className="w-3.5 h-3.5" />
                                                <span className="border-b border-white/5 group-hover/btn:border-primary/30 pb-0.5">Retention Policy</span>
                                            </button>
                                        </div>
                                    </div>
                                </label>
                            </div>

                            {/* Biometric Section */}
                            <div className="flex flex-col items-center justify-center gap-6 py-4 bg-white/[0.02] rounded-3xl border border-white/5 relative overflow-hidden transition-all duration-500">
                                {!isConsentActive && (
                                    <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 animate-in fade-in duration-700 pointer-events-none">
                                        <LockIcon className="w-8 h-8 text-white/30" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Guardian Consent Required</p>
                                    </div>
                                )}

                                <div className={clsx("relative group/avatar transition-all duration-700", !isConsentActive && "blur-sm opacity-50")}>
                                    <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-1000 animate-pulse"></div>
                                    <PremiumAvatar
                                        src={photoPreview}
                                        name={formData.applicant_name || '?'}
                                        size="lg"
                                        className="w-28 h-28 md:w-32 md:h-32 rounded-full ring-4 ring-[#0a0a0c] shadow-2xl relative z-10 hover:scale-105 transition-transform duration-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => isConsentActive && fileInputRef.current?.click()}
                                        disabled={!isConsentActive}
                                        className="absolute bottom-1 right-1 p-3.5 bg-primary text-white rounded-2xl shadow-[0_0_20px_rgba(var(--primary),0.4)] ring-4 ring-[#0a0a0c] hover:bg-primary/90 hover:scale-110 active:scale-90 transition-all z-20 disabled:hidden group/btn"
                                    >
                                        <UploadIcon className="w-5 h-5 group-hover/btn:rotate-12 transition-transform" />
                                    </button>
                                </div>
                                <div className={clsx("text-center space-y-1 transition-opacity duration-500", !isConsentActive && "opacity-30")}>
                                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] flex items-center justify-center gap-2">
                                        <ShieldCheckIcon className="w-3 h-3" /> Secure Biometric Identity
                                    </p>
                                    <p className="text-xs text-text-tertiary">Encrypted (AES-256) & Access Controlled. <br />This does not store images publicly.</p>
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
                        <div className="shrink-0 p-6 md:p-8 border-t border-white/5 bg-[#0c0e12] flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-2 text-white/20 order-3 md:order-1 md:mr-auto">
                                <LockIcon className="w-3 h-3" />
                                <span className="text-[9px] font-medium tracking-wide">Encrypted at rest & in transit</span>
                            </div>

                            <button type="button" onClick={onClose} className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 hover:text-white transition-colors order-2">
                                Discard
                            </button>
                            <button
                                type="submit"
                                disabled={loading || !formData.applicant_name || !formData.date_of_birth || !canSubmit}
                                className="w-full md:w-auto px-10 py-4 bg-primary hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed disabled:grayscale text-white rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-3 transition-all transform active:scale-95 order-1 md:order-3"
                            >
                                {loading ? <Spinner size="sm" className="text-white" /> : <><CheckCircleIcon className="w-4 h-4" /> <span className="text-xs font-black uppercase tracking-[0.25em]">Initialize Enrollment</span></>}
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