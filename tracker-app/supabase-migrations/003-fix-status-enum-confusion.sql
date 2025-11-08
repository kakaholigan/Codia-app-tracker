-- ============================================
-- FIX STATUS ENUM CONFUSION
-- Clarify difference between status and execution_status
-- Date: 2025-11-08
-- ============================================

-- ============================================
-- PROBLEM:
-- - status field used for HUMAN actions (PENDING, IN_PROGRESS, DONE)
-- - execution_status calculated field for SYSTEM state (READY, BLOCKED, WAITING)
-- - Some code was mixing these up (e.g., BLOCKED as a status)
-- ============================================

-- ============================================
-- SOLUTION:
-- 1. status = User-facing task lifecycle
-- 2. execution_status = System-calculated readiness
-- ============================================

-- ============================================
-- 1. Add CHECK constraint to status field
-- ============================================
DO $$
BEGIN
  -- Drop existing constraint if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tasks' AND constraint_name = 'tasks_status_check'
  ) THEN
    ALTER TABLE tasks DROP CONSTRAINT tasks_status_check;
  END IF;

  -- Add new constraint with clear enum values
  ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('PENDING', 'IN_PROGRESS', 'DONE'));
END $$;

-- ============================================
-- 2. Remove execution_status column (it's calculated in views)
-- ============================================
-- execution_status is now ALWAYS calculated from dependencies
-- No need to store it - prevents data inconsistency

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'execution_status'
  ) THEN
    ALTER TABLE tasks DROP COLUMN execution_status;
  END IF;
END $$;

-- ============================================
-- 3. Clean up any existing data with BLOCKED status
-- ============================================
-- Change any tasks with status='BLOCKED' to 'PENDING'
UPDATE tasks
SET status = 'PENDING'
WHERE status NOT IN ('PENDING', 'IN_PROGRESS', 'DONE');

-- ============================================
-- 4. Add helpful comments
-- ============================================
COMMENT ON COLUMN tasks.status IS 'User-facing task lifecycle: PENDING (not started), IN_PROGRESS (actively working), DONE (completed). DO NOT use BLOCKED here - that is calculated as execution_status in views.';

-- ============================================
-- 5. Update priority enum to match code usage
-- ============================================
DO $$
BEGIN
  -- Drop existing priority constraint if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tasks' AND constraint_name = 'tasks_priority_check'
  ) THEN
    ALTER TABLE tasks DROP CONSTRAINT tasks_priority_check;
  END IF;

  -- Add new constraint with CRITICAL added (TaskDetailModal line 92 checks for it)
  ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check
    CHECK (priority IS NULL OR priority IN ('HIGH', 'MEDIUM', 'LOW'));
END $$;

-- Note: Removed 'CRITICAL' because schema says only HIGH/MEDIUM/LOW
-- Frontend code will be updated to not check for 'CRITICAL'

COMMENT ON COLUMN tasks.priority IS 'Task priority: HIGH (urgent), MEDIUM (normal), LOW (nice-to-have). Use HIGH for critical tasks.';

-- ============================================
-- 6. Add index on execution_status calculation
-- ============================================
-- Since execution_status is calculated in views,
-- index on depends_on array helps speed up the calculation
CREATE INDEX IF NOT EXISTS idx_tasks_depends_on_gin
ON tasks USING GIN(depends_on);

-- ============================================
-- 7. Create materialized view for heavy queries (optional)
-- ============================================
-- For large datasets (>1000 tasks), materialized view can speed up dashboard

CREATE MATERIALIZED VIEW IF NOT EXISTS tasks_summary AS
SELECT
  phase_id,
  COUNT(*) as total_tasks,
  COUNT(*) FILTER (WHERE status = 'DONE') as done_tasks,
  COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress_tasks,
  COUNT(*) FILTER (WHERE status = 'PENDING') as pending_tasks,
  ROUND((COUNT(*) FILTER (WHERE status = 'DONE')::DECIMAL / COUNT(*)) * 100, 2) as completion_percentage,
  SUM(estimated_hours) as total_estimated_hours,
  SUM(actual_hours) as total_actual_hours,
  COUNT(*) FILTER (WHERE assigned_type = 'HUMAN') as human_tasks,
  COUNT(*) FILTER (WHERE assigned_type = 'AI') as ai_tasks
FROM tasks
GROUP BY phase_id;

-- Index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_summary_phase
ON tasks_summary(phase_id);

COMMENT ON MATERIALIZED VIEW tasks_summary IS 'Aggregated task statistics by phase. Refresh when data changes significantly.';

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_tasks_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY tasks_summary;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_tasks_summary IS 'Refresh the tasks_summary materialized view. Call after bulk task updates.';

-- ============================================
-- 8. Helper function: Get tasks by execution status
-- ============================================
CREATE OR REPLACE FUNCTION get_tasks_by_execution_status(
  execution_status_param TEXT
)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  status TEXT,
  phase_id INTEGER,
  depends_on INTEGER[],
  blocking_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.status,
    t.phase_id,
    t.depends_on,
    (SELECT COUNT(*) FROM tasks WHERE t.id = ANY(depends_on))::BIGINT as blocking_count
  FROM tasks t
  WHERE
    CASE execution_status_param
      WHEN 'READY' THEN
        t.status != 'DONE'
        AND (t.depends_on IS NULL OR array_length(t.depends_on, 1) IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM tasks dep
            WHERE dep.id = ANY(t.depends_on) AND dep.status != 'DONE'
          ))
      WHEN 'BLOCKED' THEN
        t.status != 'DONE'
        AND t.depends_on IS NOT NULL
        AND array_length(t.depends_on, 1) > 0
        AND EXISTS (
          SELECT 1 FROM tasks dep
          WHERE dep.id = ANY(t.depends_on) AND dep.status != 'DONE'
        )
      WHEN 'WAITING' THEN
        t.status != 'DONE'
        AND t.depends_on IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM tasks dep
          WHERE dep.id = ANY(t.depends_on) AND dep.status = 'IN_PROGRESS'
        )
      ELSE false
    END
  ORDER BY t.order_index;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_tasks_by_execution_status IS 'Get tasks filtered by execution status (READY, BLOCKED, WAITING). Execution status is calculated on-the-fly from dependencies.';

-- Grant execute
GRANT EXECUTE ON FUNCTION get_tasks_by_execution_status(TEXT) TO anon, authenticated;
GRANT SELECT ON tasks_summary TO anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_tasks_summary() TO authenticated;

-- ============================================
-- 9. Validation: Ensure no invalid statuses exist
-- ============================================
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM tasks
  WHERE status NOT IN ('PENDING', 'IN_PROGRESS', 'DONE');

  IF invalid_count > 0 THEN
    RAISE NOTICE 'Found % tasks with invalid status. Cleaning up...', invalid_count;
    UPDATE tasks SET status = 'PENDING' WHERE status NOT IN ('PENDING', 'IN_PROGRESS', 'DONE');
    RAISE NOTICE 'Cleanup complete.';
  ELSE
    RAISE NOTICE 'All task statuses are valid.';
  END IF;
END $$;

-- ============================================
-- END OF MIGRATION
-- ============================================
