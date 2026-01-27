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
    const [openUpwards, setOpenUpwards] = useState(false);
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
        if (isOpen) {
            // Smart positioning logic: Detect if there's enough room below
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                const menuHeight = 400; // Estimated max height
                if (spaceBelow < menuHeight && rect.top > menuHeight) {
                    setOpenUpwards(true);
                } else {
                    setOpenUpwards(false);
                }
            }

            if (searchable && searchInputRef.current) {
                setTimeout(() => {
                    searchInputRef.current?.focus();
                }, 100);
            }
        } else {
            setSearchTerm('');
        }
    }, [isOpen, searchable]);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    return (
        <div className={`relative group w-full ${className || ''} ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${isOpen ? 'z-[500]' : 'z-auto'}`} ref={containerRef}>
            {label && (
                <label className={`absolute left-10 top-0 -translate-y-1/2 bg-[#0f111a] px-2 text-[10px] font-black uppercase tracking-[0.3em] z-30 transition-all duration-500 pointer-events-none rounded
                    ${isOpen ? 'text-primary shadow-[0_0_10px_rgba(var(--primary),0.3)]' : isSynced ? 'text-primary' : 'text-white/20 group-hover:text-white/40'}`}>
                    {label}
                </label>
            )}

            <div className="relative h-[64px]">
                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={`
                        peer w-full h-full text-left rounded-2xl transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none select-none
                        flex items-center px-6 border backdrop-blur-3xl
                        ${icon ? 'pl-14' : 'pl-6'}
                        ${isOpen
                            ? 'bg-primary/5 border-primary/40 shadow-[0_0_40px_rgba(var(--primary),0.1)] ring-8 ring-primary/5'
                            : 'bg-black/40 border-white/5 hover:border-white/10 hover:bg-black/60 shadow-inner'
                        }
                    `}
                >
                    <span className="flex items-center h-full min-w-0 flex-grow">
                        {selectedOption ? (
                            <span className="text-white font-bold text-[16px] tracking-tight truncate">{selectedOption.label}</span>
                        ) : (
                            <span className="text-white/20 font-bold text-[15px] truncate tracking-wide italic leading-none">{placeholder}</span>
                        )}
                    </span>

                    <div className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-700 ${isOpen ? 'bg-primary text-white rotate-180 shadow-lg shadow-primary/40' : 'bg-white/5 text-white/20 group-hover:bg-white/10 group-hover:text-white/40'}`}>
                        <ChevronDownIcon className="h-4 w-4" />
                    </div>
                </button>

                {icon && (
                    <div className={`absolute left-5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none transition-all duration-500 ${isOpen ? 'text-primary scale-125' : 'text-white/10'}`}>
                        {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
                    </div>
                )}
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: openUpwards ? 20 : -20, rotateX: openUpwards ? 10 : -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: openUpwards ? 20 : -20, rotateX: openUpwards ? 10 : -10 }}
                        transition={{
                            type: "spring",
                            damping: 25,
                            stiffness: 400
                        }}
                        style={{ perspective: '1000px' }}
                        className={`absolute z-[600] ${openUpwards ? 'bottom-[calc(100%+12px)]' : 'top-[calc(100%+12px)]'} w-full bg-[#0a0b10]/95 rounded-[2.5rem] shadow-[0_80px_120px_-20px_rgba(0,0,0,1)] border border-white/10 overflow-hidden origin-${openUpwards ? 'bottom' : 'top'} backdrop-blur-[60px] ring-1 ring-white/10`}
                    >
                        {searchable && (
                            <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                                <div className="relative">
                                    <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Identification Filter..."
                                        className="w-full pl-12 pr-4 py-4 text-[10px] rounded-2xl bg-black/60 border border-white/5 focus:border-primary/40 focus:ring-8 focus:ring-primary/5 outline-none text-white placeholder:text-white/10 font-black uppercase tracking-[0.25em] transition-all"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="max-h-[320px] overflow-auto p-4 custom-scrollbar space-y-1.5">
                            {filteredOptions.length > 0 ? (
                                <div className="space-y-1.5">
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
                                                w-full flex items-center gap-5 px-6 py-5 text-[11px] font-black uppercase tracking-[0.2em] rounded-[1.5rem] transition-all duration-500 group/item select-none cursor-pointer border
                                                ${value === option.value
                                                    ? 'bg-primary text-white border-primary shadow-[0_15px_30px_-10px_rgba(var(--primary),0.4)]'
                                                    : 'text-white/20 border-transparent hover:text-white/80'
                                                }
                                            `}
                                        >
                                            <div className="relative">
                                                <div className={`w-2 h-2 rounded-full transition-all duration-500 ${value === option.value ? 'bg-white shadow-[0_0_15px_rgba(255,255,255,1)] scale-125' : 'bg-white/10 group-hover/item:bg-white/30'}`} />
                                            </div>
                                            <span className="flex-grow text-left truncate leading-none">{option.label}</span>
                                            {value === option.value && (
                                                <motion.div
                                                    initial={{ opacity: 0, x: 10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className="px-3 py-1.5 rounded-lg bg-black/20 text-[8px] font-black text-white/60 shadow-lg whitespace-nowrap"
                                                >
                                                    ACTIVE NODE
                                                </motion.div>
                                            )}
                                        </motion.button>
                                    ))}
                                </div>
                            ) : (
                                <div className="px-8 py-20 text-center space-y-6 opacity-40">
                                    <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto border border-white/[0.03]">
                                        <SearchIcon className="w-8 h-8 text-white/20" />
                                    </div>
                                    <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.4em] italic">
                                        Registry Entry Not Found
                                    </p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

    );
};

export default CustomSelect;