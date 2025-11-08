import { createClient } from '@supabase/supabase-js';
import { withSupabaseError } from './errorHandler';

const SUPABASE_URL = 'https://pmqocxdtypxobihxusqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtcW9jeGR0eXB4b2JpaHh1c3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNDYwMjEsImV4cCI6MjA3MzcyMjAyMX0.32zS3ZG9Y7eRYPXZE2dfVIGd1NHGVThVYN-Y4UXx9O8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Phases
export const getPhases = async () => {
  const { data, error } = await supabase
    .from('phases')
    .select('*')
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data;
};

export const updatePhaseProgress = async (phaseId, progress) => {
  const { data, error } = await supabase
    .from('phases')
    .update({ progress, updated_at: new Date() })
    .eq('id', phaseId);
  if (error) throw error;
  return data;
};

// Tasks - NEW: Query from tracker_app_data view for full context
export const getTasks = async (phaseId) => {
  const { data, error } = await supabase
    .from('tracker_app_data')
    .select('*')
    .eq('phase_id', phaseId)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data;
};

export const getAllTasks = async () => {
  const { data, error } = await supabase
    .from('tracker_app_data')
    .select('*')
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data;
};

// Get GAP analysis
export const getGapAnalysis = async () => {
  const { data, error } = await supabase
    .from('gap_analysis')
    .select('*')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data;
};

export const updateTaskStatus = async (taskId, status, notes = '') => {
  const updates = { 
    status, 
    notes,
    updated_at: new Date().toISOString()
  };
  
  // Set started_at when moving to IN_PROGRESS
  if (status === 'IN_PROGRESS') {
    updates.started_at = new Date().toISOString();
  }
  
  // Set completed_at when DONE
  if (status === 'DONE') {
    updates.completed_at = new Date().toISOString();
  }
  
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId);
    
  if (error) {
    console.error('Supabase update error:', error);
    throw error;
  }
  return data;
};

// Logs
export const getLogs = async (limit = 50) => {
  const { data, error } = await supabase
    .from('logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
};

export const addLog = async (action, details, status = 'SUCCESS') => {
  const { data, error } = await supabase
    .from('logs')
    .insert([{ action, details, status }]);
  if (error) throw error;
  return data;
};

// Real-time subscriptions (Supabase v2 syntax)
export const subscribeToPhases = (callback) => {
  return supabase
    .channel('phases-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'phases' }, callback)
    .subscribe();
};

export const subscribeToTasks = (phaseId, callback) => {
  return supabase
    .channel(`tasks-channel-${phaseId}`)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'tasks',
      filter: `phase_id=eq.${phaseId}`
    }, callback)
    .subscribe();
};

export const subscribeToLogs = (callback) => {
  return supabase
    .channel('logs-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, callback)
    .subscribe();
};
