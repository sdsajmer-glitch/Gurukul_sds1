# Bug Fix: Class Assignment Persistence

**Date:** 2026-02-08  
**Issue:** Class assignments revert to "Unassigned" after page reload.  
**Root Cause:** The backend RPC function `admin_assign_student_class` failed to persistently update the `student_profiles` table, likely due to incorrect parameter mapping (UUID vs Integer ID) or a restrictive WHERE clause.

---

## 🛠️ The Fix

I have created a robust SQL script that redefines the `admin_assign_student_class` function to ensure it explicitly updates the `student_profiles` table using the correct `user_id`.

### 📄 Script: `FIX_CLASS_ASSIGNMENT_PERSISTENCE.sql`

**Key Changes:**
1.  **Explicit Table Update:** Directly updates `student_profiles` setting `assigned_class_id`.
2.  **Correct Identification:** Uses `WHERE user_id = p_student_id` (UUID) instead of relying on ambiguous internal IDs.
3.  **Validation:** Verifies the class exists and the student profile exists before attempting update.
4.  **Consistency:** Updates `updated_at` timestamp.
5.  **Security:** Runs with `SECURITY DEFINER` specifically for this action to prevent RLS policies from blocking legitimate admin updates.

---

## 🚀 How to Apply

Since this is a database function change, you must execute the SQL script in your Supabase SQL Editor.

1.  Open **Supabase Dashboard** > **SQL Editor**.
2.  Open the file `FIX_CLASS_ASSIGNMENT_PERSISTENCE.sql` from your codebase.
3.  Copy the entire content.
4.  Paste it into the SQL Editor and click **RUN**.

### ✅ Verification Steps

1.  Reload the application.
2.  Open a Student Profile (e.g., Test1).
3.  Click **Academic Placement** > **Reassign Class**.
4.  Select a class and confirm.
5.  **Verify:** The UI updates immediately.
6.  **Refresh:** Reload the page. The class assignment should **persist**.

---

## 🔍 Technical Implementation Details

```sql
-- The core fix ensures we target the correct row by UUID
UPDATE student_profiles
SET 
    assigned_class_id = p_class_id,
    updated_at = NOW()
WHERE user_id = p_student_id; -- Crucial: Matches the UUID passed from frontend
```
