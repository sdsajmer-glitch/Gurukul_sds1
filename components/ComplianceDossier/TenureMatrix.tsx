import React from 'react';
import { motion } from 'framer-motion';
import { ClockIcon } from '../icons/ClockIcon';
import { ShieldCheckIcon } from '../icons/ShieldCheckIcon';
import { StarIcon } from '../icons/StarIcon';

interface TenureMatrixProps {
    joiningDate: string;
    status: string;
}

const RegulatoryBadge: React.FC<{ label: string; active?: boolean }> = ({ label, active }) => (
    <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${active
            ? 'bg-emerald-500/[0.03] border-emerald-500/20 text-emerald-500'
            : 'bg-white/[0.01] border-white/5 text-white/20'
        }`}>
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
        {active ? <ShieldCheckIcon className="w-3.5 h-3.5" /> : <ClockIcon className="w-3.5 h-3.5" />}
    </div>
);

const TenureMatrix: React.FC<TenureMatrixProps> = ({
    joiningDate,
    status
}) => {
    // Calculate tenure simplified
    const joinYear = new Date(joiningDate).getFullYear();
    const currentYear = new Date().getFullYear();
    const years = currentYear - joinYear;

    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl h-full flex flex-col shadow-sm overflow-hidden">
            <div className="px-8 py-5 border-b border-white/5 bg-white/[0.01]">
                <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Tenure Intelligence</h3>
                <p className="text-[10px] font-medium text-white/20 uppercase tracking-widest italic">Institutional loyalty map</p>
            </div>

            <div className="flex-grow p-8 space-y-8">
                <div className="p-8 bg-primary/[0.03] border border-primary/10 rounded-2xl text-center space-y-4">
                    <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.4em]">Cumulative Tenure</p>
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-5xl font-serif font-black text-white">{years}</span>
                        <span className="text-sm font-bold text-white/20 uppercase tracking-widest">Years</span>
                    </div>
                    <p className="text-[9px] font-bold text-white/10 uppercase tracking-widest leading-relaxed">
                        RECORDED INSTITUTIONAL IMPACT <br /> SINCE {joinYear}
                    </p>
                </div>

                <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] pl-1">Regulatory Badges</h4>
                    <RegulatoryBadge label="KYC_VERIFICATION" active={true} />
                    <RegulatoryBadge label="BACKGROUND_SCREEN" active={true} />
                    <RegulatoryBadge label="ACADEMIC_AUDIT" active={true} />
                    <RegulatoryBadge label="CONDUCT_CERTIFIED" active={status === 'Active'} />
                </div>
            </div>

            <div className="p-6 border-t border-white/5 bg-white/[0.01]">
                <div className="flex items-center justify-between px-2">
                    <div className="space-y-1">
                        <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Node Status</p>
                        <p className={`text-[11px] font-black uppercase tracking-widest ${status === 'Active' ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {status || 'STABLE'}
                        </p>
                    </div>
                    <StarIcon className="w-5 h-5 text-primary/20" />
                </div>
            </div>
        </div>
    );
};

export default TenureMatrix;
