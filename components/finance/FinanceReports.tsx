
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../services/supabase';
import {
    FeeCollectionReportItem,
    ExpenseReportItem,
    StudentLedgerEntry,
    StudentFeeSummary
} from '../../types';
import Spinner from '../common/Spinner';
import { FileTextIcon } from '../icons/FileTextIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { UsersIcon } from '../icons/UsersIcon';

const REPORT_TYPES = [
    { id: 'fee_collection', label: 'Fee Collection Report', available: true },
    { id: 'expense_summary', label: 'Expense Summary', available: true },
    { id: 'student_ledger', label: 'Student Ledger', available: true },
    { id: 'revenue_vs_dues', label: 'Revenue vs Dues', available: false },
    { id: 'component_wise', label: 'Component-wise Report', available: false },
    { id: 'class_wise', label: 'Class-wise Report', available: false },
];

const FinanceReports: React.FC = () => {
    const [reportType, setReportType] = useState('fee_collection');
    const [filters, setFilters] = useState({
        startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        studentId: ''
    });

    const [students, setStudents] = useState<StudentFeeSummary[]>([]);
    const [reportData, setReportData] = useState<any[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch students for ledger dropdown
    useEffect(() => {
        const fetchStudents = async () => {
            const { data, error } = await supabase.rpc('get_student_fee_dashboard');
            if (data) setStudents(data);
        };
        fetchStudents();
    }, []);

    const handleGenerateReport = async () => {
        setLoading(true);
        setError(null);
        setReportData(null);

        try {
            let data, rpcError;
            switch (reportType) {
                case 'fee_collection':
                    ({ data, error: rpcError } = await supabase.rpc('get_fee_collection_report', { p_start_date: filters.startDate, p_end_date: filters.endDate }));
                    break;
                case 'expense_summary':
                    ({ data, error: rpcError } = await supabase.rpc('get_expense_summary_report', { p_start_date: filters.startDate, p_end_date: filters.endDate }));
                    break;
                case 'student_ledger':
                    if (!filters.studentId) throw new Error("SELECT_TARGET_NODE_IDENTIFIER");
                    ({ data, error: rpcError } = await supabase.rpc('get_student_ledger_report', { p_student_id: filters.studentId }));
                    break;
                default:
                    throw new Error("PROTOCOL_NOT_YET_INITIALIZED");
            }
            if (rpcError) throw rpcError;
            setReportData(data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        if (!reportData || reportData.length === 0) return;

        const headers = Object.keys(reportData[0]).join(',');
        const csv = reportData.map(row =>
            Object.values(row).map(value =>
                typeof value === 'string' && value.includes(',') ? `"${value}"` : value
            ).join(',')
        ).join('\n');

        const csvContent = `data:text/csv;charset=utf-8,${headers}\n${csv}`;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `INTEL_${reportType}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const columns = useMemo(() => {
        if (!reportData || reportData.length === 0) return [];
        return Object.keys(reportData[0]).map(key => ({
            key,
            label: key.replace(/_/g, ' ').toUpperCase()
        }));
    }, [reportData]);

    return (
        <div className="space-y-12 animate-in fade-in duration-700">
            {/* 1. Intelligence Calibration Ribbon */}
            <div className="bg-white/[0.01] p-10 rounded-[3rem] border border-white/5 shadow-3xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] to-transparent pointer-events-none"></div>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-end">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.5em] ml-2">Intelligence Type</label>
                        <div className="relative group/select">
                            <select
                                value={reportType}
                                onChange={e => setReportType(e.target.value)}
                                className="w-full h-16 px-6 text-[12px] font-black text-white bg-black/40 border border-white/5 rounded-2xl outline-none appearance-none cursor-pointer uppercase tracking-widest focus:border-primary/40 transition-all"
                            >
                                {REPORT_TYPES.map(rt => <option key={rt.id} value={rt.id} disabled={!rt.available} className="bg-[#0c0d12]">{rt.label}{!rt.available ? ' [OFFLINE]' : ''}</option>)}
                            </select>
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-white/10 group-hover/select:text-primary transition-colors"><FileTextIcon className="w-4 h-4" /></div>
                        </div>
                    </div>
                    {reportType !== 'student_ledger' ? (
                        <>
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.5em] ml-2">Temporal Start</label>
                                <div className="relative group/date">
                                    <input
                                        type="date"
                                        value={filters.startDate}
                                        onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
                                        className="w-full h-16 px-6 text-[12px] font-black text-white bg-black/40 border border-white/5 rounded-2xl outline-none cursor-pointer uppercase tracking-widest focus:border-primary/40 transition-all"
                                    />
                                    <CalendarIcon className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-white/10 group-hover/date:text-primary transition-colors" />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.5em] ml-2">Temporal End</label>
                                <div className="relative group/date">
                                    <input
                                        type="date"
                                        value={filters.endDate}
                                        onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
                                        className="w-full h-16 px-6 text-[12px] font-black text-white bg-black/40 border border-white/5 rounded-2xl outline-none cursor-pointer uppercase tracking-widest focus:border-primary/40 transition-all"
                                    />
                                    <CalendarIcon className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-white/10 group-hover/date:text-primary transition-colors" />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="lg:col-span-2 space-y-4">
                            <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.5em] ml-2">Target Node Resolution</label>
                            <div className="relative group/select">
                                <select
                                    value={filters.studentId}
                                    onChange={e => setFilters(f => ({ ...f, studentId: e.target.value }))}
                                    className="w-full h-16 px-6 text-[12px] font-black text-white bg-black/40 border border-white/5 rounded-2xl outline-none appearance-none cursor-pointer uppercase tracking-widest focus:border-primary/40 transition-all"
                                >
                                    <option value="" className="bg-[#0c0d12]">SELECT_STUDENT_IDENTITY...</option>
                                    {students.map(s => <option key={s.student_id} value={s.student_id} className="bg-[#0c0d12]">{s.display_name} [{s.class_name}]</option>)}
                                </select>
                                <UsersIcon className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-white/10 group-hover/select:text-primary transition-colors" />
                            </div>
                        </div>
                    )}
                    <button
                        onClick={handleGenerateReport}
                        disabled={loading}
                        className="h-16 bg-primary text-white font-black text-[10px] uppercase tracking-[0.5em] rounded-2xl shadow-3xl shadow-primary/10 hover:bg-[#8B5CF6] transition-all transform active:scale-95 disabled:opacity-20 flex items-center justify-center gap-4 group"
                    >
                        {loading ? <Spinner size="sm" className="text-white" /> : <><FileTextIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" /> Compile Intelligence</>}
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-[2.5rem] flex flex-col gap-4 shadow-2xl animate-in shake relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent"></div>
                    <p className="text-[10px] font-black uppercase text-red-500 tracking-[0.4em] relative z-10">Intelligence protocol violation</p>
                    <p className="text-sm font-medium text-red-400 leading-relaxed uppercase tracking-tight relative z-10">{error}</p>
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-8">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full animate-pulse"></div>
                        <Spinner size="lg" className="text-primary relative z-10" />
                    </div>
                    <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.5em] animate-pulse">Scanning Institutional Ledger Nodes...</p>
                </div>
            ) : reportData && (
                <div className="bg-white/[0.01] rounded-[3.5rem] border border-white/5 shadow-3xl relative overflow-hidden animate-in slide-in-from-bottom-5 duration-700">
                    <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent top-0"></div>
                    <div className="p-12 border-b border-white/[0.04] bg-white/[0.01] flex flex-col md:flex-row justify-between items-center gap-8 px-12">
                        <div className="space-y-2 text-center md:text-left">
                            <h3 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">{REPORT_TYPES.find(r => r.id === reportType)?.label}</h3>
                            <div className="flex items-center justify-center md:justify-start gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em]">
                                    {reportType !== 'student_ledger' ? `TEMPORAL_WINDOW: ${filters.startDate} TO ${filters.endDate}` : `NODE_TARGET: ${students.find(s => s.student_id === filters.studentId)?.display_name}`}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleExport}
                            className="h-14 px-12 rounded-[1.2rem] text-[10px] font-black uppercase text-white/40 hover:text-white hover:bg-white/5 border border-white/5 transition-all tracking-[0.4em] flex items-center gap-4 group/export active:scale-95"
                        >
                            <DownloadIcon className="w-5 h-5 group-hover/export:-translate-y-1 transition-transform" /> Dispatch Intel Payload (CSV)
                        </button>
                    </div>

                    <div className="overflow-x-auto p-12">
                        {reportData.length === 0 ? (
                            <div className="py-32 text-center space-y-6 opacity-20">
                                <FileTextIcon className="w-16 h-16 mx-auto" />
                                <p className="text-[10px] font-black uppercase tracking-[0.5em]">No Data Residue Detected for Selection</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-separate border-spacing-y-4">
                                <thead>
                                    <tr>
                                        {columns.map(c => (
                                            <th key={c.key} className="px-8 pb-6 text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">{c.label}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="space-y-4">
                                    {reportData.map((row, idx) => (
                                        <tr key={idx} className="group/row">
                                            {columns.map(col => (
                                                <td key={col.key} className="px-8 py-7 bg-white/[0.02] first:rounded-l-[2rem] last:rounded-r-[2rem] border-y border-white/[0.03] first:border-l last:border-r group-hover/row:bg-white/[0.04] group-hover/row:border-white/10 transition-all duration-300">
                                                    <span className={`text-[13px] font-black uppercase tracking-tight ${['amount', 'debit', 'credit', 'balance'].includes(col.key) ? 'font-serif text-white' : 'text-white/60'}`}>
                                                        {['payment_date', 'expense_date', 'transaction_date'].includes(col.key)
                                                            ? new Date(row[col.key]).toLocaleDateString()
                                                            : (['amount', 'debit', 'credit', 'balance'].includes(col.key)
                                                                ? `₹${Number(row[col.key]).toLocaleString()}`
                                                                : row[col.key])
                                                        }
                                                    </span>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinanceReports;
