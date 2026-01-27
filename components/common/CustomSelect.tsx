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
        <div className={`relative group w-full ${className || ''} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`} ref={containerRef}>
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
                            ? 'bg-black/60 border-primary/50 shadow-[0_0_25px_rgba(var(--primary),0.1)] ring-4 ring-primary/5'
                            : 'bg-black/20 border-white/5 hover:border-white/20 hover:bg-black/40 shadow-inner'
                        }
                    `}
                >
                    <span className="flex items-center h-full min-w-0 flex-grow">
                        {selectedOption ? (
                            <span className="text-white font-bold text-[15px] tracking-tight truncate drop-shadow-sm">{selectedOption.label}</span>
                        ) : (
                            <span className="text-white/20 font-medium text-[15px] truncate italic tracking-wide">{placeholder}</span>
                        )}
                    </span>

                    <div className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-500 ${isOpen ? 'bg-primary/20 rotate-180' : 'bg-white/5 group-hover:bg-white/10'}`}>
                        <ChevronDownIcon className={`h-3.5 w-3.5 transition-colors duration-500 ${isOpen ? 'text-primary' : 'text-white/20'}`} />
                    </div>
                </button>

                {icon && (
                    <div className={`absolute left-5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none transition-all duration-500 ${isOpen ? 'text-primary' : 'text-white/15'}`}>
                        {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
                    </div>
                )}
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{
                            type: "spring",
                            damping: 20,
                            stiffness: 300
                        }}
                        className="absolute z-[110] mt-3 w-full bg-slate-900/95 rounded-[2rem] shadow-[0_48px_96px_-24px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden origin-top backdrop-blur-3xl ring-1 ring-white/5"
                    >
                        {searchable && (
                            <div className="p-5 border-b border-white/5 bg-white/[0.02]">
                                <div className="relative group/search">
                                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within/search:text-primary transition-colors duration-300" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Identification Filter..."
                                        className="w-full pl-11 pr-4 py-3.5 text-xs rounded-xl bg-black/40 border border-white/5 focus:border-primary/40 focus:ring-4 focus:ring-primary/5 outline-none text-white placeholder:text-white/10 font-black uppercase tracking-[0.2em] transition-all"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="max-h-72 overflow-auto p-3 custom-scrollbar">
                            {filteredOptions.length > 0 ? (
                                <div className="space-y-1.5">
                                    {filteredOptions.map((option) => (
                                        <motion.button
                                            whileHover={{ x: 4 }}
                                            key={option.value}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSelect(option.value);
                                            }}
                                            className={`
                                                w-full flex items-center gap-4 px-5 py-4 text-xs font-black uppercase tracking-[0.15em] rounded-2xl transition-all duration-300 group select-none cursor-pointer border
                                                ${value === option.value
                                                    ? 'bg-primary/10 text-primary border-primary/20 shadow-[0_8px_16px_rgba(var(--primary),0.1)]'
                                                    : 'text-white/30 border-transparent hover:bg-white/5 hover:text-white hover:border-white/5'
                                                }
                                            `}
                                        >
                                            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${value === option.value ? 'bg-primary shadow-[0_0_10px_rgba(var(--primary),1)] scale-125' : 'bg-white/10 group-hover:bg-white/20'}`} />
                                            <span className="flex-grow text-left truncate">{option.label}</span>
                                            {value === option.value && (
                                                <div className="p-1 px-2 rounded-lg bg-primary/20 text-[8px]">ACTIVE NODE</div>
                                            )}
                                        </motion.button>
                                    ))}
                                </div>
                            ) : (
                                emptyState || (
                                    <div className="px-6 py-16 text-center space-y-4">
                                        <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mx-auto border border-white/5 shadow-inner rotate-3">
                                            <SearchIcon className="w-8 h-8 text-white/5" />
                                        </div>
                                        <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.3em] italic">
                                            Registry Entry Not Found
                                        </p>
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