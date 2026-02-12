
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, formatError } from './services/supabase';
import { ShareCode, ShareCodeStatus, AdmissionApplication, ShareCodeType } from './types';
import Spinner from './components/common/Spinner';
import { motion, AnimatePresence } from 'framer-motion';

// --- Assets & Icons ---
const Icons = {
    ShieldCheck: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
    ),
    Key: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
    ),
    Terminal: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
    ),
    Copy: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
    ),
    Check: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
    ),
    Refresh: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
    ),
    Trash: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
    ),
    EyeOff: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
    ),
    Eye: ({ className }: { className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
    )
};

// --- Sub-Components ---

const CredentialKeyGrid = ({ code, revealed }: { code: string; revealed: boolean }) => {
    return (
        <div className="flex gap-3 md:gap-4 flex-wrap justify-center py-6">
            {code.split('').map((char, index) => (
                <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`
                        flex items-center justify-center 
                        w-12 h-16 md:w-14 md:h-20
                        rounded-xl border 
                        ${char === '-'
                            ? 'border-transparent w-auto px-2'
                            : 'bg-[#0f1116] border-white/[0.08] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)]'
                        }
                    `}
                >
                    <span className={`
                        font-mono text-xl md:text-3xl font-bold 
                        ${char === '-' ? 'text-white/20' : revealed ? 'text-primary drop-shadow-[0_0_12px_rgba(139,92,246,0.3)]' : 'text-transparent bg-white/10 rounded w-4 h-4'}
                    `}>
                        {char === '-' ? '-' : revealed ? char : ''}
                    </span>
                </motion.div>
            ))}
        </div>
    );
};

const IdentityVaultCard = ({
    code,
    child,
    onCopy,
    onClose,
    isCopied
}: {
    code: string;
    child: AdmissionApplication | undefined;
    onCopy: () => void;
    onClose: () => void;
    isCopied: boolean;
}) => {
    const [revealed, setRevealed] = useState(false);

    useEffect(() => {
        // Auto-reveal for dramatic effect after brief delay
        const timer = setTimeout(() => setRevealed(true), 600);
        return () => clearTimeout(timer);
    }, []);

    // Format code for display: 5C89DF2051EF -> 5C89-DF20-51EF
    // This ensures even legacy codes or clean codes are displayed consistently
    const displayCode = useMemo(() => {
        if (!code) return '';
        const clean = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const chunked = clean.match(/.{1,4}/g)?.join('-') || clean;
        return chunked;
    }, [code]);

    return (
        <div className="w-full max-w-xl mx-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative bg-[#111318] rounded-[2rem] border border-white/[0.08] shadow-2xl p-8 md:p-12 overflow-hidden"
            >
                {/* Top Level: Identity Context */}
                <div className="flex flex-col items-center mb-10">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-primary/30 rounded-full blur-2xl opacity-40 animate-pulse"></div>
                        <div className="relative w-20 h-20 rounded-full bg-[#0c0d12] border-2 border-primary/40 flex items-center justify-center overflow-hidden shadow-inner">
                            {child?.profile_photo_url ? (
                                <img src={child.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-2xl font-serif font-black text-white">{child?.applicant_name?.charAt(0) || 'U'}</span>
                            )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-[#0c0d12] p-1.5 rounded-full border-2 border-[#111318]">
                            <Icons.Check className="w-3 h-3" />
                        </div>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-serif font-bold text-white tracking-tight mb-2">Identity Provisioned</h2>
                    <p className="text-white/40 text-[10px] uppercase tracking-[0.2em] font-medium flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Secure Transmission Channel
                    </p>
                </div>

                {/* Mid Level: The Vault (Key Display) */}
                <div className="bg-[#08090a] rounded-3xl border border-white/[0.05] p-6 mb-8 relative group">
                    <div className="flex justify-between items-center mb-2 px-2">
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">Protocol Key</span>
                        <button
                            onClick={() => setRevealed(!revealed)}
                            className="text-[9px] font-bold text-white/20 hover:text-white/60 transition-colors uppercase tracking-widest flex items-center gap-1.5"
                        >
                            {revealed ? <><Icons.EyeOff className="w-3 h-3" /> Mask</> : <><Icons.Eye className="w-3 h-3" /> Reveal</>}
                        </button>
                    </div>

                    <CredentialKeyGrid code={displayCode} revealed={revealed} />

                    <div className="text-center pt-2">
                        <p className="text-[10px] text-orange-400/80 font-medium bg-orange-500/5 inline-block px-3 py-1 rounded-full border border-orange-500/10">
                            ⚠ Do not share this credential on public networks.
                        </p>
                    </div>
                </div>

                {/* Bottom Level: Actions */}
                <div className="space-y-4">
                    <button
                        onClick={onCopy}
                        className="w-full h-14 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold uppercase tracking-[0.15em] text-xs flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-primary/20"
                    >
                        {isCopied ? <><Icons.Check className="w-5 h-5" /> Copied Securely</> : <><Icons.Copy className="w-5 h-5" /> Copy Credential</>}
                    </button>

                    <button
                        onClick={onClose}
                        className="w-full h-12 bg-transparent hover:bg-white/5 text-white/40 hover:text-white rounded-xl font-bold uppercase tracking-[0.15em] text-[10px] transition-colors"
                    >
                        Acknowledge & Continue
                    </button>
                </div>

                {/* Decorative Elements */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50"></div>
            </motion.div>
        </div>
    );
};

const ProvisionSidebar = ({
    myApplications,
    selectedAdmission,
    setSelectedAdmission,
    codeType,
    setCodeType,
    isReadyForAuth,
    handleGenerateCode,
    generating
}: any) => {
    return (
        <div className="bg-[#111318]/60 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-white/5 shadow-xl">
            <div className="mb-8 pb-6 border-b border-white/5">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-primary/10 rounded-lg text-primary border border-primary/20"><Icons.Key className="w-5 h-5" /></div>
                    <span className="text-xs font-bold text-white uppercase tracking-widest">Provisioning</span>
                </div>
                <h3 className="text-lg font-serif font-bold text-white">New Credential</h3>
            </div>

            <div className="space-y-8">
                {/* Step 1 */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">1. Select Identity Node</label>
                    </div>

                    <div className="space-y-2">
                        {myApplications.map((app: any) => (
                            <button
                                key={app.id}
                                onClick={() => setSelectedAdmission(String(app.id))}
                                className={`w-full p-3.5 rounded-xl border flex items-center justify-between transition-all duration-200 ${selectedAdmission === String(app.id)
                                    ? 'bg-primary/10 border-primary/40 shadow-[0_0_15px_-3px_rgba(139,92,246,0.15)]'
                                    : 'bg-[#0c0d12] border-white/5 hover:border-white/10 opacity-70 hover:opacity-100'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${selectedAdmission === String(app.id) ? 'bg-primary text-white' : 'bg-white/10 text-white/40'
                                        }`}>
                                        {app.applicant_name.charAt(0)}
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs font-bold text-white leading-tight">{app.applicant_name}</p>
                                        <p className="text-[9px] font-medium text-white/30 mt-0.5">Grade {app.grade}</p>
                                    </div>
                                </div>
                                {selectedAdmission === String(app.id) && <Icons.Check className="w-3.5 h-3.5 text-primary" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Step 2 */}
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">2. Protocol Layer</label>
                    <div className="grid grid-cols-2 gap-3">
                        {['Enquiry', 'Admission'].map((type) => (
                            <button
                                key={type}
                                onClick={() => setCodeType(type)}
                                className={`h-20 px-4 rounded-xl border flex flex-col justify-center gap-2 transition-all duration-200 ${codeType === type
                                    ? 'bg-primary/10 border-primary/40 relative overflow-hidden'
                                    : 'bg-[#0c0d12] border-white/5 hover:border-white/10 opacity-60 hover:opacity-100'
                                    }`}
                            >
                                {type === 'Enquiry' ? <Icons.ShieldCheck className={`w-5 h-5 ${codeType === type ? 'text-primary' : 'text-white/30'}`} /> : <Icons.Terminal className={`w-5 h-5 ${codeType === type ? 'text-primary' : 'text-white/30'}`} />}
                                <span className={`text-[10px] font-black uppercase tracking-[0.15em] text-left ${codeType === type ? 'text-white' : 'text-white/40'}`}>{type}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Action */}
                <button
                    onClick={handleGenerateCode}
                    disabled={!isReadyForAuth}
                    className={`w-full py-4 rounded-xl font-bold text-[10px] uppercase tracking-[0.25em] transition-all flex items-center justify-center gap-2 mt-4 ${isReadyForAuth
                        ? 'bg-white text-black hover:bg-white/90 shadow-lg'
                        : 'bg-white/5 text-white/10 cursor-not-allowed border border-white/5'
                        }`}
                >
                    {generating ? <Spinner size="sm" /> : <><Icons.ShieldCheck className="w-4 h-4" /> Authorize & Seal</>}
                </button>
            </div>
        </div>
    );
};

const RegistryLedger = ({ codes, loading, onCopy, onRevoke }: any) => {
    return (
        <div className="mt-16 border-t border-white/[0.04] pt-10">
            <div className="flex items-center justify-between mb-8 opacity-60 hover:opacity-100 transition-opacity">
                <h3 className="text-sm font-black text-white/50 uppercase tracking-[0.2em]">Registry Ledger</h3>
                <span className="text-[9px] font-bold text-white/20 bg-white/5 px-2 py-1 rounded">AUDIT LOG</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-32 bg-white/[0.02] rounded-2xl animate-pulse"></div>
                    ))
                ) : codes.length === 0 ? (
                    <div className="col-span-full py-16 text-center border border-dashed border-white/5 rounded-3xl bg-white/[0.01]">
                        <Icons.Terminal className="w-8 h-8 text-white/10 mx-auto mb-3" />
                        <p className="text-xs font-medium text-white/30">No active access protocols recorded.</p>
                    </div>
                ) : (
                    codes.map((code: any) => (
                        <div key={code.id} className="group bg-[#0f1116] border border-white/5 hover:border-white/10 rounded-2xl p-5 hover:bg-[#13151b] transition-all duration-200">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-xs font-bold text-white mb-0.5">{code.applicant_name}</p>
                                    <p className="text-[9px] font-medium text-white/40 uppercase tracking-widest">{code.code_type}</p>
                                </div>
                                <div className={`w-2 h-2 rounded-full ${code.status === 'Active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-white/20'}`}></div>
                            </div>

                            <div className="flex items-center justify-between bg-black/20 rounded-lg p-2 border border-white/5 mb-4 group-hover:border-white/10 transition-colors">
                                <code className="text-xs font-mono text-white/60 tracking-widest">****{code.code.slice(-4)}</code>
                                <button onClick={() => onCopy(code.code)} className="p-1.5 hover:bg-white/10 rounded text-white/30 hover:text-white transition-colors">
                                    <Icons.Copy className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                                <span className="text-[9px] text-white/20 font-medium">Expires {new Date(code.expires_at).toLocaleDateString()}</span>
                                {code.status === 'Active' && (
                                    <button onClick={() => onRevoke(code.id)} className="text-[9px] font-bold text-red-500/40 hover:text-red-500 uppercase tracking-wider flex items-center gap-1 transition-colors">
                                        Revoke
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};


// --- Main Page Component ---

export default function ShareCodesTab() {
    const [codes, setCodes] = useState<ShareCode[]>([]);
    const [myApplications, setMyApplications] = useState<AdmissionApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedAdmission, setSelectedAdmission] = useState<string>('');
    const [purpose, setPurpose] = useState('');
    const [codeType, setCodeType] = useState<ShareCodeType | null>(null);
    const [generating, setGenerating] = useState(false);
    const [generatedCode, setGeneratedCode] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        const [appsRes, codesRes] = await Promise.all([
            supabase.rpc('get_my_children_profiles'),
            supabase.rpc('get_my_share_codes')
        ]);
        if (appsRes.error) setError(formatError(appsRes.error));
        else setMyApplications(appsRes.data || []);
        if (codesRes.error) setError(formatError(codesRes.error));
        else setCodes(codesRes.data || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleGenerateCode = async () => {
        if (!selectedAdmission || !codeType || generating) return;
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
            setGeneratedCode(data);
            setPurpose('');
            await fetchData();
        } catch (err: any) {
            setError(formatError(err));
        } finally {
            setGenerating(false);
        }
    };

    const handleRevokeCode = async (id: number) => {
        const { error } = await supabase.rpc('revoke_my_share_code', { p_code_id: id });
        if (error) alert(formatError(error));
        else await fetchData();
    };

    const handleCopyCode = (code: string) => {
        navigator.clipboard.writeText(code).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    const isReadyForAuth = selectedAdmission && codeType && !generating;
    const selectedChild = useMemo(() => myApplications.find(a => String(a.id) === selectedAdmission), [myApplications, selectedAdmission]);

    return (
        <div className="max-w-[1600px] mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-16 animate-in fade-in duration-700 font-sans min-h-[80vh]">

            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/[0.04] pb-8">
                <div className="space-y-3">
                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.4em] opacity-80 pl-1">Security Infrastructure</span>
                    <h1 className="text-4xl md:text-5xl font-serif font-bold text-white tracking-tight">
                        Access <span className="text-white/20 italic font-medium">Protocols.</span>
                    </h1>
                </div>
                <button onClick={fetchData} className="group flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/[0.03] border border-white/5 text-[10px] font-bold text-white/40 uppercase tracking-widest hover:text-white hover:bg-white/5 transition-all">
                    <Icons.Refresh className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-700" />
                    Sync Registry
                </button>
            </header>

            <main className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
                {/* Left: Controls */}
                <section className="lg:col-span-4 sticky top-8">
                    <ProvisionSidebar
                        myApplications={myApplications}
                        selectedAdmission={selectedAdmission}
                        setSelectedAdmission={setSelectedAdmission}
                        codeType={codeType}
                        setCodeType={setCodeType}
                        isReadyForAuth={isReadyForAuth}
                        handleGenerateCode={handleGenerateCode}
                        generating={generating}
                    />
                </section>

                {/* Right: Stage */}
                <section className="lg:col-span-8 flex flex-col min-h-[600px]">
                    <AnimatePresence mode="wait">
                        {generatedCode ? (
                            <IdentityVaultCard
                                key="result"
                                code={generatedCode}
                                child={selectedChild}
                                onCopy={() => handleCopyCode(generatedCode)}
                                onClose={() => setGeneratedCode(null)}
                                isCopied={isCopied}
                            />
                        ) : (
                            <motion.div
                                key="empty"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-[3rem] bg-white/[0.01] p-12 text-center"
                            >
                                <div className="w-24 h-24 rounded-full bg-[#0c0d12] border border-white/5 flex items-center justify-center mb-8 shadow-2xl">
                                    <Icons.ShieldCheck className="w-8 h-8 text-white/10" />
                                </div>
                                <h2 className="text-2xl font-serif font-bold text-white/30 tracking-tight">Awaiting Initialization</h2>
                                <p className="text-sm text-white/20 mt-2 max-w-sm font-medium">Select a target identity node and protocol layer to generate a secure provisioning key.</p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Registry moves here to be below the main stage */}
                    <RegistryLedger
                        codes={codes}
                        loading={loading}
                        onCopy={handleCopyCode}
                        onRevoke={handleRevokeCode}
                    />
                </section>
            </main>
        </div>
    );
}
