
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, formatError } from './services/supabase';
import { ShareCode, ShareCodeStatus, AdmissionApplication, ShareCodeType } from './types';
import Spinner from './components/common/Spinner';
import { motion, AnimatePresence } from 'framer-motion';

// --- Authoritative Icons ---
const ShieldLockIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
);
const KeyIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
);
const UserGroupIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
);
const TerminalIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);
const CopyIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);
const CheckIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);

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

    // Masked identifier for UI list
    const maskCode = (code: string) => `****${code.slice(-4)}`;

    return (
        <div className="max-w-[1400px] mx-auto py-8 space-y-12 animate-in fade-in duration-700">
            {/* 1. Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/[0.05] pb-10">
                <div className="space-y-1">
                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.5em] opacity-80">Secure Orchestration</span>
                    <h1 className="text-4xl md:text-5xl font-serif font-black text-white tracking-tighter uppercase leading-none">Access <span className="text-white/20 italic font-medium">Protocols.</span></h1>
                    <p className="text-sm text-white/40 mt-3 font-medium max-w-lg leading-relaxed italic">Govern and manage encrypted access layers for institutional identity infrastructure.</p>
                </div>
                <button onClick={fetchData} className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-95 shadow-xl">Sync Vault</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch h-full">
                {/* 2. Control Panel (Left) */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Card 1: Provision Key Selector */}
                    <div className="bg-[#0c0d12]/60 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 space-y-8 shadow-2xl relative overflow-hidden group">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-2xl text-primary border border-primary/20"><KeyIcon className="w-5 h-5" /></div>
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Provision Key</h3>
                                <p className="text-[9px] text-white/20 font-black uppercase tracking-[0.3em] mt-0.5">Identity Authorization Node</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ml-1">1. Select Target Node</p>
                            <div className="space-y-2">
                                {myApplications.length === 0 ? (
                                    <div className="p-6 rounded-2xl bg-white/5 border border-dashed border-white/10 text-center animate-pulse">
                                        <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">No Child Profiles Detected</p>
                                    </div>
                                ) : (
                                    myApplications.map(app => (
                                        <button
                                            key={app.id}
                                            onClick={() => setSelectedAdmission(String(app.id))}
                                            className={`w-full p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between group/item ${selectedAdmission === String(app.id)
                                                ? 'bg-primary/10 border-primary/40 shadow-lg shadow-primary/5 scale-[0.98]'
                                                : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04] opacity-40 hover:opacity-100'}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`p-2 rounded-xl transition-colors ${selectedAdmission === String(app.id) ? 'bg-primary text-white' : 'bg-white/5 text-white/20 group-hover/item:text-white/40'}`}><TerminalIcon className="w-4 h-4" /></div>
                                                <div className="text-left">
                                                    <p className="text-xs font-black text-white uppercase tracking-tight leading-none group-hover/item:text-primary transition-colors">{app.applicant_name}</p>
                                                    <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mt-1">Grade {app.grade}</p>
                                                </div>
                                            </div>
                                            {selectedAdmission === String(app.id) && <CheckIcon className="w-4 h-4 text-primary animate-in zoom-in" />}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Card 2: Access Protocol Type */}
                        <div className="space-y-4 pt-4 border-t border-white/[0.03]">
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ml-1">2. Access Protocol</p>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setCodeType('Enquiry')}
                                    className={`p-6 rounded-2xl border transition-all duration-300 text-left relative group/btn ${codeType === 'Enquiry'
                                        ? 'bg-primary/10 border-primary/40 shadow-xl'
                                        : 'bg-white/[0.02] border-white/5 hover:border-white/10 opacity-40 hover:opacity-100 h-full'}`}
                                >
                                    <div className="h-full flex flex-col justify-between gap-4">
                                        <ShieldLockIcon className={`w-5 h-5 ${codeType === 'Enquiry' ? 'text-primary' : 'text-white/20'}`} />
                                        <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${codeType === 'Enquiry' ? 'text-primary' : 'text-white/40'}`}>Enquiry</span>
                                    </div>
                                    {codeType === 'Enquiry' && <div className="absolute top-4 right-4 animate-in zoom-in"><CheckIcon className="w-3 h-3 text-primary" /></div>}
                                </button>
                                <button
                                    onClick={() => setCodeType('Admission')}
                                    className={`p-6 rounded-2xl border transition-all duration-300 text-left relative group/btn ${codeType === 'Admission'
                                        ? 'bg-primary/10 border-primary/40 shadow-xl'
                                        : 'bg-white/[0.02] border-white/5 hover:border-white/10 opacity-40 hover:opacity-100 h-full'}`}
                                >
                                    <div className="h-full flex flex-col justify-between gap-4">
                                        <TerminalIcon className={`w-5 h-5 ${codeType === 'Admission' ? 'text-primary' : 'text-white/20'}`} />
                                        <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${codeType === 'Admission' ? 'text-primary' : 'text-white/40'}`}>Admission</span>
                                    </div>
                                    {codeType === 'Admission' && <div className="absolute top-4 right-4 animate-in zoom-in"><CheckIcon className="w-3 h-3 text-primary" /></div>}
                                </button>
                            </div>
                            <p className="text-[9px] text-white/20 font-medium italic mt-2 px-1">“This protocol defines the scope of authorization.”</p>
                        </div>

                        {/* Card 3: Payload Context */}
                        <div className="space-y-4 pt-4 border-t border-white/[0.03]">
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ml-1">3. Payload Context</p>
                            <input
                                type="text"
                                placeholder="Purpose of access..."
                                value={purpose}
                                onChange={(e) => setPurpose(e.target.value)}
                                className="w-full h-12 px-6 rounded-xl bg-black/40 border border-white/5 text-white placeholder:text-white/10 focus:border-primary/50 focus:bg-black/60 outline-none transition-all text-[11px] font-medium"
                            />
                        </div>

                        {/* Authorize Action */}
                        <div className="pt-4">
                            <button
                                onClick={handleGenerateCode}
                                disabled={!isReadyForAuth}
                                className={`w-full py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.4em] transition-all duration-300 flex items-center justify-center gap-4 ${isReadyForAuth
                                    ? 'bg-primary text-primary-foreground shadow-2xl shadow-primary/20 hover:-translate-y-1 active:scale-95'
                                    : 'bg-white/5 text-white/10 border border-white/[0.02] grayscale opacity-50'}`}
                            >
                                {generating ? <Spinner size="sm" /> : <><ShieldLockIcon className="w-5 h-5" /> Authorize & Seal</>}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 3. Protocol State Panel (Right - Hero) */}
                <div className="lg:col-span-8 flex flex-col">
                    <div className="flex-1 bg-[#0c0d12]/40 backdrop-blur-3xl rounded-[3.5rem] border border-white/5 relative overflow-hidden flex flex-col items-center justify-center text-center p-10 md:p-20 group">
                        {/* Animated Background Gradients */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-primary/5 rounded-full blur-[140px] pointer-events-none transition-all duration-700 group-hover:scale-110 opacity-30"></div>

                        <AnimatePresence mode="wait">
                            {generatedCode ? (
                                <motion.div
                                    key="active-state"
                                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: 20 }}
                                    className="relative z-10 w-full max-w-lg space-y-12"
                                >
                                    <div className="space-y-4">
                                        <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner border border-emerald-500/20 animate-in zoom-in duration-500">
                                            <CheckIcon className="w-10 h-10 text-emerald-500" />
                                        </div>
                                        <h3 className="text-4xl font-serif font-black text-white tracking-widest uppercase leading-none">Identity <span className="text-white/20 italic">Authorized.</span></h3>
                                        <p className="text-[11px] text-emerald-500/60 font-black uppercase tracking-[0.5em]">Protocol Active & Synced</p>
                                    </div>

                                    <div className="bg-black/60 border border-white/5 rounded-[2.5rem] p-10 space-y-8 relative overflow-hidden group/code overflow-hidden active:scale-[0.99] transition-transform cursor-pointer" onClick={() => handleCopyCode(generatedCode)}>
                                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-scanner-move opacity-20"></div>
                                        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em]">Protocol Identifier</p>
                                        <div className="text-6xl md:text-7xl font-mono font-black text-primary tracking-[0.3em] select-all shadow-primary/20 drop-shadow-2xl">
                                            {generatedCode}
                                        </div>
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/80 opacity-0 group-hover/code:opacity-100 transition-opacity backdrop-blur-sm">
                                            <span className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-3">
                                                {isCopied ? <><CheckIcon className="w-5 h-5 text-emerald-500" /> Identity Copied</> : <><CopyIcon className="w-5 h-5" /> Confirm & Copy</>}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-8 text-left border-t border-white/[0.05] pt-10">
                                        <div>
                                            <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Target Scope</p>
                                            <p className="text-sm font-black text-white uppercase tracking-tight">{selectedChild?.applicant_name || 'Individual Node'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Authorization Mode</p>
                                            <p className="text-sm font-black text-primary uppercase tracking-tight">{codeType} Layer</p>
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-white/10 font-black uppercase tracking-[0.5em] pt-4 selection:bg-transparent">Expires in 24 hours • One-time use protocol</p>
                                </motion.div>
                            ) : isReadyForAuth ? (
                                <motion.div
                                    key="ready-state"
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="relative z-10 space-y-8"
                                >
                                    <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-10 border-2 border-primary/20 animate-pulse">
                                        <ShieldLockIcon className="w-10 h-10 text-primary" />
                                    </div>
                                    <h3 className="text-3xl font-serif font-black text-white tracking-widest uppercase leading-none">Protocol <span className="text-white/20 italic">Ready.</span></h3>
                                    <p className="text-base text-white/40 font-serif italic max-w-sm mx-auto leading-relaxed">Seal the orchestration to generate the identity provision key for the selected scope.</p>
                                    <div className="pt-10 flex items-center justify-center gap-4 text-[10px] font-black text-primary uppercase tracking-[0.4em] animate-bounce">
                                        Authorize Below <ShieldLockIcon className="w-4 h-4" />
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="idle-state"
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    className="relative z-10 space-y-8"
                                >
                                    <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-10 border-2 border-white/5 opacity-50">
                                        <ShieldLockIcon className="w-10 h-10 text-white/20" />
                                    </div>
                                    <h3 className="text-3xl font-serif font-black text-white/60 tracking-widest uppercase leading-none">Protocol <span className="text-white/10 italic">Idle.</span></h3>
                                    <p className="text-base text-white/20 font-serif italic max-w-sm mx-auto leading-relaxed">Select a provision key and protocol layer to initialize institutional authorization.</p>
                                    <div className="pt-10 flex items-center justify-center gap-3 text-[10px] font-black text-white/5 uppercase tracking-[0.4em] border-t border-white/[0.03]">
                                        Secure channel waiting for initialization
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* 4. Registry Ledger (Bottom Section) */}
            <div className="space-y-8 pt-12 border-t border-white/[0.05]">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-white/5 rounded-xl text-white/20 border border-white/10"><TerminalIcon className="w-5 h-5" /></div>
                        <div>
                            <h2 className="text-lg font-black text-white uppercase tracking-widest">Registry Ledger</h2>
                            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mt-0.5">Historical Authorization Log</p>
                        </div>
                    </div>
                    {codes.length > 0 && <span className="text-[10px] font-black text-white/40 bg-white/5 px-4 py-1.5 rounded-full border border-white/10 tracking-widest">{codes.length} NODES</span>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-44 bg-white/[0.02] border border-white/5 rounded-[2rem] animate-pulse"></div>
                        ))
                    ) : codes.length === 0 ? (
                        <div className="col-span-full py-20 bg-white/[0.02] border border-dashed border-white/5 rounded-[2.5rem] text-center">
                            <p className="text-xs font-black text-white/10 uppercase tracking-[0.6em]">Ledger Empty • No Protocols Recorded</p>
                        </div>
                    ) : (
                        codes.map(code => (
                            <div
                                key={code.id}
                                className="bg-[#0c0d12]/40 backdrop-blur-md p-8 rounded-[2rem] border border-white/5 group/card transition-all hover:bg-[#0c0d12]/60 hover:border-white/10 shadow-xl space-y-6 relative overflow-hidden"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <p className="text-sm font-black text-white uppercase tracking-tight truncate max-w-[180px] leading-none group-hover/card:text-primary transition-colors">{code.applicant_name || 'Node Unknown'}</p>
                                        <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">{code.code_type} Provision</p>
                                    </div>
                                    <div className={`px-4 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest transition-all ${code.status === 'Active' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 group-hover/card:bg-emerald-500/20' :
                                            code.status === 'Redeemed' ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-400' :
                                                'bg-red-500/10 border-red-500/40 text-red-400'
                                        }`}>
                                        {code.status}
                                    </div>
                                </div>

                                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between group/code-line hover:border-white/10 transition-all">
                                    <span className="font-mono text-base font-black text-white/30 tracking-[0.3em] uppercase group-hover/card:text-white/60 transition-colors">{maskCode(code.code)}</span>
                                    <button onClick={() => handleCopyCode(code.code)} className="p-2 text-white/10 hover:text-primary transition-all rounded-lg hover:bg-white/5"><CopyIcon className="w-4 h-4" /></button>
                                </div>

                                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest pt-2">
                                    <span className="text-white/20">Exp: {new Date(code.expires_at).toLocaleDateString()}</span>
                                    {code.status === 'Active' && (
                                        <button
                                            onClick={() => handleRevokeCode(code.id)}
                                            className="text-red-500/40 hover:text-red-500 transition-colors"
                                        >
                                            Terminate
                                        </button>
                                    )}
                                    {code.status === 'Redeemed' && <span className="text-indigo-500/40">Verified</span>}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

