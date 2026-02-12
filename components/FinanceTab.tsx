
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, formatError } from '../services/supabase';
import {
    FinanceData, FeeStructure, GradeCollectionStats,
    StudentFeeSummary, UserProfile, SchoolBranch, CurrencyCode
} from '../types';
import Spinner from './common/Spinner';
import { PlusIcon } from './icons/PlusIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { TrendingUpCustomIcon } from './icons/TrendingUpIcon';
import { CreditCardIcon } from './icons/CreditCardIcon';
import { UsersIcon } from './icons/UsersIcon';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { BookIcon } from './icons/BookIcon';
import { SearchIcon } from './icons/SearchIcon';
import { EditIcon } from './icons/EditIcon';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon';
import { BriefcaseIcon } from './icons/BriefcaseIcon';
import { ArrowRightIcon } from './icons/ArrowRightIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { ActivityIcon } from './icons/ActivityIcon';
import { RefreshCwIcon } from './icons/RefreshCwIcon';
import { ShieldCheckIcon } from './icons/ShieldCheckIcon';
import { ClockIcon } from './icons/ClockIcon';
import { WorkflowIcon } from './icons/WorkflowIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { RefreshIcon } from './icons/RefreshIcon';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'framer-motion';

import FeeMasterWizard from './finance/FeeMasterWizard';
import StudentFinanceDetailView from './finance/StudentFinanceDetailView';
import RevenueTrendChart from './finance/charts/RevenueTrendChart';
import CollectionDistributionChart from './finance/charts/CollectionDistributionChart';
import { StatsSkeleton, Skeleton } from './common/Skeleton';
import PremiumAvatar from './common/PremiumAvatar';
import FinanceAuditLog from './finance/FinanceAuditLog';

const formatCurrency = (amount: number, currency: CurrencyCode = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
};

const TabButton: React.FC<{
    id: string;
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: (id: any) => void;
}> = ({ id, label, icon, isActive, onClick }) => (
    <button
        onClick={() => onClick(id)}
        className={`
            flex items-center gap-2.5 px-6 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-300 relative overflow-hidden group
            ${isActive
                ? 'bg-primary text-white shadow-lg shadow-primary/25 ring-1 ring-white/10 z-10'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }
        `}
    >
        <span className="relative z-10 flex items-center gap-2">
            {icon} {label}
        </span>
    </button>
);

const FinanceStatCard: React.FC<{
    title: string;
    value: string;
    trend?: string;
    trendUp?: boolean;
    icon: React.ReactNode;
    color: string;
}> = ({ title, value, icon, trend, trendUp, color }) => (
    <div className="relative overflow-hidden bg-[#0c0d12] border border-white/5 rounded-[2.8rem] p-8 md:p-10 shadow-2xl group hover:border-primary/20 transition-all duration-500 h-full flex flex-col justify-between">
        <div className={`absolute top-0 right-0 w-32 h-32 ${color} opacity-[0.03] rounded-bl-full group-hover:scale-110 transition-transform duration-1000`}></div>
        <div className="relative z-10">
            <div className="flex justify-between items-start mb-12">
                <div className={`p-4 rounded-2xl bg-white/5 text-white/30 border border-white/10 group-hover:text-primary transition-colors`}>
                    {icon}
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border ${trendUp ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'bg-red-500/10 text-red-500 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]'}`}>
                        {trendUp ? '↑' : '↓'} {trend}
                    </div>
                )}
            </div>
            <div>
                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mb-4">{title}</p>
                <h3 className="text-4xl md:text-5xl font-serif font-black text-white tracking-tighter leading-none whitespace-nowrap">{value}</h3>
            </div>
        </div>
    </div>
);

const FinanceTab: React.FC<{ profile: UserProfile, branchId?: number | null, branches: SchoolBranch[] }> = ({ profile, branchId, branches }) => {
    const [activeView, setActiveView] = useState<'overview' | 'accounts' | 'master' | 'audit'>('overview');
    const [financeData, setFinanceData] = useState<FinanceData | null>(null);
    const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
    const [studentLedgers, setStudentLedgers] = useState<StudentFeeSummary[]>([]);
    const [gradeStats, setGradeStats] = useState<GradeCollectionStats[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<StudentFeeSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [editingStructure, setEditingStructure] = useState<FeeStructure | null>(null);
    const [accountSearch, setAccountSearch] = useState('');
    const [riskOnly, setRiskOnly] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isReconciling, setIsReconciling] = useState(false);

    const viewCurrency = useMemo(() => profile.base_currency || 'INR', [profile]);

    const fetchAllData = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        setError(null);
        try {
            const bid = (branchId === undefined || branchId === null) ? null : Number(branchId);

            let structQuery = supabase.from('fee_structures')
                .select('*, components:fee_components(*)')
                .order('created_at', { ascending: false });

            if (bid !== null) {
                structQuery = structQuery.eq('branch_id', bid);
            }

            const [finRes, structRes, ledgerRes, gradeRes] = await Promise.all([
                supabase.rpc('get_finance_overview_stats_v2', { p_branch_id: bid }),
                structQuery,
                supabase.rpc('get_student_fee_summary_all', { p_branch_id: bid }),
                supabase.rpc('get_grade_wise_collection_stats', { p_branch_id: bid })
            ]);

            if (finRes.error) throw finRes.error;
            if (structRes.error) throw structRes.error;
            if (ledgerRes.error) throw ledgerRes.error;
            // gradeRes might be empty, check error only

            setFinanceData(finRes.data || { total_assigned: 0, total_collected: 0, total_pending: 0, total_overdue: 0, monthly_collection: 0, today_collection: 0, currency: 'INR' });
            setFeeStructures(structRes.data || []);
            setStudentLedgers(Array.isArray(ledgerRes.data) ? ledgerRes.data : []);
            setGradeStats(Array.isArray(gradeRes.data) ? gradeRes.data : []);

        } catch (err: any) {
            console.error("Finance Registry Sync Failure:", err);
            setError(formatError(err));
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, [branchId]);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);

    const handleForceReconcile = async () => {
        setIsReconciling(true);
        try {
            const bid = (branchId === undefined || branchId === null) ? null : Number(branchId);
            const { error } = await supabase.rpc('reconcile_finance_registry', {
                p_branch_id: bid
            });
            if (error) throw error;
            await fetchAllData(true);
        } catch (err: any) {
            alert("Protocol Failure: " + formatError(err));
        } finally {
            setTimeout(() => setIsReconciling(false), 800);
        }
    };

    const runFinancialOracle = async () => {
        if (!financeData) return;
        setIsAnalyzing(true);
        try {
            // FIX: Correct SDK initialization for @google/genai
            const genAI = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY || '' });

            const prompt = `Act as an institutional CFO. Analyze these stats: Total Assigned: ${financeData.total_assigned}, Collected: ${financeData.total_collected}, Pending: ${financeData.total_pending}, Overdue: ${financeData.total_overdue}, Monthly Collection: ${financeData.monthly_collection}. Provide a 25-word strategic insight on liquidity and collection efficiency.`;

            const result = await genAI.models.generateContent({
                model: "gemini-1.5-flash",
                contents: [{ role: 'user', parts: [{ text: prompt }] }]
            });
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

            setAiInsight(text || "Synchronizing insights...");
        } catch (e) {
            console.error("AI Oracle Error:", e);
            setAiInsight("AI context currently unavailable.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleExportRegistry = () => {
        if (studentLedgers.length === 0) return;
        const headers = "Name,Class,Billed,Paid,Outstanding,Integrity\n";
        const csv = studentLedgers.map(s =>
            `"${s.display_name}","${s.class_name || 'UNASSIGNED'}",${s.total_billed},${s.total_paid},${s.outstanding_balance},${s.integrity_score || 0}`
        ).join("\n");
        const blob = new Blob([headers + csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Finance_Registry_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const filteredAccounts = useMemo(() => {
        return studentLedgers.filter(s => {
            const matchesSearch = !accountSearch ||
                s.display_name.toLowerCase().includes(accountSearch.toLowerCase()) ||
                (s.class_name && s.class_name.toLowerCase().includes(accountSearch.toLowerCase()));

            const matchesRisk = !riskOnly || (s.integrity_score !== undefined && s.integrity_score < 70);

            return matchesSearch && matchesRisk;
        });
    }, [studentLedgers, accountSearch, riskOnly]);

    if (selectedStudent) {
        return (
            <StudentFinanceDetailView
                student={selectedStudent}
                viewCurrency={viewCurrency}
                onBack={() => setSelectedStudent(null)}
                onUpdate={() => fetchAllData(true)}
                onNavigateToMaster={() => { setSelectedStudent(null); setActiveView('master'); }}
            />
        );
    }

    return (
        <div className="space-y-16 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-24 max-w-[1800px] mx-auto px-4 md:px-8">
            {/* Executive Header Layer */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-12 pt-6">
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="h-[1px] w-12 bg-primary/40 rounded-full" />
                        <span className="text-[10px] font-black uppercase text-primary/80 tracking-[0.5em]">Institutional Governance Node</span>
                    </div>
                    <div className="flex flex-wrap items-end gap-6">
                        <h2 className="text-[clamp(48px,6vw,84px)] font-serif font-black text-white tracking-tighter uppercase leading-[0.85]">
                            FINANCE <span className="text-white/20 italic font-medium lowercase">center.</span>
                        </h2>
                        <div className="flex gap-4 mb-2">
                            <button
                                onClick={handleForceReconcile}
                                disabled={isReconciling}
                                className="px-5 py-2.5 bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-emerald-400 transition-all flex items-center gap-3 active:scale-95 shadow-2xl backdrop-blur-md"
                            >
                                <RefreshCwIcon className={`w-4 h-4 ${isReconciling ? 'animate-spin text-emerald-500' : 'opacity-40'}`} />
                                <span>Reconcile Matrix</span>
                            </button>
                            <button
                                className="px-5 py-2.5 bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] hover:border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-primary transition-all flex items-center gap-3 active:scale-95 shadow-2xl backdrop-blur-md"
                            >
                                <WorkflowIcon className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                                <span>Process Guide</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex bg-[#12141c]/60 p-1.5 rounded-full border border-white/5 backdrop-blur-xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] ring-1 ring-white/5">
                    <TabButton id="overview" label="Overview" icon={<ChartBarIcon className="w-4 h-4" />} isActive={activeView === 'overview'} onClick={setActiveView} />
                    <TabButton id="accounts" label="Accounts" icon={<UsersIcon className="w-4 h-4" />} isActive={activeView === 'accounts'} onClick={setActiveView} />
                    <TabButton id="master" label="Master" icon={<BookIcon className="w-4 h-4" />} isActive={activeView === 'master'} onClick={setActiveView} />
                    <TabButton id="audit" label="Audit" icon={<ShieldCheckIcon className="w-4 h-4" />} isActive={activeView === 'audit'} onClick={setActiveView} />
                </div>
            </div>

            <div className="w-full h-px bg-white/5 rounded-full" />

            {loading ? (
                <div className="space-y-12">
                    <StatsSkeleton />
                    <Skeleton.List rows={8} />
                </div>
            ) : error ? (
                <div className="p-32 text-center flex flex-col items-center gap-10 bg-[#0c0d12] rounded-[4rem] border border-white/5 shadow-3xl ring-1 ring-white/10">
                    <div className="p-6 bg-red-500/10 rounded-3xl border border-red-500/20 text-red-500">
                        <AlertTriangleIcon className="w-12 h-12" />
                    </div>
                    <h3 className="text-4xl font-serif font-black text-white uppercase tracking-tight leading-none">Registry Protocol Fault</h3>
                    <p className="text-white/40 max-w-lg leading-relaxed font-serif italic text-lg">{error}</p>
                    <button onClick={() => fetchAllData()} className="px-12 py-5 bg-white text-black font-black text-[11px] uppercase tracking-[0.4em] rounded-2xl hover:bg-white/90 transition-all shadow-xl active:scale-95 border border-white/20">Initialize Sync Reconstruction</button>
                </div>
            ) : (
                <AnimatePresence mode="wait">
                    {activeView === 'overview' && financeData && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-16">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                <FinanceStatCard
                                    title="Total Assigned (Billed)"
                                    value={formatCurrency(financeData.total_assigned, viewCurrency)}
                                    trend="+12.5%"
                                    trendUp={true}
                                    icon={<TrendingUpCustomIcon className="w-8 h-8" />}
                                    color="bg-primary"
                                />
                                <FinanceStatCard
                                    title="Total Collected"
                                    value={formatCurrency(financeData.total_collected, viewCurrency)}
                                    trend="Strong"
                                    trendUp={true}
                                    icon={<CheckCircleIcon className="w-8 h-8" />}
                                    color="bg-emerald-500"
                                />
                                <FinanceStatCard
                                    title="Active Pending"
                                    value={formatCurrency(financeData.total_pending, viewCurrency)}
                                    icon={<ClockIcon className="w-8 h-8" />}
                                    color="bg-amber-500"
                                />
                                <FinanceStatCard
                                    title="Critical Overdue"
                                    value={formatCurrency(financeData.total_overdue, viewCurrency)}
                                    trend="Risk"
                                    trendUp={false}
                                    icon={<AlertTriangleIcon className="w-8 h-8" />}
                                    color="bg-red-500"
                                />
                            </div>

                            <motion.div
                                initial="hidden"
                                animate="visible"
                                variants={{
                                    hidden: { opacity: 0 },
                                    visible: {
                                        opacity: 1,
                                        transition: { staggerChildren: 0.1, delayChildren: 0.2 }
                                    }
                                }}
                                className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch"
                            >
                                <motion.div
                                    variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                                    className="lg:col-span-8 space-y-10"
                                >
                                    <div className="bg-[#0c0d12] border border-white/5 rounded-[4rem] p-8 md:p-16 shadow-[0_64px_128px_-24px_rgba(0,0,0,1)] relative overflow-hidden h-[540px] ring-1 ring-white/10 group">
                                        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                                        <RevenueTrendChart total={financeData.total_collected} />
                                    </div>
                                    <div className="bg-primary/[0.03] border border-primary/20 rounded-[3.5rem] p-8 md:p-14 relative overflow-hidden group shadow-2xl backdrop-blur-3xl ring-1 ring-primary/10">
                                        <div className="absolute top-0 right-0 p-16 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000 rotate-12"><SparklesIcon className="w-64 h-64 text-primary" /></div>
                                        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-[120px] opacity-20 pointer-events-none" />

                                        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
                                            <div className="space-y-6 max-w-3xl">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20 animate-pulse">
                                                        <SparklesIcon className="w-8 h-8 text-primary" />
                                                    </div>
                                                    <h4 className="text-2xl font-serif font-black text-white uppercase tracking-tight">Financial Oracle</h4>
                                                </div>
                                                <AnimatePresence mode="wait">
                                                    {aiInsight ? (
                                                        <motion.p
                                                            key="insight"
                                                            initial={{ opacity: 0, x: -10 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            className="text-2xl md:text-3xl text-white/90 leading-tight font-serif italic tracking-tight"
                                                        >
                                                            "{aiInsight}"
                                                        </motion.p>
                                                    ) : (
                                                        <motion.p
                                                            key="prompt"
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            className="text-xl text-white/30 font-medium font-serif italic leading-relaxed"
                                                        >
                                                            Consult the institutional core to synthesize liquidity trends and collection risk matrices across the current branch cluster.
                                                        </motion.p>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                            <button
                                                onClick={runFinancialOracle}
                                                disabled={isAnalyzing}
                                                className="px-12 py-6 bg-primary text-white font-black text-[10px] uppercase tracking-[0.4em] rounded-2xl shadow-2xl hover:bg-primary/90 transition-all flex items-center justify-center gap-4 active:scale-95 shadow-primary/20 ring-1 ring-white/20 whitespace-nowrap group-hover:scale-[1.05]"
                                            >
                                                {isAnalyzing ? <Spinner size="sm" className="text-white" /> : 'Sync Intelligence'}
                                                {!isAnalyzing && <ArrowRightIcon className="w-4 h-4 text-white/40 group-hover:translate-x-1 transition-transform" />}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>

                                <motion.div
                                    variants={{ hidden: { opacity: 0, x: 20 }, visible: { opacity: 1, x: 0 } }}
                                    className="lg:col-span-4 bg-[#0c0d12] border border-white/5 rounded-[4rem] p-8 md:p-16 shadow-[0_64px_128px_-24px_rgba(0,0,0,1)] flex flex-col relative overflow-hidden h-full min-h-[740px] ring-1 ring-white/10 group"
                                >
                                    <div className="absolute top-0 right-0 p-16 opacity-[0.01] group-hover:opacity-[0.03] transition-opacity duration-1000"><ChartBarIcon className="w-80 h-80 text-primary -rotate-12" /></div>
                                    <div className="relative z-10 h-full flex flex-col">
                                        <div className="flex items-center gap-4 mb-16">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(var(--primary-rgb),0.8)]" />
                                            <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">Collection Integrity Distribution</h4>
                                        </div>
                                        <div className="flex-grow flex items-center justify-center">
                                            <CollectionDistributionChart
                                                paid={financeData.total_collected}
                                                pending={financeData.total_pending}
                                                overdue={financeData.total_overdue}
                                            />
                                        </div>
                                        <div className="mt-16 pt-10 border-t border-white/5 space-y-6">
                                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white/40 transition-colors">
                                                <span>Finalized Capital</span>
                                                <span className="text-emerald-500">{Math.round((financeData.total_collected / (financeData.total_assigned || 1)) * 100)}%</span>
                                            </div>
                                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${(financeData.total_collected / (financeData.total_assigned || 1)) * 100}%` }}
                                                    className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </motion.div>
                        </motion.div>
                    )}

                    {activeView === 'accounts' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-12">
                            <div className="flex flex-col md:flex-row gap-8 justify-between items-center bg-[#0d0f14]/90 p-5 rounded-[3rem] border border-white/5 backdrop-blur-xl ring-1 ring-white/5 shadow-[0_48px_96px_-24px_rgba(0,0,0,1)]">
                                <div className="relative w-full md:max-w-3xl group">
                                    <SearchIcon className="absolute left-8 top-1/2 -translate-y-1/2 h-6 w-6 text-white/10 group-focus-within:text-primary transition-all duration-500" />
                                    <input
                                        type="text"
                                        placeholder="SEARCH IDENTITY NODE OR CLASS BLOCK..."
                                        value={accountSearch}
                                        onChange={e => setAccountSearch(e.target.value.toUpperCase())}
                                        className="w-full pl-20 pr-10 py-7 bg-black/40 border border-white/5 rounded-[2rem] text-[16px] font-black text-white focus:bg-black/60 focus:ring-[15px] focus:ring-primary/5 focus:border-primary/40 outline-none uppercase tracking-[0.2em] shadow-inner placeholder:text-white/5 transition-all"
                                    />
                                </div>
                                <div className="flex gap-4 pr-4">
                                    <div className="hidden xl:flex items-center gap-4 bg-black/40 px-6 rounded-2xl border border-white/5">
                                        <span className="text-[10px] uppercase font-black text-white/40 tracking-widest">Collection Accuracy</span>
                                        <div className="h-4 w-[1px] bg-white/10"></div>
                                        <span className="text-emerald-400 font-bold font-mono text-sm">
                                            {financeData?.total_assigned ? Math.round((financeData.total_collected / financeData.total_assigned) * 100) : 0}%
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setRiskOnly(!riskOnly)}
                                        className={`px-10 py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all border shadow-2xl active:scale-95 ${riskOnly ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-white/[0.03] text-white/40 border-white/5'
                                            }`}
                                    >
                                        Risk View
                                    </button>
                                    <button onClick={handleExportRegistry} className="px-12 py-6 bg-white/[0.03] hover:bg-white/[0.08] text-white/40 hover:text-white border border-white/5 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-2xl active:scale-95 group">
                                        <span className="flex items-center gap-3">
                                            <DownloadIcon className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" /> Export
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Grade Summary Section - New */}
                            <motion.div
                                initial="hidden"
                                animate="visible"
                                variants={{
                                    hidden: { opacity: 0 },
                                    visible: {
                                        opacity: 1,
                                        transition: { staggerChildren: 0.05 }
                                    }
                                }}
                                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6"
                            >
                                {gradeStats.length > 0 && gradeStats.slice(0, 4).map((g, i) => (
                                    <motion.div
                                        key={i}
                                        variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                                        className="bg-[#0c0d12] border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:border-white/10 transition-colors shadow-xl"
                                    >
                                        <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity"><ActivityIcon className="w-24 h-24 text-white hover:scale-110 transition-transform duration-700" /></div>
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-start mb-4">
                                                <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Grade {g.grade}</span>
                                                <span className="text-[10px] font-bold text-white/20 bg-white/5 px-2 py-1 rounded border border-white/5">{g.total_students} Students</span>
                                            </div>
                                            <div className="space-y-1">
                                                <h4 className="text-2xl font-black text-white font-mono tracking-tighter">{formatCurrency(g.total_collected, viewCurrency)}</h4>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] uppercase font-bold text-white/20">Finalized Payloads</span>
                                                    <span className="text-[9px] uppercase font-bold text-red-500/60 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]">{formatCurrency(g.total_pending, viewCurrency)} Pending</span>
                                                </div>
                                            </div>
                                            <div className="mt-5 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${(g.total_collected / (g.total_billed || 1)) * 100}%` }}
                                                    className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-[#0a0a0c] border border-white/5 rounded-[4rem] shadow-[0_64px_128px_-24px_rgba(0,0,0,1)] overflow-hidden min-h-[600px] ring-1 ring-white/10 relative group"
                            >
                                <div className="absolute inset-0 bg-gradient-to-tr from-primary/[0.015] via-transparent to-transparent pointer-events-none group-hover:opacity-100 transition-opacity duration-1000"></div>
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
                                        <thead className="bg-[#0f1115]/95 border-b border-white/[0.06] text-[10px] font-black text-white/20 uppercase tracking-[0.5em] sticky top-0 z-30 backdrop-blur-3xl shadow-sm">
                                            <tr>
                                                <th className="p-12 pl-16 font-black">Identity Node</th>
                                                <th className="p-12 text-center">Integrity Score</th>
                                                <th className="p-12 text-right">Lifetime Billed</th>
                                                <th className="p-12 text-right">Synchronized (Paid)</th>
                                                <th className="p-12 text-right pr-16">Pending Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/[0.04] relative z-10 transition-all">
                                            {filteredAccounts.length > 0 ? filteredAccounts.map((account, idx) => {
                                                const integrity = account.integrity_score || 0;
                                                const isWarning = integrity < 70;
                                                const isCritical = integrity < 40;

                                                return (
                                                    <motion.tr
                                                        key={account.student_id}
                                                        initial={{ opacity: 0, y: 15 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: idx * 0.03, duration: 0.5 }}
                                                        className="group hover:bg-white/[0.03] transition-all duration-500 cursor-pointer relative"
                                                        onClick={() => setSelectedStudent(account)}
                                                    >
                                                        <td className="p-12 pl-16">
                                                            <div className="flex items-center gap-10">
                                                                <div className="relative">
                                                                    <div className={`absolute inset-0 blur-2xl opacity-0 group-hover:opacity-60 transition-opacity duration-700 ${isCritical ? 'bg-red-500' : 'bg-primary'}`}></div>
                                                                    <PremiumAvatar src={account.profile_photo_url} name={account.display_name} size="sm" className="w-[88px] h-[88px] rounded-[2.5rem] border-2 border-white/5 relative z-10 group-hover:border-primary/40 transition-all duration-700 shadow-2xl" />
                                                                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-[#0a0a0c] z-20 ${integrity >= 90 ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : isCritical ? 'bg-red-500 shadow-[0_0_15px_#ef4444]' : 'bg-amber-500 animate-pulse'}`} />
                                                                </div>
                                                                <div>
                                                                    <p className="font-serif font-black text-white text-[26px] group-hover:text-primary transition-colors uppercase tracking-tight leading-none mb-4">{account.display_name}</p>
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="text-[10px] text-white/20 font-black uppercase tracking-[0.4em] bg-white/[0.03] px-3 py-1.5 rounded-xl border border-white/5 group-hover:border-primary/20 transition-colors uppercase">{account.class_name || 'UNASSIGNED_NODE'}</span>
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-white/10"></div>
                                                                        <span className="text-[10px] font-mono text-white/15 uppercase tracking-widest font-bold">SID_{account.student_id.substring(0, 8).toUpperCase()}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-12">
                                                            <div className="w-72 mx-auto">
                                                                <div className="flex justify-between items-center mb-5 px-1">
                                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${integrity >= 90 ? 'text-emerald-500' :
                                                                        isCritical ? 'text-red-500' :
                                                                            isWarning ? 'text-amber-500' : 'text-white/40'
                                                                        }`}>
                                                                        {integrity >= 90 ? 'STABLE_PROTOCOL' : isCritical ? 'CRITICAL_RISK' : 'AT_RISK'}
                                                                    </span>
                                                                    <span className="text-[13px] font-mono font-black text-white/30 group-hover:text-white transition-colors">{Math.round(integrity)}%</span>
                                                                </div>
                                                                <div className="h-2.5 w-full bg-white/[0.04] rounded-full overflow-hidden border border-white/5 p-0.5 shadow-inner group-hover:border-white/15 transition-colors">
                                                                    <motion.div
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: `${integrity}%` }}
                                                                        transition={{ duration: 1.5, ease: 'easeOut' }}
                                                                        className={`h-full rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)] ${integrity >= 90 ? 'bg-emerald-500 shadow-emerald-500/20' :
                                                                            isCritical ? 'bg-red-500 shadow-red-500/20' :
                                                                                isWarning ? 'bg-amber-500 shadow-amber-500/20' : 'bg-primary shadow-primary/20'
                                                                            }`}
                                                                    ></motion.div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-12 text-right">
                                                            <p className="font-mono font-black text-2xl text-white/20 tracking-tighter group-hover:text-white/40 transition-colors">{formatCurrency(account.total_billed, viewCurrency)}</p>
                                                            <p className="text-[10px] font-black text-white/10 uppercase tracking-widest mt-2 group-hover:text-white/20">Archived Payload</p>
                                                        </td>
                                                        <td className="p-12 text-right">
                                                            <p className="font-mono font-black text-4xl text-emerald-500 drop-shadow-[0_0_30px_rgba(16,185,129,0.35)] tracking-tighter group-hover:scale-105 transition-transform duration-700">{formatCurrency(account.total_paid, viewCurrency)}</p>
                                                            <div className="flex items-center justify-end gap-2 mt-3">
                                                                <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500/50" />
                                                                <p className="text-[10px] font-black text-white/10 uppercase tracking-widest">Finalized Fund</p>
                                                            </div>
                                                        </td>
                                                        <td className="p-12 text-right pr-16 font-mono">
                                                            <div className="flex items-center justify-end gap-10">
                                                                <div>
                                                                    <p className={`font-black text-3xl tracking-tighter mb-1 transition-all duration-500 ${account.outstanding_balance > 0 ? 'text-red-500/90 drop-shadow-[0_0_25px_rgba(239,68,68,0.25)] group-hover:scale-110' : 'text-white/10'}`}>
                                                                        {formatCurrency(account.outstanding_balance, viewCurrency)}
                                                                    </p>
                                                                    <p className="text-[9px] font-black text-white/5 group-hover:text-white/10 uppercase tracking-[0.3em] font-sans">Outstanding Delta</p>
                                                                </div>
                                                                <button className="p-8 rounded-[2.8rem] bg-white/[0.04] text-white/15 group-hover:text-primary group-hover:bg-primary/15 border border-white/5 group-hover:border-primary/30 transition-all shadow-4xl active:scale-90 group-hover:shadow-[0_0_40px_rgba(var(--primary),0.25)]">
                                                                    <ArrowRightIcon className="w-10 h-10 group-hover:translate-x-2 transition-transform duration-500" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </motion.tr>
                                                );
                                            }) : (
                                                <tr>
                                                    <td colSpan={5} className="p-60 text-center relative overflow-hidden">
                                                        <div className="flex flex-col items-center gap-12 animate-in fade-in duration-1000 scale-125">
                                                            <div className="relative">
                                                                <div className="absolute inset-0 bg-primary/10 blur-[90px] rounded-full animate-pulse"></div>
                                                                <div className="relative w-40 h-40 rounded-[4rem] bg-white/[0.01] border-2 border-dashed border-white/10 flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform duration-1000">
                                                                    <ActivityIcon className="w-16 h-16 text-white/5" />
                                                                </div>
                                                            </div>
                                                            <div className="space-y-6">
                                                                <h4 className="font-serif italic text-4xl uppercase tracking-[0.5em] text-white/10">Vault Silent.</h4>
                                                                <p className="text-[14px] font-black uppercase tracking-[1em] text-white/5">Null identities in branch context</p>
                                                                <button onClick={handleForceReconcile} className="mt-10 px-14 py-5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-[0.5em] transition-all shadow-2xl">Pulse Registry Protocol</button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}



                    {activeView === 'master' && (
                        <motion.div
                            key="master"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="space-y-10"
                        >
                            <div className="bg-[#0f1016] p-10 rounded-[2.5rem] border border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-24 opacity-[0.02] pointer-events-none group-hover:scale-110 transition-transform duration-1000"><SparklesIcon className="w-64 h-64 text-primary" /></div>
                                <div className="space-y-3 relative z-10">
                                    <h3 className="text-3xl font-bold text-white tracking-tight">Fee Structures</h3>
                                    <p className="text-sm text-white/40 font-medium max-w-xl leading-relaxed">Manage and configure institutional fee structures, billing cycles, and currency nodes.</p>
                                </div>
                                <button
                                    onClick={() => setIsWizardOpen(true)}
                                    className="px-8 py-4 bg-primary text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-3 active:scale-95 border border-white/10 relative z-10"
                                >
                                    <PlusIcon className="w-5 h-5" /> New Structure
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8">
                                {feeStructures.map((fs) => (
                                    <div key={fs.id} className="bg-[#0f1016] border border-white/5 rounded-3xl p-8 shadow-xl hover:border-white/10 transition-all duration-300 flex flex-col h-full group relative overflow-hidden">
                                        <div className="flex justify-between items-start mb-8 relative z-10">
                                            <div>
                                                <h4 className="text-xl font-bold text-white group-hover:text-primary transition-colors tracking-tight mb-2">{fs.name}</h4>
                                                <div className="flex items-center gap-3">
                                                    <span className="px-2 py-1 rounded bg-white/5 text-[10px] font-bold text-white/40 uppercase tracking-wider">{fs.academic_year}</span>
                                                    <span className="px-2 py-1 rounded bg-white/5 text-[10px] font-bold text-white/40 uppercase tracking-wider">Grade {fs.target_grade}</span>
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${fs.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-white/5 text-white/30 border-white/5'}`}>{fs.status}</span>
                                        </div>

                                        <div className="space-y-4 mb-8 flex-grow relative z-10">
                                            {(fs.components || []).slice(0, 4).map((comp: any) => (
                                                <div key={comp.id} className="flex justify-between items-center border-b border-white/[0.04] pb-3 last:border-0 last:pb-0">
                                                    <span className="text-white/60 font-medium text-xs">{comp.name}</span>
                                                    <div className="text-right">
                                                        <span className="block font-mono font-bold text-white text-sm">{formatCurrency(comp.amount, fs.currency as CurrencyCode)}</span>
                                                        <span className="text-[9px] text-white/20 uppercase tracking-wider">{comp.frequency}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {(fs.components?.length || 0) > 4 && (
                                                <p className="text-[10px] text-white/20 italic text-center pt-2">+{((fs.components?.length || 0) - 4)} more components</p>
                                            )}
                                        </div>

                                        <div className="pt-6 border-t border-white/[0.08] flex justify-between items-center mt-auto relative z-10">
                                            <div>
                                                <p className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1">Total Value</p>
                                                <span className="text-2xl font-bold text-white font-mono tracking-tight">{formatCurrency(fs.components?.reduce((a, c) => a + Number(c.amount), 0) || 0, fs.currency as CurrencyCode)}</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setEditingStructure(fs);
                                                    setIsWizardOpen(true);
                                                }}
                                                className="p-3 bg-white/5 text-white/40 rounded-xl hover:text-white hover:bg-white/10 transition-all border border-white/5"
                                            >
                                                <EditIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {activeView === 'audit' && (
                        <motion.div
                            key="audit"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="animate-in fade-in duration-700"
                        >
                            <FinanceAuditLog branchId={branchId || null} />
                        </motion.div>
                    )}
                </AnimatePresence>
            )}

            {isWizardOpen && (
                <FeeMasterWizard
                    onClose={() => {
                        setIsWizardOpen(false);
                        setEditingStructure(null);
                    }}
                    branchId={branchId || null}
                    editingStructure={editingStructure}
                    onSuccess={() => {
                        setIsWizardOpen(false);
                        setEditingStructure(null);
                        fetchAllData();
                    }}
                />
            )}
        </div>
    );
};

export default FinanceTab;
