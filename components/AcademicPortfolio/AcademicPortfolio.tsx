import React from 'react';
import { motion } from 'framer-motion';
import { TeacherExtended, TeacherSubjectMapping } from '../../types';
import PortfolioSummaryStrip from './PortfolioSummaryStrip';
import SubjectRegistry from './SubjectRegistry';
import { BookIcon } from '../icons/BookIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { ActivityIcon } from '../icons/ActivityIcon';

interface AcademicPortfolioProps {
    teacher: TeacherExtended;
    mappings: TeacherSubjectMapping[];
    loadingMappings: boolean;
    onMapRequest: () => void;
    onUnmapRequest: (id: number, subjectName: string, className: string) => void;
}

const AcademicPortfolio: React.FC<AcademicPortfolioProps> = ({
    teacher,
    mappings,
    loadingMappings,
    onMapRequest,
    onUnmapRequest
}) => {
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
                    <h2 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Academic <span className="text-white/20 italic font-medium">Portfolio.</span></h2>
                    <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em]">Strategic Subject Mappings & Institutional Impact Node</p>
                </div>

                <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onMapRequest}
                    className="px-8 py-4 bg-primary text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-xl shadow-lg transition-all flex items-center gap-3 shadow-primary/20"
                >
                    <PlusIcon className="w-4 h-4" /> Map New Strategic Subject
                </motion.button>
            </div>

            {/* 🏫 SUMMARY STRIP */}
            <PortfolioSummaryStrip
                assignedSubjects={mappings.length}
                totalImpact={mappings.length * 28} // Estimated average
                weeklyHours={mappings.reduce((acc, curr) => acc + (curr.credits || 4), 0)}
                efficiencyRating={96}
            />

            {/* 🏫 MAIN OPERATIONAL GRID (8/4 Split) */}
            <div className="grid grid-cols-12 gap-8 items-start px-1">

                {/* 8-COLUMN MAIN CONTENT (70% weight approx) */}
                <div className="col-span-12 xl:col-span-8 space-y-8">
                    <div className="transition-all duration-200 hover:translate-y-[-4px]">
                        <SubjectRegistry
                            mappings={mappings}
                            loading={loadingMappings}
                            onUnmap={onUnmapRequest}
                        />
                    </div>
                </div>

                {/* 4-COLUMN AUXILIARY PANEL (30% weight approx) */}
                <div className="hidden xl:block xl:col-span-4 h-full">
                    <div className="sticky top-8 space-y-8">
                        {/* Stewardship Matrix Card */}
                        <div className="p-10 bg-[#14161c] border border-white/5 rounded-[2.5rem] shadow-sm space-y-8 transition-all hover:translate-y-[-4px]">
                            <div className="flex items-center justify-between border-b border-white/5 pb-5">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary ring-1 ring-primary/20">
                                        <BookIcon className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Stewardship</h3>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/30 px-1">
                                        <span>Capacity Utilization</span>
                                        <span className="text-secondary text-primary">84% Optimal</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full w-[84%] bg-primary rounded-full shadow-[0_0_10px_rgba(124,77,255,0.4)]" />
                                    </div>
                                </div>

                                <div className="py-4 border-t border-white/[0.03] space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Institutional Output</p>
                                        <span className="text-[11px] font-black text-emerald-500 uppercase">HIGH_IMPACT</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Resource Delta</p>
                                        <span className="text-[11px] font-black text-white/40 uppercase">+4.2 Node_Hrs</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Audit Log Placeholder */}
                        <div className="p-10 bg-[#14161c] border border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center text-center space-y-4 min-h-[300px] transition-all hover:translate-y-[-4px]">
                            <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center opacity-20">
                                <ActivityIcon className="w-6 h-6" />
                            </div>
                            <h4 className="text-[12px] font-bold text-white/20 uppercase tracking-widest">Registry Audit Active</h4>
                            <p className="text-[9px] font-medium text-white/10 uppercase tracking-[0.3em] leading-relaxed">
                                Decrypting real-time changes to stewardship mappings...
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default AcademicPortfolio;
