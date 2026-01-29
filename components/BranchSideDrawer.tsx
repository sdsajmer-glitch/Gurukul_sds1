import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from './icons/XIcon';

interface BranchSideDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}

export const BranchSideDrawer: React.FC<BranchSideDrawerProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    children
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[600]"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-[#050608] border-l border-white/10 z-[700] flex flex-col shadow-[-40px_0_80px_rgba(0,0,0,0.8)]"
                    >
                        {/* Header */}
                        <div className="p-8 md:p-12 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.01] shrink-0">
                            <div className="space-y-1">
                                <h3 className="premium-headline text-3xl md:text-4xl text-white uppercase leading-none">{title}</h3>
                                {subtitle && (
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">{subtitle}</p>
                                )}
                            </div>
                            <button
                                onClick={onClose}
                                className="w-12 h-12 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center text-white/20 hover:text-white hover:border-white/20 transition-all hover:bg-white/10"
                            >
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-grow overflow-y-auto custom-scrollbar p-8 md:p-12">
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
