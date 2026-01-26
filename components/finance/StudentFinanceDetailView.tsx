import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase, formatError } from '../../services/supabase';
import { StudentFeeSummary, CurrencyCode } from '../../types';
import Spinner from '../common/Spinner';
import { ChevronLeftIcon } from '../icons/ChevronLeftIcon';
import { ReceiptIcon } from '../icons/ReceiptIcon';
import RecordPaymentModal from './RecordPaymentModal';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { RefreshCwIcon } from '../icons/RefreshCwIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import PremiumAvatar from '../common/PremiumAvatar';
import { motion, AnimatePresence } from 'framer-motion';

// High-fidelity ledger components
import { LedgerTable } from './LedgerTable';
import { LedgerMobileCard } from './LedgerMobileCard';

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

const TabButton: React.FC<{ 
    id: string; 
    label: string; 
    active: boolean; 
    onClick: (id: any) => void;
}> = ({ id, label, active, onClick }) => (
    <button
        onClick={() => onClick(id)}
        className={`relative pb-4 text-[10px] font-black uppercase tracking-[0.4em] transition-all duration-500 ${active ? 'text-white' : 'text-white/20 hover:text-white/40'}`}
    >
        {label}
        {active && (
            <motion.div 
                layoutId="tabUnderlineRegistry" 
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary shadow-[0_0_12px_rgba(var(--primary),0.8)]"
            />
        )}
    </button>
);

const StudentFinanceDetailView: React.FC<StudentFinanceDetailViewProps> = ({ student: initialStudent, viewCurrency, onBack, onUpdate, onNavigateToMaster }) => {
    const [accountData, setAccountData] = useState<any>(initialStudent);
    const [ledger, setLedger] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [adjustments, setAdjustments] = useState<any[]>([]);
    const [assignedStructure, setAssignedStructure] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isResolving, setIsResolving] = useState(false);
    const [activeHistoryTab, setActiveHistoryTab] = useState<'ledger' | 'adjustments' | 'audit'>('ledger');

    const isMounted = useRef(true);

    const fetchAuditLogs = useCallback(async () => {
        const { data } = await supabase
            .from('finance_audit_logs')
            .select('*')
            .eq('student_id', initialStudent.student_id)
            .order('created_at', { ascending: false });
        if (data) setAuditLogs(data);
    }, [initialStudent.student_id]);

    const fetchAdjustments = useCallback(async () => {
        const { data } = await supabase
            .from('fee_adjustments')
            .select('*')
            .eq('student_id', initialStudent.student_id)
            .order('created_at', { ascending: false });
        if (data) setAdjustments(data);
    }, [initialStudent.student_id]);

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
            if (nodeData && nodeData[0]) {
                setAccountData(nodeData[0]);
            }

            // 2. Fetch Forensic Ledger
            const { data: ledgerData, error: ledgerError } = await supabase.rpc('get_student_running_ledger', { 
                p_student_id: initialStudent.student_id 
            });
            if (ledgerError) throw ledgerError;
            setLedger(ledgerData || []);

            // 3. Fetch Metadata (Structure, Logs, Adjustments)
            const { data: structData } = await supabase
                .from('student_fee_assignments')
                .select('*, fee_structures(*, fee_components(*))')
                .eq('student_id', initialStudent.student_id)
                .maybeSingle();

            setAssignedStructure(structData?.fee_structures || null);
            
            await Promise.all([fetchAuditLogs(), fetchAdjustments()]);

        } catch (err) {
            console.error("Critical Registry Desync:", err);
            setError(formatError(err));
        } finally {
            if (isMounted.current) setLoading(false);
        }
    }, [initialStudent.student_id, fetchAuditLogs, fetchAdjustments]);

    useEffect(() => {
        isMounted.current = true;
        refreshAccountStatus();
        return () => { isMounted.current = false; };
    }, [refreshAccountStatus]);

    const handleAutoResolveStandby = async () => {
        setIsResolving(true);
        try {
            // Attempt to bind to a Master Structure automatically
            const { data, error } = await supabase.rpc('admin_sync_student_billing', { 
                p_student_id: accountData.student_id 
            });
            if (error) throw error;
            
            if (data && data.success) {
                await refreshAccountStatus(true);
                onUpdate();
            } else {
                if (confirm(`${data.message || 'Node resolution failed'}. Navigate to Master Architect to configure Grade ${accountData.grade} structure?`)) {
                    onNavigateToMaster();
                }
            }
        } catch (err) {
            alert("Handshake Exception: " + formatError(err));
        } finally {
            setIsResolving(false);
        }
    };

    const mappedLedgerEntries = useMemo(() => {
        return (ledger || []).map(e => {
            const dateObj = new Date(e.transaction_date);
            return {
                date: isNaN(dateObj.getTime()) ? 'PENDING' : dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
                description: e.description,
                note: e.identifier,
                debit: Number(e.debit) > 0 ? Number(e.debit) : undefined,
                credit: Number(e.credit) > 0 ? Number(e.credit) : undefined,
                balance: Number(e.running_balance),
                protocol: e.protocol
            };
        });
    }, [ledger]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-48 gap-8">
                <Spinner size="lg" className="text-primary" />
                <p className="text-[10px] font-black uppercase text-white/20 tracking-[0.5em] animate-pulse">Synchronizing Identity Stream</p>
            </div>
        );
    }

    const integrity = accountData.integrity_score ?? 100;
    const unallocated = Number(accountData.unallocated_funds || 0);

    return (
        <div className="min-h-screen bg-[#08090a] text-foreground font-sans selection:bg-primary/20 pb-32">
            <div className="max-w-[1400px] mx-auto px-6 md:px-12 pt-10 space-y-12 animate-in fade-in duration-700">
                
                {/* 1. TACTICAL NAVIGATION */}
                <div className="flex justify-between items-center no-print">
                    <button onClick={onBack} className="flex items-center gap-3 text-[10px] font-black text-white/30 uppercase tracking-[0.4em] hover:text-white transition-all group">
                        <ChevronLeftIcon className="w-4 h-4 transition-transform group-hover:-translate-x-1"/>
                        Return to Registry
                    </button>
                    <div className="flex items-center gap-4">
                        <button onClick={() => window.print()} className="p-3 bg-white/[0.03] rounded-xl border border-white/5 text-white/20 hover:text-white hover:bg-white/10 transition-all" title="Print statement"><DownloadIcon className="w-5 h-5"/></button>
                        <button onClick={() => refreshAccountStatus()} className="p-3 bg-white/[0.03] rounded-xl border border-white/5 text-white/20 hover:text-white hover:bg-white/10 transition-all" title="Force Re-Scan"><RefreshCwIcon className={`w-5 h-5 ${isResolving ? 'animate-spin text-primary' : ''}`} /></button>
                    </div>
                </div>

                {/* 2. IDENTITY TIER */}
                <section className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                    {/* Big Identity Card */}
                    <div className="xl:col-span-8 bg-[#0c0d12]/60 backdrop-blur-xl border border-white/[0.06] rounded-[3rem] p-10 md:p-14 shadow-2xl relative overflow-hidden ring-1 ring-white/5 group">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                            <div className="relative">
                                <div className="absolute -inset-4 bg-primary/20 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-1000"></div>
                                <PremiumAvatar 
                                    src={accountData.profile_photo_url} 
                                    name={accountData.display_name} 
                                    size="lg" 
                                    className="w-24 h-24 md:w-36 md:h-36 rounded-3xl border-4 border-white/5 shadow-3xl relative z-10" 
                                />
                            </div>
                            <div className="space-y-6 text-center md:text-left flex-grow">
                                <h2 className="text-5xl md:text-8xl font-serif font-black text-white tracking-tighter uppercase leading-none drop-shadow-2xl">
                                    {accountData.display_name}
                                </h2>
                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                                    <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em] bg-white/5 px-6 py-2 rounded-full border border-white/10">
                                        Grade {accountData.grade || 'A'}
                                    </span>
                                    <span className={`text-[10px] font-black uppercase tracking-[0.4em] px-6 py-2 rounded-full border ${accountData.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                        {accountData.is_active ? 'Active Node' : 'Suspended'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Integrity Score Radial */}
                    <div className="xl:col-span-4 bg-[#0c0d12]/80 backdrop-blur-xl border border-white/[0.06] rounded-[3rem] p-10 shadow-2xl flex flex-col justify-center items-center text-center space-y-6 relative overflow-hidden ring-1 ring-white/5">
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Integrity Score</p>
                        <div className="relative w-36 h-36 flex items-center justify-center">
                            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 160 160">
                                <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/[0.02]" />
                                <motion.circle 
                                    cx="80" cy="80" r="70" 
                                    stroke="currentColor" 
                                    strokeWidth="8" 
                                    fill="transparent" 
                                    initial={{ strokeDashoffset: 440 }}
                                    animate={{ strokeDashoffset: 440 - (440 * integrity) / 100 }}
                                    transition={{ duration: 2.5, ease: [0.23, 1, 0.32, 1] }}
                                    strokeDasharray={440}
                                    className="text-primary drop-shadow-[0_0_20px_rgba(var(--primary),0.6)]"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className="text-5xl font-black text-white tracking-tighter">{integrity}%</span>
                        </div>
                        <p className="text-[9px] font-black text-white/10 uppercase tracking-widest">Registry Compliance Level</p>
                    </div>
                </section>

                {/* 3. REGISTRY STANDBY BANNER */}
                <section>
                     <div className={`bg-[#0d0f14] border-2 rounded-[2.5rem] p-8 md:p-12 flex flex-col md:flex-row justify-between items-center gap-10 transition-all duration-700 ${accountData.is_standby ? 'border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.05)]' : 'border-white/5'}`}>
                         <div className="flex items-center gap-10">
                             <div className={`w-20 h-20 rounded-[1.8rem] flex items-center justify-center shadow-inner ${accountData.is_standby ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                                 {accountData.is_standby ? <AlertTriangleIcon className="w-10 h-10"/> : <CheckCircleIcon className="w-10 h-10" />}
                             </div>
                             <div className="space-y-3">
                                 {accountData.is_standby ? (
                                     <div className="flex flex-col gap-1">
                                        <p className="text-3xl font-black text-amber-500 tracking-tighter uppercase leading-none">
                                            {unallocated > 0 ? 'PARTIAL REGISTRY (UNALLOCATED FUNDS)' : 'REGISTRY STANDBY'}
                                        </p>
                                        <p className="text-base text-white/30 font-serif italic mt-1 max-w-xl leading-relaxed">
                                            {unallocated > 0 
                                                ? `Identified ${formatCurrency(unallocated, viewCurrency)} in advance settlements without a verified liability mapping. Resolve node to automate allocation.`
                                                : `Node awaiting academic architecture binding for Grade ${accountData.grade}...`}
                                        </p>
                                     </div>
                                 ) : (
                                     <div className="flex flex-col gap-1">
                                         <p className="text-3xl font-black text-white tracking-tighter uppercase leading-none">Node Protocol Verified</p>
                                         <p className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em] mt-1">Ledger Synchronized • {assignedStructure?.name || 'CORE_ARCHITECTURE'}</p>
                                     </div>
                                 )}
                             </div>
                         </div>
                         <div className="flex items-center gap-6">
                            {accountData.is_standby && (
                                <button 
                                    onClick={handleAutoResolveStandby} 
                                    disabled={isResolving}
                                    className="px-12 py-5 bg-amber-500 text-black font-black text-[11px] uppercase tracking-[0.4em] rounded-2xl hover:bg-amber-400 transition-all shadow-2xl active:scale-95 disabled:opacity-30 flex items-center justify-center gap-3"
                                >
                                    {isResolving ? <Spinner size="sm" className="text-current" /> : 'RESOLVE NODE'}
                                </button>
                            )}
                            <div className="flex flex-col items-end">
                                <span className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border ${accountData.is_standby ? 'bg-amber-500/20 text-amber-500 border-amber-500/20' : 'bg-emerald-500/20 text-emerald-500 border-emerald-500/20'}`}>
                                    {accountData.is_standby ? 'STANDBY' : 'ACTIVE'}
                                </span>
                            </div>
                         </div>
                     </div>
                </section>

                {/* 4. HISTORICAL REGISTRY AREA */}
                <section className="space-y-12">
                    <div className="flex flex-col md:flex-row justify-between items-end gap-10 px-4">
                         <div className="space-y-8 flex-grow max-w-2xl">
                            <h3 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-4 font-serif">
                                <ActivityIcon className="w-8 h-8 text-white/20" />
                                Historical Registry
                            </h3>
                            <nav className="flex items-center gap-12 border-b border-white/[0.03] w-full">
                                <TabButton id="ledger" label="Ledger Entries" active={activeHistoryTab === 'ledger'} onClick={setActiveHistoryTab} />
                                <TabButton id="adjustments" label="Adjustments" active={activeHistoryTab === 'adjustments'} onClick={setActiveHistoryTab} />
                                <TabButton id="audit" label="Audit Logs" active={activeHistoryTab === 'audit'} onClick={setActiveHistoryTab} />
                            </nav>
                         </div>
                         <div className="flex items-center gap-4 pb-2">
                            <button 
                                onClick={() => setIsPaymentModalOpen(true)} 
                                className="px-14 py-6 bg-primary text-white font-black text-[12px] uppercase tracking-[0.4em] rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(var(--primary),0.5)] hover:bg-primary/90 transition-all flex items-center gap-4 transform active:scale-95 border border-white/10 ring-8 ring-primary/5"
                            >
                                <ReceiptIcon className="w-6 h-6" /> Record Settlement
                            </button>
                         </div>
                    </div>

                    <div className="min-h-[500px]">
                        <AnimatePresence mode="wait">
                            {activeHistoryTab === 'ledger' && (
                                <motion.div key="ledger" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                    {mappedLedgerEntries.length > 0 ? (
                                        <>
                                            <div className="hidden md:block"><LedgerTable entries={mappedLedgerEntries} /></div>
                                            <div className="md:hidden space-y-6">{mappedLedgerEntries.map((e, idx) => <LedgerMobileCard key={idx} {...e} />)}</div>
                                        </>
                                    ) : <EmptyRegistry message="Zero Transaction Artifacts Detected" />}
                                </motion.div>
                            )}

                            {activeHistoryTab === 'adjustments' && (
                                <motion.div key="adjustments" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                    {adjustments.length > 0 ? (
                                        <div className="bg-[#0c0d12]/40 rounded-[3rem] border border-white/5 p-10 space-y-4">
                                            {adjustments.map(adj => (
                                                <div key={adj.id} className="flex justify-between items-center p-6 bg-white/[0.01] rounded-2xl border border-white/5">
                                                    <div>
                                                        <p className="text-sm font-bold text-white uppercase">{adj.reason || 'Manual Adjustment'}</p>
                                                        <p className="text-xs text-white/30 font-mono mt-1">{new Date(adj.created_at).toLocaleString()}</p>
                                                    </div>
                                                    <p className={`text-xl font-black ${adj.amount < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{formatCurrency(adj.amount, viewCurrency)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <EmptyRegistry message="No Correction Payloads Registered" />}
                                </motion.div>
                            )}

                            {activeHistoryTab === 'audit' && (
                                <motion.div key="audit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                    {auditLogs.length > 0 ? (
                                        <div className="bg-[#0c0d12]/40 rounded-[3rem] border border-white/5 overflow-hidden">
                                            <div className="divide-y divide-white/5">
                                                {auditLogs.map(log => (
                                                    <div key={log.id} className="p-8 flex items-center justify-between group hover:bg-white/[0.01] transition-colors">
                                                        <div className="flex items-center gap-8">
                                                            <div className="p-3 rounded-xl bg-white/5 text-white/20 group-hover:text-primary transition-colors"><ShieldCheckIcon className="w-5 h-5"/></div>
                                                            <div>
                                                                <p className="text-[13px] font-black text-white uppercase tracking-widest">{log.action_type}</p>
                                                                <p className="text-xs text-white/30 mt-1 font-serif italic">{log.description}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] font-mono font-bold text-white/20">{new Date(log.created_at).toLocaleString().toUpperCase()}</p>
                                                            <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest mt-1">BY: {log.performed_by_name || 'SYSTEM'}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : <EmptyRegistry message="Audit Stream Initializing" />}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </section>

                <footer className="pt-24 border-t border-white/[0.04] flex justify-center opacity-10 select-none pointer-events-none pb-12">
                     <p className="text-[10px] font-black uppercase tracking-[1em] text-white">Institutional Grade Ledger Protocol • v25.6 SAFE_NODE</p>
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

const EmptyRegistry = ({ message }: { message: string }) => (
    <div className="bg-[#0c0d12]/40 border border-white/[0.06] rounded-[4rem] shadow-3xl py-40 text-center relative flex flex-col items-center justify-center overflow-hidden ring-1 ring-white/5">
        <div className="flex flex-col items-center gap-12 animate-in fade-in duration-1000 relative z-10 opacity-30">
            <div className="text-white/10 text-6xl font-black">〰</div>
            <div className="space-y-4">
                <h4 className="text-xl font-black uppercase tracking-[0.5em] text-white/80 drop-shadow-sm font-serif">{message}</h4>
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40">Context Synchronized (Idle State)</p>
            </div>
        </div>
    </div>
);

export default StudentFinanceDetailView;