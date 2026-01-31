
import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase, formatError } from './services/supabase';
import { UserProfile, BuiltInRoles, Role } from './types';
import PageLoader from './components/common/PageLoader';
import NotFound from './components/common/NotFound';

// Root-level Dashboard Components
const AuthPage = lazy(() => import('./components/AuthPage'));
const SchoolAdminDashboard = lazy(() => import('./SchoolAdminDashboard'));
const ParentDashboard = lazy(() => import('./ParentDashboard'));
const StudentDashboard = lazy(() => import('./components/StudentDashboard'));
const TeacherDashboard = lazy(() => import('./TeacherDashboard'));
const MinimalAdminDashboard = lazy(() => import('./MinimalAdminDashboard'));
const OnboardingFlow = lazy(() => import('./OnboardingFlow'));

const App: React.FC = () => {
    const [session, setSession] = useState<any | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProfile = useCallback(async (userId: string) => {
        try {
            const { data, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (profileError) throw profileError;
            setProfile(data as UserProfile);
        } catch (err: any) {
            setError(formatError(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Initial session discovery with error capturing
        supabase.auth.getSession()
            .then(({ data: { session: initialSession } }) => {
                setSession(initialSession);
                if (initialSession) {
                    fetchProfile(initialSession.user.id);
                } else {
                    setLoading(false);
                }
            })
            .catch(err => {
                console.error("Identity Handshake Error:", err);
                setError(formatError(err));
                setLoading(false);
            });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
            setSession(currentSession);
            if (currentSession) {
                fetchProfile(currentSession.user.id);
            } else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, [fetchProfile]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    const handleProfileUpdate = () => {
        if (session) fetchProfile(session.user.id);
    };

    const handleSelectRole = async (role: Role, isExisting?: boolean) => {
        if (session) {
            setLoading(true);
            try {
                const { error: switchError } = await supabase.rpc('switch_active_role', { p_target_role: role });
                if (switchError) throw switchError;
                await fetchProfile(session.user.id);
            } catch (err: any) {
                alert(formatError(err));
                setLoading(false);
            }
        }
    };

    if (loading) return <PageLoader label="ESTABLISHING SECURE HANDSHAKE" sublabel="Synchronizing identity context with node cluster..." />;

    // Handle initialization errors in the UI
    if (error) {
        return (
            <div className="min-h-screen bg-[#08090a] flex items-center justify-center p-6">
                <div className="bg-[#0d0f14] p-10 rounded-[2.5rem] border border-red-500/20 max-w-md text-center shadow-3xl">
                    <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-white font-serif font-black text-2xl uppercase tracking-tight mb-4">Node Disconnect</h2>
                    <p className="text-white/40 text-sm leading-relaxed mb-8">{error}</p>
                    <div className="flex flex-col gap-3">
                        <button onClick={() => window.location.reload()} className="w-full py-3 bg-white text-black font-black rounded-xl text-xs uppercase tracking-widest hover:bg-white/90 transition-all">Retry Handshake</button>
                        <button onClick={handleSignOut} className="w-full py-3 border border-white/10 text-white/60 font-black rounded-xl text-xs uppercase tracking-widest hover:bg-white/5 hover:text-white transition-all">Emergency Sign Out</button>
                    </div>
                </div>
            </div>
        );
    }

    if (!session) {
        return (
            <Suspense fallback={<PageLoader label="INITIALIZING AUTH NODE" />}>
                <Routes>
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="*" element={<Navigate to="/auth" replace />} />
                </Routes>
            </Suspense>
        );
    }

    const renderDashboard = () => {
        if (!profile) return <PageLoader label="NODE REGISTRY SYNC" sublabel="Handshake verified. Fetching profile artifacts..." />;

        if (!profile.role || !profile.profile_completed) {
            return (
                <OnboardingFlow 
                    profile={profile} 
                    onComplete={handleProfileUpdate} 
                    onStepChange={handleProfileUpdate}
                    onboardingStep={(profile as any)?.onboarding_step}
                />
            );
        }

        switch (profile.role) {
            case BuiltInRoles.SCHOOL_ADMINISTRATION:
            case BuiltInRoles.BRANCH_ADMIN:
                return (
                    <SchoolAdminDashboard 
                        profile={profile} 
                        onSelectRole={handleSelectRole} 
                        onProfileUpdate={handleProfileUpdate}
                        onSignOut={handleSignOut}
                    />
                );
            case BuiltInRoles.PARENT_GUARDIAN:
                return (
                    <ParentDashboard 
                        profile={profile} 
                        onSelectRole={handleSelectRole} 
                        onProfileUpdate={handleProfileUpdate}
                        onSignOut={handleSignOut}
                    />
                );
            case BuiltInRoles.STUDENT:
                return (
                    <StudentDashboard 
                        profile={profile} 
                        onSignOut={handleSignOut}
                        onSwitchRole={() => {}}
                        onSelectRole={handleSelectRole}
                    />
                );
            case BuiltInRoles.TEACHER:
                return (
                    <TeacherDashboard 
                        profile={profile} 
                        onSwitchRole={() => {}}
                        onProfileUpdate={handleProfileUpdate}
                        onSignOut={handleSignOut}
                        onSelectRole={handleSelectRole}
                    />
                );
            case BuiltInRoles.SUPER_ADMIN:
                return (
                    <MinimalAdminDashboard 
                        profile={profile} 
                        onSignOut={handleSignOut} 
                        onSelectRole={handleSelectRole} 
                    />
                );
            default:
                return <div className="p-20 text-center text-white/50 italic">Identity Scoping Failure: Role not recognized.</div>;
        }
    };

    return (
        <div className="min-h-screen bg-[#08090a]">
            <Suspense fallback={<PageLoader label="MOUNTING INTERFACE" />}>
                <Routes>
                    <Route path="/" element={renderDashboard()} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </Suspense>
        </div>
    );
};

export default App;
