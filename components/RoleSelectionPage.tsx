
import React, { useState, useEffect } from 'react';
import { Role, BuiltInRoles } from '../types';
import { ROLE_ICONS, ROLE_ORDER } from '../constants';
import { useRoles } from '../contexts/RoleContext';
import Spinner from './common/Spinner';
import { supabase } from '../services/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from './icons/XIcon';
import { SchoolIcon } from './icons/SchoolIcon';
import { UsersIcon } from './icons/UsersIcon';
import { InfoIcon } from './icons/InfoIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { ShieldCheckIcon } from './icons/ShieldCheckIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';

interface RoleSelectionPageProps {
    onRoleSelect: (role: Role) => Promise<void> | void;
    onComplete: () => void;
}

const ROLE_META: Record<string, { label: string; description: string; color: string; gradient: string; shadow: string }> = {
    [BuiltInRoles.SCHOOL_ADMINISTRATION]: {
        label: 'School Administration',
        description: 'Govern institutional operations, multi-branch strategy, and global oversight.',
        color: 'text-purple-500',
        gradient: 'from-purple-500/20 via-indigo-500/10 to-transparent',
        shadow: 'group-hover:shadow-purple-500/20',
    },
    [BuiltInRoles.PRINCIPAL]: {
        label: 'Principal / Director',
        description: 'Lead academic excellence and oversee institutional growth and faculty development.',
        color: 'text-indigo-500',
        gradient: 'from-indigo-500/20 via-blue-500/10 to-transparent',
        shadow: 'group-hover:shadow-indigo-500/20',
    },
    [BuiltInRoles.HR_MANAGER]: {
        label: 'HR Management',
        description: 'Manage human capital, recruitment, and organizational compliance.',
        color: 'text-cyan-500',
        gradient: 'from-cyan-500/20 via-blue-500/10 to-transparent',
        shadow: 'group-hover:shadow-cyan-500/20',
    },
    [BuiltInRoles.ACADEMIC_COORDINATOR]: {
        label: 'Academic Coordinator',
        description: 'Synchronize curriculum delivery and maintain pedagogical standards.',
        color: 'text-amber-500',
        gradient: 'from-amber-500/20 via-yellow-500/10 to-transparent',
        shadow: 'group-hover:shadow-amber-500/20',
    },
    [BuiltInRoles.ACCOUNTANT]: {
        label: 'Financial Controller',
        description: 'Oversee fiscal health, fee collections, and institutional financial reporting.',
        color: 'text-emerald-500',
        gradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
        shadow: 'group-hover:shadow-emerald-500/20',
    },
    [BuiltInRoles.TEACHER]: {
        label: 'Faculty Member',
        description: 'Empower students, manage dynamic classrooms, and curate learning experiences.',
        color: 'text-blue-500',
        gradient: 'from-blue-500/20 via-cyan-500/10 to-transparent',
        shadow: 'group-hover:shadow-blue-500/20',
    },
    [BuiltInRoles.STUDENT]: {
        label: 'Student Portal',
        description: 'Access your academic timeline, assignments, and digital learning resources.',
        color: 'text-teal-500',
        gradient: 'from-teal-500/20 via-emerald-500/10 to-transparent',
        shadow: 'group-hover:shadow-teal-500/20',
    },
    [BuiltInRoles.PARENT_GUARDIAN]: {
        label: 'Parent / Guardian',
        description: 'Partner in your child\'s educational journey and manage family institutional needs.',
        color: 'text-rose-500',
        gradient: 'from-rose-500/20 via-pink-500/10 to-transparent',
        shadow: 'group-hover:shadow-rose-500/20',
    },
    [BuiltInRoles.TRANSPORT_STAFF]: {
        label: 'Transport Operations',
        description: 'Manage logistical operations, routes, and student transit safety.',
        color: 'text-slate-500',
        gradient: 'from-slate-500/20 via-zinc-500/10 to-transparent',
        shadow: 'group-hover:shadow-slate-500/20',
    },
    [BuiltInRoles.ECOMMERCE_OPERATOR]: {
        label: 'E-commerce Operator',
        description: 'Administer the institutional storefront, inventory, and supply chain.',
        color: 'text-pink-500',
        gradient: 'from-pink-500/20 via-rose-500/10 to-transparent',
        shadow: 'group-hover:shadow-pink-500/20',
    },
};

const RoleSelectionPage: React.FC<RoleSelectionPageProps> = ({ onRoleSelect, onComplete }) => {
    const { roles, loading } = useRoles();
    const [isSchoolAdminModalOpen, setIsSchoolAdminModalOpen] = useState(false);
    const [joinLoading, setJoinLoading] = useState(false);
    const [joinSuccess, setJoinSuccess] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [joinError, setJoinError] = useState<string | null>(null);
    const [invitationCode, setInvitationCode] = useState('');
    const [selectedRole, setSelectedRole] = useState<string | null>(null);

    // Filter roles based on the metadata we have defined
    const displayRoles = roles.filter(r => ROLE_META[r]);

    const handleRoleClick = (role: Role) => {
        if (selectedRole || createLoading || joinLoading) return;

        setSelectedRole(role);

        if (role === BuiltInRoles.SCHOOL_ADMINISTRATION) {
            setTimeout(() => {
                setIsSchoolAdminModalOpen(true);
                setSelectedRole(null);
            }, 300);
        } else {
            Promise.resolve(onRoleSelect(role)).catch(() => setSelectedRole(null));
        }
    };

    const handleCreateNewSchool = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (createLoading) return;
        setCreateLoading(true);
        try {
            await onRoleSelect(BuiltInRoles.SCHOOL_ADMINISTRATION);
        } catch (err) {
            setCreateLoading(false);
        }
    }

    const handleJoinBranch = async (e: React.MouseEvent | React.KeyboardEvent) => {
        e.preventDefault();
        // Sanitation: Remove spaces and uppercase
        const rawInput = invitationCode.trim().toUpperCase();
        // Allow for formatted inputs (e.g. ABCD-1234) or raw (ABCD1234)
        // We strip spaces to be safe. We keep hyphens.
        const code = rawInput.replace(/\s/g, '');

        if (code.length < 6 || joinLoading) return;

        setJoinLoading(true);
        setJoinError(null);

        try {
            const { data, error } = await supabase.rpc('verify_and_link_branch_admin', {
                p_invitation_code: code
            });

            if (error) throw error;

            if (data && data.success) {
                setJoinSuccess(true);
                setInvitationCode('');
                setTimeout(() => {
                    onComplete();
                }, 1500);
            } else {
                setJoinError(data?.message || 'The Access Key provided is invalid, expired, or not authorized for this identity.');
                setJoinLoading(false);
            }
        } catch (err: any) {
            console.error(err);
            setJoinError(err.message || "An unexpected error occurred during institutional verification.");
            setJoinLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Spinner size="lg" />
                <p className="text-xs font-black uppercase text-muted-foreground animate-pulse tracking-[0.2em]">Recalling Identity Matrix</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1600px] mx-auto py-10 px-4 sm:px-6 lg:px-8">
            <header className="text-center mb-16 animate-in fade-in slide-in-from-bottom-6 duration-700">
                <h1 className="text-4xl md:text-6xl font-serif font-black text-foreground tracking-tight mb-4">
                    Select Your Portal
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-medium leading-relaxed">
                    Access your personalized institutional environment or initialize a new node.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
                {displayRoles.map((name, idx) => {
                    const meta = ROLE_META[name];
                    const Icon = ROLE_ICONS[name] || UsersIcon;
                    const isProcessing = selectedRole === name;
                    const isFaded = selectedRole && selectedRole !== name;

                    return (
                        <button
                            key={name}
                            onClick={() => handleRoleClick(name)}
                            disabled={!!selectedRole || createLoading}
                            aria-pressed={isProcessing}
                            style={{ animationDelay: `${idx * 100}ms` }}
                            className={`
                                group relative flex flex-col items-start text-left p-8 rounded-[2.5rem] border-2 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden animate-in fade-in slide-in-from-bottom-10
                                ${isProcessing
                                    ? 'border-primary ring-4 ring-primary/10 bg-card scale-[0.98] shadow-2xl z-10'
                                    : isFaded
                                        ? 'opacity-30 scale-95 grayscale'
                                        : 'bg-card/60 backdrop-blur-xl border-white/5 hover:border-primary/40 hover:shadow-2xl hover:-translate-y-2'
                                }
                            `}
                        >
                            <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />

                            <div className="relative z-10 w-full">
                                <div className={`
                                    w-16 h-16 rounded-2xl flex items-center justify-center mb-8 shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:rotate-3
                                    ${isProcessing ? 'bg-primary text-white shadow-lg' : `bg-muted/80 ${meta.color} group-hover:bg-white dark:group-hover:bg-black group-hover:shadow-md`}
                                `}>
                                    {isProcessing ? <Spinner size="sm" className="text-white" /> : <Icon className="w-8 h-8" />}
                                </div>

                                <div className="space-y-3">
                                    <h3 className={`text-xl font-black tracking-tight transition-colors duration-300 ${isProcessing ? 'text-primary' : 'text-foreground group-hover:text-primary'}`}>
                                        {meta.label}
                                    </h3>
                                    <p className="text-xs text-muted-foreground font-medium leading-relaxed transition-colors group-hover:text-foreground/80">
                                        {meta.description}
                                    </p>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {isSchoolAdminModalOpen && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex justify-center items-center z-[500] p-6 overflow-hidden" onClick={() => !createLoading && !joinLoading && setIsSchoolAdminModalOpen(false)}>
                    {/* Ambient Background Aura */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <div className="absolute top-1/4 left-1/4 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[180px] animate-pulse" />
                        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[160px] animate-pulse duration-[5s]" />
                    </div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 40, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, scale: 0.95, y: 20, filter: 'blur(10px)' }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className="bg-[#0a0b10]/90 w-full max-w-5xl rounded-[4rem] shadow-[0_80px_160px_-40px_rgba(0,0,0,1)] border border-white/10 overflow-hidden relative flex flex-col md:flex-row min-h-[600px] ring-1 ring-white/5"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Decorative scanline effect */}
                        <div className="absolute inset-0 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />

                        {/* LEFT NODE: ESTABLISHMENT */}
                        <div className="flex-1 p-16 flex flex-col items-center justify-center text-center relative group/create overflow-hidden border-b md:border-b-0 md:border-r border-white/5">
                            <div className="absolute inset-0 bg-primary/[0.02] opacity-0 group-hover/create:opacity-100 transition-opacity duration-1000" />

                            <motion.div
                                whileHover={{ scale: 1.1, rotate: 5 }}
                                className="w-28 h-28 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mb-12 relative group-hover/create:shadow-[0_0_50px_rgba(var(--primary),0.3)] transition-all duration-700 border border-primary/20"
                            >
                                <div className="absolute inset-2 bg-primary/20 rounded-[2rem] blur-xl opacity-0 group-hover/create:opacity-100 transition-opacity" />
                                {createLoading ? <Spinner size="lg" className="text-primary relative z-10" /> : <SchoolIcon className="w-12 h-12 text-primary relative z-10" />}
                            </motion.div>

                            <h3 className="text-4xl font-serif font-black text-white tracking-tighter mb-6 uppercase leading-tight">
                                Establish <br /><span className="text-white/20 italic">Global Node.</span>
                            </h3>

                            <p className="text-white/30 max-w-xs mx-auto text-sm font-medium leading-relaxed mb-12">
                                Initialize a head office and set up global academic infrastructure for your institution.
                            </p>

                            <motion.button
                                whileHover={{ scale: 1.05, y: -4 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleCreateNewSchool}
                                disabled={createLoading || joinLoading}
                                className="group/btn relative px-12 py-5 rounded-2xl overflow-hidden shadow-2xl transition-all disabled:opacity-50"
                            >
                                <div className="absolute inset-0 bg-primary" />
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                                <span className="relative z-10 text-white text-[11px] font-black uppercase tracking-[0.4em]">
                                    {createLoading ? 'Provisioning...' : 'Get Started'}
                                </span>
                            </motion.button>
                        </div>

                        {/* RIGHT NODE: SYNCHRONIZATION */}
                        <div className="flex-1 p-16 flex flex-col items-center justify-center text-center bg-white/[0.01] relative overflow-hidden group/join">
                            <div className="absolute inset-0 bg-indigo-500/[0.02] opacity-0 group-hover/join:opacity-100 transition-opacity duration-1000" />

                            <motion.div
                                whileHover={{ scale: 1.1, rotate: -5 }}
                                className="w-28 h-28 bg-indigo-500/10 rounded-full flex items-center justify-center mb-12 relative border border-indigo-500/20 group-hover/join:shadow-[0_0_50px_rgba(79,70,229,0.3)] transition-all duration-700"
                            >
                                {joinSuccess ? (
                                    <CheckCircleIcon className="w-14 h-14 text-emerald-500 animate-in zoom-in" />
                                ) : (
                                    <ShieldCheckIcon className="w-12 h-12 text-indigo-400 group-hover/join:text-indigo-300 transition-colors" />
                                )}
                            </motion.div>

                            <h3 className="text-4xl font-serif font-black text-white tracking-tighter mb-6 uppercase leading-tight">
                                Join <br /><span className="text-white/20 italic">Institutional Hub.</span>
                            </h3>

                            {joinSuccess ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-4"
                                >
                                    <p className="text-emerald-400 font-black text-[11px] uppercase tracking-[0.4em] mb-2">Handshake Secured</p>
                                    <p className="text-white/40 text-sm font-medium leading-relaxed max-w-xs mx-auto italic">
                                        Linking identity to branch node. <br />Initializing workstation...
                                    </p>
                                </motion.div>
                            ) : (
                                <>
                                    <p className="text-white/30 max-w-xs mx-auto text-sm font-medium leading-relaxed mb-10">
                                        Enter your unique <strong className="text-primary/60 italic">Branch Access Key</strong> to synchronize with an established network.
                                    </p>

                                    <div className="w-full max-w-xs space-y-6">
                                        <div className="relative group/input">
                                            <input
                                                type="text"
                                                value={invitationCode}
                                                onChange={e => setInvitationCode(e.target.value.toUpperCase())}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && invitationCode.replace(/\s/g, '').length >= 6 && !joinLoading) {
                                                        handleJoinBranch(e);
                                                    }
                                                }}
                                                disabled={joinLoading}
                                                placeholder="NODE ACCESS KEY"
                                                className="w-full h-16 bg-[#050608] border-2 border-white/5 rounded-2xl text-center font-mono font-black tracking-[0.3em] text-white focus:border-primary/50 focus:ring-8 focus:ring-primary/5 outline-none transition-all disabled:opacity-40 placeholder:text-white/10 placeholder:tracking-normal placeholder:font-sans placeholder:text-[10px]"
                                            />
                                            <div className="absolute inset-0 rounded-2xl bg-primary/5 opacity-0 group-focus-within/input:opacity-100 pointer-events-none transition-all" />
                                        </div>

                                        <motion.button
                                            whileHover={{ scale: 1.02, y: -2 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={handleJoinBranch}
                                            disabled={joinLoading || invitationCode.replace(/\s/g, '').length < 6}
                                            className="w-full h-16 bg-white/[0.05] hover:bg-white/10 text-white/40 hover:text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.4em] transition-all flex items-center justify-center gap-4 disabled:opacity-20 active:scale-95 group/joinbtn border border-white/5"
                                        >
                                            {joinLoading ? <Spinner size="sm" className="text-white" /> : (
                                                <>
                                                    Verify & Access Node
                                                    <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center group-hover/joinbtn:bg-primary transition-colors">
                                                        <ChevronRightIcon className="w-3 h-3" />
                                                    </div>
                                                </>
                                            )}
                                        </motion.button>

                                        <div className="flex flex-col gap-4">
                                            <AnimatePresence>
                                                {joinError && (
                                                    <motion.p
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        exit={{ opacity: 0, scale: 0.9 }}
                                                        className="text-red-500 text-[10px] font-black uppercase tracking-widest bg-red-500/10 p-4 rounded-xl border border-red-500/20"
                                                    >
                                                        {joinError}
                                                    </motion.p>
                                                )}
                                            </AnimatePresence>

                                            <div className="flex items-center justify-center gap-3 text-white/20 group/help cursor-help hover:text-white/40 transition-colors">
                                                <InfoIcon className="w-4 h-4" />
                                                <span className="text-[9px] font-black uppercase tracking-[0.5em]">Identity Handshake Protocol</span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* CLOSE BUTTON */}
                        <button
                            onClick={() => !createLoading && !joinLoading && setIsSchoolAdminModalOpen(false)}
                            className="absolute top-10 right-10 w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/5 hover:rotate-90 transition-all duration-500 z-50"
                        >
                            <XIcon className="w-6 h-6" />
                        </button>

                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none">
                            <p className="text-[9px] text-white/10 uppercase tracking-[0.8em] font-black whitespace-nowrap">
                                Institutional Matrix Handshake Gateway v9.5
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default RoleSelectionPage;
