import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RevenueTrendChartProps {
    total: number;
    expensesTotal?: number;
    trends?: {
        revenue: { month: string; value: number; m_idx: number }[];
        expenses: { month: string; value: number; m_idx: number }[];
    };
}

const RevenueTrendChart: React.FC<RevenueTrendChartProps> = ({ total, expensesTotal = 0, trends }) => {
    // Standardize 12-month array
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Initialize data arrays
    const revenueData = new Array(12).fill(0);
    const expenseData = new Array(12).fill(0);

    if (trends) {
        trends.revenue?.forEach(r => { if (r.m_idx >= 1 && r.m_idx <= 12) revenueData[r.m_idx - 1] = Number(r.value); });
        trends.expenses?.forEach(e => { if (e.m_idx >= 1 && e.m_idx <= 12) expenseData[e.m_idx - 1] = Number(e.value); });
    } else {
        // Mock fallback if trends not yet available
        [0.4, 0.6, 0.5, 0.8, 0.7, 0.9, 0.85, 1.1, 0.95, 1.2, 1.1, 1.3].forEach((v, i) => revenueData[i] = v * (total / 10));
        [0.2, 0.3, 0.4, 0.5, 0.45, 0.6, 0.55, 0.7, 0.65, 0.8, 0.75, 0.9].forEach((v, i) => expenseData[i] = v * (expensesTotal / 8));
    }

    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const height = 280;
    const width = 800;
    const padding = 40;

    const max = Math.max(...revenueData, ...expenseData, 1) * 1.25; // Add some headroom
    const min = 0;

    // Helper to calculate coordinates
    const getX = (i: number) => (i / (11)) * (width - padding * 2) + padding; // 11 segments for 12 points
    const getY = (val: number) => height - ((val - min) / (max - min)) * (height - padding * 2) - padding;

    const getPoints = (data: number[]) => {
        return data.map((val, i) => `${getX(i)},${getY(val)}`).join(' ');
    };

    const revPoints = getPoints(revenueData);
    const expPoints = getPoints(expenseData);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;

        // Calculate the relative X position within the SVG coordinate space
        // The SVG preserves aspect ratio, so we need to account for the current rendered size
        const renderedWidth = rect.width;
        const scaleX = width / renderedWidth;
        const svgX = x * scaleX;

        // Map svgX to the nearest index
        // The data area spans from `padding` to `width - padding`
        const dataAreaWidth = width - (padding * 2);
        const relativeX = svgX - padding;

        let index = Math.round((relativeX / dataAreaWidth) * 11);

        // Clamp index to valid range
        if (index < 0) index = 0;
        if (index > 11) index = 11;

        setHoverIndex(index);
    };

    const formatShortCurrency = (val: number) => {
        if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
        if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
        return val.toFixed(0);
    };

    // Calculate position for the tooltip to prevent overflow
    const getTooltipStyle = () => {
        if (hoverIndex === null) return {};

        // Percent position
        const leftPercent = (hoverIndex / 11) * 100;

        // If we are on the far right, shift transform to keep it visible
        let translateX = '-50%';
        if (hoverIndex > 9) translateX = '-85%';
        if (hoverIndex < 2) translateX = '-15%';

        return {
            left: `${leftPercent}%`,
            transform: `translateX(${translateX})`
        };
    };

    return (
        <div className="w-full h-full flex flex-col font-sans select-none">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em]">Node Flow Analysis</h4>
                    <p className="text-2xl font-serif font-black text-white mt-1 uppercase tracking-tight">Collection vs Burn</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.8)]"></div>
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Collections</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                        <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Expenses</span>
                    </div>
                </div>
            </div>

            <div className="relative flex-grow w-full">
                {/* Chart Container */}
                <div
                    ref={containerRef}
                    className="absolute inset-0 z-10 cursor-crosshair"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setHoverIndex(null)}
                >
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
                                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                            </linearGradient>
                        </defs>

                        {/* Horizontal Grid */}
                        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                            <line
                                key={i}
                                x1={padding}
                                y1={padding + (height - 2 * padding) * (1 - p)}
                                x2={width - padding}
                                y2={padding + (height - 2 * padding) * (1 - p)}
                                stroke="white"
                                strokeOpacity="0.03"
                                strokeWidth="1"
                            />
                        ))}

                        {/* Revenue Area */}
                        <path
                            d={`M ${padding},${height - padding} L ${revPoints} L ${width - padding},${height - padding} Z`}
                            fill="url(#revGradient)"
                        />

                        {/* Expense Line */}
                        <polyline
                            points={expPoints}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth="2"
                            strokeDasharray="8,4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                            opacity="0.6"
                        />

                        {/* Revenue Line */}
                        <polyline
                            points={revPoints}
                            fill="none"
                            stroke="hsl(var(--primary))"
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                            className="drop-shadow-[0_0_15px_rgba(var(--primary),0.5)]"
                        />

                        {/* Hover Overlay */}
                        <AnimatePresence>
                            {hoverIndex !== null && (
                                <g>
                                    <motion.line
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        x1={getX(hoverIndex)}
                                        x2={getX(hoverIndex)}
                                        y1={padding}
                                        y2={height - padding}
                                        stroke="white"
                                        strokeWidth="1"
                                        strokeDasharray="4,4"
                                        opacity="0.5"
                                    />
                                    <motion.circle
                                        cx={getX(hoverIndex)}
                                        cy={getY(revenueData[hoverIndex])}
                                        r="6"
                                        fill="hsl(var(--primary))"
                                        stroke="white"
                                        strokeWidth="2"
                                    />
                                    <motion.circle
                                        cx={getX(hoverIndex)}
                                        cy={getY(expenseData[hoverIndex])}
                                        r="4"
                                        fill="#ef4444"
                                        stroke="white"
                                        strokeWidth="1"
                                    />
                                </g>
                            )}
                        </AnimatePresence>
                    </svg>
                </div>

                {/* Tooltip Overlay (Separate from SVG to handle Overflow properly) */}
                <div className="absolute inset-0 pointer-events-none z-20">
                    <AnimatePresence>
                        {hoverIndex !== null && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute top-0 mt-4"
                                style={getTooltipStyle()}
                            >
                                <div className="bg-[#0c0d12]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-[0_20px_40px_-10px_rgba(0,0,0,1)] flex flex-col gap-3 min-w-[160px] ring-1 ring-white/5 relative">
                                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#0c0d12] border-t border-l border-white/10 rotate-45 transform"></div>

                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 text-center mb-1 border-b border-white/5 pb-2">{months[hoverIndex]}</p>

                                    <div className="flex justify-between items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                                            <span className="text-[10px] font-black uppercase text-white/60 tracking-widest">In</span>
                                        </div>
                                        <span className="font-mono font-black text-white text-sm">{formatShortCurrency(revenueData[hoverIndex])}</span>
                                    </div>

                                    <div className="flex justify-between items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                                            <span className="text-[10px] font-black uppercase text-white/60 tracking-widest">Out</span>
                                        </div>
                                        <span className="font-mono font-black text-white/60 text-sm">{formatShortCurrency(expenseData[hoverIndex])}</span>
                                    </div>

                                    {revenueData[hoverIndex] > expenseData[hoverIndex] ? (
                                        <div className="mt-1 pt-2 border-t border-white/5 text-center">
                                            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Net Positive</span>
                                        </div>
                                    ) : (
                                        <div className="mt-1 pt-2 border-t border-white/5 text-center">
                                            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Net Negative</span>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div className="flex justify-between px-6 mt-4 text-[9px] font-black text-white/10 uppercase tracking-[0.4em] relative z-0">
                {months.map((m, i) => (
                    <span
                        key={m}
                        className={`transition-all duration-300 transform ${hoverIndex === i ? 'text-white scale-110' : ''}`}
                    >
                        {m}
                    </span>
                ))}
            </div>
        </div>
    );
};

export default RevenueTrendChart;