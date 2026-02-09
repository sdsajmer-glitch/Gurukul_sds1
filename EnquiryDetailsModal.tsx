
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, formatError } from './services/supabase';
import { EnquiryService } from './services/enquiry';
import { Enquiry, TimelineItem, EnquiryStatus } from './types';
import Spinner from './components/common/Spinner';
import { XIcon } from './components/icons/XIcon';
import { CheckCircleIcon } from './components/icons/CheckCircleIcon';
import { GraduationCapIcon } from './components/icons/GraduationCapIcon';
import { ShieldCheckIcon } from './components/icons/ShieldCheckIcon';
import { ClockIcon } from './components/icons/ClockIcon';
import { CommunicationIcon } from './components/icons/CommunicationIcon';
import { SparklesIcon } from './components/icons/SparklesIcon';
import { GoogleGenAI } from '@google/genai';
import { UsersIcon } from './components/icons/UsersIcon';
import { LockIcon } from './components/icons/LockIcon';
import { SaveIcon } from './components/icons/SaveIcon';
import { ShieldAlertIcon } from './components/icons/ShieldAlertIcon';
import { AlertTriangleIcon } from './components/icons/AlertTriangleIcon';
import { MailIcon } from './components/icons/MailIcon';
import { PhoneIcon } from './components/icons/PhoneIcon';
import { CopyIcon } from './components/icons/CopyIcon';
import { UserIcon } from './components/icons/UserIcon';
import { motion, AnimatePresence } from 'framer-motion';

const LocalSendIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
);

const STATUS_CONFIG: Record<string, { icon: React.ReactNode, label: string, color: string, glow: string }> = {
    'NEW': { icon: <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />, label: 'NEW HANDSHAKE', color: 'text-blue-400', glow: 'shadow-blue-500/20' },
    'ENQUIRY_ACTIVE': { icon: <div className="w-2.5 h-2.5 rounded-full bg-blue-500/80 shadow-[0_0_8px_rgba(59,130,246,0.3)]" />, label: 'ACTIVE SIGNAL', color: 'text-blue-400', glow: 'shadow-blue-500/10' },
    'ENQUIRY_VERIFIED': { icon: <ShieldCheckIcon className="w-5 h-5 text-teal-400" />, label: 'IDENTITY VERIFIED', color: 'text-teal-400', glow: 'shadow-teal-500/20' },
    'ENQUIRY_IN_REVIEW': { icon: <ClockIcon className="w-5 h-5 text-purple-400" />, label: 'IN DEEP REVIEW', color: 'text-purple-400', glow: 'shadow-purple-500/20' },
    'ENQUIRY_CONTACTED': { icon: <CommunicationIcon className="w-5 h-5 text-amber-400" />, label: 'CONTACT ESTABLISHED', color: 'text-amber-400', glow: 'shadow-amber-500/20' },
    'ENQUIRY_REJECTED': { icon: <ShieldAlertIcon className="w-5 h-5 text-rose-400" />, label: 'REJECTED NODE', color: 'text-rose-400', glow: 'shadow-rose-500/20' },
    'ENQUIRY_CONVERTED': { icon: <CheckCircleIcon className="w-5 h-5 text-emerald-400" />, label: 'PROMOTED TO ADMISSION', color: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
};

const ORDERED_STATUSES: EnquiryStatus[] = ['ENQUIRY_ACTIVE', 'ENQUIRY_VERIFIED', 'ENQUIRY_IN_REVIEW', 'ENQUIRY_CONTACTED', 'ENQUIRY_REJECTED'];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TimelineEntry: React.FC<{ item: TimelineItem }> = ({ item }) => {
    if (item.item_type === 'MESSAGE') {
        const isParent = !item.is_admin;
        return (
            <motion.div
                initial={{ opacity: 0, x: isParent ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex w-full mb-6 ${isParent ? 'justify-start' : 'justify-end'}`}
            >
                <div className={`flex flex-col gap-2 max-w-[85%] sm:max-w-[70%] ${isParent ? 'items-start' : 'items-end'}`}>
                    <div className={`relative px-6 py-4 rounded-[1.8rem] transition-all duration-300 ${isParent
                        ? 'bg-[#12141a] text-white/90 rounded-tl-none border border-white/5 shadow-xl shadow-black/20'
                        : 'bg-primary/90 text-white rounded-tr-none shadow-2xl shadow-primary/10 border border-white/10 backdrop-blur-md'
                        }`}>
                        <p className="text-[15px] leading-relaxed font-medium whitespace-pre-wrap relative z-10">{item.details.message}</p>

                        <div className={`flex items-center gap-2 mt-2 pt-2 border-t border-white/5 justify-end relative z-10 opacity-40 group`}>
                            <span className="text-[9px] font-black uppercase tracking-widest">{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {!isParent && <CheckCircleIcon className="w-3.5 h-3.5 text-white/60" />}
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <div className="flex justify-center my-10">
            <div className="flex items-center gap-4 px-6 py-2.5 rounded-full bg-white/[0.02] border border-white/5 shadow-inner backdrop-blur-xl group">
                <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" />
                <span className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em] group-hover:text-white/40 transition-colors">
                    {item.item_type.replace(/_/g, ' ')} • {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </div>
    );
};

interface EnquiryDetailsModalProps {
    enquiry: Enquiry;
    onClose: () => void;
    onUpdate: () => void;
    currentBranchId?: number | null;
    onNavigate?: (component: string) => void;
}

const EnquiryDetailsModal: React.FC<EnquiryDetailsModalProps> = ({ enquiry, onClose, onUpdate, onNavigate }) => {
    const [timeline, setTimeline] = useState<TimelineItem[]>([]);
    const [pendingStatus, setPendingStatus] = useState<EnquiryStatus>(enquiry.status);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState({ timeline: true, saving: false, converting: false, ai: false });
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [isLegacyNode, setIsLegacyNode] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const commsEndRef = useRef<HTMLDivElement>(null);
    const isMounted = useRef(true);

    const handleCopy = (val: string, field: string) => {
        navigator.clipboard.writeText(val);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const fetchTimeline = useCallback(async (isSilent = false) => {
        if (!enquiry?.id) return;
        const idString = String(enquiry.id);

        if (!UUID_REGEX.test(idString)) {
            setIsLegacyNode(true);
            if (isMounted.current) setLoading(prev => ({ ...prev, timeline: false }));
            return;
        }

        if (!isSilent) {
            if (isMounted.current) setLoading(prev => ({ ...prev, timeline: true }));
        }

        setSyncError(null);
        try {
            const { data, error } = await supabase.rpc('get_enquiry_timeline_v3', { p_enquiry_id: idString });
            if (error) throw error;
            if (isMounted.current) {
                // Ensure chronological order: Oldest at top, Newest at bottom
                const sortedTimeline = (data || []).sort((a: any, b: any) =>
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
                setTimeline(sortedTimeline);
                setIsLegacyNode(false);
            }
        } catch (e) {
            if (isMounted.current) setSyncError(formatError(e));
        } finally {
            if (isMounted.current) setLoading(prev => ({ ...prev, timeline: false }));
        }
    }, [enquiry.id]);

    useEffect(() => {
        isMounted.current = true;
        fetchTimeline();

        // REAL-TIME SYNC: Listen for incoming messages/handshakes
        const channel = supabase.channel(`admin-enquiry-sync-${String(enquiry.id)}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'enquiry_messages',
                filter: `enquiry_id=eq.${String(enquiry.id)}`
            }, () => {
                if (isMounted.current) fetchTimeline(true);
            })
            .subscribe();

        return () => {
            isMounted.current = false;
            supabase.removeChannel(channel);
        };
    }, [fetchTimeline, enquiry.id]);

    useEffect(() => {
        if (commsEndRef.current) {
            const container = commsEndRef.current.parentElement;
            if (container) {
                const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
                if (isNearBottom || timeline.length <= 1) {
                    commsEndRef.current.scrollIntoView({ behavior: 'smooth' });
                }
            }
        }
    }, [timeline]);

    const handleAIGenerateSummary = async () => {
        setLoading(prev => ({ ...prev, ai: true }));
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const conversationText = timeline
                .filter(t => t.item_type === 'MESSAGE')
                .map(t => `${t.is_admin ? 'Admin' : 'Parent'}: ${t.details.message}`)
                .join('\n');

            const prompt = `Summarize the following school admission enquiry conversation for ${enquiry.applicant_name} (Grade ${enquiry.grade}). Provide a concise analysis of the parent's primary concerns and the current status of the handshake. Tone: Executive and Brief.\n\nConversation:\n${conversationText}`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt
            });

            setAiSummary(response.text || "Summary unavailable.");
        } catch (err) {
            console.error("AI Context Failure:", formatError(err));
        } finally {
            if (isMounted.current) setLoading(prev => ({ ...prev, ai: false }));
        }
    };

    const executeSave = async (targetStatus: EnquiryStatus, customNote?: string) => {
        setLoading(prev => ({ ...prev, saving: true }));
        try {
            const idString = String(enquiry.id);
            const newNotes = customNote
                ? `${enquiry.notes || ''}${enquiry.notes ? '\n' : ''}${customNote}`
                : enquiry.notes || null;

            // USE SERVICE PROTOCOL (RPC) TO BYPASS RLS AND ENSURE ATOMICITY
            await EnquiryService.updateStatus(idString, targetStatus, newNotes);

            // The service call only updates the status and notes. It doesn't log to timeline.
            // So we need to do it here.
            if (UUID_REGEX.test(idString)) {
                await supabase.rpc('send_enquiry_message_v3', {
                    p_enquiry_id: idString,
                    p_message: `PROTOCOL UPDATE: Application promoted to ${targetStatus}.${customNote ? ` Note: ${customNote}` : ''}`
                });
            }

            onUpdate(); // Re-fetches data in parent
            onClose(); // Closes modal
        } catch (err: any) {
            alert(`Save failed: ${err.message || formatError(err)}`);
        } finally {
            if (isMounted.current) setLoading(prev => ({ ...prev, saving: false }));
        }
    };

    const handleFinalizeSave = async () => {
        let customNote = "";
        if (pendingStatus === 'ENQUIRY_REJECTED') {
            const reason = prompt("Specify the reason for record rejection:");
            if (!reason) return; // User cancelled
            customNote = `Rejected: ${reason}`;
        }

        await executeSave(pendingStatus, customNote);
    };

    const handleQuickVerify = async () => {
        await executeSave('ENQUIRY_VERIFIED', "Profile has been reviewed and verified.");
    };

    const handleConvert = async () => {
        if (loading.converting || enquiry.status === 'ENQUIRY_CONVERTED') return;
        setLoading(prev => ({ ...prev, converting: true }));
        try {
            const result = await EnquiryService.convertToAdmission(String(enquiry.id));
            if (result.success) {
                onUpdate();
                if (result.message?.includes('already finalized')) {
                    alert(result.message);
                }
                onClose();
                onNavigate?.('Admissions');
            }
        } catch (err: any) {
            alert(formatError(err));
        } finally {
            if (isMounted.current) setLoading(prev => ({ ...prev, converting: false }));
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const msg = newMessage.trim();
        if (!msg) return;

        if (isLegacyNode) {
            alert("Record synchronization requires UUID standard node.");
            return;
        }

        try {
            const { error } = await supabase.rpc('send_enquiry_message_v3', {
                p_enquiry_id: String(enquiry.id),
                p_message: msg
            });
            if (error) throw error;
            setNewMessage('');
            await fetchTimeline(true);
        } catch (err) {
            alert("Transmission Failure: " + formatError(err));
        }
    };

    const hasStatusChanged = pendingStatus !== enquiry.status;

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[150] p-0 sm:p-4 md:p-12 overflow-hidden font-sans" onClick={onClose}>
            <div className="bg-[#08090a] rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-[1400px] h-full sm:h-[90vh] flex flex-col border border-white/5 overflow-hidden ring-1 ring-white/10 animate-in fade-in zoom-in-98 duration-300" onClick={e => e.stopPropagation()}>

                {/* Header Area */}
                <header className="px-10 py-8 border-b border-white/[0.04] bg-gradient-to-r from-[#0c0d12] to-[#08090a] flex justify-between items-center z-40 flex-shrink-0">
                    <div className="flex items-center gap-8">
                        <div className="w-16 h-16 bg-white/[0.02] rounded-2xl text-white/90 flex items-center justify-center border border-white/10 shadow-2xl relative group">
                            <div className="absolute inset-0 bg-primary/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-2xl"></div>
                            <UsersIcon className="w-8 h-8 relative z-10" />
                        </div>
                        <div>
                            <div className="flex items-baseline gap-5 mb-1">
                                <h2 className="text-2xl md:text-3xl font-serif font-black text-white tracking-tighter uppercase">{enquiry.applicant_name}</h2>
                                <span className="text-[9px] font-mono text-white/10 uppercase tracking-widest bg-white/[0.02] px-3 py-1 rounded-lg border border-white/[0.05]">NODE::{String(enquiry.id).substring(0, 8).toUpperCase()}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">SECURED CHANNEL ACTIVE</span>
                                </div>
                                <div className="w-1 h-1 rounded-full bg-white/5"></div>
                                <span className="text-[10px] font-bold text-primary/60 uppercase tracking-[0.2em] flex items-center gap-2">
                                    GRADE {enquiry.grade} ACADEMIC TARGET
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => fetchTimeline()}
                            disabled={loading.timeline}
                            className="p-2.5 rounded-lg bg-white/5 text-white/40 hover:text-white transition-all border border-white/5 group"
                            title="Refresh Signal"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${loading.timeline ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                        {enquiry.status === 'ENQUIRY_ACTIVE' && !loading.saving && (
                            <button
                                onClick={handleQuickVerify}
                                className="hidden md:flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-500 font-black text-[10px] uppercase tracking-widest border border-teal-500/20 transition-all shadow-lg active:scale-95 animate-in slide-in-from-right-4"
                            >
                                <ShieldCheckIcon className="w-4 h-4" /> Verify Profile
                            </button>
                        )}
                        <button onClick={onClose} className="p-2.5 rounded-lg bg-white/5 text-white/40 hover:text-white transition-all border border-white/5"><XIcon className="w-5 h-5" /></button>
                    </div>
                </header>

                <div className="flex-grow overflow-hidden flex flex-col lg:flex-row relative">
                    {/* Message Area */}
                    <div className="flex-1 flex flex-col bg-transparent relative z-10 border-r border-white/5">
                        <div className="flex-grow overflow-y-auto p-10 space-y-2 custom-scrollbar flex flex-col scroll-smooth bg-[#08090a] relative">
                            {/* Texture Overlay */}
                            <div className="absolute inset-0 bg-[url('/textures/noise.png')] opacity-[0.02] pointer-events-none grayscale"></div>
                            {loading.timeline && timeline.length === 0 ? (
                                <div className="m-auto flex flex-col items-center gap-4">
                                    <Spinner size="lg" className="text-primary/60" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/10">Establishing Protocol...</p>
                                </div>
                            ) : syncError ? (
                                <div className="m-auto flex flex-col items-center text-center space-y-6">
                                    <AlertTriangleIcon className="w-12 h-12 text-red-500/40" />
                                    <p className="text-sm font-bold text-white/30 uppercase tracking-[0.2em]">{syncError}</p>
                                    <button onClick={() => fetchTimeline()} className="px-6 py-2.5 rounded-full border border-primary/20 text-[10px] font-black text-primary uppercase tracking-widest hover:bg-primary/10 transition-all">Retry Transmission</button>
                                </div>
                            ) : isLegacyNode ? (
                                <div className="m-auto flex flex-col items-center text-center space-y-8">
                                    <LockIcon className="w-20 h-20 text-white/5" />
                                    <div className="space-y-3">
                                        <h4 className="text-xl font-black text-white/30 uppercase tracking-tighter">Legacy Record Locked</h4>
                                        <p className="text-xs text-white/10 uppercase tracking-[0.2em] max-w-xs mx-auto leading-relaxed font-bold">Standard identity node required for secure communications.</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {timeline.length === 0 && (
                                        <div className="m-auto flex flex-col items-center text-center opacity-10 grayscale">
                                            <CommunicationIcon className="w-24 h-24 mb-6" />
                                            <p className="text-[12px] font-black uppercase tracking-[0.5em]">Channel Idle</p>
                                        </div>
                                    )}
                                    <div className="flex flex-col min-h-full justify-end">
                                        {timeline.map((item, idx) => <TimelineEntry key={idx} item={item} />)}
                                        <div ref={commsEndRef} className="h-2" />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Input Composer */}
                        <div className="p-8 border-t border-white/[0.03] bg-[#0c0d12] relative z-20">
                            <form onSubmit={handleSendMessage} className="flex gap-4 items-center max-w-5xl mx-auto group/composer">
                                <div className="flex-grow relative group/input">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        disabled={isLegacyNode || !!syncError}
                                        placeholder={isLegacyNode ? "HANDSHAKE BLOCKED" : "TRANSMIT SECURE PACKET..."}
                                        className={`w-full h-16 pl-8 pr-20 rounded-2xl bg-[#06070a] border border-white/5 text-[15px] text-white/90 placeholder:text-white/10 outline-none transition-all duration-500 focus:border-primary/40 focus:ring-8 focus:ring-primary/5 shadow-2xl ${isLegacyNode || syncError ? 'opacity-30 cursor-not-allowed' : ''}`}
                                    />
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-4">
                                        <div className="w-px h-8 bg-white/10" />
                                        <SparklesIcon className="w-6 h-6 text-white/5 group-focus-within/input:text-primary transition-all duration-700 animate-pulse" />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim() || isLegacyNode || !!syncError}
                                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl ${!newMessage.trim() || isLegacyNode || !!syncError ? 'bg-white/5 text-white/10' : 'bg-primary text-white hover:scale-110 active:scale-95 shadow-primary/20'}`}
                                >
                                    <LocalSendIcon className="w-6 h-6" />
                                </button>
                            </form>
                            <div className="flex items-center justify-center gap-3 mt-6 opacity-30">
                                <div className="h-px w-8 bg-white/10" />
                                <p className="text-[9px] font-black uppercase tracking-[0.5em] text-white/40">Secured Handshake Protocol</p>
                                <div className="h-px w-8 bg-white/10" />
                            </div>
                        </div>
                    </div>

                    {/* Right Control Panel */}
                    <div className="w-full lg:w-[400px] bg-[#090a0f] p-8 space-y-10 overflow-y-auto custom-scrollbar relative z-20">

                        {/* Status Focus Card */}
                        <section className="space-y-8">
                            <h3 className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em]">Current Lifecycle</h3>

                            <div className="relative group/status">
                                <div className={`absolute inset-0 bg-primary/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000`}></div>
                                <div className="relative bg-[#0d0f14] border border-white/5 rounded-[2rem] p-8 shadow-2xl flex flex-col items-center justify-center border-b-primary/20 border-b-2 overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-5">
                                        <ShieldCheckIcon className="w-20 h-20 rotate-12" />
                                    </div>
                                    <div className={`w-24 h-24 rounded-3xl bg-primary/5 flex items-center justify-center border border-primary/20 mb-6 shadow-2xl shadow-primary/5 group-hover:scale-110 transition-transform duration-700`}>
                                        <div className="animate-pulse">
                                            {STATUS_CONFIG[enquiry.status]?.icon}
                                        </div>
                                    </div>
                                    <div className="text-center space-y-2">
                                        <span className={`text-[11px] font-black uppercase tracking-[0.5em] ${STATUS_CONFIG[enquiry.status]?.color}`}>
                                            {STATUS_CONFIG[enquiry.status]?.label || 'ACTIVE NODAL STATE'}
                                        </span>
                                        <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest">Identity Protocol Sync Active</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {ORDERED_STATUSES.filter(s => s !== enquiry.status).map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setPendingStatus(s)}
                                        disabled={loading.saving || enquiry.status === 'ENQUIRY_CONVERTED' || enquiry.status === 'ENQUIRY_REJECTED'}
                                        className={`w-full flex items-center justify-between px-6 py-5 rounded-2xl border transition-all duration-500 group/btn relative overflow-hidden ${pendingStatus === s
                                            ? 'bg-primary/10 border-primary/40 text-white shadow-2xl shadow-primary/5'
                                            : 'bg-white/[0.01] border-white/5 text-white/20 hover:border-white/20 hover:bg-white/[0.03]'
                                            }`}
                                    >
                                        <div className="flex items-center gap-5 relative z-10">
                                            <div className="opacity-60 transition-transform group-hover/btn:scale-110 duration-500">
                                                {STATUS_CONFIG[s]?.icon}
                                            </div>
                                            <span className={`text-[11px] font-black uppercase tracking-[0.3em] ${pendingStatus === s ? 'text-primary' : 'group-hover:text-white/60'}`}>
                                                {STATUS_CONFIG[s]?.label}
                                            </span>
                                        </div>
                                        {pendingStatus === s && (
                                            <motion.div layoutId="active-bg" className="absolute inset-0 bg-primary/5 pointer-events-none" />
                                        )}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={handleFinalizeSave}
                                disabled={loading.saving || !hasStatusChanged}
                                className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest transition-all ${hasStatusChanged ? 'bg-indigo-600/90 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-600/10' : 'bg-white/5 text-white/10 cursor-not-allowed border border-white/5'}`}
                            >
                                {loading.saving ? <Spinner size="sm" className="text-white" /> : <><SaveIcon className="w-4 h-4" /> Commit Status</>}
                            </button>
                        </section>

                        {/* Identity Intel Section */}
                        <section className="space-y-8">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em]">Identity Intel</h3>
                                <button
                                    onClick={handleAIGenerateSummary}
                                    disabled={loading.ai || isLegacyNode || !!syncError}
                                    className="p-2 rounded-xl bg-primary/5 hover:bg-primary/10 text-primary transition-all disabled:opacity-20 border border-primary/10 group/ai"
                                    title="AI Synthesis"
                                >
                                    {loading.ai ? <Spinner size="sm" /> : <SparklesIcon className="w-5 h-5 group-hover:rotate-12 transition-transform duration-500" />}
                                </button>
                            </div>

                            <div className="space-y-6">
                                {aiSummary ? (
                                    <div className="bg-primary/[0.02] border border-primary/20 p-8 rounded-[2rem] animate-in fade-in zoom-in-95 duration-700 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-5">
                                            <SparklesIcon className="w-16 h-16" />
                                        </div>
                                        <p className="text-[14px] font-serif font-medium text-white/80 leading-relaxed italic relative z-10">"{aiSummary}"</p>
                                        <div className="mt-6 pt-6 border-t border-white/5 flex justify-between items-center">
                                            <span className="text-[8px] font-black uppercase tracking-[0.4em] text-white/20">AI GENERATED INSIGHT</span>
                                            <button onClick={() => setAiSummary(null)} className="text-[9px] font-black uppercase text-white/20 hover:text-white/60 transition-colors tracking-widest">Discard</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="p-8 rounded-[2rem] bg-white/[0.01] border border-white/5 group/intel transition-all duration-500 hover:border-white/10 hover:bg-white/[0.02] relative overflow-hidden">
                                            <div className="absolute -right-8 -bottom-8 opacity-[0.02] group-hover/intel:opacity-[0.05] transition-opacity duration-1000">
                                                <UserIcon className="w-32 h-32" />
                                            </div>
                                            <div className="flex items-center gap-6 mb-8 relative z-10">
                                                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-2xl">
                                                    <UserIcon className="w-7 h-7" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-lg font-serif font-black text-white group-hover/intel:text-indigo-400 transition-colors duration-500 uppercase tracking-tight truncate">{enquiry.parent_name || 'ANONYMOUS NODAL ENTRY'}</p>
                                                    <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">PARENT IDENTITY NODE</span>
                                                </div>
                                            </div>

                                            <div className="space-y-4 relative z-10">
                                                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <MailIcon className="w-4 h-4 text-white/10" />
                                                        {enquiry.parent_email ? (
                                                            <a href={`mailto:${enquiry.parent_email}`} className="text-sm text-white/60 font-medium truncate max-w-[200px] hover:text-primary transition-colors hover:underline underline-offset-4">
                                                                {enquiry.parent_email}
                                                            </a>
                                                        ) : (
                                                            <span className="text-sm text-white/20 font-medium italic">No email linked</span>
                                                        )}
                                                    </div>
                                                    <button onClick={() => handleCopy(enquiry.parent_email, 'email')} className="text-white/10 hover:text-white/40 transition-colors">
                                                        {copiedField === 'email' ? <CheckCircleIcon className="w-4 h-4 text-emerald-500" /> : <CopyIcon className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <PhoneIcon className="w-4 h-4 text-white/10" />
                                                        <span className="text-sm text-white/60 font-medium tracking-[0.2em]">{enquiry.parent_phone || 'NO SIGNAL'}</span>
                                                    </div>
                                                    {enquiry.parent_phone && (
                                                        <button onClick={() => handleCopy(enquiry.parent_phone, 'phone')} className="text-white/10 hover:text-white/40 transition-colors">
                                                            {copiedField === 'phone' ? <CheckCircleIcon className="w-4 h-4 text-emerald-500" /> : <CopyIcon className="w-4 h-4" />}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-8 rounded-[2rem] bg-indigo-500/[0.02] border border-white/5 transition-all duration-700 hover:border-indigo-500/20 group/grade relative overflow-hidden">
                                            <div className="absolute inset-0 bg-indigo-500/[0.02] opacity-0 group-hover/grade:opacity-100 transition-opacity"></div>
                                            <div className="flex items-center gap-6 relative z-10">
                                                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 shadow-2xl group-hover:scale-110 transition-transform duration-700">
                                                    <GraduationCapIcon className="w-7 h-7" />
                                                </div>
                                                <div>
                                                    <p className="text-3xl font-serif font-black text-white tracking-widest uppercase">GRADE {enquiry.grade}</p>
                                                    <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">ACADEMIC TARGET VECTOR</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        {enquiry.status === 'ENQUIRY_CONVERTED' ? (
                            <section className="pt-8 border-t border-white/5 mt-auto">
                                <div className="p-8 rounded-[2.5rem] bg-emerald-500/[0.02] border border-emerald-500/20 text-center relative overflow-hidden group/final">
                                    <div className="absolute inset-0 bg-emerald-500/[0.01] opacity-0 group-hover/final:opacity-100 transition-opacity"></div>
                                    <div className="flex flex-col items-center justify-center gap-4 relative z-10">
                                        <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-2xl animate-bounce-subtle">
                                            <CheckCircleIcon className="w-10 h-10 text-emerald-400" />
                                        </div>
                                        <div>
                                            <span className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.5em] block mb-2">HANDOFF FINALIZED</span>
                                            <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold">NODE PROMOTED TO SECURE VAULT</p>
                                        </div>
                                        <button
                                            onClick={() => onNavigate?.('Admissions')}
                                            className="mt-6 w-full py-5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-black uppercase tracking-[0.4em] border border-emerald-500/20 transition-all duration-500 shadow-2xl shadow-emerald-500/5 active:scale-95"
                                        >
                                            VIEW ADMISSION REGISTRY
                                        </button>
                                    </div>
                                </div>
                            </section>
                        ) : (
                            <section className="pt-8 border-t border-white/5 mt-auto">
                                <button
                                    onClick={handleConvert}
                                    disabled={loading.converting || ['ENQUIRY_ACTIVE', 'ENQUIRY_REJECTED'].includes(enquiry.status)}
                                    className={`w-full h-16 rounded-2xl flex items-center justify-center gap-5 font-black text-[11px] uppercase tracking-[0.4em] transition-all duration-700 relative overflow-hidden group/promote shadow-2xl ${!['ENQUIRY_ACTIVE', 'ENQUIRY_REJECTED'].includes(enquiry.status)
                                        ? 'bg-[#10b981] text-white hover:bg-[#0da271] hover:shadow-emerald-500/30'
                                        : 'bg-white/5 text-white/10 cursor-not-allowed border border-white/5 grayscale'
                                        }`}
                                >
                                    <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover/promote:translate-x-[100%] transition-transform duration-1000"></div>
                                    {loading.converting ? <Spinner size="sm" className="text-white" /> : (
                                        <>
                                            <GraduationCapIcon className="w-6 h-6 relative z-10 group-hover:scale-110 transition-transform duration-500" />
                                            <span className="relative z-10">PROMOTE TO ADMISSION</span>
                                        </>
                                    )}
                                </button>
                            </section>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EnquiryDetailsModal;
