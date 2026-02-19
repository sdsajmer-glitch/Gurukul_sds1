import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, formatError } from '../services/supabase';
import {
    FinanceData, FeeStructure, GradeCollectionStats,
    StudentFeeSummary, UserProfile, SchoolBranch, CurrencyCode
} from '../types';
import FinanceRefundManager from './finance/FinanceRefundManager';
import { StatsSkeleton, Skeleton } from './common/Skeleton';
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
import { GoogleGenerativeAI } from "@google/generative-ai";
import { motion, AnimatePresence } from 'framer-motion';

import FinanceAuditLog from './finance/FinanceAuditLog';
import FinanceOverview from './finance/FinanceOverview';
import FinanceAccounts from './finance/FinanceAccounts';
import MasterControlPanel from './finance/MasterControlPanel';
import FeeMasterWizard from './finance/FeeMasterWizard';
import PaymentProtocolModal from './finance/PaymentProtocolModal';
import AdjustmentRuleModal from './finance/AdjustmentRuleModal';
import FinanceAudit from './finance/FinanceAudit';
import FinanceExpense from './finance/FinanceExpense';
import StudentFinanceDetailView from './finance/StudentFinanceDetailView';
import PremiumAvatar from './common/PremiumAvatar';
import FinanceProcessGuide from './finance/FinanceProcessGuide';
import FiscalTaxModal from './finance/FiscalTaxModal';

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
        flex items-center gap-3 px-8 py-3.5 rounded-[1.25rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 relative overflow-hidden group
        ${isActive
                ? 'bg-white text-black shadow-[0_20px_40px_-10px_rgba(255,255,255,0.3)] z-10 scale-105'
                : 'text-white/30 hover:text-white hover:bg-white/5 hover:scale-102'
            }
    `}
    >
        <span className="relative z-10 flex items-center gap-2.5">
            {React.cloneElement(icon as React.ReactElement, { className: `w-4 h-4 ${isActive ? 'text-black' : 'text-primary/40'}` })}
            {label}
        </span>
        {isActive && (
            <motion.div
                layoutId="tab-glow"
                className="absolute inset-0 bg-gradient-to-tr from-white to-white/80 pointer-events-none"
            />
        )}
    </button>
);

interface FinanceTabProps {
    profile: UserProfile;
    branchId?: number | null;
    branches?: SchoolBranch[];
}

const FinanceTab: React.FC<FinanceTabProps> = ({ profile, branchId, branches }) => {
    const [activeView, setActiveView] = useState<'overview' | 'accounts' | 'master' | 'audit' | 'expenditure' | 'refunds'>('overview');
    const [financeData, setFinanceData] = useState<FinanceData | null>(null);
    const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
    const [studentLedgers, setStudentLedgers] = useState<StudentFeeSummary[]>([]);
    const [gradeStats, setGradeStats] = useState<GradeCollectionStats[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<StudentFeeSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [editingStructure, setEditingStructure] = useState<FeeStructure | null>(null);
    const [isProtocolModalOpen, setIsProtocolModalOpen] = useState(false);
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
    const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
    const [accountSearch, setAccountSearch] = useState('');
    const [riskOnly, setRiskOnly] = useState(false);
    const [accountViewFilter, setAccountViewFilter] = useState<string | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);
    const [paymentProtocols, setPaymentProtocols] = useState<any[]>([]);
    const [adjustmentRules, setAdjustmentRules] = useState<any[]>([]);
    const [institutionalReadiness, setInstitutionalReadiness] = useState<any>(null);
    const [masterState, setMasterState] = useState<any>(null);
    const [projections, setProjections] = useState<any>(null);

    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isReconciling, setIsReconciling] = useState(false);
    const [isProcessGuideOpen, setIsProcessGuideOpen] = useState(false);
    const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

    const viewCurrency = useMemo(() => profile.base_currency || 'INR', [profile]);

    const fetchAllData = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        setError(null);
        try {
            const bid = (branchId === undefined || branchId === null) ? null : Number(branchId);

            const [finRes, structRes, ledgerRes, gradeRes, healthRes, protocolRes, ruleRes, readinessRes, projectionRes, masterRes, streamRes] = await Promise.all([
                supabase.rpc('get_finance_overview_stats_v3', { p_branch_id: bid }),
                supabase.rpc('get_fee_structures_with_metrics', { p_branch_id: bid }),
                supabase.rpc('get_student_fee_summary_all', { p_branch_id: bid }),
                supabase.rpc('get_grade_wise_collection_stats', { p_branch_id: bid }),
                supabase.rpc('get_institutional_health_index', { p_branch_id: bid }),
                supabase.from('finance_payment_protocols').select('*').eq('branch_id', bid),
                supabase.from('finance_adjustment_rules').select('*').eq('branch_id', bid),
                supabase.rpc('fn_calculate_finance_readiness', { p_branch_id: bid }),
                supabase.rpc('get_financial_projection_matrix', { p_branch_id: bid }),
                supabase.rpc('get_finance_master_state', { p_branch_id: bid }),
                supabase.rpc('get_recent_financial_stream', { p_branch_id: bid })
            ]);

            if (finRes.error) throw finRes.error;
            if (structRes.error) throw structRes.error;
            if (ledgerRes.error) throw ledgerRes.error;

            const baseData = finRes.data || { total_assigned: 0, total_collected: 0, total_pending: 0, total_overdue: 0, monthly_collection: 0, today_collection: 0, currency: 'INR' };
            setFinanceData({
                ...baseData,
                health_index: healthRes.data?.health_index || 0,
                collection_efficiency: healthRes.data?.collection_efficiency || 0,
                outstanding_ratio: healthRes.data?.outstanding_ratio || 0,
                burn_rate_stability: healthRes.data?.burn_rate_stability || 0,
                total_expense_30d: baseData.total_expense_30d || 0
            });
            setFeeStructures(structRes.data || []);
            setStudentLedgers(Array.isArray(ledgerRes.data) ? ledgerRes.data : []);
            setGradeStats(Array.isArray(gradeRes.data) ? gradeRes.data : []);
            setPaymentProtocols(protocolRes.data || []);
            setAdjustmentRules(ruleRes.data || []);
            setInstitutionalReadiness(readinessRes.data);
            setProjections(projectionRes.data);
            setMasterState(masterRes.data);
            setRecentTransactions(streamRes.data || []);

        } catch (err: any) {
            console.error("Finance Registry Sync Failure:", err);
            setError(formatError(err));
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, [branchId]);

    const readiness = useMemo(() => {
        const hasActiveStructures = feeStructures.some(s => s.status === 'Active');
        const hasStudentsWithFees = studentLedgers.length > 0;
        const totalBilled = financeData?.total_assigned || 0;

        return {
            isSetupComplete: hasActiveStructures && hasStudentsWithFees && totalBilled > 0,
            hasStructures: hasActiveStructures,
            hasAssignments: hasStudentsWithFees,
            hasLedger: totalBilled > 0,
            missingSteps: [
                !hasActiveStructures && "Create Active Fee Protocol",
                !hasStudentsWithFees && "Link Students to Fee Nodes",
                totalBilled === 0 && hasStudentsWithFees && "Generate Operational Ledger"
            ].filter(Boolean) as string[]
        };
    }, [feeStructures, studentLedgers, financeData]);

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
            setError("Reconciliation Protocol Failure: " + formatError(err));
        } finally {
            setTimeout(() => setIsReconciling(false), 800);
        }
    };

    const runFinancialOracle = async () => {
        if (!financeData) return;
        setIsAnalyzing(true);
        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
                setAiInsight("AI_ORACLE_PENDING_CONFIG: PROVIDE_API_KEY");
                return;
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });

            const prompt = `Act as an institutional CFO. Analyze these stats: Total Assigned: ${financeData.total_assigned}, Collected: ${financeData.total_collected}, Pending: ${financeData.total_pending}, Overdue: ${financeData.total_overdue}, Monthly Collection: ${financeData.monthly_collection}. Provide a 25-word strategic insight on liquidity and collection efficiency.`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            setAiInsight(response.text());
        } catch (e) {
            console.error("AI Oracle Error:", e);
            setAiInsight("AI_ORACLE_DEFERRED: SEC_NODE_OFFLINE");
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
            {/* Enhanced Finance Executive Header */}
            <div className="flex flex-col gap-8 pt-6">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8">
                    {/* Left: Branding & Navigation */}
                    <div className="space-y-4">
                        <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
                            <span className="hover:text-primary cursor-pointer transition-colors" onClick={() => setActiveView('overview')}>Finance Center</span>
                            <span className="opacity-40">/</span>
                            <span className="text-primary/60 capitalize">{activeView}</span>
                        </nav>
                        <h2 className="text-[clamp(40px,5vw,64px)] font-serif font-black text-white tracking-tighter uppercase leading-[0.85]">
                            FINANCE <span className="text-white/20 italic font-medium lowercase">center.</span>
                        </h2>
                    </div>

                    {/* Right: Actions & Global Controls */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full xl:w-auto">
                        {/* Search Bar - Global Context */}
                        <div className="relative group flex-1 sm:w-64 xl:w-80">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                <SearchIcon className="w-4 h-4 text-white/20 group-focus-within:text-primary transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search Student, Invoice, ID..."
                                className="w-full h-12 pl-12 pr-4 bg-[#12141c] border border-white/5 rounded-2xl text-xs font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/40 transition-all shadow-inner"
                                value={accountSearch}
                                onChange={(e) => setAccountSearch(e.target.value)}
                            />
                        </div>

                        {/* Year Selector (Mockup for Visual) */}
                        <div className="flex items-center gap-3 px-4 h-12 bg-[#12141c] border border-white/5 rounded-2xl cursor-pointer hover:border-white/10 transition-all group">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-xs font-bold text-white/60 group-hover:text-white transition-colors">2025-2026</span>
                            <ChevronDownIcon className="w-4 h-4 text-white/20" />
                        </div>

                        {/* Quick Actions */}
                        <div className="flex gap-2">
                            <button
                                onClick={handleForceReconcile}
                                disabled={isReconciling}
                                className="h-12 px-4 bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] rounded-2xl text-white/40 hover:text-emerald-400 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg group"
                                title="Reconcile Matrix"
                            >
                                <RefreshCwIcon className={`w-4 h-4 ${isReconciling ? 'animate-spin text-emerald-500' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                            </button>
                            <button
                                onClick={() => setIsProcessGuideOpen(true)}
                                className="h-12 px-6 bg-primary text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-white hover:text-black transition-all shadow-xl active:scale-95 flex items-center gap-2"
                            >
                                <WorkflowIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">Process Guide</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sub-Header: Navigation & Summary Widgets */}
                <div className="flex flex-col xl:flex-row items-center justify-between gap-6 border-b border-white/[0.02] pb-6">
                    <div className="flex bg-[#12141c]/60 p-1.5 rounded-[1.5rem] border border-white/5 backdrop-blur-xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] ring-1 ring-white/5 overflow-x-auto max-w-full scrollbar-hide">
                        <TabButton id="overview" label="Overview" icon={<ChartBarIcon className="w-4 h-4" />} isActive={activeView === 'overview'} onClick={setActiveView} />
                        <TabButton id="accounts" label="Accounts" icon={<UsersIcon className="w-4 h-4" />} isActive={activeView === 'accounts'} onClick={setActiveView} />
                        <TabButton id="refunds" label="Refunds" icon={<RefreshCwIcon className="w-4 h-4" />} isActive={activeView === 'refunds'} onClick={setActiveView} />
                        <TabButton id="expenditure" label="Expenditure" icon={<TrendingUpCustomIcon className="w-4 h-4 rotate-180" />} isActive={activeView === 'expenditure'} onClick={setActiveView} />

                        {(profile.role?.toLowerCase()?.includes('admin') || profile.role?.toLowerCase() === 'accountant' || profile.role?.toLowerCase() === 'principal' || profile.role?.toLowerCase()?.includes('finance')) && (
                            <>
                                <TabButton id="master" label="Master Control" icon={<ShieldCheckIcon className="w-4 h-4" />} isActive={activeView === 'master'} onClick={setActiveView} />
                                <TabButton id="audit" label="Audit Logs" icon={<ActivityIcon className="w-4 h-4" />} isActive={activeView === 'audit'} onClick={setActiveView} />
                            </>
                        )}
                    </div>

                    {/* Mini Financial Summary Chips */}
                    {!loading && financeData && (
                        <div className="hidden xl:flex items-center gap-4">
                            <div className="px-5 py-2 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex flex-col items-end">
                                <span className="text-[9px] font-black uppercase text-emerald-500/60 tracking-wider">Collected</span>
                                <span className="text-sm font-mono font-bold text-emerald-400">{formatCurrency(financeData.total_collected, viewCurrency)}</span>
                            </div>
                            <div className="w-px h-8 bg-white/5"></div>
                            <div className="px-5 py-2 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex flex-col items-end">
                                <span className="text-[9px] font-black uppercase text-amber-500/60 tracking-wider">Pending</span>
                                <span className="text-sm font-mono font-bold text-amber-400">{formatCurrency(financeData.total_pending, viewCurrency)}</span>
                            </div>
                            <div className="w-px h-8 bg-white/5"></div>
                            <div className="px-5 py-2 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex flex-col items-end">
                                <span className="text-[9px] font-black uppercase text-blue-500/60 tracking-wider">Total</span>
                                <span className="text-sm font-mono font-bold text-blue-400">{formatCurrency(financeData.total_assigned, viewCurrency)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Governance Protocol Banner - Readiness Layer - compact */}
            {!readiness.isSetupComplete && !loading && !error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-8"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                            <AlertTriangleIcon className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wide">Setup Required</h4>
                            <span className="hidden md:inline w-1 h-1 bg-amber-500/40 rounded-full" />
                            <p className="text-xs text-amber-500/80 font-medium tracking-wide">
                                {readiness.missingSteps[0] || "Initialize Finance Protocol"}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setActiveView('master')}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap"
                    >
                        Complete Setup <ArrowRightIcon className="w-3 h-3" />
                    </button>
                </motion.div>
            )}

            <div className="w-full h-px bg-white/5 rounded-full" />

            {loading ? (
                <div className="space-y-12">
                    <StatsSkeleton />
                    <Skeleton.List rows={8} />
                </div>
            ) : error ? (
                <div className="p-24 text-center flex flex-col items-center justify-center bg-[#0c0d12] rounded-[4rem] border border-white/5 shadow-3xl ring-1 ring-white/10 max-w-4xl mx-auto backdrop-blur-3xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-24 opacity-[0.02] rotate-12 pointer-events-none">
                        <AlertTriangleIcon className="w-96 h-96" />
                    </div>

                    <div className="p-8 bg-red-500/10 rounded-[2.5rem] border border-red-500/20 text-red-500 mb-10 shadow-[0_0_40px_-10px_rgba(239,68,68,0.3)] animate-pulse relative z-10">
                        <AlertTriangleIcon className="w-16 h-16" />
                    </div>

                    <h3 className="text-5xl font-serif font-black text-white uppercase tracking-tight leading-none mb-8 relative z-10">Registry Protocol Fault</h3>

                    <div className="bg-black/40 border border-white/5 rounded-3xl p-8 mb-10 text-left w-full max-w-2xl relative z-10">
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-4 italic">Diagnostic Trace:</p>
                        <p className="text-lg font-mono font-medium text-white/60 leading-relaxed mb-6 break-words">
                            {error}
                        </p>

                        {(error.includes('ambiguous') || error.includes('function') || error.includes('schema') || error.includes('Reference') || error.includes('signature')) && (
                            <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-6">
                                <div>
                                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2">Required Admin Action</p>
                                    <p className="text-sm font-mono text-white/80">Execute <span className="text-white font-bold select-all">MASTER_FINANCE_RESTORATION_V37_ULTRASONIC.sql</span></p>
                                </div>
                                <button
                                    onClick={() => navigator.clipboard.writeText('MASTER_FINANCE_RESTORATION_V37_ULTRASONIC.sql')}
                                    className="px-6 py-3 bg-red-500 hover:bg-red-400 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors shadow-lg active:scale-95 whitespace-nowrap"
                                >
                                    Copy Script Name
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-4 relative z-10">
                        <button
                            onClick={() => fetchAllData()}
                            className="px-10 py-5 bg-white text-black font-black text-[11px] uppercase tracking-[0.4em] rounded-[1.25rem] hover:bg-white/90 transition-all shadow-xl active:scale-95 border border-white/20"
                        >
                            Retry Sync
                        </button>
                    </div>
                </div>
            ) : (
                <AnimatePresence mode="wait">
                    {activeView === 'overview' && financeData && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <FinanceOverview
                                data={financeData}
                                gradeStats={gradeStats}
                                projections={projections}
                                currency={viewCurrency}
                                onNavigate={(v, filter) => {
                                    setActiveView(v);
                                    if (filter) setAccountViewFilter(filter);
                                    else setAccountViewFilter(undefined);
                                }}
                                runOracle={runFinancialOracle}
                                aiInsight={aiInsight}
                                isAnalyzing={isAnalyzing}
                                readiness={readiness}
                                recentTransactions={recentTransactions}
                                onExportDashboard={() => {
                                    if (!financeData) return;
                                    const lines = [
                                        `Finance Dashboard Snapshot - ${new Date().toISOString().split('T')[0]}`,
                                        '', 'KPI,Value',
                                        `Total Assigned,${financeData.total_assigned}`,
                                        `Total Collected,${financeData.total_collected}`,
                                        `Outstanding,${financeData.total_pending}`,
                                        `Overdue,${financeData.total_overdue}`,
                                        `Monthly Collection,${financeData.monthly_collection}`,
                                        `Collection Efficiency,${financeData.collection_efficiency || 0}%`,
                                        `Health Index,${financeData.health_index || 0}`,
                                    ];
                                    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `Finance_Dashboard_${new Date().toISOString().split('T')[0]}.csv`;
                                    a.click();
                                    window.URL.revokeObjectURL(url);
                                }}
                            />
                        </motion.div>
                    )}

                    {activeView === 'accounts' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            {selectedStudent ? (
                                <StudentFinanceDetailView
                                    student={selectedStudent}
                                    viewCurrency={viewCurrency}
                                    onBack={() => setSelectedStudent(null)}
                                    onUpdate={() => fetchAllData(true)}
                                    onNavigateToMaster={() => {
                                        setSelectedStudent(null);
                                        setActiveView('master');
                                    }}
                                />
                            ) : (
                                <FinanceAccounts
                                    accountsHost={studentLedgers}
                                    currency={viewCurrency}
                                    search={accountSearch}
                                    onSearchChange={setAccountSearch}
                                    riskOnly={riskOnly}
                                    onRiskToggle={() => setRiskOnly(!riskOnly)}
                                    onExport={() => {
                                        if (!studentLedgers.length) return;
                                        const headers = 'Student Name,Grade,Class,Total Billed,Total Paid,Outstanding,Status\n';
                                        const csv = studentLedgers.map(s =>
                                            `"${s.display_name}","${s.grade}","${s.class_name}",${s.total_billed},${s.total_paid},${s.outstanding_balance},"${s.overall_status}"`
                                        ).join('\n');
                                        const blob = new Blob([headers + csv], { type: 'text/csv' });
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `Student_Fee_Registry_${new Date().toISOString().split('T')[0]}.csv`;
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                    }}
                                    onSelectAccount={(acc) => setSelectedStudent(acc)}
                                    viewFilter={accountViewFilter}
                                />
                            )}
                        </motion.div>
                    )}

                    {activeView === 'master' && (
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                            <MasterControlPanel
                                feeStructures={feeStructures}
                                paymentProtocols={paymentProtocols}
                                adjustmentRules={adjustmentRules}
                                currency={viewCurrency}
                                branchId={Number(branchId)} // cast to number for safety
                                onNewStructure={() => setIsWizardOpen(true)}
                                onEditStructure={(fs) => {
                                    setEditingStructure(fs);
                                    setIsWizardOpen(true);
                                }}
                                onNewProtocol={() => setIsProtocolModalOpen(true)}
                                onNewRule={() => setIsRuleModalOpen(true)}
                                onNewTax={() => setIsTaxModalOpen(true)}
                                onUpdate={() => fetchAllData(true)}
                                masterState={masterState}
                            />
                        </motion.div>
                    )}

                    {activeView === 'audit' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <FinanceAudit branchId={branchId || null} />
                        </motion.div>
                    )}

                    {activeView === 'refunds' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <FinanceRefundManager branchId={branchId || null} currency={viewCurrency} students={studentLedgers} />
                        </motion.div>
                    )}

                    {activeView === 'expenditure' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <FinanceExpense branchId={branchId || null} currency={viewCurrency} />
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
            {isProtocolModalOpen && (
                <PaymentProtocolModal
                    isOpen={isProtocolModalOpen}
                    onClose={() => setIsProtocolModalOpen(false)}
                    branchId={branchId || null}
                    onSuccess={() => {
                        setIsProtocolModalOpen(false);
                        fetchAllData();
                    }}
                />
            )}

            {isRuleModalOpen && (
                <AdjustmentRuleModal
                    isOpen={isRuleModalOpen}
                    onClose={() => setIsRuleModalOpen(false)}
                    branchId={branchId || null}
                    onSuccess={() => {
                        setIsRuleModalOpen(false);
                        fetchAllData();
                    }}
                />
            )}
            <AnimatePresence>
                <FiscalTaxModal
                    isOpen={isTaxModalOpen}
                    onClose={() => setIsTaxModalOpen(false)}
                    onSuccess={() => {
                        setIsTaxModalOpen(false);
                        fetchAllData(true);
                    }}
                    branchId={branchId ? Number(branchId) : null}
                />
            </AnimatePresence>

            <AnimatePresence>
                {isProcessGuideOpen && (
                    <FinanceProcessGuide onClose={() => setIsProcessGuideOpen(false)} />
                )}
            </AnimatePresence>
        </div>
    );
};

export default FinanceTab;
