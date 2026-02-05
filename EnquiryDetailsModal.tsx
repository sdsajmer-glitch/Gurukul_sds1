
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

const STATUS_CONFIG: Record<string, { icon: React.ReactNode, label: string, color: string }> = {
    'NEW': { icon: <div className="w-2 h-2 rounded-full bg-blue-500/80 shadow-sm" />, label: 'New', color: 'text-blue-400' },
    'ENQUIRY_ACTIVE': { icon: <div className="w-2 h-2 rounded-full bg-blue-500/80 shadow-sm" />, label: 'Active', color: 'text-blue-400' },
    'ENQUIRY_VERIFIED': { icon: <ShieldCheckIcon className="w-4 h-4 text-teal-500/80" />, label: 'Verified', color: 'text-teal-500' },
    'ENQUIRY_IN_REVIEW': { icon: <ClockIcon className="w-4 h-4 text-purple-500/80" />, label: 'In Review', color: 'text-purple-500' },
    'ENQUIRY_CONTACTED': { icon: <CommunicationIcon className="w-4 h-4 text-amber-500/80" />, label: 'Contacted', color: 'text-amber-500' },
    'ENQUIRY_REJECTED': { icon: <ShieldAlertIcon className="w-4 h-4 text-red-500/80" />, label: 'Rejected', color: 'text-red-500' },
    'ENQUIRY_CONVERTED': { icon: <CheckCircleIcon className="w-4 h-4 text-emerald-500/80" />, label: 'Promoted to Admission', color: 'text-emerald-500' },
};

const ORDERED_STATUSES: EnquiryStatus[] = ['ENQUIRY_ACTIVE', 'ENQUIRY_VERIFIED', 'ENQUIRY_IN_REVIEW', 'ENQUIRY_CONTACTED', 'ENQUIRY_REJECTED'];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TimelineEntry: React.FC<{ item: TimelineItem }> = ({ item }) => {
    if (item.item_type === 'MESSAGE') {
        const isParent = !item.is_admin;
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex w-full mb-2 ${isParent ? 'justify-start' : 'justify-end'}`}
            >
                <div className={`flex flex-col gap-1.5 max-w-[85%] sm:max-w-[75%] ${isParent ? 'items-start' : 'items-end'}`}>
                    <div className={`relative px-4 py-2.5 shadow-sm ${isParent ? 'bg-[#1a1d23] text-white/90 rounded-21xl rounded-tl-none border border-white/[0.04]' : 'bg-primary/95 text-white rounded-21xl rounded-tr-none shadow-primary/10'}`}>
                        {/* Message Tail */}
                        <div className={`absolute top-0 w-3 h-3 ${isParent ? '-left-1.5 bg-[#1a1d23] border-l border-t border-white/[0.04]' : '-right-1.5 bg-primary'} rotate-45 transform pointer-events-none hidden sm:block`} />

                        <p className="text-[14.5px] leading-relaxed font-sans whitespace-pre-wrap relative z-10">{item.details.message}</p>

                        <div className={`flex items-center gap-2 mt-1.5 justify-end relative z-10 opacity-60`}>
                            <span className="text-[10px] font-sans font-medium uppercase tracking-tighter">{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {!isParent && <CheckCircleIcon className="w-3 h-3" />}
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <div className="flex justify-center my-8">
            <div className="flex items-center gap-3 px-5 py-2 rounded-full bg-white/[0.03] border border-white/5 shadow-inner">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" />
                <span className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em]">
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
                <header className="px-8 py-6 border-b border-white/[0.04] bg-[#0c0d12]/80 flex justify-between items-center z-40 flex-shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-white/5 rounded-xl text-white/90 flex items-center justify-center border border-white/10 shadow-sm">
                            <UsersIcon className="w-7 h-7" />
                        </div>
                        <div>
                            <div className="flex items-baseline gap-4 mb-0.5">
                                <h2 className="text-xl md:text-2xl font-bold text-white/90 tracking-tight uppercase">{enquiry.applicant_name}</h2>
                                <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest bg-white/[0.03] px-2 py-0.5 rounded border border-white/5">NODE_{String(enquiry.id).substring(0, 8).toUpperCase()}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[11px] font-semibold text-primary/80 uppercase tracking-widest">Secured Channel</span>
                                <div className="w-1 h-1 rounded-full bg-white/10"></div>
                                <span className="text-[11px] font-medium text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                                    Grade {enquiry.grade} Context
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
                    <div className="flex-1 flex flex-col bg-transparent relative z-10 border-r border-white/[0.03]">
                        <div className="flex-grow overflow-y-auto p-8 md:p-10 space-y-4 custom-scrollbar flex flex-col scroll-smooth bg-[#08090a]/40 relative">
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
                                <div className="flex-grow relative">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        disabled={isLegacyNode || !!syncError}
                                        placeholder={isLegacyNode ? "HANDSHAKE BLOCKED" : "Type a secure message..."}
                                        className={`w-full h-14 pl-7 pr-16 rounded-[1.8rem] bg-[#050608] border border-white/5 text-[15px] text-white/90 placeholder:text-white/10 outline-none transition-all duration-300 focus:border-primary/40 focus:ring-4 focus:ring-primary/5 shadow-inner ${isLegacyNode || syncError ? 'opacity-30 cursor-not-allowed' : ''}`}
                                    />
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-3">
                                        <div className="w-px h-6 bg-white/5" />
                                        <SparklesIcon className="w-5 h-5 text-white/5 group-hover/composer:text-primary transition-colors duration-500" />
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
                        <section className="space-y-6">
                            <h3 className="text-[13px] font-semibold uppercase text-white/30 tracking-wider">Lifecycle Status</h3>

                            <div className="bg-[#13151b] border border-white/10 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center">
                                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 mb-5">
                                    <CheckCircleIcon className="w-10 h-10 text-primary" />
                                </div>
                                <div className="text-center">
                                    <span className="text-[11px] font-black text-primary uppercase tracking-[0.4em]">
                                        {STATUS_CONFIG[enquiry.status]?.label || 'ACTIVE'}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {ORDERED_STATUSES.filter(s => s !== enquiry.status).map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setPendingStatus(s)}
                                        disabled={loading.saving || enquiry.status === 'ENQUIRY_CONVERTED' || enquiry.status === 'ENQUIRY_REJECTED'}
                                        className={`w-full flex items-center justify-between px-5 py-4 rounded-xl border transition-all duration-200 group/btn ${pendingStatus === s ? 'bg-primary/10 border-primary/40 text-white' : 'bg-white/[0.01] border-white/[0.03] text-white/20 hover:border-white/10'}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="transition-transform group-hover/btn:scale-105">
                                                {STATUS_CONFIG[s]?.icon}
                                            </div>
                                            <span className={`text-[12px] font-semibold uppercase tracking-wider ${pendingStatus === s ? 'text-primary' : ''}`}>
                                                {STATUS_CONFIG[s]?.label}
                                            </span>
                                        </div>
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
                        <section className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[13px] font-semibold uppercase text-white/30 tracking-wider">Identity Intel</h3>
                                <button
                                    onClick={handleAIGenerateSummary}
                                    disabled={loading.ai || isLegacyNode || !!syncError}
                                    className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-all disabled:opacity-20 border border-primary/10"
                                    title="AI Synthesis"
                                >
                                    {loading.ai ? <Spinner size="sm" /> : <SparklesIcon className="w-4 h-4" />}
                                </button>
                            </div>

                            <div className="space-y-4">
                                {aiSummary ? (
                                    <div className="bg-primary/[0.03] border border-primary/10 p-6 rounded-2xl animate-in fade-in duration-500">
                                        <p className="text-[13px] font-sans text-white/70 leading-relaxed italic">"{aiSummary}"</p>
                                        <button onClick={() => setAiSummary(null)} className="mt-4 text-[10px] font-bold uppercase text-white/20 hover:text-white/40 transition-colors">Discard</button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] group/intel transition-all hover:border-white/10">
                                            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/[0.03]">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                                                    <UserIcon className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[14px] font-bold text-white/85 truncate uppercase tracking-tight">{enquiry.parent_name || 'Anonymous'}</p>
                                                    <span className="text-[10px] font-medium text-white/20 uppercase tracking-widest">Parent Node</span>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <MailIcon className="w-4 h-4 text-white/15" />
                                                        <span className="text-[13px] text-white/60 font-medium truncate max-w-[200px]">{enquiry.parent_email}</span>
                                                    </div>
                                                    <button onClick={() => handleCopy(enquiry.parent_email, 'email')} className="text-white/10 hover:text-white/40 transition-colors">
                                                        {copiedField === 'email' ? <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" /> : <CopyIcon className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <PhoneIcon className="w-4 h-4 text-white/15" />
                                                        <span className="text-[13px] text-white/60 font-medium tracking-wider">{enquiry.parent_phone || '—'}</span>
                                                    </div>
                                                    {enquiry.parent_phone && (
                                                        <button onClick={() => handleCopy(enquiry.parent_phone, 'phone')} className="text-white/10 hover:text-white/40 transition-colors">
                                                            {copiedField === 'phone' ? <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" /> : <CopyIcon className="w-3.5 h-3.5" />}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] transition-all hover:border-white/10">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 shadow-sm">
                                                    <GraduationCapIcon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-lg font-bold text-white/85 tracking-widest uppercase">GRADE {enquiry.grade}</p>
                                                    <span className="text-[10px] font-medium text-white/20 uppercase tracking-widest">Academic Target</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        {enquiry.status === 'ENQUIRY_CONVERTED' ? (
                            <section className="pt-6 border-t border-white/[0.04]">
                                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                                    <div className="flex items-center justify-center gap-2 text-emerald-500 mb-1">
                                        <CheckCircleIcon className="w-5 h-5" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Handoff Complete</span>
                                    </div>
                                    <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Node promoted to Vault</p>
                                    <button
                                        onClick={() => onNavigate?.('Admissions')}
                                        className="mt-4 w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-[10px] font-bold uppercase tracking-widest border border-white/5 transition-all"
                                    >
                                        View Admission File
                                    </button>
                                </div>
                            </section>
                        ) : (
                            <section className="pt-6 border-t border-white/[0.04]">
                                <button
                                    onClick={handleConvert}
                                    disabled={loading.converting || ['ENQUIRY_ACTIVE', 'ENQUIRY_REJECTED'].includes(enquiry.status)}
                                    className={`w-full h-14 rounded-xl flex items-center justify-center gap-3 font-bold text-xs uppercase tracking-widest transition-all ${!['ENQUIRY_ACTIVE', 'ENQUIRY_REJECTED'].includes(enquiry.status) ? 'bg-[#10b981]/90 text-white hover:bg-[#10b981] shadow-lg shadow-emerald-900/20' : 'bg-white/5 text-white/10 cursor-not-allowed border border-white/5 grayscale'}`}
                                >
                                    {loading.converting ? <Spinner size="sm" /> : (
                                        <>
                                            <GraduationCapIcon className="w-5 h-5 opacity-60" />
                                            <span>Promote to Admission</span>
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
