import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { InfoIcon } from '../icons/InfoIcon';

interface ComplianceItem {
    label: string;
    status: 'passed' | 'review' | 'failed';
    details: string;
}

const complianceList: ComplianceItem[] = [
    { label: 'Background Screening', status: 'passed', details: 'Verified on 2026-01-15' },
    { label: 'Academic Credential Audit', status: 'passed', details: 'PhD Transcripts Authenticated' },
    { label: 'Regulatory Disclosure', status: 'passed', details: 'Self-declaration up to date' },
    { label: 'Conduct Certification', status: 'review', details: 'Annual renewal scheduled [T-14 days]' },
    { label: 'Health Clearance', status: 'passed', details: 'Valid until 2027-02-12' },
];

const ComplianceScorecard: React.FC = () => {
    return (
        <div className="p-10 bg-[#14161c] border border-white/5 rounded-[2.5rem] shadow-sm space-y-8">
            <div className="flex items-center justify-between border-b border-white/5 pb-5">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500 ring-1 ring-emerald-500/20">
                        <CheckCircleIcon className="w-5 h-5" />
                    </div>
                    <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Compliance Matrix</h3>
                </div>
                <div className="px-3 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Global Status: Clean</span>
                </div>
            </div>

            <div className="space-y-6">
                {complianceList.map((item, i) => (
                    <div key={i} className="flex items-start gap-4 group cursor-help">
                        <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${item.status === 'passed' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : item.status === 'review' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'bg-red-500'}`} />
                        <div className="flex-grow space-y-1">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black text-white/60 uppercase tracking-widest group-hover:text-white transition-colors">{item.label}</p>
                                <InfoIcon className="w-3 h-3 text-white/10 group-hover:text-white/30 transition-colors" />
                            </div>
                            <p className="text-[9px] font-bold text-white/10 uppercase tracking-[0.2em]">{item.details}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="pt-4 border-t border-white/[0.03]">
                <button className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-[10px] font-black text-white/60 uppercase tracking-[0.2em] transition-all">
                    Generate Governance PDF
                </button>
            </div>
        </div>
    );
};

export default ComplianceScorecard;
