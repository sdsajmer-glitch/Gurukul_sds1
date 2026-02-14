
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon } from '../icons/PlusIcon';
import { SearchIcon } from '../icons/SearchIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { TrendingUpCustomIcon as TrendingUpIcon } from '../icons/TrendingUpIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { supabase } from '../../services/supabase';
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
}

const formatCurrency = (amount: number, currency: CurrencyCode) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0
    }).format(amount || 0);
};

const FinanceExpense: React.FC<{ branchId: number | null, currency: CurrencyCode }> = ({ branchId, currency }) => {
    const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [stats, setStats] = useState({ total_monthly: 0, count: 0 });
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            let query = supabase.from('finance_expenses').select('*').order('payment_date', { ascending: false });
            if (branchId) query = query.eq('branch_id', branchId);

            const { data, error } = await query;
            if (error) throw error;

            setExpenses(data || []);

            const monthly = (data || []).reduce((acc, curr) => {
                const d = new Date(curr.payment_date);
                const now = new Date();
                if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
                    return acc + Number(curr.amount);
                }
                return acc;
            }, 0);

            setStats({ total_monthly: monthly, count: (data || []).length });
        } catch (err) {
            console.error("Expense Sync Failure:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExpenses();
    }, [branchId]);

    const filtered = expenses.filter(e =>
        (e.category?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (e.vendor_name?.toLowerCase() || '').includes(search.toLowerCase())
    );

    if (loading && expenses.length === 0) return (
        <div className="py-40 flex flex-col items-center gap-6">
            <Spinner />
            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.6em] animate-pulse">Synchronizing Disbursement Registry...</p>
        </div>
    );

    return (
        <div className="space-y-10 pb-20">
            {/* Header / Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-[#12141c]/60 border border-white/5 rounded-[3rem] p-10 flex items-center justify-between group hover:border-primary/20 transition-all backdrop-blur-3xl shadow-3xl">
                    <div>
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mb-3">Capital Outflow (Monthly)</p>
                        <h4 className="text-4xl font-serif font-black text-white tracking-tighter">{formatCurrency(stats.total_monthly, currency)}</h4>
                    </div>
                    <div className="p-5 bg-primary/10 rounded-2xl text-primary shadow-inner"><TrendingUpIcon className="w-7 h-7 rotate-180" /></div>
                </div>
                <div className="bg-[#12141c]/60 border border-white/5 rounded-[3rem] p-10 flex items-center justify-between group hover:border-white/10 transition-all backdrop-blur-3xl shadow-3xl">
                    <div>
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mb-3">Operational Transactions</p>
                        <h4 className="text-4xl font-serif font-black text-white tracking-tighter">{stats.count}</h4>
                    </div>
                    <div className="p-5 bg-white/5 rounded-2xl text-white/20"><DownloadIcon className="w-7 h-7" /></div>
                </div>
                <div className="bg-[#12141c]/60 border border-white/5 rounded-[3rem] p-10 flex items-center justify-between group hover:border-emerald-500/20 transition-all backdrop-blur-3xl shadow-3xl">
                    <div>
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mb-3">Audit Compliance</p>
                        <h4 className="text-4xl font-serif font-black text-emerald-500 tracking-tighter drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">Verified</h4>
                    </div>
                    <div className="p-5 bg-emerald-500/10 rounded-2xl text-emerald-500 shadow-inner"><CheckCircleIcon className="w-7 h-7" /></div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col xl:flex-row gap-8 justify-between items-center bg-[#12141c]/40 p-8 rounded-[3.5rem] border border-white/5 shadow-3xl backdrop-blur-2xl ring-1 ring-white/5">
                <div className="relative w-full xl:max-w-2xl group">
                    <SearchIcon className="absolute left-8 top-1/2 -translate-y-1/2 h-6 w-6 text-white/10 group-focus-within:text-primary transition-all" />
                    <input
                        type="text"
                        placeholder="SEARCH VENDOR, CATEGORY OR PROTOCOL..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-20 pr-8 py-6 bg-black/40 border border-white/5 rounded-[1.8rem] text-[15px] font-black text-white outline-none focus:border-primary/40 focus:ring-[15px] focus:ring-primary/5 uppercase tracking-widest transition-all placeholder:text-white/5"
                    />
                </div>
                <div className="flex gap-6 w-full xl:w-auto">
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex-1 xl:flex-none px-12 py-6 bg-primary text-white font-black text-[11px] uppercase tracking-[0.4em] rounded-[1.8rem] flex items-center justify-center gap-5 hover:bg-primary/90 transition-all active:scale-95 shadow-[0_20px_40px_-10px_rgba(var(--primary),0.3)] ring-4 ring-primary/10"
                    >
                        <PlusIcon className="w-5 h-5" /> Record Disbursement
                    </button>
                    <button className="p-6 bg-white/5 border border-white/5 rounded-[1.8rem] text-white/20 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all shadow-inner active:scale-95">
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
                                <th className="p-12 pr-16 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.03]">
                            {filtered.length > 0 ? filtered.map((exp, idx) => (
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
                                        <span className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${exp.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                                            {exp.status || 'Reconciled'}
                                        </span>
                                    </td>
                                    <td className="p-12 pr-16 text-right">
                                        <button className="p-3.5 rounded-xl bg-white/5 border border-white/5 text-white/10 hover:text-white hover:bg-white/10 transition-all opacity-40 group-hover:opacity-100"><AlertTriangleIcon className="w-5 h-5" /></button>
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
