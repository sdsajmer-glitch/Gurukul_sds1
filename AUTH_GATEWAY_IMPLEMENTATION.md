# Authentication Gateway & Branch Handshake Protocol

## Overview
We have successfully implemented a dual-path authentication gateway that strictly separates **School Administration (Global Node)** and **Branch Administration (Institutional Hub)**. This ensures role-based isolation, security, and a premium user experience.

## key Components Implemented

### 1. Gateway Selection Interface (`AuthPage.tsx`)
- **Visual Split**: Users are presented with two clear options: "Establish Global Node" and "Join Institutional Hub".
- **Dynamic Routing**:
  - **Global Node**: Routes to the standard `LoginForm` (Email/Password).
  - **Institutional Hub**: Routes to the new `BranchHandshakeForm`.
- **Aesthetics**: Premium dark mode design with glassmorphism, hover effects, and institutional branding.

### 2. Branch Handshake Protocol (`BranchHandshakeForm.tsx`)
- **Secure Verification**: Users must enter their **Branch Access Key** and **Admin Email**.
- **RPC Validation**: A new secure RPC `verify_branch_execution_node` validates the credentials against the `school_branches` registry without exposing the database to the public.
- **Identity Binding**: Upon verification, the user is prompted to authenticate (Password) to finalize the session and bind their identity to the verified branch.

### 3. Security Enhancements (`RLS_RPC.sql`)
- **New RPC**: `verify_branch_execution_node(p_access_key, p_admin_email)`
  - Checks if the key and email match a valid branch.
  - Returns `success`, `branch_id`, and `branch_name` only if valid.
  - Defined as `SECURITY DEFINER` to bypass RLS safely for this specific check.
- **Strict RLS**: The `school_branches` table RLS policy remains strict, allowing visibility only to the Assigned Admin or School Admin.

## How to Test

1. **Apply Database Changes**:
   - Run the updated `RLS_RPC.sql` in your Supabase SQL Editor. This functions is CRITICAL for the handshake to work.

2. **Test Global Node Flow**:
   - Select "Establish Global Node".
   - Login with a School Admin email.
   - Verify you see the **School Admin Dashboard** with all branches.

3. **Test Branch Handshake Flow**:
   - Select "Join Institutional Hub".
   - Enter a valid **Branch Access Key** and the corresponding **Admin Email** (from your `school_branches` table).
   - Click "Verify & Access Node".
   - Verify the system identifies the branch and prompts for password.
   - Login.
   - Verify you see the **School Admin Dashboard** (scoped to Branch) with restricted access (no "Expand Network", only own branch data).

## File Changes
- **Modified**: `components/AuthPage.tsx`
- **Created**: `components/BranchHandshakeForm.tsx`
- **Modified**: `RLS_RPC.sql`

## Next Steps
- Ensure all Branch Admins have their `access_key` distributed securely.
- Monitor `handshake_audit_logs` (if enabled) for failed attempts.
