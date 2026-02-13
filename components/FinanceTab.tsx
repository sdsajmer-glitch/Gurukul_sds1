
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

import FinanceAuditLog from './finance/FinanceAuditLog';
import FinanceOverview from './finance/FinanceOverview';
import FinanceAccounts from './finance/FinanceAccounts';
import FinanceMaster from './finance/FinanceMaster';
import FinanceAudit from './finance/FinanceAudit';
import { StatsSkeleton, Skeleton } from './common/Skeleton';
import StudentFinanceDetailView from './finance/StudentFinanceDetailView';
import PremiumAvatar from './common/PremiumAvatar';
import FeeMasterWizard from './finance/FeeMasterWizard';

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
    const [accountViewFilter, setAccountViewFilter] = useState<string | undefined>(undefined);
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
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <FinanceOverview
                                data={financeData}
                                currency={viewCurrency}
                                onNavigate={(v, filter) => {
                                    setActiveView(v);
                                    if (filter) setAccountViewFilter(filter);
                                    else setAccountViewFilter(undefined);
                                }}
                                runOracle={runFinancialOracle}
                                aiInsight={aiInsight}
                                isAnalyzing={isAnalyzing}
                            />
                        </motion.div>
                    )}

                    {activeView === 'accounts' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <FinanceAccounts
                                accountsHost={studentLedgers}
                                currency={viewCurrency}
                                search={accountSearch}
                                onSearchChange={setAccountSearch}
                                riskOnly={riskOnly}
                                onRiskToggle={() => setRiskOnly(!riskOnly)}
                                onExport={handleExportRegistry}
                                onSelectAccount={(acc) => setSelectedStudent(acc)}
                                viewFilter={accountViewFilter}
                            />
                        </motion.div>
                    )}

                    {activeView === 'master' && (
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                            <FinanceMaster
                                feeStructures={feeStructures}
                                onNewStructure={() => setIsWizardOpen(true)}
                                onEditStructure={(fs) => {
                                    setEditingStructure(fs);
                                    setIsWizardOpen(true);
                                }}
                                currency={viewCurrency}
                            />
                        </motion.div>
                    )}

                    {activeView === 'audit' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <FinanceAudit branchId={branchId || null} />
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
