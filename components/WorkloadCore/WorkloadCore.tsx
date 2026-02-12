import React from 'react';
import { motion } from 'framer-motion';
import { TeacherExtended } from '../../types';
import WorkloadHeader from './WorkloadHeader';
import WorkloadKPIStrip from './WorkloadKPIStrip';
import SaturationAnalysis from './SaturationAnalysis';
import ImpactRegistry from './ImpactRegistry';
import StrategicCommand from './StrategicCommand';

interface WorkloadCoreProps {
    teacher: TeacherExtended;
    workloadHours: number;
    maxLoad: number;
}

const WorkloadCore: React.FC<WorkloadCoreProps> = ({
    teacher,
    workloadHours,
    maxLoad
}) => {
    const utilization = (workloadHours / maxLoad) * 100;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-[1440px] mx-auto space-y-8 pb-32"
        >
            {/* 🌑 LAYER 1: WORKLOAD IDENTITY HEADER */}
            <WorkloadHeader utilization={utilization} />

            {/* 🌑 LAYER 2: KPI INTELLIGENCE STRIP */}
            <WorkloadKPIStrip
                totalHours={workloadHours}
                maxCapacity={maxLoad}
                utilization={utilization}
                cohortReach={workloadHours * 28}
            />

            {/* 🌑 LAYER 3 & 4: MAIN OPERATIONAL GRID (12 Cols) */}
            <div className="grid grid-cols-12 gap-8 items-start">

                {/* 🏫 MAIN CONTENT (8 Cols - 66% approx) */}
                <div className="col-span-12 xl:col-span-8 space-y-8">

                    {/* Layer 3: Saturation Analysis Card */}
                    <div className="transition-all duration-300 hover:translate-y-[-4px]">
                        <SaturationAnalysis hours={workloadHours} max={maxLoad} />
                    </div>

                    {/* Layer 4: Impact Registry Grid */}
                    <div className="transition-all duration-300 hover:translate-y-[-4px]">
                        <ImpactRegistry />
                    </div>
                </div>

                {/* 🏫 SECONDARY STRATEGIC PANEL (4 Cols - 33% approx) */}
                <div className="col-span-12 xl:col-span-4 h-full">
                    <div className="sticky top-8">
                        <StrategicCommand />
                    </div>
                </div>
            </div>

            {/* 🌑 COMPLIANCE FOOTER */}
            <div className="flex flex-col md:flex-row items-center justify-between px-6 pt-10 border-t border-white/5 gap-6 opacity-30 group">
                <div className="flex items-center gap-6">
                    <p className="text-[9px] font-bold text-white uppercase tracking-[0.5em]">Global Workload ID: {teacher.id.split('-')[0].toUpperCase()}-WLC-88</p>
                    <div className="w-px h-4 bg-white/10 hidden md:block" />
                    <p className="text-[9px] font-bold text-white uppercase tracking-[0.5em]">Policy: ACADEMIC-LOAD-V2</p>
                </div>
                <div className="flex gap-10">
                    <p className="text-[9px] font-bold text-white uppercase tracking-[0.5em]">Audit Hash: {Math.random().toString(36).substring(7).toUpperCase()}</p>
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                        <p className="text-[9px] font-bold text-white uppercase tracking-[0.5em]">Telemetry: ACTIVE</p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default WorkloadCore;
