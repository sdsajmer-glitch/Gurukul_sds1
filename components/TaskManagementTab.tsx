import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, formatError } from '../services/supabase';
import { AdminTask, TaskPriority } from '../types';
import Spinner from './common/Spinner';
import { PlusIcon } from './icons/PlusIcon';
import { SearchIcon } from './icons/SearchIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ChecklistIcon } from './icons/ChecklistIcon';
import { ClockIcon } from './icons/ClockIcon';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { XIcon } from './icons/XIcon';
import { RefreshIcon } from './icons/RefreshIcon';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; glow: string; border: string }> = {
    URGENT: { label: 'Urgent', color: 'text-red-500', bg: 'bg-red-500/10', glow: 'shadow-[0_0_15px_#ef4444]', border: 'border-red-500/20' },
    HIGH: { label: 'High', color: 'text-amber-500', bg: 'bg-amber-500/10', glow: 'shadow-[0_0_15px_#f59e0b]', border: 'border-amber-500/20' },
    MEDIUM: { label: 'Medium', color: 'text-blue-500', bg: 'bg-blue-500/10', glow: '', border: 'border-blue-500/20' },
    LOW: { label: 'Low', color: 'text-slate-500', bg: 'bg-slate-500/10', glow: '', border: 'border-slate-500/20' },
};

const CATEGORIES = ['Admissions', 'Finance', 'Academics', 'HR', 'Facility', 'General'];

const TaskManagementTab: React.FC<{ branchId?: number | null }> = ({ branchId }) => {
    const [tasks, setTasks] = useState<AdminTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRealtimeActive, setIsRealtimeActive] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPriority, setFilterPriority] = useState<string>('All');
    const [isAdding, setIsAdding] = useState(false);
    const [aiProcessing, setAiProcessing] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        priority: 'MEDIUM' as TaskPriority,
        category: 'General',
        due_date: ''
    });

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase.from('admin_tasks').select('*');
            if (branchId) query = query.eq('branch_id', branchId);
            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;
            setTasks(data || []);
        } catch (err) {
            setError(formatError(err));
        } finally {
            setLoading(false);
        }
    }, [branchId]);

    // Real-time Operational Stream Synchronization
    useEffect(() => {
        fetchTasks();

        const channel = supabase.channel(`task-orchestrator-${branchId || 'global'}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'admin_tasks'
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setTasks(prev => [(payload.new as AdminTask), ...prev]);
                } else if (payload.eventType === 'UPDATE') {
                    setTasks(prev => prev.map(t => t.id === (payload.new as AdminTask).id ? (payload.new as AdminTask) : t));
                } else if (payload.eventType === 'DELETE') {
                    setTasks(prev => prev.filter(t => t.id !== payload.old.id));
                }
            })
            .subscribe((status) => {
                setIsRealtimeActive(status === 'SUBSCRIBED');
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchTasks, branchId]);

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.title.trim() || loading) return;
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase.from('admin_tasks').insert({
                ...newTask,
                branch_id: branchId || null,
                created_by: user?.id
            });
            if (error) throw error;
            setIsAdding(false);
            setNewTask({ title: '', description: '', priority: 'MEDIUM', category: 'General', due_date: '' });
        } catch (err) {
            alert(formatError(err));
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (task: AdminTask) => {
        const newStatus = task.status === 'Todo' ? 'Completed' : 'Todo';
        
        // Optimistic UI Reconciliation
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
        
        try {
            const { error } = await supabase.from('admin_tasks').update({ status: newStatus }).eq('id', task.id);
            if (error) throw error;
        } catch (err) {
            fetchTasks(); // Protocol Rollback
        }
    };

    const handleDeleteTask = async (id: string) => {
        if (!confirm("Permanently decommission this duty from the registry?")) return;
        setTasks(prev => prev.filter(t => t.id !== id));
        const { error } = await supabase.from('admin_tasks').delete().eq('id', id);
        if (error) fetchTasks();
    };

    const handleAiAnalyze = async () => {
        if (tasks.length === 0) return;
        setAiProcessing(true);
        setAiSuggestion(null);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const activeTasks = tasks.filter(t => t.status === 'Todo');
            const prompt = `Analyze institutional tasks: ${JSON.stringify(activeTasks)}. Predict node conflict risks and calculate the 'Institutional Health Factor'. Provide a 40-word executive directive for today. Tone: High-fidelity.`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt
            });
            setAiSuggestion(response.text || "Directives finalized.");
        } catch (err) {
            setAiSuggestion("AI Uplink currently saturated.");
        } finally {
            setAiProcessing(false);
        }
    };

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 t.description?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesPriority = filterPriority === 'All' || t.priority === filterPriority;
            return matchesSearch && matchesPriority;
        }).sort((a, b) => {
            const weight = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
            if (a.status === 'Completed' && b.status !== 'Completed') return 1;
            if (a.status !== 'Completed' && b.status === 'Completed') return -1;
            return weight[b.priority] - weight[a.priority];
        });
    }, [tasks, searchTerm, filterPriority]);

    return (
        <div className="space-y-10 animate-in fade-in duration-700 pb-32 max-w-[1400px] mx-auto pt-6 font-sans">
            
            {/* Header / Connectivity Pulse */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8 px-2">
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className={`h-2.5 w-2.5 rounded-full ${isRealtimeActive ? 'bg-emerald-500 shadow-[0_0_12px_#10b981]' : 'bg-red-500 shadow-[0_0_12px_#ef4444]'} animate-pulse`}></div>
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">{isRealtimeActive ? 'Node Sync Active' : 'Registry Handshake Pending'}</span>
                    </div>
                    <h2 className="text-4xl md:text-7xl font-serif font-black text-white tracking-tighter uppercase leading-none">
                        Task <span className="text-white/20 italic font-medium lowercase">orchestrator.</span>
                    </h2>
                    <p className="text-[16px] md:text-xl text-white/40 font-medium leading-relaxed font-serif italic border-l-2 border-white/5 pl-8 max-w-2xl">
                        Autonomous institutional orchestration node. Synchronizing duty cycles across branch layers.
                    </p>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button 
                        onClick={handleAiAnalyze}
                        disabled={aiProcessing || tasks.length === 0}
                        className="h-16 px-10 bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 text-violet-400 rounded-2xl flex items-center justify-center gap-4 transition-all active:scale-95 disabled:opacity-20 shadow-2xl"
                    >
                        {aiProcessing ? <Spinner size="sm" className="text-violet-400"/> : <><SparklesIcon className="w-5 h-5"/> Analyze Flow</>}
                    </button>
                    <button 
                        onClick={() => setIsAdding(true)}
                        className="flex-grow md:flex-none h-16 px-12 bg-primary text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl shadow-[0_24px_48px_-12px_rgba(var(--primary),0.4)] hover:bg-primary/90 transition-all flex items-center justify-center gap-4 transform hover:-translate-y-1 active:scale-95 ring-8 ring-primary/5"
                    >
                        <PlusIcon className="w-6 h-6"/> Provision Duty
                    </button>
                </div>
            </div>

            {/* AI Intelligence Card */}
            <AnimatePresence>
                {aiSuggestion && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.98 }}
                        className="bg-primary/5 border border-primary/20 rounded-[3rem] p-10 relative overflow-hidden group shadow-2xl"
                    >
                        <div className="absolute top-0 right-0 p-12 opacity-[0.04] group-hover:scale-110 transition-transform duration-1000"><SparklesIcon className="w-56 h-56 text-primary" /></div>
                        <div className="relative z-10 flex flex-col md:flex-row items-start justify-between gap-12">
                            <div className="space-y-5 max-w-4xl">
                                <h4 className="text-[11px] font-black uppercase text-primary tracking-[0.5em]">Executive Strategic Directive</h4>
                                <p className="text-2xl md:text-3xl text-white/80 font-serif italic leading-snug">"{aiSuggestion}"</p>
                            </div>
                            <button onClick={() => setAiSuggestion(null)} className="p-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"><XIcon className="w-6 h-6"/></button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Matrix Container */}
            <div className="bg-[#0c0d12] border border-white/5 rounded-[4rem] shadow-[0_64px_128px_-32px_rgba(0,0,0,1)] overflow-hidden min-h-[600px] ring-1 ring-white/10 flex flex-col relative group">
                {/* Search / Filter Ribbon */}
                <div className="p-8 md:p-12 border-b border-white/5 bg-white/[0.01] flex flex-col md:flex-row gap-10 justify-between items-center backdrop-blur-3xl sticky top-0 z-30">
                    <div className="relative w-full md:max-w-2xl group">
                        <SearchIcon className="absolute left-7 top-1/2 -translate-y-1/2 h-6 w-6 text-white/10 group-focus-within:text-primary transition-all duration-500" />
                        <input 
                            type="text" 
                            placeholder="SEARCH DUTY REGISTRY..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value.toUpperCase())}
                            className="w-full pl-16 pr-8 py-6 bg-black/40 border border-white/5 rounded-[1.8rem] text-[16px] font-black text-white focus:bg-black/60 focus:ring-[15px] focus:ring-primary/5 focus:border-primary/40 outline-none transition-all placeholder:text-white/5 tracking-widest shadow-inner font-mono"
                        />
                    </div>
                    
                    <div className="flex bg-black/60 p-2 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar w-full md:w-auto shadow-2xl">
                        {['All', 'URGENT', 'HIGH', 'MEDIUM', 'LOW'].map(p => (
                            <button 
                                key={p}
                                onClick={() => setFilterPriority(p)}
                                className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.25em] transition-all duration-500 whitespace-nowrap ${filterPriority === p ? 'bg-primary/20 text-primary shadow-2xl ring-1 ring-white/10 scale-105 z-10' : 'text-white/20 hover:text-white/50'}`}
                            >
                                {p === 'All' ? 'Active Matrix' : p}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Duty Stream */}
                <div className="flex-grow p-8 md:p-16 space-y-8 relative z-10">
                    {loading ? (
                        <div className="flex flex-col justify-center items-center py-48 gap-10">
                            <Spinner size="lg" className="text-primary/60" />
                            <p className="text-[11px] font-black uppercase text-white/10 tracking-[0.6em] animate-pulse">Establishing Node Connectivity</p>
                        </div>
                    ) : filteredTasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-48 text-center opacity-40 animate-in fade-in duration-1000">
                             <div className="w-32 h-32 bg-white/[0.01] rounded-[3.5rem] flex items-center justify-center mb-12 border-2 border-dashed border-white/5 shadow-inner">
                                <ChecklistIcon className="w-16 h-16 text-white/5" />
                             </div>
                             <h3 className="text-3xl font-serif font-black text-white/80 tracking-tighter uppercase leading-none mb-6">Board Silent.</h3>
                             <p className="text-white/30 max-w-sm text-lg font-serif italic leading-relaxed">No high-impact duties detected for the current session parameters.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-5 max-w-5xl mx-auto">
                            <AnimatePresence mode="popLayout">
                                {filteredTasks.map((task, idx) => {
                                    const config = PRIORITY_CONFIG[task.priority];
                                    const isCompleted = task.status === 'Completed';
                                    return (
                                        <motion.div 
                                            key={task.id}
                                            layout
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ delay: idx * 0.05, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                                            className={`group/task relative p-8 md:p-10 rounded-[3rem] border transition-all duration-700 flex items-center justify-between gap-10 ${isCompleted ? 'bg-black/40 border-white/[0.02] opacity-30 grayscale' : 'bg-[#111319]/40 backdrop-blur-xl border-white/5 hover:border-primary/40 hover:bg-black/60 shadow-3xl'}`}
                                        >
                                            <div className="flex items-center gap-10 flex-grow min-w-0">
                                                <button 
                                                    onClick={() => handleToggleStatus(task)}
                                                    className={`flex-shrink-0 w-16 h-16 rounded-[1.5rem] border-2 transition-all duration-700 flex items-center justify-center relative overflow-hidden ${isCompleted ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_30px_#10b981]' : 'bg-transparent border-white/10 hover:border-primary group-hover/task:scale-110'}`}
                                                >
                                                    {isCompleted ? (
                                                        <CheckCircleIcon className="w-8 h-8 text-white animate-in zoom-in-50" />
                                                    ) : (
                                                        <div className="w-2 h-2 rounded-full bg-white/5 group-hover/task:bg-primary transition-colors"></div>
                                                    )}
                                                </button>
                                                
                                                <div className="min-w-0 flex-grow">
                                                    <div className="flex flex-wrap items-center gap-5 mb-4">
                                                         <span className={`px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-700 ${config.bg} ${config.color} ${config.border} ${config.glow}`}>
                                                            {config.label}
                                                         </span>
                                                         <span className="text-[10px] font-black text-white/10 uppercase tracking-[0.4em]">{task.category} Node</span>
                                                         {task.due_date && (
                                                             <div className="flex items-center gap-3 text-[10px] font-mono font-black text-white/20 uppercase tracking-widest">
                                                                <ClockIcon className="w-4 h-4 opacity-40" />
                                                                {new Date(task.due_date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                                                             </div>
                                                         )}
                                                    </div>
                                                    <h4 className={`text-2xl md:text-3xl font-black tracking-tight uppercase transition-all duration-700 leading-none ${isCompleted ? 'line-through text-white/20' : 'text-white group-hover/task:text-primary'}`}>{task.title}</h4>
                                                    <p className="text-[14px] text-white/30 mt-4 leading-relaxed font-medium line-clamp-1 italic font-serif group-hover/task:text-white/50 transition-colors">{task.description}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-4 opacity-0 group-hover/task:opacity-100 transition-all duration-500 translate-x-4 group-hover/task:translate-x-0">
                                                <button 
                                                    onClick={() => handleDeleteTask(task.id)}
                                                    className="p-6 rounded-[1.5rem] bg-red-500/5 hover:bg-red-500 text-red-500/40 hover:text-white transition-all border border-transparent hover:border-red-500/20 active:scale-90 shadow-2xl"
                                                >
                                                    <TrashIcon className="w-6 h-6"/>
                                                </button>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
                
                {/* Visual Footer */}
                <div className="p-12 border-t border-white/5 bg-black/40 text-center relative z-10">
                    <span className="text-[10px] font-black text-white/5 uppercase tracking-[1em] select-none pointer-events-none">Institutional Protocol v24.4 Governance Matrix</span>
                </div>
            </div>

            {/* Creation Modal */}
            <AnimatePresence>
                {isAdding && (
                    <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[200] flex items-center justify-center p-4 animate-in fade-in duration-500" onClick={() => setIsAdding(false)}>
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 40 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 40 }}
                            className="bg-[#0c0d12] w-full max-w-2xl rounded-[4rem] shadow-[0_80px_160px_-24px_rgba(0,0,0,1)] border border-white/10 flex flex-col overflow-hidden max-h-[92vh] ring-1 ring-white/5" 
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-12 border-b border-white/5 bg-white/[0.02] flex justify-between items-center relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent pointer-events-none opacity-40"></div>
                                <div className="flex items-center gap-8 relative z-10">
                                    <div className="p-5 bg-primary/10 rounded-[1.8rem] text-primary shadow-inner border border-primary/20 ring-[12px] ring-primary/5">
                                        <PlusIcon className="w-8 h-8"/>
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-serif font-black text-white uppercase tracking-tight">Provision Duty</h3>
                                        <p className="text-[10px] font-black text-white/20 tracking-[0.4em] mt-2">Initialize Lifecycle Node</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsAdding(false)} className="p-4 rounded-full hover:bg-white/5 text-white/20 hover:text-white transition-all"><XIcon className="w-10 h-10"/></button>
                            </div>

                            <form onSubmit={handleCreateTask} className="p-12 space-y-12 overflow-y-auto custom-scrollbar flex-grow bg-transparent relative">
                                <div className="space-y-5">
                                    <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.4em] ml-2">Duty Identifier</label>
                                    <input 
                                        required autoFocus
                                        type="text" value={newTask.title} 
                                        onChange={e => setNewTask({...newTask, title: e.target.value.toUpperCase()})}
                                        className="w-full h-20 px-10 bg-black/40 border border-white/5 rounded-[1.8rem] text-xl font-black text-white focus:border-primary/50 focus:ring-[15px] focus:ring-primary/5 outline-none transition-all placeholder:text-white/5 font-mono tracking-widest shadow-inner" 
                                        placeholder="E.G. LEDGER_SYNC_PROTOCOL_B4"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-10">
                                    <div className="space-y-5">
                                        <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.4em] ml-2">Operational Rank</label>
                                        <div className="relative group">
                                            <select 
                                                value={newTask.priority} 
                                                onChange={e => setNewTask({...newTask, priority: e.target.value as TaskPriority})}
                                                className="w-full h-[72px] px-10 bg-black/40 border border-white/5 rounded-[1.8rem] text-[11px] font-black text-white outline-none appearance-none cursor-pointer uppercase tracking-[0.4em] shadow-inner transition-all hover:bg-black/60 focus:border-primary/40"
                                            >
                                                <option value="URGENT">URGENT</option>
                                                <option value="HIGH">HIGH</option>
                                                <option value="MEDIUM">MEDIUM</option>
                                                <option value="LOW">LOW</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-5">
                                        <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.4em] ml-2">Institutional Sector</label>
                                        <div className="relative group">
                                            <select 
                                                value={newTask.category} 
                                                onChange={e => setNewTask({...newTask, category: e.target.value})}
                                                className="w-full h-[72px] px-10 bg-black/40 border border-white/5 rounded-[1.8rem] text-[11px] font-black text-white outline-none appearance-none cursor-pointer uppercase tracking-[0.4em] shadow-inner transition-all hover:bg-black/60 focus:border-primary/40"
                                            >
                                                {CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.4em] ml-2">Contextual Payload</label>
                                    <textarea 
                                        value={newTask.description} 
                                        onChange={e => setNewTask({...newTask, description: e.target.value})}
                                        className="w-full h-40 p-10 bg-black/40 border border-white/5 rounded-[2.5rem] text-[16px] text-white/70 focus:border-primary/50 focus:ring-[15px] focus:ring-primary/5 outline-none transition-all resize-none shadow-inner font-serif italic leading-relaxed" 
                                        placeholder="Define the atomic parameters of this institutional duty..."
                                    />
                                </div>

                                <div className="space-y-5">
                                    <label className="text-[10px] font-black uppercase text-white/30 tracking-[0.4em] ml-2">Handshake Deadline</label>
                                    <input 
                                        type="date" value={newTask.due_date} 
                                        onChange={e => setNewTask({...newTask, due_date: e.target.value})}
                                        className="w-full h-[72px] px-10 bg-black/40 border border-white/5 rounded-[1.8rem] text-[11px] font-black text-white/50 outline-none uppercase tracking-[0.5em] transition-all hover:bg-black/60 focus:border-primary/40" 
                                    />
                                </div>
                            </form>

                            <footer className="p-12 border-t border-white/5 bg-black/40 flex flex-col md:flex-row justify-between items-center gap-8 relative z-30">
                                <button type="button" onClick={() => setIsAdding(false)} className="text-[10px] font-black uppercase tracking-[0.5em] text-white/10 hover:text-white transition-all order-2 md:order-1">Abort Sequence</button>
                                <button 
                                    onClick={handleCreateTask}
                                    disabled={loading || !newTask.title}
                                    className="w-full md:w-auto px-16 py-7 bg-primary text-primary-foreground font-black text-[11px] uppercase tracking-[0.5em] rounded-[2.2rem] shadow-[0_32px_64px_-16px_rgba(var(--primary),0.6)] hover:bg-primary/90 transition-all transform active:scale-95 disabled:opacity-20 flex items-center justify-center gap-5 ring-[12px] ring-primary/5 group"
                                >
                                    {loading ? <Spinner size="sm" className="text-white"/> : <><CheckCircleIcon className="w-6 h-6 group-hover:rotate-12 transition-transform duration-500"/> Deploy Protocol</>}
                                </button>
                            </footer>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TaskManagementTab;