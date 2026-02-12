import React from 'react';
import { motion } from 'framer-motion';
import { ClockIcon } from '../icons/ClockIcon';
import { BookIcon } from '../icons/BookIcon';

interface ScheduleEntry {
    id: string;
    time: string;
    duration: string;
    subject: string;
    class: string;
    location: string;
    status: 'completed' | 'ongoing' | 'upcoming';
}

const mockSchedule: ScheduleEntry[] = [
    { id: '1', time: '08:30 AM', duration: '50m', subject: 'Advanced Physics', class: 'Grade 10-A', location: 'Lab Sector 4', status: 'completed' },
    { id: '2', time: '09:30 AM', duration: '50m', subject: 'Thermodynamics', class: 'Grade 12-B', location: 'Lecture Hall 2', status: 'completed' },
    { id: '3', time: '10:45 AM', duration: '50m', subject: 'Quantum Mechanics', class: 'Grade 11-A', location: 'Lab Sector 4', status: 'ongoing' },
    { id: '4', time: '11:45 AM', duration: '50m', subject: 'Recess / Administrative', class: 'N/A', location: 'Faculty Lounge', status: 'upcoming' },
    { id: '5', time: '12:45 PM', duration: '50m', subject: 'Atomic Theory', class: 'Grade 10-C', location: 'Classroom 302', status: 'upcoming' },
];

const OperationalGrid: React.FC = () => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center px-4">
                <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em]">Operational Schedule [Today]</h3>
                <div className="px-4 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[9px] font-bold text-white/40 uppercase tracking-widest">
                    UTC +5:30 Grid
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {mockSchedule.map((slot, idx) => (
                    <motion.div
                        key={slot.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`p-6 bg-[#14161c] border rounded-3xl transition-all relative overflow-hidden group ${slot.status === 'ongoing' ? 'border-primary/40 bg-primary/[0.02] shadow-lg shadow-primary/5' : 'border-white/5'}`}
                    >
                        {slot.status === 'ongoing' && (
                            <div className="absolute top-0 right-0 p-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                                    <span className="text-[9px] font-black text-primary uppercase tracking-widest">Active Node</span>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col md:flex-row md:items-center gap-6 relative z-10">
                            {/* Time Block */}
                            <div className="flex items-center gap-6 shrink-0 md:w-48">
                                <div className={`p-3 rounded-xl ${slot.status === 'completed' ? 'bg-white/5 text-white/20' : slot.status === 'ongoing' ? 'bg-primary/20 text-primary shadow-inner' : 'bg-white/5 text-white/40'}`}>
                                    <ClockIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className={`text-[13px] font-bold tracking-tight ${slot.status === 'completed' ? 'text-white/20 line-through' : 'text-white/80'}`}>{slot.time}</p>
                                    <p className="text-[9px] font-black text-white/10 uppercase tracking-widest">{slot.duration}</p>
                                </div>
                            </div>

                            {/* Subject & Class */}
                            <div className="flex-grow">
                                <div className="flex items-center gap-3 mb-1">
                                    <h4 className={`text-lg font-serif font-black tracking-tighter uppercase ${slot.status === 'completed' ? 'text-white/20' : 'text-white'}`}>{slot.subject}</h4>
                                    {slot.class !== 'N/A' && (
                                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md border tracking-widest ${slot.status === 'completed' ? 'border-white/5 text-white/10' : 'border-primary/20 text-primary/60 bg-primary/5'}`}>{slot.class}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-white/20">
                                    <div className="flex items-center gap-1.5">
                                        <BookIcon className="w-3 h-3" />
                                        <span>{slot.location}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-4 shrink-0 md:ml-auto">
                                {slot.status === 'ongoing' ? (
                                    <button className="px-6 py-2.5 bg-primary text-white text-[9px] font-black uppercase tracking-widest rounded-xl shadow-xl shadow-primary/20 hover:scale-105 transition-all">Launch Registry</button>
                                ) : slot.status === 'upcoming' ? (
                                    <button className="px-6 py-2.5 bg-white/5 border border-white/5 text-white/40 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all">Prepare Materials</button>
                                ) : (
                                    <span className="text-[9px] font-black text-emerald-500/40 uppercase tracking-[0.3em]">SESSION_ARCHIVED</span>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default OperationalGrid;
