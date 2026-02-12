import React from 'react';
import { motion } from 'framer-motion';
import { TeacherExtended } from '../../types';
import TimetableSummaryStrip from './TimetableSummaryStrip';
import OperationalGrid from './OperationalGrid';
import { ClockIcon } from '../icons/ClockIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { BookIcon } from '../icons/BookIcon';

interface LiveTimetableProps {
    teacher: TeacherExtended;
}

const LiveTimetable: React.FC<LiveTimetableProps> = ({ teacher }) => {
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
                    <h2 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Live <span className="text-white/20 italic font-medium">Timetable.</span></h2>
                    <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em]">Real-time Operational Schedule & Resource Allocation Grid</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="px-4 py-2 bg-primary/5 border border-primary/10 rounded-xl flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">Global Clock Active</span>
                    </div>
                </div>
            </div>

            {/* 🏫 SUMMARY STRIP */}
            <TimetableSummaryStrip
                currentStatus="IN_SESSION [PHY-402]"
                nextSession="12:45 PM [ATM-501]"
                todayTotal={6}
                roomAllocation="SECTOR_ALPHA_LAB_4"
            />

            {/* 🏫 MAIN OPERATIONAL GRID (8/4 Split) */}
            <div className="grid grid-cols-12 gap-8 items-start px-1">

                {/* 8-COLUMN MAIN CONTENT (70% weight approx) */}
                <div className="col-span-12 xl:col-span-8 space-y-8">
                    <div className="transition-all duration-200 hover:translate-y-[-4px]">
                        <OperationalGrid />
                    </div>
                </div>

                {/* 4-COLUMN AUXILIARY PANEL (30% weight approx) */}
                <div className="hidden xl:block xl:col-span-4 h-full">
                    <div className="sticky top-8 space-y-8">
                        {/* Weekly Rhythm Card */}
                        <div className="p-10 bg-[#14161c] border border-white/5 rounded-[2.5rem] shadow-sm space-y-8 transition-all hover:translate-y-[-4px]">
                            <div className="flex items-center justify-between border-b border-white/5 pb-5">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary ring-1 ring-primary/20">
                                        <ActivityIcon className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Weekly Rhythm</h3>
                                </div>
                            </div>

                            <div className="flex justify-between items-end gap-2 h-24">
                                {[45, 80, 60, 95, 30, 0, 0].map((height, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                        <div className="w-full bg-white/5 rounded-t-lg relative group h-full">
                                            <motion.div
                                                initial={{ height: 0 }}
                                                animate={{ height: `${height}%` }}
                                                className={`absolute bottom-0 left-0 right-0 rounded-t-lg transition-all ${i === 3 ? 'bg-primary' : 'bg-white/10'}`}
                                            />
                                        </div>
                                        <span className="text-[8px] font-black text-white/20 uppercase tracking-tighter">
                                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-4 pt-4 border-t border-white/[0.03]">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Active Days</p>
                                    <span className="text-[11px] font-black text-white/60 uppercase">MON-FRI</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Peak Load</p>
                                    <span className="text-[11px] font-black text-white/60 uppercase">THURSDAY</span>
                                </div>
                            </div>
                        </div>

                        {/* Substitution Registry Card */}
                        <div className="p-10 bg-[#14161c] border border-white/5 rounded-[2.5rem] shadow-sm space-y-8 transition-all hover:translate-y-[-4px]">
                            <div className="flex items-center justify-between border-b border-white/5 pb-5">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500 ring-1 ring-amber-500/20">
                                        <BookIcon className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Subsets</h3>
                                </div>
                                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Awaiting Log</span>
                            </div>

                            <p className="text-[10px] font-medium text-white/20 uppercase tracking-widest leading-relaxed">
                                No active substitution requests assigned to your node for the current operational cycle.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default LiveTimetable;
