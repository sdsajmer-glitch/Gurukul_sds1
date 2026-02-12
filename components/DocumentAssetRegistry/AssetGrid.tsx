import React from 'react';
import { motion } from 'framer-motion';
import { FileTextIcon } from '../icons/FileTextIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { InfoIcon } from '../icons/InfoIcon';
import { supabase } from '../../services/supabase';

import { VaultDocument } from './DocumentAssetRegistry';

interface AssetGridProps {
    docs: VaultDocument[];
}

const AssetGrid: React.FC<AssetGridProps> = ({ docs }) => {
    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Asset Inventory</h3>
                <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{docs.length} Registered Nodes</span>
            </div>

            <div className="divide-y divide-white/5">
                {docs.map((doc) => (
                    <motion.div
                        key={doc.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="px-8 py-4 flex items-center justify-between group transition-all hover:bg-white/[0.01]"
                    >
                        <div className="flex items-center gap-6 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-white/[0.03] border border-white/10 flex items-center justify-center text-white/20 group-hover:text-primary group-hover:border-primary/20 transition-all shrink-0">
                                <FileTextIcon className="w-5 h-5" />
                            </div>

                            <div className="grid grid-cols-12 flex-1 gap-4 items-center min-w-0">
                                <div className="col-span-6 min-w-0">
                                    <h4 className="text-[13px] font-bold text-white truncate group-hover:text-primary transition-colors cursor-pointer">
                                        {doc.document_name}
                                    </h4>
                                    <p className="text-[10px] font-medium text-white/20 uppercase tracking-widest mt-0.5">
                                        {doc.document_type} <span className="mx-2 text-white/5">|</span> ARCHIVED_{new Date(doc.uploaded_at).getFullYear()}
                                    </p>
                                </div>

                                <div className="col-span-3 hidden md:flex flex-col">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border w-fit ${doc.status === 'Verified' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                        }`}>
                                        {doc.status || 'UNVERIFIED'}
                                    </span>
                                    <p className="text-[9px] font-bold text-white/10 uppercase tracking-widest mt-1">Status Protocol</p>
                                </div>

                                <div className="col-span-3 text-right pr-4">
                                    <p className="text-[11px] font-bold text-white/40">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                                    <p className="text-[9px] font-bold text-white/10 uppercase tracking-widest mt-0.5">Registration date</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => window.open(supabase.storage.from('teacher-documents').getPublicUrl(doc.file_path).data.publicUrl, '_blank')}
                                className="p-2.5 rounded-lg text-white/20 hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20"
                                title="View Artifact"
                            >
                                <InfoIcon className="w-4 h-4" />
                            </button>
                            <button
                                className="p-2.5 rounded-lg text-white/20 hover:text-white hover:bg-white/5 transition-all border border-transparent"
                                title="Download"
                            >
                                <DownloadIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default AssetGrid;
