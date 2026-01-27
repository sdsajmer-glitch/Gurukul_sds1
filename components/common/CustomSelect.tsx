import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SearchIcon } from '../icons/SearchIcon';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { motion, AnimatePresence } from 'framer-motion';

interface Option {
    value: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
}

interface CustomSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    icon?: React.ReactNode;
    label?: string;
    required?: boolean;
    disabled?: boolean;
    className?: string;
    searchable?: boolean;
    isSynced?: boolean;
    emptyState?: React.ReactNode;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = "Select...",
    icon,
    label,
    disabled,
    className,
    searchable = false,
    isSynced = false,
    emptyState
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    const filteredOptions = useMemo(() => {
        if (!searchable || !searchTerm) return options;
        const lowerTerm = searchTerm.toLowerCase();
        return options.filter(opt => opt.label.toLowerCase().includes(lowerTerm));
    }, [options, searchTerm, searchable]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && searchable && searchInputRef.current) {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
        if (!isOpen) {
            setSearchTerm('');
        }
    }, [isOpen, searchable]);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    return (
        <div className={`relative group w-full ${className || ''} ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${isOpen ? 'z-[100]' : 'z-auto'}`} ref={containerRef}>
            {label && (
                <label className={`absolute left-11 top-0 -translate-y-1/2 bg-slate-900/90 px-2 text-[10px] font-black uppercase tracking-[0.25em] z-30 transition-all duration-300 pointer-events-none rounded-md
                    ${isOpen ? 'glow-text text-primary' : isSynced ? 'text-primary' : 'text-white/30 group-hover:text-white/60'}`}>
                    {label}
                </label>
            )}

            <div className="relative h-[60px]">
                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={`
                        peer w-full h-full text-left rounded-2xl transition-all duration-500 ease-out outline-none select-none
                        flex items-center px-6 border backdrop-blur-xl
                        ${icon ? 'pl-14' : 'pl-6'}
                        ${isOpen
                            ? 'bg-black/60 border-primary/50 shadow-[0_0_40px_rgba(var(--primary),0.15)] ring-4 ring-primary/5'
                            : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-black/40 shadow-inner'
                        }
                    `}
                >
                    <span className="flex items-center h-full min-w-0 flex-grow">
                        {selectedOption ? (
                            <span className="text-white font-bold text-[16px] tracking-tight truncate drop-shadow-[0_2px_10px_rgba(255,255,255,0.1)]">{selectedOption.label}</span>
                        ) : (
                            <span className="text-white/20 font-medium text-[15px] truncate italic tracking-wide">{placeholder}</span>
                        )}
                    </span>

                    <div className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-500 ${isOpen ? 'bg-primary/20 rotate-180 shadow-[0_0_15px_rgba(var(--primary),0.3)]' : 'bg-white/5 group-hover:bg-white/10'}`}>
                        <ChevronDownIcon className={`h-4 w-4 transition-colors duration-500 ${isOpen ? 'text-primary' : 'text-white/20'}`} />
                    </div>
                </button>

                {icon && (
                    <div className={`absolute left-5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none transition-all duration-500 ${isOpen ? 'text-primary scale-110' : 'text-white/15'}`}>
                        {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
                    </div>
                )}
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20, rotateX: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20, rotateX: -10 }}
                        transition={{
                            type: "spring",
                            damping: 25,
                            stiffness: 400
                        }}
                        className="absolute z-[150] mt-4 w-full bg-[#0a0b10]/95 rounded-[2.5rem] shadow-[0_60px_100px_-20px_rgba(0,0,0,0.9)] border border-white/10 overflow-hidden origin-top backdrop-blur-[40px] ring-1 ring-white/[0.08] perspective-1000"
                    >
                        {searchable && (
                            <div className="p-6 border-b border-white/[0.05] bg-white/[0.01]">
                                <div className="relative group/search">
                                    <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within/search:text-primary transition-all duration-300" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Identification Filter..."
                                        className="w-full pl-12 pr-4 py-4 text-xs rounded-2xl bg-black/60 border border-white/5 focus:border-primary/40 focus:ring-8 focus:ring-primary/5 outline-none text-white placeholder:text-white/10 font-black uppercase tracking-[0.25em] transition-all"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="max-h-[340px] overflow-auto p-4 custom-scrollbar space-y-2">
                            {filteredOptions.length > 0 ? (
                                <div className="space-y-2">
                                    {filteredOptions.map((option) => (
                                        <motion.button
                                            whileHover={{ x: 6, backgroundColor: "rgba(255,255,255,0.03)" }}
                                            whileTap={{ scale: 0.98 }}
                                            key={option.value}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelect(option.value);
                                            }}
                                            className={`
                                                w-full flex items-center gap-5 px-6 py-5 text-xs font-black uppercase tracking-[0.2em] rounded-[1.5rem] transition-all duration-500 group/item select-none cursor-pointer border
                                                ${value === option.value
                                                    ? 'bg-primary/15 text-primary border-primary/30 shadow-[0_15px_30px_-10px_rgba(var(--primary),0.3)]'
                                                    : 'text-white/20 border-transparent hover:text-white/80'
                                                }
                                            `}
                                        >
                                            <div className="relative">
                                                <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${value === option.value ? 'bg-primary shadow-[0_0_20px_rgba(var(--primary),1)] scale-125' : 'bg-white/10 group-hover/item:bg-white/30'}`} />
                                            </div>
                                            <span className="flex-grow text-left truncate leading-none">{option.label}</span>
                                            {value === option.value ? (
                                                <motion.div
                                                    initial={{ opacity: 0, x: 10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className="px-3 py-1.5 rounded-lg bg-primary text-[8px] font-black text-primary-foreground shadow-lg shadow-primary/20 whitespace-nowrap"
                                                >
                                                    ACTIVE NODE
                                                </motion.div>
                                            ) : (
                                                <ChevronDownIcon className="w-3.5 h-3.5 opacity-0 -rotate-90 group-hover/item:opacity-40 group-hover/item:translate-x-1 transition-all" />
                                            )}
                                        </motion.button>
                                    ))}
                                </div>
                            ) : (
                                emptyState || (
                                    <div className="px-8 py-20 text-center space-y-6">
                                        <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto border border-white/[0.03] shadow-inner rotate-6 animate-pulse-slow">
                                            <SearchIcon className="w-10 h-10 text-white/5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.4em] italic leading-relaxed">
                                                Registry Entry <br /> Not Found
                                            </p>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

    );
};

export default CustomSelect;