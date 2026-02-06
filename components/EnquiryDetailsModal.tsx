import React, { useState, useEffect, useCallback, useRef } from 'react';
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

const STATUS_LINE: EnquiryStatus[] = ['NEW', 'ENQUIRY_ACTIVE', 'ENQUIRY_VERIFIED', 'ENQUIRY_IN_REVIEW', 'ENQUIRY_CONTACTED', 'ENQUIRY_REJECTED', 'ENQUIRY_CONVERTED' as any];

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

    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchTimeline = useCallback(async () => {
        try {
            const { data, error } = await supabase.rpc('get_enquiry_timeline_v4', { p_enquiry_id: String(enquiry.id) });
            if (error) throw error;
            // SQL returns Ascending order for chat flow
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
        setSending(true);
        try {
            await EnquiryService.updateStatus(String(enquiry.id), status, `Protocol updated to ${status}`);
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
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 md:p-10 select-none overflow-hidden" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-[#0c0d12] w-full max-w-[1500px] h-full rounded-[2.5rem] border border-white/5 flex flex-col overflow-hidden relative shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* 1. Universal Header (Command Context) */}
                <header className="px-10 py-8 border-b border-white/[0.03] bg-black/20 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
                            <ShieldIcon className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-serif font-black text-white uppercase tracking-tight">{enquiry.applicant_name}</h2>
                            <div className="flex items-center gap-3 mt-1 text-[10px] font-black uppercase text-white/30 tracking-[0.3em]">
                                <span>Identity Node: {String(enquiry.id).slice(0, 8)}</span>
                                <div className="w-1 h-1 rounded-full bg-white/10" />
                                <span className="text-emerald-500/60">Verified Uplink</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl border border-white/10 text-white/20 hover:text-white transition-all"><XIcon className="w-6 h-6" /></button>
                </header>

                {/* 2. Three-Zone Cockpit */}
                <div className="flex-1 flex min-h-0 overflow-hidden">

                    {/* Zone A: Conversational Intelligence */}
                    <div className="flex-1 flex flex-col bg-black/40 relative min-w-0">
                        <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-10 space-y-2 custom-scrollbar">
                            {loading ? (
                                <div className="h-full flex items-center justify-center opacity-30"><Spinner /></div>
                            ) : (
                                <div className="max-w-4xl mx-auto flex flex-col pt-10">
                                    {timeline.map((item, idx) => {
                                        const isSystem = item.item_type === 'ENQUIRY_RECEIVED' || (item.item_type === 'MESSAGE' && item.details.message?.includes('PROTOCOL UPDATE'));
                                        const isMe = item.is_admin;
                                        const prevItem = idx > 0 ? timeline[idx - 1] : null;
                                        const isGrouped = prevItem && prevItem.is_admin === item.is_admin && !isSystem && (prevItem.item_type !== 'ENQUIRY_RECEIVED');

                                        if (isSystem) {
                                            return (
                                                <div key={idx} className="flex justify-center my-8">
                                                    <div className="px-6 py-2 rounded-full bg-white/5 border border-white/10 flex items-center gap-3">
                                                        <div className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
                                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">
                                                            {item.details.status || item.details.message?.split(':')[1]?.trim() || 'Node Activity'}
                                                        </span>
                                                        <span className="text-[9px] text-white/10 font-mono italic">
                                                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                                                    <div className={clsx("flex items-center gap-3 mb-1.5 px-2", isMe ? "flex-row-reverse" : "flex-row")}>
                                                        <PremiumAvatar size="xs" src={item.sender_photo_url} name={item.created_by_name} className="ring-1 ring-white/10" />
                                                        <span className="text-[9px] font-black uppercase text-white/20 tracking-wider">
                                                            {isMe ? 'Institutional Authority' : item.created_by_name}
                                                        </span>
                                                        <span className="text-[8px] font-mono text-white/10 italic">
                                                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className={clsx(
                                                    "max-w-[80%] px-6 py-4 rounded-[1.8rem] text-sm leading-relaxed border shadow-xl relative overflow-hidden group/bubble",
                                                    isMe
                                                        ? "bg-gradient-to-br from-indigo-600 to-indigo-700 text-white border-white/10 rounded-tr-sm"
                                                        : "bg-white/[0.03] text-white/80 border-white/5 rounded-tl-sm"
                                                )}>
                                                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/bubble:opacity-100 transition-opacity pointer-events-none" />
                                                    <p className="normal-case font-medium whitespace-pre-wrap">{item.details.message}</p>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Input Zone - Floating Island Pattern */}
                        <div className="px-10 py-8 border-t border-white/[0.03] bg-black/20 shrink-0">
                            <form onSubmit={handleSend} className="max-w-4xl mx-auto relative">
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-4 text-[10px] font-black text-white/20 tracking-[0.3em] uppercase opacity-0 group-focus-within:opacity-100 transition-all">
                                    <div className="w-10 h-px bg-white/5" />
                                    <span>Encrypted Handshake Terminal</span>
                                    <div className="w-10 h-px bg-white/5" />
                                </div>
                                <div className="flex gap-4 p-2.5 bg-white/[0.03] border border-white/5 rounded-[2.5rem] focus-within:border-indigo-500/30 transition-all shadow-inner">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        placeholder="Type an official response..."
                                        disabled={loading || sending}
                                        className="flex-1 bg-transparent px-8 py-4 text-white placeholder:text-white/10 outline-none text-[15px] font-medium normal-case"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!newMessage.trim() || sending}
                                        className="w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all disabled:opacity-20"
                                    >
                                        {sending ? <Spinner size="sm" /> : <SendIcon className="w-5 h-5" />}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Zone B: Contextual Intelligence (Sidebar) */}
                    <div className="w-[420px] bg-[#090a0f] border-l border-white/[0.03] flex flex-col p-8 space-y-8 overflow-y-auto custom-scrollbar shrink-0">
                        {/* 1. Stepper Protocol */}
                        <section>
                            <h3 className="text-[10px] font-black uppercase text-white/30 tracking-[0.4em] mb-8">Lifecycle Pulse</h3>
                            <div className="relative pl-8 space-y-10">
                                <div className="absolute top-2 left-1.5 bottom-2 w-px bg-white/5" />
                                {STATUS_LINE.map(st => {
                                    const isActive = enquiry.status === st;
                                    const isCompleted = STATUS_LINE.indexOf(enquiry.status) > STATUS_LINE.indexOf(st);
                                    return (
                                        <div key={st} className="relative flex items-center group">
                                            <div className={clsx(
                                                "absolute -left-8 w-3 h-3 rounded-full border-2 transition-all duration-700",
                                                isActive ? "bg-indigo-500 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.6)]" :
                                                    isCompleted ? "bg-emerald-500 border-emerald-400" : "bg-black border-white/10"
                                            )} />
                                            <button
                                                onClick={() => handleAction(st)}
                                                disabled={isActive || sending || enquiry.status === 'ENQUIRY_CONVERTED'}
                                                className={clsx(
                                                    "text-[10px] font-black uppercase tracking-widest transition-all",
                                                    isActive ? "text-white" : isCompleted ? "text-emerald-500/60" : "text-white/20 group-hover:text-white/40"
                                                )}
                                            >
                                                {st.replace('ENQUIRY_', '').replace('_', ' ')}
                                            </button>
                                            {isActive && (
                                                <div className="ml-auto flex items-center gap-2">
                                                    <div className="w-1 h-1 rounded-full bg-indigo-500 animate-ping" />
                                                    <span className="text-[8px] font-bold text-indigo-400 uppercase italic">Active</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {enquiry.status === 'ENQUIRY_VERIFIED' && (
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    onClick={handleConvert}
                                    className="w-full mt-12 py-4 rounded-[1.8rem] bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-900/20 flex items-center justify-center gap-3 group"
                                >
                                    <ZapIcon className="w-4 h-4 group-hover:scale-125 transition-transform" />
                                    Promote to Admission Vault
                                </motion.button>
                            )}
                        </section>

                        <div className="h-px bg-white/[0.04]" />

                        {/* 2. Identity Stack */}
                        <section className="space-y-6">
                            <h3 className="text-[10px] font-black uppercase text-white/30 tracking-[0.4em]">Node Metadata</h3>

                            {/* Academic Card */}
                            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl group hover:bg-white/[0.04] transition-all">
                                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest block mb-1">Grade Context</span>
                                <h4 className="text-3xl font-serif font-black text-white/80 italic">Grade {enquiry.grade}</h4>
                            </div>

                            {/* Contact Card */}
                            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl space-y-4">
                                <div className="flex items-center gap-4 border-b border-white/[0.03] pb-4">
                                    <PremiumAvatar src={enquiry.profile_photo_url} name={enquiry.parent_name} size="sm" className="rounded-2xl" />
                                    <div>
                                        <p className="text-[13px] font-bold text-white tracking-tight">{enquiry.parent_name}</p>
                                        <span className="text-[9px] font-black uppercase text-white/20 tracking-wider">Parent Node</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {[
                                        { label: 'Email Relay', val: enquiry.parent_email, icon: null },
                                        { label: 'Mobile Uplink', val: enquiry.parent_phone, icon: null }
                                    ].map(it => it.val && (
                                        <div key={it.label} className="group flex items-center justify-between">
                                            <div className="min-w-0">
                                                <span className="text-[8px] font-black text-white/10 uppercase block mb-0.5">{it.label}</span>
                                                <p className="text-[11px] text-white/40 font-mono truncate">{it.val}</p>
                                            </div>
                                            <button
                                                onClick={() => handleCopy(it.val!, it.label)}
                                                className="p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/5 rounded-lg text-white/40 hover:text-white"
                                            >
                                                {copied === it.label ? <ShieldIcon className="w-3.5 h-3.5 text-emerald-500" /> : <CopyIcon className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Network/Branch Info */}
                            <div className="p-5 bg-indigo-500/[0.03] border border-indigo-500/10 rounded-2xl flex items-center justify-between">
                                <div>
                                    <span className="text-[8px] font-black text-indigo-400/40 uppercase block mb-0.5">Assigned Jurisdiction</span>
                                    <p className="text-[11px] font-bold text-white/70 uppercase tracking-tight truncate max-w-[150px]">{enquiry.branch_name || 'Global HQ Node'}</p>
                                </div>
                                <div className="px-3 py-1.5 bg-indigo-500/20 rounded-lg text-[9px] font-black text-indigo-300 border border-indigo-500/30">
                                    BN-{enquiry.branch_id || '01'}
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}