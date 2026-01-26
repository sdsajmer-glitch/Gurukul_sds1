import React, { useState, useEffect } from 'react';
import { SchoolIcon } from '../icons/SchoolIcon';
import { motion, AnimatePresence } from 'framer-motion';

interface PageLoaderProps {
    label?: string;
    sublabel?: string;
}

const BOOT_LOGS = [
    "Establishing secure institutional node...",
    "Synchronizing identity matrix...",
    "Decrypting governance protocols...",
    "Resolving administrative node hierarchy...",
    "Initializing high-fidelity analytics...",
    "Securing encrypted data streams...",
    "Verifying institutional handshake..."
];

const PageLoader: React.FC<PageLoaderProps> = ({ label, sublabel }) => {
    const [logIndex, setLogIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setLogIndex((prev) => (prev + 1) % BOOT_LOGS.length);
        }, 1800);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#08090a] text-center p-6 relative overflow-hidden">
            {/* 3D Atmospheric Background Layers */}
            <motion.div 
                animate={{ 
                    scale: [1, 1.15, 1],
                    opacity: [0.3, 0.4, 0.3],
                    rotate: [0, 90, 180, 270, 360]
                }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.08)_0%,transparent_70%)] pointer-events-none"
            ></motion.div>
            
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02] pointer-events-none z-0"></div>

            <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.5, ease: [0.23, 1, 0.32, 1] }}
                className="relative z-10 flex flex-col items-center gap-14"
            >
                {/* Branding Core with Dual Orbital Rings */}
                <div className="relative group">
                    {/* Outer slow ring */}
                    <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                        className="absolute -inset-12 rounded-[3.5rem] border border-white/[0.02] shadow-[0_0_50px_rgba(255,255,255,0.01)]"
                    />
                    {/* Inner fast ring */}
                    <motion.div 
                        animate={{ rotate: -360 }}
                        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                        className="absolute -inset-8 rounded-[2.5rem] border border-primary/20 shadow-[0_0_30px_rgba(var(--primary),0.05)]"
                    />
                    
                    {/* Glowing Core */}
                    <div className="absolute -inset-10 rounded-full bg-primary/5 blur-3xl animate-pulse-velvet"></div>
                    
                    <div className="relative w-24 h-24 bg-[#0d0f14] border border-white/10 rounded-[2.5rem] flex items-center justify-center shadow-[0_32px_64px_-16px_rgba(0,0,0,1)] ring-1 ring-white/5 overflow-hidden">
                        <SchoolIcon className="h-10 w-10 text-primary drop-shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.03] via-transparent to-transparent"></div>
                    </div>
                </div>
                
                <div className="space-y-8 min-h-[140px]">
                    <div className="flex flex-col items-center gap-3">
                        <h2 className="text-[11px] font-black text-white tracking-[1.1em] uppercase leading-none ml-2 text-primary/80">
                            {label || "INITIALIZING GURUKUL OS"}
                        </h2>
                        <div className="w-16 h-[1.5px] bg-gradient-to-r from-transparent via-primary/50 to-transparent rounded-full mt-1"></div>
                    </div>

                    <div className="h-6">
                        <AnimatePresence mode="wait">
                            <motion.p 
                                key={logIndex}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.6, ease: "easeInOut" }}
                                className="text-[15px] font-serif italic text-white/30 tracking-wide max-w-sm mx-auto leading-relaxed"
                            >
                                {sublabel || BOOT_LOGS[logIndex]}
                            </motion.p>
                        </AnimatePresence>
                    </div>
                </div>

                {/* Progress Visualizer - Hardware Accelerated */}
                <div className="flex flex-col items-center gap-5">
                    <div className="w-64 h-[1px] bg-white/[0.04] rounded-full overflow-hidden relative border border-white/[0.01]">
                        <motion.div 
                            className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-transparent via-primary/80 to-transparent"
                            animate={{ 
                                left: ["-100%", "100%"],
                                width: ["20%", "50%", "20%"]
                            }}
                            transition={{ 
                                duration: 2.2, 
                                repeat: Infinity, 
                                ease: "easeInOut" 
                            }}
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[8px] font-mono font-black text-white/10 uppercase tracking-[0.4em]">Node Cluster: 24.2.5</span>
                        <div className="w-1 h-1 rounded-full bg-white/5"></div>
                        <span className="text-[8px] font-mono font-black text-white/10 uppercase tracking-[0.4em]">Status: HANDSHAKE_OK</span>
                    </div>
                </div>
            </motion.div>
            
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.6em] text-white/5 select-none pointer-events-none">
                <span className="font-serif italic tracking-widest">Institutional Grade</span>
                <div className="w-1 h-1 rounded-full bg-white/10"></div>
                <span>Secured Deployment</span>
            </div>
        </div>
    );
};

export default PageLoader;