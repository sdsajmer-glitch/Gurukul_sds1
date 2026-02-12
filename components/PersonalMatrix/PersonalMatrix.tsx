import React from 'react';
import { motion } from 'framer-motion';
import { TeacherExtended } from '../../types';
import PersonalIdentityHeader from './PersonalIdentityHeader';
import PersonalKPIStrip from './PersonalKPIStrip';
import BiologicalRegistry from './BiologicalRegistry';
import LiaisonConnectivity from './LiaisonConnectivity';
import GovernanceSnapshot from './GovernanceSnapshot';

interface PersonalMatrixProps {
    teacher: TeacherExtended;
    onUpdate: () => void;
}

const PersonalMatrix: React.FC<PersonalMatrixProps> = ({ teacher, onUpdate }) => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-[1440px] mx-auto space-y-8 pb-32"
        >
            {/* 🌑 LAYER 1: IDENTITY HEADER */}
            <PersonalIdentityHeader
                name={teacher.display_name}
                facultyCode={teacher.employee_id || `FAC-${teacher.id.slice(0, 4)}`}
                status={teacher.is_active ? 'Active Node' : 'Suspended'}
                avatarUrl={teacher.details?.profile_picture_url}
            />

            {/* 🌑 LAYER 2: KPI INTELLIGENCE STRIP */}
            <PersonalKPIStrip
                age={34}
                tenure={12}
                role={teacher.details?.subject || 'Lead Faculty'}
                authority="Admin Master"
            />

            {/* 🌑 LAYER 3 & 4: MAIN CONTENT GRID (12 Cols) */}
            <div className="grid grid-cols-12 gap-8 items-start">

                {/* 🏫 MAIN CONTENT (8 Cols - 60% approx) */}
                <div className="col-span-12 xl:col-span-8 space-y-8">

                    {/* Biological Registry Card */}
                    <div className="transition-all duration-300 hover:translate-y-[-4px]">
                        <BiologicalRegistry
                            firstName={teacher.display_name.split(' ')[0]}
                            lastName={teacher.display_name.split(' ')[1] || ''}
                            dob={teacher.details?.date_of_birth || '1990-01-01'}
                            nationality="Indian"
                            languages="English, Hindi, Sanskrit"
                            gender={teacher.details?.gender || 'Male'}
                            bloodGroup={teacher.details?.blood_group || 'O+'}
                            religion={teacher.details?.religion || 'General'}
                        />
                    </div>

                    {/* Liaison Connectivity Card */}
                    <div className="transition-all duration-300 hover:translate-y-[-4px]">
                        <LiaisonConnectivity
                            email={teacher.email}
                            phone={teacher.details?.phone_number || 'DE-NO-PHONE'}
                            address={teacher.details?.address || 'NO_PHYSICAL_LOCATION_SECURED'}
                            emergencyContact="S. Sharma"
                            emergencyPhone="+91 9988776655"
                            prefCommunication="Direct Mail"
                        />
                    </div>
                </div>

                {/* 🏫 SECONDARY PANEL (4 Cols - 40% approx) */}
                <div className="col-span-12 xl:col-span-4 h-full">
                    <div className="sticky top-8 space-y-8">
                        <div className="transition-all duration-300 hover:translate-y-[-4px]">
                            <GovernanceSnapshot
                                lastModified="Today, 14:20"
                                complianceStatus="CleanNode"
                                securityLevel="Tier-1 Alpha"
                                attendanceTrend="98.5% Stable"
                            />
                        </div>

                        {/* Additional Info / Institutional Notes */}
                        <div className="p-8 bg-primary/[0.02] border border-primary/10 rounded-2xl space-y-4">
                            <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Institutional Notes</h4>
                            <p className="text-[11px] font-medium text-white/30 leading-relaxed italic">
                                "Subject node exhibits exceptional pedagogical stability and consistent institutional contribution across multi-department grids."
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 🌑 COMPLIANCE FOOTER */}
            <div className="flex flex-col md:flex-row items-center justify-between px-6 pt-10 border-t border-white/5 gap-6 opacity-30 group">
                <div className="flex items-center gap-6">
                    <p className="text-[9px] font-bold text-white uppercase tracking-[0.5em]">Global Matrix ID: {teacher.id.split('-')[0].toUpperCase()}-NX-01</p>
                    <div className="w-px h-4 bg-white/10 hidden md:block" />
                    <p className="text-[9px] font-bold text-white uppercase tracking-[0.5em]">Data Policy: GDPR-SEC-ALPHA</p>
                </div>
                <div className="flex gap-10">
                    <p className="text-[9px] font-bold text-white uppercase tracking-[0.5em]">Security Signature: {teacher.id.slice(0, 8).toUpperCase()}</p>
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                        <p className="text-[9px] font-bold text-white uppercase tracking-[0.5em]">Synchronized</p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default PersonalMatrix;
