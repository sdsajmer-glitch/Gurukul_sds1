# Simplified School Admin Onboarding - Implementation Guide

## Goal
Simplify the onboarding flow by making school admins directly access the dashboard after profile creation, without requiring plan selection or branch setup.

## Changes Required

### 1. ProfileCreationPage.tsx
**File:** `components/ProfileCreationPage.tsx`
**Line:** ~343

**Change:**
```typescript
// OLD:
profile_completed: role !== BuiltInRoles.SCHOOL_ADMINISTRATION ? true : (isEditMode ? true : false),

// NEW:
profile_completed: true, // All users can access dashboard after profile creation
```

**Explanation:** Always set `profile_completed` to `true` for all roles, including School Administration. This allows them to access the dashboard immediately.

### 2. OnboardingFlow.tsx
**File:** `components/OnboardingFlow.tsx`  
**Lines:** ~53-66

**Change:**
```typescript
// OLD:
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

// NEW:
// For all roles, if profile is completed, go to dashboard
if (profile.profile_completed) {
    console.log('✅ Profile completed, redirecting to dashboard');
    onComplete();
    return;
}

// If profile not completed, show profile creation
console.log('Profile not completed, showing profile form');
setStep('profile');
```

**Explanation:** Remove the special handling for SCHOOL_ADMINISTRATION. All roles should follow the same logic: if profile is completed, go to dashboard.

### 3. Remove Pricing and Branches Steps
**File:** `components/OnboardingFlow.tsx`

**Remove these sections:**
- `PricingSelectionPage` import and component
- `BranchCreationPage` usage in switch statement
- `'pricing'` and `'branches'` cases in switch statement
- `handleStepAdvance` function complexity
- Stepper component (progress bar)

## Benefits

✅ **Immediate Access** - Users can start using the system right away
✅ **Simpler Flow** - No confusing multi-step onboarding
✅ **Better UX** - Faster time to value
✅ **Easier Maintenance** - Less code to maintain
✅ **Optional Features** - Plan and branches can be added later from dashboard

## Testing

1. Sign up as School Administration
2. Fill profile form
3. Click "Complete Setup"
4. Should redirect directly to dashboard
5. Can add branches later from dashboard menu

## Rollback

If needed, revert by:
```bash
git checkout components/ProfileCreationPage.tsx
git checkout components/OnboardingFlow.tsx
```
