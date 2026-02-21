import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../services/supabase';
import { TeacherExtended, UserProfile } from '../types';
import Spinner from './common/Spinner';
import { TeacherIcon } from './icons/TeacherIcon';
import { SearchIcon } from './icons/SearchIcon';
import { EditIcon } from './icons/EditIcon';
import { PlusIcon } from './icons/PlusIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { BriefcaseIcon } from './icons/BriefcaseIcon';
import { GridIcon } from './icons/GridIcon';
import { FilterIcon } from './icons/FilterIcon';
import { XIcon } from './icons/XIcon';
import { MoreHorizontalIcon } from './icons/MoreHorizontalIcon';
import { MailIcon } from './icons/MailIcon';
import { PhoneIcon } from './icons/PhoneIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { UsersIcon } from './icons/UsersIcon';
import AddTeacherModal from './AddTeacherModal';
import TeacherDetailModal from './TeacherDetailModal';
import BulkActionsModal, { BulkActionType } from './teachers/BulkActionsModal';
import DepartmentsTab from './teachers/DepartmentsTab';
import { TransferIcon } from './icons/TransferIcon';
import { BookIcon } from './icons/BookIcon';
import { UploadIcon } from './icons/UploadIcon';
import { CommunicationIcon } from './icons/CommunicationIcon';
import { ClockIcon } from './icons/ClockIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { WorkflowIcon } from './icons/WorkflowIcon';
import TeacherAiAuditModal from './teachers/TeacherAiAuditModal';
import TeacherWorkflowGuide from './teachers/TeacherWorkflowGuide';

type QuickFilterType = 'All' | 'Active' | 'New Joinees' | 'Pending Verification' | 'On Leave' | 'Inactive';

interface FilterState {
    department: string;
    designation: string;
    employmentType: string;
    joiningYear: string;
}

const INITIAL_FILTERS: FilterState = {
    department: '',
    designation: '',
    employmentType: '',
    joiningYear: '',
};

const KPICard: React.FC<{ title: string; value: number | string; icon: React.ReactNode; colorClass?: string; trend?: string }> = ({ title, value, icon, colorClass = "bg-primary", trend }) => (
    <div className="relative overflow-hidden p-8 rounded-[2.5rem] border border-white/5 bg-[#0c0d12]/40 backdrop-blur-3xl shadow-2xl transition-all duration-700 cursor-pointer group hover:border-white/10 hover:bg-[#0c0d12]/60 hover:-translate-y-2">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-primary/20 opacity-0 group-hover:opacity-10 transition-opacity duration-1000 rounded-full blur-[80px]" />
        <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-primary/10 opacity-0 group-hover:opacity-[0.05] transition-opacity duration-1000 rounded-full blur-[80px]" />

        <div className="flex justify-between items-start mb-8 relative z-10">
            <div className={`p-4 rounded-2xl text-white shadow-2xl transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 ${colorClass} ring-1 ring-white/20`}>
                {icon}
            </div>
            {trend && (
                <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/10 uppercase tracking-widest">{trend}</span>
                </div>
            )}
        </div>

        <div className="relative z-10">
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em] mb-2">{title}</p>
            <h3 className="text-5xl font-serif font-black text-white tracking-tighter leading-none">{value}</h3>

            <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                <p className="text-[9px] text-white/10 font-bold uppercase tracking-[0.2em]">Institutional Faculty</p>
                <div className="w-10 h-1 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full bg-primary/30 w-1/3 group-hover:w-full transition-all duration-1000 ease-out" />
                </div>
            </div>
        </div>
    </div>
);

const getRandomStatus = () => {
    const r = Math.random();
    if (r > 0.9) return 'Absent';
    if (r > 0.8) return 'Late';
    return 'Present';
};

interface TeachersManagementTabProps {
    profile: UserProfile;
    branchId: number | null;
}

const TeachersManagementTab: React.FC<TeachersManagementTabProps> = ({ profile, branchId }) => {
    const [activeTab, setActiveTab] = useState<'directory' | 'departments'>('directory');
    const [teachers, setTeachers] = useState<TeacherExtended[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [quickFilter, setQuickFilter] = useState<QuickFilterType>('All');
    const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedTeacher, setSelectedTeacher] = useState<TeacherExtended | null>(null);
    const [bulkAction, setBulkAction] = useState<BulkActionType | null>(null);
    const [isAiAuditOpen, setIsAiAuditOpen] = useState(false);
    const [isGuideOpen, setIsGuideOpen] = useState(false);

    const fetchTeachers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: rpcError } = await supabase.rpc('get_all_teachers_for_admin');
            if (rpcError) throw rpcError;

            const mappedTeachers: TeacherExtended[] = (data || []).map((t: any) => ({
                id: t.id,
                email: t.email,
                display_name: t.display_name,
                phone: t.phone,
                role: 'Teacher',
                is_active: t.is_active,
                profile_completed: true,
                created_at: t.created_at,
                details: {
                    subject: t.subject,
                    qualification: t.qualification,
                    experience_years: t.experience_years,
                    date_of_joining: t.date_of_joining,
                    bio: t.bio,
                    specializations: t.specializations,
                    profile_picture_url: t.profile_picture_url,
                    gender: t.gender,
                    date_of_birth: t.date_of_birth,
                    department: t.department,
                    designation: t.designation,
                    employee_id: t.employee_id,
                    employment_type: t.employment_type,
                    employment_status: t.employment_status || (t.is_active ? 'Active' : 'Inactive'),
                    branch_id: t.branch_id
                },
                dailyStatus: getRandomStatus()
            }));
            setTeachers(mappedTeachers);
        } catch (err: any) {
            setError(`Failed to load teachers: ${err.message}`);
        } finally {
            setLoading(false);
            setSelectedIds(new Set());
        }
    }, []);

    useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

    const departments = useMemo(() => Array.from(new Set((teachers || []).map(t => t.details?.department).filter(Boolean))), [teachers]);
    const designations = useMemo(() => Array.from(new Set((teachers || []).map(t => t.details?.designation).filter(Boolean))), [teachers]);
    const years = useMemo(() => Array.from(new Set((teachers || []).map(t => t.details?.date_of_joining ? new Date(t.details.date_of_joining).getFullYear().toString() : '').filter(Boolean))).sort().reverse(), [teachers]);

    const filteredTeachers = useMemo(() => {
        return (teachers || []).filter(t => {
            const matchesBranch = !branchId || t.details?.branch_id === branchId;
            if (!matchesBranch) return false;
            const searchLower = searchTerm.toLowerCase();

            const displayName = t.display_name || '';
            const email = t.email || '';
            const employeeId = t.details?.employee_id || '';
            const phone = t.phone || '';
            const subject = t.details?.subject || '';
            const department = t.details?.department || '';

            const matchesSearch = !searchTerm ||
                displayName.toLowerCase().includes(searchLower) ||
                email.toLowerCase().includes(searchLower) ||
                employeeId.toLowerCase().includes(searchLower) ||
                phone.includes(searchLower) ||
                subject.toLowerCase().includes(searchLower) ||
                department.toLowerCase().includes(searchLower);

            let matchesQuickFilter = true;
            if (quickFilter === 'Active') matchesQuickFilter = t.is_active && t.details?.employment_status !== 'Pending Verification';
            if (quickFilter === 'Pending Verification') matchesQuickFilter = t.details?.employment_status === 'Pending Verification';
            if (quickFilter === 'On Leave') matchesQuickFilter = t.details?.employment_status === 'On Leave';
            if (quickFilter === 'Inactive') matchesQuickFilter = !t.is_active || t.details?.employment_status === 'Resigned' || t.details?.employment_status === 'Suspended';
            if (quickFilter === 'New Joinees') {
                const joinYear = t.details?.date_of_joining ? new Date(t.details.date_of_joining).getFullYear() : 0;
                const currentYear = new Date().getFullYear();
                matchesQuickFilter = joinYear === currentYear;
            }
            const matchesDepartment = !filters.department || t.details?.department === filters.department;
            const matchesDesignation = !filters.designation || t.details?.designation === filters.designation;
            const matchesType = !filters.employmentType || t.details?.employment_type === filters.employmentType;
            const matchesYear = !filters.joiningYear || (t.details?.date_of_joining && new Date(t.details.date_of_joining).getFullYear().toString() === filters.joiningYear);
            return matchesSearch && matchesQuickFilter && matchesDepartment && matchesDesignation && matchesType && matchesYear;
        });
    }, [teachers, searchTerm, quickFilter, filters, branchId]);

    const sortedTeachers = useMemo(() => {
        const sorted = [...filteredTeachers];
        sorted.sort((a, b) => {
            let aValue: any = '';
            let bValue: any = '';
            switch (sortConfig.key) {
                case 'name': aValue = a.display_name || ''; bValue = b.display_name || ''; break;
                case 'joining_date': aValue = new Date(a.details?.date_of_joining || 0).getTime(); bValue = new Date(b.details?.date_of_joining || 0).getTime(); break;
                case 'status': aValue = a.details?.employment_status || ''; bValue = b.details?.employment_status || ''; break;
                case 'department': aValue = a.details?.department || ''; bValue = b.details?.department || ''; break;
                default: return 0;
            }
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [filteredTeachers, sortConfig]);

    const totalPages = Math.max(1, Math.ceil(sortedTeachers.length / itemsPerPage));
    const paginatedTeachers = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedTeachers.slice(start, start + itemsPerPage);
    }, [sortedTeachers, currentPage, itemsPerPage]);

    const handleSort = (key: string) => setSortConfig(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));

    const handleSelectAll = () => {
        const pageIds = paginatedTeachers.map(t => t.id);
        const allOnPageSelected = pageIds.every(id => selectedIds.has(id));

        const newSet = new Set(selectedIds);
        if (allOnPageSelected) {
            pageIds.forEach(id => newSet.delete(id));
        } else {
            pageIds.forEach(id => newSet.add(id));
        }
        setSelectedIds(newSet);
    };

    const handleSelectRow = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleExport = () => {
        const dataToExport = selectedIds.size > 0 ? sortedTeachers.filter(t => selectedIds.has(t.id)) : sortedTeachers;
        const csvContent = "data:text/csv;charset=utf-8,Name,Email,Phone,Employee ID,Department,Designation,Status\n" + dataToExport.map(t => `"${t.display_name || ''}","${t.email || ''}","${t.phone || ''}","${t.details?.employee_id || ''}","${t.details?.department || ''}","${t.details?.designation || ''}","${t.details?.employment_status || ''}"`).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "teachers_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleBulkAction = (type: BulkActionType) => { if (selectedIds.size > 0 || type === 'import') setBulkAction(type); };

    const stats = useMemo(() => ({
        total: filteredTeachers.length,
        active: filteredTeachers.filter(t => t.is_active && t.details?.employment_status !== 'Pending Verification').length,
        departments: new Set(filteredTeachers.map(t => t.details?.department).filter(Boolean)).size,
        pending: filteredTeachers.filter(t => t.details?.employment_status === 'Pending Verification').length
    }), [filteredTeachers]);

    const StatusBadge = ({ status }: { status?: string }) => {
        let styles = 'bg-white/5 text-white/40 border-white/10';
        let dot = 'bg-white/20';

        if (status === 'Active') {
            styles = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            dot = 'bg-emerald-500 shadow-[0_0_8px_#10b981]';
        } else if (status === 'Pending Verification') {
            styles = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            dot = 'bg-amber-500 shadow-[0_0_8px_#f59e0b] animate-pulse';
        } else if (status === 'On Leave') {
            styles = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            dot = 'bg-blue-500 shadow-[0_0_8px_#3b82f6]';
        } else if (status === 'Suspended' || status === 'Resigned') {
            styles = 'bg-red-500/10 text-red-500 border-red-500/20';
            dot = 'bg-red-500 shadow-[0_0_8px_#ef4444]';
        }

        return (
            <span className={`inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border backdrop-blur-md transition-all duration-500 ${styles}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                {status || 'Unknown'}
            </span>
        );
    };

    const AttendanceBadge = ({ status }: { status?: string }) => {
        let color = 'bg-white/10';
        let label = 'Offline';

        if (status === 'Present') { color = 'bg-emerald-500 shadow-[0_0_12px_#10b981]'; label = 'Present'; }
        if (status === 'Absent') { color = 'bg-red-500 shadow-[0_0_12px_#ef4444]'; label = 'Absent'; }
        if (status === 'Late') { color = 'bg-amber-500 shadow-[0_0_12px_#f59e0b]'; label = 'Late'; }

        return (
            <div className="flex flex-col items-center gap-2 group/attend">
                <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 group-hover/attend:scale-125 ${color}`}></div>
                <span className="text-[7px] font-black text-white/20 uppercase tracking-widest group-hover/attend:text-white/40 transition-colors uppercase">{label}</span>
            </div>
        );
    };

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            className="space-y-12 pb-20 max-w-[1800px] mx-auto px-4 md:px-8"
        >
            {/* Header / Stats Section */}
            <motion.div
                variants={{
                    hidden: { opacity: 0 },
                    visible: {
                        opacity: 1,
                        transition: { staggerChildren: 0.1 }
                    }
                }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
            >
                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                    <KPICard title="Total Faculty" value={stats.total} icon={<TeacherIcon className="h-8 w-8" />} colorClass="bg-indigo-500 text-white" trend="+2 this month" />
                </motion.div>
                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                    <KPICard title="Active Teachers" value={stats.active} icon={<CheckCircleIcon className="h-8 w-8" />} colorClass="bg-emerald-500 text-white" />
                </motion.div>
                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                    <KPICard title="Departments" value={stats.departments} icon={<GridIcon className="h-8 w-8" />} colorClass="bg-amber-500 text-white" />
                </motion.div>
                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
                    <KPICard title="Pending Verification" value={stats.pending} icon={<BriefcaseIcon className="h-8 w-8" />} colorClass="bg-purple-500 text-white" trend={stats.pending > 0 ? "Action Required" : undefined} />
                </motion.div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8"
            >
                <div className="flex bg-[#12141c]/60 p-1.5 rounded-full border border-white/5 backdrop-blur-xl shadow-2xl ring-1 ring-white/5">
                    <button
                        onClick={() => setActiveTab('directory')}
                        className={`px-8 py-3 rounded-full text-[11px] font-black uppercase tracking-widest transition-all duration-300 relative overflow-hidden group ${activeTab === 'directory' ? 'bg-primary text-white shadow-lg shadow-primary/25 ring-1 ring-white/10 z-10' : 'text-white/40 hover:text-white'}`}
                    >
                        Faculty Directory
                    </button>
                    <button
                        onClick={() => setActiveTab('departments')}
                        className={`px-8 py-3 rounded-full text-[11px] font-black uppercase tracking-widest transition-all duration-300 relative overflow-hidden group ${activeTab === 'departments' ? 'bg-primary text-white shadow-lg shadow-primary/25 ring-1 ring-white/10 z-10' : 'text-white/40 hover:text-white'}`}
                    >
                        Departments
                    </button>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setIsGuideOpen(true)} className="flex items-center gap-3 px-6 py-3 bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] hover:border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-primary transition-all active:scale-95 shadow-2xl backdrop-blur-md">
                        <WorkflowIcon className="w-4 h-4 opacity-40 group-hover:opacity-100" /> Process Guide
                    </button>
                    <button onClick={() => setIsAiAuditOpen(true)} className="flex items-center gap-3 px-6 py-3 bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-2xl backdrop-blur-md">
                        <SparklesIcon className="w-4 h-4" /> AI Audit
                    </button>
                </div>
            </motion.div>

            <AnimatePresence mode="wait">
                {activeTab === 'departments' ? (
                    <motion.div key="departments" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
                        <DepartmentsTab teachers={teachers} branchId={branchId} />
                    </motion.div>
                ) : (
                    <motion.div key="directory" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-12">
                        <div className="bg-[#0d0f14]/90 p-5 rounded-[3rem] border border-white/5 backdrop-blur-xl ring-1 ring-white/5 shadow-[0_48px_96px_-24px_rgba(0,0,0,1)]">
                            <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
                                <div className="relative w-full lg:max-w-3xl group">
                                    <SearchIcon className="absolute left-8 top-1/2 -translate-y-1/2 h-6 w-6 text-white/10 group-focus-within:text-primary transition-all duration-500" />
                                    <input
                                        type="text"
                                        placeholder="SEARCH FACULTY BY NAME, ID, OR SUBJECT BLOCK..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                                        className="w-full pl-20 pr-10 py-7 bg-black/40 border border-white/5 rounded-[2rem] text-[15px] font-black text-white focus:bg-black/60 focus:ring-[15px] focus:ring-primary/5 focus:border-primary/40 outline-none uppercase tracking-[0.2em] shadow-inner placeholder:text-white/5 transition-all"
                                    />
                                </div>
                                <div className="flex items-center gap-4 w-full lg:w-auto px-4">
                                    <button
                                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                        className={`flex items-center gap-3 px-8 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 ${showAdvancedFilters ? 'bg-primary/10 border-primary/30 text-primary shadow-lg shadow-primary/10' : 'bg-white/[0.03] border-white/5 text-white/40 hover:text-white hover:bg-white/10'}`}
                                    >
                                        <FilterIcon className="w-4 h-4" /> Filters
                                    </button>
                                    <button onClick={() => setBulkAction('import')} className="flex items-center gap-3 px-8 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-white/[0.03] border border-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-95">
                                        <UploadIcon className="w-4 h-4" /> Import
                                    </button>
                                    <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-4 px-10 py-5 bg-primary text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-primary/90 transition-all shadow-2xl shadow-primary/20 hover:-translate-y-1 active:scale-95">
                                        <PlusIcon className="w-4 h-4" /> Add Teacher
                                    </button>
                                </div>
                            </div>

                            <AnimatePresence>
                                {showAdvancedFilters && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="mt-8 pt-8 border-t border-white/5 overflow-hidden"
                                    >
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-4 pb-4">
                                            <div className="space-y-3">
                                                <label className="text-[9px] font-black text-white/20 uppercase tracking-widest pl-2">Department</label>
                                                <select value={filters.department} onChange={e => setFilters({ ...filters, department: e.target.value })} className="w-full h-14 px-6 rounded-xl bg-black/40 border border-white/5 text-white text-xs font-bold focus:border-primary/40 outline-none appearance-none transition-all cursor-pointer">
                                                    <option value="">ALL DEPARTMENTS</option>
                                                    {departments.map(d => <option key={d} value={d as string}>{d?.toUpperCase()}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[9px] font-black text-white/20 uppercase tracking-widest pl-2">Designation</label>
                                                <select value={filters.designation} onChange={e => setFilters({ ...filters, designation: e.target.value })} className="w-full h-14 px-6 rounded-xl bg-black/40 border border-white/5 text-white text-xs font-bold focus:border-primary/40 outline-none appearance-none transition-all cursor-pointer">
                                                    <option value="">ALL DESIGNATIONS</option>
                                                    {designations.map(d => <option key={d} value={d as string}>{d?.toUpperCase()}</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[9px] font-black text-white/20 uppercase tracking-widest pl-2">Employment Type</label>
                                                <select value={filters.employmentType} onChange={e => setFilters({ ...filters, employmentType: e.target.value })} className="w-full h-14 px-6 rounded-xl bg-black/40 border border-white/5 text-white text-xs font-bold focus:border-primary/40 outline-none appearance-none transition-all cursor-pointer">
                                                    <option value="">ALL TYPES</option>
                                                    <option value="Full-time">FULL-TIME</option>
                                                    <option value="Part-time">PART-TIME</option>
                                                    <option value="Contract">CONTRACT</option>
                                                </select>
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[9px] font-black text-white/20 uppercase tracking-widest pl-2">Joining Year</label>
                                                <select value={filters.joiningYear} onChange={e => setFilters({ ...filters, joiningYear: e.target.value })} className="w-full h-14 px-6 rounded-xl bg-black/40 border border-white/5 text-white text-xs font-bold focus:border-primary/40 outline-none appearance-none transition-all cursor-pointer">
                                                    <option value="">ALL YEARS</option>
                                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="flex items-center gap-3 px-8 py-3 bg-[#0d0f14]/40 rounded-full border border-white/5 w-fit overflow-x-auto scrollbar-hide">
                            {(['All', 'Active', 'New Joinees', 'Pending Verification', 'On Leave', 'Inactive'] as QuickFilterType[]).map(chip => (
                                <button
                                    key={chip}
                                    onClick={() => { setQuickFilter(chip); setCurrentPage(1); }}
                                    className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border ${quickFilter === chip ? 'bg-white text-black border-white shadow-xl scale-105' : 'bg-transparent text-white/30 border-white/5 hover:border-white/20 hover:text-white'}`}
                                >
                                    {chip}
                                </button>
                            ))}
                        </div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-[#0a0a0c] border border-white/5 rounded-[4rem] shadow-[0_64px_128px_-24px_rgba(0,0,0,1)] overflow-hidden min-h-[600px] ring-1 ring-white/10 relative group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-tr from-primary/[0.015] via-transparent to-transparent pointer-events-none group-hover:opacity-100 transition-opacity duration-1000"></div>

                            {selectedIds.size > 0 && (
                                <motion.div
                                    initial={{ y: -20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="px-12 py-5 bg-primary/10 border-b border-primary/20 flex items-center justify-between sticky top-0 z-30 backdrop-blur-3xl"
                                >
                                    <div className="flex items-center gap-8">
                                        <span className="text-[11px] font-black text-primary uppercase tracking-[0.2em]">{selectedIds.size} TEACHERS SELECTED</span>
                                        <div className="h-6 w-px bg-primary/20"></div>
                                        <div className="flex gap-4">
                                            {[
                                                { id: 'status', label: 'Set Status', icon: <CheckCircleIcon className="w-4 h-4" /> },
                                                { id: 'department', label: 'Assign Dept', icon: <BriefcaseIcon className="w-4 h-4" /> },
                                                { id: 'subject', label: 'Assign Sub', icon: <BookIcon className="w-4 h-4" /> },
                                                { id: 'transfer', label: 'Transfer', icon: <TransferIcon className="w-4 h-4" /> },
                                            ].map(action => (
                                                <button key={action.id} onClick={() => handleBulkAction(action.id as BulkActionType)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-white/40 hover:text-white hover:bg-white/5 transition-all">
                                                    {action.icon} {(action.label === 'Assign Dept' ? 'Department' : action.label === 'Assign Sub' ? 'Subject' : action.label)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <button onClick={handleExport} className="px-6 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-xl shadow-xl hover:bg-white/90 active:scale-95 transition-all flex items-center gap-2">
                                            <DownloadIcon className="w-4 h-4" /> EXPORT
                                        </button>
                                        <button className="px-6 py-3 bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-500/20 active:scale-95 transition-all flex items-center gap-2">
                                            <TrashIcon className="w-4 h-4" /> DELETE
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {loading ? (
                                <div className="flex-grow flex items-center justify-center p-40">
                                    <Spinner size="lg" className="text-primary" />
                                </div>
                            ) : filteredTeachers.length === 0 ? (
                                <div className="flex-grow flex flex-col items-center justify-center text-white/10 p-40">
                                    <div className="w-32 h-32 bg-white/[0.01] border-2 border-dashed border-white/5 rounded-[3rem] flex items-center justify-center mb-10">
                                        <UsersIcon className="w-16 h-16 opacity-10" />
                                    </div>
                                    <p className="font-serif italic text-3xl uppercase tracking-[0.3em] mb-4 text-white/20">No Records found.</p>
                                    <p className="text-[11px] font-black uppercase tracking-[0.5em] text-white/5 mb-10">NO TEACHERS MATCH THE CURRENT FILTER</p>
                                    <button onClick={() => { setSearchTerm(''); setQuickFilter('All'); setFilters(INITIAL_FILTERS); }} className="px-12 py-5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] transition-all active:scale-95 shadow-2xl">RECALIBRATE FILTERS</button>
                                </div>
                            ) : (
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
                                        <thead className="bg-[#0f1115]/95 border-b border-white/[0.06] text-[10px] font-black text-white/20 uppercase tracking-[0.5em] sticky top-0 z-10 backdrop-blur-3xl shadow-sm">
                                            <tr>
                                                <th className="p-10 pl-16 text-center w-24">
                                                    <input type="checkbox" className="w-5 h-5 rounded border-white/10 bg-white/5 text-primary focus:ring-primary/20 cursor-pointer" checked={selectedIds.size > 0 && selectedIds.size === paginatedTeachers.length} onChange={handleSelectAll} />
                                                </th>
                                                <th className="p-10 cursor-pointer group" onClick={() => handleSort('name')}>TEACHER {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                                                <th className="p-10">CONTACT DETAILS</th>
                                                <th className="p-10">EMPLOYEE ID</th>
                                                <th className="p-10">DEPARTMENT</th>
                                                <th className="p-10 text-center">STATUS</th>
                                                <th className="p-10">EMPLOYMENT STATUS</th>
                                                <th className="p-10 text-right pr-16 tracking-widest uppercase text-center opacity-20">ACTIONS</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/[0.04] relative z-0 transition-all">
                                            {paginatedTeachers.map((teacher, idx) => (
                                                <motion.tr
                                                    key={teacher.id}
                                                    initial={{ opacity: 0, y: 15 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: idx * 0.03, duration: 0.5 }}
                                                    className={`group hover:bg-white/[0.03] transition-all duration-500 cursor-pointer ${selectedIds.has(teacher.id) ? 'bg-primary/[0.04]' : ''}`}
                                                    onClick={() => setSelectedTeacher(teacher)}
                                                >
                                                    <td className="p-10 pl-16 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <input type="checkbox" className="w-5 h-5 rounded border-white/10 bg-white/5 text-primary focus:ring-primary/20 cursor-pointer" checked={selectedIds.has(teacher.id)} onChange={() => handleSelectRow(teacher.id)} />
                                                    </td>
                                                    <td className="p-10">
                                                        <div className="flex items-center gap-8">
                                                            <div className="relative">
                                                                <div className="absolute inset-0 blur-2xl opacity-0 group-hover:opacity-40 transition-opacity duration-700 bg-primary"></div>
                                                                <div className="w-20 h-20 rounded-[2.5rem] bg-gradient-to-tr from-[#12141c] to-[#1a1d26] flex items-center justify-center text-white font-black text-2xl shadow-2xl overflow-hidden border-2 border-white/5 relative z-10 group-hover:border-primary/40 transition-all duration-700">
                                                                    {teacher.details?.profile_picture_url ? (
                                                                        <img src={teacher.details.profile_picture_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                                                                    ) : (
                                                                        <span className="opacity-40 font-serif italic">{(teacher.display_name || '?').charAt(0)}</span>
                                                                    )}
                                                                </div>
                                                                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-[#0a0a0c] z-20 ${(teacher as any).dailyStatus === 'Present' ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : (teacher as any).dailyStatus === 'Absent' ? 'bg-red-500 shadow-[0_0_15px_#ef4444]' : 'bg-amber-500 animate-pulse'}`}></div>
                                                            </div>
                                                            <div>
                                                                <p className="font-serif font-black text-white text-[24px] group-hover:text-primary transition-colors uppercase tracking-tight leading-none mb-3">{teacher.display_name}</p>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-[10px] text-primary/60 font-black uppercase tracking-[0.4em] bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/10 transition-colors">{teacher.details?.designation || 'FACULTY MEMBER'}</span>
                                                                    <div className="w-1 h-1 rounded-full bg-white/10"></div>
                                                                    <span className="text-[10px] font-mono text-white/15 uppercase tracking-[0.2em] font-bold">TCH_{teacher.id.substring(0, 6).toUpperCase()}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-10">
                                                        <div className="flex flex-col gap-3">
                                                            <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-wider text-white/30 group-hover:text-white/60 transition-colors">
                                                                <MailIcon className="w-4 h-4 opacity-40" />
                                                                <span className="truncate max-w-[200px]" title={teacher.email || ''}>{teacher.email || 'NO EMAIL'}</span>
                                                            </div>
                                                            {teacher.phone && (
                                                                <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-wider text-white/30 group-hover:text-white/60 transition-colors">
                                                                    <PhoneIcon className="w-4 h-4 opacity-40" /> {teacher.phone}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-10">
                                                        <span className="text-[12px] font-mono font-black text-white/20 group-hover:text-white/40 transition-colors uppercase tracking-[0.2em]">{teacher.details?.employee_id || '—'}</span>
                                                    </td>
                                                    <td className="p-10">
                                                        {teacher.details?.department ? (
                                                            <span className="inline-flex items-center px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/[0.03] text-white/60 border border-white/5 group-hover:bg-white/[0.06] transition-colors">{teacher.details.department}</span>
                                                        ) : (
                                                            <span className="text-[10px] font-black text-white/10 italic">UNASSIGNED</span>
                                                        )}
                                                    </td>
                                                    <td className="p-10 text-center">
                                                        <div className="flex justify-center">
                                                            <AttendanceBadge status={(teacher as any).dailyStatus} />
                                                        </div>
                                                    </td>
                                                    <td className="p-10">
                                                        <StatusBadge status={teacher.details?.employment_status} />
                                                    </td>
                                                    <td className="p-10 text-right pr-16" onClick={(e) => e.stopPropagation()}>
                                                        <button className="p-4 rounded-2xl bg-white/[0.03] text-white/20 group-hover:text-primary group-hover:bg-primary/10 border border-white/5 group-hover:border-primary/20 transition-all shadow-xl active:scale-95">
                                                            <MoreHorizontalIcon className="w-6 h-6" />
                                                        </button>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="p-10 border-t border-white/[0.04] bg-[#0d0f14]/50 flex flex-col md:flex-row justify-between items-center gap-8">
                                <div className="flex items-center gap-10">
                                    <div className="flex items-center gap-4 bg-black/40 px-6 py-3 rounded-2xl border border-white/5">
                                        <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Rows per page</span>
                                        <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="bg-transparent text-white text-[12px] font-black outline-none cursor-pointer">
                                            <option value={10}>10</option>
                                            <option value={25}>25</option>
                                            <option value={50}>50</option>
                                        </select>
                                    </div>
                                    <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">
                                        Page {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, sortedTeachers.length)} of {sortedTeachers.length}
                                    </span>
                                </div>
                                <div className="flex items-center gap-6">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-4 rounded-2xl bg-white/[0.03] text-white/20 hover:text-white border border-white/5 hover:bg-white/10 disabled:opacity-10 transition-all active:scale-90"
                                    >
                                        <ChevronLeftIcon className="w-6 h-6" />
                                    </button>
                                    <span className="text-[12px] font-black text-white tracking-[0.5em] uppercase">
                                        Page <span className="text-primary font-mono">{currentPage}</span> / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-4 rounded-2xl bg-white/[0.03] text-white/20 hover:text-white border border-white/5 hover:bg-white/10 disabled:opacity-10 transition-all active:scale-90"
                                    >
                                        <ChevronRightIcon className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {isAddModalOpen && <AddTeacherModal onClose={() => setIsAddModalOpen(false)} onSuccess={fetchTeachers} branchId={branchId} />}
            {selectedTeacher && <TeacherDetailModal teacher={selectedTeacher} onClose={() => setSelectedTeacher(null)} onUpdate={fetchTeachers} />}
            {bulkAction && <BulkActionsModal action={bulkAction} selectedIds={Array.from(selectedIds)} onClose={() => setBulkAction(null)} onSuccess={() => { fetchTeachers(); setSelectedIds(new Set()); }} branchId={branchId} />}
            {isAiAuditOpen && <TeacherAiAuditModal onClose={() => setIsAiAuditOpen(false)} />}
            {isGuideOpen && <TeacherWorkflowGuide onClose={() => setIsGuideOpen(false)} />}
        </motion.div>
    );
};

export default TeachersManagementTab;