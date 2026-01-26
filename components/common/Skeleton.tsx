import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonBaseProps {
    className?: string;
    key?: React.Key;
    glow?: boolean;
}

const ShimmerOverlay = () => (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ 
                duration: 1.5, 
                repeat: Infinity, 
                ease: "linear" 
            }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent"
        />
    </div>
);

/**
 * High-fidelity Skeletons for the Gurukul OS Design System
 */
export const Skeleton = {
    Line: ({ className, variant = 'body', width = '75%', glow = false }: SkeletonBaseProps & { variant?: 'title' | 'body' | 'caption', width?: string }) => {
        const heightMap = {
            title: 'h-[24px]',
            body: 'h-[16px]',
            caption: 'h-[12px]'
        };
        return (
            <div 
                style={{ width }}
                className={`relative bg-white/[0.02] rounded-[8px] overflow-hidden border border-white/[0.03] ${heightMap[variant]} ${glow ? 'shadow-[0_0_15px_rgba(var(--primary),0.1)] ring-1 ring-primary/10' : ''} ${className}`}
            >
                <ShimmerOverlay />
            </div>
        );
    },

    Avatar: ({ className, size = 'md', glow = false }: SkeletonBaseProps & { size?: 'sm' | 'md' | 'lg' }) => {
        const sizeMap = {
            sm: 'w-8 h-8',
            md: 'w-12 h-12',
            lg: 'w-24 h-24'
        };
        return (
            <div className={`relative bg-white/[0.03] rounded-full overflow-hidden border border-white/[0.05] shadow-inner ${glow ? 'shadow-[0_0_20px_rgba(var(--primary),0.15)] ring-1 ring-primary/20' : ''} ${sizeMap[size]} ${className}`}>
                <ShimmerOverlay />
            </div>
        );
    },

    Button: ({ className, width = '140px', glow = false }: SkeletonBaseProps & { width?: string }) => (
        <div 
            style={{ width }}
            className={`relative h-[52px] bg-white/[0.03] rounded-2xl overflow-hidden border border-white/[0.05] ${glow ? 'border-primary/20 shadow-lg' : ''} ${className}`}
        >
            <ShimmerOverlay />
        </div>
    ),

    Card: ({ className, children, glow = false }: SkeletonBaseProps & { children?: React.ReactNode }) => (
        <div className={`relative bg-[#0c0d12]/60 border border-white/5 rounded-[2.5rem] p-10 overflow-hidden shadow-2xl ${glow ? 'ring-1 ring-primary/10 shadow-primary/5' : ''} ${className}`}>
            {children || (
                <div className="space-y-8">
                    <div className="flex justify-between items-start">
                        <Skeleton.Avatar size="md" />
                        <Skeleton.Line variant="caption" width="60px" />
                    </div>
                    <div className="space-y-4">
                        <Skeleton.Line variant="title" width="40%" />
                        <Skeleton.Line variant="body" width="90%" />
                    </div>
                </div>
            )}
            <ShimmerOverlay />
        </div>
    ),

    Metric: ({ className, glow = false }: SkeletonBaseProps) => (
        <div className={`relative bg-[#0c0d12]/80 border border-white/5 rounded-[2.5rem] p-8 overflow-hidden min-h-[160px] shadow-[0_32px_64px_-24px_rgba(0,0,0,0.8)] ${glow ? 'ring-1 ring-primary/20' : ''} ${className}`}>
            <div className="absolute left-0 top-10 bottom-10 w-[2px] bg-primary/20 rounded-r-full"></div>
            <div className="flex justify-between items-start mb-8">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/5 overflow-hidden relative">
                    <ShimmerOverlay />
                </div>
                <Skeleton.Line variant="caption" width="40px" />
            </div>
            <div className="space-y-3">
                <Skeleton.Line variant="caption" width="50%" />
                <Skeleton.Line variant="title" width="80%" className="h-9" />
            </div>
            <ShimmerOverlay />
        </div>
    ),

    List: ({ rows = 5 }: { rows?: number }) => (
        <div className="bg-[#0a0b0f] border border-white/5 rounded-[3.5rem] overflow-hidden p-10 space-y-10 shadow-2xl">
            {[...Array(rows)].map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-8 py-4 border-b border-white/[0.02] last:border-0">
                    <div className="flex items-center gap-6 flex-grow">
                        <Skeleton.Avatar size="md" />
                        <div className="space-y-3 flex-grow">
                            <Skeleton.Line variant="title" width="30%" />
                            <Skeleton.Line variant="caption" width="20%" />
                        </div>
                    </div>
                    <Skeleton.Button width="120px" />
                </div>
            ))}
        </div>
    )
};

export const StatsSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {[1, 2, 3, 4].map(i => <Skeleton.Metric key={i} glow={i === 1} />)}
    </div>
);