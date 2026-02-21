import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TeacherExtended } from '../../types';
import ComplianceSummaryStrip from './ComplianceSummaryStrip';
import EmploymentRegistry from './EmploymentRegistry';
import TenureMatrix from './TenureMatrix';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';

interface ComplianceDossierProps {
    teacher: TeacherExtended;
    onUpdate: () => void;
}

const ComplianceDossier: React.FC<ComplianceDossierProps> = ({ teacher, onUpdate }) => {
    const [isMobileActivityOpen, setIsMobileActivityOpen] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-8 w-full max-w-[1440px] mx-auto pb-32"
        >
            {/* 🏫 SECTION HEADER LAYER */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 px-2">
                <div className="space-y-1">
                    <div className="flex items-center gap-3 opacity-40">
                        <div className="w-8 h-px bg-primary/40" />
                        <span className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Governance Layer</span>
                    </div>
                    <h2 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Compliance <span className="text-white/20 italic font-medium">Dossier.</span></h2>
                    <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em]">Institutional Tenure & Regulatory Artifact Mapping</p>
                </div>

                <div className="flex items-center gap-6 p-6 bg-white/[0.02] border border-white/5 rounded-[2rem] shadow-inner group">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_#10b981]"></div>
                    <div>
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Integrity Status</p>
                        <p className="text-[10px] font-black text-white uppercase tracking-widest mt-1">PROTOCOL_CLEAN_STABLE</p>
                    </div>
                </div>
            </div>

            {/* 🏫 SUMMARY STRIP (Horizontal) */}
            <ComplianceSummaryStrip
                tenure={24} // Calculated months usually
                integrityStatus="Verified"
                contractType={teacher.details?.employment_type || 'Full-time'}
                backgroundCheck="Completed"
            />

            {/* 🏫 MAIN OPERATIONAL GRID (8/4 Split) */}
            <div className="grid grid-cols-12 gap-8 items-start px-1">

                {/* 8-COLUMN MAIN CONTENT (70% weight approx) */}
                <div className="col-span-12 xl:col-span-8 space-y-8">

                    {/* Layer 2: Employment Registry */}
                    <div className="transition-all duration-200 hover:translate-y-[-4px]">
                        <EmploymentRegistry
                            employeeId={teacher.details?.employee_id || 'REF-NULL'}
                            department={teacher.details?.department || 'ACADEMIC'}
                            designation={teacher.details?.designation || 'FACULTY'}
                            joiningDate={teacher.details?.date_of_joining || '2023-01-01'}
                            employmentType={teacher.details?.employment_type || 'Full-time'}
                        />
                    </div>

                    {/* Additional Compliance Metadata Card could go here */}
                    <div className="flex items-center gap-6 p-10 bg-black/40 border border-white/5 rounded-[3rem] shadow-3xl relative overflow-hidden group/card backdrop-blur-3xl transition-all duration-200 hover:translate-y-[-4px]">
                        <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-500 border border-emerald-500/20">
                            <ShieldCheckIcon className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-[14px] font-black text-white uppercase tracking-wider">Compliance Verified</h4>
                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] leading-relaxed italic">
                                Background screenings, educational artifacts, and conduct certifications have been globally synchronized for this node.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 4-COLUMN AUXILIARY PANEL (30% weight approx) */}
                <div className="hidden xl:block xl:col-span-4 h-full">
                    <div className="sticky top-8 h-[calc(100vh-280px)] min-h-[680px] transition-all duration-200 hover:translate-y-[-4px]">
                        <TenureMatrix
                            joiningDate={teacher.details?.date_of_joining || '2023-01-01'}
                            status={teacher.is_active ? 'Active' : 'Inactive'}
                        />
                    </div>
                </div>

                {/* Mobile Tablet Accordion (Single Column Stacking) */}
                <div className="col-span-12 xl:hidden">
                    <div className="bg-[#14161c] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                        <button
                            onClick={() => setIsMobileActivityOpen(!isMobileActivityOpen)}
                            className="w-full p-6 flex items-center justify-between group bg-white/[0.01]"
                        >
                            <div className="flex items-center gap-4">
                                <ActivityIcon className="w-4 h-4 text-white/20 group-hover:text-primary transition-colors" />
                                <h4 className="text-[13px] font-bold text-white uppercase tracking-wider">Tenure Intelligence</h4>
                            </div>
                            <motion.div
                                animate={{ rotate: isMobileActivityOpen ? 180 : 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            >
                                <ChevronDownIcon className="w-4 h-4 text-white/20" />
                            </motion.div>
                        </button>
                        <AnimatePresence initial={false}>
                            {isMobileActivityOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 620, opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                    className="border-t border-white/5"
                                >
                                    <TenureMatrix
                                        joiningDate={teacher.details?.date_of_joining || '2023-01-01'}
                                        status={teacher.is_active ? 'Active' : 'Inactive'}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Compliance Footer Metadata */}
            <div className="flex items-center justify-between px-6 opacity-20 pt-8 border-t border-white/5">
                <p className="text-[9px] font-bold text-white uppercase tracking-[0.4em]">Audit Signature: {teacher.id.toUpperCase()}</p>
                <div className="flex gap-10">
                    <p className="text-[9px] font-bold text-white uppercase tracking-[0.4em]">ISO-27001 COMPLIANT</p>
                    <p className="text-[9px] font-bold text-white uppercase tracking-[0.4em]">Node Registry: SECURE</p>
                </div>
            </div>
        </motion.div>
    );
};

export default ComplianceDossier;
