
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, formatError } from '../../services/supabase';
import { ExpenseDashboardData, SchoolBranch, CurrencyCode, Expense } from '../../types';
import { PlusIcon } from '../icons/PlusIcon';
import Spinner from '../common/Spinner';
import AddExpenseModal from './AddExpenseModal';
import { SearchIcon } from '../icons/SearchIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { AnimatePresence, motion } from 'framer-motion';
import InvoicePreviewModal from './InvoicePreviewModal';
import ExpenseRow, { ExpenseDetailContent } from './ExpenseRow';
import FinanceWorkflowGuide from './FinanceWorkflowGuide';
import ConfirmationModal from '../common/ConfirmationModal';
import LedgerEvidenceModal from './LedgerEvidenceModal';
import { XIcon } from '../icons/XIcon';

interface ExpenseDashboardProps {
    data: ExpenseDashboardData;
    onRefresh: (isSilent?: boolean) => void;
    branchId: number | null;
    branches: SchoolBranch[];
    viewCurrency: CurrencyCode;
}

const ExpenseDashboard: React.FC<ExpenseDashboardProps> = ({ onRefresh, branchId, branches, viewCurrency }) => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('All');
    const [filterStatus, setFilterStatus] = useState<string>('All');
    
    // UI Logic States
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ id: number; status: 'Approved' | 'Rejected' } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [mobileDrawerExpense, setMobileDrawerExpense] = useState<Expense | null>(null);
    const [viewingLedgerExpense, setViewingLedgerExpense] = useState<Expense | null>(null);
    
    const fetchMetadata = useCallback(async () => {
        const { data } = await supabase.from('expense_categories').select('*').order('name');
        if (data) setCategories(data);
    }, []);

    const fetchExpenses = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase.rpc('get_expense_registry_v3', {
                p_branch_id: branchId,
                p_category_id: filterCategory === 'All' ? null : parseInt(filterCategory),
                p_status: filterStatus === 'All' ? null : filterStatus
            });
            
            if (error) throw error;
            setExpenses(data || []);
        } catch (err: any) {
            setError(formatError(err));
        } finally {
            setLoading(false);
        }
    }, [branchId, filterCategory, filterStatus]);

    useEffect(() => { 
        fetchMetadata();
        fetchExpenses(); 
    }, [fetchMetadata, fetchExpenses]);

    const filteredExpenses = useMemo(() => {
        return expenses.filter(exp => {
            const searchLower = searchTerm.toLowerCase();
            return !searchTerm || 
                exp.description.toLowerCase().includes(searchLower) ||
                (exp.vendor_name || '').toLowerCase().includes(searchLower);
        });
    }, [expenses, searchTerm]);

    const handleToggleExpand = (expense: Expense) => {
        if (window.innerWidth < 768) {
            setMobileDrawerExpense(expense);
            return;
        }
        setExpandedId(expandedId === expense.id ? null : expense.id);
    };

    const handleExecuteAudit = async () => {
        if (!confirmAction) return;
        setIsProcessing(true);
        try {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user) throw new Error("Security credentials node lost.");

            const { error: rpcError } = await supabase.rpc('admin_audit_expense', {
                p_expense_id: confirmAction.id,
                p_status: confirmAction.status,
                p_admin_id: userData.user.id
            });

            if (rpcError) throw rpcError;
            
            // UI Sync
            await fetchExpenses(true);
            onRefresh(true);
            setConfirmAction(null);
            setMobileDrawerExpense(null);
        } catch (err: any) {
            alert(formatError(err));
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="w-full max-w-[1320px] mx-auto px-4 md:px-6 animate-in fade-in duration-1000">
            {/* --- MISSION CONTROL HEADER --- */}
            <header className="mb-20 flex flex-col md:flex-row justify-between items-start md:items-end gap-10 relative">
                <div className="space-y-6">
                    <h1 className="text-8xl md:text-[10rem] font-black text-white/[0.015] tracking-tighter uppercase leading-none select-none absolute -top-16 -left-8 pointer-events-none">
                        REGISTRY
                    </h1>
                    <div className="relative z-10">
                        <h2 className="text-5xl md:text-7xl font-serif font-black text-white tracking-tighter uppercase leading-[0.85]">
                            FINANCE <span className="text-white/20 italic font-medium lowercase">center.</span>
                        </h2>
                        <p className="text-sm md:text-xl text-white/40 font-medium font-serif italic mt-6 border-l-2 border-primary/20 pl-8 max-w-xl">
                            Institutional high-fidelity spend tracking, synchronized approval logic, and forensic audit confidence.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4 relative z-10 w-full md:w-auto no-print">
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex-grow md:flex-none h-16 px-12 bg-[#8B5CF6] text-white font-black text-xs uppercase tracking-[0.4em] rounded-[1.5rem] shadow-[0_32px_64px_-16px_rgba(139,92,246,0.5)] hover:bg-[#7C3AED] transition-all transform active:scale-95 flex items-center justify-center gap-4 ring-8 ring-primary/5 border border-white/10"
                    >
                        <PlusIcon className="w-6 h-6" /> Record Payload
                    </button>
                </div>
            </header>

            {/* --- HIGH-DENSITY SEARCH RIBBON --- */}
            <div className="bg-[#0D0F14]/90 backdrop-blur-3xl p-4 rounded-[3.5rem] border border-white/5 shadow-[0_48px_96px_-24px_rgba(0,0,0,1)] mb-16 flex flex-col lg:flex-row gap-6 items-center no-print ring-1 ring-white/5">
                <div className="relative flex-grow w-full group">
                    <SearchIcon className="absolute left-8 top-1/2 -translate-y-1/2 h-6 w-6 text-white/10 group-focus-within:text-primary transition-all duration-500" />
                    <input 
                        type="text" 
                        placeholder="SEARCH DISBURSEMENTS OR IDENTIFIERS..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value.toUpperCase())}
                        className="w-full h-[72px] pl-20 pr-8 bg-black/40 border border-white/5 rounded-[2.2rem] text-[15px] font-black text-white focus:bg-black/60 focus:ring-[15px] focus:ring-primary/5 outline-none transition-all placeholder:text-white/5 tracking-[0.2em] font-mono shadow-inner"
                    />
                </div>
                
                <div className="flex gap-4 w-full lg:w-auto overflow-x-auto no-scrollbar pb-1 lg:pb-0 px-2">
                    <select 
                        value={filterCategory} 
                        onChange={e => setFilterCategory(e.target.value)}
                        className="h-[72px] px-10 bg-black/60 border border-white/5 rounded-[1.8rem] text-[10px] font-black uppercase text-white/40 focus:text-primary outline-none cursor-pointer tracking-[0.3em] shadow-2xl transition-all hover:bg-black"
                    >
                        <option value="All">All Categories</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
                    </select>
                    <select 
                        value={filterStatus} 
                        onChange={e => setFilterStatus(e.target.value)}
                        className="h-[72px] px-10 bg-black/60 border border-white/5 rounded-[1.8rem] text-[10px] font-black uppercase text-white/40 focus:text-primary outline-none cursor-pointer tracking-[0.3em] shadow-2xl transition-all hover:bg-black"
                    >
                        <option value="All">Active Roster</option>
                        <option value="Pending">Queue: Pending</option>
                        <option value="Approved">Vault: Approved</option>
                        <option value="Rejected">Flagged</option>
                    </select>
                </div>
            </div>

            {/* --- THE LEDGER STREAM --- */}
            <div className={`space-y-4 pb-48 transition-all duration-1000 ${expandedId !== null ? 'opacity-90' : 'opacity-100'}`}>
                {loading ? (
                    <div className="py-64 text-center space-y-12">
                        <Spinner size="lg" className="text-primary mx-auto" />
                        <p className="text-[11px] font-black uppercase text-white/10 tracking-[0.8em] animate-pulse">Establishing Node Connectivity</p>
                    </div>
                ) : filteredExpenses.length === 0 ? (
                    <div className="py-64 text-center flex flex-col items-center gap-10 opacity-30 animate-in fade-in duration-1000">
                        <div className="w-32 h-32 bg-white/[0.01] rounded-[4rem] border-2 border-dashed border-white/5 flex items-center justify-center shadow-inner">
                            <ClockIcon className="w-14 h-14 text-white/5" />
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Registry Standby.</h3>
                            <p className="text-xs font-black uppercase tracking-[0.6em] text-white/20">No matching nodes found in cycle</p>
                        </div>
                    </div>
                ) : (
                    filteredExpenses.map((exp) => (
                        <ExpenseRow 
                            key={exp.id}
                            expense={exp}
                            isExpanded={expandedId === exp.id}
                            onToggle={() => handleToggleExpand(exp)}
                            onAction={(id, status) => setConfirmAction({ id, status })}
                            onViewLedger={(e) => setViewingLedgerExpense(e)}
                            viewCurrency={viewCurrency}
                        />
                    ))
                )}
            </div>

            {/* --- MOBILE MODES --- */}
            <AnimatePresence>
                {mobileDrawerExpense && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setMobileDrawerExpense(null)}
                            className="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] md:hidden"
                        />
                        <motion.div 
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed inset-x-0 bottom-0 bg-[#0F1217] rounded-t-[4rem] z-[210] md:hidden max-h-[90vh] flex flex-col overflow-hidden shadow-[0_-32px_64px_rgba(0,0,0,0.8)] border-t border-white/10"
                        >
                            <div className="w-16 h-1.5 bg-white/10 rounded-full mx-auto my-8 shrink-0" />
                            <div className="flex-grow overflow-y-auto custom-scrollbar px-2">
                                <div className="p-8 sticky top-0 bg-[#0F1217]/95 backdrop-blur-md z-10 border-b border-white/5 flex justify-between items-end mb-6">
                                    <div>
                                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-3">{mobileDrawerExpense.category_name}</p>
                                        <h3 className="text-3xl font-black text-white uppercase tracking-tight leading-none">{mobileDrawerExpense.description}</h3>
                                    </div>
                                    <button onClick={() => setMobileDrawerExpense(null)} className="p-4 bg-white/5 rounded-2xl text-white/40 shadow-xl border border-white/5"><XIcon className="w-6 h-6"/></button>
                                </div>
                                <div className="px-6">
                                    <ExpenseDetailContent 
                                        expense={mobileDrawerExpense} 
                                        viewCurrency={viewCurrency} 
                                        onAction={(id, status) => setConfirmAction({ id, status })} 
                                        onViewLedger={(e) => setViewingLedgerExpense(e)}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* --- SHARED MODALS --- */}
            <AnimatePresence>
                {isAddModalOpen && (
                    <AddExpenseModal 
                        branchId={branchId}
                        onClose={() => setIsAddModalOpen(false)} 
                        onSave={() => { fetchExpenses(true); onRefresh(true); setIsAddModalOpen(false); }} 
                    />
                )}
                
                {viewingLedgerExpense && (
                    <LedgerEvidenceModal 
                        expense={viewingLedgerExpense}
                        viewCurrency={viewCurrency}
                        onClose={() => setViewingLedgerExpense(null)}
                    />
                )}

                {confirmAction && (
                    <ConfirmationModal 
                        isOpen={!!confirmAction}
                        onClose={() => setConfirmAction(null)}
                        onConfirm={handleExecuteAudit}
                        title={confirmAction.status === 'Approved' ? 'Authorize Sync' : 'Flag Payload'}
                        message={confirmAction.status === 'Approved' ? 
                            "Confirming this transaction will synchronize the capital magnitude with the general ledger. This action is immutable." : 
                            "Flagging this entry will remove it from the verification queue and alert the reporting accountant for forensic review."}
                        confirmText={`Execute ${confirmAction.status}`}
                        variant={confirmAction.status === 'Approved' ? 'primary' : 'destructive'}
                        loading={isProcessing}
                    />
                )}
            </AnimatePresence>
            
            {isGuideOpen && <FinanceWorkflowGuide onClose={() => setIsGuideOpen(false)} />}
        </div>
    );
};

export default ExpenseDashboard;
