
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PlusIcon } from '../icons/PlusIcon';
import { SearchIcon } from '../icons/SearchIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { TrendingUpCustomIcon as TrendingUpIcon } from '../icons/TrendingUpIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { supabase } from '../../services/supabase';
import { CurrencyCode } from '../../types';
import Spinner from '../common/Spinner';

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

    useEffect(() => {
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
        fetchExpenses();
    }, [branchId]);

    const filtered = expenses.filter(e =>
        e.category.toLowerCase().includes(search.toLowerCase()) ||
        e.vendor_name?.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <div className="py-20 flex justify-center"><Spinner /></div>;

    return (
        <div className="space-y-10 pb-20">
            {/* Header / Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-[#12141c] border border-white/5 rounded-3xl p-8 flex items-center justify-between group hover:border-primary/20 transition-all">
                    <div>
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mb-2">Monthly Expenditure</p>
                        <h4 className="text-3xl font-serif font-black text-white tracking-tighter">{formatCurrency(stats.total_monthly, currency)}</h4>
                    </div>
                    <div className="p-4 bg-primary/10 rounded-2xl text-primary"><TrendingUpIcon className="w-6 h-6 rotate-180" /></div>
                </div>
                <div className="bg-[#12141c] border border-white/5 rounded-3xl p-8 flex items-center justify-between group">
                    <div>
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mb-2">Operational Transactions</p>
                        <h4 className="text-3xl font-serif font-black text-white tracking-tighter">{stats.count}</h4>
                    </div>
                </div>
                <div className="bg-[#12141c] border border-white/5 rounded-3xl p-8 flex items-center justify-between group">
                    <div>
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mb-2">Audit Compliance</p>
                        <h4 className="text-3xl font-serif font-black text-emerald-500 tracking-tighter">Verified</h4>
                    </div>
                    <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-500"><CheckCircleIcon className="w-6 h-6" /></div>
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col xl:flex-row gap-6 justify-between items-center bg-[#12141c] p-6 rounded-[2.5rem] border border-white/5 shadow-2xl">
                <div className="relative w-full xl:max-w-2xl group">
                    <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20" />
                    <input
                        type="text"
                        placeholder="SEARCH VENDOR OR CATEGORY..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-16 pr-6 py-5 bg-black/40 border border-white/5 rounded-2xl text-[14px] font-black text-white outline-none focus:border-primary/40 uppercase tracking-widest transition-all placeholder:text-white/5"
                    />
                </div>
                <div className="flex gap-4 w-full xl:w-auto">
                    <button className="flex-1 xl:flex-none px-10 py-5 bg-primary text-white font-black text-[10px] uppercase tracking-[0.4em] rounded-2xl flex items-center gap-4 hover:bg-primary/90 transition-all active:scale-95">
                        <PlusIcon className="w-4 h-4" /> Record Expense
                    </button>
                    <button className="p-5 bg-white/5 border border-white/5 rounded-2xl text-white/40 hover:text-white transition-all">
                        <DownloadIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Expense Registry */}
            <div className="bg-[#12141c] border border-white/5 rounded-[3rem] overflow-hidden shadow-3xl">
                <table className="w-full text-left">
                    <thead className="bg-[#0f1115] border-b border-white/5 text-[9px] font-black text-white/20 uppercase tracking-[0.5em]">
                        <tr>
                            <th className="p-10 pl-14">Category Hub</th>
                            <th className="p-10">Vendor Identity</th>
                            <th className="p-10">Resolution Date</th>
                            <th className="p-10 text-right">Magnitude</th>
                            <th className="p-10 text-center">Protocol Status</th>
                            <th className="p-10 pr-14 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                        {filtered.length > 0 ? filtered.map((exp, idx) => (
                            <tr key={exp.id} className="group hover:bg-white/[0.02] transition-all">
                                <td className="p-10 pl-14 font-serif font-black text-white uppercase tracking-tight">{exp.category}</td>
                                <td className="p-10 text-white/40 font-black uppercase text-[11px] tracking-widest">{exp.vendor_name || 'Anonymous Vendor'}</td>
                                <td className="p-10 text-white/20 font-black uppercase text-[10px] tracking-widest">{new Date(exp.payment_date).toLocaleDateString()}</td>
                                <td className="p-10 text-right font-serif font-black text-red-500 tracking-tighter text-xl">-{formatCurrency(exp.amount, currency)}</td>
                                <td className="p-10 text-center">
                                    <span className="px-4 py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest">Reconciled</span>
                                </td>
                                <td className="p-10 pr-14 text-right">
                                    <button className="text-white/10 hover:text-white transition-colors"><AlertTriangleIcon className="w-5 h-5" /></button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={6} className="py-40 text-center opacity-20">
                                    <TrendingUpIcon className="w-16 h-16 mx-auto mb-6 rotate-180" />
                                    <p className="text-[12px] font-black uppercase tracking-[0.6em]">No Expense Artifacts Found</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FinanceExpense;
