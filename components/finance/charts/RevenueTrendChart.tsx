import React from 'react';

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
    
    const height = 280;
    const width = 800;
    const padding = 40;
    
    const max = Math.max(...revenueData, ...expenseData, 1) * 1.2;
    const min = 0;
    
    const getPoints = (data: number[]) => {
        return data.map((val, i) => {
            const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
            const y = height - ((val - min) / (max - min)) * (height - padding * 2) - padding;
            return `${x},${y}`;
        }).join(' ');
    };

    const revPoints = getPoints(revenueData);
    const expPoints = getPoints(expenseData);

    return (
        <div className="w-full h-full flex flex-col font-sans">
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
            
            <div className="relative flex-grow w-full overflow-hidden">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="expGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.1" />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Horizontal Grid */}
                    {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                        <line 
                            key={i} 
                            x1={padding} 
                            y1={padding + (height - 2*padding) * (1-p)} 
                            x2={width-padding} 
                            y2={padding + (height - 2*padding) * (1-p)} 
                            stroke="white" 
                            strokeOpacity="0.03" 
                            strokeWidth="1"
                        />
                    ))}

                    {/* Revenue Area */}
                    <path 
                        d={`M ${padding},${height-padding} L ${revPoints} L ${width-padding},${height-padding} Z`} 
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
                </svg>
            </div>
            
            <div className="flex justify-between px-6 mt-4 text-[9px] font-black text-white/10 uppercase tracking-[0.4em]">
                {months.map(m => <span key={m}>{m}</span>)}
            </div>
        </div>
    );
};

export default RevenueTrendChart;