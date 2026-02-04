import React from 'react';

interface CircularProgressProps {
    value: number; // 0–100
    size?: number;
    strokeWidth?: number;
    color?: string;
}

export function CircularProgress({ value, size = 48, strokeWidth = 4, color = "var(--color-accent-success)" }: CircularProgressProps) {
    const radius = size / 2;
    const normalizedRadius = radius - strokeWidth * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (value / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg height={size} width={size} className="rotate-[-90deg] transition-all duration-1000">
                <circle
                    stroke="var(--color-border-subtle)"
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                />
                <circle
                    stroke={color}
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <span className="absolute text-[10px] font-black text-white">{value}%</span>
        </div>
    );
}
