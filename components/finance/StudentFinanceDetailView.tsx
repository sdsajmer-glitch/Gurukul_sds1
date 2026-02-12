
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
        neutral: 'bg-[#12141c] border-white/5 text-white',
        success: 'bg-emerald-500/[0.03] border-emerald-500/20 text-emerald-500',
        warning: 'bg-amber-500/[0.03] border-amber-500/20 text-amber-500',
        danger: 'bg-red-500/[0.03] border-red-500/20 text-red-500',
    };

    const iconBg = {
        neutral: 'bg-white/5 text-white/40',
        success: 'bg-emerald-500/10 text-emerald-500',
        warning: 'bg-amber-500/10 text-amber-500',
        danger: 'bg-red-500/10 text-red-500',
    };

    return (
        <div className={`p-6 rounded-3xl border flex flex-col justify-between group hover:scale-[1.02] transition-all duration-300 relative overflow-hidden ${variants[variant]}`}>
            <div className="absolute top-0 right-0 p-8 opacity-[0.05] group-hover:scale-125 transition-transform duration-700">{icon}</div>
            <div className="relative z-10">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${iconBg[variant]}`}>
                    {icon}
                </div>
                <div>
                    <h3 className="text-2xl font-black font-mono tracking-tighter mb-1">{value}</h3>
                    <p className="text-[10px] uppercase font-black tracking-[0.2em] opacity-60">{title}</p>
                    {subValue && <p className="text-[10px] font-bold mt-2 opacity-40">{subValue}</p>}
                </div>
            </div>
        </div>
    );
};

const PaymentTrendChart: React.FC<{ ledger: any[] }> = ({ ledger }) => {
    // Simplified trend visualization using credits
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
        <div className="h-full flex flex-col justify-end gap-2">
            <div className="flex justify-between items-end h-32 gap-2 px-2">
                {monthlyData.map((val, i) => (
                    <div key={i} className="flex-1 flex flex-col justify-end group cursor-pointer">
                        <div
                            className="bg-primary/20 hover:bg-primary/60 transition-all rounded-t-sm w-full relative min-h-[4px]"
                            style={{ height: `${(val / max) * 100}%` }}
                        >
                            <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[9px] font-bold px-2 py-1 rounded border border-white/10 whitespace-nowrap z-10">
                                ${(val / 1000).toFixed(1)}k
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex justify-between px-2 border-t border-white/5 pt-2">
                {months.map((m, i) => (
                    <span key={i} className="text-[8px] font-black text-white/20 uppercase w-full text-center">{m[0]}</span>
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
                <header className="grid grid-cols-1 xl:grid-cols-12 gap-6 bg-[#0c0d12] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                    {/* Compact Identity */}
                    <div className="xl:col-span-4 flex items-center gap-8 relative z-10 border-r border-white/5 pr-8">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full opacity-50 group-hover:opacity-80 transition-opacity"></div>
                            <PremiumAvatar
                                src={accountData.profile_photo_url}
                                name={accountData.display_name}
                                size="lg"
                                className="w-24 h-24 rounded-[2rem] border-2 border-white/10 relative z-10 shadow-xl"
                            />
                            <div className={`absolute -bottom-2 -right-2 w-6 h-6 rounded-full border-2 border-[#0c0d12] z-20 flex items-center justify-center ${accountData.is_active ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                <CheckCircleIcon className="w-3 h-3 text-black" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-[10px] font-black uppercase bg-white/5 border border-white/5 px-3 py-1 rounded-full text-white/40">Grade {accountData.grade}</span>
                                <span className="text-[10px] font-black uppercase text-white/20">SID: {accountData.student_id ? accountData.student_id.substring(0, 8) : 'N/A'}</span>
                            </div>
                            <h1 className="text-3xl font-serif font-black text-white uppercase tracking-tight leading-none mb-2">{accountData.display_name}</h1>
                            <p className="text-xs text-white/40 font-medium">Fee Structure: <span className="text-white/80">{assignedStructure?.name || 'Standard Default'}</span></p>
                        </div>
                    </div>

                    {/* Financial Snapshot */}
                    <div className="xl:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard
                            title="Total Assigned"
                            value={formatCurrency(totalAssigned, viewCurrency)}
                            icon={<ActivityIcon className="w-5 h-5" />}
                            variant="neutral"
                        />
                        <StatCard
                            title="Total Paid"
                            value={formatCurrency(totalPaid, viewCurrency)}
                            icon={<CheckCircleIcon className="w-5 h-5" />}
                            variant="success"
                        />
                        <StatCard
                            title="Outstanding"
                            value={formatCurrency(outstanding, viewCurrency)}
                            icon={<TrendingUpCustomIcon className="w-5 h-5" />}
                            variant="warning"
                        />
                        <StatCard
                            title="Overdue"
                            value={formatCurrency(overdue, viewCurrency)}
                            subValue={overdue > 0 ? "Immediate Action" : "Clear"}
                            icon={<AlertTriangleIcon className="w-5 h-5" />}
                            variant={overdue > 0 ? "danger" : "success"}
                        />
                    </div>
                </header>

                {/* 2. Visualization & Analytics Layer */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-[#0d0f14] border border-white/5 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-3">
                                <TrendingUpCustomIcon className="w-5 h-5 text-primary" /> Payment Trend Analysis
                            </h3>
                            <div className="flex gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary/50"></span>
                                <span className="text-[9px] font-bold text-white/20 uppercase">Collections</span>
                            </div>
                        </div>
                        <div className="h-40 w-full">
                            <PaymentTrendChart ledger={ledger} />
                        </div>
                    </div>

                    <div className="bg-primary/5 border border-primary/10 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden flex flex-col justify-center items-center text-center">
                        <div className="relative w-32 h-32 mb-6">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                                <motion.circle
                                    cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="8" fill="transparent"
                                    initial={{ strokeDashoffset: 283 }}
                                    animate={{ strokeDashoffset: 283 - (283 * (accountData.integrity_score || 100) / 100) }}
                                    strokeDasharray={283}
                                    className="text-primary drop-shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-3xl font-black text-white">{accountData.integrity_score || 100}%</span>
                            </div>
                        </div>
                        <h4 className="text-lg font-black text-white uppercase tracking-tight">Financial Health</h4>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest mt-2">{((accountData.integrity_score || 100) < 70) ? 'Risk Detected' : 'Stable Node'}</p>
                    </div>
                </section>

                {/* 3. Controls & Ledger Actions */}
                <section className="space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-end gap-6 bg-[#0c0d12]/80 backdrop-blur-xl border border-white/5 p-6 rounded-[2rem] sticky top-4 z-40 shadow-2xl">
                        <div className="w-full md:w-auto flex-grow max-w-2xl flex items-center gap-4">
                            <div className="relative flex-grow">
                                <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                                <input
                                    type="text"
                                    placeholder="SEARCH INVOICE ID OR DESCRIPTION..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl pl-16 pr-6 py-4 text-xs font-black text-white uppercase tracking-widest focus:outline-none focus:border-primary/50 transition-colors"
                                />
                            </div>
                            <div className="flex bg-black/40 rounded-2xl p-1 border border-white/10">
                                <button onClick={() => setFilterType('ALL')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'ALL' ? 'bg-white/10 text-white shadow-lg' : 'text-white/30 hover:text-white'}`}>All</button>
                                <button onClick={() => setFilterType('PENDING')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'PENDING' ? 'bg-amber-500/20 text-amber-500 shadow-lg' : 'text-white/30 hover:text-white'}`}>Pending</button>
                                <button onClick={() => setFilterType('PAID')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'PAID' ? 'bg-emerald-500/20 text-emerald-500 shadow-lg' : 'text-white/30 hover:text-white'}`}>Paid</button>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button className="p-4 bg-white/[0.03] border border-white/5 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all">
                                <MailIcon className="w-5 h-5" />
                            </button>
                            <button className="p-4 bg-white/[0.03] border border-white/5 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all">
                                <PrinterIcon className="w-5 h-5" />
                            </button>
                            <button onClick={() => refreshAccountStatus()} className="p-4 bg-white/[0.03] border border-white/5 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all">
                                <RefreshCwIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={() => setIsPaymentModalOpen(true)}
                                className="px-8 py-4 bg-primary text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-3 active:scale-95"
                            >
                                <ReceiptIcon className="w-5 h-5" /> Record
                            </button>
                        </div>
                    </div>

                    {/* Enterprise Ledger Table */}
                    <div className="bg-[#0c0d12] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl relative">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-[#12141c] text-[9px] font-black uppercase tracking-[0.3em] text-white/30 border-b border-white/5">
                                    <tr>
                                        <th className="p-8 pl-10">Date / Timestamp</th>
                                        <th className="p-8">Invoice ID & Description</th>
                                        <th className="p-8">Payment Mode</th>
                                        <th className="p-8">Status</th>
                                        <th className="p-8 text-right">Debit</th>
                                        <th className="p-8 text-right">Credit</th>
                                        <th className="p-8 text-right pr-10">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.02]">
                                    {filteredLedger.length > 0 ? filteredLedger.map((entry, idx) => {
                                        const date = new Date(entry.transaction_date);
                                        const isCredit = Number(entry.credit) > 0;
                                        return (
                                            <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                                                <td className="p-8 pl-10">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black text-white font-mono tracking-tighter">
                                                            {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-white/20 mt-1">{date.toLocaleTimeString()}</span>
                                                    </div>
                                                </td>
                                                <td className="p-8">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-white/80">{entry.description}</span>
                                                        <span className="text-[9px] font-mono text-white/30 mt-1 uppercase tracking-wider">{entry.identifier || 'SYS_GEN'}</span>
                                                    </div>
                                                </td>
                                                <td className="p-8">
                                                    <span className="px-3 py-1 bg-white/[0.03] border border-white/5 rounded text-[9px] font-black text-white/40 uppercase tracking-widest">
                                                        {entry.protocol || (isCredit ? 'CASH/BANK' : 'AUTO_DEBIT')}
                                                    </span>
                                                </td>
                                                <td className="p-8">
                                                    <span className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest border ${isCredit ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/10' : 'bg-amber-500/10 text-amber-500 border-amber-500/10'
                                                        }`}>
                                                        {isCredit ? 'VERIFIED' : 'PENDING'}
                                                    </span>
                                                </td>
                                                <td className="p-8 text-right font-mono font-bold text-white/40">
                                                    {Number(entry.debit) > 0 ? formatCurrency(entry.debit, viewCurrency) : '-'}
                                                </td>
                                                <td className="p-8 text-right font-mono font-bold text-emerald-500">
                                                    {Number(entry.credit) > 0 ? formatCurrency(entry.credit, viewCurrency) : '-'}
                                                </td>
                                                <td className="p-8 pr-10 text-right font-mono font-black text-white tracking-tight text-sm">
                                                    {formatCurrency(entry.running_balance, viewCurrency)}
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr>
                                            <td colSpan={7} className="p-32 text-center text-[10px] font-black uppercase tracking-[0.4em] text-white/20">
                                                No ledger artifacts found matching criteria
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <footer className="pt-12 text-center">
                    <button onClick={onBack} className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 hover:text-white transition-colors flex items-center justify-center gap-2 mx-auto">
                        <ChevronLeftIcon className="w-3 h-3" /> Return to Master Registry
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