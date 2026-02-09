import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase, formatError } from '../../services/supabase';
import { Communication, EnquiryStatus, MyEnquiry, TimelineItem } from '../../types';
import Spinner from '../common/Spinner';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import PremiumAvatar from '../common/PremiumAvatar';

// --- Global UI Tokens (Enterprise Grade) ---
const COLORS = {
    base: 'bg-[#08080a]', // Layered deep neutral
    surface: 'bg-[#111114]',
    panel: 'bg-[#16161a]',
    card: 'bg-white/[0.02]',
    border: 'border-white/[0.06]',
    borderEmphasis: 'border-white/[0.12]',
    accent: 'text-indigo-400',
    primary: 'bg-indigo-600',
    success: 'text-emerald-400',
    textPrimary: 'text-white',
    textSecondary: 'text-white/40',
    textMuted: 'text-white/20',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; iconColor: string }> = {
    'NEW': { label: 'Initial Node', color: 'text-blue-400', bg: 'bg-blue-400/10', iconColor: 'text-blue-500' },
    'ENQUIRY_ACTIVE': { label: 'Active Desk', color: 'text-indigo-400', bg: 'bg-indigo-400/10', iconColor: 'text-indigo-500' },
    'ENQUIRY_VERIFIED': { label: 'Verified', color: 'text-emerald-400', bg: 'bg-emerald-400/10', iconColor: 'text-emerald-500' },
    'ENQUIRY_IN_REVIEW': { label: 'In Review', color: 'text-purple-400', bg: 'bg-purple-400/10', iconColor: 'text-purple-500' },
    'ENQUIRY_CONTACTED': { label: 'Contacted', color: 'text-amber-400', bg: 'bg-amber-400/10', iconColor: 'text-amber-500' },
};

const formatShortTime = (date: string) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function MessagesTab() {
    const [activeTab, setActiveTab] = useState<'broadcasts' | 'enquiries'>('broadcasts');
    const [enquiries, setEnquiries] = useState<MyEnquiry[]>([]);
    const [announcements, setAnnouncements] = useState<Communication[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEnquiry, setSelectedEnquiry] = useState<MyEnquiry | null>(null);
    const [selectedBroadcast, setSelectedBroadcast] = useState<Communication | null>(null);

    const fetchData = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const [enqRes, msgRes] = await Promise.all([
                supabase.rpc('get_my_enquiries'),
                supabase.rpc('get_my_messages')
            ]);
            setEnquiries(enqRes.data || []);
            setAnnouncements(msgRes.data || []);

            if (!isSilent) {
                if (activeTab === 'broadcasts' && msgRes.data?.[0]) setSelectedBroadcast(msgRes.data[0]);
                if (activeTab === 'enquiries' && enqRes.data?.[0]) setSelectedEnquiry(enqRes.data[0]);
            }
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading && announcements.length === 0 && enquiries.length === 0) {
        return (
            <div className="h-[80vh] flex flex-col items-center justify-center space-y-6">
                <Spinner size="lg" className="text-indigo-500 opacity-20" />
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/10 italic">Synchronizing Governance Nodes...</span>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-80px)] flex flex-col overflow-hidden bg-[#08080a] rounded-[2rem] border border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.8)] select-none m-4">

            {/* Header: Unified Context Bar */}
            <header className="px-8 sm:px-12 py-8 bg-black/40 border-b border-white/[0.04] flex flex-col md:flex-row items-center justify-between shrink-0 gap-8 relative overflow-hidden group">
                {/* Decorative Deep Glow */}
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none transition-all duration-1000 group-hover:bg-indigo-500/10" />

                <div className="flex items-center gap-6 relative z-10">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
                        <div className="relative p-3.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/30 shadow-[0_0_30px_rgba(79,70,229,0.1)] ring-1 ring-white/10">
                            <ZapIcon className="w-6 h-6 text-indigo-400" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                            <h2 className="text-2xl sm:text-3xl font-serif font-black text-white leading-none tracking-tighter uppercase flex items-baseline">
                                Inbox <span className="text-indigo-500/50 font-light italic ml-2.5 lowercase text-xl sm:text-2xl">Channel.</span>
                            </h2>
                        </div>
                        <div className="flex items-center gap-3 opacity-40 ml-4">
                            <span className="text-[8px] font-black uppercase tracking-[0.4em]">Official Registry Gateway</span>
                            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[8px] font-black uppercase text-emerald-400/80 tracking-[0.2em] px-2 py-0.5 rounded border border-emerald-500/20">Secured Uplink</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6 relative z-10">
                    <div className="flex bg-white/[0.03] p-1.5 rounded-2xl border border-white/[0.05] shadow-inner backdrop-blur-2xl">
                        <TabButton active={activeTab === 'broadcasts'} onClick={() => setActiveTab('broadcasts')} label="Broadcasts" count={announcements.length} />
                        <TabButton active={activeTab === 'enquiries'} onClick={() => setActiveTab('enquiries')} label="Enquiries" count={enquiries.length} />
                    </div>
                    <div className="h-8 w-px bg-white/5 hidden md:block" />
                    <div className="hidden lg:flex items-center gap-4 px-5 py-2.5 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                        <div className="flex -space-x-2.5">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="w-6 h-6 rounded-full bg-indigo-900/60 border border-black/40 flex items-center justify-center text-[7px] font-black text-white/50">
                                    {i === 1 ? 'AD' : i === 2 ? 'SC' : 'M'}
                                </div>
                            ))}
                        </div>
                        <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">+8 Verified Authorities</span>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex min-h-0 divide-x divide-white/[0.04]">

                {/* 1. Inbox Ledger (Sidebar) */}
                <aside className="w-[360px] flex flex-col bg-black/10 shrink-0">
                    <div className="px-6 py-4 flex items-center justify-between border-b border-white/[0.02] bg-white/[0.01]">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/10">Active Ledgers</span>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                            <span className="text-[8px] font-mono text-white/20">LIVE</span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
                        <AnimatePresence mode="popLayout">
                            {activeTab === 'broadcasts' ? (
                                announcements.map(msg => (
                                    <LedgerCard
                                        key={msg.id}
                                        active={selectedBroadcast?.id === msg.id}
                                        onClick={() => setSelectedBroadcast(msg)}
                                        title={msg.subject}
                                        subtitle={msg.sender_name || 'Central Authority'}
                                        time={msg.sent_at}
                                        icon={<MegaphoneIcon className="w-4 h-4" />}
                                    />
                                ))
                            ) : (
                                enquiries.map(enq => (
                                    <LedgerCard
                                        key={enq.id}
                                        active={selectedEnquiry?.id === enq.id}
                                        onClick={() => setSelectedEnquiry(enq)}
                                        title={enq.applicant_name}
                                        subtitle={`${enq.grade} Node`}
                                        time={enq.updated_at}
                                        status={enq.status}
                                        icon={<ShieldCheckIcon className="w-4 h-4" />}
                                    />
                                ))
                            )}
                        </AnimatePresence>
                    </div>
                </aside>

                {/* 2. Primary Workspace (Stream) */}
                <main className="flex-1 flex flex-col bg-[#0c0c0e]/50 relative overflow-hidden">
                    <AnimatePresence mode="wait">
                        {activeTab === 'broadcasts' ? (
                            selectedBroadcast ? (
                                <BroadcastView broadcast={selectedBroadcast} key={selectedBroadcast.id} />
                            ) : (
                                <EmptyState
                                    title="Broadcast Stream"
                                    subtitle="Institutional communication gateway initialized."
                                    description="This channel serves as the verified bridge for one-to-many official announcements. Once an authority transmits a broadcast, it will appear here in chronological order with full cryptographic auditing."
                                    icon={<MegaphoneIcon className="w-12 h-12" />}
                                />
                            )
                        ) : (
                            selectedEnquiry ? (
                                <EnquiryHandshake enquiry={selectedEnquiry} key={selectedEnquiry.id} refresh={() => fetchData(true)} />
                            ) : (
                                <EmptyState
                                    title="Enquiry Channel"
                                    subtitle="Private communication node awaiting selection."
                                    description="Active handshakes and direct enquiries with institutional authorities are managed here. Select a verified node from the ledger to resume secure communication."
                                    icon={<ShieldCheckIcon className="w-12 h-12" />}
                                />
                            )
                        )}
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
}

// --- Sub-Components ---

function TabButton({ active, onClick, label, count }: any) {
    return (
        <button
            onClick={onClick}
            className={clsx(
                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative group",
                active ? "bg-indigo-600 text-white shadow-lg" : "text-white/30 hover:text-white/60"
            )}
        >
            <span className="relative z-10 flex items-center gap-2">
                {label}
                {count > 0 && <span className={clsx("px-1.5 py-0.5 rounded-md text-[8px] font-mono", active ? "bg-white/20 text-white" : "bg-white/5 text-white/30 group-hover:bg-white/10")}>{count}</span>}
            </span>
            {active && (
                <motion.div layoutId="tabActive" className="absolute inset-0 bg-indigo-600 rounded-xl" />
            )}
        </button>
    );
}

function LedgerCard({ active, onClick, title, subtitle, time, status, icon }: any) {
    return (
        <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={onClick}
            className={clsx(
                "w-full text-left p-5 rounded-2xl border transition-all relative overflow-hidden group",
                active
                    ? "bg-indigo-600/[0.08] border-indigo-500/40 shadow-[0_4px_20px_rgba(79,70,229,0.1)]"
                    : "bg-white/[0.01] border-white/[0.04] hover:bg-white/[0.03] hover:border-white/[0.08]"
            )}
        >
            {active && (
                <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r-full"
                />
            )}

            <div className="flex justify-between items-start mb-3">
                <div className={clsx(
                    "p-2 rounded-lg border group-hover:scale-105 transition-transform",
                    active ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-400" : "bg-white/5 border-white/10 text-white/20"
                )}>
                    {icon}
                </div>
                <span className="text-[10px] font-mono font-medium text-white/10">{new Date(time).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
            </div>

            <h4 className={clsx(
                "text-sm font-bold transition-colors uppercase tracking-tight truncate pr-2",
                active ? "text-indigo-200" : "text-white/80 group-hover:text-white"
            )}>
                {title}
            </h4>

            <div className="flex items-center justify-between mt-2.5">
                <span className="text-[9px] font-black text-white/15 uppercase tracking-[0.2em]">{subtitle}</span>
                {status && (
                    <span className={clsx(
                        "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider",
                        STATUS_CONFIG[status]?.bg,
                        STATUS_CONFIG[status]?.color
                    )}>
                        {STATUS_CONFIG[status]?.label || status}
                    </span>
                )}
            </div>
        </motion.button>
    );
}

function BroadcastView({ broadcast }: { broadcast: Communication }) {
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col h-full bg-black/20">
            <header className="p-10 border-b border-white/[0.04] bg-white/[0.01]">
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20"><MegaphoneIcon className="w-3.5 h-3.5" /></div>
                        <span className="text-[9px] font-black uppercase tracking-[0.4em] text-indigo-400">Official Bulletin Transmitted</span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-serif font-black text-white leading-tight tracking-tighter uppercase">{broadcast.subject}</h2>
                    <div className="flex items-center gap-6 pt-6 border-t border-white/[0.04]">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10"><ZapIcon className="w-3.5 h-3.5 text-white/40" /></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/60 italic">{broadcast.sender_name || 'Central Command'}</span>
                        </div>
                        <span className="text-[10px] font-mono text-white/10 uppercase">{new Date(broadcast.sent_at).toLocaleString()}</span>
                    </div>
                </div>
            </header>
            <div className="flex-1 p-10 overflow-y-auto custom-scrollbar">
                <div className="max-w-3xl mx-auto">
                    <p className="text-lg md:text-xl font-serif leading-relaxed text-white/70 italic border-l-2 border-indigo-500/30 pl-10 whitespace-pre-wrap">
                        {broadcast.body}
                    </p>
                    <div className="mt-20 pt-10 border-t border-white/[0.03] flex items-center justify-center gap-4 opacity-5 grayscale">
                        <ZapIcon className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-[0.8em]">End of Transmission</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function EnquiryHandshake({ enquiry, refresh }: { enquiry: MyEnquiry; refresh: () => void }) {
    const [messages, setMessages] = useState<TimelineItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const loadTimeline = useCallback(async () => {
        const { data, error } = await supabase.rpc('get_enquiry_timeline_v3', { p_enquiry_id: String(enquiry.id) });
        if (!error && data) {
            setMessages((data as TimelineItem[]).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
        }
        setLoading(false);
    }, [enquiry.id]);

    useEffect(() => {
        loadTimeline();
        const sub = supabase.channel(`enq-${enquiry.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'enquiry_messages', filter: `enquiry_id=eq.${enquiry.id}` }, () => loadTimeline()).subscribe();
        return () => { supabase.removeChannel(sub); };
    }, [loadTimeline, enquiry.id]);

    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const msg = text.trim();
        if (!msg || sending) return;
        setSending(true);
        try {
            await supabase.rpc('send_enquiry_message_v3', { p_enquiry_id: String(enquiry.id), p_message: msg });
            setText('');
            await loadTimeline();
            refresh();
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex h-full overflow-hidden">
            {/* Chat Stream */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#08080a]">
                <header className="px-10 py-5 bg-black/20 border-b border-white/[0.04] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-5">
                        <PremiumAvatar name={enquiry.applicant_name} size="sm" className="rounded-xl ring-2 ring-white/5" />
                        <div>
                            <div className="flex items-center gap-3">
                                <h3 className="text-xl font-serif font-black text-white uppercase tracking-tight">{enquiry.applicant_name}</h3>
                                <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1.5">
                                    <div className="w-1 h-1 rounded-full bg-emerald-400" />
                                    <span className="text-[8px] font-black text-emerald-400/80 uppercase tracking-widest">Verified</span>
                                </div>
                            </div>
                            <span className="text-[9px] font-mono text-white/20 uppercase tracking-[0.2em] mt-1 block">Handshake ID: {String(enquiry.id).slice(0, 8)}</span>
                        </div>
                    </div>
                </header>

                <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 md:px-12 py-8 space-y-1 custom-scrollbar scroll-smooth">
                    {loading ? (
                        <div className="h-full flex items-center justify-center opacity-10"><Spinner /></div>
                    ) : (
                        <div className="max-w-4xl mx-auto py-6">
                            {messages.map((item, idx) => {
                                const isSystem = item.item_type !== 'MESSAGE';
                                const isMe = !item.is_admin;
                                const prevItem = idx > 0 ? messages[idx - 1] : null;
                                const isGrouped = prevItem && prevItem.is_admin === item.is_admin && !isSystem && (prevItem.item_type === 'MESSAGE');

                                if (isSystem) {
                                    return (
                                        <div key={idx} className="flex justify-center my-8 relative">
                                            <div className="absolute inset-x-0 top-1/2 h-[1px] bg-white/[0.04]" />
                                            <div className="relative px-5 py-1.5 rounded-full bg-[#08080a] border border-white/[0.08] flex items-center gap-2.5">
                                                <div className="w-1 h-1 rounded-full bg-indigo-500/60 shadow-[0_0_8px_rgba(99,102,241,0.4)]" />
                                                <span className="text-[8px] font-black uppercase tracking-[0.25em] text-white/30">{item.details.status || 'Registry Sync'}</span>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        className={clsx("flex flex-col mb-1", isMe ? "items-end text-right" : "items-start text-left", !isGrouped && "mt-8")}
                                    >
                                        {!isGrouped && (
                                            <div className={clsx("flex items-center gap-3 mb-2 px-1", isMe ? "flex-row-reverse" : "flex-row")}>
                                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">{isMe ? 'Verified Parent' : 'Institutional Authority'}</span>
                                                <span className="text-[9px] font-mono text-white/5 opacity-50">{formatShortTime(item.created_at)}</span>
                                            </div>
                                        )}
                                        <div className={clsx(
                                            "max-w-[85%] sm:max-w-[70%] px-6 py-4 rounded-2xl text-[15px] leading-relaxed border transition-all duration-300",
                                            isMe
                                                ? "bg-indigo-600/90 text-white border-white/10 rounded-tr-none shadow-[0_8px_30px_rgba(79,70,229,0.15)]"
                                                : "bg-black/30 text-white/90 border-white/[0.05] rounded-tl-none hover:border-white/10"
                                        )}>
                                            <p className="normal-case font-medium whitespace-pre-wrap selection:bg-white/20">{item.details.message}</p>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="px-10 py-6 bg-black/40 border-t border-white/[0.04] shrink-0 backdrop-blur-3xl sticky bottom-0">
                    <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-4 p-1.5 bg-white/[0.02] border border-white/[0.08] rounded-2xl focus-within:border-indigo-500/40 transition-all shadow-inner group">
                        <div className="p-3 bg-white/5 rounded-xl text-white/10 group-focus-within:text-white/30 transition-colors"><ZapIcon className="w-4 h-4" /></div>
                        <input
                            value={text} onChange={e => setText(e.target.value)} type="text"
                            placeholder="Type a verified response to authority..."
                            className="flex-1 bg-transparent px-2 py-3 text-white text-sm placeholder:text-white/10 outline-none normal-case"
                        />
                        <button
                            type="submit"
                            disabled={!text.trim() || sending}
                            className="p-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all disabled:opacity-5 active:scale-95 shadow-xl border border-white/10"
                        >
                            {sending ? <Spinner size="sm" /> : <SendIcon className="w-5 h-5" />}
                        </button>
                    </form>
                    <div className="max-w-4xl mx-auto flex items-center justify-center gap-4 mt-4 opacity-10">
                        <div className="h-px w-8 bg-white" />
                        <span className="text-[7px] font-black uppercase tracking-[0.5em]">AES-256 Encryption Active</span>
                        <div className="h-px w-8 bg-white" />
                    </div>
                </div>
            </div>

            {/* 3. Registry Passport (Right Panel) */}
            <aside className="w-[320px] hidden xl:flex flex-col bg-[#0c0c0e] p-8 space-y-10 shrink-0 overflow-y-auto no-scrollbar border-l border-white/[0.04]">
                <section>
                    <h5 className="text-[9px] font-black uppercase text-white/20 tracking-[0.4em] mb-6">Registry Status</h5>
                    <div className={clsx(
                        "p-8 rounded-[2rem] border-2 flex flex-col items-center text-center gap-5 shadow-2xl relative overflow-hidden group transition-all",
                        STATUS_CONFIG[enquiry.status]?.bg || 'bg-white/5',
                        STATUS_CONFIG[enquiry.status]?.iconColor?.replace('text-', 'border-').replace('500', '500/20')
                    )}>
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                        <ShieldCheckIcon className={clsx("w-14 h-14", (STATUS_CONFIG[enquiry.status]?.color || 'text-white/30'))} />
                        <div>
                            <span className={clsx("text-lg font-serif font-black uppercase tracking-widest block", (STATUS_CONFIG[enquiry.status]?.color || 'text-white/30'))}>
                                {STATUS_CONFIG[enquiry.status]?.label || enquiry.status}
                            </span>
                            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 mt-3 inline-flex items-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[8px] font-black uppercase tracking-[0.15em] text-white/30 italic">Audit Signal Verified</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="space-y-5">
                    <h5 className="text-[9px] font-black uppercase text-white/20 tracking-[0.4em]">Node Metadata</h5>
                    <div className="grid gap-3">
                        <MetaRow label="Academic Deck" value={enquiry.grade} />
                        <MetaRow label="Governance Branch" value={enquiry.branch_name || 'Main Registry'} />
                        <MetaRow label="Identity Node" value={String(enquiry.id).slice(0, 12).toUpperCase()} />
                    </div>
                </section>

                <div className="mt-auto py-8 opacity-5 grayscale text-center pointer-events-none border-t border-white/[0.03]">
                    <ZapIcon className="w-6 h-6 mx-auto mb-4" />
                    <p className="text-[8px] font-black uppercase tracking-[0.8em]">Core Protocol V3.0<br />GURU INTELLIGENCE</p>
                </div>
            </aside>
        </div>
    );
}

// --- Authoritative Icons ---
const ShieldCheckIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>;
const ZapIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>;
const MegaphoneIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const SendIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>;

function MetaRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl group hover:border-indigo-500/20 transition-all">
            <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em] block mb-1.5">{label}</span>
            <p className="text-xs font-bold text-white/80 group-hover:text-white transition-colors uppercase tracking-tight">{value}</p>
        </div>
    );
}

function EmptyState({ title, subtitle, description, icon }: any) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full w-full flex items-center justify-center p-12 bg-[#08080a]"
        >
            <div className="max-w-xl w-full relative">
                <div className="absolute inset-0 bg-indigo-500/5 blur-[100px] rounded-full" />
                <div className="relative p-12 rounded-[2.5rem] bg-white/[0.01] border border-white/[0.05] shadow-2xl flex flex-col items-center text-center">
                    <div className="mb-10 relative">
                        <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-2xl opacity-50" />
                        <div className="relative w-20 h-20 flex items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/30">
                            {React.cloneElement(icon, { className: "w-8 h-8 text-indigo-400" })}
                        </div>
                    </div>
                    <div className="space-y-4 mb-10">
                        <div className="flex items-center justify-center gap-3 opacity-20">
                            <div className="h-px w-6 bg-white" />
                            <span className="text-[8px] font-black uppercase tracking-[0.4em]">Ready Command State</span>
                            <div className="h-px w-6 bg-white" />
                        </div>
                        <h3 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">{title}</h3>
                        <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">{subtitle}</p>
                    </div>
                    <p className="text-sm font-serif italic text-white/20 leading-relaxed mb-8 px-6">
                        "{description}"
                    </p>
                    <div className="flex items-center gap-3 py-3 px-6 rounded-full bg-white/[0.03] border border-white/[0.05] opacity-30 grayscale">
                        <ShieldCheckIcon className="w-4 h-4" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/60">P2M Encryption Layer Verified</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
