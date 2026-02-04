
import React, { useState, useEffect, useRef } from 'react';
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

interface OnboardingFlowProps {
    profile: UserProfile;
    onComplete: () =\u003e Promise\u003cvoid\u003e | void;
onStepChange: () =\u003e Promise\u003cvoid\u003e | void;
onboardingStep ?: string | null;
}

const ONBOARDING_STEPS = ['Profile', 'Plan', 'Branches \u0026 Admins'];
const stepMap: { [key: string]: number } = {
    'profile': 0,
    'pricing': 1,
    'branches': 2
};

const OnboardingFlow: React.FC\u003cOnboardingFlowProps\u003e = ({ profile, onComplete, onStepChange, onboardingStep }) =\u003e {
    const [step, setStep] = useState\u003c'role' | 'profile' | 'pricing' | 'branches'\u003e('role');
const [selectedRole, setSelectedRole] = useState\u003cRole | null\u003e(null);
const [loading, setLoading] = useState(true);
const [isTransitioning, setIsTransitioning] = useState(false);

const isMounted = useRef(true);

useEffect(() =\u003e {
    return() =\u003e { isMounted.current = false; };
    }, []);

useEffect(() =\u003e {
    if(!isMounted.current || isTransitioning) return;

if (!profile.role) {
    setSelectedRole(null);
    setStep('role');
    setLoading(false);
    return;
}

setSelectedRole(profile.role);

if (profile.role === BuiltInRoles.SCHOOL_ADMINISTRATION) {
    const dbStep = onboardingStep;
    if (dbStep \u0026\u0026['profile', 'pricing', 'branches'].includes(dbStep)) {
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

const handleSignOut = async() =\u003e {
    if (isMounted.current) setLoading(true);
await supabase.auth.signOut();
    };

const handleRoleSelect = async (role: Role) =\u003e {
    if (!isMounted.current || isTransitioning) return;
setIsTransitioning(true);
setLoading(true);

try {
    if (role === BuiltInRoles.SCHOOL_ADMINISTRATION) {
        // Initialize School Admin workflow via Secured RPC
        const { error } = await supabase.rpc('initialize_school_admin');
        if (error) throw error;

        // CRITICAL FIX: Explicitly set the next UI step immediately after DB success
        if (isMounted.current) setStep('profile');
    } else {
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ role: role, profile_completed: false })
            .eq('id', profile.id);

        if (updateError) throw updateError;
        if (isMounted.current) setStep('profile');
    }

    // Trigger parent refresh to update the global 'profile' object
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
    // Keep loading true for a moment while the component switches content
}
    };

const handleStepAdvance = async() =\u003e {
    if (!isMounted.current) return;

setLoading(true);
try {
    // Advance to next step based on current step
    if (step === 'profile') {
        // Update database to mark profile as complete and move to pricing
        const { error } = await supabase
            .from('school_admin_profiles')
            .update({ onboarding_step: 'pricing' })
            .eq('user_id', profile.id);

        if (error) throw error;

        console.log('✅ Advanced to pricing step');
        if (isMounted.current) setStep('pricing');
    } else if (step === 'pricing') {
        // Update database to move to branches step
        const { error } = await supabase
            .from('school_admin_profiles')
            .update({ onboarding_step: 'branches' })
            .eq('user_id', profile.id);

        if (error) throw error;

        console.log('✅ Advanced to branches step');
        if (isMounted.current) setStep('branches');
    }

    // Trigger parent refresh
    if (onStepChange) await onStepChange();
} catch (error: any) {
    console.error('Error advancing step:', error);
    alert(`Failed to advance: ${formatError(error)}`);
} finally {
    if (isMounted.current) setLoading(false);
}
    };

const handleFinalize = async() =\u003e {
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

const handleBack = async() =\u003e {
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

if (loading \u0026\u0026!isTransitioning) {
    return (
    \u003cdiv className = "flex items-center justify-center min-h-screen bg-background"\u003e
    \u003cSpinner size = "lg" /\u003e
    \u003c / div\u003e
        );
}

let content;
switch (step) {
    case 'role':
        content = \u003cRoleSelectionPage onRoleSelect = { handleRoleSelect } onComplete = { onComplete } /\u003e;
        break;
    case 'profile':
        content = \u003cProfileCreationPage profile = { profile } role = { selectedRole! } onComplete = { handleStepAdvance } onBack = { handleBack } showBackButton = { true} /\u003e;
        break;
    case 'pricing':
        content = \u003cPricingSelectionPage onComplete = { handleStepAdvance } onBack = { handleBack } /\u003e;
        break;
    case 'branches':
        content = \u003cBranchCreationPage onNext = { handleFinalize } profile = { profile } onBack = { handleBack } /\u003e;
        break;
    default:
        content = \u003cRoleSelectionPage onRoleSelect = { handleRoleSelect } onComplete = { onComplete } /\u003e;
}

const currentStepIndex = stepMap[step] ?? 0;

return (
\u003cdiv className = "min-h-screen bg-background flex flex-col"\u003e
\u003cheader className = "bg-card border-b border-border shadow-sm sticky top-0 z-40"\u003e
\u003cdiv className = "max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8"\u003e
\u003cdiv className = "flex items-center justify-between h-20"\u003e
\u003cdiv className = "flex items-center flex-shrink-0 cursor-pointer" onClick = {() =\u003e step !== 'role' \u0026\u0026 handleBack()}\u003e
\u003cdiv className = "p-2 bg-primary/10 rounded-xl mr-3"\u003e
\u003cSchoolIcon className = "h-6 w-6 text-primary" /\u003e
\u003c / div\u003e
\u003cspan className = "font-serif font-bold text-lg hidden sm:block text-foreground"\u003eInstitutional Setup\u003c / span\u003e
\u003c / div\u003e

{
    selectedRole === BuiltInRoles.SCHOOL_ADMINISTRATION \u0026\u0026 step !== 'role' \u0026\u0026(
        \u003cdiv className = "hidden md:flex items-center justify-center flex-grow max-w-xl mx-auto"\u003e
        \u003cStepper steps = { ONBOARDING_STEPS } currentStep = { currentStepIndex } /\u003e
        \u003c / div\u003e
    )
}

\u003cdiv className = "flex items-center gap-3"\u003e
\u003cThemeSwitcher /\u003e
\u003cProfileDropdown profile = { profile } onSignOut = { handleSignOut } /\u003e
\u003c / div\u003e
\u003c / div\u003e
\u003c / div\u003e
\u003c / header\u003e
\u003cmain className = "flex-grow max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full"\u003e
{ content }
\u003c / main\u003e
\u003c / div\u003e
    );
};

export default OnboardingFlow;
