import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookIcon } from '../icons/BookIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { TeacherSubjectMapping } from '../../types';
import { GridIcon } from '../icons/GridIcon';
import { ClockIcon } from '../icons/ClockIcon';

interface AcademicControlPanelProps {
    mappings: TeacherSubjectMapping[];
    workloadHours: number;
    maxLoad: number;
    onAddMapping: () => void;
    onRemoveMapping: (id: number) => void;
}

const AcademicControlPanel: React.FC<AcademicControlPanelProps> = ({
    mappings,
    workloadHours,
    maxLoad,
    onAddMapping,
    onRemoveMapping
}) => {
    const loadPercentage = Math.min((workloadHours / maxLoad) * 100, 100);
    const hasOverload = workloadHours > maxLoad;

    return (
        <div className="space-y-10">
            {/* Contextual Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-3 opacity-40">
                        <div className="w-8 h-0.5 bg-primary"></div>
                        <span className="text-[10px] font-black text-white uppercase tracking-[0.5em]">Academic Control</span>
                    </div>
                    <h3 className="text-3xl font-serif font-black text-white uppercase tracking-tighter italic">Operational Core.</h3>
                </div>
                <motion.button
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onAddMapping}
                    className="flex items-center gap-4 px-8 py-5 bg-[#7c4dff] text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-2xl shadow-[0_20px_40px_-10px_rgba(124,77,255,0.3)] hover:shadow-[0_25px_50px_-10px_rgba(124,77,255,0.4)] transition-all"
                >
                    <PlusIcon className="w-5 h-5" /> Initialize Mapping
                </motion.button>
            </div>

            {/* Load Matrix Card */}
            <div className="p-10 bg-white/[0.01] border border-white/5 rounded-[3rem] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-10 opacity-[0.02] group-hover:scale-110 transition-transform duration-[3s] pointer-events-none">
                    <BookIcon className="w-48 h-48" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
                    <div className="space-y-8">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-white/30 uppercase tracking-[0.4em]">Stewardship Capacity</span>
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${hasOverload ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-emerald-500 shadow-[0_0_10px_#10b981]'}`} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${hasOverload ? 'text-red-500' : 'text-emerald-500'}`}>
                                    {hasOverload ? 'Critical Saturation' : 'Balanced Load'}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="h-6 bg-white/[0.03] rounded-full overflow-hidden p-1.5 border border-white/5 shadow-inner">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${loadPercentage}%` }}
                                    className={`h-full rounded-full ${hasOverload ? 'bg-gradient-to-r from-red-600 to-red-400' : 'bg-gradient-to-r from-primary to-indigo-400'} shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]`}
                                />
                            </div>
                            <div className="flex justify-between items-baseline px-2">
                                <h5 className="text-5xl font-serif font-black text-white">
                                    {workloadHours} <span className="text-2xl text-white/10 ml-2 font-sans font-medium tracking-normal">/ {maxLoad}</span>
                                    <span className="text-[11px] font-black text-white/20 uppercase tracking-[0.3em] ml-6">Accumulated Node Hours</span>
                                </h5>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className={`p-8 rounded-[2.5rem] border transition-all ${hasOverload ? 'bg-red-500/[0.03] border-red-500/20' : 'bg-emerald-500/[0.03] border-emerald-500/20'}`}>
                            <div className="space-y-4">
                                <AlertTriangleIcon className={`w-6 h-6 ${hasOverload ? 'text-red-500' : 'text-emerald-500'}`} />
                                <div>
                                    <p className="text-[11px] font-black text-white uppercase tracking-widest mb-1">Risk Profile</p>
                                    <p className="text-[10px] text-white/30 uppercase leading-relaxed font-bold tracking-widest">
                                        {hasOverload ? 'Burnout risk detected. Reallocation protocol advised.' : 'Node operating within institutional safety margins.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-8 bg-primary/[0.03] border border-primary/20 rounded-[2.5rem]">
                            <div className="space-y-4">
                                <GridIcon className="w-6 h-6 text-primary" />
                                <div>
                                    <p className="text-[11px] font-black text-white uppercase tracking-widest mb-1">Distribution</p>
                                    <p className="text-[10px] text-white/30 uppercase leading-relaxed font-bold tracking-widest">
                                        Subjects mapped across {mappings.length} unique academic sectors.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mapping Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <AnimatePresence mode="popLayout">
                    {mappings.length === 0 ? (
                        <div className="col-span-full py-48 flex flex-col items-center justify-center space-y-10 bg-white/[0.01] rounded-[4rem] border-2 border-dashed border-white/5 relative overflow-hidden group/empty">
                            <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent opacity-0 group-hover/empty:opacity-100 transition-opacity duration-700" />
                            <div className="p-12 rounded-[3.5rem] bg-white/[0.03] border border-white/10 text-white/5 shadow-2xl group-hover/empty:scale-110 group-hover/empty:rotate-6 transition-all duration-1000">
                                <BookIcon className="w-20 h-20" />
                            </div>
                            <div className="text-center space-y-4 relative z-10">
                                <h4 className="text-2xl font-serif font-black text-white/30 uppercase tracking-tighter italic">No Academic Records Initialized</h4>
                                <p className="text-[11px] font-black text-white/20 uppercase tracking-[0.4em] max-w-sm leading-relaxed mx-auto">
                                    Mapping subjects enables biometric attendance tracking, workload telemetry, and stewardship scores.
                                </p>
                            </div>
                            <div className="flex gap-6 relative z-10">
                                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onAddMapping} className="px-10 py-5 bg-primary text-white font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl shadow-3xl shadow-primary/20">Initialize First Map</motion.button>
                                <button className="px-10 py-5 bg-white/5 text-white/40 font-black text-[11px] uppercase tracking-[0.3em] rounded-2xl hover:bg-white/10 transition-all border border-white/5">Protocol Guidelines</button>
                            </div>
                        </div>
                    ) : (
                        mappings.map((map, i) => (
                            <motion.div
                                key={map.id}
                                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: i * 0.05 }}
                                className="p-10 bg-[#12141c] border border-white/5 rounded-[3.5rem] flex items-center justify-between group hover:border-primary/40 transition-all shadow-3xl relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="flex items-center gap-8 relative z-10">
                                    <div className="w-20 h-20 rounded-[2.5rem] bg-gradient-to-br from-white/5 to-white/[0.01] border border-white/10 flex flex-col items-center justify-center shadow-inner group-hover:bg-primary/10 group-hover:border-primary/30 transition-all duration-700">
                                        <span className="text-[9px] font-black text-white/20 uppercase tracking-tighter leading-none mb-1">GRD</span>
                                        <span className="text-3xl font-serif italic text-white leading-none">
                                            {map.class_name?.match(/\d+/)?.[0] || 'X'}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        <h5 className="font-serif font-black text-white text-2xl tracking-tighter uppercase group-hover:text-primary transition-colors duration-500 truncate max-w-[200px]">{map.subject_name}</h5>
                                        <div className="flex items-center gap-5">
                                            <div className="flex items-center gap-2.5">
                                                <GridIcon className="w-4 h-4 text-primary opacity-30" />
                                                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{map.class_name}</span>
                                            </div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-white/5" />
                                            <div className="flex items-center gap-2.5">
                                                <ClockIcon className="w-4 h-4 text-white/20" />
                                                <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">{map.credits || 4} Node_Hrs</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onRemoveMapping(map.id)}
                                    className="p-5 rounded-2xl bg-white/[0.02] text-white/10 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 translate-x-10 group-hover:translate-x-0 duration-500 border border-transparent hover:border-red-500/20"
                                >
                                    <TrashIcon className="w-6 h-6" />
                                </button>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default AcademicControlPanel;
