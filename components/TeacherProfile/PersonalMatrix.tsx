import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TeacherExtended, TeacherSubjectMapping } from '../../types';
import { supabase } from '../../services/supabase';
import IdentityStrip from './IdentityStrip';
import KPIBar from './KPIBar';
import AcademicControlPanel from './AcademicControlPanel';
import PerformanceCards from './PerformanceCards';
import ActivityTimeline from './ActivityTimeline';
import AssignSubjectModal from '../teachers/AssignSubjectModal';

interface PersonalMatrixProps {
    teacher: TeacherExtended;
    onUpdate: () => void;
}

const PersonalMatrix: React.FC<PersonalMatrixProps> = ({ teacher, onUpdate }) => {
    const [mappings, setMappings] = useState<TeacherSubjectMapping[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

    const fetchMappings = useCallback(async () => {
        setLoading(true);
        const { data: mappingData, error } = await supabase
            .from('class_subjects')
            .select(`
                id, class_id, subject_id,
                school_classes(name, academic_year, section, grade_level),
                courses(title, credits, category)
            `)
            .eq('teacher_id', teacher.id);

        if (!error && mappingData) {
            setMappings(mappingData.map((m: any) => ({
                id: m.id,
                teacher_id: teacher.id,
                subject_id: m.subject_id,
                class_id: m.class_id,
                academic_year: m.school_classes?.academic_year || 'Not Set',
                class_name: m.school_classes?.name,
                subject_name: m.courses?.title,
                credits: m.courses?.credits,
                category: m.courses?.category
            })));
        }
        setLoading(false);
    }, [teacher.id]);

    useEffect(() => {
        fetchMappings();
    }, [fetchMappings]);

    const workloadHours = useMemo(() => {
        return mappings.reduce((acc, m) => acc + (m.credits || 4), 0);
    }, [mappings]);

    const handleRemoveMapping = async (id: number) => {
        const { error } = await supabase.from('class_subjects').update({ teacher_id: null }).eq('id', id);
        if (!error) {
            fetchMappings();
            onUpdate();
        }
    };

    const stats = {
        activeSections: mappings.length,
        totalStudents: mappings.length * 28, // Mock multiplier
        weeklyHours: workloadHours,
        completionRate: "98.4%",
        compliance: "Alpha",
        evalScore: 4.9
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-12 pb-24"
        >
            {/* Layer 1 - Identity Intelligence Strip */}
            <IdentityStrip teacher={teacher} />

            <div className="px-10 space-y-12">
                {/* Layer 2 - KPI Overview Strip */}
                <KPIBar stats={stats} />

                {/* Layer 3 - Academic Control Panel */}
                <AcademicControlPanel
                    mappings={mappings}
                    workloadHours={workloadHours}
                    maxLoad={teacher.details?.workload_limit || 30}
                    onAddMapping={() => setIsAssignModalOpen(true)}
                    onRemoveMapping={handleRemoveMapping}
                />

                {/* Layer 4 - Performance & Governance Layer */}
                <PerformanceCards />

                {/* Layer 5 - Activity Timeline */}
                <ActivityTimeline />
            </div>

            {isAssignModalOpen && (
                <AssignSubjectModal
                    teacher={teacher}
                    onClose={() => setIsAssignModalOpen(false)}
                    onSuccess={() => {
                        fetchMappings();
                        onUpdate();
                    }}
                />
            )}
        </motion.div>
    );
};

export default PersonalMatrix;
