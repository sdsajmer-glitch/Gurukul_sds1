
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
        whileHover={{ y: -8, backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.1)' }}
        onClick={onClick}
        className="relative overflow-hidden bg-[#12141c]/60 backdrop-blur-2xl border border-white/5 rounded-[3rem] p-10 shadow-3xl group cursor-pointer transition-all duration-500 ring-1 ring-white/5"
    >
        <div className={`absolute top-0 right-0 w-40 h-40 ${color} opacity-[0.03] rounded-bl-full group-hover:scale-110 transition-transform duration-1000`}></div>
        <div className="relative z-10 flex flex-col h-full justify-between gap-10">
            <div className="flex justify-between items-start">
                <div className={`w-14 h-14 rounded-2xl ${color} bg-opacity-10 flex items-center justify-center text-white ring-1 ring-white/10 group-hover:ring-white/20 transition-all`}>
                    {icon}
                </div>
                {trend && (
                    <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border ${trendUp ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                        }`}>
                        {trendUp ? '↑' : '↓'} {trend}
                    </div>
                )}
            </div>
            <div>
                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mb-4">{title}</p>
                <div className="flex items-baseline gap-3">
                    <h3 className="text-4xl font-serif font-black text-white tracking-tighter leading-none">{value}</h3>
                    <div className={`h-1.5 w-1.5 rounded-full ${trendUp ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`} />
                </div>
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
        <div className="space-y-16 pb-24">
            {/* Layer 1 – Financial KPI Strip */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-8">
                <KPIBlock
                    title="Total Assigned"
                    value={isLedgerEmpty ? '₹0' : formatCurrency(data.total_assigned, currency)}
                    trend={isLedgerEmpty ? undefined : "+12.5%"}
                    trendUp={true}
                    icon={<TrendingUpIcon className="w-6 h-6" />}
                    color="bg-primary"
                    onClick={() => onNavigate('accounts')}
                />
                <KPIBlock
                    title="Total Collected"
                    value={isLedgerEmpty ? '₹0' : formatCurrency(data.total_collected, currency)}
                    trend={isLedgerEmpty ? undefined : "92%"}
                    trendUp={true}
                    icon={<CheckCircleIcon className="w-6 h-6" />}
                    color="bg-emerald-500"
                    onClick={() => onNavigate('accounts', { filter: 'paid' })}
                />
                <KPIBlock
                    title="Outstanding"
                    value={isLedgerEmpty ? '₹0' : formatCurrency(data.total_pending, currency)}
                    trend={isLedgerEmpty ? 'Inactive' : "Overdue"}
                    trendUp={false}
                    icon={<ClockIcon className="w-6 h-6" />}
                    color="bg-amber-500"
                    onClick={() => onNavigate('accounts', { filter: 'pending' })}
                />
                <KPIBlock
                    title="Active Pending"
                    value={isLedgerEmpty ? '₹0' : formatCurrency(data.total_pending * 0.4, currency)}
                    icon={<ClockIcon className="w-6 h-6" />}
                    color="bg-indigo-500"
                />
                <KPIBlock
                    title="Overdue Critical"
                    value={isLedgerEmpty ? '₹0' : formatCurrency(data.total_overdue, currency)}
                    trend={isLedgerEmpty ? 'Zero Risk' : "High Risk"}
                    trendUp={false}
                    icon={<AlertTriangleIcon className="w-6 h-6" />}
                    color="bg-red-500"
                    onClick={() => onNavigate('accounts', { filter: 'overdue' })}
                />
                <KPIBlock
                    title="Burn Rate"
                    value={isLedgerEmpty ? '₹0' : formatCurrency(data.monthly_collection * 0.8, currency)}
                    trend={isLedgerEmpty ? 'N/A' : "Optimal"}
                    trendUp={true}
                    icon={<TrendingUpIcon className="w-6 h-6" />}
                    color="bg-purple-500"
                />
            </div>

            {/* Layer 2 & 3 – Cash Flow & Health Ring */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
                <div className="lg:col-span-8 flex flex-col gap-12">
                    <div className="bg-[#12141c]/60 backdrop-blur-3xl border border-white/5 rounded-[4rem] p-12 shadow-[0_64px_128px_-32px_rgba(0,0,0,0.6)] relative overflow-hidden h-[550px] ring-1 ring-white/5 group">
                        <div className="flex justify-between items-center mb-12 relative z-10">
                            <div>
                                <h4 className="text-3xl font-serif font-black text-white uppercase tracking-tight">Institutional Cash Flow</h4>
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] mt-3">Fiscal Dynamics & Liquidity Vectors</p>
                            </div>
                            <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/5">
                                {['Weekly', 'Monthly', 'Quarterly'].map(t => (
                                    <button key={t} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${t === 'Monthly' ? 'bg-white text-black shadow-2xl' : 'text-white/30 hover:text-white hover:bg-white/5'}`}>
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {isLedgerEmpty ? (
                            <div className="h-full flex flex-col items-center justify-center p-24 text-center space-y-10">
                                <div className="p-10 bg-white/[0.02] rounded-full border border-white/5 shadow-inner">
                                    <TrendingUpIcon className="w-16 h-16 text-white/5" />
                                </div>
                                <div className="space-y-4">
                                    <p className="text-2xl font-serif font-black text-white/40 uppercase tracking-tighter">No Financial Vectors Synchronized</p>
                                    <p className="text-[13px] text-white/20 max-w-sm mx-auto font-medium leading-relaxed">The institutional ledger is currently at rest. Initiate the setup protocol to visualize transaction velocity.</p>
                                </div>
                            </div>
                        ) : (
                            <RevenueTrendChart total={data.total_collected} />
                        )}
                    </div>

                    {/* AI Intelligence Oracle Polish */}
                    <div className="bg-primary/10 border border-primary/20 rounded-[4rem] p-12 relative overflow-hidden group shadow-3xl backdrop-blur-3xl ring-1 ring-primary/20">
                        <div className="absolute top-0 right-0 p-20 opacity-[0.05] group-hover:scale-125 transition-transform duration-[2000ms] -rotate-12"><SparklesIcon className="w-80 h-80 text-primary" /></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-40 pointer-events-none" />

                        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-16">
                            <div className="space-y-8 flex-1">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-primary rounded-[2rem] flex items-center justify-center text-white ring-8 ring-primary/10 shadow-[0_20px_40px_-10px_rgba(59,130,246,0.6)]">
                                        <SparklesIcon className="w-8 h-8 animate-pulse" />
                                    </div>
                                    <div>
                                        <h4 className="text-2xl font-serif font-black text-white uppercase tracking-tight">Institutional CFO Oracle</h4>
                                        <p className="text-[9px] font-black text-primary/60 uppercase tracking-[0.6em] mt-2 italic">Neural Financial Synthesis Node</p>
                                    </div>
                                </div>
                                <div className="min-h-[80px]">
                                    {isLedgerEmpty ? (
                                        <p className="text-xl text-white/30 font-serif italic leading-relaxed max-w-2xl">
                                            The Oracle is currently disconnected from the master registry. Deploy the institutional ledger nodes to initialize the intelligence stream.
                                        </p>
                                    ) : aiInsight ? (
                                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="relative">
                                            <span className="absolute -left-8 -top-4 text-7xl font-serif text-primary/20 leading-none">“</span>
                                            <p className="text-2xl md:text-3xl text-white font-serif italic tracking-tight leading-tight relative z-10">
                                                {aiInsight}
                                            </p>
                                        </motion.div>
                                    ) : (
                                        <p className="text-xl text-white/40 font-serif italic leading-relaxed max-w-2xl">
                                            Analyze the institutional financial matrix to extract liquidity risks, collection velocity, and fiscal anomalies across the current branch cluster.
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={runOracle}
                                disabled={isAnalyzing || isLedgerEmpty}
                                className="px-12 py-6 bg-white text-black hover:bg-primary hover:text-white transition-all font-black text-[11px] uppercase tracking-[0.5em] rounded-[1.5rem] shadow-3xl flex items-center justify-center gap-4 active:scale-95 group/btn whitespace-nowrap disabled:opacity-30 disabled:grayscale"
                            >
                                {isAnalyzing ? 'SYNCHRONIZING...' : 'POST_ANALYSIS_SYNC'}
                                {!isAnalyzing && <ArrowRightIcon className="w-5 h-5 group-hover/btn:translate-x-2 transition-transform" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Financial Health Matrix Polish */}
                <div className="lg:col-span-4 bg-[#12141c]/60 backdrop-blur-3xl border border-white/5 rounded-[4rem] p-12 shadow-[0_64px_128px_-32px_rgba(0,0,0,0.6)] flex flex-col relative overflow-hidden h-full ring-1 ring-white/5 group">
                    <div className="absolute top-0 right-0 p-12 opacity-[0.01] group-hover:scale-110 transition-transform duration-1000 rotate-12"><TrendingUpIcon className="w-96 h-96 text-primary" /></div>

                    <div className="relative z-10 h-full flex flex-col">
                        <div className="flex items-center gap-5 mb-16">
                            <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-pulse" />
                            <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">Global Audit Score</h4>
                        </div>

                        <div className="flex-grow flex items-center justify-center py-12">
                            {isLedgerEmpty ? (
                                <div className="text-center space-y-6">
                                    <div className="w-48 h-48 rounded-full border-2 border-dashed border-white/5 flex items-center justify-center mx-auto bg-white/[0.01]">
                                        <ShieldCheckIcon className="w-16 h-16 text-white/5" />
                                    </div>
                                    <p className="text-[11px] font-black uppercase text-white/10 tracking-[0.4em]">Node Logic Pending</p>
                                </div>
                            ) : (
                                <div className="relative w-64 h-64 group/health">
                                    <div className="absolute inset-0 bg-primary/20 blur-[80px] rounded-full opacity-40 group-hover/health:opacity-70 transition-opacity"></div>
                                    <svg className="w-full h-full -rotate-90 relative z-10" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/[0.05]" />
                                        <motion.circle
                                            cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="6" fill="transparent"
                                            initial={{ strokeDashoffset: 276 }}
                                            animate={{ strokeDashoffset: 276 - (276 * (data.health_index || 0) / 100) }}
                                            strokeDasharray={276}
                                            className="text-primary drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center flex-col z-20">
                                        <span className="text-7xl font-serif font-black text-white drop-shadow-2xl">{data.health_index || 0}</span>
                                        <span className="text-[11px] font-black text-white/30 uppercase tracking-[0.3em] mt-3">Balance Index</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-auto space-y-10 pt-12 border-t border-white/5">
                            {[
                                { label: 'Collection Efficiency', value: isLedgerEmpty ? 'NULL' : `${data.collection_efficiency}%`, status: isLedgerEmpty ? 'INACTIVE' : 'STABLE', color: 'text-emerald-500' },
                                { label: 'Burn Volatility', value: isLedgerEmpty ? '0%' : `${data.burn_rate_stability}%`, status: isLedgerEmpty ? 'INACTIVE' : 'NOMINAL', color: 'text-primary' },
                                { label: 'Risk Exposure', value: isLedgerEmpty ? 'N/A' : (data.outstanding_ratio > 30 ? 'CRITICAL' : 'SECURE'), status: isLedgerEmpty ? 'INACTIVE' : 'MONITORED', color: data.outstanding_ratio > 30 ? 'text-red-500' : 'text-emerald-500' }
                            ].map((stat, i) => (
                                <div key={i} className="flex justify-between items-end">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">{stat.label}</p>
                                        <p className={`text-3xl font-serif font-black ${isLedgerEmpty ? 'text-white/10' : stat.color} tracking-tight uppercase`}>{stat.value}</p>
                                    </div>
                                    <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] border border-white/5 px-3 py-1.5 rounded-xl bg-white/[0.03] group-hover:border-primary/20 transition-all">{stat.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Real-time Transaction Stream Upgrade */}
            <div className="bg-[#12141c]/60 backdrop-blur-3xl border border-white/5 rounded-[4rem] p-12 shadow-3xl relative overflow-hidden group">
                <div className="flex justify-between items-center mb-16 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-white/5 rounded-[2rem] flex items-center justify-center text-white/20 ring-1 ring-white/10">
                            <CheckCircleIcon className="w-8 h-8" />
                        </div>
                        <div>
                            <h4 className="text-3xl font-serif font-black text-white uppercase tracking-tight">Forensic Transaction Stream</h4>
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.6em] mt-3 italic">Live Capital Injection Monitoring</p>
                        </div>
                    </div>
                    <button className="text-[11px] font-black text-primary uppercase tracking-[0.5em] hover:text-white transition-all underline decoration-primary/20 decoration-2 underline-offset-[12px] hover:decoration-white font-serif italic">EXPLORE_DEEP_LEDGER_MAP</button>
                </div>

                <div className="space-y-6 relative z-10">
                    {isLedgerEmpty ? (
                        <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.01]">
                            <p className="text-xl font-serif font-black uppercase text-white/10 tracking-[0.6em]">No Capital Movement Protocols Detected</p>
                        </div>
                    ) : (
                        [1, 2, 3].map(i => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="flex items-center justify-between p-10 bg-white/[0.02] border border-white/[0.04] rounded-[3rem] hover:bg-white/[0.05] hover:border-emerald-500/30 transition-all group/tx shadow-xl"
                            >
                                <div className="flex items-center gap-10">
                                    <div className="h-20 w-20 rounded-[2.5rem] bg-black/40 border-2 border-white/5 flex items-center justify-center text-emerald-500 group-hover/tx:bg-emerald-500/10 group-hover/tx:border-emerald-500/30 transition-all shadow-inner">
                                        <CheckCircleIcon className="w-10 h-10" />
                                    </div>
                                    <div className="space-y-3">
                                        <p className="text-2xl font-serif font-black text-white uppercase tracking-tight group-hover/tx:text-emerald-500 transition-colors">Capital Sync Node: STU_4930_{i}</p>
                                        <div className="flex items-center gap-4 text-[11px] font-black text-white/10 uppercase tracking-widest font-mono">
                                            <span className="text-emerald-500/40">NODE_TX_593021</span>
                                            <span className="w-1.5 h-1.5 rounded-full bg-white/5" />
                                            <span>{new Date().toLocaleTimeString()}</span>
                                            <span className="w-1.5 h-1.5 rounded-full bg-white/5" />
                                            <span className="text-primary/40 italic">Institution_Protocol_Alpha</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-5xl font-serif font-black text-emerald-500 tracking-tighter drop-shadow-[0_0_15px_rgba(16,185,129,0.3)] shadow-emerald-500">
                                        +₹12,500<span className="text-xl font-mono text-emerald-500/40 ml-2 italic">settled</span>
                                    </p>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>

            {/* Structural Collection Matrix Upgrade */}
            <div className="bg-[#12141c]/60 backdrop-blur-3xl border border-white/5 rounded-[4rem] p-12 shadow-[0_64px_128px_-32px_rgba(0,0,0,0.6)] relative overflow-hidden ring-1 ring-white/5 group">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16 relative z-10">
                    <div>
                        <h4 className="text-3xl font-serif font-black text-white uppercase tracking-tight">Structural Collection Matrix</h4>
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.6em] mt-3 italic">Performance Benchmarking & Node Saturation Index</p>
                    </div>
                    <button className="px-10 py-4 bg-white/5 border border-white/5 hover:border-white/20 rounded-[1.25rem] text-[10px] font-black text-white/40 hover:text-white uppercase tracking-[0.4em] transition-all shadow-xl backdrop-blur-md">
                        MATRIX_RECON_EXPORT
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-10 relative z-10">
                    {gradeStats.map((stat, idx) => {
                        const totalBilled = Number(stat.total_billed) || 0;
                        const totalCollected = Number(stat.total_collected) || 0;
                        const collectionPercent = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

                        return (
                            <motion.div
                                key={idx}
                                whileHover={{ y: -8, backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' }}
                                className="p-10 bg-white/[0.02] border border-white/5 rounded-[3.5rem] space-y-8 transition-all group/card shadow-2xl relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-8 opacity-0 group-hover/card:opacity-10 transition-opacity duration-1000 rotate-12">
                                    <CheckCircleIcon className="w-20 h-20 text-emerald-500" />
                                </div>
                                <div className="flex justify-between items-start">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Structural Node</p>
                                        <h5 className="text-2xl font-serif font-black text-white uppercase tracking-tight group-hover/card:text-primary transition-colors">Grade {stat.grade}</h5>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-[11px] font-black px-4 py-2 rounded-xl border font-mono tracking-tighter ${collectionPercent > 80 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                                            {collectionPercent.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${collectionPercent}%` }}
                                            className={`h-full ${collectionPercent > 80 ? 'bg-emerald-500' : 'bg-primary'} shadow-[0_0_15px_rgba(59,130,246,0.4)]`}
                                        />
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.2em]">{stat.total_students} Registered Nodes</p>
                                        <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.2em]">Efficiency Protocol</p>
                                    </div>
                                </div>

                                <div className="flex justify-between items-end pt-8 border-t border-white/5">
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Audit Outstanding</p>
                                        <p className="text-2xl font-serif font-black text-red-500/80 tracking-tighter italic">{formatCurrency(stat.total_pending || 0, currency)}</p>
                                    </div>
                                    <div className="text-right space-y-2">
                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Yield Integrity</p>
                                        <p className="text-2xl font-serif font-black text-white/20 tracking-tighter">{stat.total_students || 0}</p>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Layer 6 – Financial Command Node (Projections) Upgrade */}
            {projections && (
                <div className="bg-[#12141c]/60 backdrop-blur-3xl border border-white/5 rounded-[4rem] p-16 shadow-[0_64px_128px_-32px_rgba(0,0,0,0.6)] relative overflow-hidden ring-1 ring-white/5">
                    <div className="absolute top-0 right-0 p-16 opacity-[0.05] -rotate-12 group-hover:scale-110 transition-transform duration-[3000ms]">
                        <TrendingUpIcon className="w-96 h-96 text-primary" />
                    </div>

                    <div className="flex flex-col xl:flex-row gap-20 items-center relative z-10">
                        <div className="xl:w-1/3 space-y-12">
                            <div className="space-y-4">
                                <h4 className="text-4xl font-serif font-black text-white uppercase tracking-tight">Fiscal Projection Matrix</h4>
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] italic">Forecasting & Collection Velocity Benchmarking</p>
                            </div>

                            <div className="p-12 bg-white/[0.03] border border-white/5 rounded-[3.5rem] space-y-8 shadow-inner ring-1 ring-white/5">
                                <div className="flex justify-between items-center text-[12px] font-black uppercase tracking-[0.4em] text-white/40">
                                    <span>Confidence Vector</span>
                                    <span className="text-primary font-mono text-xl">{projections.confidence_index}%</span>
                                </div>
                                <div className="h-2.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${projections.confidence_index}%` }}
                                        className="h-full bg-primary shadow-[0_0_20px_rgba(59,130,246,0.6)]"
                                    />
                                </div>
                                <p className="text-[11px] text-white/20 leading-relaxed font-medium uppercase tracking-tight">Based on historical payment velocity, cluster saturation, and current structural billing maturity.</p>
                            </div>
                        </div>

                        <div className="xl:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                            {projections.projections.map((node, idx) => (
                                <motion.div
                                    key={idx}
                                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.03)' }}
                                    className="p-10 bg-white/[0.01] border border-white/5 rounded-[3rem] flex justify-between items-center group transition-all shadow-2xl backdrop-blur-md"
                                >
                                    <div className="space-y-3">
                                        <p className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em]">{node.node.replace('_', ' ')} Projection</p>
                                        <p className="text-4xl font-serif font-black text-white group-hover:text-primary transition-colors tracking-tighter italic">
                                            {formatCurrency(node.amount, currency)}
                                        </p>
                                    </div>
                                    <div className="text-right space-y-3">
                                        <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.4em]">Node Confidence</p>
                                        <div className={`text-2xl font-mono font-black px-4 py-2 rounded-2xl border ${node.confidence > 0.8 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                            node.confidence > 0.6 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                                            }`}>
                                            {Math.round(node.confidence * 100)}%
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinanceOverview;
