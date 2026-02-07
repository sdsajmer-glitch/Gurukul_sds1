import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, formatError } from '../services/supabase';
import { StudentForAdmin } from '../types';
import Spinner from './common/Spinner';
import { PlusIcon } from './icons/PlusIcon';
import { StudentsIcon } from './icons/StudentsIcon';
import { SearchIcon } from './icons/SearchIcon';
import { FilterIcon } from './icons/FilterIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { ClockIcon } from './icons/ClockIcon';
import { MoreVerticalIcon } from './icons/MoreVerticalIcon';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { GraduationCapIcon } from './icons/GraduationCapIcon';
import { TrashIcon } from './icons/TrashIcon';
import { XIcon } from './icons/XIcon';
import { UploadIcon } from './icons/UploadIcon';
import { RefreshIcon } from './icons/RefreshIcon';
import { UserPlusIcon } from './icons/UserPlusIcon';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import StudentProfileModal, { AssignClassModal } from './students/StudentProfileModal';
import BulkStudentActionsModal, { BulkStudentActionType } from './students/BulkStudentActionsModal';
import PremiumAvatar from './common/PremiumAvatar';

interface StudentManagementTabProps {
    branchId?: number | null;
}

const KPICard: React.FC<{
    title: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    onClick?: () => void;
    active?: boolean;
    description?: string;
    loading?: boolean;
    trend?: { value: number; label: string };
}> = ({ title, value, icon, color, onClick, active, description, loading, trend }) => {
    const colorBase = color.split('-')[1] || 'primary';

    return (
        <div
            onClick={onClick}
            className={`relative overflow-hidden p-8 rounded-[2.5rem] border transition-all duration-700 cursor-pointer group ${active ? 'bg-card border-primary/40 ring-1 ring-primary/20 shadow-2xl scale-[1.02] z-10' : 'bg-card/40 border-border/40 hover:border-border hover:bg-card/60 shadow-sm'}`}
        >
            <div className={`absolute -right-12 -top-12 w-48 h-48 bg-${colorBase}-500 opacity-0 group-hover:opacity-[0.08] transition-opacity duration-1000 rounded-full blur-[80px]`}></div>
            <div className={`absolute -left-12 -bottom-12 w-48 h-48 bg-primary/20 opacity-0 ${active ? 'opacity-[0.05]' : ''} transition-opacity duration-1000 rounded-full blur-[80px]`}></div>

            <div className="flex justify-between items-start mb-8 relative z-10">
                <div className={`p-4 rounded-2xl text-white shadow-2xl transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 ${color} ring-1 ring-white/20`}>
                    {icon}
                </div>
                {active && (
                    <div className="flex flex-col items-end gap-1.5 animate-in zoom-in duration-500">
                        <div className="w-2 h-2 bg-primary rounded-full shadow-[0_0_12px_rgba(var(--primary-rgb),0.8)] animate-pulse" />
                        <span className="text-[7px] font-black text-primary/60 uppercase tracking-[0.3em]">Viewing</span>
                    </div>
                )}
            </div>

            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.4em]">{title}</p>
                </div>
                <div className="flex items-baseline gap-2 min-h-[48px]">
                    {loading ? (
                        <div className="h-10 w-24 bg-white/5 rounded-xl animate-pulse" />
                    ) : (
                        <h3 className="text-5xl font-serif font-black text-foreground tracking-tighter animate-in slide-in-from-bottom-2 duration-700">{value.toLocaleString()}</h3>
                    )}
                    {trend && !loading && (
                        <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-lg ml-1 border border-emerald-500/10">+{trend.value}%</span>
                    )}
                </div>
                <div className="flex items-center justify-between mt-5 pt-5 border-t border-border/40">
                    <p className="text-[9px] text-muted-foreground/30 font-bold uppercase tracking-[0.2em]">{description || 'Registry Analytics'}</p>
                    <div className={`w-10 h-1 rounded-full bg-muted overflow-hidden`}>
                        <div className={`h-full bg-${colorBase}-500/30 w-1/4 group-hover:w-full transition-all duration-1000 ease-out`} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AddStudentModal: React.FC<{ onClose: () => void; onSave: () => void; branchId?: number | null }> = ({ onClose, onSave, branchId }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        display_name: '',
        email: '',
        grade: '',
        parent_guardian_details: ''
    });

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const { data, error: rpcError } = await supabase.rpc('admin_quick_add_student', {
                p_display_name: formData.display_name,
                p_email: formData.email,
                p_grade: formData.grade,
                p_parent_details: formData.parent_guardian_details,
                p_branch_id: branchId
            });

            if (rpcError) throw rpcError;
            if (data && data.success === false) throw new Error(data.message || "Registration failed");

            onSave();
            onClose();
        } catch (err: any) {
            setError(formatError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xl z-[200] flex items-center justify-center p-4 animate-in fade-in duration-500">
            <div className="bg-card w-full max-w-xl rounded-[3rem] shadow-2xl border border-border p-12 animate-in zoom-in-95 duration-500 relative overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-[100px]" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-accent-info/5 rounded-full blur-[100px]" />

                <div className="flex justify-between items-start mb-10 relative z-10">
                    <div>
                        <h3 className="text-3xl font-serif font-black text-foreground uppercase tracking-tight">Register Node</h3>
                        <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.4em] mt-2">Provisioning Identity Protocol</p>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-2xl bg-muted/40 hover:bg-muted/60 border border-border text-muted-foreground hover:text-foreground transition-all"><XIcon className="w-5 h-5" /></button>
                </div>

                <form onSubmit={handleSave} className="space-y-8 relative z-10">
                    {error && (
                        <div className="p-5 bg-accent-error/10 border border-accent-error/20 rounded-2xl flex items-start gap-4 text-accent-error animate-in slide-in-from-top-2">
                            <AlertTriangleIcon className="w-6 h-6 shrink-0" />
                            <p className="text-xs font-bold leading-relaxed">{error}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2.5">
                            <label className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest ml-1">Full Identity Name</label>
                            <input required value={formData.display_name} onChange={e => setFormData({ ...formData, display_name: e.target.value })} className="w-full p-5 bg-muted/30 border border-border rounded-2xl text-sm font-bold text-foreground focus:border-primary/50 focus:bg-muted/50 outline-none transition-all placeholder:text-muted-foreground/20" placeholder="e.g. Alex Henderson" />
                        </div>
                        <div className="space-y-2.5">
                            <label className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest ml-1">Institutional Email</label>
                            <input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full p-5 bg-muted/30 border border-border rounded-2xl text-sm font-bold text-foreground focus:border-primary/50 focus:bg-muted/50 outline-none transition-all font-mono placeholder:text-muted-foreground/20" placeholder="student@school.edu" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2.5">
                            <label className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest ml-1">Academic Grade</label>
                            <input required value={formData.grade} onChange={e => setFormData({ ...formData, grade: e.target.value })} className="w-full p-5 bg-muted/30 border border-border rounded-2xl text-sm font-bold text-foreground focus:border-primary/50 focus:bg-muted/50 outline-none transition-all placeholder:text-muted-foreground/20" placeholder="e.g. Grade 10" />
                        </div>
                        <div className="space-y-2.5">
                            <label className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest ml-1">Guardian Context</label>
                            <input value={formData.parent_guardian_details} onChange={e => setFormData({ ...formData, parent_guardian_details: e.target.value })} className="w-full p-5 bg-muted/30 border border-border rounded-2xl text-sm font-bold text-foreground focus:border-primary/50 focus:bg-muted/50 outline-none transition-all placeholder:text-muted-foreground/20" placeholder="Parent/Guardian Name" />
                        </div>
                    </div>

                    <div className="pt-8 border-t border-border flex items-center justify-between">
                        <p className="text-[9px] text-muted-foreground/40 font-medium italic max-w-[200px]">Node will be provisioned with full identity and RLS clearance.</p>
                        <div className="flex gap-4">
                            <button type="button" onClick={onClose} className="px-8 py-4 rounded-2xl text-[10px] font-black text-muted-foreground hover:text-foreground uppercase tracking-widest transition-all">Abort</button>
                            <button type="submit" disabled={loading} className="px-10 py-4 bg-primary text-primary-foreground font-black text-[10px] rounded-2xl shadow-2xl shadow-primary/30 hover:bg-primary/90 flex items-center gap-3 transition-all active:scale-95 uppercase tracking-[0.2em] disabled:opacity-50">
                                {loading ? <Spinner size="sm" className="text-primary-foreground" /> : "Authorize Node"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

const StudentManagementTab: React.FC<StudentManagementTabProps> = ({ branchId }) => {
    const [allStudents, setAllStudents] = useState<StudentForAdmin[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [quickFilter, setQuickFilter] = useState<'All' | 'Active' | 'Pending' | 'New'>('All');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
    const [gradeFilter, setGradeFilter] = useState<string>('All');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'created_at', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedStudent, setSelectedStudent] = useState<StudentForAdmin | null>(null);
    const [assigningStudent, setAssigningStudent] = useState<StudentForAdmin | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [bulkAction, setBulkAction] = useState<BulkStudentActionType | null>(null);

    const itemsPerPage = 12;

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase.from('student_profiles').select(`
                *, 
                profiles(email, display_name, phone, role, is_active, profile_completed, created_at, profile_photo_url), 
                school_classes(name), 
                admissions(applicant_name, gender, date_of_birth, profile_photo_url, parent_phone)
            `);
            if (branchId !== null && branchId !== undefined) {
                query = query.eq('branch_id', Number(branchId));
            }

            const { data, error: dbError } = await query;
            if (dbError) throw dbError;

            const mappedStudents: StudentForAdmin[] = (data || []).map((s: any) => ({
                id: s.user_id,
                email: s.profiles?.email || '',
                display_name: s.profiles?.display_name || s.admissions?.applicant_name || s.applicant_name || 'Academic Identity',
                phone: s.profiles?.phone || s.phone || s.admissions?.parent_phone,
                role: s.profiles?.role || 'Student',
                is_active: s.profiles?.is_active ?? s.is_active ?? true,
                profile_completed: s.profiles?.profile_completed ?? true,
                created_at: s.created_at || s.profiles?.created_at,
                profile_photo_url: s.profiles?.profile_photo_url || s.profile_photo_url || s.admissions?.profile_photo_url,
                gender: s.gender || s.admissions?.gender,
                date_of_birth: s.date_of_birth || s.admissions?.date_of_birth,
                address: s.address,
                student_id_number: s.student_id_number,
                grade: s.grade || s.admissions?.grade,
                roll_number: s.roll_number,
                parent_guardian_details: s.parent_guardian_details || s.admissions?.parent_name,
                assigned_class_id: s.assigned_class_id,
                assigned_class_name: s.school_classes?.name || null,
                admission_id: s.admission_id
            }));

            setAllStudents(mappedStudents);
        } catch (e: any) {
            setError(formatError(e));
        } finally {
            setLoading(false);
        }
    }, [branchId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const uniqueGrades = useMemo(() => {
        const grades = new Set(allStudents.map(s => s.grade).filter(Boolean));
        return Array.from(grades).sort((a, b) => (parseInt(String(a)) || 0) - (parseInt(String(b)) || 0));
    }, [allStudents]);

    const filteredStudents = useMemo(() => {
        return allStudents.filter(s => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm || s.display_name.toLowerCase().includes(searchLower) || (s.email || '').toLowerCase().includes(searchLower) || (s.student_id_number || '').toLowerCase().includes(searchLower);
            let matchesQuick = true;
            if (quickFilter === 'Active') matchesQuick = s.is_active;
            if (quickFilter === 'Pending') matchesQuick = !s.assigned_class_id;
            if (quickFilter === 'New') {
                const today = new Date().toDateString();
                const created = s.created_at ? new Date(s.created_at).toDateString() : '';
                matchesQuick = created === today;
            }
            const matchesStatus = statusFilter === 'All' ? true : statusFilter === 'Active' ? s.is_active : !s.is_active;
            const matchesGrade = gradeFilter === 'All' || s.grade === gradeFilter;
            return matchesSearch && matchesQuick && matchesStatus && matchesGrade;
        }).sort((a: any, b: any) => {
            const dir = sortConfig.direction === 'asc' ? 1 : -1;
            if (sortConfig.key === 'created_at') return (new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()) * dir;
            if (sortConfig.key === 'name') return a.display_name.localeCompare(b.display_name) * dir;
            return 0;
        });
    }, [allStudents, searchTerm, quickFilter, statusFilter, gradeFilter, sortConfig]);

    const handleSort = (key: string) => {
        setSortConfig(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
    };

    const stats = useMemo(() => ({
        total: allStudents.length,
        active: allStudents.filter(s => s.is_active).length,
        pending: allStudents.filter(s => !s.assigned_class_id).length,
        new: allStudents.filter(s => s.created_at && new Date(s.created_at).toDateString() === new Date().toDateString()).length
    }), [allStudents]);

    const paginatedData = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);

    return (
        <div className="space-y-12 pb-32 max-w-[1700px] mx-auto animate-in fade-in duration-1000">
            {/* Page Header */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-12">
                <div className="space-y-2">
                    <div className="flex items-center gap-4 opacity-40">
                        <div className="w-8 h-[1px] bg-primary"></div>
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-foreground">Governance Hub</span>
                    </div>
                    <h1 className="text-6xl md:text-8xl font-serif font-black text-foreground tracking-tighter uppercase leading-none">
                        Student <span className="text-muted-foreground/20 italic">Directory.</span>
                    </h1>
                </div>

                <div className="flex items-center gap-5 w-full xl:w-auto">
                    <button
                        onClick={() => setBulkAction('import')}
                        className="flex-grow xl:flex-none h-16 px-10 bg-muted/40 hover:bg-muted/60 text-foreground font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl border border-border hover:border-white/20 transition-all flex items-center justify-center gap-4 group shadow-xl"
                    >
                        <UploadIcon className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        <span>Import</span>
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex-grow xl:flex-none h-16 px-12 bg-primary text-white font-black text-[11px] uppercase tracking-[0.4em] rounded-2xl shadow-[0_15px_45px_rgba(var(--primary-rgb),0.3)] hover:bg-primary/90 transition-all flex items-center justify-center gap-4 active:scale-95 group relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                        <UserPlusIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span>Register Node</span>
                    </button>
                </div>
            </div>

            {/* KPI Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                <KPICard
                    title="Total Hosted"
                    value={stats.total}
                    icon={<StudentsIcon className="w-10 h-10" />}
                    color="bg-accent-info"
                    active={quickFilter === 'All'}
                    onClick={() => setQuickFilter('All')}
                    description="Institutional registry total"
                />
                <KPICard
                    title="Active Stream"
                    value={stats.active}
                    icon={<CheckCircleIcon className="w-10 h-10" />}
                    color="bg-accent-success"
                    active={quickFilter === 'Active'}
                    onClick={() => setQuickFilter('Active')}
                    description="Real-time routing traffic"
                    trend={{ value: 4.2, label: 'growth' }}
                />
                <KPICard
                    title="Placement Pending"
                    value={stats.pending}
                    icon={<ClockIcon className="w-10 h-10" />}
                    color="bg-accent-warning"
                    active={quickFilter === 'Pending'}
                    onClick={() => setQuickFilter('Pending')}
                    description="Awaiting stream allocation"
                />
                <KPICard
                    title="Newly Registered"
                    value={stats.new}
                    icon={<GraduationCapIcon className="w-10 h-10" />}
                    color="bg-primary"
                    active={quickFilter === 'New'}
                    onClick={() => setQuickFilter('New')}
                    description="Authenticated last 24h"
                />
            </div>

            {/* Main Content Area */}
            <div className="bg-card/40 backdrop-blur-3xl border border-border rounded-[3.5rem] shadow-3xl overflow-hidden flex flex-col min-h-[700px] relative">
                {/* Search & Filter Ribbon */}
                <div className="p-10 border-b border-border flex flex-col xl:flex-row gap-8 justify-between items-center bg-card/40 backdrop-blur-2xl">
                    <div className="relative flex-grow w-full group">
                        <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors duration-500" />
                        <input
                            type="text"
                            placeholder="Search identities by name, node ID, or uplink..."
                            value={searchTerm}
                            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="w-full h-16 pl-16 pr-8 rounded-2xl border border-border bg-card/40 text-base font-medium text-foreground placeholder:text-muted-foreground/20 focus:bg-card/60 focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-500 shadow-inner"
                        />
                    </div>

                    <div className="flex items-center gap-4 w-full xl:w-auto">
                        <div className="flex bg-card/40 p-1.5 rounded-2xl border border-border shadow-inner">
                            <select
                                value={statusFilter}
                                onChange={e => { setStatusFilter(e.target.value as any); setCurrentPage(1); }}
                                className="h-12 px-6 bg-transparent text-[11px] font-black uppercase tracking-widest text-foreground outline-none cursor-pointer hover:bg-muted/40 rounded-xl transition-all"
                            >
                                <option value="All">All Stats</option>
                                <option value="Active">Active Only</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                            <div className="w-[1px] bg-border my-2"></div>
                            <select
                                value={gradeFilter}
                                onChange={e => { setGradeFilter(e.target.value); setCurrentPage(1); }}
                                className="h-12 px-6 bg-transparent text-[11px] font-black uppercase tracking-widest text-foreground outline-none cursor-pointer hover:bg-muted/40 rounded-xl transition-all"
                            >
                                <option value="All">All Grad</option>
                                {uniqueGrades.map(g => <option key={String(g)} value={String(g)}>Grad {String(g)}</option>)}
                            </select>
                        </div>

                        <button
                            onClick={() => fetchData()}
                            disabled={loading}
                            className="h-14 w-14 flex items-center justify-center rounded-2xl bg-muted/40 text-muted-foreground/40 hover:text-primary border border-border hover:border-primary/20 transition-all shadow-xl disabled:opacity-50"
                        >
                            <RefreshIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Table Section */}
                <div className="overflow-x-auto flex-grow custom-scrollbar">
                    {loading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/20 backdrop-blur-sm z-30 space-y-8">
                            <Spinner size="lg" className="text-primary scale-150" />
                            <div className="text-center space-y-2">
                                <p className="text-[11px] font-black uppercase tracking-[0.8em] text-foreground animate-pulse">Syncing Unified Matrix</p>
                                <p className="text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground/40">Identity Handshake in progress</p>
                            </div>
                        </div>
                    ) : paginatedData.length === 0 ? (
                        <div className="h-full min-h-[500px] flex flex-col items-center justify-center p-24 animate-in fade-in zoom-in-95 duration-1000">
                            <div className="relative mb-12">
                                <div className="absolute inset-0 bg-primary/20 blur-[80px] rounded-full scale-150 animate-pulse" />
                                <div className="w-32 h-32 bg-muted/20 border border-border rounded-[2.5rem] flex items-center justify-center shadow-3xl relative z-10 overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent"></div>
                                    <StudentsIcon className="w-16 h-16 text-muted-foreground/10 group-hover:scale-110 transition-transform duration-700" />
                                </div>
                            </div>
                            <h3 className="text-4xl font-serif font-black text-foreground uppercase tracking-tighter mb-4 text-center">Registry Dark.</h3>
                            <p className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-[0.6em] mb-12 text-center">No active student nodes detected in local cluster</p>
                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="px-12 py-5 bg-primary text-white font-black text-[11px] uppercase tracking-[0.4em] rounded-2xl shadow-2xl hover:bg-primary/90 transition-all flex items-center gap-4 group"
                            >
                                <PlusIcon className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
                                Provision First Node
                            </button>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-muted/80 border-b border-border text-[11px] font-black uppercase text-muted-foreground/40 tracking-[0.4em] sticky top-0 z-20 backdrop-blur-3xl">
                                <tr>
                                    <th className="p-8 pl-12 cursor-pointer group hover:text-foreground transition-colors" onClick={() => handleSort('name')}>
                                        <div className="flex items-center gap-3">
                                            <span>Identity Node</span>
                                            <div className={`w-1.5 h-1.5 bg-primary rounded-full transition-all duration-500 ${sortConfig.key === 'name' ? 'opacity-100 scale-100' : 'opacity-0 scale-0 group-hover:opacity-40 group-hover:scale-75'}`} />
                                        </div>
                                    </th>
                                    <th className="p-8">Guardian Context</th>
                                    <th className="p-8">Placement Status</th>
                                    <th className="p-8 text-center">Protocol Status</th>
                                    <th className="p-8 text-right pr-12">Operations</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {paginatedData.map((student, idx) => (
                                    <React.Fragment key={student.id}>
                                        <tr
                                            className="hover:bg-primary/[0.03] cursor-pointer group transition-all duration-700 animate-in slide-in-from-bottom-8 duration-700 relative"
                                            style={{ animationDelay: `${idx * 40}ms` }}
                                            onClick={() => setSelectedStudent(student)}
                                        >
                                            <td className="p-8 pl-12">
                                                <div className="flex items-center gap-8">
                                                    <div className="relative">
                                                        <div className="w-16 h-16 rounded-[1.5rem] p-0.5 bg-gradient-to-br from-border via-border/40 to-transparent group-hover:from-primary/40 transition-all duration-700">
                                                            <PremiumAvatar
                                                                src={student.profile_photo_url}
                                                                name={student.display_name}
                                                                size="xs"
                                                                className="w-full h-full rounded-[1.4rem] border-none shadow-2xl relative z-10 grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700"
                                                            />
                                                        </div>
                                                        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-50 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-3 mb-1.5">
                                                            <p className="font-serif font-black text-foreground text-xl tracking-tight uppercase group-hover:text-primary transition-colors duration-500 leading-none">{student.display_name}</p>
                                                            {student.created_at && (new Date(student.created_at).getTime() > Date.now() - 86400000) && (
                                                                <span className="px-2 py-1 rounded-[0.5rem] bg-accent-success/10 border border-accent-success/20 text-accent-success text-[7px] font-black uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(var(--accent-success-rgb),0.2)]">PROVISIONED_24H</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <p className="text-[10px] text-muted-foreground/60 font-mono tracking-widest uppercase bg-muted/40 px-2 py-1 rounded-lg border border-border/40">{student.student_id_number || 'NODE_UNASSIGNED'}</p>
                                                            {student.grade && (
                                                                <span className="text-[10px] text-muted-foreground/30 font-black uppercase tracking-[0.3em] flex items-center gap-2">
                                                                    <div className="w-1 h-1 rounded-full bg-border" />
                                                                    Grade {student.grade}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-8">
                                                {student.parent_guardian_details ? (
                                                    <div className="flex flex-col gap-1">
                                                        <p className="text-sm font-bold text-foreground/80 tracking-tight">{student.parent_guardian_details}</p>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-[1px] bg-accent-success"></div>
                                                            <span className="text-[9px] text-accent-success/50 font-black uppercase tracking-[0.25em]">Verified Uplink</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="group/link flex items-center gap-3 text-muted-foreground/20 hover:text-muted-foreground/60 transition-all duration-500">
                                                        <div className="w-8 h-8 rounded-xl bg-muted/40 flex items-center justify-center border border-border">
                                                            <AlertTriangleIcon className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Unlinked</span>
                                                            <span className="text-[8px] font-bold italic opacity-0 group-hover/link:opacity-100 transition-opacity">Request Identity</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-8">
                                                {student.assigned_class_id ? (
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-center gap-3">
                                                            <span className="h-2.5 w-2.5 rounded-full bg-accent-info shadow-[0_0_10px_rgba(var(--accent-info-rgb),0.4)]"></span>
                                                            <span className="text-sm font-bold text-foreground uppercase tracking-wider">{student.assigned_class_name}</span>
                                                        </div>
                                                        <span className="text-[8px] text-muted-foreground/30 font-black uppercase tracking-[0.4em] ml-5.5">Execution Active</span>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setAssigningStudent(student); }}
                                                        className="px-6 py-3 bg-accent-warning/5 border border-accent-warning/20 text-accent-warning text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-accent-warning hover:text-black transition-all duration-500 flex items-center gap-3 group/btn shadow-xl shadow-accent-warning/5"
                                                    >
                                                        <SparklesIcon className="w-3.5 h-3.5 group-hover/btn:rotate-45 transition-transform" />
                                                        Assign Class
                                                    </button>
                                                )}
                                            </td>
                                            <td className="p-8 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <span className={`inline-flex items-center gap-3 px-6 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-[0.4em] border backdrop-blur-md transition-all duration-700 ${student.is_active ? 'bg-accent-success/5 text-accent-success border-accent-success/20' : 'bg-destructive/5 text-destructive border-destructive/20'}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${student.is_active ? 'bg-accent-success shadow-[0_0_12px_rgba(var(--accent-success-rgb),1)] scale-110 animate-pulse' : 'bg-destructive'}`} />
                                                        {student.is_active ? 'Active' : 'Suspended'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-8 text-right pr-12">
                                                <button className="h-12 w-12 flex items-center justify-center rounded-2xl bg-muted/40 text-muted-foreground/20 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 translate-x-4 hover:text-foreground hover:bg-muted/80 transition-all duration-700 shadow-2xl">
                                                    <MoreVerticalIcon className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                        {idx < paginatedData.length - 1 && (
                                            <tr className="h-[1px] bg-gradient-to-r from-transparent via-border/40 to-transparent pointer-events-none opacity-50">
                                                <td colSpan={5} className="p-0"></td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer / Pagination Section */}
                <div className="p-10 border-t border-border bg-card/60 backdrop-blur-3xl flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.6em] mb-1">Matrix Sequence</span>
                            <span className="text-sm font-black text-foreground uppercase tracking-[0.3em]">Identity <span className="text-primary">{currentPage}</span> / {totalPages || 1}</span>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="h-14 w-14 flex items-center justify-center rounded-2xl border border-border bg-muted/20 text-muted-foreground/40 hover:text-primary hover:border-primary/20 disabled:opacity-10 transition-all shadow-xl active:scale-90"
                        >
                            <ChevronLeftIcon className="w-6 h-6" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="h-14 w-14 flex items-center justify-center rounded-2xl border border-border bg-muted/20 text-muted-foreground/40 hover:text-primary hover:border-primary/20 disabled:opacity-10 transition-all shadow-xl active:scale-90"
                        >
                            <ChevronRightIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>

            {selectedStudent && <StudentProfileModal student={selectedStudent} onClose={() => setSelectedStudent(null)} onUpdate={fetchData} />}
            {assigningStudent && <AssignClassModal student={assigningStudent} onClose={() => setAssigningStudent(null)} onSuccess={() => { setAssigningStudent(null); fetchData(); }} />}
            {isAddModalOpen && <AddStudentModal onClose={() => setIsAddModalOpen(false)} onSave={fetchData} branchId={branchId} />}
            {bulkAction && <BulkStudentActionsModal action={bulkAction} selectedIds={[]} onClose={() => setBulkAction(null)} onSuccess={fetchData} />}
        </div>
    );
};

export default StudentManagementTab;