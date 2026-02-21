
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://uakcydchamgtjbmcyfzi.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVha2N5ZGNoYW1ndGpibWN5ZnppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MjE3NzgsImV4cCI6MjA4NTM5Nzc3OH0.rRP1gfU7_-Wrxkd7qwRDpZsb6o-OcdS34w6Nt_wMYkE';
const supabaseServiceKey = (import.meta as any).env?.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

export const STORAGE_KEY = 'school_v15_auth_session';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Configuration Error: Supabase credentials missing from application.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: STORAGE_KEY,
        flowType: 'pkce'
    }
});

/**
 * Admin-level Supabase client (bypasses RLS).
 * Used for admin operations like assigning classes to students,
 * where the admin's auth.uid() doesn't match the student's user_id.
 * Falls back to anon client if service role key is unavailable.
 */
export const supabaseAdmin = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    : supabase;

/**
 * Global Error Handler
 * Translates low-level SQL/API/Network errors into actionable user guidance.
 */
export const formatError = (err: any): string => {
    if (!err) return "An unexpected error occurred.";
    if (typeof err === 'string') return err;

    // Extract base message
    const msg = err.message || err.error_description || err.error || err.details || err.hint || "";
    const lowerMsg = String(msg).toLowerCase();

    // 0. Network / Connectivity Check
    if (lowerMsg.includes('failed to fetch')) {
        return "Connection Error: Unable to reach the server. Please verify your internet connection.";
    }

    // 1. Storage Specific Errors - CRITICAL for user configuration
    if (lowerMsg.includes('bucket not found') || lowerMsg.includes('storage bucket')) {
        return "Storage Error: The required storage folder is missing. Please contact support or ensure 'profiles', 'documents', and 'expenses' buckets exist in the storage settings.";
    }

    // 2. Schema Specific Errors (Category Constraint)
    if (lowerMsg.includes('column "category"') && lowerMsg.includes('not-null')) {
        return "Database Error: The system records are out of sync. Please update the application to the latest version.";
    }

    // 3. General Postgres Mappings
    const code = err.code;
    if (code === '42703') return `Database error: ${msg}. Please refresh the page.`;
    if (code === '23502') return `Input Error: Mandatory field missing. Please check your data.`;
    if (code === 'P0001') return msg || "Validation error: check your input.";

    try {
        const stringified = JSON.stringify(err, Object.getOwnPropertyNames(err));
        return stringified && stringified !== '{}' ? msg || stringified : msg || "An unexpected error occurred.";
    } catch (e) {
        return msg || "An unexpected error occurred.";
    }
};
