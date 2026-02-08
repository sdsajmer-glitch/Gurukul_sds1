import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
    preferPlacement?: 'top' | 'bottom';
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
    emptyState,
    preferPlacement
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [dropdownStyles, setDropdownStyles] = useState<{ top: number; left: number; width: number; maxHeight: number; placement: 'top' | 'bottom' }>({ top: 0, left: 0, width: 0, maxHeight: 300, placement: 'bottom' });
    const [mounted, setMounted] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const [dropdownId] = useState(() => `select-portal-${Math.random().toString(36).substr(2, 9)}`);

    useEffect(() => {
        setMounted(true);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    const filteredOptions = useMemo(() => {
        if (!searchable || !searchTerm) return options;
        const lowerTerm = searchTerm.toLowerCase();
        return options.filter(opt => opt.label.toLowerCase().includes(lowerTerm));
    }, [options, searchTerm, searchable]);

    const updatePosition = useCallback(() => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        // Use viewport coordinates directly since the portal is fixed.
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;

        const itemHeight = 60;
        const searchHeight = searchable ? 80 : 0;
        const padding = 20;
        const estimatedHeight = Math.min(350, (filteredOptions.length * itemHeight) + searchHeight + padding);

        let placement: 'top' | 'bottom' = 'bottom';
        let maxHeight = 300;

        const minUsableHeight = 150;

        if (preferPlacement) {
            if (preferPlacement === 'bottom' && spaceBelow >= minUsableHeight) {
                placement = 'bottom';
            } else if (preferPlacement === 'top' && spaceAbove >= minUsableHeight) {
                placement = 'top';
            } else {
                placement = spaceBelow > spaceAbove ? 'bottom' : 'top';
            }
        } else {
            if (spaceBelow >= estimatedHeight) {
                placement = 'bottom';
            } else if (spaceAbove >= estimatedHeight) {
                placement = 'top';
            } else {
                placement = spaceBelow > spaceAbove ? 'bottom' : 'top';
            }
        }

        const availableSpace = placement === 'bottom' ? spaceBelow : spaceAbove;
        maxHeight = Math.min(estimatedHeight, availableSpace - 20);

        setDropdownStyles({
            top: placement === 'top' ? rect.top - 8 : rect.bottom + 8,
            left: rect.left,
            width: rect.width,
            maxHeight,
            placement
        });
    }, [filteredOptions.length, searchable, preferPlacement]);

    useEffect(() => {
        if (isOpen) {
            updatePosition();
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
        }
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isOpen, updatePosition]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                const portalElement = document.getElementById(dropdownId);
                if (portalElement && portalElement.contains(event.target as Node)) return;
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, dropdownId]);

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
            case 'Escape':
                setIsOpen(false);
                containerRef.current?.focus();
                break;
            case 'ArrowDown':
                e.preventDefault();
                setActiveIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
                const list = listRef.current;
                if (list) {
                    const element = list.children[activeIndex + 1] as HTMLElement;
                    if (element) element.scrollIntoView({ block: 'nearest' });
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
                const listUp = listRef.current;
                if (listUp) {
                    const element = listUp.children[activeIndex - 1] as HTMLElement;
                    if (element) element.scrollIntoView({ block: 'nearest' });
                }
                break;
            case 'Enter':
                e.preventDefault();
                if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
                    handleSelect(filteredOptions[activeIndex].value);
                } else if (filteredOptions.length === 1) {
                    handleSelect(filteredOptions[0].value);
                }
                break;
            case 'Tab':
                setIsOpen(false);
                break;
        }
    };

    useEffect(() => {
        if (isOpen && searchable && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
        if (!isOpen) {
            setSearchTerm('');
            setActiveIndex(-1);
        }
    }, [isOpen, searchable]);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
        containerRef.current?.querySelector('button')?.focus();
    };

    const dropdownContent = (
        <AnimatePresence>
            {isOpen && (
                <div id={dropdownId} className="fixed inset-0 z-[999999] pointer-events-none">
                    <div
                        style={{
                            position: 'absolute',
                            top: dropdownStyles.top,
                            left: dropdownStyles.left,
                            width: dropdownStyles.width,
                            pointerEvents: 'auto',
                            zIndex: 999999
                        }}
                    >
                        <motion.div
                            initial={{
                                opacity: 0,
                                scale: 0.95,
                                y: dropdownStyles.placement === 'bottom' ? -10 : 10
                            }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{
                                opacity: 0,
                                scale: 0.95,
                                y: dropdownStyles.placement === 'bottom' ? -10 : 10
                            }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            style={{
                                transformOrigin: dropdownStyles.placement === 'bottom' ? 'top center' : 'bottom center',
                                translateY: dropdownStyles.placement === 'top' ? '-100%' : '0'
                            }}
                            className="bg-[#121212] rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,1)] border border-white/10 overflow-hidden ring-1 ring-white/5 flex flex-col"
                        >
                            {searchable && (
                                <div className="p-4 border-b border-white/[0.05] bg-white/[0.02]">
                                    <div className="relative group/search">
                                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within/search:text-primary transition-all duration-300" />
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="FILTER REGISTRY..."
                                            className="w-full pl-11 pr-4 py-3 text-[11px] rounded-xl bg-black/40 border border-white/5 focus:border-primary/40 focus:bg-black/60 outline-none text-white placeholder:text-white/20 font-black uppercase tracking-[0.2em] transition-all duration-500"
                                        />
                                    </div>
                                </div>
                            )}

                            <div
                                className="overflow-y-auto p-2 custom-scrollbar"
                                style={{ maxHeight: `${dropdownStyles.maxHeight}px` }}
                                ref={listRef}
                            >
                                {filteredOptions.length > 0 ? (
                                    filteredOptions.map((option, index) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => handleSelect(option.value)}
                                            onMouseEnter={() => setActiveIndex(index)}
                                            className={`
                                                w-full flex items-center gap-4 px-5 py-4 text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all duration-300 group select-none cursor-pointer mb-1 last:mb-0 border border-transparent italic
                                                ${value === option.value
                                                    ? 'bg-primary/10 text-primary border-primary/20 shadow-lg'
                                                    : activeIndex === index
                                                        ? 'bg-white/[0.06] text-white border-white/5'
                                                        : 'text-white/30 hover:text-white/60'
                                                }
                                            `}
                                        >
                                            <span className="flex-grow text-left truncate">{option.label}</span>
                                            {value === option.value && (
                                                <CheckCircleIcon className="w-4 h-4 text-primary animate-in zoom-in-50" />
                                            )}
                                        </button>
                                    ))
                                ) : (
                                    emptyState || (
                                        <div className="px-6 py-12 text-center space-y-4">
                                            <div className="inline-flex p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                                                <SearchIcon className="w-6 h-6 text-white/10" />
                                            </div>
                                            <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.3em] italic">
                                                No Matches
                                            </p>
                                        </div>
                                    )
                                )}
                            </div>
                        </motion.div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );

    return (
        <div
            className={`relative group w-full ${className || ''} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            ref={containerRef}
            onKeyDown={handleKeyDown}
            tabIndex={disabled ? -1 : 0}
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-controls={dropdownId}
            aria-label={label}
        >
            {label && (
                <label className={`block mb-3 ml-1 text-[10px] font-black uppercase tracking-[0.3em] transition-all duration-500 italic
                    ${isOpen ? 'text-primary translate-x-1' : isSynced ? 'text-primary' : 'text-white/30'}`}>
                    {label}
                </label>
            )}

            <div className="relative h-[68px]">
                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={`
                        w-full h-full text-left rounded-[1.8rem] transition-all duration-500 ease-out outline-none select-none
                        flex items-center px-8 border-2 shadow-[inner_0_2px_4px_rgba(0,0,0,0.3)]
                        ${icon ? 'pl-16' : 'pl-8'}
                        ${isOpen
                            ? 'bg-[#121212] border-primary/40 ring-4 ring-primary/10 shadow-[0_20px_40px_-15px_rgba(var(--primary),0.2)]'
                            : 'bg-[#0a0a0b] border-white/5 hover:border-white/10 hover:bg-white/[0.02]'
                        }
                        ${isSynced && !isOpen ? 'border-primary/20 bg-primary/[0.03]' : ''}
                    `}
                >
                    <span className="flex items-center h-full min-w-0 flex-grow">
                        {selectedOption ? (
                            <span className={`font-black text-[14px] uppercase tracking-wider transition-all duration-500 ${isOpen ? 'text-white' : isSynced ? 'text-primary' : 'text-white/90'}`}>
                                {selectedOption.label}
                            </span>
                        ) : (
                            <span className="text-white/15 font-bold text-[13px] truncate italic tracking-widest">{placeholder}</span>
                        )}
                    </span>
                </button>

                {icon && (
                    <div className={`absolute left-6 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none transition-all duration-500 
                        ${isOpen ? 'text-primary scale-110' : isSynced ? 'text-primary' : 'text-white/15'}`}>
                        {icon}
                    </div>
                )}

                <span className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                    <ChevronDownIcon className={`h-4 w-4 transition-all duration-500 ${isOpen ? 'rotate-180 text-primary' : 'text-white/10'}`} />
                </span>
            </div>

            {mounted && typeof document !== 'undefined' ? createPortal(dropdownContent, document.body) : null}
        </div>
    );
};

export default CustomSelect;