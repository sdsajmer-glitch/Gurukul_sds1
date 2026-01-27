
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, formatError } from '../../services/supabase';
import { AdmissionApplication, UserProfile } from '../../types';
import Spinner from '../common/Spinner';
import ChildProfileCard from './ChildProfileCard';
import ChildRegistrationModal from './ChildRegistrationModal';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon } from '../icons/PlusIcon';
import { SearchIcon } from '../icons/SearchIcon';

type FilterType = 'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED';

interface MyChildrenTabProps {
    onManageDocuments: (id: string) => void;
    profile: UserProfile;
}

const MyChildrenTab: React.FC<MyChildrenTabProps> = ({ onManageDocuments, profile }) => {
    const navigate = useNavigate();
    const [applications, setApplications] = useState<AdmissionApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingChild, setEditingChild] = useState<AdmissionApplication | null>(null);
    const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = useCallback(async () => {
        if (!profile?.id) return;
        setLoading(true);
        setError(null);
        try {
            const { data, error: rpcError } = await supabase.rpc('get_my_children_profiles');
            if (rpcError) throw rpcError;
            setApplications((data || []) as AdmissionApplication[]);
        } catch (err: any) {
            setError(formatError(err));
        } finally {
            setLoading(false);
        }
    }, [profile?.id]);

    useEffect(() => {
        fetchData();

        // Setup Realtime Subscription for instant updates
        const channel = supabase.channel('family-nodes-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'admissions' }, () => {
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'student_profiles' }, () => {
                fetchData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'student_enrollments' }, () => {
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchData]);

    const filteredApplications = useMemo(() => {
        return applications.filter(app => {
            const matchesSearch = (app.applicant_name || '').toLowerCase().includes(searchTerm.toLowerCase());
            const status = (app.status || '').toUpperCase();

            if (activeFilter === 'APPROVED') return matchesSearch && (status === 'APPROVED' || status === 'VERIFIED' || status === 'ENROLLED');
            if (activeFilter === 'REJECTED') return matchesSearch && status === 'REJECTED';
            if (activeFilter === 'PENDING') {
                return matchesSearch && (status !== 'APPROVED' && status !== 'VERIFIED' && status !== 'REJECTED' && status !== 'ENROLLED');
            }
            return matchesSearch;
        });
    }, [applications, activeFilter, searchTerm]);

    if (loading && applications.length === 0 && !error) {
        return (
            <div className="flex flex-col items-center justify-center py-48 relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[100px] animate-pulse" />
                <div className="relative">
                    <div className="absolute -inset-8 bg-primary/20 rounded-full blur-2xl animate-pulse" />
                    <Spinner size="xl" className="text-primary relative z-10" />
                </div>
                <div className="mt-12 text-center relative z-10">
                    <p className="text-[13px] font-black uppercase text-primary tracking-[0.8em] animate-pulse mb-3">Establishing Satellite Link</p>
                    <div className="h-px w-24 bg-gradient-to-r from-transparent via-primary/40 to-transparent mx-auto mb-4" />
                    <p className="text-[10px] font-medium text-white/20 italic tracking-widest leading-relaxed">Synchronizing Family Ledger with Institutional Node...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-32 font-sans relative">
            {/* Cinematic Background Artifacts */}
            <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none animate-pulse" />
            <div className="absolute top-1/2 -right-40 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-12 mb-20 relative z-10">
                <div className="max-w-3xl">
                    <div className="flex items-center gap-4 mb-6 group">
                        <div className="h-[2px] w-12 bg-primary/40 group-hover:w-20 transition-all duration-700" />
                        <span className="text-[11px] font-black uppercase text-primary tracking-[0.6em]">Institutional Roster</span>
                    </div>
                    <h2 className="text-5xl md:text-7xl font-serif font-black text-white tracking-tighter uppercase leading-[0.9] mb-8">
                        Family <span className="text-white/10 font-normal italic drop-shadow-[0_0_15px_rgba(255,255,255,0.05)]">Nodes.</span>
                    </h2>
                    <div className="relative pl-10">
                        <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-primary/40 via-white/5 to-transparent" />
                        <p className="text-white/40 text-lg leading-relaxed font-serif italic max-w-xl">
                            Centralized oversight for enrollment identities, academic records, and secure institutional access protocol.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-6 w-full lg:w-auto relative group/btn">
                    <div className="absolute -inset-4 bg-primary/10 rounded-[2.5rem] blur-2xl opacity-0 group-hover/btn:opacity-100 transition-opacity duration-1000" />
                    <button
                        onClick={() => { setEditingChild(null); setIsModalOpen(true); }}
                        className="flex-grow lg:flex-grow-0 h-16 md:h-20 px-12 bg-primary hover:bg-primary/90 text-white font-black text-[13px] uppercase tracking-[0.3em] rounded-[1.5rem] shadow-[0_20px_40px_-10px_rgba(var(--primary),0.3)] transition-all transform active:scale-[0.98] hover:scale-[1.02] hover:-translate-y-1 flex items-center justify-center gap-4 group relative z-10 overflow-hidden border border-white/10"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
                        <PlusIcon className="w-5 h-5 group-hover:rotate-180 transition-transform duration-1000" />
                        <span className="relative">Provision Node</span>
                    </button>
                </div>
            </div>

            {/* Premium Filter Hub */}
            <div className="relative z-10 mb-16 group/hub">
                <div className="absolute -inset-1 bg-white/5 rounded-[2.5rem] blur-xl opacity-0 group-hover/hub:opacity-100 transition-opacity duration-700" />
                <div className="flex flex-col lg:flex-row justify-between items-center gap-8 bg-[#0a0b0e]/80 backdrop-blur-3xl p-4 md:p-5 rounded-[2.5rem] border border-white/5 shadow-2xl relative">
                    <div className="flex bg-white/[0.02] p-2 rounded-2xl border border-white/5 w-full lg:w-auto overflow-x-auto no-scrollbar shadow-inner">
                        {(['ALL', 'APPROVED', 'PENDING', 'REJECTED'] as FilterType[]).map(f => (
                            <button
                                key={f}
                                onClick={() => setActiveFilter(f)}
                                className={`flex-1 lg:flex-none px-8 py-3 rounded-xl text-[11px] font-black tracking-[0.2em] uppercase transition-all duration-500 relative ${activeFilter === f ? 'text-primary' : 'text-white/20 hover:text-white/50'}`}
                            >
                                {activeFilter === f && (
                                    <motion.div
                                        layoutId="activeFilter"
                                        className="absolute inset-0 bg-primary/10 rounded-xl border border-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.1)]"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                <span className="relative z-10">{f}</span>
                            </button>
                        ))}
                    </div>

                    <div className="relative flex-grow w-full lg:max-w-lg group/search">
                        <div className="absolute inset-0 bg-primary/5 rounded-2xl blur-lg opacity-0 group-focus-within/search:opacity-100 transition-opacity duration-500" />
                        <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/10 group-focus-within/search:text-primary transition-colors duration-500" />
                        <input
                            type="text"
                            placeholder="Identify specific node..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-14 md:h-16 w-full pl-16 pr-8 bg-white/[0.02] border border-white/5 rounded-2xl text-[13px] font-black tracking-widest text-white focus:bg-white/[0.04] outline-none transition-all placeholder:text-white/5 focus:ring-1 focus:ring-primary/40 uppercase shadow-inner"
                        />
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mb-8 p-6 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center gap-4 animate-in shake">
                    <AlertTriangleIcon className="w-6 h-6 shrink-0" />
                    <p className="text-sm font-bold uppercase tracking-wide">{error}</p>
                </div>
            )}

            {/* Card Grid with Staggered Motion */}
            <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                    hidden: { opacity: 0 },
                    visible: {
                        opacity: 1,
                        transition: {
                            staggerChildren: 0.1
                        }
                    }
                }}
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10"
            >
                {filteredApplications.map((app, idx) => (
                    <motion.div
                        key={app.id}
                        variants={{
                            hidden: { opacity: 0, y: 30, scale: 0.95 },
                            visible: { opacity: 1, y: 0, scale: 1 }
                        }}
                        transition={{
                            duration: 0.8,
                            ease: [0.16, 1, 0.3, 1]
                        }}
                    >
                        <ChildProfileCard
                            child={app}
                            isExpanded={false}
                            onToggleExpand={() => { }}
                            onEdit={() => { setEditingChild(app); setIsModalOpen(true); }}
                            onManageDocuments={() => onManageDocuments(app.id)}
                            onNavigateDashboard={async () => {
                                const { error } = await supabase.rpc('parent_switch_student_view', { p_new_admission_id: app.id });
                                if (!error) navigate('/student');
                            }}
                            index={idx + 1}
                        />
                    </motion.div>
                ))}

                {/* Empty State Card: Ultra-Premium Focal Point */}
                <motion.button
                    variants={{
                        hidden: { opacity: 0, scale: 0.9 },
                        visible: { opacity: 1, scale: 1 }
                    }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: filteredApplications.length * 0.1 }}
                    onClick={() => { setEditingChild(null); setIsModalOpen(true); }}
                    className="flex flex-col items-center justify-center p-14 rounded-[3.5rem] border border-dashed border-white/10 bg-[#0d0e12]/60 backdrop-blur-3xl hover:border-primary/40 hover:bg-primary/[0.04] transition-all duration-1000 group relative overflow-hidden h-full min-h-[440px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]"
                >
                    <div className="absolute inset-0 bg-primary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

                    <div className="relative mb-12">
                        <div className="absolute inset-0 bg-primary/30 rounded-[3rem] blur-[50px] opacity-0 group-hover:opacity-100 transition-all duration-1000 group-hover:scale-150" />
                        <div className="relative w-28 h-28 rounded-[2.5rem] bg-white/[0.03] flex items-center justify-center border border-white/10 shadow-2xl transition-all duration-1000 group-hover:bg-primary/20 group-hover:scale-110 group-hover:rotate-[15deg] group-hover:border-primary/40">
                            <PlusIcon className="w-10 h-10 text-white/20 group-hover:text-primary transition-all duration-700" />
                        </div>
                    </div>

                    <div className="text-center relative z-10">
                        <h4 className="font-serif font-black text-3xl text-white/50 group-hover:text-white transition-all duration-700 uppercase tracking-tighter mb-4">
                            Enroll <span className="italic font-normal opacity-40 group-hover:opacity-100 text-primary">Sibling.</span>
                        </h4>
                        <div className="h-[2px] w-16 bg-white/10 mx-auto mb-8 group-hover:w-32 group-hover:bg-primary/50 transition-all duration-1000" />
                        <p className="text-sm text-white/30 font-serif italic max-w-[280px] leading-relaxed group-hover:text-white/60 transition-all duration-700">
                            Create a new institutional node to authorize an additional family identity within the secure ledger.
                        </p>
                    </div>

                    {/* Decorative Corner Accents */}
                    <div className="absolute top-10 left-10 w-6 h-6 border-t border-l border-white/10 rounded-tl-xl group-hover:border-primary/40 transition-all duration-700" />
                    <div className="absolute top-10 right-10 w-6 h-6 border-t border-r border-white/10 rounded-tr-xl group-hover:border-primary/40 transition-all duration-700" />
                    <div className="absolute bottom-10 left-10 w-6 h-6 border-b border-l border-white/10 rounded-bl-xl group-hover:border-primary/40 transition-all duration-700" />
                    <div className="absolute bottom-10 right-10 w-6 h-6 border-b border-r border-white/10 rounded-br-xl group-hover:border-primary/40 transition-all duration-700" />
                </motion.button>
            </motion.div>

            {isModalOpen && (
                <ChildRegistrationModal
                    child={editingChild}
                    onClose={() => { setIsModalOpen(false); setEditingChild(null); }}
                    onSave={fetchData}
                    currentUserId={profile.id}
                />
            )}
        </div>
    );
};

const AlertTriangleIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
);

export default MyChildrenTab;
