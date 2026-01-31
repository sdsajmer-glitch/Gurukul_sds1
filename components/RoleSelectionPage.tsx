
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Role, BuiltInRoles } from '../types';
import { ROLE_ICONS } from '../constants';
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

const ROLE_META: Record<string, { label: string; description: string; color: string; gradient: string; accent: string }> = {
    [BuiltInRoles.SCHOOL_ADMINISTRATION]: {
        label: 'Institutional Command',
        description: 'Multi-branch orchestration, global governance, and infrastructure control.',
        color: 'text-purple-400',
        gradient: 'from-purple-600/20 via-indigo-600/10 to-transparent',
        accent: 'bg-purple-600',
    },
    [BuiltInRoles.PRINCIPAL]: {
        label: 'Academic Leadership',
        description: 'Director-level oversight of pedagogical excellence and faculty growth.',
        color: 'text-indigo-400',
        gradient: 'from-indigo-600/20 via-blue-600/10 to-transparent',
        accent: 'bg-indigo-600',
    },
    [BuiltInRoles.HR_MANAGER]: {
        label: 'Human Capital',
        description: 'Organizational compliance, talent acquisition, and workforce management.',
        color: 'text-cyan-400',
        gradient: 'from-cyan-600/20 via-blue-600/10 to-transparent',
        accent: 'bg-cyan-600',
    },
    [BuiltInRoles.ACADEMIC_COORDINATOR]: {
        label: 'Curriculum Ops',
        description: 'Pedagogical synchronization and educational standard maintenance.',
        color: 'text-amber-400',
        gradient: 'from-amber-600/20 via-yellow-600/10 to-transparent',
        accent: 'bg-amber-600',
    },
    [BuiltInRoles.ACCOUNTANT]: {
        label: 'Fiscal Control',
        description: 'Comprehensive financial reporting, fee-registry, and audit cycles.',
        color: 'text-emerald-400',
        gradient: 'from-emerald-600/20 via-teal-600/10 to-transparent',
        accent: 'bg-emerald-600',
    },
    [BuiltInRoles.TEACHER]: {
        label: 'Faculty Nexus',
        description: 'Classroom empowerment, learning curation, and student mentoring.',
        color: 'text-blue-400',
        gradient: 'from-blue-600/20 via-cyan-600/10 to-transparent',
        accent: 'bg-blue-600',
    },
    [BuiltInRoles.STUDENT]: {
        label: 'Student Core',
        description: 'Personalized learning environment, timeline access, and digital growth.',
        color: 'text-teal-400',
        gradient: 'from-teal-600/20 via-emerald-600/10 to-transparent',
        accent: 'bg-teal-600',
    },
    [BuiltInRoles.PARENT_GUARDIAN]: {
        label: 'Guardian Hub',
        description: 'Stakeholder partnership, progress tracking, and family-institutional sync.',
        color: 'text-rose-400',
        gradient: 'from-rose-600/20 via-pink-600/10 to-transparent',
        accent: 'bg-rose-600',
    },
    [BuiltInRoles.TRANSPORT_STAFF]: {
        label: 'Logistics Fleet',
        description: 'Transit safety monitoring, fleet management, and route optimization.',
        color: 'text-slate-400',
        gradient: 'from-slate-600/20 via-zinc-600/10 to-transparent',
        accent: 'bg-slate-600',
    },
    [BuiltInRoles.ECOMMERCE_OPERATOR]: {
        label: 'Inventory Control',
        description: 'Supply chain management and institutional commerce operations.',
        color: 'text-pink-400',
        gradient: 'from-pink-600/20 via-rose-600/10 to-transparent',
        accent: 'bg-pink-600',
    },
};

const BackgroundEffects = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[150px] rounded-full animate-pulse [animation-delay:2s]" />

        {/* Fine Mesh Grid */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

        {/* Animated Scanline Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent h-24 w-full animate-scanner-move pointer-events-none opacity-20" />
    </div>
);

const RoleCard = ({ name, idx, meta, Icon, onClick, isProcessing, isFaded, isExistingMode, showAllRoles }: any) => {
    const cardRef = useRef<HTMLButtonElement>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        setMousePos({ x: x * 20, y: y * 20 });
    };

    const handleMouseLeave = () => setMousePos({ x: 0, y: 0 });

    return (
        <motion.button
            ref={cardRef}
            layout
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            initial={{ opacity: 0, y: 20 }}
            animate={{
                opacity: isFaded ? 0.3 : 1,
                y: 0,
                rotateX: -mousePos.y,
                rotateY: mousePos.x,
                scale: isProcessing ? 0.98 : 1,
                filter: isFaded ? 'blur(4px) grayscale(0.5)' : 'blur(0px) grayscale(0)'
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: idx * 0.1 }}
            onClick={() => onClick(name)}
            disabled={isProcessing}
            className={`
                group relative flex flex-col items-start text-left p-8 rounded-[2.5rem] border transition-all duration-300 overflow-hidden
                ${isExistingMode && !showAllRoles ? 'w-full max-w-xl py-20 px-12 items-center text-center' : 'h-full min-h-[320px]'}
                ${isProcessing ? 'border-primary shadow-[0_0_50px_rgba(139,92,246,0.3)] bg-card' : 'bg-card/30 backdrop-blur-2xl border-white/5 hover:border-white/20 hover:bg-card/50'}
            `}
        >
            {/* Glossy Reflection Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-transparent pointer-events-none" />

            {/* Dynamic Accent Gradient */}
            <div className={`absolute -inset-2 bg-gradient-to-br ${meta.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-2xl`} />

            <div className="relative z-10 w-full flex flex-col h-full">
                <div className={`
                    rounded-3xl flex items-center justify-center transition-all duration-500 mb-8
                    ${isExistingMode && !showAllRoles ? 'w-28 h-28 mx-auto mb-12 shadow-2xl' : 'w-16 h-16'}
                    ${isProcessing ? 'bg-primary text-white scale-110' : `bg-white/5 ${meta.color} group-hover:scale-110 group-hover:rotate-6 group-hover:bg-white dark:group-hover:bg-black group-hover:text-primary border border-white/10`}
                `}>
                    {isProcessing ? <Spinner size={isExistingMode ? "lg" : "md"} className="text-white" /> : <Icon className={isExistingMode && !showAllRoles ? "w-12 h-12" : "w-8 h-8"} />}
                </div>

                <div className="space-y-4">
                    <h3 className={`font-serif font-black tracking-tight leading-none transition-colors duration-300 ${isProcessing ? 'text-primary' : 'text-white group-hover:text-primary'} ${isExistingMode && !showAllRoles ? 'text-4xl' : 'text-2xl'}`}>
                        {isExistingMode && !showAllRoles ? `Continue as ${meta.label}` : meta.label}
                    </h3>
                    <p className={`text-white/40 font-medium leading-relaxed transition-colors group-hover:text-white/60 ${isExistingMode && !showAllRoles ? 'text-lg max-w-md mx-auto' : 'text-sm'}`}>
                        {meta.description}
                    </p>
                </div>

                {isExistingMode && !showAllRoles && !isProcessing && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-12 px-10 py-4 bg-primary text-white text-sm font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                    >
                        Access Terminal &rarr;
                    </motion.div>
                )}
            </div>

            {/* Glowing Border Edge */}
            <div className="absolute inset-0 rounded-[2.5rem] border border-white/0 group-hover:border-primary/30 transition-colors pointer-events-none" />
        </motion.button>
    );
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

    const displayRoles = (existingRole && !showAllRoles)
        ? [existingRole].filter(r => ROLE_META[r])
        : roles.filter(r => ROLE_META[r]);

    const handleRoleClick = (role: Role) => {
        if (selectedRole || createLoading || joinLoading) return;
        setSelectedRole(role);

        if (role === BuiltInRoles.SCHOOL_ADMINISTRATION) {
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
            const { data, error } = await supabase.rpc('verify_and_link_branch_admin', { p_invitation_code: code });
            if (error) throw error;

            if (data.success) {
                setJoinSuccess(true);
                setInvitationCode('');
                setTimeout(() => onComplete(), 1500);
            } else {
                setJoinError(data.message || 'Key invalid or expired.');
                setJoinLoading(false);
            }
        } catch (err: any) {
            setJoinError(err.message || "Verification failed.");
            setJoinLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                    <Spinner size="lg" className="relative z-10" />
                </div>
                <p className="text-[10px] font-black uppercase text-white/40 animate-pulse tracking-[0.4em]">Establishing Neural Sync</p>
            </div>
        );
    }

    return (
        <div className="relative w-full min-h-screen py-24 px-6 sm:px-8 lg:px-12 flex flex-col justify-center overflow-hidden bg-[#08090a]">
            <BackgroundEffects />

            <div className="w-full max-w-[1700px] mx-auto relative z-10">
                <header className="text-center mb-24 space-y-8">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center justify-center px-6 py-2.5 bg-white/5 rounded-full border border-white/10 backdrop-blur-xl shadow-2xl"
                    >
                        <div className={`w-2 h-2 rounded-full mr-3 ${existingRole ? 'bg-emerald-500 animate-pulse' : 'bg-primary'}`}></div>
                        <span className="text-[9px] font-black tracking-[0.4em] text-white/50 uppercase">
                            {existingRole ? 'Identity Verified' : 'Root Security Protocol'}
                        </span>
                    </motion.div>

                    <div className="space-y-4">
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="text-6xl md:text-8xl font-serif font-black text-white tracking-tighter leading-[0.9]"
                        >
                            {existingRole && !showAllRoles ? 'Welcome Back' : 'Select Portal'}
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.6 }}
                            transition={{ delay: 0.4 }}
                            className="text-lg md:text-xl text-white max-w-2xl mx-auto font-medium leading-relaxed italic"
                        >
                            {existingRole && !showAllRoles
                                ? 'Authorization protocols cleared. Resume your institutional session.'
                                : 'Choose an access level to initialize your specialized workspace cluster.'
                            }
                        </motion.p>
                    </div>

                    {existingRole && !showAllRoles && (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            onClick={() => setShowAllRoles(true)}
                            className="inline-flex items-center gap-2 text-[10px] font-black text-white/30 hover:text-white uppercase tracking-[0.3em] border-b border-white/10 hover:border-primary transition-all pb-2 cursor-pointer pt-4"
                        >
                            Switch Operational Identity <span className="text-primary">&rarr;</span>
                        </motion.button>
                    )}
                </header>

                <div className={`
                    w-full transition-all duration-1000
                    ${existingRole && !showAllRoles
                        ? 'flex justify-center perspective-1000'
                        : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8'
                    }
                `}>
                    <AnimatePresence mode="popLayout">
                        {displayRoles.map((name, idx) => {
                            const meta = ROLE_META[name];
                            const Icon = ROLE_ICONS[name] || UsersIcon;
                            const isProcessing = selectedRole === name;
                            const isFaded = selectedRole && selectedRole !== name;

                            return (
                                <RoleCard
                                    key={name}
                                    name={name}
                                    idx={idx}
                                    meta={meta}
                                    Icon={Icon}
                                    onClick={handleRoleClick}
                                    isProcessing={isProcessing}
                                    isFaded={isFaded}
                                    isExistingMode={existingRole}
                                    showAllRoles={showAllRoles}
                                />
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>

            {isSchoolAdminModalOpen && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-[40px] flex justify-center items-center z-[200] p-6 animate-in fade-in duration-700" onClick={() => !createLoading && !joinLoading && setIsSchoolAdminModalOpen(false)}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-[#0c0d12] w-full max-w-6xl rounded-[4rem] shadow-3xl border border-white/[0.08] overflow-hidden relative"
                        onClick={e => e.stopPropagation()}
                    >

                        <button onClick={() => setIsSchoolAdminModalOpen(false)} className="absolute top-10 right-10 z-30 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white/30 hover:text-white transition-all">
                            <XIcon className="w-8 h-8" />
                        </button>

                        <div className="flex flex-col lg:flex-row min-h-[700px]">
                            <button
                                onClick={handleCreateNewSchool}
                                disabled={createLoading || joinLoading}
                                className="flex-1 p-20 text-center group relative overflow-hidden transition-all hover:bg-primary/5 disabled:opacity-50"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                                <div className="relative z-10 flex flex-col items-center justify-center h-full space-y-10">
                                    <div className="w-32 h-32 bg-[#1a1d24] rounded-[2.5rem] flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 shadow-2xl border border-white/5">
                                        {createLoading ? <Spinner size="lg" className="text-primary" /> : <SchoolIcon className="w-16 h-16 text-primary" />}
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="text-5xl font-serif font-black text-white tracking-tighter">Genesis Initialization</h3>
                                        <p className="text-white/40 max-w-md mx-auto text-lg font-medium leading-relaxed italic">Provision a new institutional Master Node. Configure global policies and academic hierarchy.</p>
                                    </div>
                                    <div className={`px-14 py-6 rounded-3xl text-white text-[10px] font-black uppercase tracking-[0.4em] shadow-2xl transition-all ${createLoading ? 'bg-primary/70 animate-pulse' : 'bg-primary hover:shadow-primary/40 ring-1 ring-white/10 hover:scale-105'}`}>
                                        {createLoading ? 'Provisioning...' : 'Initialize Master Node'}
                                    </div>
                                </div>
                            </button>

                            <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

                            <div className="flex-1 p-20 text-center bg-black/40 relative flex flex-col justify-center">
                                <div className="space-y-12 flex flex-col items-center">
                                    <div className="w-32 h-32 bg-[#1a1d24] rounded-full flex items-center justify-center shadow-2xl border border-white/5">
                                        {joinSuccess ? <CheckCircleIcon className="w-16 h-16 text-emerald-500" /> : <ShieldCheckIcon className="w-16 h-16 text-indigo-400" />}
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-5xl font-serif font-black text-white tracking-tighter">Network Link</h3>
                                        {joinSuccess ? (
                                            <p className="text-emerald-500 font-black text-xl tracking-[0.2em] uppercase">Handshake Complete</p>
                                        ) : (
                                            <p className="text-white/40 max-w-md mx-auto text-lg font-medium leading-relaxed italic">Enter your unique <span className="text-indigo-400 font-bold">Protocol Key</span> to link your identity to an existing branch.</p>
                                        )}
                                    </div>

                                    {!joinSuccess && (
                                        <div className="w-full max-w-md space-y-8">
                                            <div className="relative group">
                                                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-indigo-500 rounded-[2rem] blur opacity-10 group-hover:opacity-30 transition duration-1000"></div>
                                                <input
                                                    type="text"
                                                    value={invitationCode}
                                                    onChange={e => setInvitationCode(e.target.value.toUpperCase())}
                                                    disabled={joinLoading}
                                                    placeholder="VERIFY ACCESS KEY"
                                                    className="relative w-full px-10 py-7 bg-[#0c0d12] border-2 border-white/5 rounded-[2rem] text-center font-mono font-black tracking-[0.3em] text-2xl text-white outline-none transition-all focus:border-primary/50 placeholder:text-white/5 placeholder:tracking-widest"
                                                />
                                            </div>

                                            <button
                                                onClick={handleJoinBranch}
                                                disabled={joinLoading || invitationCode.length < 8}
                                                className="w-full py-6 bg-white text-black rounded-3xl font-black text-[10px] uppercase tracking-[0.4em] shadow-2xl hover:bg-white/90 transition-all disabled:opacity-20 active:scale-95"
                                            >
                                                {joinLoading ? <Spinner size="sm" className="text-black" /> : 'Authorize Connection'}
                                            </button>

                                            {joinError && (
                                                <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-red-500 text-[10px] font-black uppercase tracking-[0.2em]">{joinError}</motion.p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default RoleSelectionPage;
