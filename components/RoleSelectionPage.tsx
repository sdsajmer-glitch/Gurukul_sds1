
import React, { useState } from 'react';
import { Role, BuiltInRoles } from '../types';
import { ROLE_ICONS } from '../constants';
import { useRoles } from '../contexts/RoleContext';
import Spinner from './common/Spinner';
import { supabase, formatError } from '../services/supabase';
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

    const handleJoinBranch = async (e?: React.SyntheticEvent) => {
        if (e && e.preventDefault) e.preventDefault();
        const code = invitationCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
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
                setJoinError(data?.message || 'Handshake Protocol Rejected.');
            }
        } catch (err: any) {
            setJoinError(formatError(err));
        } finally {
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
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <div className="absolute top-1/4 left-1/4 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[180px] animate-pulse" />
                        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[160px] animate-pulse duration-[5s]" />
                    </div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 40, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, scale: 0.95, y: 20, filter: 'blur(10px)' }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className="bg-[#0a0b10]/90 w-full max-w-5xl rounded-[2.5rem] md:rounded-[4rem] shadow-[0_80px_160px_-40px_rgba(0,0,0,1)] border border-white/10 overflow-hidden relative flex flex-col md:flex-row max-h-[90vh] md:min-h-[600px] ring-1 ring-white/5 mx-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="absolute inset-0 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />

                        <div className="flex-1 p-8 md:p-16 flex flex-col items-center justify-center text-center relative group/create overflow-hidden border-b md:border-b-0 md:border-r border-white/5">
                            <div className="absolute inset-0 bg-primary/[0.02] opacity-0 group-hover/create:opacity-100 transition-opacity duration-1000" />
                            <motion.div
                                whileHover={{ scale: 1.1, rotate: 5 }}
                                className="w-20 h-20 md:w-28 md:h-28 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mb-8 md:mb-12 relative border border-primary/20 shadow-[0_0_50px_rgba(var(--primary),0.1)]"
                            >
                                {createLoading ? <Spinner size="lg" className="text-primary relative z-10" /> : <SchoolIcon className="w-10 h-10 md:w-12 md:h-12 text-primary relative z-10" />}
                                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full opacity-0 group-hover/create:opacity-100 transition-opacity" />
                            </motion.div>
                            <h3 className="text-2xl md:text-4xl font-serif font-black text-white tracking-tighter mb-4 md:mb-6 uppercase leading-tight">
                                Establish <br /><span className="text-white/20 italic">Global Node.</span>
                                <span className="block text-[10px] text-primary mt-2 font-black tracking-[0.3em] font-sans opacity-60">(School / Head Office)</span>
                            </h3>
                            <div className="space-y-4 mb-10 text-left w-full max-w-xs mx-auto">
                                <p className="text-white/30 text-[11px] font-medium leading-relaxed">
                                    Root authority for the institution network. Initialize head office and oversee global operations.
                                </p>
                                <div className="grid grid-cols-1 gap-2">
                                    {['Full Network Registry Access', 'Manage Multi-Branch Nodes', 'Institutional Expand Privileges', 'Identity Key Generation'].map(p => (
                                        <div key={p} className="flex items-center gap-2">
                                            <CheckCircleIcon className="w-3 h-3 text-primary/40" />
                                            <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">{p}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.05, y: -4 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleCreateNewSchool}
                                disabled={createLoading || joinLoading}
                                className="group/btn relative px-8 md:px-12 py-4 md:py-5 rounded-2xl overflow-hidden shadow-2xl transition-all disabled:opacity-50 w-full"
                            >
                                <div className="absolute inset-0 bg-primary shadow-[0_20px_40px_rgba(var(--primary),0.3)]" />
                                <span className="relative z-10 text-white text-[10px] md:text-[11px] font-black uppercase tracking-[0.4em]">
                                    {createLoading ? 'Provisioning...' : 'Initialize Registry'}
                                </span>
                            </motion.button>
                        </div>

                        <div className="flex-1 p-8 md:p-16 flex flex-col items-center justify-center text-center bg-white/[0.01] relative overflow-hidden group/join">
                            <div className="absolute inset-0 bg-indigo-500/[0.02] opacity-0 group-hover/join:opacity-100 transition-opacity duration-1000" />
                            <motion.div
                                whileHover={{ scale: 1.1, rotate: -5 }}
                                className="w-20 h-20 md:w-28 md:h-28 bg-indigo-500/10 rounded-full flex items-center justify-center mb-8 md:mb-12 relative border border-indigo-500/20 shadow-[0_0_50px_rgba(99,102,241,0.1)]"
                            >
                                {joinSuccess ? (
                                    <CheckCircleIcon className="w-10 h-10 md:w-14 md:h-14 text-emerald-500 animate-in zoom-in" />
                                ) : (
                                    <ShieldCheckIcon className="w-10 h-10 md:w-12 md:h-12 text-indigo-400 relative z-10" />
                                )}
                                <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full opacity-0 group-hover/join:opacity-100 transition-opacity" />
                            </motion.div>
                            <h3 className="text-2xl md:text-4xl font-serif font-black text-white tracking-tighter mb-4 md:mb-6 uppercase leading-tight">
                                Join <br /><span className="text-white/20 italic">Institutional Hub.</span>
                                <span className="block text-[10px] text-indigo-400 mt-2 font-black tracking-[0.3em] font-sans opacity-60">(Branch Admin / Satellite Node)</span>
                            </h3>

                            {joinSuccess ? (
                                <div className="space-y-4">
                                    <p className="text-emerald-400 font-black text-[11px] uppercase tracking-[0.4em]">Handshake Secured</p>
                                    <p className="text-white/20 text-[10px] font-medium max-w-[200px] mx-auto uppercase tracking-widest">Redirecting to institutional node matrix...</p>
                                </div>
                            ) : (
                                <div className="w-full max-w-xs space-y-8">
                                    <div className="space-y-3 text-left">
                                        <p className="text-white/30 text-[11px] font-medium leading-relaxed">
                                            Access an existing node using an admin invite. Your scope is isolated to your assigned branch.
                                        </p>
                                        <div className="flex flex-col gap-2">
                                            {['Branch-Level Management', 'Isolated Data Sovereignty', 'No Global Sync Privileges', 'Automated Registry Updates'].map(p => (
                                                <div key={p} className="flex items-center gap-2">
                                                    <div className="w-1 h-1 rounded-full bg-indigo-500/40" />
                                                    <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">{p}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <form onSubmit={handleJoinBranch} className="w-full space-y-6 relative z-10">
                                        <input
                                            type="text"
                                            value={invitationCode}
                                            onChange={e => setInvitationCode(e.target.value.toUpperCase())}
                                            disabled={joinLoading}
                                            placeholder="NODE ACCESS KEY (XXXX-XXXX)"
                                            className="w-full h-16 md:h-20 bg-[#050608] border-2 border-white/5 rounded-2xl text-center font-mono font-black tracking-[0.2em] md:tracking-[0.4em] text-white focus:border-indigo-500/50 outline-none transition-all placeholder:text-white/10 placeholder:text-[10px]"
                                        />
                                        <motion.button
                                            type="submit"
                                            disabled={joinLoading || invitationCode.length < 6}
                                            className={`w-full h-16 md:h-20 rounded-2xl font-black text-[11px] md:text-[12px] uppercase tracking-[0.4em] transition-all flex items-center justify-center gap-4 border shadow-2xl ${joinLoading || invitationCode.length < 6 ? 'bg-white/[0.02] border-white/5 text-white/10' : 'bg-indigo-600 border-indigo-400/20 text-white hover:bg-indigo-500 shadow-[0_20px_40px_rgba(79,70,229,0.3)]'
                                                }`}
                                        >
                                            {joinLoading ? <Spinner size="sm" /> : 'Verify Node Connection'}
                                        </motion.button>
                                        <AnimatePresence>
                                            {joinError && (
                                                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 text-[10px] font-black uppercase tracking-widest bg-red-500/5 p-3 rounded-xl border border-red-500/20">{joinError}</motion.p>
                                            )}
                                        </AnimatePresence>
                                    </form>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => !createLoading && !joinLoading && setIsSchoolAdminModalOpen(false)}
                            className="absolute top-6 md:top-10 right-6 md:right-10 w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/10 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/5 transition-all z-50"
                        >
                            <XIcon className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default RoleSelectionPage;
