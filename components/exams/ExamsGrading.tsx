
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../services/supabase';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { PlusIcon } from '../icons/PlusIcon';
import Spinner from '../common/Spinner';

const ExamsGrading: React.FC<{ branchId: number | null }> = ({ branchId }) => {
    const [scales, setScales] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchScales = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('grading_scales')
                    .select('*, grading_scale_nodes(*)')
                    .eq('branch_id', branchId)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setScales(data || []);
            } catch (err) {
                console.error("Grading Matrix Sync Failure:", err);
            } finally {
                setLoading(false);
            }
        };

        if (branchId) fetchScales();
        else setLoading(false);
    }, [branchId]);

    if (loading) return <div className="py-20 flex justify-center"><Spinner /></div>;

    return (
        <div className="space-y-10">
            {/* Logic Header */}
            <div className="bg-[#12141c] border border-white/5 p-10 rounded-[3rem] relative overflow-hidden shadow-2xl ring-1 ring-white/5">
                <div className="absolute top-0 right-0 p-12 opacity-[0.02] -rotate-12">
                    <ShieldCheckIcon className="w-48 h-48 text-primary" />
                </div>
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 relative z-10">
                    <div>
                        <h3 className="text-2xl font-serif font-black text-white uppercase tracking-tight italic">Grading <span className="text-primary NOT-italic">Matrix</span> Orchestrator</h3>
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mt-2 leading-relaxed max-w-xl">
                            Configure institutional conversion nodes for percentage-to-grade mapping. These rules power the automated report card engine.
                        </p>
                    </div>
                    <button className="px-10 py-5 bg-white/5 text-white font-black text-[10px] uppercase tracking-[0.4em] rounded-2xl border border-white/10 hover:border-primary/20 hover:text-primary transition-all flex items-center gap-4">
                        <PlusIcon className="w-4 h-4" /> Define New Scale
                    </button>
                </div>
            </div>

            {/* Scale Registry */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                {scales.length > 0 ? scales.map((scale, idx) => (
                    <div key={idx} className="bg-[#12141c] border border-white/5 rounded-[3.5rem] p-10 shadow-3xl hover:border-primary/10 transition-all group">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h4 className="text-xl font-serif font-black text-white uppercase tracking-tight group-hover:text-primary transition-colors">{scale.name}</h4>
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-1">Institutional Standard Node</p>
                            </div>
                            {scale.is_default && (
                                <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-[8px] font-black uppercase tracking-widest">Global Default</span>
                            )}
                        </div>

                        <div className="space-y-4">
                            {scale.grading_scale_nodes?.sort((a: any, b: any) => b.min_percentage - a.min_percentage).map((node: any, nIdx: number) => (
                                <div key={nIdx} className="bg-white/[0.01] border border-white/5 p-5 rounded-2xl flex justify-between items-center hover:bg-white/[0.03] transition-all">
                                    <div className="flex items-center gap-6">
                                        <div
                                            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-serif font-black text-xl shadow-lg"
                                            style={{ backgroundColor: node.color_code || '#4F46E5' }}
                                        >
                                            {node.grade}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest leading-none mb-1.5">Threshold</p>
                                            <p className="text-lg font-mono font-black text-white tracking-tighter italic">
                                                {node.min_percentage}% <span className="text-white/20 font-sans mx-2">→</span> {node.max_percentage}%
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-white/10 uppercase tracking-widest">{node.remarks || 'Standard Performance'}</p>
                                        {node.point_value && <p className="text-[12px] font-mono font-black text-primary italic mt-1">{node.point_value} GPA</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )) : (
                    <div className="col-span-full py-40 bg-white/[0.01] border border-dashed border-white/10 rounded-[3rem] text-center opacity-30">
                        <ShieldCheckIcon className="w-16 h-16 mx-auto mb-6" />
                        <p className="text-[12px] font-black uppercase tracking-[0.6em]">Awaiting Grading Matrix Initialization</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExamsGrading;
