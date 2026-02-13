import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UserProfile, Role, SchoolAdminProfileData, SchoolBranch, BuiltInRoles } from './types';
import Navbar from './components/admin/Navbar';
import Sidebar from './components/admin/Sidebar';
import DashboardOverview from './components/admin/DashboardOverview';
import AdmissionsTab from './AdmissionsTab';
import EnquiryTab from './EnquiryTab';
import AttendanceTab from './components/AttendanceTab';
import FinanceTab from './components/FinanceTab';
import CommunicationTab from './components/CommunicationTab';
import { UserManagementTab } from './components/UserManagementTab';
import { ProfileCreationPage } from './components/ProfileCreationPage';
import FacilityManagementTab from './components/FacilityManagementTab';
import CoursesTab from './components/CoursesTab';
import MeetingsTab from './components/MeetingsTab';
import HomeworkTab from './components/HomeworkTab';
import StudentManagementTab from './components/StudentManagementTab';
import { supabase, formatError } from './services/supabase';
// Fix: TimetableTab is now exported as default.
import TimetableTab from './components/TimetableTab';
import CodeVerificationTab from './components/CodeVerificationTab';
import { BranchManagementTab } from './components/BranchManagementTab';
import Spinner from './components/common/Spinner';
import AnalyticsTab from './components/AnalyticsTab';
import TeachersManagementTab from './TeachersManagementTab';
import ClassesTab from './components/ClassesTab';
import { getAdminMenu } from './components/admin/AdminMenuConfig';
import { XIcon } from './components/icons/XIcon';
import ReportCardParser from './components/admin/ReportCardParser';
import TaskManagementTab from './components/TaskManagementTab';

interface SchoolAdminDashboardProps {
    profile: UserProfile;
    onSelectRole: (role: Role, isExisting?: boolean) => void;
    onProfileUpdate: () => void;
    onSignOut: () => void;
}

const SchoolAdminDashboard: React.FC<SchoolAdminDashboardProps> = ({ profile, onSelectRole, onProfileUpdate, onSignOut }) => {
    const [activeComponent, setActiveComponent] = useState('Dashboard');
    const [schoolData, setSchoolData] = useState<SchoolAdminProfileData | null>(null);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const [branches, setBranches] = useState<SchoolBranch[]>([]);
    const [currentBranchId, setCurrentBranchId] = useState<number | null>(null);
    const [loadingData, setLoadingData] = useState(true);
    const [dataError, setDataError] = useState<string | null>(null);

    const isHeadOfficeAdmin = useMemo(() => profile.role === BuiltInRoles.SCHOOL_ADMINISTRATION && !profile.branch_id, [profile.role, profile.branch_id]);
    const isBranchAdmin = useMemo(() => profile.role === BuiltInRoles.SCHOOL_ADMINISTRATION && !!profile.branch_id, [profile.role, profile.branch_id]);

    const menuGroups = useMemo(() => {
        if (!profile.role) return [];
        return getAdminMenu(isHeadOfficeAdmin, profile.role);
    }, [isHeadOfficeAdmin, profile.role]);

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#/', '');
            const decodedHash = decodeURIComponent(hash);
            if (decodedHash) {
                const allItems = menuGroups.flatMap(g => g.items);
                const matchedItem = allItems.find(item => item.id === decodedHash);
                if (matchedItem) setActiveComponent(matchedItem.id);
            }
        };
        window.addEventListener('hashchange', handleHashChange);
        handleHashChange();
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [menuGroups]);

    const fetchDashboardData = useCallback(async () => {
        setLoadingData(true);
        setDataError(null);
        try {
            // 1. Fetch Branches and latest Profile Identity first
            const [branchRes, latestProfileRes] = await Promise.all([
                supabase.rpc('get_school_branches'),
                supabase.from('profiles').select('branch_id').eq('id', profile.id).maybeSingle()
            ]);

            if (branchRes.error) throw branchRes.error;

            let rawBranches = (branchRes.data || []) as SchoolBranch[];
            const profileBranchId = latestProfileRes.data?.branch_id;

            // 2. Ensuring Branch Admin has access to their specific branch
            if (!!profileBranchId && profile.role === BuiltInRoles.SCHOOL_ADMINISTRATION) {
                // If RPC didn't return it (e.g. edge case), try direct fetch
                if (rawBranches.length === 0 || !rawBranches.some(b => b.id === profileBranchId)) {
                    const { data: identityMatch } = await supabase
                        .from('school_branches')
                        .select('*')
                        .eq('id', profileBranchId)
                        .maybeSingle();

                    if (identityMatch) {
                        rawBranches = [identityMatch, ...rawBranches];
                    }
                }
            }

            const sortedBranches = [...rawBranches].sort((a, b) =>
                (b.is_main_branch ? 1 : 0) - (a.is_main_branch ? 1 : 0)
            );

            setBranches(sortedBranches);

            // 3. Determine whose School Profile to show (Head Office vs Self)
            let schoolHeadId = profile.id;
            // If I am a Branch Admin (have a branch_id), I should see the profile of the School Owner (school_user_id)
            if (profileBranchId && sortedBranches.length > 0) {
                const myBranch = sortedBranches.find(b => b.id === profileBranchId);
                if (myBranch?.school_user_id) {
                    schoolHeadId = myBranch.school_user_id;
                }
            }

            // 4. Fetch the School Admin Profile (Institution Details)
            const { data: schoolData, error: schoolError } = await supabase
                .from('school_admin_profiles')
                .select('*')
                .eq('user_id', schoolHeadId)
                .maybeSingle();

            if (schoolError && schoolError.code !== 'PGRST116') throw schoolError;
            setSchoolData(schoolData);

            // 5. IoT State Selection
            let targetId: number | null = null;
            if (profileBranchId) {
                targetId = profileBranchId;
            } else if (sortedBranches.length > 0) {
                const mainBranch = sortedBranches.find(b => b.is_main_branch);
                targetId = mainBranch ? mainBranch.id : sortedBranches[0].id;
            }
            setCurrentBranchId(targetId);

        } catch (e: any) {
            setDataError(formatError(e));
        } finally {
            setLoadingData(false);
        }
    }, [profile.id, profile.email, profile.role]);

    useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

    const currentBranch = useMemo(() => branches.find(b => b.id === currentBranchId) || null, [branches, currentBranchId]);

    const renderContent = () => {
        switch (activeComponent) {
            case 'Dashboard': return <DashboardOverview schoolProfile={schoolData} currentBranch={currentBranch} profile={profile} onNavigate={setActiveComponent} />;
            case 'Profile': return <ProfileCreationPage
                profile={profile}
                role={profile.role!}
                onComplete={() => {
                    onProfileUpdate();
                    setActiveComponent('Dashboard');
                }}
                onBack={() => setActiveComponent('Dashboard')}
                showBackButton={true}
            />;
            case 'Branches': return <BranchManagementTab isHeadOfficeAdmin={isHeadOfficeAdmin} branches={branches} isLoading={loadingData} error={dataError} onBranchUpdate={fetchDashboardData} onSelectBranch={setCurrentBranchId} schoolProfile={schoolData} />;
            case 'Admissions': return <AdmissionsTab branchId={currentBranchId} />;
            case 'Enquiries': return <EnquiryTab branchId={currentBranchId} onNavigate={setActiveComponent} />;
            case 'Code Verification': return <CodeVerificationTab branchId={currentBranchId} onNavigate={setActiveComponent} />;
            case 'Student Management': return <StudentManagementTab branchId={currentBranchId} />;
            case 'Teacher Management': return <TeachersManagementTab profile={profile} branchId={currentBranchId} />;
            case 'Classes': return <ClassesTab branchId={currentBranchId} profile={profile} />;
            case 'Courses': return <CoursesTab profile={profile} />;
            // Fix: AttendanceTab is now correctly recognized as a component thanks to the fix in types.ts.
            case 'Attendance': return <AttendanceTab />;
            case 'Timetable': return <TimetableTab />;
            case 'Finance': return <FinanceTab profile={profile} branchId={currentBranchId} branches={branches} />;
            case 'Communication': return <CommunicationTab profile={profile} />;
            case 'User Management': return <UserManagementTab profile={profile} isHeadOfficeAdmin={isHeadOfficeAdmin} />;
            case 'Analytics': return <AnalyticsTab branchId={currentBranchId} />;
            case 'Meetings': return <MeetingsTab />;
            case 'Homework': return <HomeworkTab />;
            case 'Facility Management': return <FacilityManagementTab />;
            case 'Report Card Parser': return <ReportCardParser />;
            case 'Task Orchestrator': return <TaskManagementTab branchId={currentBranchId} />;
            default: return <DashboardOverview schoolProfile={schoolData} currentBranch={currentBranch} profile={profile} onNavigate={setActiveComponent} />;
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
            <Sidebar activeComponent={activeComponent} setActiveComponent={setActiveComponent} isCollapsed={isSidebarCollapsed} setCollapsed={setIsSidebarCollapsed} isBranchAdmin={isBranchAdmin} isHeadOfficeAdmin={isHeadOfficeAdmin} menuGroups={menuGroups} />
            <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out h-screen overflow-hidden ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-[280px]'}`}>
                <Navbar activeComponent={activeComponent} setActiveComponent={setActiveComponent} isBranchAdmin={isBranchAdmin} isHeadOfficeAdmin={isHeadOfficeAdmin} profile={profile} onSelectRole={onSelectRole} onSignOut={onSignOut} branches={branches} currentBranchId={currentBranchId} onSwitchBranch={setCurrentBranchId} menuGroups={menuGroups} />
                <main className="flex-grow w-full max-w-[1800px] mx-auto p-4 sm:p-6 lg:p-8 custom-scrollbar overflow-y-auto">
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">{renderContent()}</div>
                </main>
            </div>
        </div>
    );
};

export default SchoolAdminDashboard;