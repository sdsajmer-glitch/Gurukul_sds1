
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, formatError } from '../../services/supabase';
import { AdmissionApplication, UserProfile } from '../../types';
import Spinner from '../common/Spinner';
import ChildProfileCard from './ChildProfileCard';
import ChildRegistrationModal from './ChildRegistrationModal';
import { PlusIcon } from '../icons/PlusIcon';
import { SearchIcon } from '../icons/SearchIcon';
import clsx from 'clsx';

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
            <div className="flex flex-col items-center justify-center py-40">
                <Spinner size="lg" className="text-primary" />
                <p className="text-[11px] font-black uppercase text-white/20 mt-8 tracking-[0.4em] animate-pulse">Syncing Family Ledger</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 font-sans">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 mb-20">
                <div className="max-w-2xl">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60"></div>
                        <span className="text-[10px] font-black uppercase text-white/40 tracking-[0.4em]">Institutional Roster</span>
                    </div>
                    <h2 className="text-6xl md:text-8xl font-serif font-black text-white tracking-tighter uppercase leading-[0.8] mb-8">
                        Family <span className="opacity-100 font-serif">Nodes.</span>
                    </h2>
                    <p className="text-white/40 text-[14px] leading-relaxed max-w-lg mt-10">
                        Centralized oversight for enrollment identities, academic records, and secure institutional access within a verified environment.
                    </p>
                </div>

                <div className="flex items-center gap-4 w-full lg:w-auto shrink-0">
                    <button
                        onClick={() => { setEditingChild(null); setIsModalOpen(true); }}
                        className="relative group overflow-hidden flex-grow lg:flex-grow-0 h-16 md:h-18 px-14 bg-[#7c3aed] text-white font-black text-[12px] uppercase tracking-[0.4em] rounded-2xl shadow-[0_15px_45px_rgba(124,58,237,0.3)] hover:bg-[#6d28d9] transition-all transform active:scale-[0.95] flex items-center justify-center gap-4"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                        <PlusIcon className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
                        <span>Provision Node</span>
                    </button>
                </div>
            </div>

            {/* Filter Hub */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-8 bg-black/40 p-4 rounded-[3rem] border border-white/5 mb-16 shadow-inner relative overflow-hidden group/filters">
                <div className="flex bg-black/60 p-1.5 rounded-[2rem] border border-white/10 w-full md:w-auto overflow-x-auto no-scrollbar shadow-inner">
                    {(['ALL', 'APPROVED', 'PENDING', 'REJECTED'] as FilterType[]).map(f => (
                        <button
                            key={f}
                            onClick={() => setActiveFilter(f)}
                            className={clsx(
                                "relative px-8 py-3.5 rounded-[1.5rem] text-[10px] font-black tracking-[0.3em] uppercase transition-all duration-500",
                                activeFilter === f
                                    ? "text-white z-10"
                                    : "text-white/20 hover:text-white/40"
                            )}
                        >
                            {activeFilter === f && (
                                <div className="absolute inset-0 bg-white/10 rounded-[1.5rem] ring-1 ring-white/20 shadow-[0_0_20px_rgba(255,255,255,0.05)] -z-10 animate-in zoom-in-90 duration-500"></div>
                            )}
                            {f}
                        </button>
                    ))}
                </div>

                <div className="relative flex-grow w-full md:max-w-md group pr-4 transition-all duration-500">
                    <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-white transition-colors duration-300" />
                    <input
                        type="text"
                        placeholder="Search identities by name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-16 w-full pl-16 pr-8 bg-black/40 border border-white/5 focus:border-white/20 rounded-2xl text-[13px] font-medium text-white outline-none transition-all placeholder:text-white/10 focus:bg-black/60 focus:ring-0 shadow-inner"
                    />
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mb-8 p-6 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center gap-4 animate-in shake">
                    <AlertTriangleIcon className="w-6 h-6 shrink-0" />
                    <p className="text-sm font-bold uppercase tracking-wide">{error}</p>
                </div>
            )}

            {/* Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredApplications.map((app, idx) => (
                    <div key={app.id} className="animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: `${idx * 60}ms` }}>
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
                    </div>
                ))}

                {/* Empty State / Add Child Trigger */}
                <button
                    onClick={() => { setEditingChild(null); setIsModalOpen(true); }}
                    className="flex flex-col items-center justify-center p-12 rounded-[2.5rem] border-2 border-dashed border-white/5 hover:border-primary/40 hover:bg-primary/[0.02] transition-all duration-1000 group relative overflow-hidden h-full min-h-[400px] bg-white/[0.01]"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>

                    <div className="w-20 h-20 rounded-3xl bg-white/[0.02] flex items-center justify-center mb-10 transition-all duration-700 group-hover:bg-primary/10 group-hover:scale-110 group-hover:rotate-[10deg] border border-white/5 shadow-2xl relative z-10">
                        <PlusIcon className="w-8 h-8 text-white/5 group-hover:text-primary transition-all duration-500" />
                    </div>

                    <div className="text-center relative z-10">
                        <span className="font-serif font-black text-lg text-white/20 group-hover:text-white/90 transition-all uppercase tracking-[0.2em] block mb-4">Enroll <span className="text-primary/40 group-hover:text-primary">Sibling.</span></span>
                        <p className="text-[12px] text-white/10 font-medium max-w-[220px] mx-auto leading-relaxed group-hover:text-white/40 transition-all italic">Create a new family node to link an additional identity to your institutional roster.</p>
                    </div>

                    {/* Corner accent */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-[40px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-all"></div>
                </button>
            </div>

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
