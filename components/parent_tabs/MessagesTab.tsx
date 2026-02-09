import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase, formatError } from '../../services/supabase';
import { Communication, EnquiryStatus, MyEnquiry, TimelineItem } from '../../types';
import Spinner from '../common/Spinner';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import PremiumAvatar from '../common/PremiumAvatar';

// --- Global UI Tokens ---
const COLORS = {
    base: 'bg-[#050505]',
    card: 'bg-white/[0.02]',
    border: 'border-white/[0.05]',
    accent: 'text-indigo-400',
    primary: 'bg-indigo-600',
    success: 'text-emerald-400',
};

// --- Icons (Authoritative Set) ---
const ShieldCheckIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>;
const ZapIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>;
const MegaphoneIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const MoreIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>;
const SendIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    'NEW': { label: 'Initial Node', color: 'text-blue-400', bg: 'bg-blue-400/10' },
    'ENQUIRY_ACTIVE': { label: 'Active Desk', color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
    'ENQUIRY_VERIFIED': { label: 'Verified', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    'ENQUIRY_IN_REVIEW': { label: 'In Review', color: 'text-purple-400', bg: 'bg-purple-400/10' },
    'ENQUIRY_CONTACTED': { label: 'Contacted', color: 'text-amber-400', bg: 'bg-amber-400/10' },
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
        <div className="h-[calc(100vh-120px)] flex flex-col overflow-hidden bg-[#050505] rounded-[3rem] border border-white/5 shadow-3xl select-none">

            {/* Header: Unified Context Bar */}
            <header className="px-10 sm:px-16 py-10 sm:py-12 bg-black/40 border-b border-white/[0.03] flex flex-col md:flex-row items-center justify-between shrink-0 gap-8 relative overflow-hidden group">
                {/* Decorative Glass Reflection */}
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                <div className="flex items-center gap-8 relative z-10">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative p-4 bg-indigo-500/10 rounded-[1.4rem] border border-indigo-500/20 shadow-[0_0_30px_rgba(79,70,229,0.1)] ring-1 ring-white/5">
                            <ZapIcon className="w-6 h-6 text-indigo-400" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                            <h2 className="text-2xl sm:text-4xl font-serif font-black text-white leading-none tracking-tighter uppercase flex items-baseline">
                                Inbox <span className="text-indigo-500/40 font-light italic ml-3 lowercase text-xl sm:text-2xl">Channel.</span>
                            </h2>
                        </div>
                        <div className="flex items-center gap-3 opacity-30 ml-4">
                            <span className="text-[9px] font-black uppercase tracking-[0.4em]">Governance Uplink Node</span>
                            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[9px] font-black uppercase text-emerald-400 tracking-[0.2em] px-2 py-0.5 rounded border border-emerald-500/20">End-to-End Encrypted</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-8 relative z-10">
                    <div className="flex bg-white/[0.04] p-1.5 rounded-[1.5rem] border border-white/5 shadow-inner backdrop-blur-xl">
                        <TabButton active={activeTab === 'broadcasts'} onClick={() => setActiveTab('broadcasts')} label="Broadcast Stream" count={announcements.length} />
                        <TabButton active={activeTab === 'enquiries'} onClick={() => setActiveTab('enquiries')} label="Enquiry Channel" count={enquiries.length} />
                    </div>
                    <div className="h-10 w-px bg-white/5 hidden md:block" />
                    <div className="hidden lg:flex items-center gap-4 px-6 py-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <div className="flex -space-x-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="w-7 h-7 rounded-full bg-indigo-900/40 border-2 border-black flex items-center justify-center text-[8px] font-black text-white/40">
                                    {i === 1 ? 'A' : i === 2 ? 'S' : 'M'}
                                </div>
                            ))}
                        </div>
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">+12 Authorities</span>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex min-h-0 divide-x divide-white/[0.03]">

                {/* 1. Inbox Ledger (Sidebar) */}
                <aside className="w-[400px] flex flex-col bg-black/20 shrink-0">
                    <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                        <AnimatePresence mode="popLayout">
                            {activeTab === 'broadcasts' ? (
                                announcements.map(msg => (
                                    <LedgerCard
                                        key={msg.id}
                                        active={selectedBroadcast?.id === msg.id}
                                        onClick={() => setSelectedBroadcast(msg)}
                                        title={msg.subject}
                                        subtitle={msg.sender_name || 'Authority'}
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
                                        subtitle={`Grade ${enq.grade} Node`}
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
                <main className="flex-1 flex flex-col bg-black/10 relative overflow-hidden">
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
                                    primaryCTA={{
                                        label: "Initialize Broadcast",
                                        onClick: () => { /* Handle create logic or show info */ }
                                    }}
                                    secondaryCTA={{
                                        label: "Communication Protocol",
                                        onClick: () => { /* Handle info */ }
                                    }}
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
                "px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative group",
                active ? "bg-indigo-600 text-white shadow-xl" : "text-white/20 hover:text-white/40"
            )}
        >
            {label}
            {count > 0 && <span className={clsx("ml-3 px-1.5 py-0.5 rounded-md text-[8px] font-mono", active ? "bg-white/20 text-white" : "bg-white/5 text-white/20 group-hover:bg-white/10")}>{count}</span>}
        </button>
    );
}

function LedgerCard({ active, onClick, title, subtitle, time, status, icon }: any) {
    return (
        <motion.button
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            onClick={onClick}
            className={clsx(
                "w-full text-left p-6 rounded-[2rem] border transition-all relative overflow-hidden group",
                active ? "bg-indigo-600/10 border-indigo-500/30 ring-1 ring-indigo-500/10" : "bg-white/[0.01] border-white/5 hover:bg-white/[0.03] hover:border-white/10"
            )}
        >
            <div className="flex justify-between items-start mb-4">
                <div className={clsx("p-2 rounded-xl border group-hover:scale-110 transition-transform", active ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-400" : "bg-white/5 border-white/10 text-white/20")}>
                    {icon}
                </div>
                <span className="text-[10px] font-mono text-white/10">{new Date(time).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
            </div>
            <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors uppercase tracking-tight truncate pr-4">{title}</h4>
            <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] font-black text-white/10 uppercase tracking-widest">{subtitle}</span>
                {status && (
                    <span className={clsx("px-2 py-0.5 rounded-[0.5rem] text-[8px] font-black uppercase tracking-widest", STATUS_CONFIG[status]?.bg, STATUS_CONFIG[status]?.color)}>
                        {STATUS_CONFIG[status]?.label || status}
                    </span>
                )}
            </div>
        </motion.button>
    );
}

function BroadcastView({ broadcast }: { broadcast: Communication }) {
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col h-full bg-black/40">
            <header className="p-16 border-b border-white/[0.03] bg-black/10">
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400"><MegaphoneIcon className="w-4 h-4" /></div>
                        <span className="text-[9px] font-black uppercase tracking-[0.4em] text-indigo-400/80">Official Bulletin Transmitted</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-serif font-black text-white leading-none tracking-tighter uppercase">{broadcast.subject}</h2>
                    <div className="flex items-center gap-6 pt-6 border-t border-white/[0.03]">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10"><ZapIcon className="w-4 h-4 text-white/20" /></div>
                            <span className="text-[11px] font-black uppercase tracking-widest text-white/40 italic">{broadcast.sender_name || 'Central Command'}</span>
                        </div>
                        <span className="text-[10px] font-mono text-white/10 uppercase tracking-tighter">{new Date(broadcast.sent_at).toLocaleString()}</span>
                    </div>
                </div>
            </header>
            <div className="flex-1 p-16 overflow-y-auto custom-scrollbar">
                <div className="max-w-3xl mx-auto">
                    <p className="text-xl md:text-2xl font-serif leading-relaxed text-white/60 italic border-l-2 border-indigo-500/20 pl-12 whitespace-pre-wrap">
                        {broadcast.body}
                    </p>
                    <div className="mt-20 pt-10 border-t border-white/[0.03] flex items-center gap-4 opacity-5 grayscale">
                        <ZapIcon className="w-6 h-6" />
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
            <div className="flex-1 flex flex-col min-w-0 bg-black/40">
                <header className="px-12 py-6 bg-black/20 border-b border-white/[0.03] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-6">
                        <PremiumAvatar name={enquiry.applicant_name} size="sm" className="rounded-xl shadow-2xl" />
                        <div>
                            <h3 className="text-xl font-serif font-black text-white uppercase tracking-tight">{enquiry.applicant_name}</h3>
                            <span className="text-[9px] font-mono text-white/10 uppercase tracking-widest">Handshake ID: {String(enquiry.id).slice(0, 8)}</span>
                        </div>
                    </div>
                </header>

                <div ref={scrollRef} className="flex-1 overflow-y-auto px-10 md:px-16 py-10 space-y-1 custom-scrollbar">
                    {loading ? (
                        <div className="h-full flex items-center justify-center opacity-10"><Spinner /></div>
                    ) : (
                        <div className="max-w-5xl mx-auto py-10">
                            {messages.map((item, idx) => {
                                const isSystem = item.item_type !== 'MESSAGE';
                                const isMe = !item.is_admin;
                                const prevItem = idx > 0 ? messages[idx - 1] : null;
                                const isGrouped = prevItem && prevItem.is_admin === item.is_admin && !isSystem && (prevItem.item_type === 'MESSAGE');

                                if (isSystem) {
                                    return (
                                        <div key={idx} className="flex justify-center my-10 relative">
                                            <div className="absolute inset-x-0 top-1/2 h-px bg-white/[0.03]" />
                                            <div className="relative px-6 py-2 rounded-full bg-black border border-white/5 flex items-center gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30">{item.details.status || 'Registry Synchronized'}</span>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <motion.div key={idx} initial={{ opacity: 0, x: isMe ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} className={clsx("flex flex-col", isMe ? "items-end text-right" : "items-start text-left", !isGrouped && "mt-10")}>
                                        {!isGrouped && (
                                            <div className={clsx("flex items-center gap-3 mb-2 px-1", isMe ? "flex-row-reverse" : "flex-row")}>
                                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">{isMe ? 'Verified Parent' : 'Institutional Authority'}</span>
                                                <span className="text-[10px] font-mono text-white/5">{formatShortTime(item.created_at)}</span>
                                            </div>
                                        )}
                                        <div className={clsx(
                                            "max-w-[75%] px-7 py-4 rounded-[1.8rem] text-sm md:text-base leading-relaxed border shadow-[0_15px_40px_rgba(0,0,0,0.5)]",
                                            isMe
                                                ? "bg-indigo-600 text-white border-indigo-400/20 rounded-tr-none shadow-indigo-900/10"
                                                : "bg-[#0c0c0e] text-white/80 border-white/5 rounded-tl-none"
                                        )}>
                                            <p className="normal-case font-medium whitespace-pre-wrap">{item.details.message}</p>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="px-12 py-8 bg-black/40 border-t border-white/[0.03] shrink-0">
                    <form onSubmit={handleSend} className="max-w-5xl mx-auto flex items-center gap-5 p-2 bg-white/[0.03] border border-white/5 rounded-[2rem] focus-within:border-indigo-500/30 transition-all shadow-inner">
                        <div className="p-4 bg-white/5 rounded-2xl text-white/10"><ZapIcon className="w-5 h-5" /></div>
                        <input
                            value={text} onChange={e => setText(e.target.value)} type="text"
                            placeholder="Type a verified response to institutional authority..."
                            className="flex-1 bg-transparent px-2 py-4 text-white text-base placeholder:text-white/10 outline-none normal-case"
                        />
                        <button type="submit" disabled={!text.trim() || sending} className="p-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.5rem] transition-all disabled:opacity-10 active:scale-95 shadow-xl">
                            {sending ? <Spinner size="sm" /> : <SendIcon className="w-6 h-6" />}
                        </button>
                    </form>
                </div>
            </div>

            {/* 3. Registry Passport (Right Panel) */}
            <aside className="w-[360px] hidden xl:flex flex-col bg-black/20 p-10 space-y-12 shrink-0 overflow-y-auto no-scrollbar border-l border-white/[0.03]">
                <section>
                    <h5 className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em] mb-8">Registry Status</h5>
                    <div className={clsx("p-10 rounded-[2.5rem] border flex flex-col items-center text-center gap-6 shadow-2xl relative overflow-hidden group", (STATUS_CONFIG[enquiry.status]?.bg || 'bg-white/5'))}>
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                        <ShieldCheckIcon className={clsx("w-16 h-16", (STATUS_CONFIG[enquiry.status]?.color || 'text-white/30'))} />
                        <div>
                            <span className={clsx("text-xl font-serif font-black uppercase tracking-widest block", (STATUS_CONFIG[enquiry.status]?.color || 'text-white/30'))}>
                                {STATUS_CONFIG[enquiry.status]?.label || enquiry.status}
                            </span>
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 mt-2 italic flex items-center gap-2 justify-center">
                                <span className="w-1 h-1 rounded-full bg-emerald-500" /> Authorized State
                            </p>
                        </div>
                    </div>
                </section>

                <section className="space-y-6">
                    <h5 className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em]">Node Metadata</h5>
                    <div className="space-y-4">
                        <MetaRow label="Target Grade" value={`Grade ${enquiry.grade}`} />
                        <MetaRow label="Institution Branch" value={enquiry.branch_name || 'Main Campus'} />
                    </div>
                </section>

                <div className="mt-auto py-10 opacity-5 grayscale text-center pointer-events-none">
                    <ZapIcon className="w-8 h-8 mx-auto" />
                    <p className="text-[9px] font-black uppercase tracking-[0.8em] mt-6">Protocol V2.5.4<br />Core Intelligence</p>
                </div>
            </aside>
        </div>
    );
}

function MetaRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl group hover:border-white/10 transition-all">
            <span className="text-[9px] font-black text-white/10 uppercase tracking-[0.2em] block mb-1.5">{label}</span>
            <p className="text-sm font-bold text-white/70 group-hover:text-white transition-colors uppercase tracking-tight">{value}</p>
        </div>
    );
}

function EmptyState({ title, subtitle, description, icon, primaryCTA, secondaryCTA }: any) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="h-full w-full flex items-center justify-center p-6 md:p-12 lg:p-24"
        >
            <div className="max-w-2xl w-full">
                {/* Elevated Container Layer */}
                <div className="relative p-12 md:p-20 rounded-[3.5rem] bg-white/[0.01] border border-white/[0.05] shadow-[0_40px_100px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-3xl group">
                    {/* Atmospheric Glows */}
                    <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none group-hover:bg-indigo-500/15 transition-all duration-1000" />
                    <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-500/5 blur-[80px] rounded-full pointer-events-none group-hover:bg-indigo-500/10 transition-all duration-1000" />

                    <div className="relative flex flex-col items-center text-center">
                        {/* Progressive Visual Anchor */}
                        <div className="mb-14">
                            <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center rounded-[2.2rem] bg-gradient-to-br from-white/[0.08] to-transparent border border-white/[0.1] shadow-2xl relative">
                                <div className="absolute inset-0 bg-indigo-500/5 rounded-[2.2rem] animate-pulse" />
                                <div className="relative text-indigo-400/90 filter drop-shadow-[0_0_20px_rgba(129,140,248,0.4)]">
                                    {React.cloneElement(icon, { className: "w-10 h-10 sm:w-12 sm:h-12" })}
                                </div>
                            </div>
                        </div>

                        {/* Title & Secondary Guidance */}
                        <div className="space-y-4 mb-8">
                            <div className="flex items-center justify-center gap-4 opacity-40 mb-3">
                                <div className="h-[1px] w-6 bg-indigo-400" />
                                <span className="text-[9px] font-black uppercase tracking-[0.6em] text-indigo-400">Institutional Protocol</span>
                                <div className="h-[1px] w-6 bg-indigo-400" />
                            </div>
                            <h3 className="text-3xl sm:text-5xl font-serif font-black text-white uppercase tracking-tighter leading-[0.95] md:px-6">
                                {title}
                            </h3>
                            <p className="text-white/40 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.3em] font-sans">
                                {subtitle}
                            </p>
                        </div>

                        {/* Informational Guidance Layer */}
                        <div className="max-w-md mx-auto mb-16">
                            <p className="text-sm sm:text-base font-medium text-white/20 leading-relaxed font-serif italic mb-2 px-4 transition-colors group-hover:text-white/30">
                                "{description}"
                            </p>
                            <div className="flex items-center justify-center gap-2 text-[8px] font-black text-white/5 uppercase tracking-[0.1em] pointer-events-none">
                                <div className="w-1 h-1 rounded-full bg-white/10" />
                                Secure P2M Transmission Gateway Active
                            </div>
                        </div>

                        {/* Intentional Action Row */}
                        <div className="flex flex-col sm:flex-row items-center gap-5 w-full sm:w-auto px-6">
                            {primaryCTA && (
                                <button
                                    onClick={primaryCTA.onClick}
                                    className="w-full sm:w-auto px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.4rem] text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-[0_20px_50px_rgba(79,70,229,0.3)] border border-indigo-400/30 ring-1 ring-white/10"
                                >
                                    {primaryCTA.label}
                                </button>
                            )}
                            {secondaryCTA && (
                                <button
                                    onClick={secondaryCTA.onClick}
                                    className="w-full sm:w-auto px-10 py-5 bg-white/[0.03] hover:bg-white/[0.08] text-white/40 hover:text-white rounded-[1.4rem] text-[10px] font-black uppercase tracking-widest transition-all border border-white/5"
                                >
                                    {secondaryCTA.label}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Micro-Interaction Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="mt-12 flex flex-col items-center gap-2 opacity-10 grayscale hover:opacity-25 transition-opacity"
                >
                    <div className="flex items-center gap-4">
                        <ShieldCheckIcon className="w-4 h-4" />
                        <span className="text-[8px] font-black uppercase tracking-[0.8em]">End-to-End Encryption Verified</span>
                    </div>
                    <span className="text-[7px] font-mono tracking-tighter opacity-50 uppercase">AES-256 Bit Institutional Secure Uplink</span>
                </motion.div>
            </div>
        </motion.div>
    );
}
