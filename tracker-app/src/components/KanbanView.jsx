import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, Bot, CheckCircle, Clock, AlertCircle, Link2 } from 'lucide-react';
import { TaskDetailModal } from './TaskDetailModal';
import { UnifiedFilterBar } from './UnifiedFilterBar';

export const KanbanView = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggingTask, setDraggingTask] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPhase, setFilterPhase] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [phases, setPhases] = useState([]);

  useEffect(() => {
    loadTasks();
    loadPhases();

    const channel = supabase
      .channel('kanban_tasks')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tasks' },
        loadTasks
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const loadPhases = async () => {
    try {
      const { data, error } = await supabase.from('phases').select('*').order('order_index');
      if (error) throw error;
      setPhases(data || []);
    } catch (error) {
      console.error('Error loading phases:', error);
    }
  };

  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks_with_dependencies')
        .select('*')
        .order('phase_id')
        .order('order_index');
      
      if (error) throw error;
      console.log('[Kanban] Loaded tasks:', data?.length);
      setTasks(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks([]);
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      const updates = { status: newStatus };
      
      if (newStatus === 'IN_PROGRESS' && !tasks.find(t => t.id === taskId).started_at) {
        updates.started_at = new Date().toISOString();
      }
      
      if (newStatus === 'DONE') {
        updates.completed_at = new Date().toISOString();
        updates.progress_percentage = 100;
      }

      await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);
      
      loadTasks();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  // ✅ FIXED: Removed BLOCKED column
  // BLOCKED is an execution_status (calculated from dependencies), not a task status
  // Tasks can be PENDING/IN_PROGRESS/DONE, but show 🔒 badge when execution_status='BLOCKED'
  const columns = [
    {
      id: 'PENDING',
      name: 'Pending',
      icon: Clock,
      headerClasses: 'bg-background-tertiary text-text-secondary',
      columnClasses: 'bg-background-tertiary',
    },
    {
      id: 'IN_PROGRESS',
      name: 'In Progress',
      icon: AlertCircle,
      headerClasses: 'bg-info-background text-info-text',
      columnClasses: 'bg-info-background/50',
    },
    {
      id: 'DONE',
      name: 'Done',
      icon: CheckCircle,
      headerClasses: 'bg-success-background text-success-text',
      columnClasses: 'bg-success-background/50',
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p>Loading board...</p>
        </div>
      </div>
    );
  }

  // Apply filters
  const filteredTasks = tasks.filter(task => {
    if (searchQuery && !task.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !task.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterPhase !== 'all' && task.phase_id !== parseInt(filterPhase)) {
      return false;
    }
    if (filterPriority !== 'all' && task.priority !== filterPriority) {
      return false;
    }
    if (filterStatus !== 'all' && task.status !== filterStatus) {
      return false;
    }
    return true;
  });

  const hasActiveFilters = searchQuery || filterPhase !== 'all' || filterPriority !== 'all' || filterStatus !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterPhase('all');
    setFilterPriority('all');
    setFilterStatus('all');
  };

  return (
    <div className="h-full flex flex-col bg-background-primary">
      <div className="flex-shrink-0 p-4">
        <UnifiedFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterPhase={filterPhase}
          onPhaseChange={setFilterPhase}
          filterPriority={filterPriority}
          onPriorityChange={setFilterPriority}
          filterStatus={filterStatus}
          onStatusChange={setFilterStatus}
          phases={phases}
          showClearButton={hasActiveFilters}
          onClearFilters={clearFilters}
          resultCount={filteredTasks.length}
          totalCount={tasks.length}
        />
      </div>
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 h-full min-w-max p-4">
          {columns.map((column) => {
            const Icon = column.icon;
            const columnTasks = filteredTasks.filter(t => t.status === column.id);
          
          return (
            <div key={column.id} className="flex-shrink-0 w-80 flex flex-col">
              {/* Column Header */}
              <div className={`p-4 rounded-t-lg ${column.headerClasses}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5" strokeWidth={2.5} />
                    <h3 className="font-bold text-lg">{column.name}</h3>
                  </div>
                  <span className="px-3 py-1 text-sm font-bold bg-background-primary text-text-primary rounded-full">
                    {columnTasks.length}
                  </span>
                </div>
              </div>

              {/* Column Body */}
              <div 
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverColumn(column.id);
                }}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={() => setDragOverColumn(null)}
                className={`flex-1 overflow-y-auto p-4 rounded-b-lg flex flex-col gap-3 transition-all ${column.columnClasses} ${
                  dragOverColumn === column.id ? 'bg-brand-primary/20 border-4 border-brand-primary border-dashed' : 'border-4 border-transparent'
                }`}
              >
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`bg-background-secondary rounded-lg p-4 shadow-md border-2 border-border-default hover:shadow-lg hover:border-brand-primary transition-all cursor-pointer ${
                      draggingTask === task.id ? 'opacity-30 rotate-2 scale-105 border-brand-primary shadow-2xl' : ''
                    }`}
                    draggable
                    onClick={(e) => {
                      if (!draggingTask) {
                        e.stopPropagation();
                        setSelectedTask(task);
                      }
                    }}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('taskId', task.id);
                      setDraggingTask(task.id);

                      // ✅ FIXED: Prevent ghost element leak
                      const ghost = e.currentTarget.cloneNode(true);
                      ghost.id = `drag-ghost-${task.id}`;
                      ghost.style.opacity = '0.8';
                      ghost.style.transform = 'rotate(5deg)';
                      ghost.style.position = 'absolute';
                      ghost.style.top = '-1000px';
                      document.body.appendChild(ghost);
                      e.dataTransfer.setDragImage(ghost, 0, 0);

                      // Safely remove after drag image is captured
                      requestAnimationFrame(() => {
                        const existingGhost = document.getElementById(`drag-ghost-${task.id}`);
                        if (existingGhost) {
                          document.body.removeChild(existingGhost);
                        }
                      });
                    }}
                    onDragEnd={() => {
                      setDraggingTask(null);
                      // ✅ Double-check ghost cleanup on drag end
                      const ghost = document.getElementById(`drag-ghost-${task.id}`);
                      if (ghost) {
                        document.body.removeChild(ghost);
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const draggedTaskId = e.dataTransfer.getData('taskId');
                      if (draggedTaskId && draggedTaskId !== task.id.toString()) {
                        updateTaskStatus(parseInt(draggedTaskId), column.id);
                      }
                    }}
                  >
                    {/* Task Header */}
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-semibold text-text-tertiary">#{task.id}</span>
                      <div className="flex gap-1">
                        {task.execution_status === 'BLOCKED' && (
                          <span className="px-2 py-1 text-xs font-bold rounded-md bg-error-background text-error-text">
                            🔒
                          </span>
                        )}
                        {task.assigned_type === 'HUMAN' ? (
                          <User className="w-4 h-4 text-text-tertiary" strokeWidth={2.5} />
                        ) : (
                          <Bot className="w-4 h-4 text-success-default" strokeWidth={2.5} />
                        )}
                      </div>
                    </div>

                    {/* Task Name */}
                    <h4 className="font-semibold text-sm line-clamp-2 text-text-primary mb-2">
                      {task.name}
                    </h4>

                    {/* Task Meta */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded-md bg-info-background text-info-text">
                        Phase {task.phase_id}
                      </span>
                      {task.priority && (
                        <span className={`px-2 py-0.5 rounded-md font-semibold ${
                          task.priority === 'HIGH' ? 'bg-error-background text-error-text' :
                          task.priority === 'MEDIUM' ? 'bg-warning-background text-warning-text' :
                          'bg-success-background text-success-text'
                        }`}>
                          {task.priority}
                        </span>
                      )}
                      {task.complexity && (
                        <span className="px-2 py-0.5 rounded-md bg-background-tertiary text-text-secondary">
                          C:{task.complexity}
                        </span>
                      )}
                      {task.estimated_hours && (
                        <span className="px-2 py-0.5 rounded-md bg-brand-background text-brand-text font-semibold">
                          ⏱️ {task.estimated_hours}h
                        </span>
                      )}
                      {task.blocking_dependencies && task.blocking_dependencies.length > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-warning-background text-warning-text flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> {task.blocking_dependencies.length}
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {task.status === 'IN_PROGRESS' && task.progress_percentage !== null && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-text-secondary mb-1">
                          <span>Progress</span>
                          <span>{task.progress_percentage}%</span>
                        </div>
                        <div className="w-full bg-background-tertiary rounded-full h-1.5">
                          <div
                            className="bg-brand-primary h-1.5 rounded-full transition-all"
                            style={{ width: `${task.progress_percentage}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Empty State */}
                {columnTasks.length === 0 && (
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center text-text-tertiary transition-colors flex flex-col items-center justify-center ${
                      dragOverColumn === column.id ? 'border-brand-primary bg-brand-primary/10' : 'border-border-default'
                    }`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const taskId = e.dataTransfer.getData('taskId');
                      if (taskId) {
                        updateTaskStatus(parseInt(taskId), column.id);
                      }
                    }}
                  >
                    <div className="text-4xl mb-2">📥</div>
                    <p className="font-semibold">Drop tasks here</p>
                  </div>
                )}
            </div>
          </div>
        );
      })}
        </div>
      </div>
      {selectedTask && (
        <TaskDetailModal 
          task={selectedTask} 
          onClose={() => setSelectedTask(null)} 
          onUpdate={loadTasks}
        />
      )}
    </div>
  );
};
