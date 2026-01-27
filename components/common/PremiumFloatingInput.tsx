import React from 'react';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';

interface PremiumFloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
    label: string;
    icon?: React.ReactNode;
    isTextArea?: boolean;
    isSynced?: boolean;
    action?: React.ReactNode;
}

const PremiumFloatingInput: React.FC<PremiumFloatingInputProps> = ({ label, icon, isTextArea, isSynced, action, className, ...props }) => {
    return (
        <div className="relative group w-full">
            {label && (
                <label className={`absolute left-10 top-0 -translate-y-1/2 bg-[#0f111a] px-2 text-[10px] font-black uppercase tracking-[0.25em] z-20 transition-all duration-300 pointer-events-none rounded
                    ${isSynced ? 'text-primary' : 'text-white/20 group-focus-within:text-primary'}`}>
                    {label}
                </label>
            )}

            <div className={`absolute ${isTextArea ? 'top-8' : 'top-1/2 -translate-y-1/2'} left-6 text-white/10 group-focus-within:text-primary transition-all duration-500 z-10 pointer-events-none ${isSynced ? 'text-primary/60' : ''}`}>
                {icon && React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6 transition-transform group-focus-within:scale-110' }) : null}
            </div>

            {isTextArea ? (
                <textarea
                    {...(props as any)}
                    placeholder=" "
                    className={`peer block w-full h-40 rounded-[2rem] border transition-all duration-500 px-8 ${icon ? 'pl-16' : 'pl-10'} pr-16 pt-8 pb-4 text-[16px] text-white font-bold outline-none placeholder-transparent
                        ${isSynced ? 'border-primary/40 bg-primary/5 shadow-[0_0_30px_rgba(var(--primary),0.05)]' : 'border-white/5 bg-black/40 hover:border-white/10 focus:border-primary/30 focus:bg-black/60 focus:ring-8 focus:ring-primary/5'} 
                        ${className}`}
                />
            ) : (
                <input
                    {...props}
                    placeholder=" "
                    className={`peer block w-full h-[72px] rounded-[2rem] border transition-all duration-500 px-8 ${icon ? 'pl-16' : 'pl-10'} pt-6 pb-2 text-[17px] text-white font-bold outline-none placeholder-transparent
                        ${isSynced ? 'border-primary/40 bg-primary/5 shadow-[0_0_30px_rgba(var(--primary),0.05)]' : 'border-white/5 bg-black/40 hover:border-white/10 focus:border-primary/30 focus:bg-black/60 focus:ring-8 focus:ring-primary/5'} 
                        ${className}`}
                />
            )}

            {action && (
                <div className="absolute right-5 top-1/2 -translate-y-1/2 z-30">
                    {action}
                </div>
            )}

            {isSynced && !action && (
                <div className="absolute right-6 top-1/2 -translate-y-1/2 animate-in zoom-in-95 duration-500">
                    <CheckCircleIcon className="w-6 h-6 text-primary shadow-[0_0_20px_rgba(var(--primary),0.6)]" />
                </div>
            )}
        </div>
    );
};

export default PremiumFloatingInput;
