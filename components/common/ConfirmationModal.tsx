import React, { useEffect } from 'react';
import Spinner from './Spinner';
import { motion } from 'framer-motion';
import { InfoIcon } from '../icons/InfoIcon';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    loading?: boolean;
    variant?: 'primary' | 'destructive';
    extraContent?: React.ReactNode;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    loading = false,
    variant = 'primary',
    extraContent
}) => {
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !loading) {
                onClose();
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
        }
        return () => {
            window.removeEventListener('keydown', handleEsc);
        };
    }, [isOpen, onClose, loading]);

    if (!isOpen) return null;

    const isPrimary = variant === 'primary';

    return (
        <div
            className="fixed inset-0 bg-black/95 backdrop-blur-md flex justify-center items-center z-[2000] p-4 animate-in fade-in duration-300"
            onClick={() => !loading && onClose()}
            aria-modal="true"
            role="dialog"
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-[#0f1115] rounded-[3.5rem] shadow-[0_80px_160px_-24px_rgba(0,0,0,1)] border border-white/10 p-12 w-full max-w-[480px] m-4 transform ring-1 ring-white/5 relative overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Visual Anchor: Status Icon */}
                <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 ring-1 shadow-2xl transition-all duration-700 ${
                    isPrimary 
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                        : 'bg-red-500/10 text-red-500 border-red-500/20'
                }`}>
                    <div className={`w-16 h-16 rounded-[1.8rem] flex items-center justify-center ${isPrimary ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                        <InfoIcon className="h-8 w-8" />
                    </div>
                </div>

                {/* Typography: Institutional Tone */}
                <div className="text-center space-y-6">
                    <h2 className="text-2xl md:text-3xl font-serif font-black text-white uppercase tracking-tight leading-none">
                        {title}
                    </h2>
                    <p className="text-white/40 text-base md:text-lg leading-relaxed font-serif italic max-w-[320px] mx-auto">
                        {message}
                    </p>
                    
                    {extraContent && (
                        <div className="pt-2">
                            {extraContent}
                        </div>
                    )}
                </div>
                
                {/* Command Actions */}
                <div className="flex flex-col gap-6 mt-16">
                    <button 
                        type="button"
                        onClick={onConfirm} 
                        disabled={loading}
                        className={`w-full h-16 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center shadow-2xl active:scale-95 disabled:opacity-50 ${
                            isPrimary 
                                ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-900/40' 
                                : 'bg-red-600 text-white hover:bg-red-500 shadow-red-900/40'
                        }`}
                    >
                        {loading ? (
                            <div className="flex items-center gap-3">
                                <Spinner size="sm" className="text-white"/>
                                <span>SYNCING...</span>
                            </div>
                        ) : confirmText}
                    </button>
                    
                    <button 
                        type="button"
                        onClick={(e) => { e.preventDefault(); onClose(); }} 
                        disabled={loading}
                        className="w-full h-10 text-[10px] font-black uppercase tracking-[0.4em] text-white/20 hover:text-white transition-all active:scale-95 disabled:opacity-0"
                    >
                        {cancelText}
                    </button>
                </div>

                {/* Decorative node detail */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-20"></div>
            </motion.div>
        </div>
    );
};

export default ConfirmationModal;