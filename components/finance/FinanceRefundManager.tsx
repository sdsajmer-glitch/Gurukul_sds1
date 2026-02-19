
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../services/supabase';
import { RefundRequest, CurrencyCode, StudentFeeSummary } from '../../types';
import Spinner from '../common/Spinner';
import { RefreshCwIcon } from '../icons/RefreshCwIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { XIcon } from '../icons/XIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { SearchIcon } from '../icons/SearchIcon';

interface FinanceRefundManagerProps {
    branchId: number | null;
    currency: CurrencyCode;
    students: StudentFeeSummary[];
}

const formatCurrency = (amount: number, currency: CurrencyCode) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0
    }).format(amount || 0);
};

const FinanceRefundManager: React.FC<FinanceRefundManagerProps> = ({ branchId, currency, students }) => {
    const [refunds, setRefunds] = useState<RefundRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // New refund form state
    const [newRefund, setNewRefund] = useState({
        student_id: '',
        amount: '',
        reason: '',
        refund_method: 'BANK_TRANSFER'
    });

    const [selectedStudentForRefund, setSelectedStudentForRefund] = useState<StudentFeeSummary | null>(null);

    const fetchRefunds = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_refund_requests', { p_branch_id: branchId });
            if (error) throw error;
            setRefunds(data || []);
        } catch (err) {
            console.error("Refund Sync Error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRefunds();
    }, [branchId]);

    const handleAction = async (id: number, action: 'APPROVE' | 'REJECT' | 'PROCESS') => {
        try {
            let status = 'PENDING_APPROVAL';
            if (action === 'APPROVE') status = 'APPROVED';
            if (action === 'REJECT') status = 'REJECTED';
            if (action === 'PROCESS') status = 'PROCESSED';

            const { error } = await supabase
                .from('finance_refund_requests')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
            fetchRefunds();
        } catch (err) {
            console.error("Refund Action Error:", err);
        }
    };

    const handleCreate = async () => {
        try {
            // Basic validation
            if (!newRefund.student_id || !newRefund.amount || !newRefund.reason) {
                alert("Please fill all fields");
                return;
            }

            const { error } = await supabase.from('finance_refund_requests').insert({
                branch_id: branchId,
                student_id: newRefund.student_id,
                amount: parseFloat(newRefund.amount),
                reason: newRefund.reason,
                refund_method: newRefund.refund_method,
                status: 'INITIATED',
                // requested_by is handled by RLS typically, but let's be explicit if needed
            });

            if (error) throw error;
            setIsCreateModalOpen(false);
            setNewRefund({ student_id: '', amount: '', reason: '', refund_method: 'BANK_TRANSFER' });
            setSelectedStudentForRefund(null);
            setSearchTerm('');
            fetchRefunds();
        } catch (err) {
            console.error("Create Refund Error:", err);
            alert("Failed to create refund request");
        }
    };

    const filteredStudents = students.filter(s =>
        s.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.student_id && s.student_id.toLowerCase().includes(searchTerm.toLowerCase()))
    ).slice(0, 5);

    if (loading && refunds.length === 0) return <Spinner />;

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-serif font-black text-white uppercase tracking-tight">Refund Governance</h3>
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em]">Managing {refunds.length} Active Requests</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-6 py-3 bg-primary text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg active:scale-95"
                >
                    <PlusIcon className="w-4 h-4" /> Initiate Refund
                </button>
            </div>

            <div className="bg-[#12141c]/60 border border-white/5 rounded-[2rem] overflow-hidden backdrop-blur-xl shadow-xl ring-1 ring-white/5">
                <table className="w-full text-left">
                    <thead className="bg-black/40 border-b border-white/5 text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">
                        <tr>
                            <th className="p-6 pl-8">Request ID</th>
                            <th className="p-6">Student</th>
                            <th className="p-6">Reason</th>
                            <th className="p-6 text-right">Amount</th>
                            <th className="p-6 text-center">Status</th>
                            <th className="p-6 pr-8 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                        {refunds.map(r => (
                            <tr key={r.id} className="group hover:bg-white/[0.02] transition-colors">
                                <td className="p-6 pl-8 font-mono text-[11px] text-white/40">REF_{r.id}</td>
                                <td className="p-6 text-[12px] font-bold text-white uppercase tracking-wider">{r.student_name || r.student_id}</td>
                                <td className="p-6 text-[11px] text-white/60">{r.reason}</td>
                                <td className="p-6 text-right font-mono text-emerald-400 font-bold">{formatCurrency(r.amount, currency)}</td>
                                <td className="p-6 text-center">
                                    <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${r.status === 'PROCESSED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                        r.status === 'REJECTED' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                            'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                        }`}>
                                        {r.status.replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="p-6 pr-8 text-right flex justify-end gap-2">
                                    {(r.status === 'INITIATED' || r.status === 'PENDING_APPROVAL') && (
                                        <>
                                            <button onClick={() => handleAction(r.id, 'APPROVE')} className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 transition-colors active:scale-95" title="Approve">
                                                <CheckCircleIcon className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleAction(r.id, 'REJECT')} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors active:scale-95" title="Reject">
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                    {r.status === 'APPROVED' && (
                                        <button onClick={() => handleAction(r.id, 'PROCESS')} className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-2 active:scale-95" title="Mark Processed">
                                            <RefreshCwIcon className="w-4 h-4" /> Process
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {refunds.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-20 text-center text-white/20 text-[10px] uppercase tracking-widest">No active refund requests</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Modal */}
            <AnimatePresence>
                {isCreateModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    >
                        <div className="bg-[#12141c] border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl relative">
                            <button onClick={() => setIsCreateModalOpen(false)} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"><XIcon className="w-5 h-5" /></button>
                            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-6">Initiate Refund Protocol</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Select Student Node</label>

                                    {!selectedStudentForRefund ? (
                                        <div className="relative">
                                            <SearchIcon className="absolute left-3 top-3 w-4 h-4 text-white/20" />
                                            <input
                                                type="text"
                                                placeholder="Search student name..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:border-primary/50 outline-none transition-colors"
                                            />
                                            {searchTerm && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1c25] border border-white/10 rounded-xl overflow-hidden z-20 shadow-2xl">
                                                    {filteredStudents.length > 0 ? filteredStudents.map(s => (
                                                        <div
                                                            key={s.student_id}
                                                            onClick={() => {
                                                                setSelectedStudentForRefund(s);
                                                                setNewRefund({ ...newRefund, student_id: s.student_id });
                                                                setSearchTerm('');
                                                            }}
                                                            className="p-3 hover:bg-white/5 cursor-pointer flex justify-between items-center transition-colors"
                                                        >
                                                            <span className="text-sm text-white">{s.display_name}</span>
                                                            <span className="text-[10px] text-white/40">{s.class_name}</span>
                                                        </div>
                                                    )) : (
                                                        <div className="p-3 text-xs text-white/30 text-center">No students found</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                                                    {selectedStudentForRefund.display_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white">{selectedStudentForRefund.display_name}</p>
                                                    <p className="text-[10px] text-white/40">{selectedStudentForRefund.class_name}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => { setSelectedStudentForRefund(null); setNewRefund({ ...newRefund, student_id: '' }); }} className="text-white/40 hover:text-white">
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Refund Amount</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-3 text-white/40 text-sm">₹</span>
                                        <input
                                            type="number"
                                            value={newRefund.amount}
                                            onChange={e => setNewRefund({ ...newRefund, amount: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white text-sm focus:border-primary/50 outline-none transition-colors"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Refund Method</label>
                                    <div className="flex gap-2">
                                        {['BANK_TRANSFER', 'CHEQUE', 'CASH'].map(m => (
                                            <button
                                                key={m}
                                                onClick={() => setNewRefund({ ...newRefund, refund_method: m })}
                                                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all ${newRefund.refund_method === m ? 'bg-white text-black border-white' : 'bg-transparent text-white/40 border-white/10 hover:border-white/20'}`}
                                            >
                                                {m.replace('_', ' ')}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Justification Log</label>
                                    <textarea
                                        value={newRefund.reason}
                                        onChange={e => setNewRefund({ ...newRefund, reason: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-primary/50 outline-none h-24 resize-none transition-colors"
                                        placeholder="Detailed reason for refund approval..."
                                    />
                                </div>

                                <button
                                    onClick={handleCreate}
                                    className="w-full py-4 bg-primary text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl hover:bg-primary/90 mt-4 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={!newRefund.student_id || !newRefund.amount || !newRefund.reason}
                                >
                                    Submit Request
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default FinanceRefundManager;
