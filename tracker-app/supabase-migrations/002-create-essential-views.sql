-- ============================================
-- CREATE MISSING VIEWS FOR TRACKER APP
-- These views are CRITICAL for the frontend to work
-- Date: 2025-11-08
-- ============================================

-- ============================================
-- VIEW 1: tasks_with_dependencies
-- Purpose: Tasks with dependency information
-- Used by: KanbanView, CustomGanttComplete, WorkflowDashboard
-- ============================================
CREATE OR REPLACE VIEW tasks_with_dependencies AS
SELECT
  t.*,
  p.name as phase_name,
  p.description as phase_description,
  p.order_index as phase_order,

  -- Parent task info
  parent.name as parent_name,
  parent.task_type as parent_type,

  -- Child count (how many subtasks)
  (SELECT COUNT(*) FROM tasks WHERE parent_id = t.id) as child_count,

  -- Dependency names (array of task names this depends on)
  CASE
    WHEN t.depends_on IS NOT NULL THEN
      (SELECT array_agg(name ORDER BY name)
       FROM tasks
       WHERE id = ANY(t.depends_on))
    ELSE NULL
  END as depends_on_names,

  -- Blocking dependencies (tasks that depend on THIS task)
  CASE
    WHEN EXISTS (SELECT 1 FROM tasks WHERE t.id = ANY(depends_on)) THEN
      (SELECT array_agg(id ORDER BY id)
       FROM tasks
       WHERE t.id = ANY(depends_on))
    ELSE ARRAY[]::INTEGER[]
  END as blocking_dependencies,

  -- Blocking count (how many tasks are blocked by this task)
  (SELECT COUNT(*)
   FROM tasks
   WHERE t.id = ANY(depends_on)) as blocking_count,

  -- Calculate execution status based on dependencies
  CASE
    WHEN t.status = 'DONE' THEN 'DONE'
    WHEN t.depends_on IS NULL OR array_length(t.depends_on, 1) IS NULL THEN 'READY'
    WHEN EXISTS (
      SELECT 1 FROM tasks dep
      WHERE dep.id = ANY(t.depends_on)
      AND dep.status != 'DONE'
    ) THEN 'BLOCKED'
    ELSE 'READY'
  END as execution_status,

  -- Days since started (for detecting stuck tasks)
  CASE
    WHEN t.started_at IS NOT NULL AND t.status = 'IN_PROGRESS'
    THEN EXTRACT(DAY FROM (NOW() - t.started_at))
    ELSE NULL
  END as days_in_progress,

  -- Completion percentage (auto-calculate if has subtasks)
  CASE
    WHEN (SELECT COUNT(*) FROM tasks WHERE parent_id = t.id) > 0 THEN
      (SELECT ROUND(
        (COUNT(*) FILTER (WHERE status = 'DONE')::DECIMAL / COUNT(*)) * 100
      ) FROM tasks WHERE parent_id = t.id)
    ELSE t.progress_percentage
  END as calculated_progress,

  -- Is this a milestone?
  COALESCE(t.is_milestone, false) as is_milestone,

  -- Sprint info (if assigned to sprint)
  s.name as sprint_name,
  s.start_date as sprint_start,
  s.end_date as sprint_end,
  s.status as sprint_status

FROM tasks t
LEFT JOIN phases p ON t.phase_id = p.id
LEFT JOIN tasks parent ON t.parent_id = parent.id
LEFT JOIN sprints s ON t.sprint_id = s.id;

-- Add comment
COMMENT ON VIEW tasks_with_dependencies IS 'Tasks with full dependency information, parent/child relationships, and calculated fields';

-- ============================================
-- VIEW 2: tracker_app_data
-- Purpose: Complete task context for dashboard and analytics
-- Used by: DashboardPage, AIAnalysisPanel, supabase.js API calls
-- ============================================
CREATE OR REPLACE VIEW tracker_app_data AS
SELECT
  t.*,
  p.name as phase_name,
  p.description as phase_description,
  p.progress as phase_progress,
  p.order_index as phase_order,
  p.kpi as phase_kpi,
  p.deliverable as phase_deliverable,

  -- Parent task info
  parent.name as parent_name,
  parent.task_type as parent_type,
  parent.id as parent_task_id,

  -- Child count
  (SELECT COUNT(*) FROM tasks WHERE parent_id = t.id) as child_count,

  -- Completed child count
  (SELECT COUNT(*) FROM tasks WHERE parent_id = t.id AND status = 'DONE') as completed_child_count,

  -- Dependency info
  CASE
    WHEN t.depends_on IS NOT NULL THEN
      (SELECT array_agg(name ORDER BY name)
       FROM tasks
       WHERE id = ANY(t.depends_on))
    ELSE NULL
  END as depends_on_names,

  CASE
    WHEN t.depends_on IS NOT NULL THEN
      (SELECT array_agg(id ORDER BY id)
       FROM tasks
       WHERE id = ANY(t.depends_on))
    ELSE ARRAY[]::INTEGER[]
  END as depends_on_ids,

  -- Blocking dependencies
  CASE
    WHEN EXISTS (SELECT 1 FROM tasks WHERE t.id = ANY(depends_on)) THEN
      (SELECT array_agg(id ORDER BY id)
       FROM tasks
       WHERE t.id = ANY(depends_on))
    ELSE ARRAY[]::INTEGER[]
  END as blocking_dependencies,

  (SELECT COUNT(*) FROM tasks WHERE t.id = ANY(depends_on)) as blocking_count,

  -- Calculate execution status
  CASE
    WHEN t.status = 'DONE' THEN 'DONE'
    WHEN t.depends_on IS NULL OR array_length(t.depends_on, 1) IS NULL THEN 'READY'
    WHEN EXISTS (
      SELECT 1 FROM tasks dep
      WHERE dep.id = ANY(t.depends_on)
      AND dep.status != 'DONE'
    ) THEN 'BLOCKED'
    WHEN EXISTS (
      SELECT 1 FROM tasks dep
      WHERE dep.id = ANY(t.depends_on)
      AND dep.status = 'IN_PROGRESS'
    ) THEN 'WAITING'
    ELSE 'READY'
  END as execution_status,

  -- Days metrics
  CASE
    WHEN t.started_at IS NOT NULL AND t.completed_at IS NULL
    THEN EXTRACT(DAY FROM (NOW() - t.started_at))
    ELSE NULL
  END as days_in_progress,

  CASE
    WHEN t.started_at IS NOT NULL AND t.completed_at IS NOT NULL
    THEN EXTRACT(DAY FROM (t.completed_at - t.started_at))
    ELSE NULL
  END as days_to_complete,

  -- Progress calculation
  CASE
    WHEN (SELECT COUNT(*) FROM tasks WHERE parent_id = t.id) > 0 THEN
      (SELECT ROUND(
        (COUNT(*) FILTER (WHERE status = 'DONE')::DECIMAL / COUNT(*)) * 100
      ) FROM tasks WHERE parent_id = t.id)
    WHEN t.status = 'DONE' THEN 100
    ELSE COALESCE(t.progress_percentage, 0)
  END as calculated_progress,

  -- Milestone info
  COALESCE(t.is_milestone, false) as is_milestone,
  t.milestone_description,

  -- Sprint info
  s.name as sprint_name,
  s.start_date as sprint_start,
  s.end_date as sprint_end,
  s.status as sprint_status,
  s.velocity as sprint_velocity,

  -- AI Agent info (from ai_execution_logs)
  (SELECT agent_name
   FROM ai_execution_logs
   WHERE task_id = t.id
   ORDER BY timestamp DESC
   LIMIT 1) as last_agent,

  (SELECT status
   FROM ai_execution_logs
   WHERE task_id = t.id
   ORDER BY timestamp DESC
   LIMIT 1) as last_agent_status,

  (SELECT timestamp
   FROM ai_execution_logs
   WHERE task_id = t.id
   ORDER BY timestamp DESC
   LIMIT 1) as last_agent_activity,

  -- Timestamps
  t.created_at,
  t.updated_at,
  t.started_at,
  t.completed_at

FROM tasks t
LEFT JOIN phases p ON t.phase_id = p.id
LEFT JOIN tasks parent ON t.parent_id = parent.id
LEFT JOIN sprints s ON t.sprint_id = s.id;

-- Add comment
COMMENT ON VIEW tracker_app_data IS 'Complete task data with all relationships, calculations, and metadata for dashboard';

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Index on phase_id for faster filtering
CREATE INDEX IF NOT EXISTS idx_tasks_phase_id ON tasks(phase_id);

-- Index on parent_id for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);

-- Index on depends_on array for dependency queries
CREATE INDEX IF NOT EXISTS idx_tasks_depends_on ON tasks USING GIN(depends_on);

-- Index on status for filtering
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Index on assigned_type for human/ai filtering
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_type ON tasks(assigned_type);

-- Index on dates for timeline queries
CREATE INDEX IF NOT EXISTS idx_tasks_dates ON tasks(started_at, completed_at);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_phase_status ON tasks(phase_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_phase_order ON tasks(phase_id, order_index);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get all upstream dependencies (recursive)
CREATE OR REPLACE FUNCTION get_upstream_dependencies(task_id_param INTEGER)
RETURNS TABLE (id INTEGER, name TEXT, status TEXT, level INTEGER) AS $$
  WITH RECURSIVE deps AS (
    -- Base case: direct dependencies
    SELECT
      t.id,
      t.name,
      t.status,
      1 as level
    FROM tasks t
    WHERE t.id = ANY(
      SELECT depends_on FROM tasks WHERE id = task_id_param
    )

    UNION ALL

    -- Recursive case: dependencies of dependencies
    SELECT
      t.id,
      t.name,
      t.status,
      d.level + 1
    FROM tasks t
    JOIN deps d ON t.id = ANY(
      SELECT depends_on FROM tasks WHERE id = d.id
    )
    WHERE d.level < 10  -- Prevent infinite recursion
  )
  SELECT * FROM deps;
$$ LANGUAGE SQL STABLE;

-- Function to get all downstream tasks (what depends on this task)
CREATE OR REPLACE FUNCTION get_downstream_tasks(task_id_param INTEGER)
RETURNS TABLE (id INTEGER, name TEXT, status TEXT, level INTEGER) AS $$
  WITH RECURSIVE downstream AS (
    -- Base case: direct dependents
    SELECT
      t.id,
      t.name,
      t.status,
      1 as level
    FROM tasks t
    WHERE task_id_param = ANY(t.depends_on)

    UNION ALL

    -- Recursive case: dependents of dependents
    SELECT
      t.id,
      t.name,
      t.status,
      d.level + 1
    FROM tasks t
    JOIN downstream d ON d.id = ANY(t.depends_on)
    WHERE d.level < 10  -- Prevent infinite recursion
  )
  SELECT * FROM downstream;
$$ LANGUAGE SQL STABLE;

-- Function to check if task is ready to start
CREATE OR REPLACE FUNCTION is_task_ready(task_id_param INTEGER)
RETURNS BOOLEAN AS $$
  SELECT
    CASE
      WHEN t.status = 'DONE' THEN false
      WHEN t.status = 'IN_PROGRESS' THEN false
      WHEN t.depends_on IS NULL OR array_length(t.depends_on, 1) IS NULL THEN true
      WHEN EXISTS (
        SELECT 1 FROM tasks dep
        WHERE dep.id = ANY(t.depends_on)
        AND dep.status != 'DONE'
      ) THEN false
      ELSE true
    END
  FROM tasks t
  WHERE t.id = task_id_param;
$$ LANGUAGE SQL STABLE;

-- ============================================
-- GRANT PERMISSIONS (if using RLS)
-- ============================================

-- Grant SELECT on views to anon and authenticated users
GRANT SELECT ON tasks_with_dependencies TO anon, authenticated;
GRANT SELECT ON tracker_app_data TO anon, authenticated;

-- Grant EXECUTE on functions
GRANT EXECUTE ON FUNCTION get_upstream_dependencies(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_downstream_tasks(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_task_ready(INTEGER) TO anon, authenticated;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON FUNCTION get_upstream_dependencies IS 'Recursively get all tasks that this task depends on (upstream)';
COMMENT ON FUNCTION get_downstream_tasks IS 'Recursively get all tasks that depend on this task (downstream)';
COMMENT ON FUNCTION is_task_ready IS 'Check if a task is ready to start (all dependencies complete)';

-- ============================================
-- END OF MIGRATION
-- ============================================
