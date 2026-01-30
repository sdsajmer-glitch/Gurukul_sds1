import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
    const [openUpwards, setOpenUpwards] = useState(true); // Preference for Upward
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 });
    const [activeIndex, setActiveIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const optionsRef = useRef<(HTMLButtonElement | null)[]>([]);
    const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

    const selectedOption = options.find(opt => opt.value === value);

    const filteredOptions = useMemo(() => {
        if (!searchable || !searchTerm) return options;
        const lowerTerm = searchTerm.toLowerCase();
        return options.filter(opt => opt.label.toLowerCase().includes(lowerTerm));
    }, [options, searchTerm, searchable]);

    useEffect(() => {
        setPortalNode(document.body);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                // Also check if click is inside portal (if we had a ref for it, but for now simple check)
                const dropdownPanel = document.getElementById('custom-select-portal-panel');
                if (dropdownPanel && dropdownPanel.contains(event.target as Node)) return;
                setIsOpen(false);
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
            setActiveIndex(filteredOptions.findIndex(opt => opt.value === value));
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, filteredOptions, value]);

    const updatePosition = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceAbove = rect.top;
            const spaceBelow = window.innerHeight - rect.bottom;
            const menuHeight = Math.min(filteredOptions.length * 60 + 100, 400); // Estimated max height

            // Default to Upward if there's room, or if it's better than below
            const preferUp = spaceAbove >= menuHeight || spaceAbove > spaceBelow;
            setOpenUpwards(preferUp);

            setCoords({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            });
        }
    };

    useEffect(() => {
        if (isOpen) {
            updatePosition();
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);

            if (searchable && searchInputRef.current) {
                setTimeout(() => searchInputRef.current?.focus(), 150);
            }
        }
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isOpen, searchable, filteredOptions.length]);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (disabled) return;

        if (!isOpen) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                setIsOpen(true);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setActiveIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setActiveIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
                break;
            case 'Enter':
                e.preventDefault();
                if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
                    handleSelect(filteredOptions[activeIndex].value);
                }
                break;
            case 'Tab':
                setIsOpen(false);
                break;
        }
    };

    useEffect(() => {
        if (activeIndex >= 0 && optionsRef.current[activeIndex]) {
            optionsRef.current[activeIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [activeIndex]);

    const DropdownPanel = (
        <>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10999] pointer-events-none"
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        id="custom-select-portal-panel"
                        initial={{ opacity: 0, scale: 0.95, y: openUpwards ? 15 : -15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: openUpwards ? 15 : -15 }}
                        transition={{ type: "spring", damping: 30, stiffness: 450 }}
                        style={{
                            position: 'fixed',
                            top: openUpwards ? 'auto' : coords.top + coords.height + 12,
                            bottom: openUpwards ? window.innerHeight - coords.top + 12 : 'auto',
                            left: coords.left,
                            width: coords.width > 0 ? `${coords.width}px` : '100%',
                            minWidth: '280px',
                            zIndex: 11000,
                            perspective: '1200px'
                        }}
                        className={`bg-[#0d0e14] rounded-[1.6rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] border border-white/10 overflow-hidden origin-${openUpwards ? 'bottom' : 'top'} backdrop-blur-[120px] ring-2 ring-white/10`}
                    >
                        {searchable && (
                            <div className="p-6 border-b border-white/[0.05] bg-white/[0.02]">
                                <div className="relative group/search w-full">
                                    <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/10 group-focus-within/search:text-primary transition-all duration-500" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setActiveIndex(0);
                                        }}
                                        placeholder="SEARCH REGISTRY..."
                                        className="w-full h-16 pl-16 pr-8 text-[11px] rounded-[1.75rem] bg-black/80 border border-white/5 focus:border-primary/40 focus:ring-12 focus:ring-primary/5 outline-none text-white placeholder:text-white/10 font-black uppercase tracking-[0.3em] transition-all"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="max-h-[350px] overflow-auto p-4 custom-scrollbar space-y-2">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((option, index) => (
                                    <motion.button
                                        ref={el => optionsRef.current[index] = el}
                                        whileHover={{ x: 8, backgroundColor: "rgba(255,255,255,0.03)" }}
                                        whileTap={{ scale: 0.97 }}
                                        key={option.value}
                                        type="button"
                                        onMouseEnter={() => setActiveIndex(index)}
                                        onClick={() => handleSelect(option.value)}
                                        className={`
                                            w-full flex items-center gap-6 px-8 py-6 text-[11px] font-black uppercase tracking-[0.2em] rounded-[1.85rem] transition-all duration-500 group/item select-none cursor-pointer border relative overflow-hidden
                                            ${value === option.value
                                                ? 'bg-primary text-white border-primary shadow-[0_20px_40px_-10px_rgba(var(--primary),0.6)] z-10'
                                                : activeIndex === index
                                                    ? 'bg-white/[0.05] text-white border-white/10'
                                                    : 'text-white/20 border-transparent hover:text-white/80'
                                            }
                                        `}
                                    >
                                        <div className="relative flex items-center justify-center w-4 h-4">
                                            <div className={`w-2 h-2 rounded-full transition-all duration-700 ${value === option.value ? 'bg-white shadow-[0_0_20px_rgba(255,255,255,1)] scale-125' : 'bg-white/10'}`} />
                                            {activeIndex === index && value !== option.value && (
                                                <motion.div layoutId="hoverIndicator" className="absolute inset-0 bg-primary/20 rounded-full blur-md" />
                                            )}
                                        </div>
                                        <span className="flex-grow text-left truncate leading-none relative z-10">{option.label}</span>
                                        {value === option.value && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.5 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="px-4 py-1.5 rounded-full bg-black/30 text-[9px] font-black text-white/60 tracking-[0.2em] shadow-lg"
                                            >
                                                SELECTED
                                            </motion.div>
                                        )}
                                    </motion.button>
                                ))
                            ) : (
                                <div className="py-24 text-center space-y-8 opacity-20 group">
                                    <SearchIcon className="w-14 h-14 mx-auto transition-transform group-hover:scale-110 duration-700" />
                                    <p className="text-[12px] font-black uppercase tracking-[0.5em] italic leading-relaxed">No Matches Synchronized</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );

    return (
        <div
            className={`relative group w-full ${className || ''} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            ref={containerRef}
            onKeyDown={handleKeyDown}
        >
            {label && (
                <label className={`absolute left-10 top-0 -translate-y-1/2 bg-[#0a0b10] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.3em] z-20 transition-all duration-700 pointer-events-none border border-transparent
                    ${isOpen ? 'text-primary shadow-[0_0_30px_rgba(var(--primary),0.4)] ring-1 ring-primary/40 border-primary/20 bg-[#0a0b10]' : isSynced ? 'text-primary' : 'text-white/20 group-hover:text-white/40'}`}>
                    {label}
                </label>
            )}

            <div className="relative h-[76px]">
                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={`
                        peer w-full h-full text-left rounded-[1.6rem] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none select-none
                        flex items-center px-10 border backdrop-blur-3xl
                        ${icon ? 'pl-16' : 'pl-8'}
                        ${isOpen
                            ? 'bg-primary/10 border-primary shadow-[0_0_80px_-20px_rgba(var(--primary),0.2)] ring-12 ring-primary/5'
                            : 'bg-black/60 border-white/10 hover:border-white/20 hover:bg-black/80 shadow-[inset_0_4px_20px_rgba(0,0,0,0.6)] hover:shadow-[inset_0_4px_30px_rgba(var(--primary),0.05)]'
                        }
                    `}
                >
                    <span className="flex items-center h-full min-w-0 flex-grow">
                        {selectedOption ? (
                            <span className="text-white font-bold text-[16px] tracking-tight truncate glow-text">{selectedOption.label}</span>
                        ) : (
                            <span className="text-white/10 font-bold text-[14px] truncate tracking-[0.2em] uppercase leading-none">{placeholder}</span>
                        )}
                    </span>

                    <motion.div
                        animate={{
                            rotate: isOpen ? 180 : 0,
                            scale: isOpen ? 1.1 : 1,
                            backgroundColor: isOpen ? "rgba(var(--primary), 1)" : "rgba(255,255,255,0.05)"
                        }}
                        className={`flex items-center justify-center w-11 h-11 rounded-[1.5rem] transition-all duration-700 ${isOpen ? 'text-white shadow-[0_15px_30px_-5px_rgba(var(--primary),0.5)]' : 'text-white/10 group-hover:text-white/40 group-hover:bg-white/10'}`}
                    >
                        <ChevronDownIcon className="h-6 w-6" />
                    </motion.div>
                </button>

                {icon && (
                    <div className={`absolute left-6 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none transition-all duration-700 ${isOpen ? 'text-primary scale-125' : 'text-white/10 scale-100 group-hover:text-primary/40'}`}>
                        {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' })}
                    </div>
                )}
            </div>

            {portalNode && createPortal(DropdownPanel, portalNode)}
        </div>
    );
};

export default CustomSelect;