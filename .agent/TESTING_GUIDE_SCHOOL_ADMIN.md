# School Admin Profile Save - Testing & Fix Guide

## 🔍 Issue Summary
School administrators cannot save their profile data during onboarding.

## ✅ Fixes Applied

### 1. **Enhanced ProfileCreationPage.tsx**
**Location:** `components/ProfileCreationPage.tsx` lines 230-303

**Changes:**
- ✅ Added proper null/undefined handling for all fields
- ✅ Improved phone number validation and construction
- ✅ Added validation to ensure required fields are not null before save
- ✅ Enhanced error logging with detailed error information
- ✅ Added explicit `onConflict` parameter to upsert operation
- ✅ Added check for empty upsert response

### 2. **Created SQL Fix Script**
**Location:** `FIX_SCHOOL_ADMIN_PROFILE_RLS.sql`

**Purpose:**
- Ensures table structure is correct
- Creates separate RLS policies for INSERT, SELECT, UPDATE, DELETE
- Grants necessary permissions to authenticated users
- Verifies setup completion

### 3. **Created Verification Script**
**Location:** `VERIFY_SCHOOL_ADMIN_TABLE.sql`

**Purpose:**
- Check table structure
- Verify RLS is enabled
- List all RLS policies
- Test current user authentication
- Check existing profile data

## 🚀 Testing Steps

### Step 1: Apply Database Fixes
1. Open Supabase SQL Editor
2. Run `FIX_SCHOOL_ADMIN_PROFILE_RLS.sql`
3. Verify no errors in execution
4. Run `VERIFY_SCHOOL_ADMIN_TABLE.sql` to confirm setup

### Step 2: Test Frontend
1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open browser and navigate to the app
3. Sign up/login as a School Administrator
4. Fill in the profile form with the following required fields:
   - ✅ Institution Name
   - ✅ Street Address
   - ✅ Primary Administrator Name
   - ✅ Administrator Email
   - ✅ Phone Number (local part)
   - ✅ Education Board

5. Click "Complete Setup"

### Step 3: Monitor Console Logs
Open browser DevTools (F12) and check the Console tab for:

**Expected Success Logs:**
```
=== FORM SUBMISSION STARTED ===
Current formData: {...}
Current role: School Administration
Validating School Admin fields...
✅ All validations passed!
Processing School Admin profile...
Raw formData: {...}
Constructed phone number: +91XXXXXXXXXX
School Admin Payload (validated): {...}
Attempting upsert with user_id: xxx-xxx-xxx
✅ School Admin profile saved successfully: [...]
Updating master profile...
✅ Master profile updated: [...]
=== FORM SUBMISSION COMPLETED SUCCESSFULLY ===
```

**If Error Occurs:**
```
❌ School Admin upsert error: {...}
Error code: XXXXX
Error message: ...
Error details: ...
Error hint: ...
```

### Step 4: Verify Database
After successful save, run in Supabase SQL Editor:
```sql
SELECT * FROM public.school_admin_profiles 
WHERE user_id = auth.uid();
```

Should return one row with all your data.

## 🐛 Common Issues & Solutions

### Issue 1: "new row violates row-level security policy"
**Cause:** RLS policy not allowing insert
**Solution:** Run `FIX_SCHOOL_ADMIN_PROFILE_RLS.sql`

### Issue 2: "Missing required fields: ..."
**Cause:** Form validation failing
**Solution:** Ensure all required fields are filled:
- Institution Name
- Street Address  
- Admin Name
- Admin Email
- Phone Number
- Education Board

### Issue 3: "Administrator phone number is required"
**Cause:** Phone local number is empty
**Solution:** Enter the phone number in the "Primary Phone Number" field

### Issue 4: "Profile save failed - no data returned"
**Cause:** Upsert succeeded but returned no data
**Solution:** Check if `.select()` is working properly, may need to check Supabase permissions

### Issue 5: Phone number shows as just "+91"
**Cause:** Local phone number not being captured
**Solution:** Check that the input field `admin_contact_phone_local` is properly bound to formData

## 📊 Validation Rules

### Required Fields (Frontend):
1. `school_name` - Must be non-empty string
2. `address` - Must be non-empty string
3. `admin_contact_name` - Must be non-empty string
4. `admin_contact_email` - Must be valid email
5. `admin_contact_phone_local` - Must be non-empty string
6. `academic_board` - Must be selected from dropdown

### Optional Fields:
- `city` - Auto-filled or manual
- `state` - Auto-filled or manual
- `country` - Defaults to 'India'
- `admin_designation` - Defaults to 'Director'
- `school_type` - Optional
- `academic_year_start` - Defaults to 'July'
- `academic_year_end` - Defaults to 'March'
- `grade_range_start` - Defaults to 'Pre-K'
- `grade_range_end` - Defaults to '12'

### Database Constraints:
- `user_id` - PRIMARY KEY, must match auth.uid()
- `country` - DEFAULT 'India'
- `admin_designation` - DEFAULT 'Director'
- `onboarding_step` - DEFAULT 'profile'

## 🔐 RLS Policy Details

### Policy: school_admin_insert_own
- **Operation:** INSERT
- **Check:** `auth.uid() = user_id`
- **Purpose:** Allow users to create their own profile

### Policy: school_admin_select_own
- **Operation:** SELECT
- **Using:** `auth.uid() = user_id`
- **Purpose:** Allow users to read their own profile

### Policy: school_admin_update_own
- **Operation:** UPDATE
- **Using:** `auth.uid() = user_id`
- **Check:** `auth.uid() = user_id`
- **Purpose:** Allow users to update their own profile

### Policy: school_admin_delete_own
- **Operation:** DELETE
- **Using:** `auth.uid() = user_id`
- **Purpose:** Allow users to delete their own profile

## 📝 Next Steps After Fix

1. **Test the complete flow:**
   - Sign up → Select Role → Fill Profile → Save → Verify Dashboard Access

2. **Check onboarding progression:**
   - After profile save, user should see onboarding step = 'pricing'
   - User should be redirected to next step or dashboard

3. **Verify data integrity:**
   - All fields should be saved correctly
   - Phone number should be in format: +91XXXXXXXXXX
   - Timestamps should be set automatically

4. **Test edge cases:**
   - Try saving with minimal required fields only
   - Try updating existing profile
   - Try with different country codes
   - Try with special characters in names

## 🎯 Success Criteria

✅ User can fill all required fields
✅ Form validation passes
✅ No console errors during save
✅ Success message appears
✅ Data is saved in database
✅ User is redirected to next step
✅ Profile can be edited later
✅ All fields display correctly when editing

## 📞 Support

If issues persist after applying these fixes:
1. Check browser console for specific error messages
2. Check Supabase logs for database errors
3. Verify user is authenticated (auth.uid() is not null)
4. Check network tab for failed requests
5. Verify all SQL scripts ran successfully
