# CRITICAL: DATABASE SCHEMA UPDATE REQUIRED

## Issue: "Attribute Desync: column 'school_id' does not exist"

This error means your **Database Schema (Supabase)** is missing critical columns (`school_id` and `branch_id`) that are required for the new multi-branch system to work. The application code has been updated, but the database behind it is out of sync.

### HOW TO FIX (Takes 30 seconds)

1.  **Open VS Code file**: `FINAL_FIX_MISSING_COLUMNS.sql` (It is in your project folder).
2.  **Copy All Text** from that file.
3.  **Go to Supabase Dashboard** (in your browser).
4.  Click on the **SQL Editor** icon (on the left sidebar).
5.  **Paste the code** into the editor.
6.  Click **RUN** (Green button).
7.  **Refresh your App**.

### Why did this happen?
The "Unified Authentication" system we built requires tracking which School and Branch a user belongs to. We added these fields to the code, but they must be manually added to the live database to take effect.

Once you run the script, the error will disappear instantly.
