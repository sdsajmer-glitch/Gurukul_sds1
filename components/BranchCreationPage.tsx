import React, { useState, useEffect, useCallback } from 'react';
import { supabase, formatError } from '../services/supabase';
import { SchoolBranch, UserProfile, SchoolAdminProfileData } from '../types';
import Spinner from './common/Spinner';
import { BranchManagementTab } from './BranchManagementTab';
import { SparklesIcon } from './icons/SparklesIcon';

interface BranchCreationPageProps {
    onNext: () => void;
    profile?: UserProfile;
    onBack?: () => void;
}

export const BranchCreationPage: React.FC<BranchCreationPageProps> = ({ onNext, profile, onBack }) => {
    const [branches, setBranches] = useState<SchoolBranch[]>([]);
    const [schoolProfile, setSchoolProfile] = useState<SchoolAdminProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!profile?.id) return;
        try {
            // Fetch school profile
            const { data: profileData, error: profileError } = await supabase
                .from('school_admin_profiles')
                .select('*')
                .eq('user_id', profile.id)
                .single();

            if (profileError) throw profileError;
            setSchoolProfile(profileData);

            // Fetch branches via RPC (handles missing columns/fallback better)
            const { data: branchData, error: branchError } = await supabase.rpc('get_school_branches');

            if (branchError) throw branchError;
            setBranches(branchData || []);
        } catch (err: any) {
            setError(formatError(err));
        } finally {
            setLoading(false);
        }
    }, [profile?.id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6">
                <Spinner size="lg" className="text-primary" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 animate-pulse">Initializing Registry Console...</p>
            </div>
        );
    }

    return (
        <div className="relative">
            <BranchManagementTab
                isHeadOfficeAdmin={true}
                branches={branches}
                onBranchUpdate={fetchData}
                schoolProfile={schoolProfile}
            />

            {/* Sticky Onboarding Footer */}
            {branches.length > 0 && (
                <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <button
                        onClick={onNext}
                        className="btn-primary-premium flex items-center gap-8 px-20 py-8 text-[15px] shadow-[0_40px_100px_rgba(var(--primary),0.6)] group"
                    >
                        COMPLETE INSTITUTIONAL MESH
                        <div className="w-px h-8 bg-white/20 mx-2" />
                        <SparklesIcon className="w-8 h-8 group-hover:rotate-180 transition-all duration-1000" />
                    </button>
                </div>
            )}
        </div>
    );
};