
import React, { useState, useEffect } from 'react';
import { UserProfile, Role, BuiltInRoles } from './types';

import Header from './components/parent/Header';
import { ProfileCreationPage } from './components/ProfileCreationPage';

// Import the tab components
import OverviewTab from './components/parent_tabs/OverviewTab';
import MyChildrenTab from './components/parent_tabs/MyChildrenTab';
import DocumentsTab from './components/parent_tabs/DocumentsTab';
import ShareCodesTab from './components/parent_tabs/ShareCodesTab';
import MessagesTab from './components/parent_tabs/MessagesTab';
import { HomeIcon } from './components/icons/HomeIcon';
import { StudentsIcon } from './components/icons/StudentsIcon';
import { DocumentTextIcon } from './components/icons/DocumentTextIcon';
import { CommunicationIcon } from './components/icons/CommunicationIcon';
import { ReceiptIcon } from './components/icons/ReceiptIcon';

interface ParentDashboardProps {
    profile: UserProfile;
    onSelectRole: (role: Role, isExisting?: boolean) => void;
    onProfileUpdate: () => void;
    onSignOut: () => void;
}

const navItems = [
    { id: 'Overview', label: 'Dashboard', icon: <HomeIcon className="w-4 h-4 md:w-5 md:h-5" /> },
    { id: 'My Children', label: 'Children', icon: <StudentsIcon className="w-4 h-4 md:w-5 md:h-5" /> },
    { id: 'Documents', label: 'Vault', icon: <DocumentTextIcon className="w-4 h-4 md:w-5 md:h-5" /> },
    { id: 'Messages', label: 'Inbox', icon: <CommunicationIcon className="w-4 h-4 md:w-5 md:h-5" /> },
    { id: 'Share Codes', label: 'Access', icon: <ReceiptIcon className="w-4 h-4 md:w-5 md:h-5" /> },
];

const ParentDashboard: React.FC<ParentDashboardProps> = ({ profile, onSelectRole, onProfileUpdate, onSignOut }) => {
    const [activeComponent, setActiveComponent] = useState('Overview');

    // Fix: Updated focusedAdmissionId to string | null to match UUID standard.
    const [focusedAdmissionId, setFocusedAdmissionId] = useState<string | null>(null);

    // Fix: Updated admissionId parameter to string to match UUID standard.
    const handleManageDocuments = (admissionId: string) => {
        setFocusedAdmissionId(admissionId);
        setActiveComponent('Documents');
    };

    const renderActiveComponent = () => {
        try {
            switch (activeComponent) {
                case 'Overview':
                    return <OverviewTab profile={profile} setActiveComponent={setActiveComponent} />;
                case 'My Children':
                    return <MyChildrenTab onManageDocuments={handleManageDocuments} profile={profile} />;
                case 'Documents':
                    return <DocumentsTab profile={profile} focusOnAdmissionId={focusedAdmissionId} onClearFocus={() => setFocusedAdmissionId(null)} setActiveComponent={setActiveComponent} />;
                case 'Messages':
                    return <MessagesTab />;
                case 'Share Codes':
                    return <ShareCodesTab onNavigate={setActiveComponent} />;
                case 'My Profile':
                    return (
                        <ProfileCreationPage
                            profile={profile}
                            role={profile.role || BuiltInRoles.PARENT_GUARDIAN}
                            onComplete={onProfileUpdate}
                            onBack={() => setActiveComponent('Overview')}
                            showBackButton={true}
                        />
                    );
                default:
                    return <OverviewTab profile={profile} setActiveComponent={setActiveComponent} />;
            }
        } catch (err) {
            console.error("Internal Portal Component Failure:", err);
            return (
                <div className="p-20 text-center flex flex-col items-center justify-center bg-red-500/5 rounded-[2.5rem] border border-red-500/10">
                    <p className="text-red-500 font-black text-xs uppercase tracking-[0.4em] mb-4">Module Desync</p>
                    <p className="text-white/40 text-sm italic mb-8">The requested workstation node failed to initialize.</p>
                    <button onClick={() => setActiveComponent('Overview')} className="px-8 py-3 bg-red-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-red-600 transition-all">Reload Dashboard</button>
                </div>
            );
        }
    };


    return (
        <div className="min-h-screen bg-[#08090a] text-foreground flex flex-col selection:bg-primary/20 selection:text-primary overflow-x-hidden">
            <Header
                profile={profile}
                onSelectRole={onSelectRole}
                onSignOut={onSignOut}
                onProfileClick={() => setActiveComponent('My Profile')}
            />

            {/* Optimized Responsive Navigation Ribbon */}
            <div className="sticky top-16 md:top-20 z-30 bg-[#08090a]/80 backdrop-blur-xl border-b border-white/5 pt-4 pb-2">
                <div className="max-w-7xl mx-auto flex items-center justify-start md:justify-center overflow-x-auto no-scrollbar gap-2 px-4">
                    <nav className="flex items-center gap-1 md:gap-3 bg-[#12141c]/60 p-1.5 rounded-full border border-white/10 shadow-2xl" aria-label="Tabs">
                        {navItems.map(item => {
                            const isActive = activeComponent === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveComponent(item.id)}
                                    className={`
                                        flex items-center gap-2 px-4 md:px-7 py-2.5 md:py-3 rounded-full font-black text-[10px] md:text-xs uppercase tracking-widest transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] whitespace-nowrap relative group
                                        ${isActive
                                            ? 'bg-primary text-white shadow-[0_8px_20px_-4px_rgba(var(--primary),0.4)] scale-[1.05] z-10'
                                            : 'text-white/40 hover:text-white hover:bg-white/5'
                                        }
                                    `}
                                >
                                    {item.icon}
                                    <span className={isActive ? 'block' : 'hidden sm:block'}>{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </div>

            <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12">
                {renderActiveComponent()}

            </main>

            <footer className="py-10 border-t border-white/5 bg-black/20 text-center px-6">
                <p className="text-[10px] font-black uppercase tracking-[0.6em] text-white/10">Institutional Matrix v9.5.1 Parent Node</p>
            </footer>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

export default ParentDashboard;
