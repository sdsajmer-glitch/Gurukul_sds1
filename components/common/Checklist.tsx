import React, { useState } from 'react';
import { CheckIcon as Check } from '../icons/CheckIcon';
import { AlertTriangleIcon as AlertTriangle } from '../icons/AlertTriangleIcon';
import { InfoIcon as Info } from '../icons/InfoIcon';
import { SquareIcon as Square } from '../icons/SquareIcon';
import { ChevronDownIcon as ChevronDown } from '../icons/ChevronDownIcon';
import { ChevronRightIcon as ChevronRight } from '../icons/ChevronRightIcon';
import { AlertCircleIcon as AlertCircle } from '../icons/AlertCircleIcon';
import { motion, AnimatePresence } from 'framer-motion';

// ----------------------------------------------------------------------
// Types & Interfaces
// ----------------------------------------------------------------------

export type ChecklistState = 'unchecked' | 'checked' | 'blocked' | 'info';

interface ChecklistContainerProps {
    children: React.ReactNode;
    className?: string;
    type?: 'ui-polish' | 'accessibility' | 'dev-handoff';
}

interface ChecklistHeaderProps {
    title: string;
    subtitle?: string;
    className?: string;
}

interface ChecklistSectionProps {
    title: string;
    children: React.ReactNode;
    defaultExpanded?: boolean;
}

interface ChecklistItemProps {
    label: string;
    state?: ChecklistState;
    statusTag?: string; // e.g. "REQUIRED", "OPTIONAL"
    onChange?: (newState: ChecklistState) => void;
    className?: string;
}

interface ChecklistFooterProps {
    children: React.ReactNode;
}

// ----------------------------------------------------------------------
// 1. Checklist Container
// ----------------------------------------------------------------------

export const Checklist = ({ children, className = '', type = 'ui-polish' }: ChecklistContainerProps) => {
    return (
        <div className={`flex flex-col p-6 gap-5 rounded-2xl bg-[#0F1116] border border-white/5 w-full max-w-md shadow-2xl ${className}`}>
            {children}
        </div>
    );
};

// ----------------------------------------------------------------------
// 2. Header
// ----------------------------------------------------------------------

const Header = ({ title, subtitle, className = '' }: ChecklistHeaderProps) => {
    return (
        <div className={`flex flex-col gap-1 pb-4 border-b border-white/5 ${className}`}>
            <h3 className="text-base font-semibold text-white tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-white/40 font-medium">{subtitle}</p>}
        </div>
    );
};

// ----------------------------------------------------------------------
// 3. Section
// ----------------------------------------------------------------------

const Section = ({ title, children, defaultExpanded = true }: ChecklistSectionProps) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <div className="flex flex-col gap-3">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white transition-colors text-left"
            >
                {isExpanded ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
                {title}
            </button>

            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-col gap-2 overflow-hidden pl-1"
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ----------------------------------------------------------------------
// 4. Checklist Item (Core)
// ----------------------------------------------------------------------

const Item = ({ label, state = 'unchecked', statusTag, onChange, className = '' }: ChecklistItemProps) => {
    const [internalState, setInternalState] = useState<ChecklistState>(state);

    // Sync internal state if prop changes (optional, depending on usage pattern)
    // For this demo, we'll rely on internal state if onChange isn't prevented or controlled purely by outside.
    // In a real app, strict control is better, but for a drag-and-drop component, hybrid is nice.

    const currentState = state !== undefined ? state : internalState;

    const handleClick = () => {
        if (currentState === 'blocked') return; // Blocked must be manually changed (user rule)

        const nextState = currentState === 'checked' ? 'unchecked' : 'checked';
        setInternalState(nextState);
        if (onChange) onChange(nextState);
    };

    // Configuration based on state
    const config = {
        unchecked: {
            bg: 'bg-transparent hover:bg-white/[0.02]',
            border: 'border border-transparent', // Placeholder for alignment
            text: 'text-white/90',
            icon: <Square className="w-[18px] h-[18px] text-white/20" />,
            checkboxClass: 'text-white/20'
        },
        checked: {
            bg: 'bg-emerald-500/10',
            border: 'border border-transparent',
            text: 'text-white/40 line-through decoration-white/20',
            icon: <div className="w-[18px] h-[18px] bg-emerald-500 rounded flex items-center justify-center"><Check className="w-3 h-3 text-[#0F1116] stroke-[3]" /></div>,
            checkboxClass: 'text-emerald-500'
        },
        blocked: {
            bg: 'bg-amber-500/10',
            border: 'border border-amber-500/20',
            text: 'text-amber-200/90',
            icon: <AlertTriangle className="w-[18px] h-[18px] text-amber-500" />,
            checkboxClass: 'text-amber-500'
        },
        info: {
            bg: 'bg-blue-500/5',
            border: 'border border-blue-500/10',
            text: 'text-blue-200/60',
            icon: <Info className="w-[18px] h-[18px] text-blue-400" />,
            checkboxClass: 'text-blue-400'
        }
    };

    const currentConfig = config[currentState];

    return (
        <motion.div
            layout
            onClick={handleClick}
            className={`
                group flex items-start gap-3 px-3 py-2.5 rounded-[10px] cursor-pointer transition-all duration-200
                ${currentConfig.bg} ${currentConfig.border} ${className}
            `}
        >
            {/* Checkbox / Icon Area */}
            <div className={`mt-0.5 flex-shrink-0 transition-colors duration-200 ${currentConfig.checkboxClass}`}>
                {currentConfig.icon}
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col gap-1.5">
                <span className={`text-[13px] font-medium leading-relaxed transition-colors duration-200 ${currentConfig.text}`}>
                    {label}
                </span>
            </div>

            {/* Optional Status Tag */}
            {statusTag && (
                <div className={`
                    flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                    ${currentState === 'blocked' ? 'bg-amber-500/20 text-amber-500' : 'bg-white/5 text-white/30'}
                `}>
                    {statusTag}
                </div>
            )}
        </motion.div>
    );
};

// ----------------------------------------------------------------------
// 5. Footer
// ----------------------------------------------------------------------

const Footer = ({ children }: ChecklistFooterProps) => {
    return (
        <div className="pt-4 mt-auto border-t border-white/5 flex items-center justify-between text-xs text-white/30 font-mono">
            {children}
        </div>
    );
};

// ----------------------------------------------------------------------
// Extensions & Exports
// ----------------------------------------------------------------------

Checklist.Header = Header;
Checklist.Section = Section;
Checklist.Item = Item;
Checklist.Footer = Footer;

export default Checklist;
