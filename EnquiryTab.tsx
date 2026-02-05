import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, formatError } from './services/supabase';
import { Enquiry, EnquiryStatus } from './types';
import Spinner from './components/common/Spinner';
import PremiumAvatar from './components/common/PremiumAvatar';
import EnquiryDetailsModal from './components/EnquiryDetailsModal';
import { SearchIcon } from './components/icons/SearchIcon';
import { KeyIcon } from './components/icons/KeyIcon';
import { MailIcon } from './components/icons/MailIcon';
import { CheckCircleIcon } from './components/icons/CheckCircleIcon';
import { ClockIcon } from './components/icons/ClockIcon';
import { RefreshIcon } from './components/icons/RefreshIcon';
import { ShieldCheckIcon } from './components/icons/ShieldCheckIcon';
import { ChevronRightIcon } from './components/icons/ChevronRightIcon';
import { FilterIcon } from './components/icons/FilterIcon';
import { UsersIcon } from './components/icons/UsersIcon';
import { SparklesIcon } from './components/icons/SparklesIcon';
import { AlertTriangleIcon } from './components/icons/AlertTriangleIcon';

// --- ADVANCED DESIGN TOKENS ---
const TOKENS = {
    glass: 'backdrop-blur-3xl bg-white/[0.01] border border-white/[0.04] shadow-2xl',
    card: 'bg-[#0A0B0F] border border-white/[0.03] shadow-2xl overflow-hidden rounded-[2.5rem]',
    container: 'max-w-[1400px] mx-auto px-6 md:px-12 lg:px-16',
    spacing: {
        xs: 'gap-2',
        sm: 'gap-4',
        md: 'gap-8',
        lg: 'gap-12',
    },
    input: 'bg-[#06070a] border border-white/5 rounded-2xl focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all outline-none text-white placeholder:text-white/10 text-sm font-medium px-6 py-5',
    text: {
        h1: 'font-serif font-black text-4xl md:text-5xl lg:text-7xl text-white tracking-tighter leading-[0.9] uppercase',
        h3: 'font-serif font-bold text-xl md:text-2xl text-white tracking-tight leading-none',
        label: 'text-[10px] font-black uppercase tracking-[0.4em] text-white/30 block mb-2',
        body: 'text-sm text-white/40 leading-relaxed font-medium',
    },
    success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_30px_-10px_rgba(16,185,129,0.2)]',
    action: 'hover:scale-[1.02] active:scale-[0.98] focus:ring-2 focus:ring-primary/20 transition-all duration-300',
};

const statusColors: Record<EnquiryStatus, string> = {
    'NEW': 'bg-blue-500/5 text-blue-400 border-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.05)]',
    'ENQUIRY_ACTIVE': 'bg-blue-500/5 text-blue-400 border-blue-500/10',
    'ENQUIRY_VERIFIED': 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10 font-bold shadow-sm',
    'ENQUIRY_IN_REVIEW': 'bg-purple-500/5 text-purple-400 border-purple-500/10',
    'ENQUIRY_CONTACTED': 'bg-amber-500/5 text-amber-400 border-amber-500/10',
    'ENQUIRY_REJECTED': 'bg-rose-500/5 text-rose-400 border-rose-500/10',
    'ENQUIRY_CONVERTED': 'bg-indigo-500/5 text-indigo-400 border-indigo-500/10',
};

const statusLabels: Record<EnquiryStatus, string> = {
    'NEW': 'NEW',
    'ENQUIRY_ACTIVE': 'ACTIVE',
    'ENQUIRY_VERIFIED': 'VERIFIED',
    'ENQUIRY_IN_REVIEW': 'IN REVIEW',
    'ENQUIRY_CONTACTED': 'CONTACTED',
    'ENQUIRY_REJECTED': 'REJECTED',
    'ENQUIRY_CONVERTED': 'PROMOTED TO ADMISSION',
};

type SortableKeys = 'applicant_name' | 'grade' | 'status' | 'updated_at';

interface EnquiryTabProps {
    branchId?: number | null;
    onNavigate?: (component: string) => void;
}

const EnquiryTab: React.FC<EnquiryTabProps> = ({ branchId, onNavigate }) => {
    const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewingEnquiry, setViewingEnquiry] = useState<Enquiry | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' }>({ key: 'updated_at', direction: 'descending' });

    const fetchEnquiries = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        setError(null);
        try {
            // FIX: Explicitly call get_all_enquiries_v2 to bypass schema cache ambiguity
            const { data, error: rpcError } = await supabase.rpc('get_all_enquiries_v2', {
                p_branch_id: branchId ?? null
            });

            if (rpcError) throw rpcError;
            setEnquiries(data || []);
        } catch (err: any) {
            setError(formatError(err));
        } finally {
            setLoading(false);
        }
    }, [branchId]);

    useEffect(() => {
        fetchEnquiries();

        const channel = supabase.channel(`enquiries-desk-sync-${branchId || 'master'}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'enquiries' }, (payload) => {
                const record = payload.new as any || payload.old as any;
                if (branchId === null || branchId === undefined || record.branch_id === branchId) {
                    fetchEnquiries(true);
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchEnquiries, branchId]);

    const processedEnquiries = useMemo(() => {
        const source = Array.isArray(enquiries) ? enquiries : [];
        let data = source.filter(enq => {
            const matchesStatus = !filterStatus || enq.status === filterStatus;
            const searchLower = (searchTerm || '').toLowerCase();
            const matchesSearch = !searchTerm ||
                (enq.applicant_name || '').toLowerCase().includes(searchLower) ||
                (enq.parent_name || '').toLowerCase().includes(searchLower);
            return matchesStatus && matchesSearch;
        });

        data.sort((a, b) => {
            const aVal = (a[sortConfig.key] || '').toString();
            const bVal = (b[sortConfig.key] || '').toString();
            const factor = sortConfig.direction === 'ascending' ? 1 : -1;
            if (aVal < bVal) return -1 * factor;
            if (aVal > bVal) return 1 * factor;
            return 0;
        });

        return data;
    }, [enquiries, searchTerm, filterStatus, sortConfig]);

    const stats = useMemo(() => {
        const source = Array.isArray(enquiries) ? enquiries : [];
        return {
            total: source.length,
            verified: source.filter(e => e.status === 'ENQUIRY_VERIFIED').length,
            converted: source.filter(e => e.status === 'ENQUIRY_CONVERTED').length
        };
    }, [enquiries]);

    const handleSort = (key: SortableKeys) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending'
        }));
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-16 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-32 px-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 border-b border-white/[0.03] pb-12">
                <div className="max-w-4xl space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="h-[2px] w-12 bg-primary/40 rounded-full" />
                        <span className={TOKENS.text.label}>Operational Intelligence</span>
                    </div>
                    <h1 className={TOKENS.text.h1}>
                        Enquiry <span className="text-white/20 italic lowercase font-medium">desk.</span>
                    </h1>
                    <p className="text-white/40 text-xl leading-relaxed font-serif italic max-w-2xl border-l border-white/10 pl-10">
                        Centralized workspace for managing inbound identity handshakes and verified institutional leads.
                    </p>
                </div>
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => fetchEnquiries()}
                        disabled={loading}
                        aria-label="Refresh Registry"
                        className={`p-5 rounded-2xl bg-white/[0.03] hover:bg-primary/5 text-white/30 hover:text-primary transition-all border border-white/5 focus:ring-2 focus:ring-primary/20 outline-none ${TOKENS.action}`}
                    >
                        <RefreshIcon className={`w-6 h-6 ${loading ? 'animate-spin' : 'hover:rotate-180 transition-transform duration-700'}`} />
                    </button>
                    {onNavigate && (
                        <button
                            onClick={() => onNavigate('Code Verification')}
                            className={`px-10 py-5 bg-primary text-white font-black text-[11px] uppercase tracking-[0.4em] rounded-2xl shadow-2xl shadow-primary/20 hover:bg-primary/90 flex items-center gap-4 ring-4 ring-primary/10 ${TOKENS.action}`}
                        >
                            <KeyIcon className="w-5 h-5" /> Start Verification
                        </button>
                    )}
                </div>
            </div>

            {/* Stats Deck */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <StatCard title="Total Ledger" value={stats.total} icon={<MailIcon className="w-7 h-7" />} color="bg-blue-500" desc="Total Nodes" />
                <StatCard title="Verified Stream" value={stats.verified} icon={<ShieldCheckIcon className="h-7 w-7" />} color="bg-teal-500" desc="Clearance Active" />
                <StatCard title="Promoted" value={stats.converted} icon={<CheckCircleIcon className="w-7 h-7" />} color="bg-emerald-500" desc="Converted nodes" />
            </div>

            {error && (
                <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-[2rem] flex items-center justify-between shadow-xl animate-in shake">
                    <div className="flex items-center gap-4">
                        <AlertTriangleIcon className="w-8 h-8 text-red-500 shrink-0" />
                        <div>
                            <p className="text-xs font-black uppercase text-red-500 tracking-widest">Fetch Failure</p>
                            <p className="text-sm font-bold text-red-200/70 mt-1">{error}</p>
                        </div>
                    </div>
                    <button onClick={() => fetchEnquiries()} className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95">Retry Protocol</button>
                </div>
            )}

            {/* Filter Hub */}
            <div className={`flex flex-col xl:flex-row gap-10 justify-between items-center p-8 rounded-[3rem] ${TOKENS.card}`}>
                <div className="relative w-full xl:max-w-2xl group">
                    <SearchIcon className="absolute left-7 top-1/2 -translate-y-1/2 h-6 w-6 text-white/10 group-focus-within:text-primary transition-colors duration-500" />
                    <input
                        type="text"
                        placeholder="SEARCH IDENTITIES OR PARENT NODES..."
                        aria-label="Search identities"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={TOKENS.input + " w-full pl-16"}
                    />
                </div>

                <div className="flex bg-black p-3 rounded-[2rem] border border-white/5 overflow-x-auto no-scrollbar w-full xl:w-auto shadow-inner">
                    {(['All', ...Object.keys(statusLabels)] as (keyof typeof statusLabels | 'All')[]).map(f => {
                        const label = f === 'All' ? 'ALL' : statusLabels[f as EnquiryStatus];
                        const key = f === 'All' ? '' : f;
                        return (
                            <button
                                key={f}
                                onClick={() => setFilterStatus(key)}
                                className={`px-10 py-3 rounded-[1.2rem] text-[10px] font-black uppercase tracking-[0.3em] transition-all duration-500 whitespace-nowrap ${(filterStatus === key)
                                    ? 'bg-[#1a1d24] text-primary shadow-2xl ring-1 ring-white/10 scale-[1.05] z-10'
                                    : 'text-white/20 hover:text-white/40'
                                    }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Desktop Registry Table */}
            <div className={`min-h-[600px] ${TOKENS.card} relative group`}>
                <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-primary/[0.02] to-transparent pointer-events-none" />

                {loading && (enquiries || []).length === 0 ? (
                    <div className="flex flex-col justify-center items-center py-60 gap-10">
                        <Spinner size="lg" className="text-primary" />
                        <p className={TOKENS.text.label + " animate-pulse"}>Syncing Lifecycle Protocol</p>
                    </div>
                ) : processedEnquiries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-60 text-center px-12 animate-in fade-in duration-1000">
                        <div className="w-32 h-32 bg-white/[0.015] rounded-[3rem] flex items-center justify-center mb-10 border border-white/5 shadow-inner">
                            <KeyIcon className="h-14 w-14 text-white/10" />
                        </div>
                        <h3 className={TOKENS.text.h3 + " text-3xl mb-6 uppercase"}>Desk <span className="text-white/20 italic">Standby.</span></h3>
                        <p className="text-white/30 max-w-sm mx-auto font-serif italic text-xl leading-relaxed">
                            Verified enquiries from the <strong className="text-primary">Handshake Center</strong> will appear here upon authorization.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto no-scrollbar px-1">
                        <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
                            <thead className="bg-[#0f1115]/60 border-b border-white/[0.03] text-[10px] font-black uppercase text-white/30 tracking-[0.4em] sticky top-0 z-20 backdrop-blur-3xl">
                                <tr>
                                    <th className="p-12 pl-16 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('applicant_name')}>Identity Node</th>
                                    <th className="p-12">Placement Context</th>
                                    <th className="p-12">Lifecycle Status</th>
                                    <th className="p-12 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('updated_at')}>Registry Pulse</th>
                                    <th className="p-12 text-right pr-16">Protocols</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.02] relative z-10">
                                {processedEnquiries.map((enq, idx) => (
                                    <tr
                                        key={enq.id}
                                        tabIndex={0}
                                        role="button"
                                        aria-label={`View details for ${enq.applicant_name}`}
                                        onClick={() => setViewingEnquiry(enq)}
                                        onKeyDown={(e) => e.key === 'Enter' && setViewingEnquiry(enq)}
                                        style={{ animationDelay: `${idx * 40}ms` }}
                                        className="group hover:bg-white/[0.015] transition-all duration-500 cursor-pointer animate-in fade-in slide-in-from-bottom-2 outline-none focus:bg-white/[0.03]"
                                    >
                                        <td className="p-12 pl-16">
                                            <div className="flex items-center gap-10">
                                                <div className="relative shrink-0">
                                                    <div className="absolute inset-0 bg-primary/20 blur-2xl opacity-0 group-hover:opacity-40 transition-opacity duration-700"></div>
                                                    <PremiumAvatar
                                                        src={enq.profile_photo_url}
                                                        name={enq.applicant_name}
                                                        size="md"
                                                        className="relative z-10 ring-2 ring-white/5 group-hover:ring-primary/40 transition-all duration-500 shadow-2xl"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="text-2xl font-serif font-black text-white group-hover:text-primary transition-colors duration-500 uppercase tracking-tighter leading-none">{enq.applicant_name}</div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[11px] font-bold text-white/20 uppercase tracking-widest">{enq.parent_name}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-12">
                                            <div className="flex flex-col gap-2.5">
                                                <span className="inline-flex items-center px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-white/5 text-white/30 border border-white/5 tracking-widest w-fit shadow-sm">
                                                    Grade {enq.grade}
                                                </span>
                                                <span className="text-[9px] font-mono text-white/10 uppercase tracking-[0.3em] pl-1">CONTEXT_ACAD_PROT</span>
                                            </div>
                                        </td>
                                        <td className="p-12">
                                            <div className={`px-5 py-2.5 inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl border shadow-2xl transition-all duration-700 ${statusColors[enq.status as EnquiryStatus] || 'bg-white/5 text-white/20 border-white/5'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]`} />
                                                {statusLabels[enq.status as EnquiryStatus] || enq.status}
                                            </div>
                                        </td>
                                        <td className="p-12">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-3 text-[12px] font-mono font-bold text-white/40 uppercase tracking-widest">
                                                    <ClockIcon className="w-4 h-4 opacity-40 group-hover:rotate-12 transition-transform" />
                                                    {new Date(enq.updated_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                                                </div>
                                                <span className="text-[10px] text-white/10 font-bold uppercase tracking-[0.2em] pl-7">Sync Logged</span>
                                            </div>
                                        </td>
                                        <td className="p-12 text-right pr-16">
                                            <div className={`p-5 rounded-2xl bg-white/5 text-white/10 border border-transparent transition-all shadow-2xl ${TOKENS.action} group-hover:text-primary group-hover:bg-primary/10 group-hover:border-primary/20`}>
                                                <ChevronRightIcon className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {viewingEnquiry && (
                <EnquiryDetailsModal
                    enquiry={viewingEnquiry}
                    currentBranchId={branchId}
                    onClose={() => setViewingEnquiry(null)}
                    onUpdate={() => {
                        fetchEnquiries(true);
                    }}
                    onNavigate={onNavigate}
                />
            )}
        </div>
    );
};

const StatCard: React.FC<{ title: string; value: number; icon: React.ReactNode; color: string; desc: string }> = ({ title, value, icon, color, desc }) => (
    <div className={`${TOKENS.card} p-12 group relative`}>
        <div className={`absolute -right-12 -top-12 w-64 h-64 ${color} opacity-[0.02] rounded-full blur-[120px] group-hover:opacity-[0.08] transition-opacity duration-1000`}></div>
        <div className="flex justify-between items-start relative z-10">
            <div className="p-5 rounded-2xl bg-white/[0.03] text-white/20 border border-white/5 group-hover:scale-110 group-hover:text-primary group-hover:border-primary/20 transition-all duration-700 shadow-xl">
                {icon}
            </div>
            <div className="px-4 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">{desc}</div>
        </div>
        <div className="mt-16 relative z-10">
            <p className={TOKENS.text.label + " mb-4"}>{title}</p>
            <h3 className={TOKENS.text.h3 + " text-7xl"}>{value}</h3>
        </div>
    </div>
);

export default EnquiryTab;
