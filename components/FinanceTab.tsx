
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
import { GoogleGenerativeAI } from "@google/generative-ai";
import { motion, AnimatePresence } from 'framer-motion';

import FinanceAuditLog from './finance/FinanceAuditLog';
import FinanceOverview from './finance/FinanceOverview';
import FinanceAccounts from './finance/FinanceAccounts';
import FinanceMaster from './finance/FinanceMaster';
import FeeMasterWizard from './finance/FeeMasterWizard';
import PaymentProtocolModal from './finance/PaymentProtocolModal';
import AdjustmentRuleModal from './finance/AdjustmentRuleModal';
import FinanceAudit from './finance/FinanceAudit';
import FinanceExpense from './finance/FinanceExpense';
import { StatsSkeleton, Skeleton } from './common/Skeleton';
import StudentFinanceDetailView from './finance/StudentFinanceDetailView';
import PremiumAvatar from './common/PremiumAvatar';
import FinanceProcessGuide from './finance/FinanceProcessGuide';


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


const FinanceTab: React.FC<{ profile: UserProfile, branchId?: number | null, branches: SchoolBranch[] }> = ({ profile, branchId, branches }) => {
    const [activeView, setActiveView] = useState<'overview' | 'accounts' | 'master' | 'audit' | 'expenditure'>('overview');
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

            const [finRes, structRes, ledgerRes, gradeRes, healthRes, protocolRes, ruleRes, readinessRes, projectionRes, masterRes] = await Promise.all([
                supabase.rpc('get_finance_overview_stats_v2', { p_branch_id: bid }),
                structQuery,
                supabase.rpc('get_student_fee_summary_all', { p_branch_id: bid }),
                supabase.rpc('get_grade_wise_collection_stats', { p_branch_id: bid }),
                supabase.rpc('get_institutional_health_index', { p_branch_id: bid }),
                supabase.from('finance_payment_protocols').select('*').eq('branch_id', bid),
                supabase.from('finance_adjustment_rules').select('*').eq('branch_id', bid),
                supabase.rpc('fn_calculate_finance_readiness', { p_branch_id: bid }),
                supabase.rpc('get_financial_projection_matrix', { p_branch_id: bid }),
                supabase.rpc('get_finance_master_state', { p_branch_id: bid })
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
                burn_rate_stability: healthRes.data?.burn_rate_stability || 0
            });
            setFeeStructures(structRes.data || []);
            setStudentLedgers(Array.isArray(ledgerRes.data) ? ledgerRes.data : []);
            setGradeStats(Array.isArray(gradeRes.data) ? gradeRes.data : []);
            setPaymentProtocols(protocolRes.data || []);
            setAdjustmentRules(ruleRes.data || []);
            setInstitutionalReadiness(readinessRes.data);
            setProjections(projectionRes.data);
            setMasterState(masterRes.data);

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
            {/* Executive Header Layer */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-12 pt-6">
                <div className="space-y-6">
                    <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-4">
                        <span className="hover:text-primary cursor-pointer transition-colors" onClick={() => setActiveView('overview')}>Finance Center</span>
                        <span className="opacity-40">/</span>
                        <span className="text-primary/60 capitalize">{activeView}</span>
                    </nav>
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
                                onClick={() => setIsProcessGuideOpen(true)}
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
                    <TabButton id="expenditure" label="Expenditure" icon={<TrendingUpCustomIcon className="w-4 h-4 rotate-180" />} isActive={activeView === 'expenditure'} onClick={setActiveView} />

                    {(profile.role?.toLowerCase()?.includes('admin') || profile.role?.toLowerCase() === 'accountant') && (
                        <>
                            <TabButton id="master" label="Master Control" icon={<ShieldCheckIcon className="w-4 h-4" />} isActive={activeView === 'master'} onClick={setActiveView} />
                            <TabButton id="audit" label="Audit Logs" icon={<ActivityIcon className="w-4 h-4" />} isActive={activeView === 'audit'} onClick={setActiveView} />
                        </>
                    )}
                </div>
            </div>

            {/* Governance Protocol Banner - Readiness Layer */}
            {!readiness.isSetupComplete && !loading && !error && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative p-8 rounded-[2.5rem] bg-gradient-to-r from-amber-500/10 via-amber-500/[0.05] to-transparent border border-amber-500/20 shadow-2xl overflow-hidden group"
                >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 p-12 opacity-[0.05] group-hover:scale-110 transition-transform duration-1000">
                        <ShieldCheckIcon className="w-32 h-32 text-amber-500" />
                    </div>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-10 relative z-10">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-amber-500/20 rounded-2xl border border-amber-500/20 animate-pulse">
                                <AlertTriangleIcon className="w-6 h-6 text-amber-500" />
                            </div>
                            <div>
                                <h4 className="text-xl font-serif font-black text-amber-500 uppercase tracking-tight">Institutional Finance Setup Required</h4>
                                <div className="flex flex-wrap gap-4 mt-2">
                                    {readiness.missingSteps.map((step, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500/40"></div>
                                            <span className="text-[10px] font-black uppercase text-amber-500/60 tracking-widest">{step}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setActiveView('master')}
                            className="px-8 py-3.5 bg-amber-500 text-black font-black text-[10px] uppercase tracking-[0.3em] rounded-xl hover:bg-amber-400 transition-all flex items-center gap-3 active:scale-95 shadow-xl shadow-amber-900/20"
                        >
                            Initialize Master Setup <ArrowRightIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
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

                        {(error.includes('ambiguous') || error.includes('function') || error.includes('schema') || error.includes('Reference')) && (
                            <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-6">
                                <div>
                                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2">Required Admin Action</p>
                                    <p className="text-sm font-mono text-white/80">Execute <span className="text-white font-bold select-all">FIX_FINANCE_TAB_GLOBAL_REPAIR_V7.sql</span></p>
                                </div>
                                <button
                                    onClick={() => navigator.clipboard.writeText('FIX_FINANCE_TAB_GLOBAL_REPAIR_V7.sql')}
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
                                    onExport={() => { }}
                                    onSelectAccount={(acc) => setSelectedStudent(acc)}
                                    viewFilter={accountViewFilter}
                                />
                            )}
                        </motion.div>
                    )}

                    {activeView === 'master' && (
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                            <FinanceMaster
                                feeStructures={feeStructures}
                                paymentProtocols={paymentProtocols}
                                adjustmentRules={adjustmentRules}
                                onNewStructure={() => setIsWizardOpen(true)}
                                onEditStructure={(fs) => {
                                    setEditingStructure(fs);
                                    setIsWizardOpen(true);
                                }}
                                onNewProtocol={() => setIsProtocolModalOpen(true)}
                                onNewRule={() => setIsRuleModalOpen(true)}
                                currency={viewCurrency}
                                branchId={branchId}
                                onUpdate={() => fetchAllData(true)}
                                readiness={institutionalReadiness || readiness}
                                masterState={masterState}
                            />
                        </motion.div>
                    )}

                    {activeView === 'audit' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <FinanceAudit branchId={branchId || null} />
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
                {isProcessGuideOpen && (
                    <FinanceProcessGuide onClose={() => setIsProcessGuideOpen(false)} />
                )}
            </AnimatePresence>
        </div>
    );
};

export default FinanceTab;
