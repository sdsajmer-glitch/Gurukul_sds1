import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase, formatError } from '../services/supabase';
import { EnquiryService } from '../services/enquiry';
import { Enquiry, TimelineItem, EnquiryStatus } from '../types';
import Spinner from './common/Spinner';
import PremiumAvatar from './common/PremiumAvatar';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

// --- Authoritative UI Icons ---
const XIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
const SendIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>;
const ShieldIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>;
const ZapIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>;
const CopyIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>;
const ShieldCheckIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>;
const AlertCircleIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>;
const UserGroupIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-3.121-3.122 6.124 6.124 0 00-6.125 0 4.125 4.125 0 00-3.121 3.122 9.337 9.337 0 004.121.952 9.38 9.38 0 002.625-.372z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 110-6 3 3 0 010 6z" /><path strokeLinecap="round" strokeLinejoin="round" d="M3.38 18.93a5.077 5.077 0 013.119-3.441 5.3 5.3 0 013.626 0 5.173 5.173 0 013.119 3.441" /><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 10.5a2.25 2.25 0 110-4.5 2.25 2.25 0 010 4.5z" /></svg>;

const PROTOCOL_STAGES: { id: EnquiryStatus; label: string; description: string }[] = [
    { id: 'NEW', label: 'Identity Initialized', description: 'New inbound enquiry node' },
    { id: 'ENQUIRY_ACTIVE', label: 'Active Pipeline', description: 'Under active institutional review' },
    { id: 'ENQUIRY_VERIFIED', label: 'Verified Uplink', description: 'Documentation and identity verified' },
    { id: 'ENQUIRY_IN_REVIEW', label: 'Strategic Evaluation', description: 'Academic alignment in progress' },
    { id: 'ENQUIRY_CONTACTED', label: 'Stakeholder Dialogue', description: 'Direct communication established' },
    { id: 'ENQUIRY_REJECTED', label: 'Protocol Terminated', description: 'Identity node archived' },
    { id: 'ENQUIRY_CONVERTED' as any, label: 'Promoted to Admission', description: 'Final vault promotion successful' }
];

interface EnquiryDetailsModalProps {
    enquiry: Enquiry;
    onClose: () => void;
    onUpdate: () => void;
    onNavigate?: (component: string) => void;
}

export default function EnquiryDetailsModal({ enquiry, onClose, onUpdate, onNavigate }: EnquiryDetailsModalProps) {
    const [timeline, setTimeline] = useState<TimelineItem[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const [showConfirmPromote, setShowConfirmPromote] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchTimeline = useCallback(async () => {
        try {
            const { data, error } = await supabase.rpc('get_enquiry_timeline_v4', { p_enquiry_id: String(enquiry.id) });
            if (error) throw error;
            setTimeline(data || []);
            setSyncError(null);
        } catch (e) {
            setSyncError(formatError(e));
        } finally {
            setLoading(false);
        }
    }, [enquiry.id]);

    useEffect(() => {
        fetchTimeline();
        const sub = supabase.channel(`enq-${enquiry.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'enquiry_messages', filter: `enquiry_id=eq.${enquiry.id}` }, () => fetchTimeline())
            .subscribe();
        return () => { supabase.removeChannel(sub); };
    }, [fetchTimeline, enquiry.id]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [timeline]);

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const msg = newMessage.trim();
        if (!msg || sending) return;

        setSending(true);
        try {
            const { error } = await supabase.rpc('send_enquiry_message_v3', {
                p_enquiry_id: String(enquiry.id),
                p_message: msg
            });
            if (error) throw error;
            setNewMessage('');
            await fetchTimeline();
        } catch (err: any) {
            alert(formatError(err));
        } finally {
            setSending(false);
        }
    };

    const handleCopy = (txt: string, key: string) => {
        navigator.clipboard.writeText(txt);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    const handleAction = async (status: EnquiryStatus) => {
        if (sending) return;
        setSending(true);
        try {
            // [A] Identity Promotion Protocol
            if (status === 'ENQUIRY_CONVERTED' as any) {
                const res = await EnquiryService.convertToAdmission(String(enquiry.id));
                if (res.success) {
                    onUpdate();
                    // Optional: auto-navigate if the user is a branch admin
                    onClose();
                    onNavigate?.('Admissions');
                    return;
                }
            }

            // [B] Standard Lifecycle Transition
            await EnquiryService.updateStatus(String(enquiry.id), status, `Status transitioned to ${status}`);
            await fetchTimeline();
            onUpdate();
        } catch (e: any) {
            alert(formatError(e));
        } finally {
            setSending(false);
        }
    };

    const handleConvert = async () => {
        setSending(true);
        try {
            const res = await EnquiryService.convertToAdmission(String(enquiry.id));
            if (res.success) {
                onUpdate();
                onClose();
                onNavigate?.('Admissions');
            }
        } catch (e: any) {
            alert(formatError(e));
        } finally {
            setSending(false);
            setShowConfirmPromote(false);
        }
    };

    const groupedTimeline = useMemo(() => {
        return timeline.reduce((acc: { date: string; items: TimelineItem[] }[], item) => {
            const dateStr = new Date(item.created_at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            const lastGroup = acc[acc.length - 1];
            if (lastGroup && lastGroup.date === dateStr) {
                lastGroup.items.push(item);
            } else {
                acc.push({ date: dateStr, items: [item] });
            }
            return acc;
        }, []);
    }, [timeline]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-4 md:p-12 select-none overflow-hidden" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="bg-[#050608] w-full max-w-[1600px] h-full rounded-[3.5rem] border border-white/5 flex flex-col overflow-hidden relative shadow-[0_40px_100px_rgba(0,0,0,0.8)]"
                onClick={e => e.stopPropagation()}
            >
                {/* 1. Global Command Header */}
                <header className="px-12 py-10 border-b border-white/[0.03] bg-black/40 flex items-center justify-between shrink-0 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    <div className="flex items-center gap-8 relative z-10">
                        <div className="relative">
                            <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="relative p-5 bg-indigo-500/10 rounded-[1.8rem] border border-indigo-500/20 shadow-[0_0_40px_rgba(79,70,229,0.15)] ring-1 ring-white/5">
                                <ShieldIcon className="w-8 h-8 text-indigo-400" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-3xl sm:text-4xl font-serif font-black text-white leading-none tracking-tighter uppercase flex items-baseline">
                                {enquiry.applicant_name} <span className="text-indigo-500/40 font-light italic ml-4 lowercase text-xl sm:text-2xl">Identity Profile.</span>
                            </h2>
                            <div className="flex items-center gap-4 opacity-40">
                                <span className="text-[10px] font-black uppercase tracking-[0.4em]">Node Protocol: {String(enquiry.id).slice(0, 8)}</span>
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
                                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.2em] px-2 py-0.5 rounded border border-emerald-500/20">Verified Uplink Active</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 relative z-10">
                        <div className="hidden lg:flex flex-col items-end mr-4">
                            <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Enquiry Source</span>
                            <span className="text-xs font-bold text-white/60 tracking-tight">{enquiry.source || 'Direct Gateway Transmission'}</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-4 bg-white/[0.03] hover:bg-white/[0.08] rounded-2xl border border-white/10 text-white/20 hover:text-white transition-all transform hover:rotate-90 duration-500"
                        >
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                </header>

                {/* 2. Command Cockpit Layout */}
                <div className="flex-1 flex flex-col lg:flex-row min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.03] overflow-y-auto lg:overflow-hidden">

                    {/* Zone A: Central Communication Hub (Primary) */}
                    <div className="flex-1 flex flex-col bg-black/20 relative min-w-0 min-h-[500px] lg:min-h-0">
                        <div ref={scrollRef} className="flex-1 overflow-y-auto px-12 py-12 space-y-12 custom-scrollbar scroll-smooth">
                            {loading ? (
                                <div className="h-full flex items-center justify-center">
                                    <Spinner size="lg" className="opacity-20 translate-y-[-20px]" />
                                </div>
                            ) : (
                                <div className="max-w-4xl mx-auto flex flex-col">
                                    {groupedTimeline.map((group, gIdx) => (
                                        <div key={group.date} className="space-y-8">
                                            {/* Date Separator */}
                                            <div className="flex justify-center items-center gap-6 opacity-20 py-8">
                                                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-white/10" />
                                                <span className="text-[9px] font-black uppercase tracking-[0.4em] whitespace-nowrap">{group.date}</span>
                                                <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-white/10" />
                                            </div>

                                            {group.items.map((item, idx) => {
                                                const isSystem = item.item_type === 'ENQUIRY_RECEIVED' || (item.item_type === 'MESSAGE' && item.details.message?.includes('PROTOCOL UPDATE'));
                                                const isMe = item.is_admin;
                                                const prevItem = idx > 0 ? group.items[idx - 1] : null;
                                                const isGrouped = prevItem && prevItem.is_admin === item.is_admin && !isSystem && (prevItem.item_type !== 'ENQUIRY_RECEIVED');

                                                if (isSystem) {
                                                    return (
                                                        <div key={idx} className="flex justify-center py-4">
                                                            <div className="px-6 py-2.5 rounded-full bg-indigo-500/5 border border-indigo-500/10 flex items-center gap-4 group/chip hover:bg-indigo-500/10 transition-colors">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400/80">
                                                                    {item.details.status || item.details.message?.split(':')[1]?.trim() || 'Registry Activity Synchronized'}
                                                                </span>
                                                                <span className="text-[9px] text-white/10 font-mono italic opacity-0 group-hover/chip:opacity-100 transition-opacity">
                                                                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <motion.div
                                                        key={idx}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ duration: 0.4 }}
                                                        className={clsx("flex flex-col", isMe ? "items-end" : "items-start", !isGrouped && "mt-8")}
                                                    >
                                                        {!isGrouped && (
                                                            <div className={clsx("flex items-center gap-4 mb-3 px-3", isMe ? "flex-row-reverse" : "flex-row")}>
                                                                <PremiumAvatar size="xs" src={item.sender_photo_url} name={item.created_by_name} className="ring-2 ring-white/5 shadow-2xl" />
                                                                <div className={clsx("flex flex-col", isMe ? "items-end" : "items-start")}>
                                                                    <span className="text-[10px] font-black uppercase text-white/40 tracking-wider">
                                                                        {isMe ? 'Institutional Command' : item.created_by_name}
                                                                    </span>
                                                                    <span className="text-[9px] font-mono text-white/10 italic">
                                                                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className={clsx(
                                                            "max-w-[75%] px-8 py-5 rounded-[2.2rem] text-[15px] leading-[1.6] border shadow-[0_20px_60px_rgba(0,0,0,0.4)] relative group/bubble transition-all duration-300",
                                                            isMe
                                                                ? "bg-[#12141c] text-white border-indigo-500/20 rounded-tr-none hover:border-indigo-500/40"
                                                                : "bg-white/[0.02] text-white/90 border-white/[0.05] rounded-tl-none hover:bg-white/[0.04] hover:border-white/10"
                                                        )}>
                                                            <p className="normal-case font-medium whitespace-pre-wrap">{item.details.message}</p>
                                                            {isMe && (
                                                                <div className="absolute top-0 -right-2 w-1 h-6 bg-indigo-500/40 rounded-full blur-[2px]" />
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Interactive Dispatch Terminal */}
                        <div className="px-6 md:px-12 py-10 border-t border-white/[0.03] bg-black/40 shrink-0 relative">
                            <form onSubmit={handleSend} className="max-w-4xl mx-auto group">
                                <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-5 text-[10px] font-black text-white/10 tracking-[0.5em] uppercase pointer-events-none group-focus-within:text-indigo-400 group-focus-within:tracking-[0.6em] transition-all duration-700">
                                    <div className="w-12 h-px bg-white/[0.02] group-focus-within:bg-indigo-500/20 transition-all" />
                                    <span>Authorized Uplink Terminal</span>
                                    <div className="w-12 h-px bg-white/[0.02] group-focus-within:bg-indigo-500/20 transition-all" />
                                </div>
                                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 p-2.5 sm:p-3.5 bg-white/[0.02] border border-white/5 rounded-[2rem] sm:rounded-[3rem] focus-within:border-indigo-500/30 transition-all shadow-inner backdrop-blur-xl group-focus-within:shadow-[0_0_50px_rgba(79,70,229,0.05)]">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        placeholder="Compose institutional dispatch..."
                                        disabled={loading || sending}
                                        className="flex-1 bg-transparent px-6 sm:px-10 py-4 sm:py-5 text-white placeholder:text-white/10 outline-none text-base sm:text-lg font-medium normal-case"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!newMessage.trim() || sending}
                                        className="w-full sm:w-16 h-12 sm:h-16 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl sm:rounded-full flex items-center justify-center shadow-[0_15px_35px_rgba(79,70,229,0.3)] active:scale-95 transition-all disabled:opacity-10 group-focus-within:scale-105"
                                    >
                                        {sending ? <Spinner size="sm" /> : <SendIcon className="w-6 h-6" />}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Zone B: Decision Intelligence Sidebar */}
                    <div className="w-full lg:w-[480px] bg-[#040507] flex flex-col p-6 md:p-12 space-y-12 overflow-y-auto lg:overflow-y-auto custom-scrollbar shrink-0">
                        {/* 1. Progressive Lifecycle Narrative */}
                        <section>
                            <div className="flex items-center justify-between mb-10">
                                <h3 className="text-[11px] font-black uppercase text-white/30 tracking-[0.5em]">Protocol Status</h3>
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-indigo-500 animate-ping" />
                                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest italic">Live Tracking</span>
                                </div>
                            </div>

                            <div className="relative pl-10 space-y-12 mb-10">
                                <div className="absolute top-2 left-[5px] bottom-2 w-[1px] bg-white/[0.03]" />
                                {PROTOCOL_STAGES.map((st, sIdx) => {
                                    const currentIndex = PROTOCOL_STAGES.findIndex(s => s.id === enquiry.status);
                                    const isActive = currentIndex === sIdx;
                                    const isCompleted = currentIndex > sIdx;

                                    // Optimization: Hide Archived/Converted stages in the timeline if not reached
                                    if (st.id === 'ENQUIRY_CONVERTED' as any && enquiry.status !== 'ENQUIRY_CONVERTED') return null;
                                    if (st.id === 'ENQUIRY_REJECTED' && enquiry.status !== 'ENQUIRY_REJECTED') return null;

                                    return (
                                        <div key={st.id} className="relative flex items-center group/step">
                                            <div className={clsx(
                                                "absolute -left-10 w-3 h-3 rounded-full border-2 transition-all duration-1000",
                                                isActive ? "bg-indigo-500 border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.8)] scale-125" :
                                                    isCompleted ? "bg-emerald-500 border-emerald-400/50 opacity-40 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-black border-white/10 opacity-20"
                                            )} />

                                            <div className={clsx(
                                                "flex flex-col text-left transition-all",
                                                isActive ? "translate-x-3" : "opacity-30"
                                            )}>
                                                <span className={clsx(
                                                    "text-[10px] font-black uppercase tracking-widest leading-none",
                                                    isActive ? "text-white" : isCompleted ? "text-emerald-400" : "text-white/40"
                                                )}>
                                                    {st.label}
                                                </span>
                                                <span className="text-[8px] font-bold text-white/20 uppercase mt-1 tracking-widest">
                                                    {isActive ? 'Current Protocol State' : st.description}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Institutional Authority Controls */}
                            <div className="space-y-6">
                                <h3 className="text-[9px] font-black uppercase text-indigo-400/40 tracking-[0.4em]">Administrative Commands</h3>

                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { id: 'ENQUIRY_ACTIVE', label: 'ACTIVATE' },
                                        { id: 'ENQUIRY_VERIFIED', label: 'VERIFY' },
                                        { id: 'ENQUIRY_IN_REVIEW', label: 'REVIEW' },
                                        { id: 'ENQUIRY_CONTACTED', label: 'CONTACT' }
                                    ].map(cmd => (
                                        <button
                                            key={cmd.id}
                                            onClick={() => handleAction(cmd.id as any)}
                                            disabled={enquiry.status === cmd.id || sending || enquiry.status === 'ENQUIRY_CONVERTED'}
                                            className={clsx(
                                                "px-4 py-3 rounded-xl border text-[9px] font-black tracking-widest uppercase transition-all",
                                                enquiry.status === cmd.id
                                                    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-[inset_0_0_20px_rgba(99,102,241,0.05)]"
                                                    : "bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/[0.05] hover:text-white"
                                            )}
                                        >
                                            {cmd.label}
                                        </button>
                                    ))}
                                </div>

                                {/* High Intensity Promotion Trigger */}
                                {enquiry.status === 'ENQUIRY_VERIFIED' && (
                                    <button
                                        onClick={() => handleAction('ENQUIRY_CONVERTED' as any)}
                                        disabled={sending}
                                        className="w-full py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl transition-all flex items-center justify-center gap-3 relative overflow-hidden group/convert"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/convert:translate-x-full transition-transform duration-1000" />
                                        {sending ? <Spinner size="sm" /> : (
                                            <>
                                                <ZapIcon className="w-4 h-4" />
                                                PROMOTE TO ADMISSION
                                            </>
                                        )}
                                    </button>
                                )}

                                {enquiry.status === 'ENQUIRY_CONVERTED' && (
                                    <button
                                        onClick={() => onNavigate?.('Admissions')}
                                        className="w-full py-5 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 font-black text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(16,185,129,0.1)]"
                                    >
                                        <ShieldCheckIcon className="w-4 h-4 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                        IDENTITY ARCHIVED IN VAULT
                                    </button>
                                )}
                            </div>
                        </section>

                        <div className="h-px bg-white/[0.04]" />

                        {/* 2. Decision Intelligence Panels */}
                        <section className="space-y-8">
                            <h3 className="text-[11px] font-black uppercase text-white/30 tracking-[0.5em]">Node Metadata</h3>

                            {/* Academic Alignment Display */}
                            <div className="space-y-6">
                                {/* Student Identity Node */}
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-white/[0.02] blur-xl rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="relative p-10 bg-white/[0.01] border border-white/5 rounded-[3rem] space-y-8">
                                        <div className="flex items-center gap-8">
                                            <div className="relative">
                                                <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <PremiumAvatar src={enquiry.profile_photo_url} name={enquiry.applicant_name} size="lg" className="rounded-3xl border border-white/10 shadow-2xl relative z-10" />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] block mb-2">Subject Alignment</span>
                                                <h4 className="text-4xl font-serif font-black text-white italic tracking-tighter mb-2">{enquiry.applicant_name}</h4>
                                                <div className="flex items-center gap-3">
                                                    <span className="px-3 py-1 bg-white/5 rounded-full text-[9px] font-black text-white/30 uppercase tracking-widest border border-white/5">Grade {enquiry.grade} Node</span>
                                                    <div className="w-1 h-1 rounded-full bg-white/10" />
                                                    <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">Primary Identity</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Guardian Identity Hierarchy */}
                                <div className="p-10 bg-white/[0.005] border border-white/[0.03] rounded-[3rem] space-y-10 relative overflow-hidden group/guard">
                                    <div className="absolute top-0 right-0 p-8 opacity-[0.02] transform rotate-12 transition-transform duration-1000 group-hover/guard:rotate-45">
                                        <UserGroupIcon className="w-40 h-40" />
                                    </div>

                                    <div className="space-y-8 relative z-10">
                                        {/* Primary Parent */}
                                        <div className="flex items-center gap-6 group/p">
                                            <div className="relative">
                                                <div className="absolute inset-0 bg-white/10 blur-md rounded-2xl opacity-0 group-hover/p:opacity-100 transition-opacity" />
                                                <PremiumAvatar name={enquiry.parent_name} size="md" className="rounded-2xl border border-white/10 shadow-xl" />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="text-[9px] font-black text-indigo-500/60 uppercase tracking-[0.3em] block mb-1">Primary Parent / Guardian</span>
                                                <p className="text-xl font-bold text-white tracking-tight leading-none truncate">{enquiry.parent_name}</p>
                                            </div>
                                        </div>

                                        {/* Secondary Parent Delegate (Nested for hierarchy) */}
                                        {enquiry.secondary_parent_name && (
                                            <div className="flex items-center gap-6 pl-10 border-l border-white/[0.03] group/s">
                                                <div className="relative">
                                                    <div className="absolute inset-0 bg-white/5 blur-md rounded-xl opacity-0 group-hover/s:opacity-100 transition-opacity" />
                                                    <PremiumAvatar name={enquiry.secondary_parent_name} size="sm" className="rounded-xl border border-white/5 opacity-60 shadow-lg" />
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] block mb-1">Secondary Guardian</span>
                                                    <p className="text-base font-bold text-white/60 tracking-tight leading-none truncate">{enquiry.secondary_parent_name}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="h-px bg-white/[0.03]" />

                                    {/* Integrated Contact Uplinks */}
                                    <div className="space-y-4">
                                        <h3 className="text-[9px] font-black uppercase text-white/10 tracking-[0.4em] mb-4">Contact Uplinks</h3>
                                        {[
                                            { label: 'Primary Verified Email', val: enquiry.parent_email, id: 'email' },
                                            { label: 'Primary Mobile Node', val: enquiry.parent_phone, id: 'phone' },
                                            { label: 'Secondary Email Link', val: enquiry.secondary_parent_email, id: 'sec_email' },
                                            { label: 'Secondary Mobile Node', val: enquiry.secondary_parent_phone, id: 'sec_phone' }
                                        ].map(it => it.val && (
                                            <div key={it.id} className="group/meta flex items-center justify-between p-5 rounded-2xl hover:bg-white/[0.03] transition-all border border-transparent hover:border-white/5">
                                                <div className="min-w-0">
                                                    <span className="text-[8px] font-black text-white/10 uppercase block mb-1 tracking-widest">{it.label}</span>
                                                    <p className="text-[13px] text-white/50 font-mono truncate tracking-tight">{it.val}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleCopy(it.val!, it.id)}
                                                    className="p-3 opacity-0 group-hover/meta:opacity-100 transition-all bg-white/5 rounded-xl text-white/40 hover:text-white hover:scale-110 active:scale-90"
                                                >
                                                    {copied === it.id ? <ShieldCheckIcon className="w-4 h-4 text-emerald-400" /> : <CopyIcon className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Jurisdiction Mapping */}
                            <div className="px-8 py-6 bg-gradient-to-r from-indigo-500/[0.02] to-transparent border-l-2 border-indigo-500/20 rounded-r-[2.5rem] flex items-center justify-between group">
                                <div>
                                    <span className="text-[9px] font-black text-indigo-400/40 uppercase block mb-1 tracking-widest">Security Jurisdiction</span>
                                    <p className="text-[12px] font-bold text-white/70 uppercase tracking-widest">{enquiry.branch_name || 'Central Governance HQ'}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <span className="text-[8px] font-black text-white/10 uppercase block">Node Index</span>
                                        <span className="text-[10px] font-mono font-black text-white/30">ID-{enquiry.branch_id || '01'}</span>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>

                {/* Secure Confirmation Overlay */}
                <AnimatePresence>
                    {showConfirmPromote && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-3xl p-8"
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 1.1, opacity: 0 }}
                                className="max-w-2xl w-full bg-[#0a0b0f] rounded-[3.5rem] border border-white/5 p-16 shadow-[0_50px_150px_rgba(0,0,0,1)] relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />

                                <div className="flex flex-col items-center text-center space-y-10">
                                    <div className="w-24 h-24 rounded-[2rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-[0_0_60px_rgba(79,70,229,0.1)]">
                                        <AlertCircleIcon className="w-10 h-10 text-indigo-400" />
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-4xl font-serif font-black text-white uppercase tracking-tighter">Vault Promotion Protocol</h4>
                                        <p className="text-white/40 text-lg font-medium font-serif italic max-w-lg mx-auto">
                                            "You are about to securely transfer this applicant's identity core to the Admission Vault. This action is irreversible and will initialize official enrollment procedures."
                                        </p>
                                    </div>

                                    <div className="w-full bg-white/[0.02] border border-white/5 rounded-3xl p-8 space-y-6 text-left">
                                        <div className="flex items-center gap-4 text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">
                                            <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                            Verification Checklist
                                        </div>
                                        {[
                                            'Confirm applicant eligibility for target grade.',
                                            'Verify all communication history is logged.',
                                            'Initialize parent notification dispatch.',
                                            'Release identity node from temporary enquiry registry.'
                                        ].map((text, i) => (
                                            <div key={i} className="flex items-start gap-4 text-sm font-medium text-white/60">
                                                <ShieldCheckIcon className="w-5 h-5 text-white/10 shrink-0 mt-0.5" />
                                                <span>{text}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex gap-6 w-full pt-6">
                                        <button
                                            onClick={() => setShowConfirmPromote(false)}
                                            className="flex-1 py-6 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-black text-[11px] uppercase tracking-[0.4em] transition-all border border-white/5"
                                        >
                                            Abort Protocol
                                        </button>
                                        <button
                                            onClick={handleConvert}
                                            disabled={sending}
                                            className="flex-1 py-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[11px] uppercase tracking-[0.4em] shadow-xl shadow-indigo-900/20 flex items-center justify-center gap-3 transition-all"
                                        >
                                            {sending ? <Spinner size="sm" /> : <>Confirm Promotion <ZapIcon className="w-4 h-4 ml-2" /></>}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}