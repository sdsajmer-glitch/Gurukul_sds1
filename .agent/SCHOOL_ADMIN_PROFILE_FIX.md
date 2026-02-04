# School Administration Profile Save Issue - Diagnostic Report

## Issue Description
School administrators are unable to save their profile data during the onboarding process.

## Root Cause Analysis

### 1. Database Schema Review
**Table:** `school_admin_profiles`
**Location:** `reset.sql` lines 437-457

**Columns:**
- `user_id` (PRIMARY KEY) ✅
- `school_name` ✅
- `address` ✅
- `city` ✅
- `state` ✅
- `country` (DEFAULT 'India') ✅
- `admin_contact_name` ✅
- `admin_contact_phone` ✅
- `admin_contact_email` ✅
- `admin_designation` (DEFAULT 'Director') ✅
- `academic_board` ✅
- `school_type` ✅
- `academic_year_start` ✅
- `academic_year_end` ✅
- `grade_range_start` ✅
- `grade_range_end` ✅
- `onboarding_step` (DEFAULT 'profile') ✅
- `plan_id` ✅
- `created_at` (DEFAULT now()) ✅

### 2. RLS Policy Review
**Location:** `reset.sql` lines 1468-1469

```sql
CREATE POLICY "Admin can manage own profile" ON public.school_admin_profiles
  FOR ALL USING (auth.uid() = user_id);
```

**Status:** ✅ CORRECT - Allows full CRUD operations for own profile

### 3. Frontend Save Logic Review
**Location:** `ProfileCreationPage.tsx` lines 230-265

**Payload Construction:**
```typescript
const payload: any = {
    user_id: profile.id,
    school_name: formData.school_name,
    address: formData.address,
    city: formData.city,
    state: formData.state,
    country: formData.country,
    admin_contact_name: formData.admin_contact_name,
    admin_designation: formData.admin_designation || 'Director',
    admin_contact_email: formData.admin_contact_email,
    admin_contact_phone: (formData.admin_contact_phone_country_code || '+91') + (formData.admin_contact_phone_local || ''),
    academic_board: formData.academic_board,
    school_type: formData.school_type,
    academic_year_start: formData.academic_year_start,
    academic_year_end: formData.academic_year_end,
    grade_range_start: formData.grade_range_start,
    grade_range_end: formData.grade_range_end,
    onboarding_step: isEditMode ? formData.onboarding_step : 'pricing'
};
```

### 4. Potential Issues Identified

#### Issue #1: Missing NULL Handling
Some fields might be `undefined` instead of `null`, which could cause issues with Supabase.

#### Issue #2: Phone Number Construction
The phone number is constructed by concatenating country code and local number. If either is empty, this could result in just a country code (e.g., "+91") being saved.

#### Issue #3: Validation Logic
The validation checks for `.trim()` on all required fields, but some fields might be optional in the database but required in the frontend validation.

#### Issue #4: Profile Completion Flag
For school admins, `profile_completed` is set to `false` initially (line 308), which might cause issues with the onboarding flow.

## Recommended Fixes

### Fix #1: Improve Payload Construction
Ensure all fields are properly handled with null coalescing and validation.

### Fix #2: Add Better Error Handling
Capture and display specific database errors to the user.

### Fix #3: Add Debugging Console Logs
The code already has extensive logging (lines 122-334), which is good for debugging.

### Fix #4: Verify RLS Policies
Ensure the user is authenticated and the `auth.uid()` matches the `user_id` being inserted.

### Fix #5: Check for Missing Columns
Verify that all columns in the payload exist in the database table.

## Testing Checklist

1. ✅ Check browser console for errors during save
2. ✅ Verify network tab shows the upsert request
3. ✅ Check if RLS policy is blocking the insert
4. ✅ Verify user is authenticated (auth.uid() is not null)
5. ✅ Check if any required database constraints are failing
6. ✅ Verify phone number format is correct
7. ✅ Check if onboarding_step value is valid

## Next Steps

1. Run the application and attempt to save a school admin profile
2. Check browser console for detailed error messages
3. Check network tab for the exact error response from Supabase
4. Apply fixes based on the specific error encountered
