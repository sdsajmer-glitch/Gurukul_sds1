
import React from 'react';
import { motion } from 'framer-motion';
import {
    TrendingUpCustomIcon as TrendingUpIcon,
} from '../icons/TrendingUpIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { ArrowRightIcon } from '../icons/ArrowRightIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { SparklesIcon } from '../icons/SparklesIcon';
import RevenueTrendChart from './charts/RevenueTrendChart';
import CollectionDistributionChart from './charts/CollectionDistributionChart';
import { CurrencyCode, FinanceData, GradeCollectionStats } from '../../types';

interface FinanceOverviewProps {
    data: FinanceData;
    gradeStats?: GradeCollectionStats[];
    currency: CurrencyCode;
    onNavigate: (view: 'overview' | 'accounts' | 'master' | 'audit', filter?: any) => void;
    runOracle: () => void;
    projections?: {
        total_expected_yield: number;
        actual_yield: number;
        outstanding_liability: number;
        collection_velocity: number;
        confidence_index: number;
        projections: Array<{ node: string; amount: number; confidence: number }>;
    } | null;
    aiInsight: string | null;
    isAnalyzing: boolean;
    readiness: {
        isSetupComplete: boolean;
        hasStructures: boolean;
        hasAssignments: boolean;
        hasLedger: boolean;
        missingSteps: string[];
    };
}

const formatCurrency = (amount: number, currency: CurrencyCode) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
};

const KPIBlock: React.FC<{
    title: string;
    value: string;
    trend?: string;
    trendUp?: boolean;
    icon: React.ReactNode;
    color: string;
    onClick?: () => void;
}> = ({ title, value, icon, trend, trendUp, color, onClick }) => (
    <motion.div
        whileHover={{ y: -5 }}
        onClick={onClick}
        className="relative overflow-hidden bg-[#12141c] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl group cursor-pointer hover:border-primary/30 transition-all duration-500"
    >
        <div className={`absolute top-0 right-0 w-32 h-32 ${color} opacity-[0.03] rounded-bl-full group-hover:scale-110 transition-transform duration-1000`}></div>
        <div className="relative z-10">
            <div className="flex justify-between items-start mb-10">
                <div className="p-4 rounded-2xl bg-white/[0.03] text-white/30 border border-white/5 group-hover:text-primary transition-colors">
                    {icon}
                </div>
                {trend && (
                    <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border ${trendUp ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                        }`}>
                        {trendUp ? '↑' : '↓'} {trend}
                    </div>
                )}
            </div>
            <div>
                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mb-3">{title}</p>
                <div className="flex items-baseline gap-3">
                    <h3 className="text-4xl font-serif font-black text-white tracking-tighter leading-none">{value}</h3>
                    <div className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-pulse" />
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[9px] font-black text-primary uppercase tracking-widest">View Analytics</span>
                <ArrowRightIcon className="w-4 h-4 text-primary" />
            </div>
        </div>
    </motion.div>
);

const FinanceOverview: React.FC<FinanceOverviewProps> = ({
    data,
    gradeStats = [],
    currency,
    onNavigate,
    projections = null,
    runOracle,
    aiInsight,
    isAnalyzing,
    readiness
}) => {
    const isLedgerEmpty = data.total_assigned === 0;

    return (
        <div className="space-y-12 pb-12">
            {/* Layer 1 – Financial KPI Strip */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                <KPIBlock
                    title="Total Assigned"
                    value={isLedgerEmpty ? '₹0' : formatCurrency(data.total_assigned, currency)}
                    trend={isLedgerEmpty ? undefined : "+12.5%"}
                    trendUp={true}
                    icon={<TrendingUpIcon className="w-7 h-7" />}
                    color="bg-primary"
                    onClick={() => onNavigate('accounts')}
                />
                <KPIBlock
                    title="Total Collected"
                    value={isLedgerEmpty ? '₹0' : formatCurrency(data.total_collected, currency)}
                    trend={isLedgerEmpty ? undefined : "92%"}
                    trendUp={true}
                    icon={<CheckCircleIcon className="w-7 h-7" />}
                    color="bg-emerald-500"
                    onClick={() => onNavigate('accounts', { filter: 'paid' })}
                />
                <KPIBlock
                    title="Outstanding"
                    value={isLedgerEmpty ? '₹0' : formatCurrency(data.total_pending, currency)}
                    trend={isLedgerEmpty ? 'Inactive' : "Overdue"}
                    trendUp={false}
                    icon={<ClockIcon className="w-7 h-7" />}
                    color="bg-amber-500"
                    onClick={() => onNavigate('accounts', { filter: 'pending' })}
                />
                <KPIBlock
                    title="Active Pending"
                    value={isLedgerEmpty ? '₹0' : formatCurrency(data.total_pending * 0.4, currency)}
                    icon={<ClockIcon className="w-7 h-7" />}
                    color="bg-blue-500"
                />
                <KPIBlock
                    title="Overdue Critical"
                    value={isLedgerEmpty ? '₹0' : formatCurrency(data.total_overdue, currency)}
                    trend={isLedgerEmpty ? 'Zero Risk' : "High Risk"}
                    trendUp={false}
                    icon={<AlertTriangleIcon className="w-7 h-7" />}
                    color="bg-red-500"
                    onClick={() => onNavigate('accounts', { filter: 'overdue' })}
                />
                <KPIBlock
                    title="Burn Rate"
                    value={isLedgerEmpty ? '₹0' : formatCurrency(data.monthly_collection * 0.8, currency)}
                    trend={isLedgerEmpty ? 'N/A' : "Optimal"}
                    trendUp={true}
                    icon={<TrendingUpIcon className="w-7 h-7" />}
                    color="bg-purple-500"
                />
            </div>

            {/* Layer 2 & 3 – Cash Flow Analysis & Financial Health Ring */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
                <div className="lg:col-span-8 flex flex-col gap-10">
                    <div className="bg-[#12141c] border border-white/5 rounded-[3.5rem] p-10 shadow-3xl relative overflow-hidden h-[500px] ring-1 ring-white/5 group">
                        <div className="flex justify-between items-center mb-10 relative z-10">
                            <div>
                                <h4 className="text-2xl font-serif font-black text-white uppercase tracking-tight">Institutional Cash Flow</h4>
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mt-2">Historical Inflow vs Projection Matrix</p>
                            </div>
                            <div className="flex gap-2">
                                {['Weekly', 'Monthly', 'Quarterly'].map(t => (
                                    <button key={t} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${t === 'Monthly' ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10'
                                        }`}>
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {isLedgerEmpty ? (
                            <div className="h-full flex flex-col items-center justify-center p-20 text-center space-y-8">
                                <div className="p-8 bg-white/[0.02] rounded-full border border-white/5 shadow-inner">
                                    <TrendingUpIcon className="w-12 h-12 text-white/10" />
                                </div>
                                <div>
                                    <p className="text-xl font-serif font-black text-white/40 uppercase tracking-tighter">No Financial Vectors Detected</p>
                                    <p className="text-sm text-white/20 mt-2 max-w-sm mx-auto">Complete the Master configuration to initiate ledger generation and cash flow visualization.</p>
                                </div>
                            </div>
                        ) : (
                            <RevenueTrendChart total={data.total_collected} />
                        )}
                    </div>

                    {/* AI Oracle Component */}
                    <div className="bg-primary/[0.03] border border-primary/20 rounded-[3rem] p-10 relative overflow-hidden group shadow-2xl backdrop-blur-3xl ring-1 ring-primary/10">
                        <div className="absolute top-0 right-0 p-16 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000 rotate-12"><SparklesIcon className="w-64 h-64 text-primary" /></div>
                        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-[120px] opacity-20 pointer-events-none" />

                        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
                            <div className="space-y-6 max-w-3xl">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                                        <SparklesIcon className="w-6 h-6 text-primary" />
                                    </div>
                                    <h4 className="text-xl font-serif font-black text-white uppercase tracking-tight">Financial Intelligence Oracle</h4>
                                </div>
                                <div className="min-h-[60px]">
                                    {isLedgerEmpty ? (
                                        <p className="text-lg text-white/30 font-medium font-serif italic leading-relaxed">
                                            The Oracle requires institutional financial data to synthesize liquidity trends. Please finalize the Master setup protocol.
                                        </p>
                                    ) : aiInsight ? (
                                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xl md:text-2xl text-white/90 leading-tight font-serif italic tracking-tight">
                                            "{aiInsight}"
                                        </motion.p>
                                    ) : (
                                        <p className="text-lg text-white/30 font-medium font-serif italic leading-relaxed">
                                            Consult the institutional core to synthesize liquidity trends and collection risk matrices across the current branch cluster.
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={runOracle}
                                disabled={isAnalyzing || isLedgerEmpty}
                                className="px-10 py-5 bg-primary text-white font-black text-[10px] uppercase tracking-[0.4em] rounded-2xl shadow-2xl hover:bg-primary/90 transition-all flex items-center justify-center gap-4 active:scale-95 shadow-primary/20 ring-1 ring-white/20 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isAnalyzing ? 'SYNCHRONIZING...' : 'SYNC INTELLIGENCE'}
                                {!isAnalyzing && <ArrowRightIcon className="w-4 h-4 text-white/40" />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 bg-[#12141c] border border-white/5 rounded-[3.5rem] p-12 shadow-3xl flex flex-col relative overflow-hidden h-full ring-1 ring-white/5 group">
                    <div className="absolute top-0 right-0 p-12 opacity-[0.01] group-hover:opacity-[0.03] transition-opacity duration-1000"><TrendingUpIcon className="w-80 h-80 text-primary -rotate-12" /></div>

                    <div className="relative z-10 h-full flex flex-col">
                        <div className="flex items-center gap-4 mb-12">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">Financial Health Matrix</h4>
                        </div>

                        <div className="flex-grow flex items-center justify-center py-10">
                            {isLedgerEmpty ? (
                                <div className="text-center space-y-4">
                                    <div className="w-40 h-40 rounded-full border border-dashed border-white/10 flex items-center justify-center mx-auto">
                                        <ShieldCheckIcon className="w-12 h-12 text-white/5" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase text-white/10 tracking-[0.2em]">Matrix Pending Genesis</p>
                                </div>
                            ) : (
                                <div className="relative w-56 h-56 group/health">
                                    <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full opacity-40 group-hover/health:opacity-60 transition-opacity"></div>
                                    <svg className="w-full h-full -rotate-90 relative z-10" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/[0.03]" />
                                        <motion.circle
                                            cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="6" fill="transparent"
                                            initial={{ strokeDashoffset: 264 }}
                                            animate={{ strokeDashoffset: 264 - (264 * (data.health_index || 0) / 100) }}
                                            strokeDasharray={264}
                                            className="text-primary drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center flex-col z-20">
                                        <span className="text-5xl font-serif font-black text-white">{data.health_index || 0}</span>
                                        <span className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-1">Index Score</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-auto space-y-8 pt-10 border-t border-white/5">
                            {[
                                { label: 'Efficiency Ratio', value: isLedgerEmpty ? 'N/A' : `${data.collection_efficiency}%`, trend: isLedgerEmpty ? 'Inactive' : 'Target 95%', color: isLedgerEmpty ? 'text-white/20' : 'text-emerald-500' },
                                { label: 'Burn Consistency', value: isLedgerEmpty ? '0%' : `${data.burn_rate_stability}%`, trend: isLedgerEmpty ? 'Inactive' : 'Optimum', color: isLedgerEmpty ? 'text-white/20' : 'text-primary' },
                                { label: 'Risk Delta', value: isLedgerEmpty ? 'NULL' : (data.outstanding_ratio > 30 ? 'High' : 'Low'), trend: isLedgerEmpty ? 'Inactive' : 'Neutral', color: isLedgerEmpty ? 'text-white/20' : (data.outstanding_ratio > 30 ? 'text-red-500' : 'text-emerald-500') }
                            ].map((stat, i) => (
                                <div key={i} className="flex justify-between items-end">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">{stat.label}</p>
                                        <p className={`text-2xl font-serif font-black ${stat.color} tracking-tight`}>{stat.value}</p>
                                    </div>
                                    <span className="text-[9px] font-black text-white/10 uppercase tracking-widest bg-white/[0.03] px-2 py-1 rounded border border-white/5">{stat.trend}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Layer 4 – Recent Transactions Activity Feed */}
            <div className="bg-[#12141c] border border-white/5 rounded-[3.5rem] p-10 shadow-3xl relative overflow-hidden ring-1 ring-white/5">
                <div className="flex justify-between items-center mb-10">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/[0.03] rounded-2xl border border-white/5">
                            <CheckCircleIcon className="w-5 h-5 text-white/20" />
                        </div>
                        <h4 className="text-xl font-serif font-black text-white uppercase tracking-tight">Real-time Transaction Stream</h4>
                    </div>
                    <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline decoration-2 underline-offset-8 transition-all">View All Activity</button>
                </div>

                <div className="space-y-4">
                    {isLedgerEmpty ? (
                        <div className="py-16 text-center border-2 border-dashed border-white/5 rounded-3xl">
                            <p className="text-[12px] font-black uppercase text-white/10 tracking-[0.5em]">No Transactional Flow Recorded</p>
                        </div>
                    ) : (
                        [1, 2, 3].map(i => (
                            <div key={i} className="flex items-center justify-between p-6 bg-white/[0.02] border border-white/5 rounded-3xl hover:bg-white/[0.04] transition-all group">
                                <div className="flex items-center gap-6">
                                    <div className="h-12 w-12 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                                        <CheckCircleIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-serif font-black text-white leading-none">Capital Injection Protocol: STU_4930</p>
                                        <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-2 font-mono">NODE_TX_593021 • {new Date().toLocaleTimeString()}</p>
                                    </div>
                                </div>
                                <p className="text-2xl font-serif font-black text-emerald-500 tracking-tighter">+₹12,500</p>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Layer 5 – Structural Collection Matrix */}
            <div className="bg-[#12141c] border border-white/5 rounded-[3.5rem] p-10 shadow-3xl relative overflow-hidden ring-1 ring-white/5">
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h4 className="text-xl font-serif font-black text-white uppercase tracking-tight">Structural Collection Matrix</h4>
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mt-2">Performance benchmarking across institutional grades</p>
                    </div>
                    <button className="px-6 py-2.5 bg-white/5 border border-white/5 rounded-xl text-[9px] font-black text-white/40 uppercase tracking-widest hover:text-white transition-all">Export Matrix</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                    {gradeStats.map((stat, idx) => {
                        const totalBilled = Number(stat.total_billed) || 0;
                        const totalCollected = Number(stat.total_collected) || 0;
                        const collectionPercent = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

                        return (
                            <div key={idx} className="p-8 bg-white/[0.02] border border-white/5 rounded-[2.5rem] space-y-6 hover:border-primary/20 transition-all group">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">{stat.grade}</p>
                                        <h5 className="text-xl font-serif font-black text-white uppercase tracking-tight">GRADE_{stat.grade}</h5>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-[10px] font-black px-3 py-1 rounded-lg border ${collectionPercent > 80 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                            }`}>
                                            {Math.round(collectionPercent)}%
                                        </span>
                                    </div>
                                </div>

                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${collectionPercent}%` }}
                                        className={`h-full ${collectionPercent > 80 ? 'bg-emerald-500' : 'bg-primary'
                                            } shadow-[0_0_10px_rgba(59,130,246,0.3)]`}
                                    />
                                </div>

                                <div className="flex justify-between items-end pt-4">
                                    <div className="space-y-1">
                                        <p className="text-[8px] font-black text-white/10 uppercase tracking-widest">Outstanding</p>
                                        <p className="text-lg font-mono font-black text-red-500/80 tracking-tighter">{formatCurrency(stat.total_pending || 0, currency)}</p>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <p className="text-[8px] font-black text-white/10 uppercase tracking-widest">Inventory</p>
                                        <p className="text-lg font-mono font-black text-white/40 tracking-tighter">{stat.total_students || 0} Nodes</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Layer 6 – Financial Command Node (Projections) */}
            {projections && (
                <div className="bg-[#12141c] border border-white/5 rounded-[3.5rem] p-10 shadow-3xl relative overflow-hidden ring-1 ring-white/5">
                    <div className="absolute top-0 right-0 p-12 opacity-[0.02] -rotate-12">
                        <TrendingUpIcon className="w-48 h-48 text-primary" />
                    </div>

                    <div className="flex flex-col xl:flex-row gap-12 items-center">
                        <div className="xl:w-1/3 space-y-8">
                            <div>
                                <h4 className="text-xl font-serif font-black text-white uppercase tracking-tight">Revenue Projections</h4>
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mt-2">Fiscal Forecasting & Confidence Matrix</p>
                            </div>

                            <div className="p-8 bg-white/[0.03] border border-white/5 rounded-3xl space-y-4">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/40">
                                    <span>Confidence Index</span>
                                    <span className="text-primary">{projections.confidence_index}%</span>
                                </div>
                                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${projections.confidence_index}%` }}
                                        className="h-full bg-primary shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                                    />
                                </div>
                                <p className="text-[9px] text-white/20 leading-relaxed">Based on historical payment velocity and current billing saturation.</p>
                            </div>
                        </div>

                        <div className="xl:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                            {projections.projections.map((node, idx) => (
                                <div key={idx} className="p-6 bg-white/[0.01] border border-white/5 rounded-2xl flex justify-between items-center group hover:bg-white/[0.03] transition-all">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">{node.node.replace('_', ' ')}</p>
                                        <p className="text-2xl font-serif font-black text-white/80 tracking-tighter group-hover:text-white transition-colors">
                                            {formatCurrency(node.amount, currency)}
                                        </p>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <p className="text-[8px] font-black text-white/10 uppercase tracking-widest">Confidence</p>
                                        <p className={`text-[12px] font-mono font-black ${node.confidence > 0.8 ? 'text-emerald-500' :
                                                node.confidence > 0.6 ? 'text-amber-500' : 'text-red-500'
                                            }`}>
                                            {Math.round(node.confidence * 100)}%
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinanceOverview;
