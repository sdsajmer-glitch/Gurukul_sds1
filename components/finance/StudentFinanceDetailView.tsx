
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
import PremiumAvatar from '../common/PremiumAvatar';
import { motion } from 'framer-motion';

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
    const [isResolving, setIsResolving] = useState(false);

    const isMounted = useRef(true);

    const refreshAccountStatus = useCallback(async (isSilent = false) => {
        if (!isMounted.current) return;
        if (!isSilent) setLoading(true);
        setError(null);
        try {
            // 1. Fetch Core Financial Node
            const { data: nodeData, error: nodeError } = await supabase.rpc('get_student_financial_node', {
                p_student_id: initialStudent.student_id
            });
            if (nodeError) throw nodeError;
            if (nodeData && nodeData[0]) setAccountData(nodeData[0]);

            // 2. Fetch Forensic Ledger
            const { data: ledgerData, error: ledgerError } = await supabase.rpc('get_student_running_ledger', {
                p_student_id: initialStudent.student_id
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

        } catch (err) {
            console.error("Registry Desync:", err);
            setError(formatError(err));
        } finally {
            if (isMounted.current) setLoading(false);
        }
    }, [initialStudent.student_id]);

    useEffect(() => {
        isMounted.current = true;
        refreshAccountStatus();
        return () => { isMounted.current = false; };
    }, [refreshAccountStatus]);

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
    const overdue = 0; // Need backend field for overdue, defaulting to 0 or logic could be added

    if (loading) return <div className="h-screen flex items-center justify-center bg-[#08090a]"><Spinner /></div>;

    return (
        <div className="min-h-screen bg-[#08090a] text-foreground font-sans selection:bg-primary/20 pb-32">
            <div className="max-w-[1600px] mx-auto px-6 md:px-12 pt-8 space-y-10 animate-in fade-in duration-700">

                {/* 1. Identity & Financial Header Layer */}
                <header className="grid grid-cols-1 xl:grid-cols-12 gap-8 bg-black/40 border border-white/5 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden backdrop-blur-3xl group">
                    <div className="absolute inset-y-0 left-0 w-1 bg-primary/40"></div>
                    <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover:rotate-12 transition-transform duration-1000"><ReceiptIcon className="w-48 h-48" /></div>

                    {/* Compact Identity */}
                    <div className="xl:col-span-4 flex items-center gap-10 relative z-10 border-r border-white/5 pr-10">
                        <div className="relative group/avatar">
                            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full opacity-50 group-hover/avatar:opacity-80 transition-opacity"></div>
                            <PremiumAvatar
                                src={accountData.profile_photo_url}
                                name={accountData.display_name}
                                size="lg"
                                className="w-32 h-32 rounded-[2.5rem] border-2 border-white/10 relative z-10 shadow-2xl transition-transform duration-700 group-hover/avatar:scale-105"
                            />
                            <div className="absolute -bottom-3 -right-3 w-10 h-10 rounded-2xl bg-emerald-500 border-4 border-[#0c0d12] z-20 flex items-center justify-center shadow-xl">
                                <ShieldCheckIcon className="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-[9px] font-black uppercase bg-primary/10 border border-primary/20 px-3 py-1 rounded-lg text-primary tracking-[0.2em]">GRADE_{accountData.grade}_CORE</span>
                                <span className="text-[9px] font-black uppercase text-white/20 tracking-widest">ID: {accountData.student_id ? accountData.student_id.substring(0, 12).toUpperCase() : 'NULL_NODE'}</span>
                            </div>
                            <h1 className="text-4xl font-serif font-black text-white uppercase tracking-tighter leading-none mb-3">{accountData.display_name}</h1>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]">PROTOCOL: <span className="text-white/80">{assignedStructure?.name || 'GENERIC_FALLBACK'}</span></p>
                            </div>
                        </div>
                    </div>

                    {/* Financial Snapshot */}
                    <div className="xl:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-6">
                        <StatCard
                            title="Total Billed"
                            value={formatCurrency(totalAssigned, viewCurrency)}
                            icon={<ActivityIcon className="w-5 h-5" />}
                            variant="neutral"
                        />
                        <StatCard
                            title="Total Cleared"
                            value={formatCurrency(totalPaid, viewCurrency)}
                            icon={<CheckCircleIcon className="w-5 h-5" />}
                            variant="success"
                        />
                        <StatCard
                            title="Institutional Due"
                            value={formatCurrency(outstanding, viewCurrency)}
                            icon={<TrendingUpCustomIcon className="w-5 h-5" />}
                            variant="warning"
                        />
                        <StatCard
                            title="Critical Arrears"
                            value={formatCurrency(overdue, viewCurrency)}
                            subValue={overdue > 0 ? "ACTION_REQ" : "STATUS_OK"}
                            icon={<AlertTriangleIcon className="w-5 h-5" />}
                            variant={overdue > 0 ? "danger" : "success"}
                        />
                    </div>
                </header>

                {/* 2. Visualization & Analytics Layer */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-black/40 border border-white/5 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-10">
                            <div>
                                <h3 className="text-2xl font-serif font-black text-white uppercase tracking-tighter flex items-center gap-4">
                                    <TrendingUpCustomIcon className="w-6 h-6 text-primary" /> Forensic Trend Analysis
                                </h3>
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mt-2">Institutional collection velocity per temporal node.</p>
                            </div>
                            <div className="flex items-center gap-4 p-2 bg-white/[0.02] rounded-xl border border-white/5">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                    <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Revenue_Protocol</span>
                                </div>
                            </div>
                        </div>
                        <div className="h-56 w-full">
                            <PaymentTrendChart ledger={ledger} />
                        </div>
                    </div>

                    <div className="bg-primary/5 border border-primary/10 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden flex flex-col justify-center items-center text-center group">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
                        <div className="relative w-40 h-40 mb-8">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5" />
                                <motion.circle
                                    cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="6" fill="transparent"
                                    initial={{ strokeDashoffset: 264 }}
                                    animate={{ strokeDashoffset: 264 - (264 * (accountData.integrity_score || 100) / 100) }}
                                    strokeDasharray={264}
                                    className="text-primary drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-5xl font-serif font-black text-white">{accountData.integrity_score || 100}</span>
                                <span className="text-[9px] font-black text-primary/40 uppercase tracking-widest">Index</span>
                            </div>
                        </div>
                        <h4 className="text-xl font-serif font-black text-white uppercase tracking-tighter">Institutional Integrity</h4>
                        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em] mt-3 bg-white/[0.03] px-5 py-2 rounded-full border border-white/5">
                            {((accountData.integrity_score || 100) < 70) ? 'DEFICIT_RISK_DETECTED' : 'STABLE_NODE_PROTOCOL'}
                        </p>
                    </div>
                </section>

                {/* 3. Controls & Ledger Actions */}
                <section className="space-y-8">
                    <div className="flex flex-col md:flex-row justify-between items-end gap-8 bg-black/60 backdrop-blur-3xl border border-white/5 p-8 rounded-[2.5rem] sticky top-8 z-40 shadow-[0_32px_64px_-16px_rgba(0,0,0,1)] group">
                        <div className="w-full md:w-auto flex-grow max-w-2xl flex items-center gap-6">
                            <div className="relative flex-grow group/search">
                                <SearchIcon className="absolute left-8 top-1/2 -translate-y-1/2 w-6 h-6 text-white/10 group-focus-within/search:text-primary transition-colors" />
                                <input
                                    type="text"
                                    placeholder="SEARCH FORENSIC LEDGER..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-white/[0.02] border border-white/5 rounded-2xl pl-16 pr-8 py-5 text-[11px] font-black text-white uppercase tracking-[0.3em] focus:outline-none focus:ring-[12px] focus:ring-primary/5 focus:border-primary/40 transition-all placeholder:text-white/5"
                                />
                            </div>
                            <div className="flex bg-white/[0.02] rounded-2xl p-1.5 border border-white/5 shadow-inner">
                                {['ALL', 'PENDING', 'PAID'].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setFilterType(t as any)}
                                        className={`px-8 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filterType === t ? 'bg-white/10 text-white shadow-2xl ring-1 ring-white/10' : 'text-white/20 hover:text-white'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <button className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/5 text-white/20 hover:text-white transition-all shadow-inner active:scale-95 group/btn" title="Dispatch Statement">
                                <MailIcon className="w-6 h-6 group-hover/btn:scale-110 transition-transform" />
                            </button>
                            <button className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/5 text-white/20 hover:text-white transition-all shadow-inner active:scale-95 group/btn" title="Extract Hardcopy">
                                <PrinterIcon className="w-6 h-6 group-hover/btn:scale-110 transition-transform" />
                            </button>
                            <button onClick={() => refreshAccountStatus()} className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/5 text-white/20 hover:text-white transition-all shadow-inner active:scale-95 group/btn">
                                <RefreshCwIcon className={`w-6 h-6 group-hover/btn:rotate-180 transition-all duration-700 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={() => setIsPaymentModalOpen(true)}
                                className="px-10 py-5 bg-primary text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-primary/30 hover:bg-primary/90 transition-all flex items-center gap-4 transform hover:-translate-y-1 active:scale-95 group/action"
                            >
                                <ReceiptIcon className="w-6 h-6 group-hover/action:rotate-12 transition-transform" /> Record Transaction
                            </button>
                        </div>
                    </div>

                    {/* Enterprise Ledger Table */}
                    <div className="bg-black/40 border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl relative group/table">
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent"></div>
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white/[0.01] text-[10px] font-black uppercase tracking-[0.4em] text-white/20 border-b border-white/5">
                                    <tr>
                                        <th className="p-10 pl-12">Registry Date</th>
                                        <th className="p-10">Identifier / Narrative</th>
                                        <th className="p-10">Protocol</th>
                                        <th className="p-10">Integrity</th>
                                        <th className="p-10 text-right">Debit</th>
                                        <th className="p-10 text-right">Credit</th>
                                        <th className="p-10 text-right pr-12">Balance_Node</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.02]">
                                    {filteredLedger.length > 0 ? filteredLedger.map((entry, idx) => {
                                        const date = new Date(entry.transaction_date);
                                        const isCredit = Number(entry.credit) > 0;
                                        return (
                                            <tr key={idx} className="group hover:bg-primary/[0.02] transition-colors relative">
                                                <td className="p-10 pl-12">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-white font-serif tracking-tighter uppercase italic">
                                                            {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '_')}
                                                        </span>
                                                        <span className="text-[9px] font-black text-white/20 mt-1 uppercase tracking-widest">{date.toLocaleTimeString()}</span>
                                                    </div>
                                                </td>
                                                <td className="p-10">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black text-white/80 uppercase tracking-tight">{entry.description}</span>
                                                        <span className="text-[9px] font-mono text-white/20 mt-1.5 uppercase tracking-widest bg-white/[0.03] w-max px-2 py-0.5 rounded-lg border border-white/5">{entry.identifier || 'SYS_VOID'}</span>
                                                    </div>
                                                </td>
                                                <td className="p-10">
                                                    <span className="px-4 py-1.5 bg-white/[0.02] border border-white/5 rounded-xl text-[9px] font-black text-white/30 uppercase tracking-[0.2em] shadow-inner">
                                                        {entry.protocol || (isCredit ? 'SETTLEMENT' : 'AUTOMATION')}
                                                    </span>
                                                </td>
                                                <td className="p-10">
                                                    <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border shadow-inner ${isCredit ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                        }`}>
                                                        {isCredit ? 'ARCHIVED' : 'PENDING'}
                                                    </span>
                                                </td>
                                                <td className="p-10 text-right font-serif font-black text-white/40">
                                                    {Number(entry.debit) > 0 ? formatCurrency(entry.debit, viewCurrency) : '-'}
                                                </td>
                                                <td className="p-10 text-right font-serif font-black text-emerald-500">
                                                    {Number(entry.credit) > 0 ? formatCurrency(entry.credit, viewCurrency) : '-'}
                                                </td>
                                                <td className="p-10 pr-12 text-right font-serif font-black text-white tracking-tighter text-xl">
                                                    {formatCurrency(entry.running_balance, viewCurrency)}
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr>
                                            <td colSpan={7} className="p-40 text-center">
                                                <div className="flex flex-col items-center gap-6">
                                                    <div className="w-20 h-20 bg-white/[0.02] rounded-[2.5rem] flex items-center justify-center border-2 border-dashed border-white/5">
                                                        <SearchIcon className="w-8 h-8 opacity-10" />
                                                    </div>
                                                    <p className="text-[11px] font-black uppercase tracking-[0.5em] text-white/10">No ledger artifacts detected in this temporal node</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <footer className="pt-20 text-center pb-12">
                    <button onClick={onBack} className="group px-10 py-5 bg-white/[0.02] border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-[0.5em] text-white/20 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-4 mx-auto shadow-inner active:scale-95">
                        <ChevronLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Financial Registry
                    </button>
                </footer>
            </div>

            {isPaymentModalOpen && (
                <RecordPaymentModal
                    studentId={accountData.student_id}
                    studentName={accountData.display_name}
                    onClose={() => setIsPaymentModalOpen(false)}
                    onSuccess={() => { setIsPaymentModalOpen(false); refreshAccountStatus(); onUpdate(); }}
                />
            )}
        </div>
    );
};

export default StudentFinanceDetailView;