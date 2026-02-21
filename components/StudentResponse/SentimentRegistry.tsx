import React from 'react';
import { motion } from 'framer-motion';
import { ActivityIcon } from '../icons/ActivityIcon';
import { HeartIcon } from '../icons/HeartIcon';
import { TargetIcon } from '../icons/TargetIcon';

interface SentimentEntry {
    id: string;
    student: string;
    class: string;
    type: 'positive' | 'neutral' | 'critical';
    content: string;
    timestamp: string;
}

const mockSentiments: SentimentEntry[] = [
    { id: '1', student: 'Aryan Sharma', class: 'Grade 10-A', type: 'positive', content: 'Complex concepts in Quantum Physics were made very clear today.', timestamp: '2h ago' },
    { id: '2', student: 'Ishita Kapoor', class: 'Grade 10-B', type: 'neutral', content: 'Requested more practice problems for the organic chemistry module.', timestamp: '5h ago' },
    { id: '3', student: 'Rohan Mehta', class: 'Grade 11-C', type: 'positive', content: 'Lab session was extremely helpful for project understanding.', timestamp: '1d ago' },
    { id: '4', student: 'Tanya Singh', class: 'Grade 10-A', type: 'critical', content: 'The pace during the last theorem derivation was a bit too fast.', timestamp: '2d ago' },
];

const SentimentRegistry: React.FC = () => {
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center px-4 mb-2">
                <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em]">Student Feedback</h3>
                <div className="flex gap-4">
                    <span className="text-[9px] font-bold text-white/10 uppercase tracking-widest flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Positive</span>
                    <span className="text-[9px] font-bold text-white/10 uppercase tracking-widest flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Critical</span>
                </div>
            </div>

            <div className="bg-[#14161c] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-sm">
                <div className="divide-y divide-white/[0.03]">
                    {mockSentiments.map((entry, idx) => (
                        <motion.div
                            key={entry.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className="p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6 group hover:bg-white/[0.01] transition-all"
                        >
                            <div className="flex-grow space-y-3">
                                <div className="flex items-center gap-3">
                                    <span className={`w-2 h-2 rounded-full ${entry.type === 'positive' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : entry.type === 'critical' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'bg-white/20'}`} />
                                    <p className="text-[11px] font-bold text-white/80 uppercase tracking-wider">{entry.student} <span className="text-white/20 ml-2 font-medium tracking-normal opacity-60">[{entry.class}]</span></p>
                                    <span className="ml-auto md:ml-0 text-[9px] font-bold text-white/10 uppercase tracking-widest">{entry.timestamp}</span>
                                </div>
                                <p className="text-[12px] font-medium text-white/40 leading-relaxed font-serif italic">"{entry.content}"</p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                                <button className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[9px] font-black text-white/40 uppercase tracking-widest transition-all">Acknowledge</button>
                                <button className="p-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl text-primary transition-all">
                                    <TargetIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>

                <div className="p-6 bg-white/[0.01] text-center border-t border-white/[0.03]">
                    <button className="text-[10px] font-black text-primary/40 uppercase tracking-[0.4em] hover:text-primary transition-colors">Load Extended Historical Data</button>
                </div>
            </div>
        </div>
    );
};

export default SentimentRegistry;
