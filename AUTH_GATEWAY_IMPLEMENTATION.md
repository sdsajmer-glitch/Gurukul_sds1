# Authentication Gateway & Branch Handshake Protocol (v2 - Unified)

## Overview
We have refined the authentication gateway to a **Single Sign-On (SSO) Unified Interface**. The manual selection between "Global Node" and "Institutional Hub" has been removed to streamline the user experience. 

**Core Principle**: Role resolution is handled **automatically post-login** based on the user's email identity and its mapping in the institution's registry.

## Implementation Details

### 1. Unified Login Interface (`AuthPage.tsx`)
- **Single Entry Point**: The login screen now presents a standard Email/Password form for ALL users.
- **Removed Selection**: The "Establish Global Node" vs "Join Institutional Hub" screen has been deprecated.

### 2. Automatic Role Resolution (`App.tsx` + `RPC`)
- **Flow**:
  1. User logs in standard `signInWithPassword`.
  2. `App.tsx` detects the new session.
  3. **CRITICAL**: Before fetching the user profile, `App.tsx` calls `rpc('auto_handshake_on_login')`.
  4. **Server-Side Logic**: 
     - The RPC checks `school_branches` for a matching `admin_email`.
     - If found, it **Auto-Binds** the user's `branch_id` and sets their role to `School Administration`.
     - It logs the handshake in `handshake_audit_logs`.
  5. `App.tsx` then fetches the `profiles` row, which now contains the correct `branch_id`.

### 3. Dashboard Isolation (`SchoolAdminDashboard.tsx`)
- **Global Node (Head Office)**: 
  - Identified by: `role == 'School Administration'` AND `branch_id IS NULL`.
  - Has full access to all branches and network settings.
- **Satellite Node (Branch Admin)**:
  - Identified by: `role == 'School Administration'` AND `branch_id IS NOT NULL`.
  - **Restricted Access**: 
    - Cannot see "Expand Network" or "Institutional Branches" UI.
    - `get_school_branches` RPC returns ONLY their specific branch.
    - RLS policies prevent access to other branches' data.

## How to Test

1. **Test Branch Admin Flow**:
   - Ensure a branch exists in `school_branches` with an `admin_email` (e.g., `princpal@delhi-branch.com`).
   - Create a new Auth User with that email.
   - Login.
   - The system should automatically detect the match, assign the branch, and show the **Branch-Scoped Dashboard** (no "Expand Network").

2. **Test School Admin Flow**:
   - Login with a user that has `role = 'School Administration'` and `branch_id = NULL`.
   - Verify full access to all branches.

## File Changes
- **Modified**: `components/AuthPage.tsx` (Removed Gateway Selection)
- **Modified**: `App.tsx` (Added RPC call hook)
- **Modified**: `SchoolAdminDashboard.tsx` (Enhanced permission logic)
- **Deleted**: `components/BranchHandshakeForm.tsx` (Deprecated)

## Security
- **Strict RLS**: Row Level Security ensures that even if a Branch Admin tries to query global data, the database will return empty results.
- **Zero Leakage**: No list of branches is ever exposed to the client until the user is authenticated and authorized.
