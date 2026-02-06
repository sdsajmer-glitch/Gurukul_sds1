import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, formatError } from '../../services/supabase';
import { Communication, EnquiryStatus, MyEnquiry, TimelineItem } from '../../types';
import Spinner from '../common/Spinner';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import PremiumAvatar from '../common/PremiumAvatar';

// --- Authoritative Icons ---
const MegaphoneIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const ShieldCheckIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>;
const RadarIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const TerminalIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" /></svg>;
const SendIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>;
const RefreshIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>;

const STATUS_CONFIG: { [key in EnquiryStatus]: { label: string; color: string; bg: string; icon: any } } = {
    'NEW': { label: 'New', color: 'text-blue-400', bg: 'bg-blue-400/10', icon: null },
    'ENQUIRY_ACTIVE': { label: 'Active', color: 'text-blue-400', bg: 'bg-blue-400/10', icon: null },
    'ENQUIRY_VERIFIED': { label: 'Verified', color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: null },
    'ENQUIRY_IN_REVIEW': { label: 'In Review', color: 'text-purple-400', bg: 'bg-purple-400/10', icon: null },
    'ENQUIRY_CONTACTED': { label: 'Contacted', color: 'text-amber-400', bg: 'bg-amber-400/10', icon: null },
    'ENQUIRY_REJECTED': { label: 'Rejected', color: 'text-rose-400', bg: 'bg-rose-400/10', icon: null },
    'ENQUIRY_CONVERTED': { label: 'Converted', color: 'text-indigo-400', bg: 'bg-indigo-400/10', icon: null },
};

const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "JUST NOW";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}M AGO`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}H AGO`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase();
};

export default function MessagesTab() {
    const [activeTab, setActiveTab] = useState<'broadcasts' | 'enquiries'>('broadcasts');
    const [enquiries, setEnquiries] = useState<MyEnquiry[]>([]);
    const [announcements, setAnnouncements] = useState<Communication[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEnquiry, setSelectedEnquiry] = useState<MyEnquiry | null>(null);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<Communication | null>(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const fetchData = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const [enqRes, msgRes] = await Promise.all([
                supabase.rpc('get_my_enquiries'),
                supabase.rpc('get_my_messages')
            ]);

            const fetchedEnquiries = (enqRes.data as MyEnquiry[]) || [];
            const fetchedBroadcasts = (msgRes.data as Communication[]) || [];

            setEnquiries(fetchedEnquiries);
            setAnnouncements(fetchedBroadcasts);

            if (!isSilent) {
                if (activeTab === 'broadcasts' && fetchedBroadcasts.length > 0) setSelectedAnnouncement(fetchedBroadcasts[0]);
                else if (activeTab === 'enquiries' && fetchedEnquiries.length > 0) setSelectedEnquiry(fetchedEnquiries[0]);
            }
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        fetchData();
        const sub = supabase.channel('inbox-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'enquiry_messages' }, () => fetchData(true))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'communications' }, () => fetchData(true))
            .subscribe();
        return () => { supabase.removeChannel(sub); };
    }, [fetchData]);

    const handleSwitchTab = (t: 'broadcasts' | 'enquiries') => {
        setActiveTab(t);
        if (t === 'broadcasts' && announcements.length > 0) setSelectedAnnouncement(announcements[0]);
        else if (t === 'enquiries' && enquiries.length > 0) setSelectedEnquiry(enquiries[0]);
    };

    if (loading && announcements.length === 0 && enquiries.length === 0) {
        return (
            <div className="h-[80vh] flex flex-col items-center justify-center space-y-8">
                <RadarIcon className="w-20 h-20 text-indigo-500 animate-spin-slow opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/40">Synchronizing Official Registry…</p>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col overflow-hidden bg-[#050505] rounded-[2.5rem] border border-white/5 shadow-2xl">
            {/* Page Header (Compact) */}
            <header className="px-10 py-6 border-b border-white/[0.03] bg-black/40 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-6">
                    <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                        <TerminalIcon className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-serif font-black text-white uppercase tracking-tight">Inbox <span className="opacity-30 font-normal">Channel.</span></h2>
                        <span className="text-[8px] font-black uppercase text-white/20 tracking-[0.3em]">Institutional Communication Gateway</span>
                    </div>
                </div>
                <div className="hidden md:flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Protocol Secured</span>
                </div>
            </header>

            <div className="flex-1 flex min-h-0">
                {/* 1. Sidebar (Enquiries/Broadcasts List) */}
                <div className={clsx(
                    "w-[380px] border-r border-white/[0.03] bg-black/20 flex flex-col shrink-0 transition-all z-40",
                    isMobileMenuOpen ? "fixed inset-0 bg-[#08090d]" : "hidden lg:flex"
                )}>
                    {/* Tab Switcher */}
                    <div className="p-6 pb-2">
                        <div className="flex p-1 bg-white/[0.02] rounded-2xl border border-white/5">
                            <button
                                onClick={() => handleSwitchTab('broadcasts')}
                                className={clsx("flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all", activeTab === 'broadcasts' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40" : "text-white/20 hover:text-white/40")}
                            >
                                Broadcasts
                            </button>
                            <button
                                onClick={() => handleSwitchTab('enquiries')}
                                className={clsx("flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all", activeTab === 'enquiries' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40" : "text-white/20 hover:text-white/40")}
                            >
                                Enquiries
                            </button>
                        </div>
                    </div>

                    {/* Scrollable List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                        <AnimatePresence mode="wait">
                            {activeTab === 'broadcasts' ? (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                                    {announcements.map(msg => (
                                        <button
                                            key={msg.id}
                                            onClick={() => setSelectedAnnouncement(msg)}
                                            className={clsx(
                                                "w-full p-5 text-left rounded-3xl border transition-all group relative overflow-hidden",
                                                selectedAnnouncement?.id === msg.id
                                                    ? "bg-indigo-500/10 border-indigo-500/30 ring-1 ring-indigo-500/20"
                                                    : "bg-white/[0.01] border-white/5 hover:bg-white/[0.03]"
                                            )}
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400">{msg.sender_name || 'Authority'}</span>
                                                <span className="text-[8px] font-bold text-white/10">{formatTimeAgo(msg.sent_at)}</span>
                                            </div>
                                            <h4 className="text-xs font-bold text-white/80 line-clamp-1">{msg.subject}</h4>
                                            <p className="text-[10px] text-white/20 mt-1 line-clamp-1 italic">{msg.body}</p>
                                        </button>
                                    ))}
                                </motion.div>
                            ) : (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                                    {enquiries.map(enq => (
                                        <button
                                            key={enq.id}
                                            onClick={() => setSelectedEnquiry(enq)}
                                            className={clsx(
                                                "w-full p-5 text-left rounded-3xl border transition-all group relative",
                                                selectedEnquiry?.id === enq.id
                                                    ? "bg-indigo-500/10 border-indigo-500/30 ring-1 ring-indigo-500/20"
                                                    : "bg-white/[0.01] border-white/5 hover:bg-white/[0.03]"
                                            )}
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-white/30 truncate max-w-[150px]">{enq.applicant_name}</span>
                                                <span className="text-[8px] font-bold text-white/10">{formatTimeAgo(enq.updated_at)}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className={clsx("px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest", STATUS_CONFIG[enq.status as EnquiryStatus]?.bg, STATUS_CONFIG[enq.status as EnquiryStatus]?.color)}>
                                                    {STATUS_CONFIG[enq.status as EnquiryStatus]?.label || enq.status}
                                                </div>
                                                <span className="text-[8px] font-bold text-white/10 uppercase tracking-widest">Grade {enq.grade}</span>
                                            </div>
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* 2. Main Stream */}
                <div className="flex-1 flex flex-col min-w-0 bg-black/40 relative">
                    <AnimatePresence mode="wait">
                        {activeTab === 'broadcasts' ? (
                            selectedAnnouncement ? (
                                <motion.div key={selectedAnnouncement.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col h-full uppercase">
                                    <header className="p-10 border-b border-white/[0.03] bg-black/20">
                                        <div className="max-w-3xl mx-auto">
                                            <span className="text-[10px] font-black text-indigo-400 tracking-[0.5em] mb-4 block">Official Broadcast</span>
                                            <h2 className="text-3xl font-serif font-black text-white leading-tight tracking-tight">{selectedAnnouncement.subject}</h2>
                                            <div className="flex items-center gap-4 mt-6">
                                                <span className="text-[11px] font-black text-white/40 uppercase tracking-widest leading-none italic">{selectedAnnouncement.sender_name || 'Central Command'}</span>
                                                <div className="w-1 h-1 rounded-full bg-white/10" />
                                                <span className="text-[10px] font-bold text-white/10 uppercase tracking-widest">{formatTimeAgo(selectedAnnouncement.sent_at)}</span>
                                            </div>
                                        </div>
                                    </header>
                                    <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                                        <div className="max-w-2xl mx-auto space-y-10">
                                            <div className="w-10 h-1 bg-indigo-500/20 rounded-full" />
                                            <p className="text-xl text-white/70 font-serif leading-relaxed italic border-l-2 border-white/5 pl-10 normal-case">
                                                {selectedAnnouncement.body}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : <Standby title="Broadcast Stream" />
                        ) : (
                            selectedEnquiry ? (
                                <EnquiryHandshake enquiry={selectedEnquiry} key={selectedEnquiry.id} refresh={fetchData} />
                            ) : <Standby title="Enquiry Channel" />
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

function Standby({ title }: { title: string }) {
    return (
        <div className="h-full flex flex-col items-center justify-center p-20 text-center space-y-8 opacity-20 select-none">
            <RadarIcon className="w-16 h-16 animate-pulse" />
            <h3 className="text-2xl font-serif font-black text-white uppercase tracking-[0.3em]">{title}</h3>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] italic max-w-xs leading-relaxed">Awaiting node selection for institutional handshake</p>
        </div>
    );
}

function EnquiryHandshake({ enquiry, refresh }: { enquiry: MyEnquiry; refresh: (silent?: boolean) => void }) {
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
        const sub = supabase.channel(`enq-${enquiry.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'enquiry_messages', filter: `enquiry_id=eq.${enquiry.id}` }, () => loadTimeline())
            .subscribe();
        return () => { supabase.removeChannel(sub); };
    }, [loadTimeline, enquiry.id]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const msg = text.trim();
        if (!msg || sending) return;

        setSending(true);
        try {
            const { error } = await supabase.rpc('send_enquiry_message_v3', { p_enquiry_id: String(enquiry.id), p_message: msg });
            if (error) throw error;
            setText('');
            await loadTimeline();
            refresh(true);
        } catch (err: any) {
            alert(formatError(err));
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex h-full min-w-0">
            {/* Chat Stream */}
            <div className="flex-1 flex flex-col min-w-0 h-full">
                <header className="px-10 py-6 border-b border-white/[0.03] bg-black/40 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-xl font-serif font-black text-white uppercase tracking-tight truncate max-w-[200px] md:max-w-sm">{enquiry.applicant_name}</h2>
                        <span className="text-[8px] font-black uppercase text-white/20 tracking-[0.3em]">Node Connection ID: {String(enquiry.id).slice(0, 8)}</span>
                    </div>
                </header>

                <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 md:px-12 py-10 space-y-1 custom-scrollbar">
                    {loading ? (
                        <div className="h-full flex items-center justify-center opacity-30"><Spinner /></div>
                    ) : (
                        <div className="max-w-4xl mx-auto flex flex-col pt-10">
                            {messages.map((item, idx) => {
                                const isSystem = item.item_type !== 'MESSAGE' || item.details.message?.includes('PROTOCOL UPDATE');
                                const isMe = !item.is_admin;
                                const prevItem = idx > 0 ? messages[idx - 1] : null;
                                const isGrouped = prevItem && prevItem.is_admin === item.is_admin && !isSystem && (prevItem.item_type === 'MESSAGE');

                                if (isSystem) {
                                    return (
                                        <div key={idx} className="flex justify-center my-8">
                                            <div className="px-5 py-2 rounded-full bg-white/5 border border-white/5 flex items-center gap-3">
                                                <div className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
                                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30 truncate max-w-[300px]">
                                                    {item.details.status || item.details.message?.split(':')[1]?.trim() || 'Registry Activity'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, x: isMe ? 20 : -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={clsx("flex flex-col mb-1", isMe ? "items-end" : "items-start", !isGrouped && "mt-6")}
                                    >
                                        {!isGrouped && (
                                            <div className={clsx("flex items-center gap-2 mb-1 px-1", isMe ? "flex-row-reverse" : "flex-row")}>
                                                <span className="text-[8px] font-black uppercase text-white/20 tracking-widest">{isMe ? 'Verified Parent' : 'Institutional Authority'}</span>
                                                <span className="text-[8px] font-mono text-white/10">{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        )}
                                        <div className={clsx(
                                            "max-w-[85%] px-5 py-3 rounded-2xl text-[14px] leading-relaxed border shadow-xl",
                                            isMe
                                                ? "bg-indigo-600 text-white border-white/10 rounded-tr-none shadow-indigo-900/30"
                                                : "bg-white/[0.03] text-white/70 border-white/5 rounded-tl-none"
                                        )}>
                                            <p className="normal-case font-medium whitespace-pre-wrap">{item.details.message}</p>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="px-10 py-6 border-t border-white/[0.03] bg-black/40 shrink-0">
                    <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-4 p-1.5 bg-white/[0.03] border border-white/5 rounded-3xl focus-within:border-indigo-500/30 transition-all">
                        <input
                            type="text"
                            value={text}
                            onChange={e => setText(e.target.value)}
                            placeholder="Type a verified response..."
                            className="flex-1 bg-transparent px-6 py-3 text-white placeholder:text-white/10 outline-none text-sm normal-case"
                        />
                        <button
                            type="submit"
                            disabled={!text.trim() || sending}
                            className="w-12 h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.2rem] flex items-center justify-center transition-all disabled:opacity-20"
                        >
                            {sending ? <Spinner size="sm" /> : <SendIcon className="w-5 h-5" />}
                        </button>
                    </form>
                </div>
            </div>

            {/* Registry Card (Right) */}
            <div className="w-[320px] border-l border-white/[0.03] bg-black/20 p-8 space-y-8 hidden xl:flex flex-col shrink-0">
                <section>
                    <h3 className="text-[9px] font-black uppercase text-white/20 tracking-[0.4em] mb-6">Security Context</h3>
                    <div className={clsx("p-6 rounded-[2rem] border flex flex-col items-center text-center gap-4", (STATUS_CONFIG[enquiry.status as EnquiryStatus]?.bg || 'bg-white/5'))}>
                        <ShieldCheckIcon className={clsx("w-10 h-10", (STATUS_CONFIG[enquiry.status as EnquiryStatus]?.color || 'text-white/30'))} />
                        <span className={clsx("text-[10px] font-black uppercase tracking-[0.3em]", (STATUS_CONFIG[enquiry.status as EnquiryStatus]?.color || 'text-white/30'))}>
                            {STATUS_CONFIG[enquiry.status as EnquiryStatus]?.label || enquiry.status}
                        </span>
                    </div>
                </section>

                <section className="space-y-4">
                    <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <span className="text-[8px] font-black text-white/20 uppercase tracking-widest block mb-1">Grade Level</span>
                        <p className="text-xl font-serif font-black text-white/80">Grade {enquiry.grade}</p>
                    </div>
                    <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <span className="text-[8px] font-black text-white/20 uppercase tracking-widest block mb-1">Destination</span>
                        <p className="text-[11px] font-bold text-white/60 lowercase tracking-tight italic truncate">{enquiry.branch_name || 'Main Campus'}</p>
                    </div>
                </section>

                <div className="mt-auto pt-10 opacity-5 grayscale text-center">
                    <RadarIcon className="w-8 h-8 mx-auto" />
                    <p className="text-[8px] font-black uppercase tracking-[0.5em] mt-3 leading-relaxed">Registry Protocol<br />V8.4.2</p>
                </div>
            </div>
        </div>
    );
}
