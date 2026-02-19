
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon } from '../icons/PlusIcon';
import { SearchIcon } from '../icons/SearchIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { TrendingUpCustomIcon as TrendingUpIcon } from '../icons/TrendingUpIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { XIcon } from '../icons/XIcon';
import { FilterIcon } from '../icons/FilterIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { supabase, formatError } from '../../services/supabase';
import { CurrencyCode } from '../../types';
import Spinner from '../common/Spinner';
import AddExpenseModal from './AddExpenseModal';

interface ExpenseEntry {
    id: number;
    category: string;
    vendor_name: string;
    amount: number;
    payment_date: string;
    status: string;
    description?: string;
    payment_method?: string;
    approved_by?: string;
    created_at?: string;
}

const formatCurrency = (amount: number, currency: CurrencyCode) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0
    }).format(amount || 0);
};

const CATEGORY_OPTIONS = ['All Categories', 'Salary', 'Utilities', 'Maintenance', 'Academic', 'Transport', 'Infrastructure', 'Miscellaneous'];

const FinanceExpense: React.FC<{ branchId: number | null, currency: CurrencyCode }> = ({ branchId, currency }) => {
    const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All Categories');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'Pending' | 'Approved' | 'Paid' | 'Rejected'>('ALL');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            let query = supabase.from('finance_expenses').select('*').order('payment_date', { ascending: false });
            if (branchId) query = query.eq('branch_id', branchId);

            const { data, error } = await query;
            if (error) throw error;
            setExpenses(data || []);
        } catch (err) {
            console.error("Expense Sync Failure:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExpenses();
    }, [branchId]);

    // --- Computed Stats (No dummy values) ---
    const stats = useMemo(() => {
        const now = new Date();
        const monthly = expenses.reduce((acc, curr) => {
            const d = new Date(curr.payment_date);
            if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
                return acc + Number(curr.amount);
            }
            return acc;
        }, 0);

        const pending = expenses.filter(e => e.status === 'Pending').length;
        const approved = expenses.filter(e => e.status === 'Approved' || e.status === 'Paid').length;
        const total = expenses.length;

        // FIX: Compute compliance from actual data, not hardcoded "Verified"
        const complianceRate = total > 0 ? Math.round((approved / total) * 100) : 0;
        const complianceLabel = complianceRate >= 90 ? 'Verified' : complianceRate >= 70 ? 'Moderate' : complianceRate >= 50 ? 'At Risk' : total === 0 ? 'N/A' : 'Non-Compliant';
        const complianceColor = complianceRate >= 90 ? 'emerald' : complianceRate >= 70 ? 'amber' : 'red';

        return {
            total_monthly: monthly,
            count: total,
            pending_count: pending,
            compliance_rate: complianceRate,
            compliance_label: complianceLabel,
            compliance_color: complianceColor
        };
    }, [expenses]);

    // --- Approval Workflow ---
    const handleApproval = async (expenseId: number, action: 'approve' | 'reject') => {
        setActionLoading(expenseId);
        try {
            const newStatus = action === 'approve' ? 'Approved' : 'Rejected';
            const { error } = await supabase
                .from('finance_expenses')
                .update({ status: newStatus })
                .eq('id', expenseId);
            if (error) throw error;

            // Log to audit trail
            await supabase.from('finance_audit_logs').insert({
                module: 'EXPENDITURE',
                action: action === 'approve' ? 'EXPENSE_APPROVED' : 'EXPENSE_REJECTED',
                description: `Expense #${expenseId} ${newStatus.toLowerCase()} via governance workflow.`,
                entity_type: 'expense',
                entity_id: String(expenseId),
                severity: action === 'reject' ? 'HIGH' : 'MEDIUM',
                branch_id: branchId,
                performed_by_name: 'System Admin'
            });

            await fetchExpenses();
        } catch (err) {
            console.error("Approval Action Error:", err);
        } finally {
            setActionLoading(null);
        }
    };

    // --- Export ---
    const handleExport = () => {
        if (!expenses.length) return;
        const headers = 'Category,Vendor,Date,Amount,Status,Payment Method\n';
        const csv = expenses.map(e =>
            `"${e.category}","${e.vendor_name || 'N/A'}","${new Date(e.payment_date).toISOString().split('T')[0]}",${e.amount},"${e.status}","${e.payment_method || 'N/A'}"`
        ).join('\n');
        const blob = new Blob([headers + csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Expense_Registry_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    // --- Filtering ---
    const filtered = useMemo(() => {
        return expenses.filter(e => {
            const matchesSearch = search === '' ||
                (e.category?.toLowerCase() || '').includes(search.toLowerCase()) ||
                (e.vendor_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
                (e.description?.toLowerCase() || '').includes(search.toLowerCase());
            const matchesCategory = categoryFilter === 'All Categories' || e.category === categoryFilter;
            const matchesStatus = statusFilter === 'ALL' || e.status === statusFilter;
            return matchesSearch && matchesCategory && matchesStatus;
        });
    }, [expenses, search, categoryFilter, statusFilter]);

    if (loading && expenses.length === 0) return (
        <div className="py-40 flex flex-col items-center gap-6">
            <Spinner />
            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.6em] animate-pulse">Synchronizing Disbursement Registry...</p>
        </div>
    );

    return (
        <div className="space-y-10 pb-20">
            {/* Header / Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="bg-[#12141c]/60 border border-white/5 rounded-[3rem] p-10 flex items-center justify-between group hover:border-primary/20 transition-all backdrop-blur-3xl shadow-3xl">
                    <div>
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mb-3">Capital Outflow (Monthly)</p>
                        <h4 className="text-4xl font-serif font-black text-white tracking-tighter">{formatCurrency(stats.total_monthly, currency)}</h4>
                    </div>
                    <div className="p-5 bg-primary/10 rounded-2xl text-primary shadow-inner"><TrendingUpIcon className="w-7 h-7 rotate-180" /></div>
                </div>
                <div className="bg-[#12141c]/60 border border-white/5 rounded-[3rem] p-10 flex items-center justify-between group hover:border-white/10 transition-all backdrop-blur-3xl shadow-3xl">
                    <div>
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mb-3">Total Transactions</p>
                        <h4 className="text-4xl font-serif font-black text-white tracking-tighter">{stats.count}</h4>
                    </div>
                    <div className="p-5 bg-white/5 rounded-2xl text-white/20"><DownloadIcon className="w-7 h-7" /></div>
                </div>
                <div className="bg-[#12141c]/60 border border-white/5 rounded-[3rem] p-10 flex items-center justify-between group hover:border-amber-500/20 transition-all backdrop-blur-3xl shadow-3xl">
                    <div>
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mb-3">Pending Approvals</p>
                        <h4 className={`text-4xl font-serif font-black tracking-tighter ${stats.pending_count > 0 ? 'text-amber-500' : 'text-white/40'}`}>{stats.pending_count}</h4>
                    </div>
                    <div className={`p-5 rounded-2xl shadow-inner ${stats.pending_count > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-white/5 text-white/20'}`}>
                        <AlertTriangleIcon className="w-7 h-7" />
                    </div>
                </div>
                {/* FIX: Computed audit compliance from real data */}
                <div className={`bg-[#12141c]/60 border rounded-[3rem] p-10 flex items-center justify-between group transition-all backdrop-blur-3xl shadow-3xl ${stats.compliance_color === 'emerald' ? 'border-emerald-500/10 hover:border-emerald-500/20' :
                        stats.compliance_color === 'amber' ? 'border-amber-500/10 hover:border-amber-500/20' : 'border-red-500/10 hover:border-red-500/20'
                    }`}>
                    <div>
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mb-3">Audit Compliance</p>
                        <h4 className={`text-4xl font-serif font-black tracking-tighter drop-shadow-[0_0_15px_rgba(16,185,129,0.3)] ${stats.compliance_color === 'emerald' ? 'text-emerald-500' :
                                stats.compliance_color === 'amber' ? 'text-amber-500' : 'text-red-500'
                            }`}>{stats.compliance_label}</h4>
                        <p className="text-[9px] font-mono text-white/20 mt-2">{stats.compliance_rate}% Approval Rate</p>
                    </div>
                    <div className={`p-5 rounded-2xl shadow-inner ${stats.compliance_color === 'emerald' ? 'bg-emerald-500/10 text-emerald-500' :
                            stats.compliance_color === 'amber' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                        }`}><CheckCircleIcon className="w-7 h-7" /></div>
                </div>
            </div>

            {/* Action Bar with Filters */}
            <div className="flex flex-col xl:flex-row gap-8 justify-between items-center bg-[#12141c]/40 p-8 rounded-[3.5rem] border border-white/5 shadow-3xl backdrop-blur-2xl ring-1 ring-white/5">
                <div className="relative w-full xl:max-w-xl group">
                    <SearchIcon className="absolute left-8 top-1/2 -translate-y-1/2 h-6 w-6 text-white/10 group-focus-within:text-primary transition-all" />
                    <input
                        type="text"
                        placeholder="SEARCH VENDOR, CATEGORY..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-20 pr-8 py-6 bg-black/40 border border-white/5 rounded-[1.8rem] text-[15px] font-black text-white outline-none focus:border-primary/40 focus:ring-[15px] focus:ring-primary/5 uppercase tracking-widest transition-all placeholder:text-white/5"
                    />
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-3">
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-6 py-4 bg-black/40 border border-white/5 rounded-xl text-[10px] font-black text-white/60 uppercase tracking-widest focus:outline-none focus:border-primary/40 appearance-none cursor-pointer"
                    >
                        {CATEGORY_OPTIONS.map(c => (
                            <option key={c} value={c} className="bg-[#0c0d12] text-white">{c}</option>
                        ))}
                    </select>

                    {/* Status Filter */}
                    <div className="flex bg-[#0c0d12] p-1 rounded-xl border border-white/10">
                        {(['ALL', 'Pending', 'Approved', 'Paid', 'Rejected'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-4 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${statusFilter === s
                                    ? 'bg-white text-black shadow-lg'
                                    : 'text-white/30 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-6 w-full xl:w-auto">
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex-1 xl:flex-none px-12 py-6 bg-primary text-white font-black text-[11px] uppercase tracking-[0.4em] rounded-[1.8rem] flex items-center justify-center gap-5 hover:bg-primary/90 transition-all active:scale-95 shadow-[0_20px_40px_-10px_rgba(var(--primary),0.3)] ring-4 ring-primary/10"
                    >
                        <PlusIcon className="w-5 h-5" /> Record Disbursement
                    </button>
                    <button
                        onClick={handleExport}
                        className="p-6 bg-white/5 border border-white/5 rounded-[1.8rem] text-white/20 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all shadow-inner active:scale-95"
                        title="Export to CSV"
                    >
                        <DownloadIcon className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Expense Registry */}
            <div className="bg-[#12141c]/60 border border-white/5 rounded-[4rem] overflow-hidden shadow-[0_64px_128px_-32px_rgba(0,0,0,1)] backdrop-blur-3xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-black/40 border-b border-white/5 text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">
                            <tr>
                                <th className="p-12 pl-16">Capital Segment</th>
                                <th className="p-12">Beneficiary Entity</th>
                                <th className="p-12">Disbursement Date</th>
                                <th className="p-12 text-right">Magnitude</th>
                                <th className="p-12 text-center">Protocol Status</th>
                                <th className="p-12 pr-16 text-right">Governance Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                            {filtered.length > 0 ? filtered.map((exp) => (
                                <tr key={exp.id} className="group hover:bg-white/[0.02] transition-all duration-300">
                                    <td className="p-12 pl-16">
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-lg font-serif font-black text-white uppercase tracking-tight group-hover:text-primary transition-colors">{exp.category}</span>
                                            <span className="text-[9px] font-black text-white/10 uppercase tracking-[0.3em]">Code: SEC_{exp.id.toString().padStart(4, '0')}</span>
                                        </div>
                                    </td>
                                    <td className="p-12 text-white/40 font-black uppercase text-[12px] tracking-widest">{exp.vendor_name || 'Internal Disbursement'}</td>
                                    <td className="p-12 text-white/20 font-black uppercase text-[11px] tracking-widest">{new Date(exp.payment_date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                    <td className="p-12 text-right font-serif font-black text-red-500 tracking-tighter text-2xl drop-shadow-[0_0_10px_rgba(239,68,68,0.2)]">-{formatCurrency(exp.amount, currency)}</td>
                                    <td className="p-12 text-center">
                                        <span className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${exp.status === 'Paid' || exp.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                                exp.status === 'Rejected' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                    'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                            }`}>
                                            {exp.status || 'Pending'}
                                        </span>
                                    </td>
                                    <td className="p-12 pr-16 text-right">
                                        {/* Approval Workflow Actions */}
                                        {(exp.status === 'Pending' || !exp.status) ? (
                                            <div className="flex items-center gap-2 justify-end opacity-40 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleApproval(exp.id, 'approve')}
                                                    disabled={actionLoading === exp.id}
                                                    className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-30"
                                                    title="Approve expense"
                                                >
                                                    <CheckCircleIcon className="w-4 h-4" />
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => handleApproval(exp.id, 'reject')}
                                                    disabled={actionLoading === exp.id}
                                                    className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all flex items-center gap-2 disabled:opacity-30"
                                                    title="Reject expense"
                                                >
                                                    <XIcon className="w-4 h-4" />
                                                    Reject
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-[9px] font-black text-white/10 uppercase tracking-widest">
                                                {exp.status === 'Approved' ? '✓ Authorized' : exp.status === 'Rejected' ? '✕ Declined' : 'Processed'}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="py-48 text-center relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-t from-primary/[0.02] to-transparent pointer-events-none"></div>
                                        <div className="relative z-10 space-y-8 opacity-20">
                                            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10 shadow-inner">
                                                <TrendingUpIcon className="w-12 h-12 rotate-180" />
                                            </div>
                                            <p className="text-[14px] font-black uppercase tracking-[0.8em]">Disbursement Archive Quiet</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <AnimatePresence>
                {isAddModalOpen && (
                    <AddExpenseModal
                        onClose={() => setIsAddModalOpen(false)}
                        onSave={() => {
                            fetchExpenses();
                            setIsAddModalOpen(false);
                        }}
                        branchId={branchId}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default FinanceExpense;
