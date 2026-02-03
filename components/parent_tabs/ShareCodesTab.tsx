import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, formatError } from '../../services/supabase';
import { ShareCode, AdmissionApplication, ShareCodeType } from '../../types';
import Spinner from '../common/Spinner';
import PremiumAvatar from '../common/PremiumAvatar';

// --- Integrated Lucid-style Icons ---
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
import { LockIcon } from '../icons/LockIcon';
import { GlobeIcon } from '../icons/GlobeIcon';
import { SearchIcon } from '../icons/SearchIcon';
import { motion, AnimatePresence } from 'framer-motion';

// --- ADVANCED DESIGN TOKENS ---
const TOKENS = {
    glass: 'backdrop-blur-2xl bg-white/[0.01] border border-white/[0.04] shadow-2xl',
    card: 'bg-[#0A0B0F] border border-white/[0.06] shadow-2xl overflow-hidden',
    panel: 'bg-[#08090C] border border-white/[0.03]',
    input: 'bg-black/40 border border-white/10 rounded-xl focus:border-primary/40 focus:ring-1 focus:ring-primary/10 transition-all outline-none text-white placeholder:text-white/10 text-sm font-medium',
    text: {
        h: 'font-serif font-medium tracking-tight uppercase',
        h_bold: 'font-serif font-black tracking-tight uppercase',
        label: 'text-[10px] font-black uppercase tracking-[0.4em] text-white/20',
        body: 'text-sm text-white/40 leading-relaxed font-medium',
    },
    success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)]',
};

const statusMap: { [key: string]: { label: string; color: string; bg: string; border: string } } = {
    'Active': { label: 'PROVISIONED', color: 'text-emerald-400', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20' },
    'Redeemed': { label: 'VERIFIED', color: 'text-indigo-400', bg: 'bg-indigo-500/5', border: 'border-indigo-500/20' },
    'Revoked': { label: 'TERMINATED', color: 'text-red-400', bg: 'bg-red-500/5', border: 'border-red-500/20' },
    'Expired': { label: 'TIMED_OUT', color: 'text-white/20', bg: 'bg-white/5', border: 'border-white/10' },
};

// --- SUB-COMPONENTS ---

const CodeDigit = ({ char, active, size = 'lg' }: { char: string; active: boolean; size?: 'sm' | 'lg' }) => {
    const isLarge = size === 'lg';
    return (
        <div className={`
            relative flex items-center justify-center rounded-xl border font-mono font-black transition-all duration-500
            ${isLarge ? 'w-14 h-16 md:w-16 md:h-20 text-3xl md:text-4xl' : 'w-8 h-10 text-xs'}
            ${char === '-' ? 'border-transparent text-white/10' :
                active ? 'bg-primary/5 border-primary/20 text-primary' : 'bg-white/5 border-white/5 text-white/20'}
        `}>
            {char}
            {active && char !== '-' && (
                <div className="absolute inset-0 bg-primary/20 blur-2xl opacity-10 pointer-events-none" />
            )}
        </div>
    );
};

const RegistryCard = ({ code, onRevoke, onCopy, onRefetch, isCopied }: {
    code: ShareCode;
    onRevoke: (id: number) => void;
    onCopy: (text: string, id: string) => void;
    onRefetch: (code: ShareCode) => void;
    isCopied: boolean;
}) => {
    const status = statusMap[code.status] || statusMap.Expired;
    const codeChars = code.code.split('');

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`group p-6 rounded-[2.5rem] ${TOKENS.card} transition-all duration-500 border-white/[0.04] hover:border-white/10`}
        >
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center text-white/20 group-hover:text-primary transition-colors">
                        <UsersIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-widest">{code.applicant_name}</h4>
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mt-0.5">{code.code_type} PROTOCOL</p>
                    </div>
                </div>
                <div className={`px-2.5 py-1 rounded-lg border ${status.bg} ${status.border} ${status.color} text-[8px] font-black uppercase tracking-widest`}>
                    {status.label}
                </div>
            </div>

            <div
                onClick={() => onCopy(code.code, String(code.id))}
                className="bg-black/40 border border-white/[0.03] rounded-2xl p-4 flex items-center justify-between group/code-well cursor-pointer hover:border-primary/20 transition-all mb-4 shadow-inner"
            >
                <div className="flex items-baseline gap-1.5 overflow-hidden">
                    {codeChars.map((char, i) => (
                        <span key={i} className={`font-mono font-black text-lg ${code.status === 'Active' ? 'text-white/30 group-hover/code-well:text-white' : 'text-white/10'} transition-colors`}>
                            {char}
                        </span>
                    ))}
                </div>
                <div className={`p-2 rounded-lg transition-all ${isCopied ? 'bg-emerald-500/10 text-emerald-400' : 'text-white/10 group-hover/code-well:text-primary'}`}>
                    {isCopied ? <CheckCircleIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                </div>
            </div>

            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-white/10 pt-1">
                <div className="flex items-center gap-2">
                    <ClockIcon className="w-3 h-3" />
                    <span>Exp: {new Date(code.expires_at).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center gap-1">
                    {code.status === 'Active' ? (
                        <button
                            onClick={(e) => { e.stopPropagation(); onRevoke(code.id); }}
                            className="p-2 text-white/10 hover:text-red-400 transition-colors"
                            title="Revoke Protocol"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={(e) => { e.stopPropagation(); onRefetch(code); }}
                            className="p-2 text-white/10 hover:text-primary transition-colors"
                            title="Refetch Protocol"
                        >
                            <RotateCcwIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

// --- MAIN COMPONENT ---

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
                supabase.from('admission_share_codes').select('*').order('created_at', { ascending: false })
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
                applicant_name: c.applicant_name || apps.find((a: any) => a.id === (c.admission_id || c.enquiry_id))?.applicant_name || 'Unknown Applicant'
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
        // Safe Pattern: Confirm before revoke
        if (confirm('TERMINATE PROTOCOL: Revoke this provision key immediately?')) {
            const { error } = await supabase.rpc('revoke_my_share_code', { p_code_id: id });
            if (error) alert(formatError(error));
            else await fetchData();
        }
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedCodeId(id);
            setTimeout(() => setCopiedCodeId(null), 2000);
        });
    };

    const selectedChild = useMemo(() =>
        myApplications.find(a => String(a.id) === selectedAdmission),
        [myApplications, selectedAdmission]);

    if (loading && myApplications.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-48 gap-8">
                <Spinner size="lg" className="text-primary" />
                <p className={TOKENS.text.label}>Initializing Matrix...</p>
            </div>
        );
    }

    return (
        <div className="max-w-[1400px] mx-auto py-8 lg:py-16 space-y-20 animate-in fade-in duration-700">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10 border-b border-white/[0.03] pb-10">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="h-[1px] w-12 bg-primary/40" />
                        <span className={TOKENS.text.label}>Secure Orchestration</span>
                    </div>
                    <h1 className={`${TOKENS.text.h_bold} text-4xl md:text-5xl lg:text-6xl text-white leading-none tracking-tight`}>
                        Access <span className="text-white/20 italic font-medium">Protocols.</span>
                    </h1>
                    <p className={TOKENS.text.body}>
                        Govern and manage encrypted access layers for institutional identity infrastructure.
                    </p>
                </div>

                <div className="flex items-center gap-6">
                    <button
                        onClick={fetchData}
                        className="px-8 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] text-white/30 hover:text-white transition-all group flex items-center gap-3 active:scale-95 shadow-xl"
                    >
                        <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'}`} />
                        Sync Registry
                    </button>
                    <div className="hidden lg:block h-10 w-px bg-white/10" />
                    <div className="hidden lg:flex flex-col items-end opacity-20">
                        <p className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Identity Console</p>
                        <p className="text-[9px] font-bold text-white uppercase tracking-widest mt-1">v9.5.1</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">

                {/* --- LEFT: PROVISION NODE --- */}
                <div className="lg:col-span-4 space-y-10">
                    <div className={`p-10 rounded-[3rem] ${TOKENS.card}`}>
                        <div className="flex items-center gap-5 mb-10">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl border border-primary/20 flex items-center justify-center text-primary shadow-2xl">
                                <KeyIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-white uppercase tracking-widest">Provision Key</h3>
                                <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] mt-0.5">Initialize Identity Node</p>
                            </div>
                        </div>

                        <form onSubmit={handleGenerateCode} className="space-y-10">
                            {/* 1. Target Selector */}
                            <div className="space-y-4">
                                <label className={TOKENS.text.label}>1. Select Target Node</label>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar pr-1">
                                    {myApplications.map(app => (
                                        <button
                                            key={app.id}
                                            type="button"
                                            onClick={() => setSelectedAdmission(String(app.id))}
                                            className={`
                                                w-full flex items-center justify-between p-5 rounded-2xl border transition-all duration-300 group
                                                ${selectedAdmission === String(app.id)
                                                    ? 'bg-primary/10 border-primary/40 shadow-xl'
                                                    : 'bg-white/[0.02] border-white/5 hover:border-white/10 opacity-40 hover:opacity-100'}
                                            `}
                                        >
                                            <div className="flex items-center gap-4">
                                                <PremiumAvatar name={app.applicant_name} size="xs" className="w-8 h-8 rounded-lg" />
                                                <div className="text-left">
                                                    <p className={`text-[11px] font-black uppercase tracking-tight ${selectedAdmission === String(app.id) ? 'text-white' : 'text-white/40 group-hover:text-white/60'}`}>
                                                        {app.applicant_name}
                                                    </p>
                                                    <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mt-0.5">
                                                        Grade {app.grade}
                                                    </p>
                                                </div>
                                            </div>
                                            {selectedAdmission === String(app.id) && (
                                                <CheckCircleIcon className="w-4 h-4 text-primary animate-in zoom-in" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 2. Protocol Layer */}
                            <div className="space-y-4">
                                <label className={TOKENS.text.label}>2. Access Protocol Layer</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setCodeType('Enquiry')}
                                        className={`flex flex-col items-center justify-center gap-3 p-6 rounded-[2rem] border transition-all duration-500 group/btn ${codeType === 'Enquiry' ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20' : 'bg-white/[0.02] border-white/5 opacity-30 hover:opacity-100'}`}
                                    >
                                        <InfoIcon className={`w-5 h-5 transition-all ${codeType === 'Enquiry' ? 'text-primary' : 'text-white/20 group-hover/btn:text-white/40'}`} />
                                        <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${codeType === 'Enquiry' ? 'text-primary' : 'text-white/20'}`}>Enquiry</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCodeType('Admission')}
                                        className={`flex flex-col items-center justify-center gap-3 p-6 rounded-[2rem] border transition-all duration-500 group/btn ${codeType === 'Admission' ? 'bg-indigo-500/5 border-indigo-500/30 ring-1 ring-indigo-500/20' : 'bg-white/[0.02] border-white/5 opacity-30 hover:opacity-100'}`}
                                    >
                                        <ShieldCheckIcon className={`w-5 h-5 transition-all ${codeType === 'Admission' ? 'text-indigo-400' : 'text-white/20 group-hover/btn:text-white/40'}`} />
                                        <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${codeType === 'Admission' ? 'text-indigo-400' : 'text-white/20'}`}>Admission</span>
                                    </button>
                                </div>
                            </div>

                            {/* 3. Action */}
                            <div className="pt-6">
                                <button
                                    type="submit"
                                    disabled={generating || !selectedAdmission}
                                    className={`
                                        w-full py-6 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.5em] transition-all duration-500 flex items-center justify-center gap-4 relative overflow-hidden shadow-2xl
                                        ${generating || !selectedAdmission
                                            ? 'bg-white/5 text-white/10 border border-white/10 grayscale cursor-not-allowed opacity-50'
                                            : 'bg-primary text-white hover:-translate-y-1 active:scale-95 border border-primary/20'}
                                    `}
                                >
                                    {generating ? <Spinner size="sm" className="text-white" /> : <><ShieldCheckIcon className="w-5 h-5" /> Authorize & Seal</>}
                                </button>
                                <p className="text-[9px] text-white/10 font-bold uppercase tracking-[0.2em] text-center mt-6 selection:bg-transparent">
                                    Secure Transmission protocol enabled
                                </p>
                            </div>
                        </form>
                    </div>
                </div>

                {/* --- RIGHT: PROTOCOL VISUALIZER (HERO) --- */}
                <div className="lg:col-span-8 flex flex-col gap-12">
                    <div className={`min-h-[640px] rounded-[4rem] ${TOKENS.card} relative flex flex-col items-center justify-center text-center p-12 lg:p-24 overflow-hidden border-white/[0.03]`}>
                        {/* Final Clean Ambient Gradient */}
                        <div className="absolute top-0 right-0 w-full h-full bg-primary/5 blur-[160px] rounded-full pointer-events-none opacity-30" />

                        <AnimatePresence mode="wait">
                            {generatedCode ? (
                                <motion.div
                                    key="activated"
                                    initial={{ opacity: 0, scale: 0.98, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 1.05, y: -20 }}
                                    className="relative z-10 w-full max-w-2xl flex flex-col items-center gap-12"
                                >
                                    <div className="space-y-4">
                                        <motion.div
                                            initial={{ rotate: -180, scale: 0.5 }}
                                            animate={{ rotate: 0, scale: 1 }}
                                            className={`w-14 h-14 rounded-2xl flex items-center justify-center border mx-auto ${TOKENS.success}`}
                                        >
                                            <CheckCircleIcon className="w-7 h-7" />
                                        </motion.div>
                                        <h2 className={`${TOKENS.text.h_bold} text-4xl lg:text-5xl text-white tracking-tight leading-none`}>
                                            Identity <span className="text-white/20 italic font-medium">Provisioned.</span>
                                        </h2>
                                        <p className="text-emerald-500/50 text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">Transmission Secured & Signed</p>
                                    </div>

                                    <div
                                        onClick={() => copyToClipboard(generatedCode, 'hero')}
                                        className="w-full bg-[#050608] border border-white/10 rounded-[2.5rem] p-12 md:p-20 relative group/cipher cursor-pointer hover:border-primary/20 transition-all duration-700 shadow-inner flex flex-col items-center gap-12 overflow-hidden"
                                    >
                                        <p className={TOKENS.text.label}>Protocol Provision Key</p>

                                        <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-3 justify-center">
                                            {generatedCode.split('').map((char, i) => (
                                                <CodeDigit key={i} char={char} active={true} size="lg" />
                                            ))}
                                        </div>

                                        <div className={`flex items-center gap-4 py-3.5 px-8 rounded-full border text-[10px] font-black uppercase tracking-[0.4em] transition-all duration-500 ${copiedCodeId === 'hero' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/10 text-white/30 group-hover/cipher:text-primary group-hover/cipher:border-primary/20'}`}>
                                            {copiedCodeId === 'hero' ? (
                                                <><CheckCircleIcon className="w-4 h-4 text-emerald-500" /> Identity Copied</>
                                            ) : (
                                                <><CopyIcon className="w-4 h-4" /> Seal & Copy Protocol</>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-12 text-left w-full border-t border-white/5 pt-12">
                                        <div className="space-y-1">
                                            <p className={TOKENS.text.label}>Binding Scope</p>
                                            <p className="text-xl font-black text-white uppercase tracking-tighter truncate max-w-[240px]">{selectedChild?.applicant_name || 'Registry Node'}</p>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <p className={TOKENS.text.label}>Validation Epoch</p>
                                            <p className="text-xl font-black text-primary uppercase tracking-tighter">One-Time (24h)</p>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="idle"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex flex-col items-center gap-10 opacity-30"
                                >
                                    <div className="w-[100px] h-[100px] bg-white/[0.02] rounded-[3rem] border border-white/5 flex items-center justify-center group">
                                        <LockIcon className="w-10 h-10 text-white/20 group-hover:text-white/40 transition-colors" />
                                    </div>
                                    <div className="space-y-3">
                                        <h3 className={`${TOKENS.text.h} text-3xl text-white`}>Protocol <span className="text-white/5 italic font-medium">Idle.</span></h3>
                                        <p className="text-xs text-white/30 font-serif italic max-w-xs mx-auto leading-relaxed">
                                            Select target node and protocol layer to initialize authentication.
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* --- REGISTRY LEDGER --- */}
                    <div className="space-y-10">
                        <div className="flex items-center justify-between px-6">
                            <div className="flex items-center gap-5">
                                <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-white/20">
                                    <SearchIcon className="w-5 h-5" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black text-white uppercase tracking-widest leading-none">Registry Ledger</h3>
                                    <p className="text-[10px] font-bold text-white/10 uppercase tracking-[0.3em] underline decoration-primary/20">Historical Authorization Log</p>
                                </div>
                            </div>
                            <div className="px-5 py-2 rounded-full bg-white/[0.03] border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/40">
                                {codes.length} ENTRIES
                            </div>
                        </div>

                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="h-[220px] bg-white/[0.02] border border-white/5 rounded-[3rem] animate-pulse" />
                                ))}
                            </div>
                        ) : codes.length === 0 ? (
                            <div className="py-32 border-2 border-dashed border-white/5 rounded-[4rem] flex flex-col items-center justify-center text-center gap-8 bg-white/[0.01]">
                                <GlobeIcon className="w-12 h-12 text-white/5" />
                                <p className="text-[10px] font-black text-white/10 uppercase tracking-[1em]">Ledger Archive Empty</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                                {codes.map(code => (
                                    <RegistryCard
                                        key={code.id}
                                        code={code}
                                        onRevoke={handleRevokeCode}
                                        onCopy={copyToClipboard}
                                        onRefetch={(c) => {
                                            setSelectedAdmission(c.admission_id || '');
                                            setCodeType(c.code_type);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        isCopied={copiedCodeId === String(code.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}
