import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import RoleSelectionPage from './RoleSelectionPage';
import { BranchCreationPage } from './BranchCreationPage';
import { ProfileCreationPage } from './ProfileCreationPage';
import PricingSelectionPage from './PricingSelectionPage';
import { Role, UserProfile, BuiltInRoles } from '../types';
import { supabase, formatError } from '../services/supabase';
import Spinner from './common/Spinner';
import ThemeSwitcher from './common/ThemeSwitcher';
import { SchoolIcon } from './icons/SchoolIcon';
import ProfileDropdown from './common/ProfileDropdown';
import Stepper from './common/Stepper';
import BackgroundEffects from './common/BackgroundEffects';

interface OnboardingFlowProps {
    profile: UserProfile;
    onComplete: () => Promise<void> | void;
    onStepChange: () => Promise<void> | void;
    onboardingStep?: string | null;
}

const ONBOARDING_STEPS = ['Profile', 'Plan', 'Branches & Admins'];
const stepMap: { [key: string]: number } = {
    'profile': 0,
    'pricing': 1,
    'branches': 2
};

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ profile, onComplete, onStepChange, onboardingStep }) => {
    const [step, setStep] = useState<'role' | 'profile' | 'pricing' | 'branches'>('role');
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [loading, setLoading] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const isMounted = useRef(true);

    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    useEffect(() => {
        if (!isMounted.current || isTransitioning) return;

        if (!profile.role) {
            setSelectedRole(null);
            setStep('role');
            setLoading(false);
            return;
        }

        setSelectedRole(profile.role);

        if (profile.role === BuiltInRoles.SCHOOL_ADMINISTRATION) {
            const dbStep = onboardingStep;
            if (dbStep && ['profile', 'pricing', 'branches'].includes(dbStep)) {
                setStep(dbStep as any);
            } else {
                setStep('profile');
            }
        } else {
            if (profile.profile_completed) {
                onComplete();
            } else {
                setStep('profile');
            }
        }

        setLoading(false);
    }, [profile.role, profile.profile_completed, onboardingStep, isTransitioning]);

    const handleSignOut = async () => {
        if (isMounted.current) setLoading(true);
        await supabase.auth.signOut();
    };

    const handleRoleSelect = async (role: Role) => {
        if (!isMounted.current || isTransitioning) return;
        setIsTransitioning(true);
        setLoading(true);

        try {
            if (role === BuiltInRoles.SCHOOL_ADMINISTRATION) {
                const { error } = await supabase.rpc('initialize_school_admin');
                if (error) throw error;
                if (isMounted.current) setStep('profile');
            } else {
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ role: role, profile_completed: false })
                    .eq('id', profile.id);

                if (updateError) throw updateError;
                if (isMounted.current) setStep('profile');
            }

            if (onStepChange) {
                await onStepChange();
            }

            setSelectedRole(role);

        } catch (err: any) {
            console.error('Role selection failed:', err);
            alert(`Role selection failed: ${formatError(err)}`);
            if (isMounted.current) {
                setStep('role');
                setLoading(false);
                setIsTransitioning(false);
            }
        } finally {
            // Loading state managed by the component content
        }
    };

    const handleStepAdvance = async () => {
        if (!isMounted.current) return;
        if (onStepChange) await onStepChange();
    };

    const handleFinalize = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.rpc('complete_branch_step');
            if (error) throw error;
            if (isMounted.current) await onComplete();
        } catch (error: any) {
            alert("Error finalizing institutional setup: " + formatError(error));
        } finally {
            if (isMounted.current) setLoading(false);
        }
    };

    const handleBack = async () => {
        if (!isMounted.current || profile.profile_completed) return;

        if (selectedRole === BuiltInRoles.SCHOOL_ADMINISTRATION) {
            setLoading(true);
            try {
                if (step === 'branches') {
                    await supabase.from('school_admin_profiles').update({ onboarding_step: 'pricing' }).eq('user_id', profile.id);
                    setStep('pricing');
                } else if (step === 'pricing') {
                    await supabase.from('school_admin_profiles').update({ onboarding_step: 'profile' }).eq('user_id', profile.id);
                    setStep('profile');
                } else if (step === 'profile') {
                    await supabase.from('profiles').update({ role: null, profile_completed: false }).eq('id', profile.id);
                    setSelectedRole(null);
                    setStep('role');
                }
                if (onStepChange) await onStepChange();
            } catch (err) {
                console.error("Back navigation sync error:", err);
            } finally {
                if (isMounted.current) setLoading(false);
            }
            return;
        }

        if (step === 'profile') {
            setLoading(true);
            try {
                await supabase.from('profiles').update({ role: null, profile_completed: false }).eq('id', profile.id);
                setSelectedRole(null);
                setStep('role');
                if (onStepChange) await onStepChange();
            } finally {
                if (isMounted.current) setLoading(false);
            }
        }
    };

    if (loading && !isTransitioning) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#08090a]">
                <BackgroundEffects />
                <div className="relative z-10 flex flex-col items-center gap-6">
                    <Spinner size="lg" className="text-primary" />
                    <p className="text-white/20 font-mono text-[10px] tracking-[0.3em] uppercase">Synchronizing Environment</p>
                </div>
            </div>
        );
    }

    const renderContent = () => {
        switch (step) {
            case 'role':
                return <RoleSelectionPage key="role" onRoleSelect={handleRoleSelect} onComplete={onComplete} />;
            case 'profile':
                return <ProfileCreationPage key="profile" profile={profile} role={selectedRole!} onComplete={handleStepAdvance} onBack={handleBack} showBackButton={true} />;
            case 'pricing':
                return <PricingSelectionPage key="pricing" onComplete={handleStepAdvance} onBack={handleBack} />;
            case 'branches':
                return <BranchCreationPage key="branches" onNext={handleFinalize} profile={profile} onBack={handleBack} />;
            default:
                return <RoleSelectionPage key="role" onRoleSelect={handleRoleSelect} onComplete={onComplete} />;
        }
    };

    const currentStepIndex = stepMap[step] ?? 0;

    return (
        <div className="min-h-screen bg-[#08090a] flex flex-col selection:bg-primary/30">
            <BackgroundEffects />

            <header className="fixed top-0 left-0 right-0 z-[100] px-6 py-6 pointer-events-none">
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="max-w-[1400px] mx-auto flex items-center justify-between p-4 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl pointer-events-auto"
                >
                    <div className="flex items-center gap-4 px-4 cursor-pointer group" onClick={() => step !== 'role' && handleBack()}>
                        <div className="w-12 h-12 bg-white/5 group-hover:bg-white/10 rounded-2xl flex items-center justify-center transition-all border border-white/10 group-hover:scale-110 group-hover:rotate-3 shadow-lg">
                            <SchoolIcon className="h-6 w-6 text-primary group-hover:text-white transition-colors" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-serif font-black text-lg text-white tracking-tight leading-none uppercase">Institutional Setup</span>
                            <span className="text-white/30 text-[9px] font-black uppercase tracking-[0.2em] mt-1">Node Registry • Beta 2.0</span>
                        </div>
                    </div>

                    {selectedRole === BuiltInRoles.SCHOOL_ADMINISTRATION && step !== 'role' && (
                        <div className="hidden lg:flex items-center justify-center flex-grow max-w-xl mx-auto">
                            <Stepper steps={ONBOARDING_STEPS} currentStep={currentStepIndex} />
                        </div>
                    )}

                    <div className="flex items-center gap-4 px-4">
                        <ThemeSwitcher />
                        <div className="h-8 w-px bg-white/10 mx-2" />
                        <ProfileDropdown profile={profile} onSignOut={handleSignOut} />
                    </div>
                </motion.div>
            </header>

            <main className="flex-grow pt-32 pb-20 relative z-10 overflow-hidden">
                <div className="max-w-[1400px] mx-auto px-6 lg:px-8 h-full">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 20, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, x: -20, filter: 'blur(10px)' }}
                            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                            className="h-full"
                        >
                            {renderContent()}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
};

export default OnboardingFlow;
