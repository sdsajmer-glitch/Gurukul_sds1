import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
    content: string;
    children: React.ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
    delay?: number;
    className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({
    content,
    children,
    position = 'top',
    delay = 0.2,
    className
}) => {
    const [isVisible, setIsVisible] = useState(false);
    let timeout: NodeJS.Timeout;

    const showTooltip = () => {
        timeout = setTimeout(() => setIsVisible(true), delay * 1000);
    };

    const hideTooltip = () => {
        clearTimeout(timeout);
        setIsVisible(false);
    };

    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };

    return (
        <div
            className={`relative flex items-center justify-center ${className || ''}`}
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
            onFocus={showTooltip}
            onBlur={hideTooltip}
        >
            {children}
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute z-50 px-3 py-1.5 bg-gray-900 border border-white/10 text-white text-[10px] font-medium tracking-wide rounded-lg shadow-xl whitespace-nowrap pointer-events-none ${positionClasses[position]}`}
                    >
                        {content}
                        {/* Arrow */}
                        <div className={`absolute w-2 h-2 bg-gray-900 border-r border-b border-white/10 transform rotate-45 
                            ${position === 'top' ? 'bottom-[-5px] left-1/2 -translate-x-1/2 border-l-0 border-t-0' : ''}
                            ${position === 'bottom' ? 'top-[-5px] left-1/2 -translate-x-1/2 border-r-0 border-b-0 bg-gray-900' : ''}
                            ${position === 'left' ? 'right-[-5px] top-1/2 -translate-y-1/2' : ''}
                            ${position === 'right' ? 'left-[-5px] top-1/2 -translate-y-1/2' : ''}
                        `}></div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Tooltip;
