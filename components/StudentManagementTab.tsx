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
            className={`relative overflow-hidden p-8 rounded-[2.5rem] border transition-all duration-700 cursor-pointer group ${active ? 'bg-[#0f1115] border-primary/40 ring-1 ring-primary/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] scale-[1.02] z-10' : 'bg-[#0a0a0c]/40 border-white/5 hover:border-white/20 hover:bg-[#0a0a0c]/60 shadow-sm'}`}
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
                <div className="flex items-center justify-between mt-5 pt-5 border-t border-white/[0.03]">
                    <p className="text-[9px] text-muted-foreground/30 font-bold uppercase tracking-[0.2em]">{description || 'Registry Analytics'}</p>
                    <div className={`w-10 h-1 rounded-full bg-white/5 overflow-hidden`}>
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
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[200] flex items-center justify-center p-4 animate-in fade-in duration-500">
            <div className="bg-[#0a0a0c] w-full max-w-xl rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10 p-12 animate-in zoom-in-95 duration-500 relative overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-[100px]" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/5 rounded-full blur-[100px]" />

                <div className="flex justify-between items-start mb-10 relative z-10">
                    <div>
                        <h3 className="text-3xl font-serif font-black text-white uppercase tracking-tight">Register Node</h3>
                        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em] mt-2">Provisioning Identity Protocol</p>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-white/40 hover:text-white transition-all"><XIcon className="w-5 h-5" /></button>
                </div>

                <form onSubmit={handleSave} className="space-y-8 relative z-10">
                    {error && (
                        <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-4 text-red-500 animate-in slide-in-from-top-2">
                            <AlertTriangleIcon className="w-6 h-6 shrink-0" />
                            <p className="text-xs font-bold leading-relaxed">{error}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2.5">
                            <label className="text-[10px] font-black uppercase text-white/40 tracking-widest ml-1">Full Identity Name</label>
                            <input required value={formData.display_name} onChange={e => setFormData({ ...formData, display_name: e.target.value })} className="w-full p-5 bg-white/[0.03] border border-white/10 rounded-2xl text-sm font-bold text-white focus:border-primary/50 focus:bg-white/[0.05] outline-none transition-all" placeholder="e.g. Alex Henderson" />
                        </div>
                        <div className="space-y-2.5">
                            <label className="text-[10px] font-black uppercase text-white/40 tracking-widest ml-1">Institutional Email</label>
                            <input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full p-5 bg-white/[0.03] border border-white/10 rounded-2xl text-sm font-bold text-white focus:border-primary/50 focus:bg-white/[0.05] outline-none transition-all font-mono" placeholder="student@school.edu" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2.5">
                            <label className="text-[10px] font-black uppercase text-white/40 tracking-widest ml-1">Academic Grade</label>
                            <input required value={formData.grade} onChange={e => setFormData({ ...formData, grade: e.target.value })} className="w-full p-5 bg-white/[0.03] border border-white/10 rounded-2xl text-sm font-bold text-white focus:border-primary/50 focus:bg-white/[0.05] outline-none transition-all" placeholder="e.g. Grade 10" />
                        </div>
                        <div className="space-y-2.5">
                            <label className="text-[10px] font-black uppercase text-white/40 tracking-widest ml-1">Guardian Context</label>
                            <input value={formData.parent_guardian_details} onChange={e => setFormData({ ...formData, parent_guardian_details: e.target.value })} className="w-full p-5 bg-white/[0.03] border border-white/10 rounded-2xl text-sm font-bold text-white focus:border-primary/50 focus:bg-white/[0.05] outline-none transition-all" placeholder="Parent/Guardian Name" />
                        </div>
                    </div>

                    <div className="pt-8 border-t border-white/[0.05] flex items-center justify-between">
                        <p className="text-[9px] text-white/20 font-medium italic max-w-[200px]">Node will be provisioned with full identity and RLS clearance.</p>
                        <div className="flex gap-4">
                            <button type="button" onClick={onClose} className="px-8 py-4 rounded-2xl text-[10px] font-black text-white/40 hover:text-white uppercase tracking-widest transition-all">Abort</button>
                            <button type="submit" disabled={loading} className="px-10 py-4 bg-primary text-white font-black text-[10px] rounded-2xl shadow-2xl shadow-primary/40 hover:bg-primary/90 flex items-center gap-3 transition-all active:scale-95 uppercase tracking-[0.2em] disabled:opacity-50">
                                {loading ? <Spinner size="sm" className="text-white" /> : "Authorize Node"}
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
            let query = supabase.from('student_profiles').select(`*, profiles(email, display_name, phone, role, is_active, profile_completed, created_at, profile_photo_url), school_classes(name), admissions(applicant_name)`);
            if (branchId !== null && branchId !== undefined) {
                query = query.eq('branch_id', Number(branchId));
            }

            const { data, error: dbError } = await query;
            if (dbError) throw dbError;

            const mappedStudents: StudentForAdmin[] = (data || []).map((s: any) => ({
                id: s.user_id,
                email: s.profiles?.email || '',
                display_name: s.profiles?.display_name || s.admissions?.applicant_name || s.applicant_name || 'Academic Identity',
                phone: s.profiles?.phone,
                role: s.profiles?.role || 'Student',
                is_active: s.profiles?.is_active ?? s.is_active ?? true,
                profile_completed: s.profiles?.profile_completed ?? true,
                created_at: s.created_at || s.profiles?.created_at,
                profile_photo_url: s.profiles?.profile_photo_url,
                gender: s.gender,
                date_of_birth: s.date_of_birth,
                address: s.address,
                student_id_number: s.student_id_number,
                grade: s.grade,
                roll_number: s.roll_number,
                parent_guardian_details: s.parent_guardian_details,
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
        <div className="space-y-10 pb-24 max-w-[1600px] mx-auto animate-in fade-in duration-700">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-10">
                <h1 className="text-4xl md:text-6xl font-serif font-black text-foreground tracking-tighter uppercase leading-none">
                    Student <span className="text-white/20 italic">Directory.</span>
                </h1>
                <div className="flex items-center gap-4 w-full xl:w-auto">
                    <button onClick={() => setBulkAction('import')} className="flex-grow xl:flex-none px-10 py-5 bg-[#0a0a0c]/40 hover:bg-white/[0.08] text-foreground font-black text-[11px] uppercase tracking-[0.25em] rounded-2xl border border-white/5 hover:border-white/10 transition-all flex items-center justify-center gap-3 group">
                        <UploadIcon className="w-4 h-4 text-white/20 group-hover:text-white transition-colors" />
                        <span>Import</span>
                    </button>
                    <button onClick={() => setIsAddModalOpen(true)} className="flex-grow xl:flex-none px-12 py-5 bg-primary text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl shadow-[0_10px_40px_rgba(var(--primary-rgb),0.3)] hover:bg-primary/90 transition-all flex items-center justify-center gap-3 active:scale-95 group">
                        <UserPlusIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span>Register Node</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                    title="Total Hosted"
                    value={stats.total}
                    icon={<StudentsIcon className="w-8 h-8" />}
                    color="bg-indigo-600"
                    active={quickFilter === 'All'}
                    onClick={() => setQuickFilter('All')}
                    description="Total identity nodes active"
                />
                <KPICard
                    title="Active Stream"
                    value={stats.active}
                    icon={<CheckCircleIcon className="w-8 h-8" />}
                    color="bg-emerald-600"
                    active={quickFilter === 'Active'}
                    onClick={() => setQuickFilter('Active')}
                    description="Successfully routing traffic"
                    trend={{ value: 2, label: 'daily' }}
                />
                <KPICard
                    title="Placement Pending"
                    value={stats.pending}
                    icon={<ClockIcon className="w-8 h-8" />}
                    color="bg-amber-600"
                    active={quickFilter === 'Pending'}
                    onClick={() => setQuickFilter('Pending')}
                    description="Awaiting class allocation"
                />
                <KPICard
                    title="Newly Registered"
                    value={stats.new}
                    icon={<GraduationCapIcon className="w-8 h-8" />}
                    color="bg-purple-600"
                    active={quickFilter === 'New'}
                    onClick={() => setQuickFilter('New')}
                    description="Provisioned last 24h"
                />
            </div>

            <div className="bg-card border border-white/10 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col min-h-[650px] relative">
                <div className="p-8 border-b border-white/5 flex flex-col xl:flex-row gap-6 justify-between items-center bg-card/60 backdrop-blur-xl">
                    <div className="relative flex-grow w-full group">
                        <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/10 group-focus-within:text-primary transition-colors duration-300" />
                        <input type="text" placeholder="Search identities..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full pl-14 pr-6 py-4 rounded-2xl border border-white/5 bg-black/20 text-sm font-medium text-white focus:bg-black/40 outline-none" />
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as any); setCurrentPage(1); }} className="h-14 px-6 bg-black/20 border border-white/5 rounded-2xl text-sm font-bold text-white focus:outline-none min-w-[140px]">
                            <option value="All">All Status</option>
                            <option value="Active">Active Only</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                        <select value={gradeFilter} onChange={e => { setGradeFilter(e.target.value); setCurrentPage(1); }} className="h-14 px-6 bg-black/20 border border-white/5 rounded-2xl text-sm font-bold text-white focus:outline-none min-w-[140px]">
                            <option value="All">All Grades</option>
                            {uniqueGrades.map(g => <option key={String(g)} value={String(g)}>Grade {String(g)}</option>)}
                        </select>
                        <button onClick={() => fetchData()} className="p-4 rounded-2xl bg-white/5 text-white/20 hover:text-primary border border-white/5"><RefreshIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
                    </div>
                </div>

                <div className="overflow-x-auto flex-grow custom-scrollbar min-h-[400px]">
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-30">
                            <div className="flex flex-col items-center gap-4">
                                <Spinner size="lg" className="text-primary scale-150" />
                                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/40 animate-pulse">Syncing Registry...</span>
                            </div>
                        </div>
                    ) : paginatedData.length === 0 ? (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-20 animate-in fade-in zoom-in-95 duration-700">
                            <div className="relative mb-8">
                                <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full scale-150 animate-pulse" />
                                <div className="w-24 h-24 bg-[#12141c] border border-white/5 rounded-3xl flex items-center justify-center shadow-3xl relative z-10">
                                    <StudentsIcon className="w-12 h-12 text-white/10" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-serif font-black text-white uppercase tracking-tighter mb-2">Registry Silent.</h3>
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mb-6">No active student nodes identified</p>
                            <p className="text-xs font-medium text-white/30 max-w-xs mx-auto italic text-center leading-relaxed">
                                Use the <span className="text-white/60">Admission Vault</span> to finalize enrollment and promote applicants to the Student Directory.
                            </p>
                            <button onClick={() => fetchData()} className="mt-8 px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/40 transition-all flex items-center gap-3 active:scale-95">
                                <RefreshIcon className="w-4 h-4" /> Re-sync
                            </button>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-[#0f1115]/80 border-b border-white/5 text-[10px] font-black uppercase text-white/20 tracking-[0.3em] sticky top-0 z-20 backdrop-blur-xl">
                                <tr>
                                    <th className="p-8 pl-10 cursor-pointer group" onClick={() => handleSort('name')}>
                                        <div className="flex items-center gap-2">
                                            <span>Identity Node</span>
                                            <div className="w-1 h-1 bg-primary/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </th>
                                    <th className="p-8">Guardian Context</th>
                                    <th className="p-8">Placement Status</th>
                                    <th className="p-8 text-center">Protocol Status</th>
                                    <th className="p-8 text-right pr-10">Operations</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {paginatedData.map((student, idx) => (
                                    <tr
                                        key={student.id}
                                        className="hover:bg-white/[0.02] cursor-pointer group transition-all duration-500 animate-in slide-in-from-bottom-4 duration-500"
                                        style={{ animationDelay: `${idx * 50}ms` }}
                                        onClick={() => setSelectedStudent(student)}
                                    >
                                        <td className="p-8 pl-10">
                                            <div className="flex items-center gap-6">
                                                <div className="relative">
                                                    <PremiumAvatar src={student.profile_photo_url} name={student.display_name} size="xs" className="w-14 h-14 rounded-2xl border border-white/10 shadow-2xl relative z-10" />
                                                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-75 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-serif font-black text-white text-lg tracking-tight uppercase group-hover:text-primary transition-colors duration-500">{student.display_name}</p>
                                                        {student.created_at && (new Date(student.created_at).getTime() > Date.now() - 86400000) && (
                                                            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[6px] font-black uppercase tracking-widest animate-pulse">NEW_NODE</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <p className="text-[9px] text-white/40 font-mono tracking-widest uppercase bg-white/5 px-1.5 py-0.5 rounded-md">{student.student_id_number || 'ID_PENDING'}</p>
                                                        {student.grade && (
                                                            <span className="text-[9px] text-white/20 font-black uppercase tracking-widest border-l border-white/10 pl-2">Grade {student.grade}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-8">
                                            {student.parent_guardian_details ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <p className="text-sm font-bold text-white/80">{student.parent_guardian_details}</p>
                                                    <span className="text-[9px] text-white/20 font-black uppercase tracking-[0.2em]">Verified Link</span>
                                                </div>
                                            ) : (
                                                <div className="group/link flex items-center gap-2 text-white/20 hover:text-white/40 transition-colors">
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Unlinked</span>
                                                    <div className="w-1 h-1 bg-white/10 rounded-full" />
                                                    <span className="text-[8px] font-bold italic opacity-0 group-hover/link:opacity-100 transition-opacity">Request Identity</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-8">
                                            {student.assigned_class_id ? (
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="inline-flex items-center w-fit px-4 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-100 border border-indigo-500/30 text-[9px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(99,102,241,0.1)]">{student.assigned_class_name}</span>
                                                    <span className="text-[8px] text-white/20 font-black uppercase tracking-widest ml-1">Stream Active</span>
                                                </div>
                                            ) : (
                                                <button onClick={(e) => { e.stopPropagation(); setAssigningStudent(student); }} className="px-5 py-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-amber-500/20 hover:border-amber-500/40 transition-all flex items-center gap-2 shadow-inner group/btn">
                                                    <SparklesIcon className="w-3 h-3 group-hover:rotate-12 transition-transform" />
                                                    Assign Class
                                                </button>
                                            )}
                                        </td>
                                        <td className="p-8 text-center">
                                            <div className="flex flex-col items-center gap-1.5">
                                                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border shadow-sm ${student.is_active ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                                                    <div className={`w-1 h-1 rounded-full ${student.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
                                                    {student.is_active ? 'Active' : 'Suspended'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-8 text-right pr-10">
                                            <button className="p-4 rounded-2xl bg-white/5 text-white/20 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-white/10 transition-all active:scale-95 shadow-lg">
                                                <MoreVerticalIcon className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="p-8 border-t border-white/5 bg-[#0a0a0c]/80 flex justify-between items-center relative z-10">
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">Sequence <span className="text-white/60">{currentPage}</span> of {totalPages || 1}</span>
                    <div className="flex gap-3">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-4 rounded-2xl border border-white/5 bg-white/5 text-white/40 hover:text-white disabled:opacity-20 transition-all"><ChevronLeftIcon className="w-6 h-6" /></button>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-4 rounded-2xl border border-white/5 bg-white/5 text-white/40 hover:text-white disabled:opacity-20 transition-all"><ChevronRightIcon className="w-6 h-6" /></button>
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