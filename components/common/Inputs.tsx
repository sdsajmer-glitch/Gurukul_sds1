import React from 'react';
import { motion } from 'framer-motion';
import { LockIcon } from '../icons/LockIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
    label: string;
    icon?: React.ReactNode;
    isTextArea?: boolean;
    isSynced?: boolean;
    action?: React.ReactNode;
}

export const FloatingPremiumInput: React.FC<InputProps> = ({
    label,
    icon,
    isTextArea,
    isSynced,
    action,
    className,
    readOnly,
    ...props
}) => {
    const Component = isTextArea ? 'textarea' : 'input';

    return (
        <div className="relative group w-full">
            <label className={`absolute left-11 top-0 -translate-y-1/2 bg-[#08090a] px-2 text-[10px] font-black uppercase tracking-[0.2em] z-20 transition-all duration-300 pointer-events-none
                ${isSynced ? 'text-primary' : (readOnly ? 'text-white/10' : 'text-white/30 group-focus-within:text-primary')}`}>
                {label}
            </label>

            <div className={`absolute ${isTextArea ? 'top-5' : 'top-1/2 -translate-y-1/2'} left-4 text-white/10 group-focus-within:text-primary transition-all duration-300 z-10 pointer-events-none ${isSynced ? 'text-primary/60' : ''}`}>
                {icon}
            </div>

            <Component
                {...(props as any)}
                readOnly={readOnly}
                placeholder=" "
                className={`peer block w-full rounded-[1.25rem] border transition-all duration-500 px-5 pl-12 pr-12 text-[14px] text-white font-medium outline-none placeholder-transparent
                    ${isTextArea ? 'h-32 pt-5 pb-2' : 'h-[60px] pt-4 pb-1'}
                    ${isSynced
                        ? 'border-primary/40 bg-primary/5 shadow-[0_0_20px_rgba(var(--primary),0.05)]'
                        : (readOnly
                            ? 'border-white/5 bg-white/[0.01] text-white/20'
                            : 'border-white/10 bg-white/[0.02] hover:border-white/20 focus:border-primary/50 focus:bg-white/[0.04] focus:ring-4 focus:ring-primary/5'
                        )
                    } 
                    ${className}`}
            />

            {action && (
                <div className="absolute right-3 top-[10px] z-30">
                    {action}
                </div>
            )}

            {!action && isSynced && (
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                >
                    <CheckCircleIcon className="w-5 h-5 text-primary" />
                </motion.div>
            )}

            {!action && !isSynced && readOnly && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/10">
                    <LockIcon className="w-4 h-4" />
                </div>
            )}
        </div>
    );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label: string;
    icon?: React.ReactNode;
}

export const PremiumSelect: React.FC<SelectProps> = ({ label, icon, children, className, ...props }) => (
    <div className="relative group w-full">
        <label className="absolute left-11 top-0 -translate-y-1/2 bg-[#08090a] px-2 text-[10px] font-black uppercase tracking-[0.2em] z-20 transition-all duration-300 group-focus-within:text-primary text-white/30 pointer-events-none">
            {label}
        </label>

        <div className="absolute top-1/2 -translate-y-1/2 left-4 text-white/10 group-focus-within:text-primary transition-all duration-300 z-10 pointer-events-none">
            {icon}
        </div>

        <select
            {...props}
            className={`peer block w-full h-[60px] appearance-none rounded-[1.25rem] border border-white/10 bg-white/[0.02] px-5 pl-12 pr-12 pt-4 pb-1 text-[14px] text-white font-medium outline-none transition-all duration-500 hover:border-white/20 focus:border-primary/50 focus:bg-white/[0.04] focus:ring-4 focus:ring-primary/5 cursor-pointer ${className} ${props.disabled ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}
        >
            {children}
        </select>

        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/20 group-focus-within:text-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </div>
    </div>
);
