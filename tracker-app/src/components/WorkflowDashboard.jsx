import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Play, CheckCircle, Clock, AlertCircle, User, Bot, Search, Filter, X } from 'lucide-react';
import { TaskDetailModal } from './TaskDetailModal';

export const WorkflowDashboard = () => {
  const [humanTasks, setHumanTasks] = useState([]);
  const [aiTasks, setAiTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [activeView, setActiveView] = useState('human');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPhase, setFilterPhase] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [phases, setPhases] = useState([]);

  // ✅ FIXED: Use ref to avoid recreating subscription on selectedTask change
  const selectedTaskRef = useRef(null);

  // Keep ref in sync with state
  useEffect(() => {
    selectedTaskRef.current = selectedTask;
  }, [selectedTask]);

  useEffect(() => {
    loadTasks();
    loadPhases();

    // ✅ FIXED: Removed selectedTask from dependencies - prevents memory leak
    const channel = supabase
      .channel('tasks_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        loadTasks();
        // Use ref instead of state to avoid stale closure
        if (selectedTaskRef.current && payload.new && payload.new.id === selectedTaskRef.current.id) {
          setSelectedTask(payload.new);
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []); // ✅ Empty dependencies - subscription created only once

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
      const { data, error } = await supabase.from('tasks_with_dependencies').select('*').order('phase_id').order('order_index');
      if (error) throw error;
      const human = (data || []).filter(t => t.assigned_type === 'HUMAN' || t.assigned_to === 'FOUNDER');
      const ai = (data || []).filter(t => t.assigned_type === 'AI' || t.assigned_type === 'AGENT' || (t.assigned_to && t.assigned_to !== 'FOUNDER' && t.assigned_type !== 'HUMAN'));
      setHumanTasks(human);
      setAiTasks(ai);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'DONE': return <CheckCircle className="w-5 h-5 text-success-500" />;
      case 'IN_PROGRESS': return <Play className="w-5 h-5 text-info-500" />;
      case 'PENDING': return <Clock className="w-5 h-5 text-status-pending-bg" />;
      default: return <AlertCircle className="w-5 h-5 text-warning-500" />;
    }
  };

  const TaskCard = ({ task, type }) => (
    <div
      onClick={() => {
        setSelectedTask(task);
        setShowModal(true);
      }}
      className={`p-4 rounded-lg border-2 cursor-pointer transition ${
        selectedTask?.id === task.id
          ? 'border-brand-primary bg-info-50'
          : task.execution_status === 'BLOCKED'
          ? 'border-error-200 bg-error-50 opacity-70'
          : 'border-border-default hover:border-info-500 bg-white'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {getStatusIcon(task.status)}
          {type === 'human' ? <User className="w-4 h-4 text-info-600" /> : <Bot className="w-4 h-4 text-success-600" />}
          <span className="text-xs font-bold text-gray-500">#{task.id}</span>
        </div>
        <div className="flex gap-1">
          {task.execution_status === 'BLOCKED' && <span className="px-2 py-1 text-xs font-bold rounded bg-status-blocked-badgeBg text-status-blocked-badgeText">🔒 BLOCKED</span>}
          <span className={`px-2 py-1 text-xs font-bold rounded ${
            task.status === 'DONE' ? 'bg-status-done-badgeBg text-status-done-badgeText' :
            task.status === 'IN_PROGRESS' ? 'bg-status-inProgress-badgeBg text-status-inProgress-badgeText' :
            'bg-status-pending-badgeBg text-status-pending-badgeText'
          }`}>{task.status}</span>
        </div>
      </div>
      <h3 className="font-bold text-gray-800 mb-1">{task.name}</h3>
      
      {/* Metadata: Hours + Dependencies */}
      <div className="flex gap-3 mb-2 text-xs">
        {task.estimated_hours && (
          <span className="flex items-center gap-1 text-gray-600">
            <Clock className="w-3 h-3" />
            <span className="font-semibold">{task.estimated_hours}h</span>
          </span>
        )}
        {task.blocking_dependencies && task.blocking_dependencies.length > 0 && (
          <span className="flex items-center gap-1 text-warning-600">
            <AlertCircle className="w-3 h-3" />
            <span className="font-semibold">Blocks {task.blocking_dependencies.length} tasks</span>
          </span>
        )}
      </div>
      
      {task.status === 'IN_PROGRESS' && task.current_step && (
        <div className="bg-status-inProgress-light border-l-4 border-status-inProgress-border px-3 py-2 mb-2">
          <p className="text-xs text-status-inProgress-badgeText font-semibold">⚡ {task.current_step}</p>
          {task.progress_percentage !== null && (
            <div className="mt-1">
              <div className="w-full bg-info-200 rounded-full h-1">
                <div className="bg-info-600 h-1 rounded-full transition-all" style={{ width: `${task.progress_percentage}%` }} />
              </div>
            </div>
          )}
        </div>
      )}
      {task.description && !task.current_step && <p className="text-sm text-gray-600 line-clamp-2 mb-2">{task.description.substring(0, 120)}...</p>}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex gap-2 text-gray-500">
          {task.assigned_to && <span className="bg-gray-100 px-2 py-1 rounded">{task.assigned_to}</span>}
          {task.complexity && <span className="bg-yellow-100 px-2 py-1 rounded text-yellow-700">Complexity: {task.complexity}/5</span>}
        </div>
        
        {/* Quick Actions */}
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          {task.status === 'PENDING' && task.execution_status !== 'BLOCKED' && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await supabase
                    .from('tasks')
                    .update({ status: 'IN_PROGRESS', started_at: new Date().toISOString() })
                    .eq('id', task.id);
                  loadTasks();
                } catch (error) {
                  console.error('Error starting task:', error);
                }
              }}
              className="px-2 py-1 bg-info-500 text-white rounded hover:bg-info-600 transition font-semibold"
              title="Start this task"
            >
              ▶️ Start
            </button>
          )}
          {task.status === 'IN_PROGRESS' && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await supabase
                    .from('tasks')
                    .update({
                      status: 'DONE',
                      completed_at: new Date().toISOString(),
                      progress_percentage: 100
                    })
                    .eq('id', task.id);
                  loadTasks();
                } catch (error) {
                  console.error('Error completing task:', error);
                }
              }}
              className="px-2 py-1 bg-success-500 text-white rounded hover:bg-success-600 transition font-semibold"
              title="Mark as done"
            >
              ✅ Done
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="text-center py-12"><div className="text-4xl mb-4">⏳</div><p className="text-gray-600">Loading tasks...</p></div>
    );
  }

  const currentTasks = activeView === 'human' ? humanTasks : aiTasks;
  
  // Apply filters
  const filteredTasks = currentTasks.filter(task => {
    // Search filter
    if (searchQuery && !task.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !task.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Phase filter
    if (filterPhase !== 'all' && task.phase_id !== parseInt(filterPhase)) {
      return false;
    }
    // Priority filter
    if (filterPriority !== 'all' && task.priority !== filterPriority) {
      return false;
    }
    // Status filter
    if (filterStatus !== 'all' && task.status !== filterStatus) {
      return false;
    }
    return true;
  });
  
  // Sort: BLOCKED first, then HIGH priority, then by phase
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.execution_status === 'BLOCKED' && b.execution_status !== 'BLOCKED') return -1;
    if (a.execution_status !== 'BLOCKED' && b.execution_status === 'BLOCKED') return 1;
    if (a.priority === 'HIGH' && b.priority !== 'HIGH') return -1;
    if (a.priority !== 'HIGH' && b.priority === 'HIGH') return 1;
    return a.phase_id - b.phase_id;
  });
  
  const hasActiveFilters = searchQuery || filterPhase !== 'all' || filterPriority !== 'all' || filterStatus !== 'all';
  
  const clearFilters = () => {
    setSearchQuery('');
    setFilterPhase('all');
    setFilterPriority('all');
    setFilterStatus('all');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-4 mb-4"><h1 className="text-3xl font-bold">🔄 Workflow Dashboard</h1></div>
      <div className="flex gap-4 mb-4 flex-wrap">
        <button onClick={() => setActiveView('human')} className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition ${activeView === 'human' ? 'bg-info-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}><User className="w-5 h-5" />👤 Human Tasks ({humanTasks.length})</button>
        <button onClick={() => setActiveView('ai')} className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition ${activeView === 'ai' ? 'bg-success-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}><Bot className="w-5 h-5" />🤖 AI Agent Tasks ({aiTasks.length})</button>

        {/* Quick Filter: Ready to Start */}
        <button
          onClick={() => {
            setFilterStatus('PENDING');
            setSearchQuery('');
            setFilterPhase('all');
            setFilterPriority('all');
          }}
          className="flex items-center gap-2 px-4 py-3 rounded-lg font-semibold transition bg-info-100 text-info-900 hover:bg-info-200 border-2 border-info-500"
          title="Show only tasks ready to start (not blocked)"
        >
          <Play className="w-4 h-4" />
          🚀 Ready to Start
        </button>

        <div className="ml-auto bg-white px-4 py-3 rounded-lg border-2 border-success-200"><div className="text-2xl font-bold text-success-600">{currentTasks.length > 0 ? Math.round((currentTasks.filter(t => t.status === 'DONE').length / currentTasks.length) * 100) : 0}%</div><div className="text-xs text-gray-600">Complete</div></div>
      </div>
      
      {/* Search and Filters */}
      <div className="bg-white rounded-lg border-2 border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>
          <Filter className="w-5 h-5 text-gray-600" />
        </div>
        <div className="flex gap-3 items-center">
          <select value={filterPhase} onChange={(e) => setFilterPhase(e.target.value)} className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none">
            <option value="all">All Phases</option>
            {phases.map(phase => <option key={phase.id} value={phase.id}>Phase {phase.id}: {phase.name}</option>)}
          </select>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none">
            <option value="all">All Priorities</option>
            <option value="HIGH">🔥 High</option>
            <option value="MEDIUM">⚡ Medium</option>
            <option value="LOW">📌 Low</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none">
            <option value="all">All Status</option>
            <option value="PENDING">⏸️ Pending</option>
            <option value="IN_PROGRESS">▶️ In Progress</option>
            <option value="DONE">✅ Done</option>
            <option value="BLOCKED">🔒 Blocked</option>
          </select>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition">
              <X className="w-4 h-4" /> Clear
            </button>
          )}
          <div className="ml-auto text-sm text-gray-600">
            Showing <span className="font-bold text-gray-800">{sortedTasks.length}</span> of <span className="font-bold">{currentTasks.length}</span> tasks
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sortedTasks.map(task => <TaskCard key={task.id} task={task} type={activeView} />)}
        </div>
        {sortedTasks.length === 0 && currentTasks.length > 0 && <div className="text-center py-12 text-gray-500">No tasks match your filters</div>}
        {currentTasks.length === 0 && <div className="text-center py-12 text-gray-500">No {activeView} tasks found</div>}
      </div>

      {/* Task Detail Modal */}
      {showModal && selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => {
            setShowModal(false);
            setSelectedTask(null);
          }}
          onUpdate={loadTasks}
        />
      )}
    </div>
  );
};
