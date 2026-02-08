# Audit Report: Student Details Modal

**Date:** 2026-02-08  
**Scope:** Student Profile Modal, Data Fetching, Class Assignment, Persistence.

---

## 🔍 Findings & Resolutions

### 1. ❌ Issue: Failed Data Fetching (Empty Contact Info)
**Observation:** For students like "Test1", contact details (Phone, Parent Info) were displayed as `—` even if data existed in Admissions or Enquiries.  
**Root Cause:** The system strictly matched records using `student_user_id` or `admission_id`. Imported users often lack these strict links but share an **Email Address**.  
**✅ Resolution:**  
- **Enhanced `fetchData` logic:** Added a fallback search by **Email Address**.
- **Impact:** The system now intelligently finds Admission/Enquiry records matching `student.email`, allowing it to backfill contact details for unlinked students.

### 2. ❌ Issue: Class Assignment Not Persisting
**Observation:** After assigning a class and reloading, the status reverted to "UNASSIGNED".  
**Root Cause:** The backend function `admin_assign_student_class` was not correctly updating the `student_profiles` table, or was using an incorrect `WHERE` clause (likely ID mismatch between UUID and Integer).  
**✅ Resolution:**  
- **Created `FIX_CLASS_ASSIGNMENT_PERSISTENCE.sql`:** A robust SQL script that redefines the assignment function.
- **Key Fix:** Explicitly updates `student_profiles` using `WHERE user_id = p_student_id` (UUID), ensuring the assignment sticks.
- **Action Required:** Run the SQL script in Supabase.

### 3. ⚠️ Issue: "Unassigned" Visual State
**Observation:** UI showed "Unassigned" despite optimistic updates.  
**Root Cause:** When the persistence failed (Issue #2), the subsequent background data fetch returned `null` for the class ID, correctly reverting the UI to "Unassigned" immediately (or upon reload).  
**✅ Resolution:** Fixed by ensuring backend persistence works (See #2).

---

## 🛠️ Validation Steps

1.  **Apply SQL Fix:**  
    Run `FIX_CLASS_ASSIGNMENT_PERSISTENCE.sql` in your Supabase SQL Editor.

2.  **Verify Data Discovery:**  
    - Open "Test1" profile.
    - Validate that "Primary Email" matches an existing Admission/Enquiry email.
    - **Result:** "Parent Contact" and "Student Phone" should now populate from those records automatically.

3.  **Verify Class Assignment:**  
    - Assign a class to "Test1".
    - Reload the page.
    - **Result:** The class assignment should remain visible.

---

## 📁 Changed Files
- `components/students/StudentProfileModal.tsx`: Updated `fetchData` with email-based discovery.
- `FIX_CLASS_ASSIGNMENT_PERSISTENCE.sql`: New backend function definition.
