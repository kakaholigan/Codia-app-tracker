import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, Clock, CheckCircle, AlertCircle, User, Bot, Target, Zap } from 'lucide-react';
import { AIActivityStream } from '../components/AIActivityStream';
import { AIAnalysisPanel } from '../components/AIAnalysisPanel';
import toast from 'react-hot-toast';

export const DashboardPage = ({ onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const navigateToTasks = (filter) => {
    localStorage.setItem('taskFilter', JSON.stringify(filter));
    if (onNavigate) onNavigate('tasks');
  };

  useEffect(() => {
    loadDashboardData();
    
    const subscription = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, loadDashboardData)
      .subscribe();
    
    return () => subscription.unsubscribe();
  }, []);

  // ✅ FIXED: Use toast instead of alert
  const handleRecommendationApply = async (recommendation) => {
    const loadingToast = toast.loading('Applying AI recommendation...');

    try {
      // Save recommendation to DB
      const { error: recError } = await supabase
        .from('ai_recommendations')
        .insert([{
          recommendation_type: recommendation.type,
          priority: recommendation.priority,
          status: 'APPLIED',
          title: recommendation.message,
          message: recommendation.message,
          action: recommendation.action,
          impact_description: recommendation.impact,
          suggested_task_ids: recommendation.tasks?.map(t => t.id) || [],
          applied_at: new Date().toISOString(),
          applied_by: 'FOUNDER'
        }]);

      if (recError) throw recError;

      // Execute recommendation action
      if (recommendation.type === 'CRITICAL_PATH' && recommendation.tasks) {
        // Start critical path tasks
        for (const task of recommendation.tasks.slice(0, 3)) {
          await supabase
            .from('tasks')
            .update({ status: 'IN_PROGRESS', started_at: new Date().toISOString() })
            .eq('id', task.id)
            .eq('status', 'PENDING');
        }
        toast.success(`✅ Started ${recommendation.tasks.slice(0, 3).length} critical path tasks!`, {
          id: loadingToast,
        });
      } else if (recommendation.type === 'UNBLOCK' && recommendation.tasks) {
        // Highlight blocking tasks
        toast.success(`⚠️ Focus on completing these ${recommendation.tasks.length} tasks to unblock others!`, {
          id: loadingToast,
        });
      } else {
        toast.success(`✅ Recommendation applied: ${recommendation.message}`, {
          id: loadingToast,
        });
      }

      loadDashboardData(); // Refresh
    } catch (error) {
      console.error('Error applying recommendation:', error);
      toast.error(`❌ Failed to apply recommendation: ${error.message}`, {
        id: loadingToast,
      });
    }
  };

  const loadDashboardData = async () => {
    try {
      // Load full tasks for AI analysis
      const { data: fullTasks } = await supabase
        .from('tasks_with_dependencies')
        .select('*');
      
      setAllTasks(fullTasks || []);
      
      // Load overall stats
      const tasks = fullTasks || [];
      const { data: statsData } = await supabase
        .from('tasks')
        .select('status, assigned_type, estimated_hours, actual_hours, completed_at');
      
      // ✅ FIXED: BLOCKED is execution_status not status
      const total = tasks.length;
      const done = tasks.filter(t => t.status === 'DONE').length;
      const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
      const pending = tasks.filter(t => t.status === 'PENDING').length;
      const blocked = tasks.filter(t => t.execution_status === 'BLOCKED').length;
      
      const completionPct = ((done / total) * 100).toFixed(1);
      const humanTasks = tasks.filter(t => t.assigned_type === 'HUMAN').length;
      const aiTasks = tasks.filter(t => t.assigned_type === 'AI').length;
      
      const totalEstHours = tasks.reduce((sum, t) => sum + (parseFloat(t.estimated_hours) || 0), 0);
      const totalActualHours = tasks.reduce((sum, t) => sum + (parseFloat(t.actual_hours) || 0), 0);
      
      // Calculate velocity (tasks completed in last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentlyCompleted = tasks.filter(t => 
        t.status === 'DONE' && 
        t.completed_at && 
        new Date(t.completed_at) >= sevenDaysAgo
      ).length;
      const velocity = (recentlyCompleted / 7).toFixed(1);
      
      setStats({
        total,
        done,
        inProgress,
        pending,
        blocked,
        completionPct,
        humanTasks,
        aiTasks,
        totalEstHours: totalEstHours.toFixed(0),
        totalActualHours: totalActualHours.toFixed(0),
        velocity
      });
      
      // Load recent activity
      const { data: logs } = await supabase
        .from('ai_execution_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(5);
      
      setRecentActivity(logs || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-text-secondary">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Dashboard</h1>
        <p className="text-text-secondary">V10 Infrastructure - AI có máy tính riêng</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Completion */}
        <div className="bg-background-secondary rounded-xl border border-border-default p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-text-tertiary text-sm font-medium">Completion</div>
            <TrendingUp className="w-5 h-5 text-success-default" />
          </div>
          <div className="text-3xl font-bold text-text-primary mb-1">{stats.completionPct}%</div>
          <div className="text-xs text-text-tertiary">{stats.done} / {stats.total} tasks</div>
          <div className="mt-3 w-full bg-background-tertiary rounded-full h-2">
            <div 
              className="bg-success-default h-2 rounded-full transition-all"
              style={{ width: `${stats.completionPct}%` }}
            />
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-background-secondary rounded-xl border border-border-default p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-text-tertiary text-sm font-medium">In Progress</div>
            <Zap className="w-5 h-5 text-info-default" />
          </div>
          <div className="text-3xl font-bold text-text-primary mb-1">{stats.inProgress}</div>
          <div className="text-xs text-text-tertiary">Active tasks</div>
          {stats.blocked > 0 && (
            <div className="mt-2 text-xs text-error-text">
              ⚠️ {stats.blocked} blocked
            </div>
          )}
        </div>

        {/* Velocity */}
        <div className="bg-background-secondary rounded-xl border border-border-default p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-text-tertiary text-sm font-medium">Velocity</div>
            <Target className="w-5 h-5 text-brand-primary" />
          </div>
          <div className="text-3xl font-bold text-text-primary mb-1">{stats.velocity}</div>
          <div className="text-xs text-text-tertiary">tasks/day (7d avg)</div>
        </div>

        {/* Hours */}
        <div className="bg-background-secondary rounded-xl border border-border-default p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-text-tertiary text-sm font-medium">Hours</div>
            <Clock className="w-5 h-5 text-warning-default" />
          </div>
          <div className="text-3xl font-bold text-text-primary mb-1">{stats.totalActualHours}</div>
          <div className="text-xs text-text-tertiary">of {stats.totalEstHours}h estimated</div>
        </div>
      </div>

      {/* Today's Focus */}
      <div className="bg-gradient-to-br from-brand-primary/10 to-brand-secondary/5 rounded-xl border-2 border-brand-primary/30 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-brand-primary/20 rounded-lg flex items-center justify-center">
            <Target className="w-6 h-6 text-brand-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">🎯 Today's Focus</h2>
            <p className="text-sm text-text-tertiary">Top priority tasks for today</p>
          </div>
        </div>
        
        <div className="space-y-3">
          {allTasks
            .filter(t => t.status === 'IN_PROGRESS' || (t.status === 'PENDING' && t.execution_status === 'READY'))
            .sort((a, b) => {
              // Sort by: IN_PROGRESS first, then HIGH priority, then phase
              if (a.status === 'IN_PROGRESS' && b.status !== 'IN_PROGRESS') return -1;
              if (a.status !== 'IN_PROGRESS' && b.status === 'IN_PROGRESS') return 1;
              if (a.priority === 'HIGH' && b.priority !== 'HIGH') return -1;
              if (a.priority !== 'HIGH' && b.priority === 'HIGH') return 1;
              return a.phase_id - b.phase_id;
            })
            .slice(0, 5)
            .map((task, idx) => (
              <div 
                key={task.id}
                className="flex items-start gap-3 p-4 bg-background-secondary rounded-lg border border-border-default hover:border-brand-primary transition cursor-pointer"
                onClick={() => navigateToTasks({ taskId: task.id })}
              >
                <div className="flex-shrink-0 w-8 h-8 bg-brand-primary/20 rounded-full flex items-center justify-center font-bold text-brand-primary">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-text-tertiary">#{task.id}</span>
                    {task.status === 'IN_PROGRESS' && (
                      <span className="px-2 py-0.5 text-xs font-bold bg-info-background text-info-text rounded">
                        ▶️ IN PROGRESS
                      </span>
                    )}
                    {task.priority === 'HIGH' && (
                      <span className="px-2 py-0.5 text-xs font-bold bg-error-background text-error-text rounded">
                        🔥 HIGH
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-text-primary mb-1">{task.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-text-tertiary">
                    {task.estimated_hours && (
                      <span>⏱️ {task.estimated_hours}h</span>
                    )}
                    {task.assigned_type === 'AI' && (
                      <span>🤖 AI Agent</span>
                    )}
                    {task.assigned_type === 'HUMAN' && (
                      <span>👤 Human</span>
                    )}
                  </div>
                  {task.current_step && (
                    <div className="mt-2 text-xs text-info-text">
                      ⚡ {task.current_step}
                    </div>
                  )}
                </div>
              </div>
            ))}
          
          {allTasks.filter(t => t.status === 'IN_PROGRESS' || (t.status === 'PENDING' && t.execution_status === 'READY')).length === 0 && (
            <div className="text-center py-8 text-text-tertiary">
              <div className="text-4xl mb-2">🎉</div>
              <p>No tasks in progress. Start a new task!</p>
            </div>
          )}
        </div>
      </div>

      {/* AI Activity Stream - Prominent */}
      <div className="bg-gradient-to-br from-green-500/10 to-blue-500/5 rounded-xl border-2 border-green-500/30 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
            <Bot className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">🤖 AI Activity Stream</h2>
            <p className="text-sm text-text-tertiary">Real-time AI agent execution logs</p>
          </div>
        </div>
        
        {recentActivity.length > 0 ? (
          <div className="space-y-3">
            {recentActivity.slice(0, 3).map((log, idx) => (
              <div key={log.id} className="flex items-start gap-3 p-4 bg-background-secondary rounded-lg border border-border-default">
                <div className="flex-shrink-0 w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                  <Bot className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-text-primary">{log.agent_name}</span>
                    <span className="text-xs text-text-tertiary">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <div className={`px-2 py-0.5 rounded text-xs font-bold ${
                      log.status === 'completed' ? 'bg-success-background text-success-text' :
                      log.status === 'progress' ? 'bg-info-background text-info-text' :
                      'bg-error-background text-error-text'
                    }`}>
                      {log.status === 'completed' ? '✅' : log.status === 'progress' ? '⏳' : '❌'} {log.status}
                    </div>
                  </div>
                  <p className="text-sm text-text-primary font-medium mb-1">{log.action}</p>
                  {log.current_step && (
                    <p className="text-xs text-info-text">⚡ {log.current_step}</p>
                  )}
                  {log.progress_percentage !== null && log.progress_percentage !== undefined && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-text-tertiary mb-1">
                        <span>Progress</span>
                        <span className="font-bold">{log.progress_percentage}%</span>
                      </div>
                      <div className="w-full bg-background-tertiary rounded-full h-2">
                        <div 
                          className="bg-info-default h-2 rounded-full transition-all"
                          style={{ width: `${log.progress_percentage}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-text-tertiary">
            <div className="text-4xl mb-2">💤</div>
            <p>No AI activity yet</p>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Human Tasks */}
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl border border-purple-500/20 p-6 hover:border-purple-500/40 transition cursor-pointer">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <User className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary">Human Tasks</h3>
              <p className="text-sm text-text-tertiary">Tasks for founder</p>
            </div>
          </div>
          <div className="text-3xl font-bold text-purple-600 mb-2">{stats.humanTasks}</div>
          <button 
            onClick={() => navigateToTasks({ assignedType: 'HUMAN' })}
            className="text-sm text-purple-600 hover:text-purple-700 font-medium hover:underline cursor-pointer"
          >
            View all →
          </button>
        </div>

        {/* AI Tasks */}
        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-xl border border-green-500/20 p-6 hover:border-green-500/40 transition cursor-pointer">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <Bot className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary">AI Agent Tasks</h3>
              <p className="text-sm text-text-tertiary">Automated execution</p>
            </div>
          </div>
          <div className="text-3xl font-bold text-green-600 mb-2">{stats.aiTasks}</div>
          <button 
            onClick={() => navigateToTasks({ assignedType: 'AI' })}
            className="text-sm text-green-600 hover:text-green-700 font-medium hover:underline cursor-pointer"
          >
            View all →
          </button>
        </div>
      </div>

      {/* Phase Progress Breakdown */}
      <div className="bg-background-secondary rounded-xl border border-border-default p-6 mb-6">
        <h2 className="text-xl font-bold text-text-primary mb-4">📊 Phase Progress</h2>
        <div className="space-y-4">
          {(() => {
            const phases = [...new Set(allTasks.map(t => t.phase_id))].sort((a, b) => a - b);
            return phases.map(phaseId => {
              const phaseTasks = allTasks.filter(t => t.phase_id === phaseId);
              const done = phaseTasks.filter(t => t.status === 'DONE').length;
              const inProgress = phaseTasks.filter(t => t.status === 'IN_PROGRESS').length;
              const total = phaseTasks.length;
              const progress = total > 0 ? ((done / total) * 100).toFixed(0) : 0;
              const phaseTask = phaseTasks[0];
              
              return (
                <div key={phaseId} className="bg-background-tertiary rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-brand-primary/20 rounded-lg flex items-center justify-center font-bold text-brand-primary">
                        {phaseId}
                      </div>
                      <div>
                        <h3 className="font-bold text-text-primary">Phase {phaseId}</h3>
                        <p className="text-xs text-text-tertiary">{done} done, {inProgress} in progress, {total - done - inProgress} pending</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-brand-primary">{progress}%</div>
                      <div className="text-xs text-text-tertiary">{done}/{total}</div>
                    </div>
                  </div>
                  <div className="w-full bg-background-primary rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-brand-primary to-brand-secondary h-3 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

    </div>
  );
};
