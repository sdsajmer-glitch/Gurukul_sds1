import React from 'react';

const BackgroundEffects = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[150px] rounded-full animate-pulse [animation-delay:2s]" />

        {/* Fine Mesh Grid */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

        {/* Animated Scanline Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent h-24 w-full animate-scanner-move pointer-events-none opacity-20" />
    </div>
);

export default BackgroundEffects;
