import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchIcon } from '../icons/SearchIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { CreditCardIcon } from '../icons/CreditCardIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { ArrowRightIcon } from '../icons/ArrowRightIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { CurrencyCode, StudentFeeSummary } from '../../types';
import PremiumAvatar from '../common/PremiumAvatar';

interface FinanceAccountsProps {
    accountsHost: StudentFeeSummary[];
    currency: CurrencyCode;
    search: string;
    onSearchChange: (val: string) => void;
    riskOnly: boolean;
    onRiskToggle: () => void;
    onExport: () => void;
    onSelectAccount: (acc: StudentFeeSummary) => void;
    viewFilter?: string;
}

const formatCurrency = (amount: number, currency: CurrencyCode) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
};

const AccountsSummaryStrip: React.FC<{
    accounts: StudentFeeSummary[];
    currency: CurrencyCode;
}> = ({ accounts, currency }) => {
    const totalDue = accounts.reduce((acc, curr) => acc + curr.outstanding_balance, 0);
    const activeCount = accounts.length;
    const avgCycle = "18 Days"; // Derived or static for UI

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
                { label: 'Active Accounts', value: activeCount, icon: <UsersIcon className="w-5 h-5" />, color: 'text-primary' },
                { label: 'Pending Payments', value: accounts.filter(a => a.outstanding_balance > 0).length, icon: <ClockIcon className="w-5 h-5" />, color: 'text-amber-500' },
                { label: 'Total Due Value', value: formatCurrency(totalDue, currency), icon: <CreditCardIcon className="w-5 h-5" />, color: 'text-red-500' },
                { label: 'Avg Payment Cycle', value: avgCycle, icon: <ActivityIcon className="w-5 h-5" />, color: 'text-emerald-500' }
            ].map((stat, i) => (
                <div key={i} className="bg-[#12141c] border border-white/5 rounded-3xl p-6 flex items-center justify-between group hover:border-white/10 transition-all">
                    <div className="space-y-1">
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">{stat.label}</p>
                        <p className={`text-2xl font-black text-white ${stat.color} font-mono tracking-tighter`}>{stat.value}</p>
                    </div>
                    <div className="p-3 bg-white/[0.03] rounded-2xl border border-white/5 text-white/10 group-hover:text-white/40 transition-colors">
                        {stat.icon}
                    </div>
                </div>
            ))}
        </div>
    );
};

const FinanceAccounts: React.FC<FinanceAccountsProps> = ({
    accountsHost,
    currency,
    search,
    onSearchChange,
    riskOnly,
    onRiskToggle,
    onExport,
    onSelectAccount,
    viewFilter
}) => {
    const filteredAccounts = accountsHost.filter(s => {
        const matchesSearch = !search ||
            s.display_name.toLowerCase().includes(search.toLowerCase()) ||
            (s.class_name && s.class_name.toLowerCase().includes(search.toLowerCase()));

        const matchesRisk = !riskOnly || (s.integrity_score !== undefined && s.integrity_score < 70);

        let matchesFilter = true;
        if (viewFilter === 'paid') matchesFilter = s.outstanding_balance <= 0;
        if (viewFilter === 'pending') matchesFilter = s.outstanding_balance > 0;
        if (viewFilter === 'overdue') matchesFilter = (s.integrity_score || 0) < 50;

        return matchesSearch && matchesRisk && matchesFilter;
    });

    return (
        <div className="space-y-10">
            {/* Layer 1 – Accounts Summary Strip */}
            <AccountsSummaryStrip accounts={accountsHost} currency={currency} />

            {/* Filter & Action Bar */}
            <div className="flex flex-col xl:flex-row gap-6 justify-between items-center bg-[#12141c] p-6 rounded-[2.5rem] border border-white/5 shadow-2xl">
                <div className="relative w-full xl:max-w-2xl group">
                    <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="IDENTIFY ACCOUNT OR NODE..."
                        value={search}
                        onChange={e => onSearchChange(e.target.value)}
                        className="w-full pl-16 pr-6 py-5 bg-black/40 border border-white/5 rounded-2xl text-[14px] font-black text-white focus:border-primary/40 outline-none uppercase tracking-widest transition-all placeholder:text-white/5"
                    />
                </div>
                <div className="flex gap-4 w-full xl:w-auto">
                    <button
                        onClick={onRiskToggle}
                        className={`flex-1 xl:flex-none px-8 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${riskOnly ? 'bg-red-500/10 text-red-500 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10'
                            }`}
                    >
                        Risk Isolation
                    </button>
                    <button
                        onClick={onExport}
                        className="flex-1 xl:flex-none px-8 py-5 bg-white/5 hover:bg-white/10 text-white/40 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all group"
                    >
                        <span className="flex items-center justify-center gap-3">
                            <DownloadIcon className="w-4 h-4" /> Export
                        </span>
                    </button>
                </div>
            </div>

            {/* Layer 2 – Receivables Table */}
            <div className="bg-[#12141c] border border-white/5 rounded-[3rem] shadow-3xl overflow-hidden relative group min-h-[500px]">
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-[#0f1115] border-b border-white/5 text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">
                            <tr>
                                <th className="p-10 pl-14">Identity Hub</th>
                                <th className="p-10 text-center">Student Count</th>
                                <th className="p-10 text-right">Amount Due</th>
                                <th className="p-10 text-right">Amount Paid</th>
                                <th className="p-10 text-right">Balance Delta</th>
                                <th className="p-10 text-center">Status</th>
                                <th className="p-10 pr-14 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                            {filteredAccounts.length > 0 ? filteredAccounts.map((account, idx) => (
                                <motion.tr
                                    key={account.student_id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.02 }}
                                    onClick={() => onSelectAccount(account)}
                                    className="group hover:bg-white/[0.03] cursor-pointer transition-all duration-300"
                                >
                                    <td className="p-10 pl-14">
                                        <div className="flex items-center gap-6">
                                            <PremiumAvatar src={account.profile_photo_url} name={account.display_name} size="sm" className="w-16 h-16 rounded-2xl border border-white/5 group-hover:border-primary/40 transition-all" />
                                            <div>
                                                <p className="text-xl font-serif font-black text-white group-hover:text-primary transition-colors tracking-tight">{account.display_name}</p>
                                                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-1">{account.class_name || 'UNASSIGNED_LOG'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-10 text-center">
                                        <span className="text-lg font-black text-white/40 font-mono">01</span>
                                    </td>
                                    <td className="p-10 text-right">
                                        <span className="text-xl font-black text-white/30 font-mono tracking-tighter">{formatCurrency(account.total_billed, currency)}</span>
                                    </td>
                                    <td className="p-10 text-right">
                                        <span className="text-xl font-black text-emerald-500 font-mono tracking-tighter drop-shadow-[0_0_15px_rgba(16,185,129,0.2)]">{formatCurrency(account.total_paid, currency)}</span>
                                    </td>
                                    <td className="p-10 text-right">
                                        <span className={`text-xl font-black font-mono tracking-tighter ${account.outstanding_balance > 0 ? 'text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'text-white/10'}`}>
                                            {formatCurrency(account.outstanding_balance, currency)}
                                        </span>
                                    </td>
                                    <td className="p-10 text-center">
                                        <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border ${account.outstanding_balance <= 0 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                                            }`}>
                                            {account.outstanding_balance <= 0 ? 'STABLE' : 'PENDING'}
                                        </span>
                                    </td>
                                    <td className="p-10 pr-14 text-right">
                                        <button className="p-4 bg-white/[0.03] text-white/20 rounded-2xl group-hover:bg-primary group-hover:text-white transition-all shadow-xl">
                                            <ArrowRightIcon className="w-5 h-5" />
                                        </button>
                                    </td>
                                </motion.tr>
                            )) : (
                                <tr>
                                    <td colSpan={7} className="py-40 text-center">
                                        <div className="flex flex-col items-center gap-6 opacity-20">
                                            <ActivityIcon className="w-20 h-20 text-white" />
                                            <p className="text-[12px] font-black uppercase tracking-[0.6em]">Node Registry Silent</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View - Stacked Cards */}
                <div className="md:hidden grid grid-cols-1 gap-6 p-6">
                    {filteredAccounts.map(account => (
                        <div key={account.student_id} onClick={() => onSelectAccount(account)} className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-6 active:scale-95 transition-all">
                            <div className="flex items-center gap-6">
                                <PremiumAvatar src={account.profile_photo_url} name={account.display_name} size="sm" className="w-16 h-16 rounded-2xl border border-white/5" />
                                <div>
                                    <p className="text-xl font-serif font-black text-white tracking-tight">{account.display_name}</p>
                                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-1">{account.class_name}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-white/5">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-white/10 uppercase tracking-widest">Amount Due</p>
                                    <p className="text-xl font-black text-white/40 font-mono tracking-tighter">{formatCurrency(account.total_billed, currency)}</p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <p className="text-[9px] font-black text-white/10 uppercase tracking-widest">Balance</p>
                                    <p className={`text-xl font-black font-mono tracking-tighter ${account.outstanding_balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                        {formatCurrency(account.outstanding_balance, currency)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default FinanceAccounts;
