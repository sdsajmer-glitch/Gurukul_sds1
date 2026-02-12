import React from 'react';
import { motion } from 'framer-motion';
import { TeacherExtended } from '../../types';
import ResponseSummaryStrip from './ResponseSummaryStrip';
import SentimentRegistry from './SentimentRegistry';
import { TargetIcon } from '../icons/TargetIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { ActivityIcon } from '../icons/ActivityIcon';

interface StudentResponseProps {
    teacher: TeacherExtended;
}

const StudentResponse: React.FC<StudentResponseProps> = ({ teacher }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-8 w-full max-w-[1440px] mx-auto pb-32"
        >
            {/* 🏫 SECTION HEADER LAYER */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 px-2">
                <div className="space-y-1">
                    <div className="flex items-center gap-3 opacity-40">
                        <div className="w-8 h-px bg-primary/40" />
                        <span className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Academic Control</span>
                    </div>
                    <h2 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Student <span className="text-white/20 italic font-medium">Response.</span></h2>
                    <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em]">Social Sentiment Analysis & Behavioral Performance Matrix</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="px-4 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Real-time Stream Active</span>
                    </div>
                </div>
            </div>

            {/* 🏫 SUMMARY STRIP */}
            <ResponseSummaryStrip
                approvalRating={94.8}
                interventionCount={12}
                engagementIndex={88}
                activeFeedback={4}
            />

            {/* 🏫 MAIN OPERATIONAL GRID (8/4 Split) */}
            <div className="grid grid-cols-12 gap-8 items-start px-1">

                {/* 8-COLUMN MAIN CONTENT (70% weight approx) */}
                <div className="col-span-12 xl:col-span-8 space-y-8">
                    <div className="transition-all duration-200 hover:translate-y-[-4px]">
                        <SentimentRegistry />
                    </div>
                </div>

                {/* 4-COLUMN AUXILIARY PANEL (30% weight approx) */}
                <div className="hidden xl:block xl:col-span-4 h-full">
                    <div className="sticky top-8 space-y-8">
                        {/* Behavioral Health Card */}
                        <div className="p-10 bg-[#14161c] border border-white/5 rounded-[2.5rem] shadow-sm space-y-8 transition-all hover:translate-y-[-4px]">
                            <div className="flex items-center justify-between border-b border-white/5 pb-5">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500 ring-1 ring-emerald-500/20">
                                        <ShieldCheckIcon className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Cohort Health</h3>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Stability Index</p>
                                    <span className="text-[11px] font-black text-emerald-500 uppercase">CALM_STABLE</span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Peer Harmony</p>
                                    <span className="text-[11px] font-black text-white/60 uppercase">92% Alpha</span>
                                </div>

                                <button className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-[10px] font-black text-white/60 uppercase tracking-[0.2em] transition-all">
                                    Generate Health Report
                                </button>
                            </div>
                        </div>

                        {/* Tactical Intervention Card */}
                        <div className="p-10 bg-[#14161c] border border-white/5 rounded-[2.5rem] shadow-sm space-y-8 transition-all hover:translate-y-[-4px]">
                            <div className="flex items-center justify-between border-b border-white/5 pb-5">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500 ring-1 ring-amber-500/20">
                                        <TargetIcon className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Intervention</h3>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <p className="text-[10px] font-medium text-white/20 uppercase tracking-widest leading-relaxed">
                                    No critical student interventions required in the current academic cycle.
                                </p>
                                <div className="pt-4 flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span className="text-[10px] font-black text-white/10 uppercase tracking-widest">All Cohorts Synchronized</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default StudentResponse;
