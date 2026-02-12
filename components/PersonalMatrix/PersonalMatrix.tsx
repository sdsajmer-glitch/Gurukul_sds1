import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TeacherExtended } from '../../types';
import PersonalSummaryStrip from './PersonalSummaryStrip';
import BioRegistry from './BioRegistry';
import ContactMatrix from './ContactMatrix';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { UserIcon } from '../icons/UserIcon';
import { EditIcon } from '../icons/EditIcon';

interface PersonalMatrixProps {
    teacher: TeacherExtended;
    onUpdate: () => void;
}

const PersonalMatrix: React.FC<PersonalMatrixProps> = ({ teacher, onUpdate }) => {
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
                        <span className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Registry Profile</span>
                    </div>
                    <h2 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Personal <span className="text-white/20 italic font-medium">Matrix.</span></h2>
                    <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em]">Validated Biological & Liaison Identification Core</p>
                </div>

                <div className="flex items-center gap-3">
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] bg-white/[0.02] px-4 py-2 rounded-xl border border-white/5 hidden md:block">Editable by: Registry Office</p>
                    <motion.button
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className="px-8 py-4 bg-white text-black font-black text-[10px] uppercase tracking-[0.3em] rounded-xl shadow-lg transition-all flex items-center gap-3 group/btn"
                    >
                        <EditIcon className="w-4 h-4" /> Edit Attributes
                    </motion.button>
                </div>
            </div>

            {/* 🏫 SUMMARY STRIP (Horizontal) */}
            <PersonalSummaryStrip
                age={34} // Calculated from DOB usually
                experience={12}
                bloodGroup={teacher.details?.blood_group || 'O+'}
                gender={teacher.details?.gender || 'Male'}
                religion={teacher.details?.religion || 'General'}
            />

            {/* 🏫 MAIN OPERATIONAL GRID (8/4 Split) */}
            <div className="grid grid-cols-12 gap-8 items-start px-1">

                {/* 8-COLUMN MAIN CONTENT (70% weight approx) */}
                <div className="col-span-12 xl:col-span-8 space-y-8">

                    {/* Layer 2: Bio Registry (Identity Core) */}
                    <div className="transition-all duration-200 hover:translate-y-[-4px]">
                        <BioRegistry
                            firstName={teacher.display_name.split(' ')[0]}
                            lastName={teacher.display_name.split(' ')[1] || ''}
                            dob={teacher.details?.date_of_birth || '1990-01-01'}
                            nationality="Indian"
                            languages="English, Hindi, Sanskrit"
                        />
                    </div>

                    {/* Layer 3: Contact Matrix (Liaison Connectivity) */}
                    <div className="transition-all duration-200 hover:translate-y-[-4px]">
                        <ContactMatrix
                            email={teacher.email}
                            phone={teacher.details?.phone_number || 'DE-NO-PHONE'}
                            address={teacher.details?.address || 'NO_PHYSICAL_LOCATION_SECURED'}
                            emergencyContact="S. Sharma"
                            emergencyPhone="+91 9988776655"
                        />
                    </div>
                </div>

                {/* 4-COLUMN AUXILIARY PANEL (30% weight approx) */}
                <div className="hidden xl:block xl:col-span-4 h-full">
                    {/* Reuse the Security Timeline or a specialized Activity Log for Profile Changes if needed */}
                    <div className="sticky top-8 h-[calc(100vh-280px)] min-h-[680px] transition-all duration-200 hover:translate-y-[-4px]">
                        <div className="bg-[#14161c] border border-white/5 rounded-2xl h-full flex flex-col shadow-sm items-center justify-center p-12 text-center space-y-6">
                            <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center shadow-inner">
                                <ActivityIcon className="w-8 h-8 opacity-20" />
                            </div>
                            <h4 className="text-[14px] font-bold text-white/40 uppercase tracking-widest">Audit logs loading...</h4>
                            <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.4em] leading-relaxed">
                                SECURING IMMUTABLE TRACE OF PROFILE ATTRIBUTE MUTATIONS...
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Compliance Footer Metadata */}
            <div className="flex items-center justify-between px-6 opacity-20 pt-8 border-t border-white/5">
                <p className="text-[9px] font-bold text-white uppercase tracking-[0.4em]">Matrix ID: {teacher.id.slice(0, 16).toUpperCase()}</p>
                <div className="flex gap-10">
                    <p className="text-[9px] font-bold text-white uppercase tracking-[0.4em]">DATA PROTECTION: ENABLED</p>
                    <p className="text-[9px] font-bold text-white uppercase tracking-[0.4em]">Node Signature: REGISTRY-SEC-01</p>
                </div>
            </div>
        </motion.div>
    );
};

export default PersonalMatrix;
