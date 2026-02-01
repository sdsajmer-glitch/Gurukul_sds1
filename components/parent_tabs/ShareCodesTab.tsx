
import React, { useState, useEffect, useCallback } from 'react';
import { supabase, formatError } from '../../services/supabase';
import { ShareCode, AdmissionApplication, ShareCodeType } from '../../types';
import Spinner from '../common/Spinner';
import PremiumAvatar from '../common/PremiumAvatar';
import { CopyIcon } from '../icons/CopyIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { RefreshIcon } from '../icons/RefreshIcon';
import { KeyIcon } from '../icons/KeyIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { FileTextIcon } from '../icons/FileTextIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { InfoIcon } from '../icons/InfoIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { RotateCcwIcon } from '../icons/RotateCcwIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { ChevronRightIcon } from '../icons/ChevronRightIcon';
import { LockIcon } from '../icons/LockIcon';
import { motion, AnimatePresence } from 'framer-motion';

// --- VISUAL TOKENS ---
const TOKENS = {
    bg: {
        layer0: 'bg-[#050608]',
        layer1: 'bg-[#0A0C10]',
        layer2: 'bg-[#12141A]',
        surface: 'bg-[#0F1116]',
        hover: 'hover:bg-[#16181F]',
        active: 'bg-[#1A1D26]',
    },
    border: {
        subtle: 'border-white/[0.04]',
        precision: 'border-white/[0.08]',
        focus: 'border-white/20',
        active: 'border-primary/40',
    },
    text: {
        primary: 'text-white',
        secondary: 'text-white/40',
        tertiary: 'text-white/20',
        accent: 'text-primary',
    }
};

const statusConfig: { [key: string]: { text: string; bg: string; border: string; icon: React.ReactNode } } = {
    'Active': {
        text: 'text-[#22C55E]',
        bg: 'bg-[#0E1F16]',
        border: 'border-[#22C55E]/30',
        icon: <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] shadow-[0_0_8px_#22C55E]" />
    },
    'Expired': {
        text: 'text-white/40',
        bg: 'bg-white/[0.02]',
        border: 'border-white/[0.05]',
        icon: <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
    },
    'Revoked': {
        text: 'text-red-400',
        bg: 'bg-[#241212]',
        border: 'border-red-500/20',
        icon: <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
    },
    'Redeemed': {
        text: 'text-blue-400',
        bg: 'bg-[#121B2E]',
        border: 'border-blue-500/20',
        icon: <CheckCircleIcon className="w-3.5 h-3.5 text-blue-500" />
    }
};

// --- REUSABLE COMPONENTS [Figma Spec] ---

const ProtocolCodeDisplay = ({ code, size = 'lg', status }: { code: string, size?: 'sm' | 'lg', status?: string }) => {
    const isLarge = size === 'lg';

    // Split code for wrapping if large
    const chars = code.split('');

    return (
        <div className={`
            font-mono font-medium uppercase select-all
            ${isLarge ? 'text-4xl lg:text-5xl tracking-[0.2em] flex flex-wrap justify-center gap-x-1 gap-y-4' : 'text-xs tracking-[0.15em] whitespace-nowrap'}
            ${status === 'Active' ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'text-white/20'}
        `}>
            {isLarge ? (
                chars.map((char, i) => (
                    <motion.span
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className={char === '-' ? 'text-white/10 mx-3' : ''}
                    >
                        {char}
                    </motion.span>
                ))
            ) : (
                <span>{code}</span>
            )}
        </div>
    );
};

interface ShareCodesTabProps {
    onNavigate?: (tab: string) => void;
}

export default function ShareCodesTab({ onNavigate }: ShareCodesTabProps) {
    const [codes, setCodes] = useState<ShareCode[]>([]);
    const [myApplications, setMyApplications] = useState<AdmissionApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedAdmission, setSelectedAdmission] = useState<string>('');
    const [purpose, setPurpose] = useState('');
    const [codeType, setCodeType] = useState<ShareCodeType>('Enquiry');

    const [generating, setGenerating] = useState(false);
    const [generatedCode, setGeneratedCode] = useState<string | null>(null);
    const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [appsRes, codesRes] = await Promise.all([
                supabase.rpc('get_my_children_profiles'),
                supabase.from('share_codes').select('*').order('created_at', { ascending: false })
            ]);

            if (appsRes.error) throw appsRes.error;
            if (codesRes.error) throw codesRes.error;

            const apps = appsRes.data || [];
            setMyApplications(apps);

            if (apps.length > 0 && !selectedAdmission) {
                setSelectedAdmission(String(apps[0].id));
            }

            const mappedCodes = (codesRes.data || []).map((c: any) => ({
                ...c,
                applicant_name: c.applicant_name || apps.find((a: any) => a.id === c.admission_id)?.applicant_name || 'Unknown Applicant'
            }));

            setCodes(mappedCodes);
        } catch (err: any) {
            setError(formatError(err));
        } finally {
            setLoading(false);
        }
    }, [selectedAdmission]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleGenerateCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAdmission) return;

        setGenerating(true);
        setGeneratedCode(null);
        setError(null);

        try {
            const { data, error } = await supabase.rpc('generate_admission_share_code', {
                p_admission_id: selectedAdmission,
                p_purpose: purpose,
                p_code_type: codeType,
            });

            if (error) throw error;

            const codeValue = typeof data === 'string' ? data : (data?.code || data?.p_code);
            setGeneratedCode(codeValue);
            setPurpose('');
            await fetchData();
        } catch (err: any) {
            setError(formatError(err));
        } finally {
            setGenerating(false);
        }
    };

    const handleRevokeCode = async (id: number) => {
        if (window.confirm('Terminate this protocol key? Access will be immediately revoked.')) {
            const { error } = await supabase.rpc('revoke_my_share_code', { p_code_id: id });
            if (error) alert(`Protocol failure: ${formatError(error)}`);
            else await fetchData();
        }
    };

    const handleRegenerate = (code: ShareCode) => {
        setSelectedAdmission(code.admission_id);
        setCodeType(code.code_type);
        setPurpose(code.purpose ? `Refreshed: ${code.purpose}` : 'Refreshed Protocol');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setGeneratedCode(null);
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedCodeId(id);
        setTimeout(() => setCopiedCodeId(null), 2000);
    };

    if (loading && myApplications.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-48">
                <Spinner size="lg" className="text-primary" />
                <p className="mt-8 text-[11px] font-bold uppercase text-white/10 tracking-[0.6em] animate-pulse">Initializing Matrix</p>
            </div>
        );
    }

    return (
        <div className={`space-y-12 animate-in fade-in duration-1000 pb-40 max-w-[1440px] mx-auto ${TOKENS.bg.layer0}`}>

            {/* Page Header [Annotation B] */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10 border-b border-white/5 pb-8">
                <div className="space-y-3 max-w-2xl">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="h-[2px] w-8 bg-primary/60" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/40">Secure Orchestration</span>
                    </div>
                    <h2 className="text-5xl font-serif font-medium text-white tracking-tight uppercase">
                        Access <span className="text-white/20 italic">Protocols</span>
                    </h2>
                    <p className="text-base text-white/40 font-serif italic max-w-lg leading-relaxed">
                        Govern and manage encrypted access layers for institutional identity infrastructure.
                    </p>
                </div>

                <button
                    onClick={() => fetchData()}
                    className="group flex items-center gap-3 px-6 py-3 bg-white/[0.02] hover:bg-white/[0.05] rounded-xl text-[10px] font-black uppercase text-white/30 hover:text-white transition-all border border-white/5 hover:border-white/10"
                >
                    <RefreshIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'}`} />
                    <span>Sync Vault</span>
                </button>
            </div>

            {/* Main Content Grid [Annotation 3] */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

                {/* --- LEFT PANEL: PROVISION KEY [Annotation C] --- */}
                <div className="lg:col-span-5 space-y-8">
                    <div className={`p-8 rounded-3xl border ${TOKENS.border.subtle} ${TOKENS.bg.layer1} shadow-xl relative overflow-hidden group transition-colors duration-500`}>

                        {/* Header */}
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-primary/5 rounded-xl text-primary border border-primary/10">
                                <KeyIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-white tracking-wide uppercase">Provision Key</h3>
                                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-0.5">Identity Authorization Node</p>
                            </div>
                        </div>

                        <form onSubmit={handleGenerateCode} className="space-y-8 relative z-10">
                            {/* 1. Target Node */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.2em] block pl-1">1. Select Target Node</label>

                                {myApplications.length === 0 ? (
                                    <div className="p-6 rounded-2xl bg-red-500/[0.02] border border-dashed border-red-500/10 text-center">
                                        <AlertTriangleIcon className="w-8 h-8 text-red-500/30 mx-auto mb-3" />
                                        <p className="text-xs text-red-400 uppercase tracking-widest mb-4">Registry Silent</p>
                                        <button
                                            type="button"
                                            onClick={() => onNavigate?.('My Children')}
                                            className="px-6 py-3 bg-red-500/5 hover:bg-red-500/10 text-red-500/60 hover:text-red-400 text-[9px] font-black uppercase tracking-widest rounded-lg border border-red-500/10 transition-all"
                                        >
                                            Enroll Node
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                                        {myApplications.map(app => (
                                            <button
                                                key={app.id}
                                                type="button"
                                                onClick={() => setSelectedAdmission(String(app.id))}
                                                className={`
                                                w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 text-left group
                                                ${selectedAdmission === String(app.id)
                                                        ? 'bg-primary/5 border-primary/30 shadow-[0_4px_20px_-10px_rgba(var(--primary),0.2)] transform scale-[1.01]'
                                                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10 text-white/40'
                                                    }
                                            `}
                                            >
                                                <PremiumAvatar name={app.applicant_name} size="xs" className={`w-8 h-8 rounded-lg ${selectedAdmission === String(app.id) ? 'grayscale-0' : 'grayscale opacity-60'}`} />
                                                <div className="flex-grow min-w-0">
                                                    <p className={`text-xs font-bold truncate ${selectedAdmission === String(app.id) ? 'text-white' : 'text-white/40 group-hover:text-white/60'}`}>{app.applicant_name}</p>
                                                    <p className="text-[9px] text-white/20 font-mono mt-0.5">{app.grade} Block</p>
                                                </div>
                                                {selectedAdmission === String(app.id) && <CheckCircleIcon className="w-4 h-4 text-primary" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 2. Protocol Type */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.2em] block pl-1">2. Access Protocol</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        disabled={myApplications.length === 0}
                                        onClick={() => setCodeType('Enquiry')}
                                        className={`relative p-4 rounded-xl border transition-all duration-300 text-left flex flex-col justify-between h-28 disabled:opacity-30 ${codeType === 'Enquiry' ? 'bg-[#1e293b]/20 border-blue-500/30 ring-1 ring-blue-500/10' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'}`}
                                    >
                                        <div className={`p-1.5 rounded-lg w-fit ${codeType === 'Enquiry' ? 'text-blue-400 bg-blue-500/10' : 'text-white/20 bg-white/5'}`}>
                                            <InfoIcon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <span className={`block font-bold text-[10px] uppercase tracking-wider ${codeType === 'Enquiry' ? 'text-blue-400' : 'text-white/30'}`}>Enquiry</span>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        disabled={myApplications.length === 0}
                                        onClick={() => setCodeType('Admission')}
                                        className={`relative p-4 rounded-xl border transition-all duration-300 text-left flex flex-col justify-between h-28 disabled:opacity-30 ${codeType === 'Admission' ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/10' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'}`}
                                    >
                                        <div className={`p-1.5 rounded-lg w-fit ${codeType === 'Admission' ? 'text-primary bg-primary/10' : 'text-white/20 bg-white/5'}`}>
                                            <FileTextIcon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <span className={`block font-bold text-[10px] uppercase tracking-wider ${codeType === 'Admission' ? 'text-white' : 'text-white/30'}`}>Admission</span>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* 3. Payload & Action */}
                            <div className="space-y-6 pt-4 border-t border-white/[0.03]">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase text-white/20 tracking-[0.2em] block pl-1">3. Payload Context</label>
                                    <input
                                        type="text"
                                        disabled={myApplications.length === 0}
                                        placeholder="Purpose of access..."
                                        value={purpose}
                                        onChange={(e) => setPurpose(e.target.value)}
                                        className="w-full p-3.5 bg-black/20 border border-white/10 rounded-xl text-[13px] font-medium text-white placeholder:text-white/10 focus:bg-black/40 focus:border-white/20 outline-none transition-all shadow-inner"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={generating || myApplications.length === 0}
                                    className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold text-[11px] uppercase tracking-[0.2em] rounded-xl shadow-[0_4px_20px_-5px_rgba(var(--primary),0.3)] transition-all transform active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-30 disabled:shadow-none"
                                >
                                    {generating ? <Spinner size="sm" className="text-white" /> : <><ShieldCheckIcon className="w-4 h-4" /> Authorize & Seal</>}
                                </button>
                            </div>
                        </form>

                        {error && !generatedCode && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-3 bg-red-500/5 border border-red-500/10 rounded-lg flex items-center gap-2">
                                <AlertTriangleIcon className="w-3.5 h-3.5 text-red-500/60" />
                                <p className="text-[9px] font-bold text-red-400 uppercase tracking-wide">{error}</p>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* --- RIGHT PANEL: HERO ACTIVATION [Annotation D] --- */}
                <div className="lg:col-span-7 space-y-12">

                    {/* Hero Card: Protocol Visualizer */}
                    <div className="min-h-[580px] flex items-stretch">
                        <AnimatePresence mode="wait">
                            {generatedCode ? (
                                <motion.div
                                    key="active"
                                    initial={{ opacity: 0, scale: 0.98, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.98, y: -20 }}
                                    transition={{ type: 'spring', damping: 40, stiffness: 200 }}
                                    className={`w-full ${TOKENS.bg.layer1} rounded-[2rem] shadow-2xl ${TOKENS.border.precision} border relative overflow-hidden group flex flex-col`}
                                >
                                    <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
                                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

                                    <div className="p-12 text-center relative z-10 flex flex-col items-center justify-center h-full">
                                        <motion.div
                                            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }}
                                            className="mb-8 flex flex-col items-center gap-3"
                                        >
                                            <div className="w-12 h-12 bg-[#0E1F16] text-[#22C55E] rounded-full flex items-center justify-center border border-[#22C55E]/20 shadow-[0_0_20px_-5px_rgba(34,197,94,0.2)]">
                                                <CheckCircleIcon className="w-5 h-5" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#22C55E]/80 animate-pulse">Protocol Active</span>
                                        </motion.div>

                                        <h3 className="text-4xl font-serif font-medium text-white tracking-tight uppercase mb-3 text-center">Protocol <span className="text-white/20 italic">Activated</span></h3>
                                        <p className="text-white/30 text-sm font-serif italic max-w-xs mx-auto mb-12 leading-relaxed">
                                            Identity node provisioned. Dispatch secure cipher.
                                        </p>

                                        {/* The Code Display [Annotation E] */}
                                        <div
                                            className="w-full max-w-md p-10 bg-[#050608] border border-white/10 rounded-3xl relative group/code cursor-pointer hover:border-primary/20 transition-all duration-500 shadow-inner flex flex-col items-center justify-center gap-8"
                                            onClick={() => copyToClipboard(generatedCode, 'generated')}
                                        >
                                            <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em] select-none">Verification Cipher</p>

                                            {/* REUSED COMPONENT: ProtocolCodeDisplay */}
                                            <ProtocolCodeDisplay code={generatedCode} size="lg" status="Active" />

                                            <div className="absolute inset-0 flex items-center justify-center bg-[#050608]/90 opacity-0 group-hover/code:opacity-100 transition-opacity duration-300 rounded-3xl backdrop-blur-sm">
                                                <div className="flex items-center gap-3 px-6 py-3 bg-white/5 rounded-full border border-white/10">
                                                    <CopyIcon className="w-4 h-4 text-white" />
                                                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Copy</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-auto pt-12 flex justify-center gap-8 text-[9px] font-black uppercase tracking-[0.3em] text-white/20">
                                            <span className="flex items-center gap-2">24h Lifetime</span>
                                            <span className="w-1 h-1 rounded-full bg-white/10 self-center" />
                                            <span className="flex items-center gap-2">Encrypted</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="idle"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className={`w-full ${TOKENS.bg.layer1} rounded-[2rem] border ${TOKENS.border.subtle} flex items-center justify-center opacity-60`}
                                >
                                    <div className="text-center">
                                        <div className="w-20 h-20 border border-white/5 rounded-[2rem] flex items-center justify-center mx-auto mb-6 bg-white/[0.01]">
                                            <LockIcon className="w-6 h-6 text-white/20" />
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 mb-2">Protocol Idle</p>
                                        <p className="text-sm text-white/20 font-serif italic">Secure channel waiting for initialization.</p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Ledger Archive */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 px-2">
                            <div className="h-[1px] bg-white/5 flex-grow" />
                            <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">Registry Ledger • {codes.length}</span>
                            <div className="h-[1px] bg-white/5 flex-grow" />
                        </div>

                        {codes.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {codes.map((code, idx) => (
                                    <motion.div
                                        key={code.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className={`p-5 rounded-2xl border ${TOKENS.border.subtle} ${TOKENS.bg.surface} hover:border-white/10 transition-all duration-300 flex flex-col justify-between h-full group`}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/30 font-bold border border-white/5 font-serif text-xs">
                                                    {code.applicant_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white/80 text-xs uppercase tracking-wide">{code.applicant_name}</p>
                                                    <p className="text-[9px] text-white/20 font-black uppercase tracking-widest mt-0.5">{code.code_type}</p>
                                                </div>
                                            </div>
                                            {statusConfig[code.status].icon}
                                        </div>

                                        <div className="bg-[#050608] p-3 rounded-lg border border-white/5 flex justify-between items-center mb-4">
                                            {/* REUSED COMPONENT: ProtocolCodeDisplay */}
                                            <ProtocolCodeDisplay code={code.code} size="sm" status={code.status} />

                                            <button onClick={() => copyToClipboard(code.code, String(code.id))} className="text-white/20 hover:text-white transition-colors">
                                                {copiedCodeId === String(code.id) ? <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" /> : <CopyIcon className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-white/20">
                                            <span>Exp: {new Date(code.expires_at).toLocaleDateString()}</span>
                                            {code.status === 'Active' ? (
                                                <button onClick={() => handleRevokeCode(code.id)} className="text-red-500/40 hover:text-red-500 border border-transparent hover:border-red-500/20 px-2 py-1 bg-red-500/5 rounded-lg transition-all">Terminate</button>
                                            ) : (
                                                <button onClick={() => handleRegenerate(code)} className="text-white/20 hover:text-white transition-colors">Refetch</button>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
