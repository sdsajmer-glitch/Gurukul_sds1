
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../services/supabase';
import { UserProfile } from '../types';
import Spinner from './common/Spinner';

// Icons
import { CalendarIcon } from './icons/CalendarIcon';
import { BookIcon } from './icons/BookIcon';
import { BarChartIcon } from './icons/BarChartIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import { ShieldCheckIcon } from './icons/ShieldCheckIcon';
import { PlusIcon } from './icons/PlusIcon';

// Sub-modules (To be created)
import ExamsOverview from './exams/ExamsOverview';
import ExamsEntry from './exams/ExamsEntry';
import ExamsGrading from './exams/ExamsGrading';

interface ExamsTabProps {
    profile: UserProfile;
    branchId: number | null;
}

type ActiveView = 'overview' | 'entry' | 'grading' | 'settings';

const ExamsTab: React.FC<ExamsTabProps> = ({ profile, branchId }) => {
    const [activeView, setActiveView] = useState<ActiveView>('overview');
    const [selectedExam, setSelectedExam] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [exams, setExams] = useState<any[]>([]);
    const [cycles, setCycles] = useState<any[]>([]);

    useEffect(() => {
        const fetchExams = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase.rpc('get_admin_exam_overview', {
                    p_branch_id: branchId
                });

                if (error) throw error;
                setExams(data || []);

                // Fetch exam cycles
                const { data: cycleData } = await supabase
                    .from('exam_cycles')
                    .select('*')
                    .eq('branch_id', branchId)
                    .order('created_at', { ascending: false });

                setCycles(cycleData || []);

            } catch (err) {
                console.error("Examination Registry Sync Failure:", err);
            } finally {
                setLoading(false);
            }
        };

        if (profile && branchId) fetchExams();
    }, [profile, branchId]);

    const TabButton: React.FC<{ id: ActiveView, label: string, icon: React.ReactNode }> = ({ id, label, icon }) => (
        <button
            onClick={() => setActiveView(id)}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${activeView === id
                ? 'bg-primary text-white border-primary shadow-[0_0_20px_rgba(59,130,246,0.4)]'
                : 'bg-white/[0.02] text-white/30 border-white/5 hover:border-white/10 hover:text-white'
                }`}
        >
            {icon}
            {label}
        </button>
    );

    if (loading) return <div className="h-[60vh] flex items-center justify-center"><Spinner size="lg" /></div>;

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* 1. Header Section */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 bg-[#12141c] p-10 rounded-[3rem] border border-white/5 shadow-2xl relative overflow-hidden ring-1 ring-white/5">
                <div className="space-y-2">
                    <h2 className="text-4xl font-serif font-black text-white tracking-tighter uppercase italic">Examination <span className="text-primary NOT-italic">Command</span></h2>
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">Academic Performance & Forensic Grading Console v4.0</p>
                </div>

                <div className="flex flex-wrap gap-4">
                    <TabButton id="overview" label="Orchestrator" icon={<CalendarIcon className="w-4 h-4" />} />
                    <TabButton id="entry" label="Marks Registry" icon={<BookIcon className="w-4 h-4" />} />
                    <TabButton id="grading" label="Grading Matrix" icon={<BarChartIcon className="w-4 h-4" />} />

                    {(profile?.role === 'super_admin' || profile?.role === 'school_admin') && (
                        <TabButton id="settings" label="Governance" icon={<SettingsIcon className="w-4 h-4" />} />
                    )}
                </div>
            </div>

            {/* 2. Content Region */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeView}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4, ease: 'circOut' }}
                >
                    {activeView === 'overview' && (
                        <ExamsOverview
                            exams={exams}
                            cycles={cycles}
                            branchId={branchId}
                            onEnterMarks={(exam) => {
                                setSelectedExam(exam);
                                setActiveView('entry');
                            }}
                        />
                    )}
                    {activeView === 'entry' && (
                        <ExamsEntry
                            exams={exams}
                            selectedExam={selectedExam}
                            branchId={branchId}
                            onBack={() => setActiveView('overview')}
                        />
                    )}
                    {activeView === 'grading' && (
                        <ExamsGrading branchId={branchId} />
                    )}
                    {activeView === 'settings' && (
                        <div className="p-20 text-center bg-white/[0.01] border border-dashed border-white/10 rounded-[3rem]">
                            <ShieldCheckIcon className="w-16 h-16 text-white/10 mx-auto mb-6" />
                            <p className="text-[12px] font-black text-white/40 uppercase tracking-[0.5em]">Governance Panel Initialization in Progress...</p>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default ExamsTab;
