import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivityIcon } from '../icons/ActivityIcon';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { ClockIcon } from '../icons/ClockIcon';

interface TimelineEvent {
    id: string;
    type: 'academic' | 'compliance' | 'admin' | 'system';
    title: string;
    description: string;
    timestamp: string;
    status: string;
}

const mockTimeline: TimelineEvent[] = [
    { id: '1', type: 'academic', title: 'Academic Registry Recalibrated', description: 'Grade 12_C subject mapping finalized and synchronized with primary core.', timestamp: '12m ago', status: 'SYNCHRONIZED' },
    { id: '2', type: 'compliance', title: 'Governance Artifact Verified', description: 'Institutional contract renewal documents verified by Central HR Authority.', timestamp: '4h ago', status: 'VERIFIED' },
    { id: '3', type: 'admin', title: 'Node Security Reset', description: 'Teacher portal password recalibrated via Administrative Terminal Alpha-4.', timestamp: '6h ago', status: 'SECURED' },
    { id: '4', type: 'system', title: 'Syllabus Milestone Logged', description: 'Advanced Physics Module-3 completion detected and logged for evaluative scoring.', timestamp: 'Yesterday', status: 'MILESTONE' },
    { id: '5', type: 'academic', title: 'Biometric Access Logged', description: 'Successful authentication at Campus Alpha Sector-2.', timestamp: 'Yesterday', status: 'LOGGED' }
];

const ActivityTimeline: React.FC = () => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="bg-[#0b0c10] border border-white/5 rounded-[4rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-12 flex items-center justify-between group transition-all"
            >
                <div className="flex items-center gap-10">
                    <div className="p-5 rounded-2xl bg-white/[0.02] text-white/10 group-hover:text-primary group-hover:bg-primary/10 transition-all border border-white/5 group-hover:border-primary/20 shadow-inner">
                        <ActivityIcon className="w-8 h-8" />
                    </div>
                    <div className="text-left space-y-2">
                        <div className="flex items-center gap-4 opacity-40">
                            <div className="w-8 h-0.5 bg-primary"></div>
                            <span className="text-[10px] font-black text-white uppercase tracking-[0.5em]">Activity Telemetry</span>
                        </div>
                        <h4 className="text-2xl font-serif font-black text-white uppercase tracking-tighter italic mt-1">Integrated Activity Stream.</h4>
                    </div>
                </div>
                <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ type: 'spring', damping: 20 }}
                >
                    <ChevronDownIcon className="w-8 h-8 text-white/20 group-hover:text-white transition-colors" />
                </motion.div>
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.5, ease: [0.04, 0.62, 0.23, 0.98] }}
                    >
                        <div className="px-12 pb-14 space-y-12">
                            {mockTimeline.map((event, i) => (
                                <div key={event.id} className="flex gap-10 group/item relative">
                                    {i !== mockTimeline.length - 1 && (
                                        <div className="absolute left-[29px] top-12 w-px h-[calc(100%+12px)] bg-white/5 group-hover/item:bg-white/10 transition-colors" />
                                    )}

                                    <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-white/20 group-hover/item:border-primary/40 group-hover/item:text-primary transition-all shrink-0 shadow-inner relative z-10">
                                        <ClockIcon className="w-6 h-6" />
                                    </div>

                                    <div className="flex-grow space-y-3 pt-1">
                                        <div className="flex justify-between items-center">
                                            <h5 className="text-sm font-black text-white uppercase tracking-widest leading-none translate-y-0.5">{event.title}</h5>
                                            <span className="text-[10px] font-black text-white/10 uppercase tracking-widest">{event.timestamp}</span>
                                        </div>
                                        <p className="text-[11px] text-white/30 uppercase tracking-[0.05em] leading-relaxed font-bold max-w-3xl">
                                            {event.description}
                                        </p>
                                        <div className="flex gap-4 pt-3">
                                            <span className="px-4 py-1.5 bg-black/40 border border-white/5 rounded-xl text-[9px] font-black text-white/10 uppercase tracking-[0.2em] shadow-inner">
                                                {event.status}
                                            </span>
                                            <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border shadow-2xl ${event.type === 'academic' ? 'bg-primary/5 text-primary border-primary/20' :
                                                    event.type === 'compliance' ? 'bg-emerald-500/5 text-emerald-500 border-emerald-500/20' :
                                                        event.type === 'admin' ? 'bg-amber-500/5 text-amber-500 border-amber-500/20' :
                                                            'bg-violet-500/5 text-violet-400 border-violet-500/20'
                                                }`}>
                                                {event.type}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ActivityTimeline;
