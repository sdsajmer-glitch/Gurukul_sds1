import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, formatError } from '../services/supabase';
import { useRoles } from '../contexts/RoleContext';
import { Communication, Role, BuiltInRoles, SchoolClass, UserProfile } from '../types';
import Spinner from './common/Spinner';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

// --- Authoritative UI Icons ---
const MegaphoneIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const SendIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className={className}><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>;
const TerminalIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" /></svg>;
const RefreshIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>;
const ClockIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const CheckCircleIcon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

const TEMPLATES = [
    { id: 1, name: 'Fee Reminder', subject: 'Important: Pending Fee Payment', body: 'Dear Parent,\n\nThis is a reminder that the institutional dues for the current cycle are now pending. Please finalize the transaction at your earliest convenience to maintain account status.\n\nThank you.' },
    { id: 2, name: 'Exam Notification', subject: 'Uplink Released: Assessment Schedule', body: 'Dear Candidate,\n\nThe synchronization schedule for the upcoming assessments has been finalized. Please review the portal for specific node assignments.\n\nBest of luck!' },
    { id: 3, name: 'Holiday Alert', subject: 'Institutional Standby Status', body: 'Notice: The institution will transition to Standby Status on [Date]. Normal operations will resume on [Date].\n\nCentral Command' },
];

const CommunicationTab: React.FC<{ profile: UserProfile }> = ({ profile }) => {
    const { roles } = useRoles();
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [selectedRoles, setSelectedRoles] = useState<Set<Role>>(new Set());
    const [targetType, setTargetType] = useState<'roles' | 'class'>('roles');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [history, setHistory] = useState<Communication[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [loading, setLoading] = useState({ sending: false, fetching: true });
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    const communicationRoles = useMemo(() => roles.filter(r => r !== BuiltInRoles.SCHOOL_ADMINISTRATION), [roles]);

    const fetchData = useCallback(async () => {
        setLoading(prev => ({ ...prev, fetching: true }));
        try {
            const [histRes, classRes] = await Promise.all([
                supabase.rpc('get_communications_history'),
                supabase.rpc('get_all_classes_for_admin', { p_branch_id: profile?.branch_id || null })
            ]);
            setHistory(histRes.data || []);
            setClasses(classRes.data || []);
        } finally {
            setLoading(prev => ({ ...prev, fetching: false }));
        }
    }, [profile?.branch_id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim() || !body.trim()) return;

        setLoading(prev => ({ ...prev, sending: true }));
        setStatus(null);

        try {
            const { error } = await supabase.rpc('send_bulk_communication', {
                p_subject: subject,
                p_body: body,
                p_recipient_roles: targetType === 'roles' ? Array.from(selectedRoles) : [BuiltInRoles.PARENT_GUARDIAN, BuiltInRoles.STUDENT],
                p_target_criteria: targetType === 'roles' ? { type: 'role' } : { type: 'class', value: selectedClass }
            });

            if (error) throw error;

            setStatus({ type: 'success', msg: 'Broadcast successfully dispatched to the communication node.' });
            setSubject(''); setBody(''); setSelectedRoles(new Set()); setSelectedClass('');
            fetchData();
        } catch (err: any) {
            setStatus({ type: 'error', msg: formatError(err) });
        } finally {
            setLoading(prev => ({ ...prev, sending: false }));
        }
    };

    return (
        <div className="h-[calc(100vh-10rem)] min-h-[700px] flex flex-col md:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 select-none">

            {/* 1. Left: Deployment Console (Composer) */}
            <div className="flex-1 flex flex-col bg-[#050505] rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden group/console relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/[0.02] via-transparent to-transparent pointer-events-none" />

                <header className="px-10 py-8 border-b border-white/[0.03] bg-black/20 flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                            <MegaphoneIcon className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-serif font-black text-white uppercase tracking-tight">Broadcast <span className="opacity-30 font-normal">Console.</span></h2>
                            <p className="text-[9px] font-black uppercase text-white/20 tracking-[0.3em]">Institutional Dispatch Gateway</p>
                        </div>
                    </div>
                </header>

                <form onSubmit={handleSendMessage} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 p-10 space-y-10 overflow-y-auto custom-scrollbar">

                        {/* Target Selection */}
                        <section className="space-y-6">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em]">Recipient Targeting</label>
                                <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                                    <button type="button" onClick={() => setTargetType('roles')} className={clsx("px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all", targetType === 'roles' ? "bg-indigo-600 text-white shadow-lg" : "text-white/20 hover:text-white/40")}>By Role</button>
                                    <button type="button" onClick={() => setTargetType('class')} className={clsx("px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all", targetType === 'class' ? "bg-indigo-600 text-white shadow-lg" : "text-white/20 hover:text-white/40")}>By Class</button>
                                </div>
                            </div>

                            {targetType === 'roles' ? (
                                <div className="flex flex-wrap gap-2">
                                    {communicationRoles.map(role => (
                                        <button
                                            key={role}
                                            type="button"
                                            onClick={() => setSelectedRoles(prev => {
                                                const n = new Set(prev);
                                                n.has(role) ? n.delete(role) : n.add(role);
                                                return n;
                                            })}
                                            className={clsx(
                                                "px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                                selectedRoles.has(role) ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" : "bg-white/[0.02] border-white/5 text-white/20 hover:border-white/20 hover:text-white/40"
                                            )}
                                        >
                                            {role}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <select
                                    value={selectedClass}
                                    onChange={e => setSelectedClass(e.target.value)}
                                    className="w-full bg-white/[0.02] border border-white/10 rounded-2xl px-6 py-4 text-white/60 text-sm outline-none focus:border-indigo-500/50 appearance-none shadow-inner"
                                >
                                    <option value="">Select Academic Node...</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            )}
                        </section>

                        <div className="h-px bg-white/[0.03]" />

                        {/* Content Area */}
                        <section className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em] ml-1">Transmission Subject</label>
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={e => setSubject(e.target.value)}
                                    placeholder="Enter authoritative subject line..."
                                    className="w-full bg-transparent border-b border-white/10 py-3 text-2xl font-serif font-black text-white placeholder:text-white/5 outline-none focus:border-indigo-500 transition-all"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em] ml-1">Payload Content</label>
                                <textarea
                                    value={body}
                                    onChange={e => setBody(e.target.value)}
                                    placeholder="Compose institutional announcement..."
                                    className="w-full h-48 bg-white/[0.02] border border-white/5 rounded-[2rem] p-8 text-white/70 placeholder:text-white/5 text-base leading-relaxed outline-none focus:border-indigo-500/50 transition-all resize-none shadow-inner italic font-serif"
                                />
                            </div>
                        </section>
                    </div>

                    <footer className="px-10 py-8 border-t border-white/[0.03] bg-black/20 space-y-6">
                        {status && (
                            <div className={clsx("p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border animate-in slide-in-from-bottom-2", status.type === 'success' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20")}>
                                {status.msg}
                            </div>
                        )}
                        <div className="flex justify-between items-center px-2">
                            <div className="flex gap-2">
                                {TEMPLATES.map(t => (
                                    <button key={t.id} type="button" onClick={() => { setSubject(t.subject); setBody(t.body); }} className="text-[9px] font-black text-white/10 uppercase tracking-widest hover:text-indigo-400 transition-colors">[{t.name}]</button>
                                ))}
                            </div>
                            <span className="text-[9px] font-mono text-white/10 uppercase">{body.length} CHR EXT-NODE</span>
                        </div>
                        <button
                            type="submit"
                            disabled={loading.sending || !subject.trim() || !body.trim()}
                            className="w-full h-16 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[11px] uppercase tracking-[0.4em] rounded-[1.5rem] shadow-2xl transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center gap-4"
                        >
                            {loading.sending ? <Spinner size="sm" /> : <><SendIcon className="w-5 h-4" /> Initialize Broadcast</>}
                        </button>
                    </footer>
                </form>
            </div>

            {/* 2. Right: Dispatch Ledger (History) */}
            <div className="w-full md:w-[480px] flex flex-col bg-[#050505] rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden relative">
                <header className="px-10 py-8 border-b border-white/[0.03] bg-black/20 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-serif font-black text-white uppercase tracking-tight">Dispatch <span className="opacity-30 font-normal">Log.</span></h2>
                        <p className="text-[9px] font-black uppercase text-white/20 tracking-[0.3em]">Historical Uplink Activity</p>
                    </div>
                    <button onClick={fetchData} className="p-3 text-white/20 hover:text-white transition-colors">
                        <RefreshIcon className={clsx("w-5 h-5", loading.fetching && "animate-spin")} />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                    {loading.fetching && history.length === 0 ? (
                        <div className="h-full flex items-center justify-center opacity-20 animate-pulse"><TerminalIcon className="w-10 h-10" /></div>
                    ) : history.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-center group">
                            <div className="relative mb-10">
                                <div className="absolute inset-0 bg-indigo-500/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                                <div className="relative w-24 h-24 flex items-center justify-center rounded-[2rem] bg-white/[0.02] border border-white/5 shadow-2xl overflow-hidden backdrop-blur-md">
                                    <MegaphoneIcon className="w-10 h-10 text-white/5 mt-[-2px] group-hover:text-indigo-400 group-hover:scale-110 transition-all duration-700" />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-[11px] font-black uppercase tracking-[0.6em] text-white/20">Ledger Silent</h4>
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/10 italic max-w-[200px] leading-relaxed">
                                    No historical transmissions recorded in the current cycle.
                                </p>
                            </div>
                            <div className="mt-12 w-8 h-px bg-white/[0.02]" />
                        </div>
                    ) : (
                        history.map((msg, i) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl hover:border-white/10 transition-all group relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-all">
                                    <ClockIcon className="w-12 h-12" />
                                </div>
                                <div className="flex justify-between items-start mb-4">
                                    <span className="text-[10px] font-mono text-white/40">{new Date(msg.sent_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                                    <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded shadow-[0_0_10px_rgba(99,102,241,0.2)]">{msg.status}</span>
                                </div>
                                <h4 className="text-xs font-bold text-white/80 line-clamp-1 mb-2 uppercase tracking-tight">{msg.subject}</h4>
                                <p className="text-[10px] text-white/20 italic font-serif line-clamp-2 leading-relaxed normal-case">{msg.body}</p>
                                <div className="mt-4 pt-4 border-t border-white/[0.03] flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-white/20" />
                                    <span className="text-[8px] font-black uppercase tracking-wider text-white/10">{Array.isArray(msg.recipients) ? msg.recipients.join(' • ') : 'Broadcast'}</span>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommunicationTab;
