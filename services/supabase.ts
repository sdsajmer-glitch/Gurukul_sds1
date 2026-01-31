
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://uakcydchamgtjbmcyfzi.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVha2N5ZGNoYW1ndGpibWN5ZnppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MjE3NzgsImV4cCI6MjA4NTM5Nzc3OH0.rRP1gfU7_-Wrxkd7qwRDpZsb6o-OcdS34w6Nt_wMYkE';

export const STORAGE_KEY = 'school_v15_auth_session';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Critical Configuration Error: Supabase credentials missing from institutional node.");
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
 * Institutional Error Protocol v3.5
 * Translates low-level SQL/API/Network errors into actionable user guidance.
 */
export const formatError = (err: any): string => {
    if (!err) return "Synchronization error.";
    if (typeof err === 'string') return err;

    // Extract base message
    const msg = err.message || err.error_description || err.error || err.details || err.hint || "";
    const lowerMsg = String(msg).toLowerCase();

    // 0. Network / Connectivity Check
    if (lowerMsg.includes('failed to fetch')) {
        return "Network Protocol Failure: Unable to reach the institutional cloud. Please verify your internet connection or check if the Supabase project is active/unpaused.";
    }

    // 1. Storage Specific Errors - CRITICAL for user configuration
    if (lowerMsg.includes('bucket not found') || lowerMsg.includes('storage bucket')) {
        return "Storage Protocol Failure: The required storage bucket is missing. REQUIRED SETUP: 1. Go to Supabase Dashboard -> Storage. 2. Ensure 'profiles', 'documents', and 'expenses' buckets exist. 3. Set access to 'Public'.";
    }

    // 2. Schema Specific Errors (Category Constraint)
    if (lowerMsg.includes('column "category"') && lowerMsg.includes('not-null')) {
        return "Schema Desync: Your database registry has an outdated constraint. Please apply the latest v25.0.3 migration in schema.txt to synchronize the ledger.";
    }

    // 3. General Postgres Mappings
    const code = err.code;
    if (code === '42703') return `Attribute Desync: ${msg}. Re-apply latest schema.txt.`;
    if (code === '23502') return `Data Integrity Fault: Mandatory parameter missing. Check input context.`;
    if (code === 'P0001') return msg || "Custom validation protocol rejected the payload.";

    try {
        const stringified = JSON.stringify(err, Object.getOwnPropertyNames(err));
        return stringified && stringified !== '{}' ? msg || stringified : msg || "Identity Handshake Protocol Exception.";
    } catch (e) {
        return msg || "Identity Handshake Protocol Exception.";
    }
};
