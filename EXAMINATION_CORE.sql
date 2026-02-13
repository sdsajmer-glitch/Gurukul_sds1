
-- =============================================================================
-- INSTITUTIONAL EXAMINATION CORE: SCHEMATIC INFRASTRUCTURE
-- =============================================================================
-- Description: Advanced database architecture for high-fidelity examination
--              orchestration, grading scales, and marks management.
-- Standard: ISO-Global Academic Compliance
-- =============================================================================

BEGIN;

-- CLEANUP (Optional: Only for re-running the entire schema)
-- DROP TABLE IF EXISTS result_snapshots CASCADE;
-- DROP TABLE IF EXISTS exam_marks_audit CASCADE;
-- DROP TABLE IF EXISTS exam_marks CASCADE;
-- DROP TABLE IF EXISTS subject_exams CASCADE;
-- DROP TABLE IF EXISTS grading_scale_nodes CASCADE;
-- DROP TABLE IF EXISTS grading_scales CASCADE;
-- DROP TABLE IF EXISTS exam_cycles CASCADE;

-- [1] EXAM PERIODS / CYCLES
-- Purpose: Manage terms (e.g., "Term 1", "Finals 2026")
CREATE TABLE IF NOT EXISTS exam_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id BIGINT NOT NULL REFERENCES school_branches(id) ON DELETE CASCADE,
    academic_cycle_id UUID NOT NULL REFERENCES academic_cycles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) CHECK (status IN ('draft', 'published', 'locked')) DEFAULT 'draft',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(branch_id, academic_cycle_id, name)
);

-- [2] GRADING SCHEMES
-- Purpose: Define percentage ranges for grades (e.g., A+: 90-100)
CREATE TABLE IF NOT EXISTS grading_scales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id BIGINT NOT NULL REFERENCES school_branches(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g., "CBSE Primary", "IBDP", "O-Level"
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grading_scale_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scale_id UUID NOT NULL REFERENCES grading_scales(id) ON DELETE CASCADE,
    grade VARCHAR(10) NOT NULL,
    min_percentage NUMERIC(5,2) NOT NULL,
    max_percentage NUMERIC(5,2) NOT NULL,
    point_value NUMERIC(3,2), -- GPA points
    remarks TEXT,
    color_code VARCHAR(10) DEFAULT '#4F46E5', -- UI Hex for grade visualization
    CHECK (min_percentage <= max_percentage)
);

-- [3] EXAM CONFIGURATION (The Subject Ledger)
-- Purpose: Define specific exams per subject (e.g., "Maths Midterm")
CREATE TABLE IF NOT EXISTS subject_exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_cycle_id UUID NOT NULL REFERENCES exam_cycles(id) ON DELETE CASCADE,
    class_id BIGINT NOT NULL, -- References classes table
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    total_marks NUMERIC(6,2) NOT NULL DEFAULT 100,
    passing_marks NUMERIC(6,2) DEFAULT 33,
    weightage NUMERIC(5,2) DEFAULT 100, -- Contribution to final grade
    exam_date DATE,
    start_time TIME,
    duration_minutes INTEGER,
    room_number TEXT,
    is_marks_published BOOLEAN DEFAULT FALSE,
    marks_published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [4] MARKS REGISTRY (Forensic Ledger)
-- Purpose: Store student marks with mutation tracking
CREATE TABLE IF NOT EXISTS exam_marks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_exam_id UUID NOT NULL REFERENCES subject_exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL, -- References unified Student ID
    marks_obtained NUMERIC(6,2),
    is_absent BOOLEAN DEFAULT FALSE,
    remarks TEXT,
    recorded_by UUID REFERENCES profiles(id),
    last_modified_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subject_exam_id, student_id)
);

-- [5] FORENSIC MARK AUDIT (Immutable)
-- Purpose: Track every modification to a student's marks
CREATE TABLE IF NOT EXISTS exam_marks_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    marks_id UUID NOT NULL REFERENCES exam_marks(id) ON DELETE CASCADE,
    old_marks NUMERIC(6,2),
    new_marks NUMERIC(6,2),
    reason TEXT,
    modified_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [6] RESULTS SNAPSHOTS (Finalized Report Cards)
-- Purpose: Cached final results for quick report card generation
CREATE TABLE IF NOT EXISTS result_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL,
    exam_cycle_id UUID NOT NULL REFERENCES exam_cycles(id) ON DELETE CASCADE,
    total_marks_obtained NUMERIC(8,2),
    percentage NUMERIC(5,2),
    grade VARCHAR(10),
    rank INTEGER,
    attendance_percentage NUMERIC(5,2),
    is_promoted BOOLEAN,
    final_remarks TEXT,
    snapshot_data JSONB, -- Serialized subject-wise breakdown
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, exam_cycle_id)
);

-- Trigger for updated_at in exam_marks
CREATE OR REPLACE FUNCTION update_exam_marks_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_exam_marks_timestamp
BEFORE UPDATE ON exam_marks
FOR EACH ROW EXECUTE FUNCTION update_exam_marks_timestamp();

-- [7] PERFORMANCE ARCHITECTURE (Indexes)
-- Optimize joins for Orchestration Dashboard
CREATE INDEX IF NOT EXISTS idx_exam_cycles_branch ON exam_cycles(branch_id);
CREATE INDEX IF NOT EXISTS idx_subject_exams_cycle ON subject_exams(exam_cycle_id);
CREATE INDEX IF NOT EXISTS idx_subject_exams_class ON subject_exams(class_id);
CREATE INDEX IF NOT EXISTS idx_subject_exams_course ON subject_exams(course_id);

-- Optimize Mark retrieval for Gradebook
CREATE INDEX IF NOT EXISTS idx_exam_marks_student ON exam_marks(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_marks_exam ON exam_marks(subject_exam_id);

-- Optimize Analytics retrieval
CREATE INDEX IF NOT EXISTS idx_grading_scale_nodes_scale ON grading_scale_nodes(scale_id);

-- [8] SAMPLE INITIALIZATION NODES (Commented)
/*
-- Example: Define a Grading Scale
INSERT INTO grading_scales (branch_id, name, is_default)
VALUES (1, 'Global Academic Standard', true);

-- Example: Define Grade Levels
INSERT INTO grading_scale_nodes (scale_id, grade, min_percentage, max_percentage, point_value, remarks, color_code)
VALUES 
    ((SELECT id FROM grading_scales LIMIT 1), 'A+', 90, 100, 4.0, 'Distinction', '#10B981'),
    ((SELECT id FROM grading_scales LIMIT 1), 'A', 80, 89.99, 3.7, 'Excellent', '#3B82F6'),
    ((SELECT id FROM grading_scales LIMIT 1), 'B', 70, 79.99, 3.0, 'Good', '#F59E0B'),
    ((SELECT id FROM grading_scales LIMIT 1), 'F', 0, 32.99, 0.0, 'Failure', '#EF4444');
*/

COMMIT;
