
import React, { useState, useEffect } from 'react';
import { Role, BuiltInRoles } from '../types';
import { ROLE_ICONS, ROLE_ORDER } from '../constants';
import { useRoles } from '../contexts/RoleContext';
import Spinner from './common/Spinner';
import { supabase } from '../services/supabase';
import { XIcon } from './icons/XIcon';
import { SchoolIcon } from './icons/SchoolIcon';
import { UsersIcon } from './icons/UsersIcon';
import { InfoIcon } from './icons/InfoIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { ShieldCheckIcon } from './icons/ShieldCheckIcon';

interface RoleSelectionPageProps {
    onRoleSelect: (role: Role) => Promise<void> | void;
    onComplete: () => void;
    existingRole?: Role | null;
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

const RoleSelectionPage: React.FC<RoleSelectionPageProps> = ({ onRoleSelect, onComplete, existingRole }) => {
    const { roles, loading } = useRoles();
    const [isSchoolAdminModalOpen, setIsSchoolAdminModalOpen] = useState(false);
    const [joinLoading, setJoinLoading] = useState(false);
    const [joinSuccess, setJoinSuccess] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [joinError, setJoinError] = useState<string | null>(null);
    const [invitationCode, setInvitationCode] = useState('');
    const [selectedRole, setSelectedRole] = useState<string | null>(null);

    const [showAllRoles, setShowAllRoles] = useState(false);

    // Filter roles based on the metadata we have defined
    // If existingRole is set, we ONLY show that role UNLESS showAllRoles is true.
    const displayRoles = (existingRole && !showAllRoles)
        ? [existingRole].filter(r => ROLE_META[r])
        : roles.filter(r => ROLE_META[r]);

    const handleRoleClick = (role: Role) => {
        if (selectedRole || createLoading || joinLoading) return;

        setSelectedRole(role);

        if (role === BuiltInRoles.SCHOOL_ADMINISTRATION) {
            // Check if we are resuming (existing role) -> Skip modal, just proceed
            if (existingRole === BuiltInRoles.SCHOOL_ADMINISTRATION) {
                Promise.resolve(onRoleSelect(role)).catch(() => setSelectedRole(null));
            } else {
                setTimeout(() => {
                    setIsSchoolAdminModalOpen(true);
                    setSelectedRole(null);
                }, 300);
            }
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

    const handleJoinBranch = async (e: React.MouseEvent) => {
        e.preventDefault();
        const code = invitationCode.trim().toUpperCase();

        if (code.length < 8 || joinLoading) return;

        setJoinLoading(true);
        setJoinError(null);

        try {
            const { data, error } = await supabase.rpc('verify_and_link_branch_admin', {
                p_invitation_code: code
            });

            if (error) throw error;

            if (data.success) {
                setJoinSuccess(true);
                setInvitationCode('');
                setTimeout(() => {
                    onComplete();
                }, 1500);
            } else {
                setJoinError(data.message || 'The Access Key provided is invalid, expired, or not authorized for this identity.');
                setJoinLoading(false);
            }
        } catch (err: any) {
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
        <div className="w-full max-w-[1600px] mx-auto py-12 px-6 sm:px-8 lg:px-12 flex flex-col justify-center min-h-[80vh]">

            <header className="text-center mb-20 animate-in fade-in slide-in-from-bottom-6 duration-1000">
                <div className="inline-flex items-center justify-center p-3 bg-muted/30 rounded-full mb-6 ring-1 ring-white/10 backdrop-blur-md">
                    <div className={`w-2 h-2 rounded-full mr-3 ${existingRole ? 'bg-emerald-500 animate-pulse' : 'bg-primary animate-pulse'}`}></div>
                    <span className="text-[10px] font-black tracking-[0.3em] text-muted-foreground uppercase">
                        {existingRole ? 'Identity Verified' : 'System Authorization'}
                    </span>
                </div>
                <h1 className="text-5xl md:text-7xl font-serif font-black text-foreground tracking-tight mb-6 leading-tight">
                    {existingRole ? 'Welcome Back' : 'Select Your Portal'}
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto font-medium leading-relaxed opacity-80 mb-8">
                    {existingRole
                        ? 'Your secure session is ready. Resume your work within the institutional network.'
                        : 'Choose your access level to initialize your personalized workspace environment.'
                    }
                </p>


                {existingRole && !showAllRoles && (
                    <button
                        onClick={() => setShowAllRoles(true)}
                        className="text-xs font-bold text-muted-foreground hover:text-white uppercase tracking-widest border-b border-white/20 hover:border-white transition-all pb-1 animate-in fade-in slide-in-from-top-2"
                    >
                        Not you? Switch Identity
                    </button>
                )}
            </header>

            <div className={`
                w-full transition-all duration-700 ease-out
                ${existingRole
                    ? 'flex justify-center items-center perspective-1000'
                    : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6'
                }
            `}>
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
                                group relative flex flex-col items-start text-left p-8 rounded-[2rem] border transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden animate-in fade-in slide-in-from-bottom-12 fill-mode-backwards
                                ${existingRole ? 'w-full max-w-lg ring-1 ring-white/10 bg-gradient-to-b from-white/[0.08] to-transparent shadow-2xl hover:scale-105 hover:shadow-primary/20 items-center text-center py-16' : ''}
                                ${isProcessing
                                    ? 'border-primary ring-2 ring-primary/20 bg-card scale-[0.98] shadow-2xl z-10'
                                    : isFaded
                                        ? 'opacity-30 scale-95 grayscale blur-sm'
                                        : 'bg-card/40 backdrop-blur-md border-white/5 hover:bg-card/80 hover:border-white/10 hover:shadow-2xl hover:-translate-y-1'
                                }
                            `}
                        >
                            {/* Dynamic Background Gradient */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />

                            <div className="relative z-10 w-full flex flex-col h-full">
                                <div className={`
                                    rounded-2xl flex items-center justify-center mb-6 shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:rotate-3
                                    ${existingRole ? 'w-24 h-24 mb-10 mx-auto' : 'w-14 h-14'}
                                    ${isProcessing ? 'bg-primary text-white shadow-lg scale-110' : `bg-muted/50 ${meta.color} group-hover:bg-white dark:group-hover:bg-black group-hover:shadow-xl`}
                                `}>
                                    {isProcessing ? <Spinner size={existingRole ? "md" : "sm"} className="text-white" /> : <Icon className={existingRole ? "w-10 h-10" : "w-7 h-7"} />}
                                </div>

                                <div className="space-y-3 mt-auto">
                                    <h3 className={`font-black tracking-tight transition-colors duration-300 ${isProcessing ? 'text-primary' : 'text-foreground group-hover:text-primary'} ${existingRole ? 'text-3xl' : 'text-xl'}`}>
                                        {existingRole ? `Continue as ${meta.label}` : meta.label}
                                    </h3>
                                    <p className={`text-muted-foreground font-medium leading-relaxed transition-colors group-hover:text-foreground/80 ${existingRole ? 'text-base max-w-sm mx-auto' : 'text-xs'}`}>
                                        {meta.description}
                                    </p>
                                </div>

                                {existingRole && (
                                    <div className="mt-10 px-8 py-3 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 shadow-lg shadow-primary/25">
                                        Access Portal &rarr;
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {isSchoolAdminModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex justify-center items-center z-[100] p-4 animate-in fade-in duration-500" onClick={() => !createLoading && !joinLoading && setIsSchoolAdminModalOpen(false)}>

                    <div className="bg-[#0c0e12] w-full max-w-5xl rounded-[3rem] shadow-2xl border border-white/10 overflow-hidden relative animate-in zoom-in-95 duration-500" onClick={e => e.stopPropagation()}>

                        {/* Close Button */}
                        <button
                            onClick={() => setIsSchoolAdminModalOpen(false)}
                            className="absolute top-8 right-8 z-20 p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-all"
                        >
                            <XIcon className="w-6 h-6" />
                        </button>

                        <div className="flex flex-col md:flex-row h-full min-h-[600px]">

                            {/* Left Side: Create New */}
                            <button
                                onClick={handleCreateNewSchool}
                                disabled={createLoading || joinLoading}
                                className="flex-1 p-16 text-center group relative overflow-hidden transition-all hover:bg-gradient-to-br hover:from-primary/10 hover:to-transparent disabled:opacity-50"
                            >
                                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                                <div className="relative z-10 flex flex-col items-center justify-center h-full">
                                    <div className="w-28 h-28 bg-[#1a1d24] rounded-[2rem] flex items-center justify-center mb-10 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-2xl border border-white/5 group-hover:border-primary/30 group-hover:shadow-primary/20">
                                        {createLoading ? <Spinner size="lg" className="text-primary" /> : <SchoolIcon className="w-14 h-14 text-primary" />}
                                    </div>
                                    <h3 className="text-4xl font-serif font-black text-white tracking-tight mb-6">Establish New School</h3>
                                    <p className="text-white/40 max-w-sm mx-auto text-base font-medium leading-relaxed mb-12">
                                        Initialize a Master Node for your institution. Configure global settings, academic structures, and branch policies.
                                    </p>
                                    <div className={`inline-flex items-center gap-3 px-12 py-5 rounded-2xl text-white text-xs font-black uppercase tracking-widest shadow-xl transition-all ${createLoading ? 'bg-primary/70 animate-pulse cursor-wait' : 'bg-primary hover:scale-105 shadow-primary/25 ring-1 ring-white/20'}`}>
                                        {createLoading ? 'Provisioning Master Node...' : 'Initialize Infrastructure'}
                                    </div>
                                </div>
                            </button>

                            {/* Divider */}
                            <div className="relative w-px bg-gradient-to-b from-transparent via-white/10 to-transparent self-stretch hidden md:block" />
                            <div className="relative h-px bg-gradient-to-r from-transparent via-white/10 to-transparent self-stretch md:hidden" />

                            {/* Right Side: Join Existing */}
                            <div className="flex-1 p-16 text-center bg-[#08090a]/50 relative flex flex-col justify-center">
                                <div className="flex flex-col items-center">
                                    <div className="w-28 h-28 bg-[#1a1d24] rounded-full flex items-center justify-center mb-10 shadow-2xl border border-white/5">
                                        {joinSuccess ? <CheckCircleIcon className="w-14 h-14 text-emerald-500 animate-in zoom-in" /> : <ShieldCheckIcon className="w-14 h-14 text-indigo-500" />}
                                    </div>
                                    <h3 className="text-4xl font-serif font-black text-white tracking-tight mb-6">Join Existing Network</h3>

                                    {joinSuccess ? (
                                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <p className="text-emerald-500 font-bold text-xl mb-3 tracking-wide">Handshake Secured</p>
                                            <p className="text-white/40 text-sm font-medium leading-relaxed max-w-xs mx-auto">
                                                Linking your identity securely to the branch node. Initializing workstation environment...
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-white/40 max-w-sm mx-auto text-sm font-medium leading-relaxed mb-12">
                                                Enter your unique <span className="text-indigo-400 font-bold">Branch Access Key</span> provided by the administration.
                                            </p>

                                            <div className="w-full max-w-sm space-y-6">
                                                <div className="relative group">
                                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                                                    <input
                                                        type="text"
                                                        value={invitationCode}
                                                        onChange={e => setInvitationCode(e.target.value.toUpperCase())}
                                                        disabled={joinLoading}
                                                        placeholder="ENTER ACCESS KEY"
                                                        className="relative w-full px-8 py-5 bg-[#0c0e12] border-2 border-white/5 rounded-2xl text-center font-mono font-black tracking-[0.2em] text-xl text-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all disabled:opacity-50 placeholder:text-white/10 placeholder:tracking-normal placeholder:font-sans placeholder:text-sm shadow-inner"
                                                    />
                                                </div>

                                                <button
                                                    onClick={handleJoinBranch}
                                                    disabled={joinLoading || invitationCode.length < 8}
                                                    className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/25 hover:bg-indigo-500 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95 disabled:grayscale hover:shadow-indigo-500/40"
                                                >
                                                    {joinLoading ? <Spinner size="sm" className="text-white" /> : 'Verify & Access Node'}
                                                </button>

                                                <div className="flex flex-col gap-4 mt-2">
                                                    {joinError && (
                                                        <p className="text-red-400 text-[10px] font-black uppercase tracking-wider animate-in shake duration-300 bg-red-500/5 p-3 rounded-xl border border-red-500/10">
                                                            {joinError}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center justify-center gap-2 text-white/20 group/help cursor-help hover:text-indigo-400 transition-colors">
                                                        <InfoIcon className="w-4 h-4" />
                                                        <span className="text-[10px] font-bold uppercase tracking-widest">Access protocol help</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoleSelectionPage;
