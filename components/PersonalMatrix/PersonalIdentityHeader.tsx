import React from 'react';
import { motion } from 'framer-motion';
import { UserIcon } from '../icons/UserIcon';
import { EditIcon } from '../icons/EditIcon';
import { MoreVerticalIcon } from '../icons/MoreVerticalIcon';

interface PersonalIdentityHeaderProps {
    name: string;
    facultyCode: string;
    status: string;
    avatarUrl?: string;
}

const PersonalIdentityHeader: React.FC<PersonalIdentityHeaderProps> = ({
    name,
    facultyCode,
    status,
    avatarUrl
}) => {
    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl h-[90px] px-8 flex items-center justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className="flex items-center gap-6 relative z-10">
                <div className="relative">
                    <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-white/5 shadow-2xl ring-4 ring-primary/5">
                        <img
                            src={avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${name}`}
                            alt={name}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#14161c] shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                </div>

                <div className="space-y-0.5">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-serif font-black text-white uppercase tracking-tight">{name}</h1>
                        <span className="text-[9px] font-black text-primary/60 bg-primary/5 border border-primary/10 px-2 py-0.5 rounded-md uppercase tracking-widest">{status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">Institutional Node:</span>
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{facultyCode}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4 relative z-10">
                <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="h-11 px-6 bg-white text-black font-black text-[10px] uppercase tracking-[0.3em] rounded-xl shadow-xl hover:bg-white/90 transition-all flex items-center gap-3 group/btn"
                >
                    <EditIcon className="w-4 h-4" /> Full Audit
                </motion.button>
                <button className="h-11 w-11 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all">
                    <MoreVerticalIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default PersonalIdentityHeader;
