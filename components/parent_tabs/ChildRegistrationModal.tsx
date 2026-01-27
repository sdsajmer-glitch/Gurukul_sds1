import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../services/supabase';
import { AdmissionApplication } from '../../types';
import { StorageService, BUCKETS } from '../../services/storage';
import Spinner from '../common/Spinner';
import { XIcon } from '../icons/XIcon';
import { XCircleIcon } from '../icons/XCircleIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { UserIcon } from '../icons/UserIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { SchoolIcon } from '../icons/SchoolIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { InfoIcon } from '../icons/InfoIcon';
import { PhoneIcon } from '../icons/PhoneIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import CustomSelect from '../common/CustomSelect';
import PremiumAvatar from '../common/PremiumAvatar';

const resolveSyncError = (err: any): string => {
    if (!err) return "Identity synchronization protocol failed.";

    let message = '';
    if (typeof err === 'string') {
        message = err;
    } else {
        message = err.message || err.error_description || err.details || err.hint || err.error || '';
    }

    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('bucket not found')) {
        return "Critical Configuration Mismatch: The institutional cloud bucket 'profiles' or 'documents' has not been initialized. Please contact the system architect to verify bucket naming conventions.";
    }

    if (lowerMessage.includes('invalid input syntax for type bigint') && /[\da-f]{8}-[\da-f]{4}/.test(lowerMessage)) {
        return "Identity Type Mismatch: The admissions registry uses an outdated numeric ID. Please apply the latest `schema.txt` update via the Supabase SQL Editor to resolve this protocol exception.";
    }

    return typeof message === 'string' ? message : "Institutional node exception.";
};

const PremiumFloatingInput: React.FC<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> & { label: string; icon?: React.ReactNode; isTextArea?: boolean; isSynced?: boolean }> = ({ label, icon, isTextArea, isSynced, className, ...props }) => (
    <div className="relative group w-full">
        {label && (
            <label className={`absolute left-10 top-0 -translate-y-1/2 bg-[#0a0a0c] px-2 text-[9px] font-black uppercase text-white/30 tracking-[0.3em] z-20 transition-all duration-300 group-focus-within:text-primary ${isSynced ? 'text-primary' : ''}`}>
                {label}
            </label>
        )}
        <div className={`absolute ${isTextArea ? 'top-6' : 'top-1/2 -translate-y-1/2'} left-5 text-white/10 group-focus-within:text-primary transition-all duration-500 z-10 pointer-events-none ${isSynced ? 'text-primary/60' : ''}`}>
            {icon}
        </div>
        {isTextArea ? (
            <textarea
                {...(props as any)}
                placeholder=" "
                className={`peer block w-full h-32 rounded-[1.8rem] border transition-all duration-500 px-6 pl-14 pt-6 pb-2 text-sm text-white font-medium bg-white/[0.01] outline-none placeholder-transparent border-white/5 hover:border-white/10 focus:border-primary/50 focus:ring-8 focus:ring-primary/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] focus:bg-white/[0.03] ${className}`}
            />
        ) : (
            <input
                {...props}
                placeholder=" "
                className={`peer block w-full h-[64px] rounded-[1.5rem] border transition-all duration-500 px-6 pl-14 pt-4 pb-1 text-sm text-white font-medium bg-white/[0.01] outline-none placeholder-transparent border-white/5 hover:border-white/10 focus:border-primary/50 focus:ring-8 focus:ring-primary/5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] focus:bg-white/[0.03] ${isSynced ? 'border-primary/40 bg-primary/5' : ''} ${className}`}
            />
        )}
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
    const [step, setStep] = useState<'details' | 'success'>('details');
    const [formData, setFormData] = useState({
        applicant_name: child?.applicant_name || '',
        grade: child?.grade || '',
        date_of_birth: child?.date_of_birth || '',
        gender: child?.gender || 'Male',
        medical_info: child?.medical_info || '',
        emergency_contact: child?.emergency_contact || '',
    });

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
            const { data } = await supabase.from('profiles').select('display_name, email, phone').eq('id', currentUserId).maybeSingle();
            if (data) {
                setParentProfile({ name: data.display_name || '', email: data.email, phone: data.phone || '' });
            }
        };
        fetchParent();
    }, [currentUserId]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input') || (e.target as HTMLElement).closest('select')) return;
        setIsDragging(true);
        dragStartPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return;
        const newX = e.clientX - dragStartPos.current.x;
        const newY = e.clientY - dragStartPos.current.y;
        setPosition({ x: newX, y: newY });
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
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) return alert("Exceeds 5MB limit.");
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleSyncEmergency = async () => {
        if (isEmergencySynced) {
            setFormData(prev => ({ ...prev, emergency_contact: '' }));
            setIsEmergencySynced(false);
            return;
        }
        if (parentProfile) {
            setFormData(prev => ({ ...prev, emergency_contact: `${parentProfile.name} / ${parentProfile.phone || 'NO_PHONE'}` }));
            setIsEmergencySynced(true);
        }
    };

    const handleSubmitDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.applicant_name || !currentUserId) return;
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
                profile_photo_url: finalPhotoPath,
                parent_id: currentUserId,
                parent_name: parentProfile?.name || '',
                parent_email: parentProfile?.email || '',
                parent_phone: parentProfile?.phone || '',
                status: 'Pending Review'
            };

            if (isEdit) {
                const { error } = await supabase.from('admissions').update(payload).eq('id', child.id);
                if (error) throw error;
            } else {
                payload.id = crypto.randomUUID();
                const { error } = await supabase.from('admissions').insert(payload);
                if (error) throw error;
            }
            setStep('success');
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
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[150] flex items-center justify-center p-4 overflow-hidden animate-in fade-in duration-700">
            <div
                ref={modalRef}
                style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
                className={`bg-[#07080a] w-full max-w-2xl h-full md:h-auto md:max-h-[92vh] rounded-[2.5rem] md:rounded-[4rem] shadow-[0_64px_128px_-24px_rgba(0,0,0,1)] border border-white/10 flex flex-col relative animate-in zoom-in-95 duration-700 ring-1 ring-white/5 transition-all
                    ${isDragging ? 'shadow-primary/30 scale-[1.01] border-primary/20' : ''}`}
                onClick={e => e.stopPropagation()}
            >
                {step === 'details' ? (
                    <form onSubmit={handleSubmitDetails} className="flex flex-col h-full relative z-10 overflow-hidden select-text">
                        {/* Elegant Header */}
                        <div
                            onMouseDown={handleMouseDown}
                            className={`px-8 py-8 md:px-12 md:py-10 border-b border-white/[0.03] bg-white/[0.01] backdrop-blur-3xl flex justify-between items-center shrink-0 cursor-grab active:cursor-grabbing transition-all ${isDragging ? 'bg-primary/5' : ''}`}
                        >
                            <div className="flex items-center gap-6">
                                <div className="w-14 h-14 bg-primary/10 rounded-[1.25rem] text-primary shadow-inner border border-primary/20 flex items-center justify-center">
                                    <PlusIcon className="w-7 h-7" />
                                </div>
                                <div>
                                    <h3 className="text-2xl md:text-3xl font-serif font-black text-white tracking-tighter uppercase leading-none">
                                        REGISTER <span className="text-white/20 italic">CHILD.</span>
                                    </h3>
                                    <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.5em] mt-2">IDENTITY ENROLLMENT NODE</p>
                                </div>
                            </div>
                            <button type="button" onClick={onClose} className="w-12 h-12 rounded-full bg-white/5 text-white/20 hover:text-white hover:bg-white/10 hover:rotate-90 transition-all flex items-center justify-center">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Immersive Body */}
                        <div className="px-8 py-8 md:px-12 md:py-10 overflow-y-auto flex-grow space-y-12 custom-scrollbar">
                            {error && (
                                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-start gap-4 shadow-2xl">
                                    <XCircleIcon className="w-6 h-6 text-red-500 mt-1" />
                                    <div className="space-y-1">
                                        <p className="text-[11px] font-black text-red-500 uppercase tracking-widest">PROTOCOL EXCEPTION</p>
                                        <p className="text-xs text-white/60 font-medium leading-relaxed">{error}</p>
                                    </div>
                                </motion.div>
                            )}

                            {/* Avatar Sub-Module */}
                            <div className="flex flex-col items-center gap-6 group/avatar relative">
                                <div className="absolute inset-0 bg-primary/5 blur-[100px] rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-1000" />
                                <div className="relative">
                                    <div className="w-36 h-36 rounded-full bg-gradient-to-tr from-primary/20 to-transparent p-1 shadow-2xl">
                                        <div className="w-full h-full rounded-full bg-[#07080a] relative overflow-hidden group/img">
                                            <PremiumAvatar
                                                src={photoPreview}
                                                name={formData.applicant_name || 'C'}
                                                size="lg"
                                                className="w-full h-full border-none"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                                <SparklesIcon className="w-10 h-10 text-white/40" />
                                            </div>
                                        </div>
                                    </div>
                                    <motion.button
                                        whileHover={{ scale: 1.1, rotate: 15 }}
                                        whileTap={{ scale: 0.9 }}
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute -bottom-1 -right-1 w-12 h-12 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center shadow-[0_10px_30px_rgba(var(--primary),0.5)] border-4 border-[#07080a] z-30"
                                    >
                                        <UploadIcon className="w-6 h-6" />
                                    </motion.button>
                                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handlePhotoChange} />
                                </div>
                                <div className="text-center">
                                    <h4 className="text-[11px] font-black text-white/20 uppercase tracking-[0.5em] mb-1">BIOMETRIC INTERFACE</h4>
                                    <div className="h-px w-12 bg-white/10 mx-auto" />
                                </div>
                            </div>

                            {/* Forms Module */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
                                <PremiumFloatingInput label="Full Legal Name" name="applicant_name" value={formData.applicant_name} onChange={handleChange} required icon={<UserIcon className="w-5 h-5" />} />
                                <CustomSelect
                                    label="Academic Placement"
                                    value={formData.grade}
                                    onChange={(v) => setFormData(prev => ({ ...prev, grade: v }))}
                                    options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Grade ${i + 1}` }))}
                                    icon={<SchoolIcon className="w-5 h-5" />}
                                />
                                <PremiumFloatingInput label="Date of Birth" name="date_of_birth" type="date" value={formData.date_of_birth} onChange={handleChange} required icon={<CalendarIcon className="w-5 h-5" />} />
                                <CustomSelect
                                    label="Gender Node"
                                    value={formData.gender}
                                    onChange={(v) => setFormData(prev => ({ ...prev, gender: v }))}
                                    options={[{ value: 'Male', label: 'Male Vector' }, { value: 'Female', label: 'Female Vector' }, { value: 'Other', label: 'Diverse Matrix' }]}
                                    icon={<UserIcon className="w-5 h-5" />}
                                />

                                <div className="md:col-span-2 space-y-6">
                                    <div className="flex justify-between items-center px-2">
                                        <label className="text-[11px] font-black uppercase text-white/20 tracking-[0.4em]">SAFETY CONTACT</label>
                                        <button
                                            type="button"
                                            onClick={handleSyncEmergency}
                                            className={`flex items-center gap-2.5 px-4 py-2 rounded-full border transition-all duration-500 group/sync
                                                ${isEmergencySynced
                                                    ? 'bg-primary/10 border-primary/30 text-primary shadow-[0_0_20px_rgba(var(--primary),0.2)]'
                                                    : 'bg-white/5 border-white/5 text-white/20 hover:text-white/60 hover:bg-white/10'
                                                }`}
                                        >
                                            <SparklesIcon className={`w-3.5 h-3.5 ${isEmergencySynced ? 'animate-pulse' : 'group-hover/sync:rotate-12 transition-transform'}`} />
                                            <span className="text-[9px] font-black uppercase tracking-[0.2em]">{isEmergencySynced ? 'SYNCHRONIZED' : 'SYNC MY DATA'}</span>
                                        </button>
                                    </div>
                                    <PremiumFloatingInput
                                        label=""
                                        name="emergency_contact"
                                        value={formData.emergency_contact}
                                        onChange={handleChange}
                                        isSynced={isEmergencySynced}
                                        icon={<PhoneIcon className="w-5 h-5" />}
                                        placeholder="GUARDIAN NAME / SECURE LINE..."
                                    />
                                </div>

                                <div className="md:col-span-2 pt-2">
                                    <label className="text-[11px] font-black uppercase text-white/20 tracking-[0.4em] mb-4 block px-2">CLINICAL DISCLOSURES</label>
                                    <PremiumFloatingInput
                                        label=""
                                        name="medical_info"
                                        value={formData.medical_info}
                                        onChange={handleChange}
                                        isTextArea
                                        icon={<InfoIcon className="w-5 h-5" />}
                                        placeholder="DEFINE ALLERGIES OR SPECIAL REQUIREMENTS..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Premium Footer */}
                        <div className="px-8 py-8 md:px-12 md:py-10 border-t border-white/[0.03] bg-white/[0.01] flex flex-col md:flex-row justify-between items-center gap-8 shrink-0">
                            <button type="button" onClick={onClose} disabled={loading} className="text-[11px] font-black text-white/10 hover:text-white/40 transition-all uppercase tracking-[0.6em] order-2 md:order-1">
                                DISCARD <span className="italic">PROTOCOL</span>
                            </button>
                            <motion.button
                                whileHover={{ scale: 1.02, boxShadow: "0 20px 40px -10px rgba(var(--primary), 0.5)" }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={loading || !formData.applicant_name}
                                className="w-full md:w-auto px-16 py-6 bg-primary text-primary-foreground rounded-[1.75rem] font-black text-[13px] uppercase tracking-[0.4em] shadow-2xl transition-all flex items-center justify-center gap-5 group disabled:opacity-20 order-1 md:order-2"
                            >
                                {loading ? <Spinner size="sm" className="text-white" /> : (
                                    <>
                                        INITIALIZE <span className="opacity-40 italic">ENROLLMENT</span>
                                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/40 transition-colors">
                                            <CheckCircleIcon className="w-4 h-4" />
                                        </div>
                                    </>
                                )}
                            </motion.button>
                        </div>
                    </form>
                ) : (
                    <div className="p-12 md:p-24 text-center space-y-16 animate-in zoom-in-95 duration-1000 h-full flex flex-col items-center justify-center">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-emerald-500/20 blur-[120px] rounded-full group-hover:scale-150 transition-transform duration-1000"></div>
                            <CheckCircleIcon animate className="w-32 h-32 md:w-48 md:h-48 text-emerald-500 relative z-10 drop-shadow-[0_0_50px_rgba(16,185,129,0.5)]" />
                        </div>
                        <div className="space-y-6">
                            <h2 className="text-4xl md:text-6xl font-serif font-black text-white tracking-tighter uppercase leading-none">
                                REGISTRY <span className="text-white/20 italic">UPDATED.</span>
                            </h2>
                            <p className="text-white/40 text-lg md:text-xl leading-relaxed max-w-lg mx-auto font-serif italic">
                                The enrollment protocol for <span className="text-white font-bold not-italic">{formData.applicant_name}</span> has been successfully integrated into the institutional cluster.
                            </p>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleFinalizeHandshake}
                            disabled={loading}
                            className="w-full max-w-md py-7 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-[0.6em] rounded-[2rem] shadow-[0_20px_40px_-10px_rgba(16,185,129,0.4)] transition-all"
                        >
                            FINALIZE HANDSHAKE
                        </motion.button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChildRegistrationModal;