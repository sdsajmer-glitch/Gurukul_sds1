import React from 'react';
import { motion } from 'framer-motion';
import { TeacherExtended } from '../../types';
import WorkloadHeader from './WorkloadHeader';
import SaturationOverview from './SaturationOverview';
import WorkloadKPIGrid from './WorkloadKPIGrid';
import WorkloadTrendAnalysis from './WorkloadTrendAnalysis';
import InsightsPanel from './InsightsPanel';

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
            className="w-full max-w-[1440px] mx-auto pb-32 flex flex-col gap-6"
        >
            {/* 🌑 LAYER 1: SECTION HEADER */}
            <WorkloadHeader />

            {/* MAIN OPERATIONAL GRID (12 Cols) */}
            <div className="grid grid-cols-12 gap-6 items-start">

                {/* 🏫 MAIN WORKLOAD AREA (8 Cols - 70%) */}
                <div className="col-span-12 xl:col-span-8 flex flex-col gap-6">

                    {/* 🌑 LAYER 2: NODE SATURATION OVERVIEW */}
                    <SaturationOverview
                        hours={workloadHours}
                        max={maxLoad}
                        units={12}      // Mocked for redesign
                        sections={4}    // Mocked for redesign
                    />

                    {/* 🌑 LAYER 3: KPI INTELLIGENCE GRID */}
                    <WorkloadKPIGrid
                        departments={4}
                        hours={workloadHours}
                        utilization={utilization}
                    />

                    {/* 🌑 LAYER 4: TREND ANALYSIS */}
                    <WorkloadTrendAnalysis />
                </div>

                {/* 🏫 INSIGHTS PANEL (4 Cols - 30%) */}
                <div className="col-span-12 xl:col-span-4 h-full">
                    <div className="sticky top-[100px]">
                        <InsightsPanel />
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
