
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase, formatError } from '../../services/supabase';
import { StudentFeeSummary, CurrencyCode } from '../../types';
import Spinner from '../common/Spinner';
import { ChevronLeftIcon } from '../icons/ChevronLeftIcon';
import { ReceiptIcon } from '../icons/ReceiptIcon';
import RecordPaymentModal from './RecordPaymentModal';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { RefreshCwIcon } from '../icons/RefreshCwIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { MailIcon } from '../icons/MailIcon';
import { PrinterIcon } from '../icons/PrinterIcon';
import { TrendingUpCustomIcon } from '../icons/TrendingUpIcon';
import { SearchIcon } from '../icons/SearchIcon';
import { ShieldCheckIcon, ShieldCheckIcon as SecurityIcon } from '../icons/ShieldCheckIcon';
import { CreditCardIcon } from '../icons/CreditCardIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import { ArrowRightIcon } from '../icons/ArrowRightIcon';
import { BookIcon } from '../icons/BookIcon';
import { WorkflowIcon } from '../icons/WorkflowIcon';
import PremiumAvatar from '../common/PremiumAvatar';
import { motion } from 'framer-motion';
import { GoogleGenerativeAI } from '@google/generative-ai';

const formatCurrency = (amount: number, currency: CurrencyCode = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0
    }).format(amount || 0);
};

interface StudentFinanceDetailViewProps {
    student: StudentFeeSummary;
    viewCurrency: CurrencyCode;
    onBack: () => void;
    onUpdate: () => void;
    onNavigateToMaster: () => void;
}

const StatCard: React.FC<{
    title: string;
    value: string;
    subValue?: string;
    icon: React.ReactNode;
    variant: 'neutral' | 'success' | 'warning' | 'danger';
}> = ({ title, value, subValue, icon, variant }) => {
    const variants = {
        neutral: 'bg-white/[0.02] border-white/5 text-white',
        success: 'bg-emerald-500/[0.03] border-emerald-500/10 text-emerald-400',
        warning: 'bg-amber-500/[0.03] border-amber-500/10 text-amber-400',
        danger: 'bg-red-500/[0.03] border-red-500/10 text-red-400',
    };

    const glows = {
        neutral: 'group-hover:bg-white/10',
        success: 'group-hover:bg-emerald-500/10',
        warning: 'group-hover:bg-amber-500/10',
        danger: 'group-hover:bg-red-500/10',
    };

    return (
        <div className={`p-8 rounded-[2.5rem] border flex flex-col justify-between group hover:-translate-y-1 transition-all duration-500 relative overflow-hidden shadow-2xl ${variants[variant]}`}>
            <div className={`absolute -right-4 -top-4 w-24 h-24 blur-3xl rounded-full transition-all duration-1000 ${glows[variant]}`}></div>
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                    <div className="p-3.5 bg-white/[0.03] rounded-2xl shadow-inner border border-white/5 group-hover:scale-110 transition-transform duration-500">
                        {icon}
                    </div>
                    {subValue && <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-40 px-2.5 py-1 bg-white/[0.03] rounded-lg border border-white/5">{subValue}</span>}
                </div>
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.4em] opacity-30 mb-2">{title}</p>
                    <h3 className="text-3xl font-serif font-black tracking-tighter leading-none">{value}</h3>
                </div>
            </div>
        </div>
    );
};

const PaymentTrendChart: React.FC<{ ledger: any[] }> = ({ ledger }) => {
    const monthlyData = useMemo(() => {
        const data = new Array(12).fill(0);
        ledger.forEach(l => {
            if (Number(l.credit) > 0) {
                const month = new Date(l.transaction_date).getMonth();
                data[month] += Number(l.credit);
            }
        });
        return data;
    }, [ledger]);

    const max = Math.max(...monthlyData, 1);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    return (
        <div className="h-full flex flex-col justify-end">
            <div className="flex justify-between items-end h-48 gap-3 px-4">
                {monthlyData.map((val, i) => (
                    <div key={i} className="flex-1 flex flex-col justify-end group cursor-pointer relative">
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${(val / max) * 100}%` }}
                            transition={{ duration: 1, delay: i * 0.05, ease: 'circOut' }}
                            className="bg-primary/20 group-hover:bg-primary transition-all rounded-t-lg w-full relative min-h-[4px] shadow-[0_0_20px_rgba(59,130,246,0.1)] group-hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                        >
                            <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg"></div>
                        </motion.div>
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-black border border-white/10 text-[9px] font-black text-white px-3 py-1.5 rounded-xl shadow-2xl z-20 whitespace-nowrap transition-all scale-90 group-hover:scale-100">
                            {formatCurrency(val)}
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex justify-between px-4 border-t border-white/5 mt-6 pt-4">
                {months.map((m, i) => (
                    <span key={i} className="text-[8px] font-black text-white/20 uppercase w-full text-center tracking-widest">{m}</span>
                ))}
            </div>
        </div>
    );
}

const StudentFinanceDetailView: React.FC<StudentFinanceDetailViewProps> = ({ student: initialStudent, viewCurrency, onBack, onUpdate, onNavigateToMaster }) => {
    const [accountData, setAccountData] = useState<any>(initialStudent);
    const [ledger, setLedger] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [assignedStructure, setAssignedStructure] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');
    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [mappingInProgress, setMappingInProgress] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [availableCycles, setAvailableCycles] = useState<any[]>([]);
    const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
    const [showCycleSelector, setShowCycleSelector] = useState(false);

    const isMounted = useRef(true);

    const refreshAccountStatus = useCallback(async (isSilent = false) => {
        if (!isMounted.current) return;
        if (!isSilent) setLoading(true);
        setError(null);
        try {
            // 1. Fetch Core Financial Node
            const { data: nodeData, error: nodeError } = await supabase.rpc('get_student_financial_node', {
                p_student_id: initialStudent.student_id,
                p_cycle_id: selectedCycleId
            });
            if (nodeError) throw nodeError;
            if (nodeData && nodeData[0]) {
                const node = nodeData[0];
                setAccountData(node);
                if (selectedCycleId === null) setSelectedCycleId(node.academic_cycle_id);
            }

            // 2. Fetch Forensic Ledger
            const { data: ledgerData, error: ledgerError } = await supabase.rpc('get_student_running_ledger', {
                p_student_id: initialStudent.student_id,
                p_cycle_id: selectedCycleId || nodeData?.[0]?.academic_cycle_id
            });
            if (ledgerError) throw ledgerError;
            setLedger(ledgerData || []);

            // 3. Fetch Metadata
            const { data: structData } = await supabase
                .from('student_fee_assignments')
                .select('*, fee_structures(*)')
                .eq('student_id', initialStudent.student_id)
                .maybeSingle();

            setAssignedStructure(structData?.fee_structures || null);

            // Fetch Available Cycles if not yet loaded
            if (availableCycles.length === 0 && nodeData?.[0]?.branch_id) {
                const { data: cycles } = await supabase.rpc('get_branch_academic_cycles', {
                    p_branch_id: nodeData[0].branch_id
                });
                setAvailableCycles(cycles || []);
            }

            // 4. Fetch Governance Artifacts
            const { data: auditData } = await supabase
                .from('finance_governance_audit')
                .select('*')
                .ilike('description', `%${initialStudent.student_id}%`)
                .order('created_at', { ascending: false })
                .limit(5);

            setAuditLogs(auditData || []);

            // 5. Initialize AI Oracle (with safety guard)
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (apiKey && apiKey !== 'YOUR_GEMINI_API_KEY') {
                try {
                    const genAI = new GoogleGenerativeAI(apiKey);
                    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

                    const prompt = `Analyze this student's financial state: 
                    Billed: ${nodeData[0].total_billed}, 
                    Paid: ${nodeData[0].total_paid}, 
                    Outstanding: ${nodeData[0].outstanding_balance}, 
                    Integrity: ${nodeData[0].integrity_score}%.
                    Provide a one-sentence professional financial insight for a school administrator.`;

                    const result = await model.generateContent(prompt);
                    const response = await result.response;
                    setAiInsight(response.text());
                } catch (err) {
                    console.warn('AI Oracle failed to initialize:', err);
                    setAiInsight("AUTOMATED_INSIGHT_DEFERRED: SEC_NODE_OFFLINE");
                }
            } else {
                setAiInsight("AI_ORACLE_PENDING_CONFIG: PROVIDE_API_KEY");
            }

        } catch (err) {
            console.error("Registry Desync:", err);
            setError(formatError(err));
        } finally {
            if (isMounted.current) {
                setLoading(false);
                setIsSyncing(false);
            }
        }
    }, [initialStudent.student_id]);

    const handleMapGenesisProtocol = async () => {
        setMappingInProgress(true);
        setError(null);
        try {
            const { data, error: rpcError } = await supabase.rpc('admin_sync_student_billing', {
                p_student_id: initialStudent.student_id
            });
            if (rpcError) throw rpcError;

            if (data?.success) {
                // Flash success state then refresh
                await refreshAccountStatus(true);
                if (onUpdate) onUpdate();
            } else {
                throw new Error(data?.message || 'Failed to synchronize GENESIS_PROTOCOL');
            }
        } catch (err: any) {
            console.error("Mapping failure:", err);
            setError(formatError(err));
        } finally {
            setMappingInProgress(false);
        }
    };

    const handleManualSync = async () => {
        setIsSyncing(true);
        await refreshAccountStatus(true);
    };

    useEffect(() => {
        isMounted.current = true;
        refreshAccountStatus();
        return () => { isMounted.current = false; };
    }, [refreshAccountStatus, selectedCycleId]);

    const filteredLedger = useMemo(() => {
        return ledger.filter(item => {
            const matchesSearch = !searchQuery ||
                (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (item.identifier && item.identifier.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesFilter = filterType === 'ALL' ||
                (filterType === 'PAID' && Number(item.credit) > 0) ||
                (filterType === 'PENDING' && Number(item.debit) > 0);

            return matchesSearch && matchesFilter;
        });
    }, [ledger, searchQuery, filterType]);

    // Financial calculations
    const totalAssigned = accountData.total_billed || 0;
    const totalPaid = accountData.total_paid || 0;
    const outstanding = accountData.outstanding_balance || 0;
    const recoveryRate = totalAssigned > 0 ? (totalPaid / totalAssigned) * 100 : 0;

    if (loading) return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="flex flex-col items-center gap-6">
                <Spinner />
                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.6em] animate-pulse">Synchronizing Student Nodes...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-12 overflow-hidden relative">
            {/* Background Glows */}
            <div className="absolute top-0 left-0 w-full h-full">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-500/5 blur-[120px] rounded-full"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-[#12141c]/60 border border-red-500/20 p-16 lg:p-24 rounded-[4rem] text-center max-w-3xl backdrop-blur-3xl shadow-[0_50px_100px_rgba(0,0,0,0.8)] relative z-10"
            >
                <div className="inline-flex items-center justify-center w-24 h-24 bg-red-500/10 rounded-[2.5rem] border border-red-500/20 mb-12 shadow-inner group">
                    <AlertTriangleIcon className="w-10 h-10 text-red-500 animate-pulse" />
                </div>

                <h2 className="text-[10px] font-black text-red-500 uppercase tracking-[0.8em] mb-6">Critical System Desync</h2>
                <h3 className="text-4xl lg:text-6xl font-serif font-black text-white uppercase tracking-tighter leading-none mb-10">Registry Error</h3>

                <div className="bg-black/40 border border-white/5 rounded-[2rem] p-10 mb-16 text-left relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-[0.03]">
                        <SecurityIcon className="w-24 h-24" />
                    </div>
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-4 italic">Diagnostic Trace:</p>
                    <p className="text-lg font-mono font-medium text-white/60 leading-relaxed">
                        {error.includes('ambiguous')
                            ? "CONFLICT_DETECTED: Multiple node identifiers resolved in the global registry. The structural identity of the student node cannot be determined."
                            : error}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full sm:w-auto px-12 py-5 bg-white text-black hover:bg-red-500 hover:text-white transition-all rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.4em] shadow-2xl active:scale-95"
                    >
                        Retry Protocol
                    </button>
                    <button
                        onClick={onBack}
                        className="w-full sm:w-auto px-12 py-5 bg-white/5 border border-white/5 text-white/40 hover:text-white transition-all rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.4em]"
                    >
                        Abort Handshake
                    </button>
                </div>
            </motion.div>
        </div>
    );

    if (!accountData) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen bg-[#0a0a0c] text-white p-6 lg:p-12 font-sans selection:bg-primary selection:text-white"
        >
            <div className="max-w-[1600px] mx-auto space-y-12">
                {/* Layer 0 – Identity Navigation & Cycle Selector */}
                <div className="flex items-center justify-between relative z-50">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-4 text-white/30 hover:text-white transition-all group"
                    >
                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center group-hover:bg-white/10 group-hover:border-white/20 transition-all">
                            <ArrowRightIcon className="w-5 h-5 rotate-180" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Registry Exit</span>
                    </button>

                    <div className="flex items-center gap-6 relative">
                        <div className="text-right hidden sm:block">
                            <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">Observation Plane</p>
                            <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">{accountData.cycle_name || 'LOADING_CYCLE...'}</p>
                        </div>
                        <button
                            onClick={() => setShowCycleSelector(!showCycleSelector)}
                            className="flex items-center gap-4 bg-white/5 px-6 py-3 rounded-2xl border border-white/5 hover:border-primary/40 transition-all"
                        >
                            <div className={`w-2 h-2 rounded-full ${accountData.is_active ? 'bg-emerald-500' : 'bg-amber-500'} shadow-[0_0_10px_rgba(16,185,129,0.5)]`}></div>
                            <span className="text-[9px] font-black text-white uppercase tracking-widest">{accountData.cycle_name || 'SELECT_CYCLE'}</span>
                            <ChevronLeftIcon className="w-4 h-4 -rotate-90 text-white/20" />
                        </button>

                        {showCycleSelector && (
                            <div className="absolute top-full mt-4 right-0 w-64 bg-[#12141c] border border-white/10 rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] p-4 space-y-2 overflow-hidden backdrop-blur-3xl">
                                {availableCycles.map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => { setSelectedCycleId(c.id); setShowCycleSelector(false); }}
                                        className={`w-full text-left px-6 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedCycleId === c.id ? 'bg-primary text-white' : 'text-white/40 hover:bg-white/5'}`}
                                    >
                                        {c.year_name} {c.is_current && "(Active)"}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Layer 1 – Institutional Student Header (BLOCK 1) */}
                <div className="bg-white/[0.02] border border-white/5 rounded-[4rem] p-12 lg:p-20 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-24 opacity-[0.03] group-hover:scale-110 transition-transform duration-[3000ms] -rotate-12">
                        <TrendingUpCustomIcon className="w-96 h-96 text-primary" />
                    </div>

                    <div className="flex flex-col lg:flex-row items-center gap-16 relative z-10">
                        <div className="relative">
                            <div className="absolute -inset-4 bg-primary/20 blur-3xl rounded-full opacity-40 animate-pulse"></div>
                            <PremiumAvatar
                                src={accountData.profile_photo_url}
                                name={accountData.display_name}
                                size="lg"
                                className="w-48 h-48 rounded-[3.5rem] border-2 border-white/10 ring-8 ring-white/5 shadow-3xl"
                            />
                            <StatusBadge status={accountData.ledger_status} className="absolute -bottom-4 left-1/2 -translate-x-1/2" />
                        </div>

                        <div className="flex-1 text-center lg:text-left">
                            <h1 className="text-5xl lg:text-7xl font-serif font-black text-white uppercase tracking-tighter leading-none mb-6 group-hover:translate-x-2 transition-transform duration-700">
                                {accountData.display_name}
                            </h1>
                            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-10 gap-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-primary/40"></div>
                                    <p className="text-[11px] text-white/40 font-black uppercase tracking-[0.3em]">Protocol: <span className="text-white/80">{assignedStructure?.name || 'GENESIS_PROTOCOL'}</span></p>
                                </div>
                                <div className="w-1.5 h-1.5 rounded-full bg-white/10"></div>
                                <p className="text-[11px] text-white/40 font-black uppercase tracking-[0.3em]">Section: <span className="text-white/80">{accountData.class_name || 'UNASSIGNED'}</span></p>
                                <div className="w-1.5 h-1.5 rounded-full bg-white/10"></div>
                                <p className="text-[11px] text-white/40 font-black uppercase tracking-[0.3em]">Grade: <span className="text-white/80">{accountData.grade || 'N/A'}</span></p>
                                <div className="w-1.5 h-1.5 rounded-full bg-white/10"></div>
                                <p className="text-[11px] text-white/40 font-black uppercase tracking-[0.3em]">Health: <span className={accountData.integrity_score > 80 ? "text-emerald-400" : "text-amber-400"}>{accountData.integrity_score}%</span></p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={handleManualSync}
                                disabled={isSyncing}
                                className="p-5 bg-white/5 border border-white/5 hover:bg-white/10 rounded-3xl text-white/40 hover:text-white transition-all group/sync disabled:opacity-50"
                            >
                                <RefreshCwIcon className={`w-6 h-6 group-hover/sync:rotate-180 transition-transform duration-700 ${isSyncing ? 'animate-spin' : ''}`} />
                            </button>
                            <button className="px-10 py-5 bg-white text-black hover:bg-primary hover:text-white transition-all rounded-3xl font-black text-[11px] uppercase tracking-widest shadow-2xl active:scale-95 text-center px-8">Statement_PDF</button>
                        </div>
                    </div>
                </div>

                {/* Layer 2 – Registry KPIs Cluster */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    <StatCard
                        title="Billed Magnitude"
                        value={formatCurrency(totalAssigned, viewCurrency)}
                        subValue="Gross Liability Node"
                        icon={<ActivityIcon className="w-6 h-6" />}
                        variant="neutral"
                    />
                    <StatCard
                        title="Settled Capital"
                        value={formatCurrency(totalPaid, viewCurrency)}
                        subValue={`${recoveryRate.toFixed(1)}% Recovery Velocity`}
                        icon={<ShieldCheckIcon className="w-6 h-6" />}
                        variant="success"
                    />
                    <StatCard
                        title="Net Exposure"
                        value={formatCurrency(outstanding, viewCurrency)}
                        subValue={outstanding > 0 ? "ACTION_REQUIRED" : "LIQUIDITY_SECURED"}
                        icon={<AlertTriangleIcon className="w-6 h-6" />}
                        variant={outstanding > 0 ? "warning" : "success"}
                    />
                    <StatCard
                        title="Unallocated Funds"
                        value={formatCurrency(accountData.unallocated_funds || 0, viewCurrency)}
                        subValue={(accountData.unallocated_funds > 0) ? "CREDIT_AVAILABLE" : "NET_ZERO_BALANCE"}
                        icon={<CreditCardIcon className="w-6 h-6" />}
                        variant={(accountData.unallocated_funds > 0) ? "success" : "neutral"}
                    />
                </div>

                {/* Layer 3 – Institutional Fee Protocol & Flow Map */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
                    {/* Assigned Protocol Card */}
                    <div className="xl:col-span-2 bg-[#12141c]/60 border border-white/5 rounded-[4rem] p-12 backdrop-blur-3xl shadow-3xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-16 opacity-[0.02] group-hover:scale-110 transition-transform">
                            <BookIcon className="w-64 h-64 text-primary" />
                        </div>

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-10 mb-16 relative z-10">
                            <div>
                                <div className="flex items-center gap-4 mb-3">
                                    <span className="px-3 py-1 bg-primary/10 text-primary text-[9px] font-black uppercase tracking-[0.2em] rounded-lg border border-primary/20">Protocol Node</span>
                                    <span className="text-[10px] text-white/20 font-black uppercase tracking-widest italic">{assignedStructure?.academic_year || 'v25.0 Deployment'}</span>
                                </div>
                                <h3 className="text-4xl font-serif font-black text-white uppercase tracking-tighter group-hover:text-primary transition-colors">
                                    {assignedStructure?.name || 'GENESIS_PROTOCOL'}
                                </h3>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mb-4">Node Valuation</p>
                                <p className="text-4xl font-serif font-black text-white italic tracking-tighter">
                                    {formatCurrency(assignedStructure?.components?.reduce((a: any, c: any) => a + Number(c.amount), 0) || totalAssigned, viewCurrency)}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                            {assignedStructure ? (
                                (assignedStructure.components || []).map((comp: any, i: number) => (
                                    <div key={i} className="bg-white/[0.03] border border-white/5 p-8 rounded-[2.5rem] flex flex-col gap-6 hover:bg-white/[0.05] transition-all group/node">
                                        <div className="flex justify-between items-center">
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover/node:bg-primary group-hover/node:text-black transition-all">
                                                <WorkflowIcon className="w-5 h-5" />
                                            </div>
                                            <div className={`w-2 h-2 rounded-full ${totalPaid >= comp.amount ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-amber-500/40'}`}></div>
                                        </div>
                                        <div>
                                            <p className="text-xl font-serif font-black text-white tracking-tighter uppercase mb-1">{comp.name}</p>
                                            <p className="text-sm font-mono font-black text-white/40">{formatCurrency(comp.amount, viewCurrency)}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-1 md:col-span-2 lg:col-span-3 py-16 text-center bg-white/[0.01] border border-dashed border-white/10 rounded-[3rem] group/init overflow-hidden relative">
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover/init:opacity-100 transition-opacity"></div>
                                    <div className="relative z-10 flex flex-col items-center gap-8">
                                        <div className="p-6 bg-white/5 rounded-[2rem] border border-white/10 shadow-inner group-hover/init:scale-110 transition-transform duration-700">
                                            <WorkflowIcon className="w-12 h-12 text-white/20 group-hover/init:text-primary transition-colors" />
                                        </div>
                                        <div className="space-y-4">
                                            <h4 className="text-2xl font-serif font-black text-white uppercase tracking-tight">Node Unmapped</h4>
                                            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] max-w-md mx-auto leading-loose">
                                                This student node is currently in standby. Initialize the GENESIS_PROTOCOL to map institutional fees based on their current grade profile.
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleMapGenesisProtocol}
                                            disabled={mappingInProgress}
                                            className="px-12 py-5 bg-primary text-white hover:bg-white hover:text-black transition-all rounded-[2rem] font-black text-[11px] uppercase tracking-[0.4em] shadow-2xl relative overflow-hidden group/btn disabled:opacity-50"
                                        >
                                            {mappingInProgress ? (
                                                <span className="flex items-center gap-4">
                                                    <RefreshCwIcon className="w-4 h-4 animate-spin" /> SYNCHRONIZING_MATRIX...
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-4">
                                                    MAP GENESIS_PROTOCOL <ArrowRightIcon className="w-4 h-4 group-hover/btn:translate-x-2 transition-transform" />
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-12 pt-12 border-t border-white/5 flex justify-between items-center relative z-10">
                            <div className="flex gap-10">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-white/10 uppercase tracking-widest">Protocol Integrity</p>
                                    <p className={`text-xs font-black uppercase tracking-[0.3em] ${accountData.is_standby ? 'text-amber-500' : 'text-emerald-500'}`}>
                                        {accountData.is_standby ? 'STANDBY_MODE' : 'SYNCHRONIZED'}
                                    </p>
                                </div>
                                {assignedStructure && (
                                    <button
                                        onClick={handleMapGenesisProtocol}
                                        disabled={mappingInProgress}
                                        className="flex items-center gap-3 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all group/remap disabled:opacity-50"
                                    >
                                        <RefreshCwIcon className={`w-3.5 h-3.5 text-white/40 group-hover/remap:text-primary transition-colors ${mappingInProgress ? 'animate-spin' : ''}`} />
                                        <span className="text-[9px] font-black text-white/40 group-hover/remap:text-white uppercase tracking-widest">Remap Matrix</span>
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Version: <span className="text-white/40">{assignedStructure?.version_label || 'v1.0.0'}</span></p>
                                <button className="flex items-center gap-3 text-[10px] font-black text-white/40 hover:text-white uppercase tracking-[0.4em] transition-all underline underline-offset-8 decoration-primary/40">
                                    Full Matrix <ArrowRightIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Financial Velocity Flow Map */}
                    <div className="bg-primary/5 border border-primary/20 rounded-[4rem] p-12 relative overflow-hidden group shadow-3xl">
                        <div className="absolute -right-20 -bottom-20 opacity-[0.03] group-hover:scale-125 transition-transform duration-[4000ms]">
                            <ActivityIcon className="w-96 h-96 text-primary" />
                        </div>

                        <div className="relative z-10 h-full flex flex-col">
                            <div className="mb-12">
                                <h4 className="text-2xl font-serif font-black text-white uppercase tracking-tight">Financial Velocity Flow</h4>
                                <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.4em] mt-3">Active Reconciliation Trajectory</p>
                            </div>

                            <div className="flex-1 space-y-10 relative">
                                <div className="absolute left-6 top-0 bottom-0 w-[2px] bg-gradient-to-b from-primary via-emerald-500/40 to-white/5"></div>

                                {[
                                    { step: 'Billing Initiated', status: 'COMPLETED', date: 'Cycle Start', icon: <ReceiptIcon className="w-4 h-4" />, color: 'bg-primary' },
                                    { step: 'Payment Received', status: totalPaid > 0 ? 'ACTIVE' : 'PENDING', date: totalPaid > 0 ? 'Last Tx: 2 Days Ago' : 'Awaiting Settlement', icon: <CreditCardIcon className="w-4 h-4" />, color: totalPaid > 0 ? 'bg-emerald-500' : 'bg-white/10' },
                                    { step: 'Ledger Reconciled', status: totalPaid >= totalAssigned ? 'VERIFIED' : 'WAITING', date: totalPaid >= totalAssigned ? 'Fully Settled' : 'Pending Fulfillment', icon: <ShieldCheckIcon className="w-4 h-4" />, color: totalPaid >= totalAssigned ? 'bg-emerald-500' : 'bg-white/5' },
                                    { step: 'Integrity Locked', status: accountData.integrity_score > 90 ? 'LOCKED' : 'OPEN', date: 'Registry Immutable', icon: <WorkflowIcon className="w-4 h-4" />, color: accountData.integrity_score > 90 ? 'bg-emerald-500' : 'bg-white/5' }
                                ].map((node, i) => (
                                    <div key={i} className="flex gap-10 items-start relative z-10 group/flow">
                                        <div className={`w-12 h-12 rounded-[1.25rem] ${node.color} flex items-center justify-center text-black shadow-2xl transition-all duration-500 group-hover/flow:scale-110`}>
                                            {node.icon}
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-black text-white uppercase tracking-tighter leading-none mb-2">{node.step}</p>
                                            <p className={`text-[9px] font-black uppercase tracking-widest ${node.status === 'COMPLETED' || node.status === 'ACTIVE' || node.status === 'VERIFIED' ? 'text-emerald-500' : 'text-white/20'}`}>{node.status}</p>
                                            <p className="text-[8px] font-medium text-white/20 uppercase mt-2 tracking-[0.2em] italic">{node.date}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-12 p-6 bg-white/[0.03] border border-white/5 rounded-3xl">
                                <div className="flex justify-between items-center mb-4">
                                    <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">Collection Velocity</p>
                                    <p className="text-xl font-serif font-black text-emerald-500 italic">{(recoveryRate).toFixed(1)}%</p>
                                </div>
                                <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${recoveryRate}%` }}
                                        transition={{ duration: 1.5, ease: 'circOut' }}
                                        className="h-full bg-gradient-to-r from-primary to-emerald-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Layer 4 – Intelligence & Integrity Matrix */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    <div className="bg-primary/10 border border-primary/20 rounded-[4rem] p-12 relative overflow-hidden group shadow-3xl">
                        <div className="absolute top-0 right-0 p-16 opacity-[0.05] group-hover:scale-125 transition-transform duration-[3000ms]">
                            <SparklesIcon className="w-64 h-64 text-primary" />
                        </div>
                        <div className="relative z-10 space-y-8">
                            <div className="flex items-center gap-5">
                                <div className="p-4 bg-primary rounded-2xl text-white shadow-2xl">
                                    <SparklesIcon className="w-6 h-6" />
                                </div>
                                <h3 className="text-2xl font-serif font-black text-white uppercase tracking-tight">Financial Intelligence Oracle</h3>
                            </div>
                            <p className="text-2xl font-serif italic text-white/80 leading-snug tracking-tight border-l-4 border-primary/40 pl-8 py-2">
                                {aiInsight || "Synchronizing with the neural financial node..."}
                            </p>
                        </div>
                    </div>

                    <div className="bg-[#12141c]/60 border border-white/5 rounded-[4rem] p-12 backdrop-blur-3xl shadow-3xl relative overflow-hidden group">
                        <div className="absolute -bottom-10 -right-10 opacity-[0.02] group-hover:scale-110 transition-transform duration-1000">
                            <SecurityIcon className="w-80 h-80 text-emerald-500" />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="flex items-center justify-between mb-10">
                                <div>
                                    <h4 className="text-2xl font-serif font-black text-white uppercase tracking-tight">Institutional Integrity Node</h4>
                                    <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mt-2">Compliance & Reliability Index</p>
                                </div>
                                <div className="text-6xl font-serif font-black text-emerald-500 drop-shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                                    {accountData.integrity_score}%
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="bg-white/[0.03] border border-white/5 p-6 rounded-[2rem] space-y-2">
                                    <p className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest">Payment Probability</p>
                                    <p className="text-lg font-serif font-black text-white uppercase">{accountData.integrity_score > 90 ? 'ULTRA_HIGH' : accountData.integrity_score > 70 ? 'HIGH' : 'MODERATE'}</p>
                                </div>
                                <div className="bg-white/[0.03] border border-white/5 p-6 rounded-[2rem] space-y-2">
                                    <p className="text-[9px] font-black text-primary/60 uppercase tracking-widest">Registry Stability</p>
                                    <p className="text-lg font-serif font-black text-white uppercase">ACTIVE_PROTOCOL</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Layer 4 – Forensic Ledger Execution */}
                <div className="bg-[#12141c]/60 border border-white/5 rounded-[4rem] shadow-3xl overflow-hidden backdrop-blur-3xl">
                    <div className="p-10 lg:p-14 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                        <div>
                            <h3 className="text-3xl font-serif font-black text-white uppercase tracking-tight">Deep Ledger Registry</h3>
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] mt-3">Full Transactional Audit & Historical Vector Stream</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="relative group">
                                <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="text"
                                    placeholder="SEARCH TRANSACTION..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-14 pr-8 py-4 bg-black/40 border border-white/5 rounded-2xl text-[10px] font-black text-white outline-none focus:border-primary/40 uppercase tracking-widest transition-all w-64"
                                />
                            </div>
                            <button className="px-8 py-4 bg-primary text-white hover:bg-primary/80 transition-all rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl active:scale-95">Record Settlement</button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left whitespace-nowrap">
                            <thead className="bg-black/40 text-[10px] font-black text-white/20 uppercase tracking-[0.4em] border-b border-white/5">
                                <tr>
                                    <th className="p-10 pl-14 font-black">Transaction Matrix</th>
                                    <th className="p-10 font-black">Event Identifier</th>
                                    <th className="p-10 font-black">Protocol Node</th>
                                    <th className="p-10 text-right font-black">Debit</th>
                                    <th className="p-10 text-right font-black">Credit</th>
                                    <th className="p-10 text-right pr-14 font-black">Running Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.03]">
                                {filteredLedger.length > 0 ? filteredLedger.map((item, i) => (
                                    <tr key={i} className="group hover:bg-white/[0.03] transition-all duration-300">
                                        <td className="p-10 pl-14">
                                            <div className="flex items-center gap-6">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${Number(item.debit) > 0 ? 'bg-amber-500/5 text-amber-500 border border-amber-500/10' : 'bg-emerald-500/5 text-emerald-500 border border-emerald-500/10'}`}>
                                                    {Number(item.debit) > 0 ? <AlertTriangleIcon className="w-5 h-5" /> : <ShieldCheckIcon className="w-5 h-5" />}
                                                </div>
                                                <div className="space-y-1.5">
                                                    <p className="text-base font-serif font-black text-white/90 group-hover:text-primary transition-colors">{item.description}</p>
                                                    <p className="text-[10px] text-white/25 font-black uppercase tracking-[0.2em]">{new Date(item.transaction_date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-10 font-mono text-[11px] text-white/30 uppercase tracking-tighter">
                                            <span className="bg-white/[0.03] px-4 py-2 rounded-xl border border-white/5">#{item.identifier || 'GEN_NODE_TX'}</span>
                                        </td>
                                        <td className="p-10">
                                            <span className="px-5 py-2 rounded-xl bg-white/5 border border-white/5 text-[10px] font-black uppercase text-white/40 tracking-widest">{item.protocol || 'STANDARD_CYCLE'}</span>
                                        </td>
                                        <td className="p-10 text-right text-lg font-black font-mono text-white/40 tracking-tighter">
                                            {Number(item.debit) > 0 ? formatCurrency(item.debit, viewCurrency) : '—'}
                                        </td>
                                        <td className="p-10 text-right text-lg font-black font-mono text-emerald-500 tracking-tighter drop-shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                                            {Number(item.credit) > 0 ? formatCurrency(item.credit, viewCurrency) : '—'}
                                        </td>
                                        <td className="p-10 text-right pr-14 text-xl font-serif font-black text-white tracking-tighter">
                                            {formatCurrency(item.running_balance, viewCurrency)}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="p-32 text-center">
                                            <div className="flex flex-col items-center gap-8 opacity-20">
                                                <ShieldCheckIcon className="w-24 h-24" />
                                                <p className="text-xl font-serif font-black uppercase tracking-[0.5em]">Ledger Node Quiet</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Registry Balance Summary Footer */}
                    <div className="p-12 lg:p-16 bg-white/[0.01] border-t border-white/5 flex flex-col xl:flex-row justify-between items-center gap-16 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none" />

                        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-16 relative z-10">
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Total Registry Debit</p>
                                <p className="text-3xl font-serif font-black text-white/60 tracking-tighter italic">{formatCurrency(totalAssigned, viewCurrency)}</p>
                            </div>
                            <div className="w-px h-12 bg-white/5"></div>
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Total Registry Credit</p>
                                <p className="text-3xl font-serif font-black text-emerald-500 tracking-tighter drop-shadow-[0_0_15px_rgba(16,185,129,0.3)] italic">{formatCurrency(totalPaid, viewCurrency)}</p>
                            </div>
                        </div>

                        <div className="bg-black/80 px-16 py-8 rounded-[3rem] border border-primary/20 shadow-3xl flex items-center gap-12 group hover:border-primary/40 transition-all relative z-10">
                            <div className="text-right space-y-2">
                                <p className="text-[11px] font-black text-primary/60 uppercase tracking-[0.5em] italic">Current Net Exposure</p>
                                <p className="text-4xl lg:text-5xl font-serif font-black text-white tracking-tighter drop-shadow-2xl">{formatCurrency(outstanding, viewCurrency)}</p>
                            </div>
                            <div className={`p-6 rounded-[2rem] transition-all duration-700 ${outstanding > 0 ? 'bg-amber-500/10 text-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.2)] rotate-12' : 'bg-emerald-500/10 text-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)]'}`}>
                                {outstanding > 0 ? <AlertTriangleIcon className="w-10 h-10 animate-pulse" /> : <ShieldCheckIcon className="w-10 h-10" />}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Layer 5 – Forensic Metadata & Communication Trace */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pb-24">
                    {/* Forensic Audit Logs Polish */}
                    <div className="bg-[#12141c]/60 border border-white/5 rounded-[4rem] p-12 lg:p-16 backdrop-blur-3xl shadow-3xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-16 opacity-[0.02] group-hover:scale-110 transition-transform duration-[3000ms]">
                            <ShieldCheckIcon className="w-72 h-72 text-primary" />
                        </div>

                        <div className="flex items-center gap-8 mb-16 relative z-10">
                            <div className="p-5 bg-primary/10 rounded-[2rem] text-primary border border-primary/20 shadow-inner">
                                <ShieldCheckIcon className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-3xl font-serif font-black text-white uppercase tracking-tight">Forensic Registry Trace</h3>
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mt-3 italic">Immutable Transactional Evidence Log</p>
                            </div>
                        </div>

                        <div className="space-y-6 relative z-10">
                            {auditLogs.length > 0 ? auditLogs.map((log, i) => (
                                <div key={i} className="flex items-center justify-between p-8 bg-white/[0.03] border border-white/5 rounded-[2.5rem] group/log cursor-default hover:bg-white/[0.05] hover:translate-x-3 transition-all duration-500">
                                    <div className="flex items-center gap-8">
                                        <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)] group-hover/log:scale-150 transition-transform"></div>
                                        <div className="space-y-2">
                                            <p className="text-[13px] font-black text-white/80 uppercase tracking-tight">{log.action_type || 'SYSTEM_NODE_EVENT'}</p>
                                            <p className="text-[10px] text-white/25 font-black uppercase tracking-widest">{new Date(log.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-mono font-black text-white/10 bg-white/[0.02] px-5 py-2.5 rounded-xl border border-white/5 group-hover/log:text-white/40 group-hover/log:border-white/20 transition-all">TXID_{log.id?.substring(0, 8).toUpperCase()}</span>
                                </div>
                            )) : (
                                <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-[3.5rem] bg-white/[0.01]">
                                    <p className="text-[11px] font-black text-white/10 uppercase tracking-[0.5em] italic leading-loose">No institutional artifacts archived for this node yet.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Operational Dispatch Logs */}
                    <div className="bg-[#12141c]/60 border border-white/5 rounded-[4rem] p-12 lg:p-16 backdrop-blur-3xl shadow-3xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-16 opacity-[0.02] group-hover:scale-110 transition-transform duration-[3000ms]">
                            <MailIcon className="w-72 h-72 text-emerald-500" />
                        </div>

                        <div className="flex items-center gap-8 mb-16 relative z-10">
                            <div className="p-5 bg-emerald-500/10 rounded-[2rem] text-emerald-500 border border-emerald-500/20 shadow-inner">
                                <MailIcon className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-3xl font-serif font-black text-white uppercase tracking-tight">Statement Dispatch Registry</h3>
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mt-3 italic">Communication Persistence Stream</p>
                            </div>
                        </div>

                        <div className="space-y-6 relative z-10">
                            {[
                                { type: 'Statement_Dispatch', date: '2023-11-01', channel: 'EMAIL_SMTP', status: 'CONFIRMED' },
                                { type: 'Arrears_Alert', date: '2023-10-15', channel: 'SMS_GATEWAY', status: 'DELIVERED' }
                            ].map((comm, i) => (
                                <div key={i} className="flex items-center justify-between p-8 bg-white/[0.02] border border-white/5 rounded-[2.5rem] group/comm hover:bg-white/[0.04] transition-all duration-500">
                                    <div className="flex items-center gap-8">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40"></div>
                                        <div className="space-y-2">
                                            <p className="text-[13px] font-black text-white/70 uppercase tracking-tight font-serif italic">{comm.type}</p>
                                            <p className="text-[10px] text-white/20 font-black uppercase tracking-widest">{comm.channel} • {new Date(comm.date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <span className="text-[9px] font-black text-emerald-500/60 bg-emerald-500/5 px-4 py-2 rounded-xl border border-emerald-500/10 uppercase tracking-widest group-hover/comm:bg-emerald-500/20 group-hover/comm:text-emerald-500 transition-all">{comm.status}</span>
                                </div>
                            ))}
                            <div className="pt-8">
                                <button className="w-full py-6 bg-white/5 hover:bg-white/10 border border-white/5 rounded-[2rem] text-[10px] font-black text-white/40 hover:text-white uppercase tracking-[0.5em] transition-all shadow-xl group/btn">
                                    <span className="flex items-center justify-center gap-4">
                                        Trigger Manual Dispatch Trace <ArrowRightIcon className="w-4 h-4 group-hover/btn:translate-x-2 transition-transform" />
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isPaymentModalOpen && (
                <RecordPaymentModal
                    studentId={accountData.student_id}
                    studentName={accountData.display_name}
                    onClose={() => setIsPaymentModalOpen(false)}
                    onSuccess={() => { setIsPaymentModalOpen(false); refreshAccountStatus(); onUpdate(); }}
                />
            )}
        </motion.div>
    );
};

const StatusBadge: React.FC<{ status: string, className?: string }> = ({ status, className }) => {
    const configs: Record<string, { color: string, glow: string }> = {
        'Draft': { color: 'bg-white/20 text-white', glow: 'shadow-[0_0_10px_rgba(255,255,255,0.1)]' },
        'Active': { color: 'bg-blue-500 text-white', glow: 'shadow-[0_0_15px_rgba(59,130,246,0.5)]' },
        'Partial': { color: 'bg-amber-500 text-black', glow: 'shadow-[0_0_15px_rgba(245,158,11,0.5)]' },
        'Paid': { color: 'bg-emerald-500 text-black', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.5)]' },
        'Overdue': { color: 'bg-red-500 text-white', glow: 'shadow-[0_0_15px_rgba(239,68,68,0.5)]' },
        'Archived': { color: 'bg-white/10 text-white/40', glow: '' }
    };

    const config = configs[status] || configs['Draft'];

    return (
        <div className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] ${config.color} ${config.glow} ${className}`}>
            {status}
        </div>
    );
};

export default StudentFinanceDetailView;