import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchIcon } from '../icons/SearchIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { CreditCardIcon } from '../icons/CreditCardIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { ArrowRightIcon } from '../icons/ArrowRightIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { CurrencyCode, StudentFeeSummary } from '../../types';
import PremiumAvatar from '../common/PremiumAvatar';
import { FilterIcon } from '../icons/FilterIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';

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

// 📊 KPI Card Component
const KPICard: React.FC<{
    label: string;
    value: string | number;
    subtext?: string;
    icon: React.ReactNode;
    color: string;
    trend?: 'up' | 'down' | 'neutral';
}> = ({ label, value, subtext, icon, color, trend }) => (
    <div className="bg-[#12141c] border border-white/5 rounded-2xl p-5 flex flex-col justify-between group hover:border-white/10 transition-all h-[120px] relative overflow-hidden">
        <div className={`absolute top-0 right-0 p-8 opacity-[0.02] group-hover:scale-110 transition-transform duration-500 ${color}`}>
            {icon}
        </div>
        <div className="flex justify-between items-start z-10">
            <div className={`p-2 rounded-lg bg-white/[0.03] border border-white/5 ${color} bg-opacity-10`}>
                {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4" })}
            </div>
            {trend && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${trend === 'up' ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10' :
                        trend === 'down' ? 'text-red-500 border-red-500/20 bg-red-500/10' :
                            'text-white/20 border-white/5'
                    }`}>
                    {trend === 'up' ? '↗' : '↘'} 2.4%
                </span>
            )}
        </div>
        <div className="z-10">
            <h4 className="text-[22px] font-bold text-white font-mono tracking-tighter mb-0.5">{value}</h4>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{label}</p>
        </div>
    </div>
);

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
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'OVERDUE' | 'PAID'>('ALL');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Derived Stats
    const totalDue = accountsHost.reduce((acc, curr) => acc + curr.outstanding_balance, 0);
    const totalCollected = accountsHost.reduce((acc, curr) => acc + curr.total_paid, 0);
    const collectionEfficiency = totalCollected > 0 ? Math.round((totalCollected / (totalCollected + totalDue)) * 100) : 0;

    // Filtering Logic
    const filteredAccounts = accountsHost.filter(s => {
        const matchesSearch = !search ||
            s.display_name.toLowerCase().includes(search.toLowerCase()) ||
            (s.class_name && s.class_name.toLowerCase().includes(search.toLowerCase()));

        const matchesRisk = !riskOnly || (s.integrity_score !== undefined && s.integrity_score < 70);

        // Status Filter
        let matchesStatus = true;
        if (statusFilter === 'PAID') matchesStatus = s.outstanding_balance <= 0;
        if (statusFilter === 'OVERDUE') matchesStatus = s.outstanding_balance > 0 && (s.integrity_score || 0) < 60; // Mock logic for overdue
        if (statusFilter === 'ACTIVE') matchesStatus = s.outstanding_balance > 0;

        return matchesSearch && matchesRisk && matchesStatus;
    });

    // Sorting Logic
    const sortedAccounts = React.useMemo(() => {
        if (!sortConfig) return filteredAccounts;
        return [...filteredAccounts].sort((a, b) => {
            // @ts-ignore
            const aValue = a[sortConfig.key];
            // @ts-ignore
            const bValue = b[sortConfig.key];

            if (aValue === undefined || bValue === undefined) return 0;

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredAccounts, sortConfig]);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* 1️⃣ KPI Summary Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <KPICard
                    label="Active Accounts"
                    value={accountsHost.length}
                    icon={<UsersIcon className="w-4 h-4" />}
                    color="text-blue-400"
                    trend="neutral"
                />
                <KPICard
                    label="Total Outstanding"
                    value={formatCurrency(totalDue, currency)}
                    icon={<AlertTriangleIcon className="w-4 h-4" />}
                    color="text-amber-500"
                    trend="up"
                />
                <KPICard
                    label="Total Collected"
                    value={formatCurrency(totalCollected, currency)}
                    icon={<CheckCircleIcon className="w-4 h-4" />}
                    color="text-emerald-500"
                    trend="up"
                />
                <KPICard
                    label="Efficiency Rate"
                    value={`${collectionEfficiency}%`}
                    icon={<ActivityIcon className="w-4 h-4" />}
                    color="text-purple-400"
                />
                <KPICard
                    label="Avg Days Overdue"
                    value="12 Days"
                    icon={<ClockIcon className="w-4 h-4" />}
                    color="text-red-400"
                />
            </div>

            {/* 2️⃣ Advanced Filter & Search Bar */}
            <div className="sticky top-4 z-20 bg-[#0c0d12]/90 backdrop-blur-xl border border-white/10 rounded-xl p-2 shadow-2xl flex flex-col md:flex-row gap-2 items-center">

                {/* Search */}
                <div className="relative flex-grow w-full md:w-auto">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                        type="text"
                        placeholder="Search by student name, ID, or grade..."
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full bg-white/[0.03] border border-transparent focus:border-white/10 rounded-lg pl-11 pr-4 py-2.5 text-xs font-medium text-white placeholder-white/20 focus:outline-none transition-all uppercase tracking-wide"
                    />
                </div>

                {/* Status Filters */}
                <div className="flex bg-white/[0.03] p-1 rounded-lg border border-white/5 overflow-x-auto w-full md:w-auto scrollbar-hide">
                    {['ALL', 'ACTIVE', 'OVERDUE', 'PAID'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status as any)}
                            className={`px-4 py-2 rounded-md text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${statusFilter === status
                                    ? 'bg-white text-black shadow-lg'
                                    : 'text-white/30 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>

                {/* Advanced Actions */}
                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={onRiskToggle}
                        className={`px-4 py-2.5 rounded-lg border flex items-center gap-2 transition-all ${riskOnly
                                ? 'bg-red-500/10 border-red-500/40 text-red-500'
                                : 'bg-white/[0.03] border-white/5 text-white/40 hover:text-white hover:border-white/10'
                            }`}
                    >
                        <AlertTriangleIcon className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-black uppercase tracking-widest hidden lg:inline">Risk Only</span>
                    </button>

                    <button
                        onClick={onExport}
                        className="px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/10 text-white/40 hover:text-white rounded-lg flex items-center gap-2 transition-all group"
                    >
                        <DownloadIcon className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
                        <span className="text-[9px] font-black uppercase tracking-widest hidden lg:inline">Export</span>
                    </button>
                </div>
            </div>

            {/* 3️⃣ Accounts Receivable Data Grid */}
            <div className="bg-[#12141c] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative min-h-[600px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#0a0b10] border-b border-white/5 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 pl-6 text-[9px] font-black text-white/30 uppercase tracking-[0.15em] cursor-pointer hover:text-white" onClick={() => handleSort('display_name')}>
                                    Student Identity {sortConfig?.key === 'display_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </th>
                                <th className="p-4 text-[9px] font-black text-white/30 uppercase tracking-[0.15em] cursor-pointer hover:text-white text-right" onClick={() => handleSort('total_billed')}>
                                    Total Billed
                                </th>
                                <th className="p-4 text-[9px] font-black text-white/30 uppercase tracking-[0.15em] cursor-pointer hover:text-white text-right" onClick={() => handleSort('total_paid')}>
                                    Paid
                                </th>
                                <th className="p-4 text-[9px] font-black text-white/30 uppercase tracking-[0.15em] cursor-pointer hover:text-white text-right" onClick={() => handleSort('outstanding_balance')}>
                                    Outstanding
                                </th>
                                <th className="p-4 text-[9px] font-black text-white/30 uppercase tracking-[0.15em] text-center">
                                    Status
                                </th>
                                <th className="p-4 pr-6 text-[9px] font-black text-white/30 uppercase tracking-[0.15em] text-right">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                            {sortedAccounts.length > 0 ? sortedAccounts.map((account, idx) => (
                                <motion.tr
                                    key={account.student_id}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.01 }}
                                    onClick={() => onSelectAccount(account)}
                                    className="group hover:bg-white/[0.02] cursor-pointer transition-colors"
                                >
                                    <td className="p-4 pl-6">
                                        <div className="flex items-center gap-4">
                                            <PremiumAvatar
                                                src={account.profile_photo_url}
                                                name={account.display_name}
                                                size="sm"
                                                className="w-10 h-10 rounded-xl border border-white/10 group-hover:border-white/30 transition-all"
                                            />
                                            <div>
                                                <div className="text-sm font-bold text-white/90 group-hover:text-white">{account.display_name}</div>
                                                <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest">{account.class_name || 'UNASSIGNED'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className="text-xs font-mono font-medium text-white/40">{formatCurrency(account.total_billed, currency)}</span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className="text-xs font-mono font-bold text-emerald-500/80">{formatCurrency(account.total_paid, currency)}</span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className={`text-sm font-mono font-bold tracking-tight ${account.outstanding_balance > 0 ? 'text-white' : 'text-white/20'}`}>
                                            {formatCurrency(account.outstanding_balance, currency)}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-widest border ${account.outstanding_balance <= 0
                                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                : (account.integrity_score || 0) < 60
                                                    ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                            }`}>
                                            {account.outstanding_balance <= 0 ? 'SETTLED' : (account.integrity_score || 0) < 60 ? 'OVERDUE' : 'ACTIVE'}
                                        </span>
                                    </td>
                                    <td className="p-4 pr-6 text-right">
                                        <button className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 text-[9px] font-bold text-white/40 hover:text-white uppercase tracking-wider transition-all">
                                            Manage
                                        </button>
                                    </td>
                                </motion.tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="py-32 text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-30">
                                            <div className="p-4 bg-white/5 rounded-full">
                                                <SearchIcon className="w-6 h-6 text-white" />
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">No Accounts Match Criteria</p>
                                            <button onClick={() => { setStatusFilter('ALL'); }} className="text-primary text-xs hover:underline">Reset Filters</button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Total Count Footer */}
                <div className="px-6 py-4 border-t border-white/5 bg-[#0a0b10] flex justify-between items-center text-[10px] font-bold text-white/30 uppercase tracking-widest">
                    <span>Showing {sortedAccounts.length} Accounts</span>
                    <span>Finance Registry v2.4</span>
                </div>
            </div>
        </div>
    );
};

export default FinanceAccounts;
