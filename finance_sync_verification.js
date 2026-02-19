
// Node v20+ supports --env-file
// Run with: node --env-file=.env.local finance_sync_verification.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyStudentSync() {
    console.log('🚀 Starting Student Sync Verification...');

    // 1. Check if table exists (by selecting from it, simpler than metadata query for now)
    const { error: checkError } = await supabase.from('finance_student_profiles').select('student_id').limit(1);
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is no rows, which is fine
        console.log("⚠️ Table might not exist or permission error:", checkError.message);
    } else {
        console.log("✅ finance_student_profiles table accessible.");
    }

    // 2. Run Sync RPC
    console.log('🔄 Running fn_sync_student_finance_profiles...');
    const { data: syncData, error: syncError } = await supabase.rpc('fn_sync_student_finance_profiles', {
        p_branch_id: null // Sync all branches
    });

    if (syncError) {
        console.error('❌ Sync RPC Failed:', syncError);
        return;
    }

    console.log('✅ Sync RPC Result:', syncData);

    // 3. Verify Data
    console.log('🔍 Verifying synced data...');
    const { data: students, error: fetchError } = await supabase
        .from('finance_student_profiles')
        .select('*')
        .limit(5);

    if (fetchError) {
        console.error('❌ Failed to fetch profiles:', fetchError);
        return;
    }

    console.log(`✅ Found ${students.length} profiles.`);
    if (students.length > 0) {
        console.log('Sample Data:', students[0]);
    } else {
        console.warn('⚠️ No profiles found. Ensure student_profiles has data.');
    }

    // 4. Test Auto-Assignment (Mock)
    // We need a fee structure to assign. Let's list active structures first.
    const { data: structures } = await supabase.from('finance_fee_structures').select('id, name, target_grade').eq('status', 'Active').limit(1);

    if (structures && structures.length > 0) {
        const structure = structures[0];
        console.log(`🔄 Testing Assignment for Grade: ${structure.target_grade} (Structure: ${structure.name})`);

        const { data: assignData, error: assignError } = await supabase.rpc('fn_auto_assign_fee_structure_v2', {
            p_academic_year: '2025-2026', // Assumption
            p_branch_id: 1 // Assumption, or fetch from branch
        });

        if (assignError) {
            console.error('❌ Assignment RPC Failed (might be expected if params mismatch):', assignError.message);
        } else {
            console.log('✅ Assignment RPC Result:', assignData);
        }
    } else {
        console.log('ℹ️ No active fee structures found to test assignment.');
    }

}

verifyStudentSync();
