import React from 'react';
import { PlusIcon } from '../icons/PlusIcon';

interface ExpandNetworkCardProps {
    onClick: () => void;
}

export function ExpandNetworkCard({ onClick }: ExpandNetworkCardProps) {
    return (
        <button
            onClick={onClick}
            className="group relative border-2 border-dashed border-white/10 hover:border-primary/40 rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-6 cursor-pointer transition-all duration-300 hover:bg-white/[0.01] focus:outline-none focus:ring-4 focus:ring-primary/20 min-h-[280px] w-full"
            aria-label="Add new branch to network"
        >
            {/* Icon */}
            <div className="relative">
                <div className="absolute inset-0 bg-primary/10 rounded-2xl blur-xl scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative w-16 h-16 rounded-2xl bg-white/5 group-hover:bg-primary/10 border border-white/10 group-hover:border-primary/30 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                    <PlusIcon className="w-8 h-8 text-white/20 group-hover:text-primary transition-colors duration-300 group-hover:rotate-90" />
                </div>
            </div>

            {/* Text */}
            <div className="space-y-2">
                <h3 className="text-base font-black text-white/60 group-hover:text-white uppercase tracking-tight transition-colors">Add Branch</h3>
                <p className="text-xs text-white/20 group-hover:text-white/40 font-medium transition-colors">Expand institutional reach</p>
            </div>
        </button>
    );
}
