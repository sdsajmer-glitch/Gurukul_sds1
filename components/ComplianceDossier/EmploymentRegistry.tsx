import React from 'react';
import { motion } from 'framer-motion';
import { BriefcaseIcon } from '../icons/BriefcaseIcon';
import { KeyIcon } from '../icons/KeyIcon';
import { GridIcon } from '../icons/GridIcon';

interface EmploymentRegistryProps {
    employeeId: string;
    department: string;
    designation: string;
    joiningDate: string;
    employmentType: string;
}

const DataField: React.FC<{ label: string; value: string; meta: string }> = ({ label, value, meta }) => (
    <div className="py-4 border-b border-white/[0.03] last:border-0 group/field">
        <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-1">{label}</p>
        <div className="flex items-center justify-between">
            <span className="text-[14px] font-bold text-white/80 tracking-tight">{value || 'N/A'}</span>
            <span className="text-[9px] font-black text-white/[0.05] uppercase tracking-widest italic group-hover/field:text-primary/20 transition-colors">{meta}</span>
        </div>
    </div>
);

const EmploymentRegistry: React.FC<EmploymentRegistryProps> = ({
    employeeId,
    department,
    designation,
    joiningDate,
    employmentType
}) => {
    return (
        <div className="bg-[#14161c] border border-white/5 rounded-2xl p-8 shadow-sm space-y-8">
            <div className="flex items-center justify-between border-b border-white/5 pb-5">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary ring-1 ring-primary/20 shadow-lg">
                        <BriefcaseIcon className="w-5 h-5" />
                    </div>
                    <h3 className="text-[14px] font-bold text-white uppercase tracking-wider">Professional Details</h3>
                </div>
                <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">Staff Status</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                <DataField label="Employee ID" value={employeeId} meta="FACULTY_ID" />
                <DataField label="Department" value={department} meta="DEPARTMENT" />
                <DataField label="Designation" value={designation} meta="RANK" />
                <DataField label="Joining Date" value={joiningDate} meta="JOIN_DATE" />
                <DataField label="Employment Type" value={employmentType} meta="CONTRACT" />
                <DataField label="Staff Category" value="Standard Faculty" meta="FACULTY_CLASS" />
            </div>
        </div>
    );
};

export default EmploymentRegistry;
