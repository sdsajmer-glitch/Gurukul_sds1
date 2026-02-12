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
                                <div className="absolute inset-0 bg-emerald-500/20 blur-[100px] rounded-full"></div>
                                <div className="relative w-40 h-40 bg-emerald-500/10 text-emerald-500 rounded-[3rem] flex items-center justify-center mx-auto border border-emerald-500/20 shadow-inner ring-[12px] ring-emerald-500/5">
                                    <CheckCircleIcon className="w-20 h-20" />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-4xl font-serif font-black text-white uppercase tracking-tighter leading-none">Nodes Synchronized</h3>
                                <p className="text-white/30 text-sm font-medium tracking-wide">Protocol distribution complete for the target academic sections.</p>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="flex flex-col">
                            <header className="p-12 border-b border-white/[0.04] bg-white/[0.01] backdrop-blur-3xl flex justify-between items-center relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] to-transparent"></div>
                                <div className="flex items-center gap-8 relative z-10">
                                    <div className="p-5 bg-primary/10 rounded-[1.5rem] text-primary shadow-2xl border border-primary/20 group-hover:rotate-12 transition-all duration-700 ring-2 ring-primary/5">
                                        <LinkIcon className="w-8 h-8" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <h3 className="text-3xl font-serif font-black text-white uppercase tracking-tighter leading-none">Distribution Nexus</h3>
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">{structure.name}</p>
                                        </div>
                                    </div>
                                </div>
                                <button type="button" onClick={onClose} className="p-4 rounded-2xl hover:bg-white/5 text-white/20 hover:text-white transition-all border border-transparent hover:border-white/10 group/close"><XIcon className="w-6 h-6 group-hover/close:rotate-90 transition-transform duration-300 opacity-40" /></button>
                            </header>

                            <main className="p-12 space-y-12 overflow-y-auto flex-grow relative bg-transparent">
                                {error && (
                                    <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-[2.5rem] flex flex-col gap-4 shadow-2xl animate-in shake relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent"></div>
                                        <div className="flex items-center gap-4 relative z-10">
                                            <AlertTriangleIcon className="w-6 h-6 text-red-500 shrink-0" />
                                            <p className="text-[10px] font-black uppercase text-red-500 tracking-[0.4em]">Registry Desync Violation</p>
                                        </div>
                                        <p className="text-sm font-medium text-red-400 leading-relaxed uppercase tracking-tight relative z-10">{error}</p>
                                    </div>
                                )}

                                <div className="space-y-8">
                                    <div className="p-10 bg-white/[0.02] rounded-[3rem] border border-white/5 shadow-inner relative overflow-hidden group">
                                        <div className="absolute inset-y-0 left-0 w-1 bg-primary/30 group-hover:bg-primary transition-colors"></div>
                                        <p className="text-lg text-white/50 leading-relaxed font-serif italic relative z-10">
                                            Binding this financial protocol to a class node will initialize temporal ledgers for all authorized student entities within the selected sector.
                                        </p>
                                    </div>

                                    <div className="space-y-6">
                                        <label className="text-[10px] font-black uppercase text-white/20 tracking-[0.5em] ml-2">Target Registry Segments (Grade {structure.target_grade})</label>

                                        {loading ? (
                                            <div className="grid grid-cols-1 gap-4">
                                                {[1, 2].map(i => <div key={i} className="h-28 bg-white/[0.02] rounded-[2rem] animate-pulse border border-white/5" />)}
                                            </div>
                                        ) : classes.length === 0 ? (
                                            <div className="p-20 text-center bg-white/[0.01] border-2 border-dashed border-white/5 rounded-[3rem] group">
                                                <div className="p-6 bg-white/[0.02] rounded-full inline-block mb-6 group-hover:scale-110 transition-transform">
                                                    <AlertTriangleIcon className="w-12 h-12 opacity-10" />
                                                </div>
                                                <p className="text-[11px] font-black uppercase tracking-[0.5em] text-white/10">No matching registry segments detected for this node</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-4">
                                                {classes.map(cls => (
                                                    <button
                                                        key={cls.id}
                                                        onClick={() => setSelectedClassId(cls.id.toString())}
                                                        className={`flex items-center justify-between p-10 rounded-[2.5rem] border transition-all duration-500 relative overflow-hidden group/item ${selectedClassId === cls.id.toString()
                                                                ? 'bg-primary/10 border-primary/40 shadow-2xl shadow-primary/20 scale-[1.02] z-10'
                                                                : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10'
                                                            }`}
                                                    >
                                                        {selectedClassId === cls.id.toString() && <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none"></div>}
                                                        <div className="flex items-center gap-8 relative z-10">
                                                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-serif font-black text-2xl transition-all duration-500 ${selectedClassId === cls.id.toString() ? 'bg-primary text-white shadow-2xl scale-110' : 'bg-black text-white/10 border border-white/5'}`}>
                                                                {cls.name.charAt(cls.name.length - 1)}
                                                            </div>
                                                            <div className="text-left">
                                                                <p className={`text-xl font-serif font-black uppercase tracking-tighter transition-colors ${selectedClassId === cls.id.toString() ? 'text-white' : 'text-white/40'}`}>{cls.name}</p>
                                                                <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.4em] mt-1">{cls.academic_year} CYCLE</p>
                                                            </div>
                                                        </div>
                                                        {selectedClassId === cls.id.toString() && (
                                                            <div className="relative z-10">
                                                                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
                                                                <CheckCircleIcon className="w-10 h-10 text-primary relative z-10 animate-in zoom-in" />
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </main>

                            <footer className="p-12 border-t border-white/[0.04] bg-white/[0.01] flex flex-col md:flex-row justify-between items-center gap-10 relative z-30">
                                <button type="button" onClick={onClose} className="text-[10px] font-black uppercase tracking-[0.5em] text-white/10 hover:text-white transition-all order-2 md:order-1 flex items-center gap-3 active:scale-95 group/abort">
                                    <XIcon className="w-4 h-4 group-hover/abort:rotate-90 transition-transform" /> ABORT_DISTRIBUTION
                                </button>
                                <button
                                    onClick={handleAssign}
                                    disabled={isProcessing || !selectedClassId}
                                    className="relative w-full md:w-auto min-w-[340px] h-24 bg-primary text-white font-black text-[12px] uppercase tracking-[0.3em] rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(var(--primary),0.6)] hover:bg-[#8B5CF6] transition-all transform active:scale-95 disabled:opacity-20 flex items-center justify-center gap-6 ring-[12px] ring-primary/5 group overflow-hidden"
                                >
                                    {isProcessing ? <Spinner size="sm" className="text-white" /> : <><ShieldCheckIcon className="w-6 h-6 group-hover:scale-110 transition-transform" /> EXECUTE_INTEGRATION</>}
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10 overflow-hidden"><motion.div className="h-full bg-white/40" animate={{ x: ['-100%', '100%'] }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} /></div>
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