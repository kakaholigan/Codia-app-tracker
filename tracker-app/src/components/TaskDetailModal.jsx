import React, { useState } from 'react';
import { X, User, Bot, Clock, TrendingUp, ArrowRight, Shield, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { validateStatusChange, validateTaskUpdate } from '../lib/validation';

export const TaskDetailModal = ({ task, onClose, onUpdate }) => {
  const [updating, setUpdating] = useState(false);

  if (!task) return null;

  // ✅ FIXED: Use toast instead of alert + added validation
  const handleStatusChange = async (newStatus) => {
    if (updating) return;

    // ✅ Validate business rules before updating
    if (!validateStatusChange(task, newStatus)) {
      return; // Validation failed, error toast already shown
    }

    setUpdating(true);

    // Show loading toast
    const loadingToast = toast.loading('Updating task status...');

    try {
      const updates = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'IN_PROGRESS' && !task.started_at) {
        updates.started_at = new Date().toISOString();
      }
      if (newStatus === 'DONE' && !task.completed_at) {
        updates.completed_at = new Date().toISOString();
        updates.progress_percentage = 100;
      }

      // ✅ Validate updates before sending to DB
      if (!validateTaskUpdate(updates)) {
        toast.dismiss(loadingToast);
        return;
      }

      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', task.id);

      if (error) throw error;

      // Success!
      toast.success(`✅ Task marked as ${newStatus}`, {
        id: loadingToast,
      });

      // Notify parent to refresh
      if (onUpdate) onUpdate();

      // Update local task object
      Object.assign(task, updates);

    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(`❌ Failed to update: ${error.message}`, {
        id: loadingToast,
      });
    } finally {
      setUpdating(false);
    }
  };

  // ✅ FIXED: Removed BLOCKED from status options
  // BLOCKED is execution_status (calculated), not a task status
  const getStatusOptions = () => {
    return [
      { value: 'PENDING', label: '⏸️ Pending', color: 'bg-gray-500' },
      { value: 'IN_PROGRESS', label: '⏳ In Progress', color: 'bg-blue-500' },
      { value: 'DONE', label: '✅ Done', color: 'bg-green-500' }
    ];
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black bg-opacity-30 z-40"
        onClick={onClose}
      />
      {/* ✅ FIXED: Mobile responsive - w-full on mobile, w-[600px] on md+ screens */}
      <div
        className="fixed right-0 top-0 h-full w-full md:w-[600px] bg-white shadow-2xl z-50 overflow-y-auto animate-slideInRight"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-6 ${task.is_milestone ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : 'bg-gradient-to-r from-blue-50 to-purple-50'} border-b-4 ${task.is_milestone ? 'border-yellow-400' : 'border-blue-400'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-grow">
              {/* Title Row */}
              <div className="flex items-center gap-3 mb-3">
                {task.is_milestone && <span className="text-4xl">🏆</span>}
                <h2 className="text-3xl font-bold text-gray-900">{task.name}</h2>
              </div>

              {/* Status & Meta Row */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Current Status */}
                <span className={`px-4 py-2 rounded-full text-sm font-bold shadow-md ${
                  task.status === 'DONE' ? 'bg-green-200 text-green-900' :
                  task.status === 'IN_PROGRESS' ? 'bg-blue-200 text-blue-900' :
                  task.status === 'BLOCKED' ? 'bg-red-200 text-red-900' :
                  'bg-gray-200 text-gray-900'
                }`}>
                  {task.status}
                </span>

                {/* Priority */}
                {/* ✅ FIXED: Removed 'CRITICAL' check - schema only has HIGH/MEDIUM/LOW */}
                {task.priority && (
                  <span className={`px-3 py-2 rounded-full text-sm font-bold shadow-md ${
                    task.priority === 'HIGH' ? 'bg-red-600 text-white' :
                    task.priority === 'MEDIUM' ? 'bg-orange-500 text-white' :
                    'bg-gray-400 text-white'
                  }`}>
                    {task.priority}
                  </span>
                )}

                {/* Assignee */}
                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-full shadow-md">
                  {task.assigned_type === 'HUMAN' ? (
                    <>
                      <User className="w-5 h-5 text-blue-600" />
                      <span className="font-bold text-blue-900">{task.assigned_to || 'Unassigned'}</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-5 h-5 text-purple-600" />
                      <span className="font-bold text-purple-900">{task.assigned_to || 'AI Agent'}</span>
                    </>
                  )}
                </div>

                {/* Phase */}
                <span className="px-3 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-bold shadow-md">
                  Phase {task.phase_id}
                </span>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 hover:bg-white/50 rounded-lg transition-all"
            >
              <X className="w-7 h-7 text-gray-700" />
            </button>
          </div>

          {/* Quick Status Change Buttons - Only for HUMAN tasks */}
          {task.assigned_type === 'HUMAN' && (
            <div className="mt-4 pt-4 border-t border-gray-300">
              <p className="text-sm font-semibold text-gray-700 mb-2">⚡ Quick Status Change:</p>
              <div className="flex gap-2 flex-wrap">
                {getStatusOptions().map(option => (
                  <button
                    key={option.value}
                    onClick={() => handleStatusChange(option.value)}
                    disabled={task.status === option.value || updating}
                    className={`px-4 py-2 rounded-lg font-bold text-white transition-all ${
                      task.status === option.value 
                        ? 'opacity-50 cursor-not-allowed' 
                        : updating 
                          ? 'opacity-50' 
                          : 'hover:scale-105 hover:shadow-lg'
                    } ${option.color}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Milestone Description */}
          {task.is_milestone && task.milestone_description && (
            <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 rounded-lg shadow">
              <h4 className="font-bold text-lg mb-2 flex items-center gap-2">
                🎯 Milestone Goal
              </h4>
              <p className="text-gray-800 leading-relaxed">{task.milestone_description}</p>
            </div>
          )}

          {/* Description */}
          {task.description && (
            <div>
              <h4 className="font-bold text-xl mb-3 flex items-center gap-2">
                📝 Description
              </h4>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-xl">
            {/* Time Estimates */}
            {task.estimated_hours && (
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="text-xs text-gray-600">Estimated</div>
                  <div className="font-bold text-lg">{task.estimated_hours}h</div>
                </div>
              </div>
            )}
            
            {task.actual_hours && (
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <div>
                  <div className="text-xs text-gray-600">Actual</div>
                  <div className="font-bold text-lg text-green-700">{task.actual_hours}h</div>
                </div>
              </div>
            )}

            {/* Dates */}
            {task.started_at && (
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="text-xs text-gray-600">Started</div>
                  <div className="font-semibold text-sm">{new Date(task.started_at).toLocaleDateString()}</div>
                </div>
              </div>
            )}

            {task.completed_at && (
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <div className="text-xs text-gray-600">Completed</div>
                  <div className="font-semibold text-sm">{new Date(task.completed_at).toLocaleDateString()}</div>
                </div>
              </div>
            )}

            {/* Subtasks Count */}
            {task.child_count > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 flex items-center justify-center text-blue-600 font-bold">📁</div>
                <div>
                  <div className="text-xs text-gray-600">Subtasks</div>
                  <div className="font-bold text-lg">{task.child_count}</div>
                </div>
              </div>
            )}
          </div>

          {/* Dependencies */}
          {task.depends_on_names && task.depends_on_names.length > 0 && (
            <div className="p-4 bg-orange-50 border-l-4 border-orange-400 rounded-lg">
              <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-orange-600" />
                ⚠️ Dependencies ({task.depends_on_names.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {task.depends_on_names.map((dep, idx) => (
                  <span 
                    key={idx} 
                    className="bg-orange-100 text-orange-800 px-3 py-2 rounded-lg text-sm font-semibold shadow"
                  >
                    {dep}
                  </span>
                ))}
              </div>
              <p className="text-xs text-orange-700 mt-2">
                💡 These tasks must be completed first
              </p>
            </div>
          )}

          {/* Blocker Warning */}
          {task.blocking_count > 0 && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow">
              <h4 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                🚫 Blocking {task.blocking_count} Task(s)
              </h4>
              <p className="text-sm text-red-700">
                Other tasks are waiting for this to complete. Prioritize this task!
              </p>
            </div>
          )}

          {/* Parent Task */}
          {task.parent_name && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-700">
                <span className="font-semibold">↳ Part of:</span> {task.parent_name}
              </div>
            </div>
          )}

          {/* Notes */}
          {task.notes && (
            <div>
              <h4 className="font-bold text-xl mb-3 flex items-center gap-2">
                📌 Notes
              </h4>
              <p className="text-gray-700 italic leading-relaxed whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
                {task.notes}
              </p>
            </div>
          )}

          {/* Tech Details */}
          {(task.ram_usage || task.port) && (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h4 className="font-bold text-lg mb-2">🔧 Technical Details</h4>
              <div className="space-y-1 text-sm">
                {task.ram_usage && (
                  <div><span className="font-semibold">💾 RAM:</span> {task.ram_usage}</div>
                )}
                {task.port && (
                  <div><span className="font-semibold">🔌 Port:</span> {task.port}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <span className="font-semibold">Last updated:</span>{' '}
            {task.updated_at ? new Date(task.updated_at).toLocaleString() : 'N/A'}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
};
