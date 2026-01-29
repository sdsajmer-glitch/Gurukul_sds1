---
description: School & Branch Handshake Protocol
---

# Institutional Handshake Protocol

This workflow describes how to initialize, verify, and synchronize a branch node within the Gurukul OS network.

## 1. Node Initialization (School Admin)
1. Navigate to **Governance > Institutional Branches**.
2. Click **Init New Node**.
3. Fill in branch details and the **Authorized Admin Email**.
4. System generates a unique **Access Key** (Encrypted Cipher).

## 2. Identity Verification (Branch Admin)
1. Log in with the authorized email.
2. If the node is not yet handshaked, you will be redirected to the **Identity Handshake Gateway**.
3. Enter the **Branch Access Key** provided by the School Admin.
4. The system executes `verify_and_link_branch_admin()`:
    - Matches email against the registry.
    - Validates the key cipher.
    - Links your `auth.uid()` to the `school_branches` record.

## 3. Atomic Provisioning
On successful handshake:
- `school_id` and `branch_id` are injected into your profile.
- RLS policies activate, isolating your view to only this branch.
- Lineage inheritance ensures all records you create (students, invoices) are automatically tagged.

## 4. Re-Handshake & Security Rotation
- If the Branch Admin email is changed in the registry, the handshake is invalidated.
- Decommissioning a node from the School level instantly revokes all branch-level access.
- Handshake audit logs track every sync attempt for institutional governance.
