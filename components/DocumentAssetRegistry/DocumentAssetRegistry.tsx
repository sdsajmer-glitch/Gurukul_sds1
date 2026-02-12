import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TeacherExtended } from '../../types';
import VaultSummaryStrip from './VaultSummaryStrip';
import AssetGrid from './AssetGrid';
import AssetActivityLog from './AssetActivityLog';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { ActivityIcon } from '../icons/ActivityIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { FileTextIcon } from '../icons/FileTextIcon';
import Spinner from '../common/Spinner';

export interface VaultDocument {
    id: string | number;
    document_name: string;
    document_type: string;
    uploaded_at: string;
    status: string;
    file_path: string;
}

interface DocumentAssetRegistryProps {
    teacher: TeacherExtended;
    docs: VaultDocument[];
    loadingDocs: boolean;
    onArchiveClick: () => void;
}

const DocumentAssetRegistry: React.FC<DocumentAssetRegistryProps> = ({
    teacher,
    docs,
    loadingDocs,
    onArchiveClick
}) => {
    const [isMobileActivityOpen, setIsMobileActivityOpen] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-8 w-full max-w-[1440px] mx-auto pb-32"
        >
            {/* 🏫 SECTION HEADER LAYER */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 px-2">
                <div className="space-y-1">
                    <div className="flex items-center gap-3 opacity-40">
                        <div className="w-8 h-px bg-primary/40" />
                        <span className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Vault Management</span>
                    </div>
                    <h2 className="text-3xl font-serif font-black text-white uppercase tracking-tighter">Document <span className="text-white/20 italic font-medium">Vault.</span></h2>
                    <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em]">Institutional Repository of Academic & Professional Credentials</p>
                </div>

                <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onArchiveClick}
                    className="px-8 py-4 bg-primary text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-4 group/btn"
                >
                    <PlusIcon className="w-5 h-5 group-hover/btn:rotate-90 transition-transform duration-500" /> Archive New Asset Node
                </motion.button>
            </div>

            {/* 🏫 SUMMARY STRIP (Horizontal) */}
            <VaultSummaryStrip
                totalDocs={docs.length}
                verifiedDocs={docs.filter(d => d.status === 'Verified').length}
                storageUsed="14.2 MB"
                lastArchived={docs.length > 0 ? new Date(docs[0].uploaded_at).toLocaleDateString() : 'N/A'}
            />

            {/* 🏫 MAIN OPERATIONAL GRID (7/3 Split) */}
            <div className="grid grid-cols-12 gap-8 items-start px-1">

                {/* 8-COLUMN MAIN CONTENT (70% weight approx) */}
                <div className="col-span-12 xl:col-span-8 space-y-8">
                    {loadingDocs ? (
                        <div className="py-48 flex flex-col items-center justify-center space-y-8 bg-[#14161c] border border-white/5 rounded-2xl">
                            <Spinner size="lg" className="text-primary" />
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] animate-pulse text-center">Decrypting Identity Artifacts...</p>
                        </div>
                    ) : docs.length === 0 ? (
                        <div className="p-24 border-2 border-dashed border-white/5 rounded-2xl bg-white/[0.01] flex flex-col items-center group/empty hover:bg-white/[0.02] transition-all duration-700">
                            <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mb-8 shadow-inner ring-1 ring-white/10 group-hover/empty:scale-110 transition-all duration-1000">
                                <FileTextIcon className="w-8 h-8 opacity-10 group-hover/empty:opacity-30 group-hover/empty:text-primary transition-all" />
                            </div>
                            <h4 className="text-xl font-serif font-black text-white/40 uppercase tracking-tighter mb-4">No Registered Assets</h4>
                            <p className="text-[10px] font-black uppercase tracking-[0.5em] max-w-sm text-center leading-relaxed text-white/10 group-hover/empty:text-white/30 transition-colors">
                                THE CENTRAL VAULT CONTAINS NO CRYPTOGRAPHIC ENTRIES FOR THIS FACULTY NODE.
                            </p>
                        </div>
                    ) : (
                        <div className="transition-all duration-200 hover:translate-y-[-4px]">
                            <AssetGrid docs={docs} />
                        </div>
                    )}
                </div>

                {/* 4-COLUMN AUXILIARY PANEL (30% weight approx) */}
                <div className="hidden xl:block xl:col-span-4 h-full">
                    <div className="sticky top-8 h-[calc(100vh-280px)] min-h-[680px] transition-all duration-200 hover:translate-y-[-4px]">
                        <AssetActivityLog />
                    </div>
                </div>

                {/* Mobile Tablet Accordion (Single Column Stacking) */}
                <div className="col-span-12 xl:hidden">
                    <div className="bg-[#14161c] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                        <button
                            onClick={() => setIsMobileActivityOpen(!isMobileActivityOpen)}
                            className="w-full p-6 flex items-center justify-between group bg-white/[0.01]"
                        >
                            <div className="flex items-center gap-4">
                                <ActivityIcon className="w-4 h-4 text-white/20 group-hover:text-primary transition-colors" />
                                <h4 className="text-[13px] font-bold text-white uppercase tracking-wider">Vault Activity Log</h4>
                            </div>
                            <motion.div
                                animate={{ rotate: isMobileActivityOpen ? 180 : 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            >
                                <ChevronDownIcon className="w-4 h-4 text-white/20" />
                            </motion.div>
                        </button>
                        <AnimatePresence initial={false}>
                            {isMobileActivityOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 620, opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                    className="border-t border-white/5"
                                >
                                    <AssetActivityLog />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Compliance Footer Metadata */}
            <div className="flex items-center justify-between px-6 opacity-20 pt-8 border-t border-white/5">
                <p className="text-[9px] font-bold text-white uppercase tracking-[0.4em]">Vault ID: {teacher.id.slice(0, 12).toUpperCase()}-VLT</p>
                <div className="flex gap-10">
                    <p className="text-[9px] font-bold text-white uppercase tracking-[0.4em]">AES-256 ENCRYPTED</p>
                    <p className="text-[9px] font-bold text-white uppercase tracking-[0.4em]">Node Registry: ACTIVE</p>
                </div>
            </div>
        </motion.div>
    );
};

export default DocumentAssetRegistry;
