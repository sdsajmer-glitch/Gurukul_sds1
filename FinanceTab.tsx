import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, formatError } from './services/supabase';
import {
    FinanceData, FeeStructure,
    StudentFeeSummary, UserProfile, SchoolBranch, CurrencyCode
} from './types';
import Spinner from './components/common/Spinner';
import { PlusIcon } from './components/icons/PlusIcon';
import { CheckCircleIcon } from './components/icons/CheckCircleIcon';
import { TrendingUpCustomIcon } from './components/icons/TrendingUpIcon';
import { CreditCardIcon } from './components/icons/CreditCardIcon';
import { UsersIcon } from './components/icons/UsersIcon';
import { ChartBarIcon } from './components/icons/ChartBarIcon';
import { BookIcon } from './components/icons/BookIcon';
import { SearchIcon } from './components/icons/SearchIcon';
import { EditIcon } from './components/icons/EditIcon';
import { AlertTriangleIcon } from './components/icons/AlertTriangleIcon';
import { BriefcaseIcon } from './components/icons/BriefcaseIcon';
import { ArrowRightIcon } from './components/icons/ArrowRightIcon';
import { SparklesIcon } from './components/icons/SparklesIcon';
import { DownloadIcon } from './components/icons/DownloadIcon';
import { ActivityIcon } from './components/icons/ActivityIcon';
import { RefreshCwIcon } from './components/icons/RefreshCwIcon';
import { ShieldCheckIcon } from './components/icons/ShieldCheckIcon';
import { ClockIcon } from './components/icons/ClockIcon';
import { WorkflowIcon } from './components/icons/WorkflowIcon';
import { ChevronDownIcon } from './components/icons/ChevronDownIcon';
import { RefreshIcon } from './components/icons/RefreshIcon';
import { MoreVerticalIcon } from './components/icons/MoreVerticalIcon';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'framer-motion';

import FeeMasterWizard from './components/finance/FeeMasterWizard';
import ExpenseDashboard from './components/finance/ExpenseDashboard';
import StudentFinanceDetailView from './components/finance/StudentFinanceDetailView';
import RevenueTrendChart from './components/finance/charts/RevenueTrendChart';
import CollectionDistributionChart from './components/finance/charts/CollectionDistributionChart';
import { StatsSkeleton, Skeleton } from './components/common/Skeleton';
import PremiumAvatar from './components/common/PremiumAvatar';
import FinanceWorkflowGuide from './components/finance/FinanceWorkflowGuide';

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
            relative flex items-center gap-3 px-8 py-3 text-sm font-semibold transition-all duration-300
            ${isActive
                ? 'text-white'
                : 'text-white/40 hover:text-white'
            }
        `}
    >
        <span className="relative z-10 flex items-center gap-2">
            {icon} {label}
        </span>
        {isActive && (
            <motion.span
                layoutId="tabUnderline"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-[3px] w-12 rounded-full bg-primary shadow-[0_0_12px_rgba(var(--primary),0.8)]"
            />
        )}
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
    const [activeView, setActiveView] = useState<'overview' | 'accounts' | 'expenses' | 'master' | 'audit'>('overview');
    const [financeData, setFinanceData] = useState<FinanceData | null>(null);
    const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
    const [studentLedgers, setStudentLedgers] = useState<StudentFeeSummary[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<StudentFeeSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
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

            const [finRes, structRes, ledgerRes] = await Promise.all([
                supabase.rpc('get_finance_dashboard_data', { p_branch_id: bid }),
                structQuery,
                supabase.rpc('get_student_financial_nodes', { p_branch_id: bid })
            ]);

            if (finRes.error) throw finRes.error;
            if (structRes.error) throw structRes.error;
            if (ledgerRes.error) throw ledgerRes.error;

            setFinanceData(finRes.data || { revenue_ytd: 0, pending_dues: 0, collections_this_month: 0, online_payments: 0 });
            setFeeStructures(structRes.data || []);
            setStudentLedgers(Array.isArray(ledgerRes.data) ? ledgerRes.data : []);

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
            const { error } = await supabase.rpc('reconcile_finance_registry_v2', {
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
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Act as an institutional CFO. Analyze these school stats: Revenue YTD: ${financeData.revenue_ytd}, Pending Dues: ${financeData.pending_dues}, Online Sync Rate: ${financeData.online_payments}. Provide a 25-word strategic insight on institutional liquidity and collection risk. Use professional, architectural tone.`;
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: prompt
            });
            setAiInsight(response.text || "Synchronizing insights...");
        } catch (e) {
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
        <div className="w-full max-w-[1400px] mx-auto px-4 md:px-8 space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-24">

            {/* 1. FINANCE CENTER HEADER */}
            <header className="relative mb-8 text-center pt-8">
                <h1 className="text-6xl md:text-8xl font-serif font-black tracking-tighter text-white uppercase leading-none drop-shadow-2xl">
                    FINANCE
                    <span className="block text-xl font-medium text-white/40 mt-4 lowercase italic font-serif tracking-[0.1em]">
                        center.
                    </span>
                </h1>

                {/* Tactical Action Ribbon */}
                <div className="flex justify-center items-center gap-4 mt-8 no-print">
                    <button
                        onClick={handleForceReconcile}
                        disabled={isReconciling}
                        className="px-6 py-2.5 bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-emerald-400 transition-all flex items-center gap-3 active:scale-95 shadow-2xl backdrop-blur-md"
                    >
                        <RefreshCwIcon className={`w-4 h-4 ${isReconciling ? 'animate-spin text-emerald-500' : 'opacity-40'}`} />
                        <span>Force Sync</span>
                    </button>
                    <button
                        onClick={() => setIsGuideOpen(true)}
                        className="px-6 py-2.5 bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] hover:border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-primary transition-all flex items-center gap-3 active:scale-95 shadow-2xl backdrop-blur-md"
                    >
                        <WorkflowIcon className="w-4 h-4 opacity-40" />
                        <span>Protocol Guide</span>
                    </button>
                </div>

                {/* Subtle divider glow */}
                <div className="mx-auto mt-12 h-px w-64 bg-gradient-to-r 
                                from-transparent via-primary/50 to-transparent shadow-[0_0_15px_rgba(var(--primary),0.5)] opacity-50" />

                {/* Tabs Indicator System */}
                <div className="flex justify-center mt-12">
                    <nav className="flex items-center gap-1 bg-[#12141c]/60 p-1.5 rounded-full border border-white/5 backdrop-blur-xl shadow-[0_40px_80px_-24px_rgba(0,0,0,1)] ring-1 ring-white/5">
                        <TabButton id="overview" label="Overview" icon={<ChartBarIcon className="w-4 h-4" />} isActive={activeView === 'overview'} onClick={setActiveView} />
                        <TabButton id="accounts" label="Accounts" icon={<UsersIcon className="w-4 h-4" />} isActive={activeView === 'accounts'} onClick={setActiveView} />
                        <TabButton id="expenses" label="Registry" icon={<BriefcaseIcon className="w-4 h-4" />} isActive={activeView === 'expenses'} onClick={setActiveView} />
                        <TabButton id="master" label="Master" icon={<BookIcon className="w-4 h-4" />} isActive={activeView === 'master'} onClick={setActiveView} />
                        <TabButton id="audit" label="Audit" icon={<ShieldCheckIcon className="w-4 h-4" />} isActive={activeView === 'audit'} onClick={setActiveView} />
                    </nav>
                </div>
            </header>

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
                                    title="Revenue (YTD)"
                                    value={formatCurrency(financeData.revenue_ytd, viewCurrency)}
                                    trend="+12.5%"
                                    trendUp={true}
                                    icon={<TrendingUpCustomIcon className="w-8 h-8" />}
                                    color="bg-primary"
                                />
                                <FinanceStatCard
                                    title="Pending Ledger"
                                    value={formatCurrency(financeData.pending_dues, viewCurrency)}
                                    trend="2.4%"
                                    trendUp={false}
                                    icon={<AlertTriangleIcon className="w-8 h-8" />}
                                    color="bg-red-500"
                                />
                                <FinanceStatCard
                                    title="Digital Stream"
                                    value={formatCurrency(financeData.online_payments, viewCurrency)}
                                    icon={<CreditCardIcon className="w-8 h-8" />}
                                    color="bg-emerald-500"
                                />
                                <FinanceStatCard
                                    title="Institutional Burn"
                                    value={formatCurrency(financeData.collections_this_month * 0.4, viewCurrency)}
                                    icon={<BriefcaseIcon className="w-8 h-8" />}
                                    color="bg-violet-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
                                <div className="lg:col-span-8 space-y-10">
                                    <div className="bg-[#0c0d12] border border-white/5 rounded-[4rem] p-8 md:p-16 shadow-[0_64px_128px_-24px_rgba(0,0,0,1)] relative overflow-hidden h-[540px] ring-1 ring-white/10">
                                        <RevenueTrendChart total={financeData.revenue_ytd} />
                                    </div>
                                    <div className="bg-primary/5 border border-primary/20 rounded-[3.5rem] p-8 md:p-12 relative overflow-hidden group shadow-2xl">
                                        <div className="absolute top-0 right-0 p-16 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000"><SparklesIcon className="w-48 h-48 text-primary" /></div>
                                        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
                                            <div className="space-y-5 max-w-3xl">
                                                <h4 className="text-2xl font-serif font-black text-white uppercase tracking-tight flex items-center gap-4">
                                                    <SparklesIcon className="w-8 h-8 text-primary animate-pulse" /> Financial Oracle
                                                </h4>
                                                {aiInsight ? (
                                                    <p className="text-xl md:text-2xl text-white/80 leading-relaxed font-serif italic">"{aiInsight}"</p>
                                                ) : (
                                                    <p className="text-lg text-white/30 font-medium font-serif italic">Consult the institutional core to synthesize liquidity trends and collection risks.</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={runFinancialOracle}
                                                disabled={isAnalyzing}
                                                className="px-12 py-6 bg-primary text-white font-black text-xs uppercase tracking-[0.4em] rounded-2xl shadow-2xl hover:bg-primary/90 transition-all flex items-center justify-center gap-4 active:scale-95 shadow-primary/20 ring-8 ring-primary/5 whitespace-nowrap"
                                            >
                                                {isAnalyzing ? <Spinner size="sm" className="text-white" /> : 'Sync Intelligence'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="lg:col-span-4 bg-[#0c0d12] border border-white/5 rounded-[4rem] p-8 md:p-16 shadow-[0_64px_128px_-24px_rgba(0,0,0,1)] flex flex-col relative overflow-hidden h-[740px] ring-1 ring-white/10">
                                    <div className="absolute top-0 right-0 p-16 opacity-[0.01]"><ChartBarIcon className="w-64 h-64 text-primary" /></div>
                                    <div className="relative z-10 h-full flex flex-col">
                                        <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] mb-16">Collection Integrity</h4>
                                        <CollectionDistributionChart
                                            paid={financeData.revenue_ytd}
                                            pending={financeData.pending_dues}
                                            overdue={financeData.pending_dues * 0.3}
                                        />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeView === 'accounts' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">

                            {/* 3. SEARCH + ACTION BAR (Unified Control Panel) */}
                            <div className="flex flex-wrap items-center gap-3 rounded-[1.8rem] bg-white/5 backdrop-blur-xl border border-white/10 p-5 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">

                                {/* Search */}
                                <div className="flex-1 relative group">
                                    <input
                                        type="text"
                                        placeholder="Search student, staff, or class account…"
                                        value={accountSearch}
                                        onChange={e => setAccountSearch(e.target.value)}
                                        className="h-14 w-full rounded-2xl bg-black/40 border border-white/5 px-6 pr-12 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all font-medium tracking-wide shadow-inner"
                                    />
                                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs text-white/10 font-mono select-none group-focus-within:text-primary transition-colors">
                                        /
                                    </span>
                                </div>

                                {/* Export */}
                                <button
                                    onClick={handleExportRegistry}
                                    className="h-14 px-8 rounded-2xl border border-white/5 bg-white/[0.02] text-sm font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/[0.05] hover:border-white/10 transition-all active:scale-95 shadow-xl flex items-center gap-3"
                                    title="Export account ledger"
                                >
                                    <DownloadIcon className="w-4 h-4" />
                                    Export
                                </button>

                                {/* Add Account */}
                                <button
                                    onClick={() => setIsWizardOpen(true)}
                                    className="h-14 px-10 rounded-2xl bg-primary text-sm font-black uppercase tracking-[0.2em] text-white shadow-[0_0_30px_rgba(var(--primary),0.6)] hover:bg-primary/90 hover:scale-[1.03] active:scale-95 transition-all flex items-center gap-3 ring-8 ring-primary/5"
                                >
                                    <PlusIcon className="w-5 h-5" />
                                    Add Account
                                </button>
                            </div>

                            {/* 4. ACCOUNT LIST → FINANCE CARD-ROW */}
                            <div className="space-y-4 pt-4">
                                {filteredAccounts.length > 0 ? filteredAccounts.map((account, idx) => {
                                    const health = Math.round(account.integrity_score || 0);
                                    const isCritical = health < 40;
                                    const initials = account.display_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

                                    return (
                                        <motion.div
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            key={account.student_id}
                                            onClick={() => setSelectedStudent(account)}
                                            className="group flex flex-col gap-6 rounded-[2.2rem] p-6 bg-[#0a0a0c]/60 backdrop-blur-xl border border-white/5 hover:border-primary/40 hover:-translate-y-[3px] hover:shadow-[0_40px_80px_-24px_rgba(0,0,0,0.8)] transition-all duration-500 md:flex-row md:items-center cursor-pointer relative overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                                            {/* LEFT — IDENTITY */}
                                            <div className="flex min-w-[240px] items-center gap-5 relative z-10">
                                                <div className="relative">
                                                    <div className="absolute -inset-1 rounded-full bg-primary/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-sm font-black text-white shadow-2xl relative z-10 border border-white/10 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                                                        {initials}
                                                    </div>
                                                </div>

                                                <div>
                                                    <p className="text-base font-black text-white uppercase tracking-tight group-hover:text-primary transition-colors leading-none">
                                                        {account.display_name}
                                                    </p>
                                                    <span className="mt-2 inline-block rounded-lg bg-white/5 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white/30 border border-white/5">
                                                        Grade {account.grade} • {account.class_name || 'UNASSIGNED'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* CENTER — ACCOUNT HEALTH */}
                                            <div className="flex-1 max-w-sm relative z-10">
                                                <p className="mb-2 text-[9px] font-black uppercase tracking-[0.3em] text-white/20">
                                                    Account Health
                                                </p>
                                                <div className="h-2 overflow-hidden rounded-full bg-black/60 p-[1px] border border-white/5">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${health}%` }}
                                                        transition={{ duration: 2, ease: "easeOut" }}
                                                        className={`h-full rounded-full ${health >= 80 ? 'bg-gradient-to-r from-emerald-400 to-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)]' :
                                                                isCritical ? 'bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.6)]' :
                                                                    'bg-gradient-to-r from-amber-500 to-primary shadow-[0_0_12px_rgba(var(--primary),0.6)]'
                                                            }`}
                                                    />
                                                </div>
                                                <p className={`mt-2 text-[10px] font-black uppercase tracking-wider ${health >= 80 ? 'text-emerald-400' : isCritical ? 'text-red-400' : 'text-primary'}`}>
                                                    {health}% {health >= 80 ? 'Optimal' : isCritical ? 'Risk' : 'Stable'}
                                                </p>
                                            </div>

                                            {/* RIGHT — FINANCE METRICS */}
                                            <div className="hidden items-center gap-12 md:flex relative z-10 px-8 border-l border-white/[0.03]">
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black uppercase text-white/20 tracking-widest mb-1">Outstanding</p>
                                                    <p className={`font-mono font-black text-xl tracking-tighter ${account.outstanding_balance > 0 ? 'text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'text-emerald-400'}`}>
                                                        {formatCurrency(account.outstanding_balance, viewCurrency)}
                                                    </p>
                                                </div>

                                                <div className="text-right">
                                                    <p className="text-[10px] font-black uppercase text-white/20 tracking-widest mb-1">Audit Status</p>
                                                    <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase border tracking-widest ${account.outstanding_balance > 0
                                                            ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                        }`}>
                                                        {account.outstanding_balance > 0 ? 'Arrears' : 'Cleared'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* ACTIONS — Discoverable on Hover */}
                                            <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-500 ml-auto translate-x-4 group-hover:translate-x-0 relative z-10">
                                                <button className="h-10 px-5 rounded-xl border border-white/5 bg-white/[0.03] text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/[0.08] transition-all active:scale-95">
                                                    Ledger
                                                </button>
                                                <button className="h-10 px-5 rounded-xl border border-white/5 bg-white/[0.03] text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/[0.08] transition-all active:scale-95">
                                                    Audit
                                                </button>
                                                <button className="h-10 w-10 rounded-xl border border-white/5 bg-white/[0.03] text-white/20 hover:text-primary transition-all flex items-center justify-center active:scale-90">
                                                    <MoreVerticalIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </motion.div>
                                    );
                                }) : (
                                    <div className="py-48 text-center flex flex-col items-center gap-10 opacity-30 animate-in fade-in duration-1000">
                                        <div className="w-32 h-32 bg-white/[0.01] rounded-[4rem] border-2 border-dashed border-white/5 flex items-center justify-center shadow-inner">
                                            <ActivityIcon className="w-14 h-14 text-white/5" />
                                        </div>
                                        <div className="space-y-4">
                                            <h3 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">No accounts found matching your filters</h3>
                                            <button onClick={() => { setAccountSearch(''); setRiskOnly(false); }} className="mt-4 px-10 py-4 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-xl active:scale-95">Reset Matrix Context</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {activeView === 'expenses' && (
                        <div className="animate-in fade-in duration-700">
                            <ExpenseDashboard branches={branches} branchId={branchId || null} data={financeData ? { total_expenses_month: 0, pending_approvals: 0, recent_expenses: (financeData as any).recent_expenses || [] } : { total_expenses_month: 0, pending_approvals: 0, recent_expenses: [] }} onRefresh={fetchAllData} viewCurrency={viewCurrency} />
                        </div>
                    )}

                    {activeView === 'master' && (
                        <div className="space-y-16 animate-in fade-in duration-700">
                            <div className="bg-[#0c0d12] p-12 md:p-20 rounded-[4rem] border border-white/5 flex flex-col md:flex-row justify-between items-center gap-16 shadow-[0_64px_128px_-24px_rgba(0,0,0,1)] ring-1 ring-white/10 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-24 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000 group-hover:opacity-[0.06]"><SparklesIcon className="w-64 h-64 text-primary" /></div>
                                <div className="space-y-5 relative z-10">
                                    <h3 className="text-5xl font-serif font-black text-white uppercase tracking-tight">Master Architect</h3>
                                    <p className="text-xl text-white/20 font-medium tracking-[0.2em] uppercase max-w-2xl leading-relaxed">Configure global institutional billing nodes and multi-tenant fee structures.</p>
                                </div>
                                <button
                                    onClick={() => setIsWizardOpen(true)}
                                    className="px-16 py-8 bg-primary text-white font-black text-sm uppercase tracking-[0.5em] rounded-[2.5rem] shadow-[0_48px_96px_-16px_rgba(var(--primary),0.6)] hover:bg-primary/90 transition-all flex items-center gap-6 transform hover:-translate-y-2 active:scale-95 border border-white/10 ring-[12px] ring-primary/5 relative z-10"
                                >
                                    <PlusIcon className="w-8 h-8" /> Provision Structure
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-12">
                                {feeStructures.map((fs) => (
                                    <div key={fs.id} className="bg-[#0c0d12] border border-white/10 rounded-[4.5rem] p-12 md:p-16 shadow-[0_64px_128px_-24px_rgba(0,0,0,1)] hover:border-primary/40 transition-all duration-1000 flex flex-col h-full group ring-1 ring-white/10 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-16 opacity-[0.01] pointer-events-none group-hover:opacity-[0.04] transition-opacity duration-1000"><BookIcon className="w-56 h-56 text-white" /></div>
                                        <div className="flex justify-between items-start mb-16 relative z-10">
                                            <div>
                                                <h4 className="text-4xl font-serif font-black text-white group-hover:text-primary transition-colors tracking-tight uppercase leading-none">{fs.name}</h4>
                                                <div className="flex items-center gap-4 mt-6">
                                                    <span className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em]">{fs.academic_year} Context</span>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-white/10"></div>
                                                    <span className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em]">Grade {fs.target_grade}</span>
                                                </div>
                                            </div>
                                            <span className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${fs.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-2xl' : 'bg-white/5 text-white/20 border-white/10'}`}>{fs.status}</span>
                                        </div>

                                        <div className="space-y-8 mb-16 flex-grow relative z-10">
                                            {(fs.components || []).slice(0, 4).map((comp: any) => (
                                                <div key={comp.id} className="flex justify-between items-center border-b border-white/[0.04] pb-8">
                                                    <div className="space-y-1.5">
                                                        <span className="text-white/60 font-black uppercase tracking-[0.2em] text-[13px] block">{comp.name}</span>
                                                        <span className="text-[10px] text-white/20 font-black uppercase tracking-[0.3em]">{comp.frequency} Cycle</span>
                                                    </div>
                                                    <span className="font-mono font-black text-white text-2xl tracking-tighter">{formatCurrency(comp.amount, fs.currency as CurrencyCode)}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="pt-12 border-t border-white/[0.08] flex justify-between items-end mt-auto relative z-10">
                                            <div>
                                                <p className="text-[11px] font-black text-white/20 uppercase tracking-[0.5em] mb-3">Global Valuation (Annual)</p>
                                                <span className="text-5xl font-black text-primary font-mono tracking-tighter drop-shadow-[0_0_20px_rgba(var(--primary),0.3)]">{formatCurrency(fs.components?.reduce((a, c) => a + Number(c.amount), 0) || 0, fs.currency as CurrencyCode)}</span>
                                            </div>
                                            <button className="p-5 bg-white/5 text-white/20 rounded-2xl hover:text-white hover:bg-white/10 transition-all shadow-3xl border border-transparent hover:border-white/10 active:scale-90"><EditIcon className="w-8 h-8" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeView === 'audit' && (
                        <div className="p-40 text-center flex flex-col items-center gap-10 opacity-20 animate-in fade-in duration-1000">
                            <ShieldCheckIcon className="w-24 h-24 text-white" />
                            <h3 className="text-3xl font-black uppercase tracking-[0.6em]">Audit Matrix Standby</h3>
                            <p className="text-sm font-bold uppercase tracking-[0.3em] max-w-sm mx-auto">Access restricted to Head Office administrators. Verifying protocol clearances...</p>
                        </div>
                    )}
                </AnimatePresence>
            )}

            {isWizardOpen && (
                <FeeMasterWizard
                    onClose={() => setIsWizardOpen(false)}
                    branchId={branchId || null}
                    onSuccess={() => {
                        setIsWizardOpen(false);
                        fetchAllData();
                    }}
                />
            )}

            {isGuideOpen && <FinanceWorkflowGuide onClose={() => setIsGuideOpen(false)} />}
        </div>
    );
};

export default FinanceTab;