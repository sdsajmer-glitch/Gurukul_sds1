import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, formatError } from '../services/supabase';
import { EnquiryService } from '../services/enquiry';
import { Enquiry, TimelineItem, EnquiryStatus } from '../types';
import Spinner from './common/Spinner';
import { XIcon } from './icons/XIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import PremiumAvatar from './common/PremiumAvatar';
import { GraduationCapIcon } from './icons/GraduationCapIcon';
import { ShieldCheckIcon } from './icons/ShieldCheckIcon';
import { ClockIcon } from './icons/ClockIcon';
import { CommunicationIcon } from './icons/CommunicationIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { GoogleGenAI } from '@google/genai';
import { UsersIcon } from './icons/UsersIcon';
import { LockIcon } from './icons/LockIcon';
import { SaveIcon } from './icons/SaveIcon';
import { ShieldAlertIcon } from './icons/ShieldAlertIcon';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon';
import { MailIcon } from './icons/MailIcon';
import { PhoneIcon } from './icons/PhoneIcon';
import { CopyIcon } from './icons/CopyIcon';
import { UserIcon } from './icons/UserIcon';
import { motion, AnimatePresence } from 'framer-motion';

const LocalSendIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
);

const InfoIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
);

const STATUS_CONFIG: Record<string, { icon: React.ReactNode, label: string, color: string, bg: string }> = {
    'NEW': { icon: <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />, label: 'New', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    'ENQUIRY_ACTIVE': { icon: <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />, label: 'Active', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    'ENQUIRY_VERIFIED': { icon: <ShieldCheckIcon className="w-4 h-4 text-teal-400" />, label: 'Verified', color: 'text-teal-400', bg: 'bg-teal-500/10' },
    'ENQUIRY_IN_REVIEW': { icon: <ClockIcon className="w-4 h-4 text-purple-400" />, label: 'In Review', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    'ENQUIRY_CONTACTED': { icon: <CommunicationIcon className="w-4 h-4 text-amber-400" />, label: 'Contacted', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    'ENQUIRY_REJECTED': { icon: <ShieldAlertIcon className="w-4 h-4 text-red-400" />, label: 'Rejected', color: 'text-red-400', bg: 'bg-red-500/10' },
    'ENQUIRY_CONVERTED': { icon: <CheckCircleIcon className="w-4 h-4 text-emerald-400" />, label: 'Converted', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
};

const ORDERED_STATUSES: EnquiryStatus[] = ['NEW', 'ENQUIRY_ACTIVE', 'ENQUIRY_VERIFIED', 'ENQUIRY_IN_REVIEW', 'ENQUIRY_CONTACTED', 'ENQUIRY_REJECTED', 'ENQUIRY_CONVERTED' as any];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TimelineEntry: React.FC<{ item: TimelineItem; prevItem: TimelineItem | null; isLast: boolean }> = ({ item, prevItem, isLast }) => {
    if (item.item_type === 'MESSAGE') {
        const isParent = !item.is_admin;
        const isSameSender = prevItem && prevItem.item_type === 'MESSAGE' && prevItem.is_admin === item.is_admin;
        // Group logic: If same sender and less than 5 minutes difference, group them visually (no header)
        const timeDiff = prevItem ? new Date(item.created_at).getTime() - new Date(prevItem.created_at).getTime() : 0;
        const isGrouped = isSameSender && timeDiff < 1000 * 60 * 5; // 5 mins

        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col w-full ${isParent ? 'items-start' : 'items-end'} ${isGrouped ? 'mt-1' : 'mt-6'}`}
            >
                {!isGrouped && (
                    <div className={`flex items-center gap-2 mb-1.5 px-1 ${isParent ? 'flex-row' : 'flex-row-reverse'}`}>
                        <PremiumAvatar
                            src={item.sender_photo_url}
                            name={isParent ? item.created_by_name : 'Admin'}
                            size="xs"
                            className="ring-1 ring-white/10"
                        />
                        <span className={`text-[9px] font-black uppercase tracking-widest ${isParent ? 'text-white/40' : 'text-indigo-400'}`}>
                            {isParent ? item.created_by_name : 'School Official'}
                        </span>
                        <div className="w-0.5 h-0.5 rounded-full bg-white/20"></div>
                        <span className="text-[9px] font-mono text-white/20">
                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                )}

                <div className={`max-w-[75%] md:max-w-[65%] px-5 py-3 text-[14px] leading-relaxed whitespace-pre-wrap shadow-lg backdrop-blur-sm border
                    ${isParent
                        ? 'bg-[#1a1b23] text-white/90 rounded-2xl rounded-tl-none border-white/5'
                        : 'bg-indigo-500/10 text-indigo-50 rounded-2xl rounded-tr-none border-indigo-500/20 shadow-indigo-500/5'
                    } ${isLast && !isParent ? 'ring-1 ring-indigo-500/30' : ''}`}
                >
                    {item.details.message}
                </div>
            </motion.div>
        );
    }

    // System Messages
    return (
        <div className="flex justify-center my-6 opacity-40">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                <span className="text-[9px] font-bold uppercase text-white/60 tracking-widest">
                    {item.item_type.replace(/_/g, ' ')}
                </span>
                <span className="text-[9px] text-white/30 font-mono">• {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
    const [showRightPanel, setShowRightPanel] = useState(false); // For mobile/tablet

    const commsEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
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
            // Attempt to load anyway, but flag as legacy if it fails
            setIsLegacyNode(true);
        }

        if (!isSilent && isMounted.current) setLoading(prev => ({ ...prev, timeline: true }));
        setSyncError(null);

        try {
            const { data, error } = await supabase.rpc('get_enquiry_timeline_v4', { p_enquiry_id: idString });
            if (error) throw error;
            if (isMounted.current) {
                // Sort Oldest -> Newest so we can render top-down
                const sorted = (data || []).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                setTimeline(sorted);
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
        return () => { isMounted.current = false; };
    }, [fetchTimeline]);

    useEffect(() => {
        if (commsEndRef.current) {
            commsEndRef.current.scrollIntoView({ behavior: 'auto' });
        }
    }, [timeline]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [newMessage]);

    const handleAIGenerateSummary = async () => {
        setLoading(prev => ({ ...prev, ai: true }));
        try {
            // Fix for Vite: Using a more robust way to skip if key is missing
            const apiKey = (window as any).VITE_API_KEY || (import.meta as any).env?.VITE_API_KEY;
            if (!apiKey) throw new Error("AI Uplink Key Missing");

            const ai = new GoogleGenAI({ apiKey });
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

            await EnquiryService.updateStatus(idString, targetStatus, newNotes);

            if (UUID_REGEX.test(idString)) {
                await supabase.rpc('send_enquiry_message_v3', {
                    p_enquiry_id: idString,
                    p_message: `PROTOCOL UPDATE: Application promoted to ${targetStatus}.${customNote ? ` Note: ${customNote}` : ''}`
                });
            }

            onUpdate();
            onClose();
        } catch (err: any) {
            alert(`Save failed: ${formatError(err)}`);
        } finally {
            if (isMounted.current) setLoading(prev => ({ ...prev, saving: false }));
        }
    };

    const handleFinalizeSave = async () => {
        if (pendingStatus === 'ENQUIRY_CONVERTED') {
            handleConvert();
            return;
        }

        let customNote = "";
        if (pendingStatus === 'ENQUIRY_REJECTED') {
            const reason = prompt("Specify the reason for record rejection:");
            if (!reason) return;
            customNote = `Rejected: ${reason}`;
        }

        await executeSave(pendingStatus, customNote);
    };

    const handleQuickVerify = async () => {
        await executeSave('ENQUIRY_VERIFIED', "Profile has been reviewed and verified.");
    };

    const handleConvert = async () => {
        setLoading(prev => ({ ...prev, converting: true }));
        try {
            const result = await EnquiryService.convertToAdmission(String(enquiry.id));
            if (result.success) {
                onUpdate();
                onClose();
                onNavigate?.('Admissions');
            }
        } catch (err: any) {
            alert(formatError(err));
        } finally {
            if (isMounted.current) setLoading(prev => ({ ...prev, converting: false }));
        }
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const msg = newMessage.trim();
        if (!msg) return;

        if (isLegacyNode) {
            alert("Record synchronization requires UUID standard node.");
            return;
        }

        try {
            const { error } = await supabase.rpc('send_enquiry_message_v3', {
                p_enquiry_id: enquiry.id,
                p_message: msg
            });
            if (error) throw error;
            setNewMessage('');
            if (textareaRef.current) textareaRef.current.style.height = 'auto'; // Reset height
            await fetchTimeline(true);
        } catch (err) {
            alert("Transmission Failure: " + formatError(err));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const hasStatusChanged = pendingStatus !== enquiry.status;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[150] p-0 sm:p-2 md:p-6 overflow-hidden font-sans" onClick={onClose}>
            {/* Modal Container */}
            <div
                className="bg-[#08090a] rounded-xl shadow-2xl w-full max-w-[1400px] h-full sm:h-[95vh] flex flex-col border border-white/5 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* 1. Compact Header */}
                <header className="px-6 py-4 border-b border-white/[0.04] bg-[#0c0d12] flex justify-between items-center z-40 shrink-0 select-none">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white/5 rounded-lg text-white/90 flex items-center justify-center border border-white/10">
                            <UsersIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-white tracking-tight uppercase truncate max-w-[200px] md:max-w-md">{enquiry.applicant_name}</h2>
                            <div className="flex items-center gap-3 text-[9px] font-medium text-white/40">
                                <span className="font-mono tracking-widest text-white/30">
                                    ID_{String(enquiry.id).substring(0, 8).toUpperCase()}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-white/20"></span>
                                <span>
                                    {new Date(enquiry.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                                <span className="hidden md:inline-flex items-center gap-1 text-emerald-500/80 font-bold uppercase tracking-wider ml-1">
                                    <ShieldCheckIcon className="w-3 h-3" /> Secure Node
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Mobile Info Toggle */}
                        <button
                            onClick={() => setShowRightPanel(!showRightPanel)}
                            className={`lg:hidden p-2 rounded-lg transition-colors ${showRightPanel ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-white/40'}`}
                        >
                            <InfoIcon className="w-5 h-5" />
                        </button>
                        <button onClick={onClose} className="p-2 rounded-lg bg-white/5 text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-all">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* 2. Main Layout (Two Columns) */}
                <div className="flex-1 flex overflow-hidden relative">

                    {/* Left Panel: Message Stream */}
                    <div className="flex-1 flex flex-col min-w-0 bg-[#050505] relative">
                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 flex flex-col">
                            {loading.timeline && timeline.length === 0 ? (
                                <div className="m-auto flex flex-col items-center gap-4 opacity-50">
                                    <Spinner size="md" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Loading Secure Thread...</p>
                                </div>
                            ) : syncError ? (
                                <div className="m-auto text-center space-y-4">
                                    <AlertTriangleIcon className="w-8 h-8 mx-auto text-red-500/50" />
                                    <p className="text-xs font-bold text-red-400 uppercase tracking-widest">{syncError}</p>
                                    <button onClick={() => fetchTimeline()} className="text-[10px] font-bold text-white/40 underline uppercase hover:text-white">Retry</button>
                                </div>
                            ) : (
                                <div className="flex flex-col flex-1 justify-start">
                                    {isLegacyNode && (
                                        <div className="mx-auto my-8 p-4 rounded-xl bg-red-500/5 border border-red-500/10 text-center max-w-md">
                                            <ShieldAlertIcon className="w-6 h-6 mx-auto text-red-500/40 mb-2" />
                                            <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Legacy Protocol Detected</p>
                                            <p className="text-xs text-red-300/50 mt-1">Messaging capabilities are restricted for this node version.</p>
                                        </div>
                                    )}

                                    {timeline.length === 0 && !isLegacyNode && (
                                        <div className="m-auto text-center opacity-20 select-none">
                                            <CommunicationIcon className="w-12 h-12 mx-auto mb-4" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.4em]">No Communication History</p>
                                        </div>
                                    )}

                                    {/* Timeline Rendering */}
                                    <div className="w-full max-w-3xl mx-auto pb-4">
                                        {timeline.map((item, idx) => (
                                            <TimelineEntry
                                                key={idx}
                                                item={item}
                                                prevItem={idx > 0 ? timeline[idx - 1] : null}
                                                isLast={idx === timeline.length - 1}
                                            />
                                        ))}
                                        <div ref={commsEndRef} className="h-2" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sticky Composer */}
                        <div className="p-4 md:p-6 bg-[#0c0d12] border-t border-white/[0.04] z-10 shrink-0">
                            <div className="max-w-3xl mx-auto space-y-3">
                                <form onSubmit={handleSendMessage} className="relative group">
                                    <div className="relative flex gap-3 p-1.5 bg-white/[0.03] focus-within:bg-white/[0.05] border border-white/5 focus-within:border-indigo-500/30 rounded-2xl transition-all shadow-inner">
                                        <textarea
                                            ref={textareaRef}
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            disabled={isLegacyNode || !!syncError}
                                            rows={1}
                                            placeholder={isLegacyNode ? "Uplink Terminated Only" : "Type your reply... (Enter to send)"}
                                            className={`flex-grow px-4 py-3 bg-transparent text-white placeholder:text-white/20 outline-none text-sm resize-none custom-scrollbar max-h-32 ${isLegacyNode ? 'cursor-not-allowed opacity-50' : ''}`}
                                            style={{ minHeight: '48px' }}
                                        />
                                        <button
                                            type="submit"
                                            disabled={!newMessage.trim() || isLegacyNode || !!syncError}
                                            className="self-end mb-[1px] w-10 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-20 disabled:grayscale shadow-lg shadow-indigo-900/20"
                                            title="Send Message"
                                        >
                                            <LocalSendIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </form>
                                <div className="flex items-center justify-center gap-2 opacity-30 select-none">
                                    <LockIcon className="w-3 h-3 text-emerald-400" />
                                    <p className="text-[9px] font-medium uppercase tracking-widest text-white/60">
                                        All replies are logged & audited for compliance
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Metadata (Side-over on mobile, Fixed on Desktop) */}
                    <div className={`
                        absolute inset-y-0 right-0 w-[300px] bg-[#090a0f] border-l border-white/[0.04] z-30 transition-transform duration-300 ease-in-out
                        lg:relative lg:translate-x-0 lg:block
                        ${showRightPanel ? 'translate-x-0 shadow-2xl' : 'translate-x-full lg:shadow-none'}
                    `}>
                        <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-8">

                            {/* Mobile Close */}
                            <div className="lg:hidden flex justify-end mb-4">
                                <button onClick={() => setShowRightPanel(false)} className="text-white/40"><XIcon className="w-5 h-5" /></button>
                            </div>

                            {/* Section: Status */}
                            <section className="space-y-4">
                                <h3 className="text-[10px] font-black uppercase text-white/20 tracking-[0.2em] mb-4">Lifecycle Protocol</h3>

                                <div className={`p-4 rounded-xl border flex flex-col items-center text-center gap-3 ${STATUS_CONFIG[enquiry.status]?.bg || 'bg-white/5'} ${STATUS_CONFIG[enquiry.status]?.color?.replace('text-', 'border-') || 'border-white/10'}`}>
                                    <div className="scale-125">{STATUS_CONFIG[enquiry.status]?.icon}</div>
                                    <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${STATUS_CONFIG[enquiry.status]?.color}`}>
                                        {STATUS_CONFIG[enquiry.status]?.label}
                                    </span>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mb-2 px-1">Update Status</p>
                                    {ORDERED_STATUSES.filter(s => s !== enquiry.status).map(s => (
                                        <button
                                            key={s}
                                            onClick={() => setPendingStatus(s)}
                                            disabled={loading.saving || enquiry.status === 'ENQUIRY_CONVERTED'}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-200 text-left group
                                                ${pendingStatus === s
                                                    ? 'bg-primary/10 border-primary/40 text-white'
                                                    : 'bg-transparent border-transparent hover:bg-white/[0.03] text-white/30 hover:text-white/60'
                                                }`}
                                        >
                                            <div className={`transition-transform group-hover:scale-110 opacity-70 ${pendingStatus === s ? 'text-primary opacity-100' : ''}`}>
                                                {STATUS_CONFIG[s]?.icon}
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider">{STATUS_CONFIG[s]?.label}</span>
                                        </button>
                                    ))}
                                </div>

                                {hasStatusChanged && (
                                    <button
                                        onClick={handleFinalizeSave}
                                        disabled={loading.saving}
                                        className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-900/20 active:scale-95 transition-all mt-2"
                                    >
                                        {loading.saving ? <Spinner size="sm" /> : "Commit Change"}
                                    </button>
                                )}
                            </section>

                            <div className="w-full h-px bg-white/[0.04]"></div>

                            {/* Section: Identity */}
                            <section className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-[10px] font-black uppercase text-white/20 tracking-[0.2em]">Identity Node</h3>
                                    <button onClick={handleAIGenerateSummary} disabled={loading.ai} className="text-primary hover:text-white transition-colors" title="AI Analysis">
                                        {loading.ai ? <Spinner size="sm" /> : <SparklesIcon className="w-3.5 h-3.5" />}
                                    </button>
                                </div>

                                {aiSummary && (
                                    <div className="p-4 bg-indigo-900/20 border border-indigo-500/20 rounded-xl">
                                        <p className="text-[11px] leading-relaxed text-indigo-200/80 italic">"{aiSummary}"</p>
                                    </div>
                                )}

                                <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <PremiumAvatar src={enquiry.profile_photo_url} name={enquiry.parent_name} size="sm" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-white/90 truncate">{enquiry.parent_name}</p>
                                            <p className="text-[9px] font-medium text-white/30 uppercase tracking-wider">Parent / Guardian</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between group">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <MailIcon className="w-3 h-3 text-white/20 shrink-0" />
                                                <span className="text-[11px] text-white/50 truncate font-mono">{enquiry.parent_email}</span>
                                            </div>
                                            <button onClick={() => handleCopy(enquiry.parent_email, 'email')} className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-white transition-opacity">
                                                {copiedField === 'email' ? <CheckCircleIcon className="w-3 h-3 text-emerald-500" /> : <CopyIcon className="w-3 h-3" />}
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between group">
                                            <div className="flex items-center gap-2">
                                                <PhoneIcon className="w-3 h-3 text-white/20 shrink-0" />
                                                <span className="text-[11px] text-white/50 font-mono">{enquiry.parent_phone}</span>
                                            </div>
                                            {enquiry.parent_phone && (
                                                <button onClick={() => handleCopy(enquiry.parent_phone, 'phone')} className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-white transition-opacity">
                                                    {copiedField === 'phone' ? <CheckCircleIcon className="w-3 h-3 text-emerald-500" /> : <CopyIcon className="w-3 h-3" />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Section: Academic */}
                            <section className="space-y-4">
                                <h3 className="text-[10px] font-black uppercase text-white/20 tracking-[0.2em]">Academic Context</h3>
                                <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5">
                                    <div className="flex items-center gap-3 mb-2">
                                        <GraduationCapIcon className="w-4 h-4 text-purple-400" />
                                        <span className="text-2xl font-black text-white/80">Grade {enquiry.grade}</span>
                                    </div>
                                    <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest pl-7">Target Class</p>
                                </div>
                            </section>

                            <div className="w-full h-px bg-white/[0.04]"></div>

                            {/* Section: Official Notes & Remarks */}
                            {enquiry.notes && (
                                <section className="space-y-4">
                                    <h3 className="text-[10px] font-black uppercase text-white/20 tracking-[0.2em]">Official Remarks</h3>
                                    <div className="p-4 bg-amber-500/[0.03] rounded-xl border border-amber-500/10 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <SaveIcon className="w-10 h-10 text-amber-500" />
                                        </div>
                                        <p className="text-[11px] leading-relaxed text-amber-200/90 font-mono relative z-10 whitespace-pre-wrap">
                                            {enquiry.notes}
                                        </p>
                                    </div>
                                </section>
                            )}

                            {/* Section: Institution Context */}
                            <section className="space-y-4">
                                <h3 className="text-[10px] font-black uppercase text-white/20 tracking-[0.2em]">Network Node</h3>
                                <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5 flex items-center justify-between group hover:bg-white/[0.04] transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                                            <UsersIcon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-white/90">
                                                {enquiry.branch_id ? `Branch Unit #${enquiry.branch_id}` : 'Head Office (Global)'}
                                            </p>
                                            <p className="text-[9px] font-medium text-white/30 uppercase tracking-widest">Assigned Jurisdiction</p>
                                        </div>
                                    </div>
                                    {enquiry.branch_id ? (
                                        <div className="px-2 py-1 rounded bg-indigo-500/20 text-[9px] font-bold text-indigo-300 border border-indigo-500/30">
                                            UNIT-{enquiry.branch_id}
                                        </div>
                                    ) : (
                                        <div className="px-2 py-1 rounded bg-white/10 text-[9px] font-bold text-white/40 border border-white/10">
                                            HQ
                                        </div>
                                    )}
                                </div>
                            </section>

                            <div className="pt-8 opacity-20 flex justify-center">
                                <ShieldCheckIcon className="w-12 h-12" />
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EnquiryDetailsModal;