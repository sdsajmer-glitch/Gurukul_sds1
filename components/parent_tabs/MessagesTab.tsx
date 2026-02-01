
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase, formatError } from '../../services/supabase';
import { MyEnquiry, TimelineItem, EnquiryStatus, Communication } from '../../types';
import Spinner from '../common/Spinner';
import { motion, AnimatePresence } from 'framer-motion';

// --- Authoritative Icons ---
const MegaphoneIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);
const ShieldCheckIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
);
const RadarIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);
const TerminalIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
    </svg>
);
const SendIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
);

type Tab = 'broadcasts' | 'enquiries';

const statusConfig: { [key in EnquiryStatus]: { color: string; bg: string } } = {
    'ENQUIRY_ACTIVE': { color: 'text-blue-400', bg: 'bg-blue-400/10' },
    'ENQUIRY_VERIFIED': { color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    'ENQUIRY_IN_REVIEW': { color: 'text-purple-400', bg: 'bg-purple-400/10' },
    'ENQUIRY_CONTACTED': { color: 'text-amber-400', bg: 'bg-amber-400/10' },
    'ENQUIRY_REJECTED': { color: 'text-rose-400', bg: 'bg-rose-400/10' },
    'ENQUIRY_CONVERTED': { color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
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
    const [activeTab, setActiveTab] = useState<Tab>('broadcasts');
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

    const handleSwitchTab = (t: Tab) => {
        setActiveTab(t);
        if (t === 'broadcasts' && announcements.length > 0) setSelectedAnnouncement(announcements[0]);
        else if (t === 'enquiries' && enquiries.length > 0) setSelectedEnquiry(enquiries[0]);
    };

    if (loading && announcements.length === 0 && enquiries.length === 0) {
        return (
            <div className="h-[80vh] flex flex-col items-center justify-center space-y-8">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150 animate-pulse"></div>
                    <div className="relative w-20 h-20 bg-primary/10 rounded-3xl border border-primary/20 flex items-center justify-center shadow-2xl">
                        <RadarIcon className="w-10 h-10 text-primary animate-spin-slow" />
                    </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white animate-pulse">Synchronizing verified message history…</p>
                    <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Establishing secure node handshake</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto py-6 px-4 md:px-8 space-y-8 h-[calc(100vh-1rem)] md:h-[calc(100vh-2rem)] flex flex-col">
            {/* Header - Fixed */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/[0.05] pb-6 shrink-0">
                <div className="space-y-1">
                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.5em] opacity-80">Institutional Registry</span>
                    <h1 className="text-3xl md:text-4xl font-serif font-black text-white tracking-tighter uppercase leading-none">Inbox <span className="text-white/20 italic font-medium">Channel.</span></h1>
                    <p className="text-xs text-white/40 mt-1 font-medium max-w-lg italic">Synchronized handshake terminal for all official school communications.</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="hidden md:flex items-center gap-3 bg-white/5 px-4 py-1.5 rounded-xl border border-white/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></div>
                        <span className="text-[9px] font-black text-white/60 tracking-[0.2em] uppercase">Identity Link Secured</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">
                {/* 1. Sidebar - Ledger */}
                <div className={`lg:w-[400px] flex flex-col shrink-0 transition-transform duration-300 lg:translate-x-0 ${isMobileMenuOpen ? 'fixed inset-0 z-50 bg-black' : 'hidden lg:flex'}`}>
                    <div className="bg-[#0c0d12]/60 backdrop-blur-xl rounded-[2.5rem] border border-white/5 flex flex-col overflow-hidden shadow-2xl h-full">
                        {/* Tab Switcher */}
                        <div className="p-6 pb-2">
                            <div className="flex items-center justify-between mb-4 lg:hidden">
                                <h3 className="text-xs font-black text-white/60 tracking-widest uppercase">Select Payload</h3>
                                <button onClick={() => setIsMobileMenuOpen(false)} className="text-white/40 font-black text-lg p-2">&times;</button>
                            </div>
                            <div className="flex p-1.5 bg-black/40 rounded-[1.5rem] border border-white/5">
                                {(['broadcasts', 'enquiries'] as Tab[]).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => { handleSwitchTab(t); if (window.innerWidth < 1024) setIsMobileMenuOpen(false); }}
                                        className={`flex-1 py-3 text-[9px] font-black uppercase tracking-[0.25em] rounded-xl transition-all duration-300 ${activeTab === t
                                            ? 'bg-primary/20 text-primary shadow-lg border border-primary/20'
                                            : 'text-white/20 hover:text-white/40'}`}
                                    >
                                        {t.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Node List */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
                            <AnimatePresence mode="wait">
                                {activeTab === 'broadcasts' ? (
                                    <motion.div key="broadcast-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2 pb-10">
                                        {announcements.length === 0 ? <EmptyNode label="Broadcasts" /> : announcements.map(msg => (
                                            <button
                                                key={msg.id}
                                                onClick={() => { setSelectedAnnouncement(msg); setIsMobileMenuOpen(false); }}
                                                className={`w-full p-5 rounded-[2rem] text-left transition-all duration-300 border group relative overflow-hidden ${selectedAnnouncement?.id === msg.id
                                                    ? 'bg-primary/10 border-primary/40 shadow-xl'
                                                    : 'bg-white/[0.01] border-white/[0.02] hover:bg-white/[0.04] opacity-50 hover:opacity-100'}`}
                                            >
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <MegaphoneIcon className={`w-3 h-3 ${selectedAnnouncement?.id === msg.id ? 'text-primary' : 'text-white/20'}`} />
                                                        <span className="text-[8px] font-black uppercase tracking-widest text-white/40">{msg.sender_name || 'Official'}</span>
                                                    </div>
                                                    <span className="text-[8px] font-bold text-white/10 uppercase tracking-widest">{formatTimeAgo(msg.sent_at)}</span>
                                                </div>
                                                <h4 className="text-xs font-black text-white uppercase tracking-tight leading-none group-hover:text-primary transition-colors truncate">{msg.subject}</h4>
                                                <p className="text-[9px] text-white/20 mt-1.5 font-medium line-clamp-1">{msg.body}</p>
                                                {selectedAnnouncement?.id === msg.id && <div className="absolute top-5 right-5 animate-in zoom-in"><ShieldCheckIcon className="w-2.5 h-2.5 text-primary" /></div>}
                                            </button>
                                        ))}
                                    </motion.div>
                                ) : (
                                    <motion.div key="enquiry-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2 pb-10">
                                        {enquiries.length === 0 ? <EmptyNode label="Enquiries" /> : enquiries.map(enq => (
                                            <button
                                                key={enq.id}
                                                onClick={() => { setSelectedEnquiry(enq); setIsMobileMenuOpen(false); }}
                                                className={`w-full p-5 rounded-[2rem] text-left transition-all duration-300 border group relative overflow-hidden ${selectedEnquiry?.id === enq.id
                                                    ? 'bg-gradient-to-r from-indigo-500/10 to-indigo-500/5 border-indigo-500/30 shadow-2xl shadow-indigo-500/5'
                                                    : 'bg-white/[0.01] border-white/[0.02] hover:bg-white/[0.03] opacity-60 hover:opacity-100'}`}
                                            >
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <TerminalIcon className={`w-3 h-3 ${selectedEnquiry?.id === enq.id ? 'text-indigo-400' : 'text-white/20'}`} />
                                                        <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Node: {String(enq.id).slice(0, 8)}</span>
                                                    </div>
                                                    <span className="text-[8px] font-bold text-white/10 uppercase tracking-widest">{formatTimeAgo(enq.updated_at)}</span>
                                                </div>
                                                <h4 className={`text-xs font-black uppercase tracking-tight leading-none transition-colors truncate mb-3 ${selectedEnquiry?.id === enq.id ? 'text-white' : 'text-white/80 group-hover:text-indigo-300'}`}>{enq.applicant_name}</h4>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-md border tracking-widest ${statusConfig[enq.status as EnquiryStatus]?.bg || 'bg-white/5'} ${statusConfig[enq.status as EnquiryStatus]?.color || 'text-white/20 border-white/5'}`}>
                                                        {enq.status.replace('ENQUIRY_', '')}
                                                    </span>
                                                    <span className="text-[8px] font-bold text-white/10 uppercase tracking-widest">Grade {enq.grade}</span>
                                                </div>
                                                {selectedEnquiry?.id === enq.id && <div className="absolute top-5 right-5 animate-in zoom-in duration-300"><ShieldCheckIcon className="w-3 h-3 text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]" /></div>}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* 2. Main Viewport */}
                <div className="flex-1 flex flex-col bg-[#0c0d12]/40 backdrop-blur-3xl rounded-[3rem] border border-white/5 relative overflow-hidden min-w-0">
                    {/* Mobile Menu Trigger */}
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="lg:hidden absolute top-4 left-4 z-10 p-3 bg-white/5 border border-white/10 rounded-2xl text-white/60 hover:text-white"
                    >
                        <RadarIcon className="w-5 h-5" />
                    </button>

                    <AnimatePresence mode="wait">
                        {activeTab === 'broadcasts' ? (
                            selectedAnnouncement ? (
                                <motion.div key={`view-${selectedAnnouncement.id}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full uppercase">
                                    <header className="p-8 md:p-10 border-b border-white/[0.05] bg-black/20 flex flex-col gap-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.5em]">Official Handshake</span>
                                            <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">{formatTimeAgo(selectedAnnouncement.sent_at)}</span>
                                        </div>
                                        <h2 className="text-2xl md:text-3xl font-serif font-black text-white leading-tight tracking-tight uppercase">{selectedAnnouncement.subject}</h2>
                                        <div className="flex items-center gap-2 pt-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40"></div>
                                            <span className="text-[11px] font-black text-white/40 uppercase tracking-widest leading-none">Authority: {selectedAnnouncement.sender_name || 'Central Command'}</span>
                                        </div>
                                    </header>
                                    <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar">
                                        <div className="max-w-2xl mx-auto space-y-12">
                                            <div className="w-12 h-1.5 bg-primary/20 rounded-full"></div>
                                            <p className="text-base md:text-xl text-white/60 font-serif leading-relaxed italic border-l-2 border-white/5 pl-8 normal-case">
                                                {selectedAnnouncement.body}
                                            </p>
                                            <div className="pt-20 opacity-10 flex items-center gap-4 text-[10px] font-black grayscale flex-wrap">
                                                <ShieldCheckIcon className="w-6 h-6 shrink-0" /> INTEGRITY LEDGER: {selectedAnnouncement.id}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : <ReadingStandby title="BROADCAST PAYLOAD STANDBY" />
                        ) : (
                            selectedEnquiry ? (
                                <EnquiryHandshakeChannel enquiry={selectedEnquiry} refresh={fetchData} />
                            ) : <ReadingStandby title="ENQUIRY PAYLOAD STANDBY" />
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

function EmptyNode({ label }: { label: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-6 opacity-30">
            <RadarIcon className="w-12 h-12 text-white/20" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] leading-relaxed">No active {label} payloads detected in registry.</p>
        </div>
    );
}

function ReadingStandby({ title }: { title: string }) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-20 text-center animate-in fade-in duration-1000">
            <div className="relative mb-12">
                <div className="absolute inset-0 bg-primary/5 rounded-full blur-[100px]"></div>
                <MegaphoneIcon className="w-24 h-24 text-white/5 relative z-10" />
            </div>
            <h3 className="text-2xl font-serif font-black text-white uppercase tracking-widest mb-4 opacity-60">{title}</h3>
            <p className="text-sm font-serif italic text-white/20 max-w-xs leading-relaxed">Select a registry node to decrypt and initialize the institutional handshake channel.</p>
            <div className="mt-16 pt-8 border-t border-white/[0.03] flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.5em] text-white/5">
                <ShieldCheckIcon className="w-4 h-4" /> End-to-End Encrypted Payload
            </div>
        </div>
    );
}

function EnquiryHandshakeChannel({ enquiry, refresh }: { enquiry: MyEnquiry, refresh: (s?: boolean) => void }) {
    const [messages, setMessages] = useState<TimelineItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const isAtBottom = useRef(true);

    const loadTimeline = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_enquiry_timeline_v3', { p_enquiry_id: String(enquiry.id) });
        if (!error && data) {
            // Sort by created_at ascending (Oldest -> Newest) so new messages appear at the bottom
            const sortedData = [...data].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            setMessages(sortedData);
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

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior
            });
        }
    };

    useEffect(() => {
        if (isAtBottom.current) {
            scrollToBottom('auto');
        }
    }, [messages]);

    const handleScroll = () => {
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            const threshold = 100;
            isAtBottom.current = scrollHeight - scrollTop - clientHeight < threshold;
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const msg = text.trim();
        if (!msg || sending) return;

        setSending(true);
        try {
            const { error } = await supabase.rpc('send_enquiry_message_v3', {
                p_enquiry_id: String(enquiry.id),
                p_message: msg
            });

            if (error) throw error;

            setText('');
            isAtBottom.current = true;
            await loadTimeline();
            refresh(true);
        } catch (err: any) {
            console.error("Transmission Failure:", err);
            alert(`Transmission Failure: ${err.message || 'Node Handshake Refused'}`);
        } finally {
            setSending(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col lg:flex-row h-full bg-transparent divide-x divide-white/[0.03]">
            {/* Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 h-full">
                {/* Header - Fixed */}
                <header className="px-6 md:px-10 py-6 border-b border-white/[0.05] bg-black/40 backdrop-blur-md shrink-0 z-10">
                    <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.4em]">Identity Handshake</span>
                                <div className="w-1 h-1 rounded-full bg-indigo-500/40"></div>
                                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest shrink-0">Live Link</span>
                            </div>
                            <h2 className="text-xl md:text-2xl font-serif font-black text-white leading-tight tracking-tight uppercase truncate">{enquiry.applicant_name}</h2>
                        </div>
                        <div className="flex items-center gap-3 md:hidden">
                            <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                                <ShieldCheckIcon className="w-4 h-4 text-indigo-400" />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Message Stream - Scrollable */}
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar"
                >
                    {loading && messages.length === 0 ? (
                        <div className="h-full flex items-center justify-center opacity-10"><Spinner /></div>
                    ) : messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-10 select-none text-center">
                            <div className="relative mb-6">
                                <RadarIcon className="w-20 h-20" />
                                <motion.div
                                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                    className="absolute inset-0 bg-primary/20 rounded-full blur-xl"
                                />
                            </div>
                            <p className="text-[12px] font-black uppercase tracking-[0.8em]">Channel Standby</p>
                            <p className="text-[9px] mt-4 max-w-xs leading-relaxed font-serif italic text-white/40">"No enquiries yet. Verified conversations will appear here."</p>
                        </div>
                    ) : (
                        <div className="max-w-4xl mx-auto flex flex-col space-y-6">
                            {messages.map((item, i) => {
                                const isMe = !item.is_admin;
                                return (
                                    <motion.div
                                        key={`${item.created_at}-${i}`}
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        className={`flex flex-col ${!isMe ? 'items-end' : 'items-start'}`}
                                    >
                                        <div className={`flex flex-col max-w-[85%] md:max-w-[70%] space-y-1 ${!isMe ? 'items-end' : 'items-start'}`}>
                                            <div className={`flex items-center gap-2 px-2 ${!isMe ? 'flex-row-reverse' : ''}`}>
                                                <span className={`text-[8px] font-black uppercase tracking-widest ${isMe ? 'text-indigo-300' : 'text-emerald-400'}`}>
                                                    {isMe ? 'Verified Parent' : 'School Official'}
                                                </span>
                                                <div className="w-0.5 h-0.5 rounded-full bg-white/10"></div>
                                                <span className="text-[8px] font-bold text-white/10 uppercase tracking-widest leading-none">
                                                    {formatTimeAgo(item.created_at)}
                                                </span>
                                            </div>
                                            <div className={`p-4 md:p-6 rounded-[2rem] text-sm leading-relaxed border shadow-2xl relative overflow-hidden group/bubble ${!isMe
                                                ? 'bg-gradient-to-br from-[#1a1b26] to-[#0f1016] text-white/90 border-white/10 rounded-tr-none'
                                                : 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white border-indigo-400/20 rounded-tl-none shadow-indigo-500/20'}`}
                                            >
                                                {/* Glossy effect */}
                                                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none"></div>

                                                <p className="font-medium whitespace-pre-wrap break-words normal-case relative z-10">
                                                    {item.details.message}
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Composer - Fixed Bottom */}
                <footer className="px-6 md:px-10 py-6 border-t border-white/[0.05] bg-black/20 backdrop-blur-xl shrink-0">
                    <div className="max-w-4xl mx-auto">
                        <form onSubmit={handleSend} className="relative group">
                            <div className="relative flex gap-3 p-2 bg-white/[0.03] border border-white/5 rounded-[2.5rem] focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-inner">
                                <input
                                    type="text"
                                    value={text}
                                    onChange={e => setText(e.target.value)}
                                    placeholder="Establish encrypted uplink (Parent Response)..."
                                    className="flex-grow h-12 md:h-14 px-6 md:px-8 bg-transparent text-white placeholder:text-white/10 outline-none text-sm font-medium normal-case"
                                />
                                <button
                                    type="submit"
                                    disabled={!text.trim() || sending}
                                    className="w-12 md:w-14 h-12 md:h-14 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-all active:scale-90 disabled:opacity-20 shadow-2xl shrink-0"
                                >
                                    {sending ? <Spinner size="sm" /> : <SendIcon className="w-5 h-5" />}
                                </button>
                            </div>
                        </form>
                        <div className="mt-4 flex items-center justify-center gap-3 opacity-20">
                            <ShieldCheckIcon className="w-3 h-3 text-emerald-400" />
                            <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white">Messages are encrypted and logged for institutional transparency.</span>
                        </div>
                    </div>
                </footer>
            </div>

            {/* Profile Sidebar - Desktop Only */}
            <div className="w-80 flex-shrink-0 bg-black/20 p-10 space-y-10 overflow-y-auto hidden xl:block">
                <section className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em]">Registry Status</h3>
                    <div className={`p-6 rounded-3xl border ${statusConfig[enquiry.status as EnquiryStatus]?.bg || 'bg-white/5'} ${statusConfig[enquiry.status as EnquiryStatus]?.color || 'text-white/20'} border-white/5 shadow-2xl flex flex-col items-center justify-center text-center gap-4`}>
                        <div className="relative">
                            <div className="absolute inset-0 bg-current opacity-20 blur-xl"></div>
                            <ShieldCheckIcon className="w-10 h-10 relative z-10" />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-[0.3em] leading-none">
                            {enquiry.status.replace('ENQUIRY_', '')}
                        </span>
                    </div>
                </section>

                <section className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em]">Academic Context</h3>
                    <div className="space-y-4">
                        <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                            <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] block mb-2">Grade Level</span>
                            <span className="text-xl font-serif font-black text-white/90">Grade {enquiry.grade}</span>
                        </div>
                        <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                            <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] block mb-2">Institutional Target</span>
                            <span className="text-sm font-serif font-black text-white/90 uppercase truncate block">{enquiry.branch_name || 'Main Campus'}</span>
                        </div>
                    </div>
                </section>

                <div className="pt-10 opacity-5 select-none grayscale text-center">
                    <TerminalIcon className="w-10 h-10 mx-auto" />
                    <p className="text-[8px] font-black uppercase tracking-[0.5em] mt-4 leading-relaxed">Identity Profile Node<br />Protocol V5.0.1</p>
                </div>
            </div>
        </motion.div>
    );
}

const DownloadIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
);
