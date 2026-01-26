import React, { useState, useEffect } from 'react';
import { supabase, formatError } from '../../services/supabase';
import { FeeStructure, SchoolClass } from '../../types';
import Spinner from '../common/Spinner';
import { XIcon } from '../icons/XIcon';
import { LinkIcon } from '../icons/LinkIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { AlertTriangleIcon } from '../icons/AlertTriangleIcon';
import { motion, AnimatePresence } from 'framer-motion';

interface AssignStructureModalProps {
    structure: FeeStructure;
    branchId: number | null;
    onClose: () => void;
    onSuccess: () => void;
}

const AssignStructureModal: React.FC<AssignStructureModalProps> = ({ structure, branchId, onClose, onSuccess }) => {
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    useEffect(() => {
        const fetchClasses = async () => {
            setLoading(true);
            try {
                // Fetch classes matching the target grade
                const { data, error } = await supabase
                    .from('school_classes')
                    .select('*')
                    .eq('grade_level', structure.target_grade)
                    .eq('branch_id', branchId || 0); // Simplified branch filter
                
                if (error) throw error;
                setClasses(data || []);
            } catch (err) {
                console.error("Class resolution fault:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchClasses();
    }, [structure.target_grade, branchId]);

    const handleAssign = async () => {
        if (!selectedClassId) return;
        setIsProcessing(true);
        setError(null);

        try {
            const { data, error } = await supabase.rpc('admin_assign_structure_to_class', {
                p_structure_id: structure.id,
                p_class_id: parseInt(selectedClassId)
            });

            if (error) throw error;
            
            if (data.success) {
                setSuccessMsg(data.message);
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 2200);
            } else {
                throw new Error(data.message);
            }
        } catch (err: any) {
            setError(formatError(err));
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[200] flex items-center justify-center p-4 animate-in fade-in duration-500" onClick={onClose}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-[#0c0d12] w-full max-w-xl rounded-[3.5rem] shadow-[0_80px_160px_-24px_rgba(0,0,0,1)] border border-white/10 flex flex-col overflow-hidden ring-1 ring-white/5" 
                onClick={e => e.stopPropagation()}
            >
                <AnimatePresence mode="wait">
                    {successMsg ? (
                        <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-20 text-center space-y-12">
                            <div className="relative inline-block">
                                <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full"></div>
                                <div className="relative w-32 h-32 bg-emerald-500/10 text-emerald-500 rounded-[3rem] flex items-center justify-center mx-auto border border-emerald-500/20 shadow-inner ring-8 ring-emerald-500/5">
                                    <CheckCircleIcon animate className="w-16 h-16"/>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-3xl font-serif font-black text-white uppercase tracking-tight leading-none">Nodes Linked.</h3>
                                <p className="text-white/40 font-serif italic text-lg leading-relaxed">{successMsg}</p>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="flex flex-col">
                            <header className="p-10 border-b border-white/5 bg-white/[0.02] flex justify-between items-center relative group">
                                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none opacity-40"></div>
                                <div className="flex items-center gap-6 relative z-10">
                                    <div className="p-4 bg-primary/10 rounded-2xl text-primary shadow-inner border border-primary/20">
                                        <LinkIcon className="w-8 h-8"/>
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-serif font-black text-white uppercase tracking-tight leading-none">Assign Module</h3>
                                        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em] mt-2">{structure.name}</p>
                                    </div>
                                </div>
                                <button type="button" onClick={onClose} className="p-3 rounded-full hover:bg-white/5 text-white/30 hover:text-white transition-all"><XIcon className="w-8 h-8"/></button>
                            </header>

                            <main className="p-10 space-y-10 overflow-y-auto flex-grow relative">
                                {error && (
                                    <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-3xl flex items-start gap-5 shadow-2xl animate-in shake">
                                        <AlertTriangleIcon className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                                        <p className="text-xs font-bold text-red-200/70 leading-relaxed uppercase tracking-wider">{error}</p>
                                    </div>
                                )}

                                <div className="space-y-6">
                                    <p className="text-sm text-white/40 leading-relaxed font-serif italic border-l-2 border-primary/20 pl-6">
                                        Binding this structure to a class will initialize financial ledgers for all enrolled students in the selected academic section.
                                    </p>

                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.4em] ml-1">Target Academic Node (Grade {structure.target_grade})</label>
                                        
                                        {loading ? (
                                            <div className="h-16 bg-white/[0.02] rounded-2xl animate-pulse border border-white/5" />
                                        ) : classes.length === 0 ? (
                                            <div className="p-8 text-center bg-white/[0.01] border-2 border-dashed border-white/5 rounded-2xl">
                                                <p className="text-xs font-black uppercase tracking-widest text-white/20">No matching class sections detected for this grade.</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-3">
                                                {classes.map(cls => (
                                                    <button 
                                                        key={cls.id}
                                                        onClick={() => setSelectedClassId(cls.id.toString())}
                                                        className={`flex items-center justify-between p-6 rounded-2xl border transition-all duration-300 ${
                                                            selectedClassId === cls.id.toString() 
                                                            ? 'bg-primary/10 border-primary/50 ring-1 ring-primary/20 shadow-2xl z-10' 
                                                            : 'bg-black/40 border-white/5 hover:bg-white/[0.03] hover:border-white/10'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black transition-colors ${selectedClassId === cls.id.toString() ? 'bg-primary text-white' : 'bg-white/5 text-white/20'}`}>
                                                                {cls.name.charAt(cls.name.length - 1)}
                                                            </div>
                                                            <div>
                                                                <p className={`font-bold text-base transition-colors ${selectedClassId === cls.id.toString() ? 'text-white' : 'text-white/40'}`}>{cls.name}</p>
                                                                <p className="text-[10px] font-black text-white/10 uppercase tracking-widest">{cls.academic_year}</p>
                                                            </div>
                                                        </div>
                                                        {selectedClassId === cls.id.toString() && <CheckCircleIcon className="w-5 h-5 text-primary animate-in zoom-in" />}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </main>

                            <footer className="p-10 border-t border-white/5 bg-black/40 flex flex-col md:flex-row justify-between items-center gap-8 relative z-30">
                                <button type="button" onClick={onClose} className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 hover:text-white transition-all order-2 md:order-1">Abort Procedure</button>
                                <button 
                                    onClick={handleAssign} 
                                    disabled={isProcessing || !selectedClassId} 
                                    className="w-full md:w-auto px-16 py-6 bg-primary text-primary-foreground font-black text-xs uppercase tracking-[0.5em] rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(var(--primary),0.5)] hover:bg-primary/90 transition-all transform active:scale-95 disabled:opacity-30 flex items-center justify-center gap-5 ring-8 ring-primary/5 group shadow-primary/20"
                                >
                                    {isProcessing ? <Spinner size="sm" className="text-white" /> : <><ShieldCheckIcon className="w-5 h-5 group-hover:rotate-12 transition-transform duration-500" /> Confirm Assignment</>}
                                </button>
                            </footer>
                        </div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default AssignStructureModal;