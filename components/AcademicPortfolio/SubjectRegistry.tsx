import React from 'react';
import { motion } from 'framer-motion';
import { TeacherSubjectMapping } from '../../types';
import { BookIcon } from '../icons/BookIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { GridIcon } from '../icons/GridIcon';
import { TrashIcon } from '../icons/TrashIcon';

interface SubjectRegistryProps {
    mappings: TeacherSubjectMapping[];
    loading: boolean;
    onUnmap: (mappingId: number, subjectName: string, className: string) => void;
}

const SubjectRegistry: React.FC<SubjectRegistryProps> = ({ mappings, loading, onUnmap }) => {
    if (loading) {
        return (
            <div className="py-24 flex flex-col items-center justify-center space-y-6">
                <div className="w-12 h-12 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] animate-pulse">Synchronizing Subject Registries...</p>
            </div>
        );
    }

    if (mappings.length === 0) {
        return (
            <div className="p-20 border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.01] flex flex-col items-center group/empty transition-all duration-700">
                <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                    <BookIcon className="w-8 h-8 opacity-10" />
                </div>
                <h4 className="text-xl font-serif font-black text-white/40 uppercase tracking-tighter mb-2">Registry Void</h4>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/10 text-center max-w-xs">
                    No active subject mappings detected for this faculty node.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mappings.map((map, idx) => (
                <motion.div
                    key={map.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-8 bg-[#14161c] border border-white/5 rounded-[2.5rem] shadow-sm hover:border-primary/40 transition-all group relative overflow-hidden"
                >
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center font-black group-hover:scale-105 transition-transform duration-500">
                            <span className="text-[9px] uppercase opacity-40 leading-none mb-1">GRD</span>
                            <span className="text-2xl font-serif italic text-white leading-none">{map.class_name?.match(/\d+/)?.[0] || '--'}</span>
                        </div>

                        <div className="flex-grow min-w-0">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-serif font-black text-white text-lg tracking-tighter uppercase truncate group-hover:text-primary transition-colors">{map.subject_name}</h4>
                                <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-md bg-white/5 text-white/30 border border-white/5 tracking-widest">{map.category || 'CORE'}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <GridIcon className="w-3.5 h-3.5 text-primary/40" />
                                    <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">{map.class_name}</p>
                                </div>
                                <div className="w-1 h-1 rounded-full bg-white/5" />
                                <div className="flex items-center gap-2">
                                    <ClockIcon className="w-3.5 h-3.5 text-white/20" />
                                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">{map.credits || 4} Node_Hrs</p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => onUnmap(map.id, map.subject_name || '', map.class_name || '')}
                            className="p-3 rounded-xl text-white/10 hover:text-red-500 hover:bg-red-500/5 transition-all opacity-0 group-hover:opacity-100"
                        >
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};

export default SubjectRegistry;
