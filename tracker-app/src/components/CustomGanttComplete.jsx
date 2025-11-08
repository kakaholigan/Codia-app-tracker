import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ScrollSync, ScrollSyncPane } from 'react-scroll-sync';
import { supabase } from '../lib/supabase';
import { format, addDays, differenceInDays, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { Calendar, RefreshCw, Undo2, Redo2, Download } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { TaskDetailModal } from './TaskDetailModal';
import { useDebounce } from '../hooks/useDebounce';

export const CustomGanttComplete = ({ selectedTask: highlightedTaskFromPage }) => {
  const [tasks, setTasks] = useState([]);
  const [phases, setPhases] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('week');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedTask, setSelectedTask] = useState(null);
  const [immediateHoveredTask, setImmediateHoveredTask] = useState(null);
  const hoveredTask = useDebounce(immediateHoveredTask, 50);
  const [sortBy, setSortBy] = useState('order');
  const [showAllArrows, setShowAllArrows] = useState(false);
  const [showCriticalPath, setShowCriticalPath] = useState(true); // Auto-enable Critical Path
  const [localHighlightedTask, setLocalHighlightedTask] = useState(null);
  const [tooltip, setTooltip] = useState({ visible: false, content: null, x: 0, y: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const [draggedTask, setDraggedTask] = useState(null);
  const [linkingState, setLinkingState] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const highlightedTask = highlightedTaskFromPage ? highlightedTaskFromPage.task_id : localHighlightedTask;

  // --- Highlighting Logic ---
  const getRelatedTaskIds = (taskId) => {
    if (!taskId) return new Set();
    const related = new Set([taskId]);
    const checkDownstream = (id) => {
      tasks.forEach(t => {
        if (t.blocking_dependencies) {
          const depIds = t.blocking_dependencies.map(d => 
            typeof d === 'string' ? parseInt(d.split(':')[0]) : d
          );
          if (depIds.includes(id) && !related.has(t.id)) {
            related.add(t.id);
            checkDownstream(t.id);
          }
        }
      });
    };
    const checkUpstream = (id) => {
      const task = tasks.find(t => t.id === id);
      if (task?.blocking_dependencies) {
        task.blocking_dependencies.forEach(depString => {
          const depId = typeof depString === 'string' ? parseInt(depString.split(':')[0]) : depString;
          if (!related.has(depId)) {
            related.add(depId);
            checkUpstream(depId);
          }
        });
      }
    };
    checkDownstream(taskId);
    checkUpstream(taskId);
    return related;
  };

  const highlightedIds = useMemo(() => getRelatedTaskIds(hoveredTask), [hoveredTask, tasks]);

  // --- Critical Path Logic ---
  const criticalPathIds = useMemo(() => {
    if (!tasks.length) return new Set();

    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const memo = new Map();

    const getLongestPath = (taskId) => {
      if (memo.has(taskId)) return memo.get(taskId);

      const task = taskMap.get(taskId);
      if (!task) return { path: [], duration: 0 };

      const duration = task.estimated_hours ? Math.max(1, Math.ceil(task.estimated_hours / 8)) : 1;

      const downstreamTasks = tasks.filter(t => {
        if (!t.blocking_dependencies) return false;
        const depIds = t.blocking_dependencies.map(d => 
          typeof d === 'string' ? parseInt(d.split(':')[0]) : d
        );
        return depIds.includes(taskId);
      });

      if (downstreamTasks.length === 0) {
        const result = { path: [taskId], duration };
        memo.set(taskId, result);
        return result;
      }

      let longestSubPath = { path: [], duration: 0 };
      downstreamTasks.forEach(downstreamTask => {
        const subPath = getLongestPath(downstreamTask.id);
        if (subPath.duration > longestSubPath.duration) {
          longestSubPath = subPath;
        }
      });

      const result = { 
        path: [taskId, ...longestSubPath.path], 
        duration: duration + longestSubPath.duration 
      };
      memo.set(taskId, result);
      return result;
    };

    let criticalPath = { path: [], duration: -1 };
    const rootTasks = tasks.filter(t => !t.blocking_dependencies || t.blocking_dependencies.length === 0);
    
    rootTasks.forEach(task => {
      const pathInfo = getLongestPath(task.id);
      if (pathInfo.duration > criticalPath.duration) {
        criticalPath = pathInfo;
      }
    });

    return new Set(criticalPath.path);

  }, [tasks]);

  const leftPanelRef = useRef(null);
  const timelineRef = useRef(null);

  const handleScroll = (e) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    const timelineEl = timelineRef.current;
    if (timelineEl) {
      const { left, width } = getTaskPosition(task);
      const timelineWidth = timelineEl.offsetWidth;
      const targetScrollLeft = left - (timelineWidth / 2) + (width / 2);
      timelineEl.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    if (leftPanelRef.current && leftPanelRef.current.scrollTop !== scrollTop) {
      leftPanelRef.current.scrollTop = scrollTop;
    }
    if (timelineRef.current && timelineRef.current.scrollTop !== scrollTop) {
      timelineRef.current.scrollTop = scrollTop;
    }
  }, [scrollTop]);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel('custom_gantt_complete')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, loadData)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const loadData = async () => {
    try {
      const [tasksRes, phasesRes, sprintsRes] = await Promise.all([
        supabase.from('tasks_with_dependencies').select('*').order('phase_id').order('order_index'),
        supabase.from('phases').select('*').order('order_index'),
        supabase.from('sprints').select('*').order('start_date')
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (phasesRes.error) throw phasesRes.error;
      if (sprintsRes.error) throw sprintsRes.error;
      setTasks(tasksRes.data || []);
      setPhases(phasesRes.data || []);
      setSprints(sprintsRes.data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTaskPosition = (task) => {
    const startDate = task.start_date ? new Date(task.start_date) : (task.started_at ? new Date(task.started_at) : addDays(new Date(), (task.order_index || 0) * 2));
    const durationDays = task.estimated_hours ? Math.max(1, Math.ceil(task.estimated_hours / 8)) : 3;
    const endDate = task.due_date ? new Date(task.due_date) : (task.completed_at ? new Date(task.completed_at) : addDays(startDate, durationDays));
    const left = differenceInDays(startDate, projectStart) * dayWidth;
    const width = Math.max(differenceInDays(endDate, startDate) * dayWidth, dayWidth);
    return { left, width, startDate, endDate };
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><p className="text-text-tertiary">Loading Gantt...</p></div>;
  }

  const projectStart = tasks.length > 0 ? new Date(Math.min(...tasks.filter(t => t.start_date || t.started_at).map(t => new Date(t.start_date || t.started_at)))) : new Date();
  const projectEnd = tasks.length > 0 ? new Date(Math.max(...tasks.filter(t => t.due_date || t.completed_at || t.start_date).map(t => new Date(t.due_date || t.completed_at || addDays(new Date(t.start_date), t.estimated_hours ? Math.max(1, Math.ceil(t.estimated_hours / 8)) : 3))))) : addDays(new Date(), 30);

  const dayWidth = 30 * zoomLevel;
  const ganttWidth = differenceInDays(projectEnd, projectStart) * dayWidth;
  const taskPositions = new Map();

  const monthHeaders = eachMonthOfInterval({ start: projectStart, end: projectEnd }).map(monthStart => {
    const monthEnd = endOfMonth(monthStart);
    const start = differenceInDays(monthStart, projectStart) * dayWidth;
    const width = differenceInDays(monthEnd, monthStart) * dayWidth;
    return { name: format(monthStart, 'MMMM yyyy'), left: start, width };
  });

  const todayPosition = differenceInDays(new Date(), projectStart) * dayWidth;

  const sortedTasks = [...tasks].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'start') return new Date(a.started_at) - new Date(b.started_at);
    return a.order_index - b.order_index;
  });

  return (
    <div className="h-full flex flex-col bg-background-secondary rounded-lg border border-border-default">
      <Tooltip visible={tooltip.visible} content={tooltip.content} x={tooltip.x} y={tooltip.y} />
      {selectedTask && <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} onUpdate={loadData} />}
      {linkingState && <LinkingArrow from={linkingState.from} to={linkingState.to} />}
      <Toaster position="top-right" />
      <div className="flex-shrink-0 flex items-center justify-between p-3 border-b border-border-default">
        <div className="flex items-center gap-4">
          <h3 className="font-bold text-lg text-text-primary">Gantt Chart</h3>
          <button onClick={loadData} className="p-2 rounded-md hover:bg-background-tertiary text-text-secondary"><RefreshCw className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-2">
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-background-primary border border-border-default rounded-md px-2 py-1 text-sm">
            <option value="order">Default Order</option>
            <option value="name">Name</option>
            <option value="start">Start Date</option>
          </select>
          <button onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.1))} className="p-2 rounded-md hover:bg-background-tertiary">-</button>
          <span className="text-sm font-semibold">{(zoomLevel * 100).toFixed(0)}%</span>
          <button onClick={() => setZoomLevel(z => Math.min(2, z + 0.1))} className="p-2 rounded-md hover:bg-background-tertiary">+</button>
          <div className="border-l border-border-default h-6 mx-2"></div>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={showCriticalPath} onChange={() => setShowCriticalPath(!showCriticalPath)} />
            Critical Path
          </label>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden relative">
        <div ref={leftPanelRef} onScroll={handleScroll} className="w-[400px] flex-shrink-0 overflow-y-auto border-r border-border-default" style={{ scrollbarWidth: 'none' }}>
          {/* Left Header */}
          <div className="h-12 flex items-center px-4 sticky top-0 z-20 bg-background-secondary border-b border-border-default">
            <h4 className="font-bold text-text-primary">Tasks</h4>
          </div>
          {/* Task List */}
          <div className="relative">
            {phases.map(phase => (
              <React.Fragment key={phase.id}>
                <div className="h-10 flex items-center p-2 sticky top-12 z-10 bg-background-tertiary border-b border-t border-border-default">
                  <strong className="text-sm text-text-primary">{phase.name}</strong>
                </div>
                {sortedTasks.filter(t => t.phase_id === phase.id).map(task => (
                  <div key={task.id} 
                       className={`h-10 flex items-center justify-between p-2 text-sm border-b border-border-default cursor-pointer transition-all duration-200 ${
                         selectedTask?.id === task.id 
                           ? 'bg-brand-secondary text-text-onPrimary' 
                           : 'hover:bg-background-tertiary'
                       } ${
                         hoveredTask && !highlightedIds.has(task.id) ? 'opacity-30' : 'opacity-100'
                       }`}
                       onClick={() => setLocalHighlightedTask(task.id)}
                       onMouseEnter={(e) => {
                         setImmediateHoveredTask(task.id);
                         setTooltip({ visible: true, content: task, x: e.pageX, y: e.pageY });
                       }}
                       onMouseLeave={() => {
                         setImmediateHoveredTask(null);
                         setTooltip({ visible: false, content: null, x: 0, y: 0 });
                       }}>
                    <span className='truncate pr-2'>{task.name}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${task.status === 'DONE' ? 'bg-success-background text-success-text' : 'bg-info-background text-info-text'}`}>{task.status}</span>
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div ref={timelineRef} onScroll={handleScroll} className="flex-1 overflow-auto">
          <div style={{ width: ganttWidth, position: 'relative' }}>
            {/* Month/Day Headers */}
            <div className="h-12 flex sticky top-0 z-30 bg-background-secondary border-b border-border-default">
              {monthHeaders.map(month => (
                <div key={month.name} style={{ left: month.left, width: month.width }} className="absolute top-0 h-full flex items-center justify-center border-r border-border-default">
                  <span className="font-bold text-sm text-text-primary">{month.name}</span>
                </div>
              ))}
            </div>
            {/* Grid & Task Bars */}
            <div className="relative">
              {/* Sprint Backgrounds */}
              {sprints.map((sprint, index) => {
                const sprintStart = new Date(sprint.start_date);
                const sprintEnd = new Date(sprint.end_date);
                const left = differenceInDays(sprintStart, projectStart) * dayWidth;
                const width = differenceInDays(sprintEnd, sprintStart) * dayWidth;
                return (
                  <div key={sprint.id} style={{ left, width }} className={`absolute top-0 h-full ${index % 2 === 0 ? 'bg-background-tertiary/70' : 'bg-transparent'}`}>
                    <div className='font-bold text-sm text-text-tertiary p-2'>{sprint.name}</div>
                  </div>
                )
              })}
              {/* Vertical Grid Lines */}
              {Array.from({ length: Math.ceil(differenceInDays(projectEnd, projectStart)) }).map((_, i) => (
                <div key={`grid-v-${i}`} style={{ left: i * dayWidth }} className="absolute top-0 h-full w-px bg-border-default/50"></div>
              ))}
              {/* Today Marker - Prominent */}
              {todayPosition >= 0 && (
                <div style={{ left: todayPosition }} className="absolute top-0 h-full z-15">
                  {/* Glow line */}
                  <div className="absolute top-0 h-full w-1 bg-brand-primary shadow-lg" style={{ boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)' }}></div>
                  {/* Label */}
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-brand-primary text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg whitespace-nowrap">
                    📍 TODAY
                  </div>
                </div>
              )}
              {/* Drop Zone & Horizontal Grid Lines */}
              <div 
                className={`absolute top-0 left-0 w-full h-full transition-colors ${draggedTask ? 'bg-brand-primary/10' : ''}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault();
                  const taskId = e.dataTransfer.getData('text/plain');
                  if (!taskId) return;
                  
                  const task = tasks.find(t => t.id === taskId);
                  if (!task) return;

                  const timelineRect = timelineRef.current.getBoundingClientRect();
                  const dropX = e.clientX - timelineRect.left + timelineRef.current.scrollLeft;
                  const newStartDate = addDays(projectStart, Math.floor(dropX / dayWidth));
                  
                  // Calculate new due_date based on estimated_hours
                  const durationDays = task.estimated_hours ? Math.max(1, Math.ceil(task.estimated_hours / 8)) : 3;
                  const newDueDate = addDays(newStartDate, durationDays);
                  
                  const { error } = await supabase
                    .from('tasks')
                    .update({ 
                      start_date: newStartDate.toISOString(),
                      due_date: newDueDate.toISOString()
                    })
                    .eq('id', taskId);

                  if (error) {
                    toast.error(`Failed: ${error.message}`);
                  } else {
                    toast.success(`Moved to ${format(newStartDate, 'MMM d')}`);
                    loadData();
                  }
                  setDraggedTask(null);
                }}>
              {(() => {
                let rowIndex = 0;
                return phases.map(phase => (
                  <React.Fragment key={`phase-bars-${phase.id}`}>
                    <div className="h-10 bg-background-tertiary/30 border-b border-t border-border-default"></div>
                    {(() => { rowIndex++; return null; })()}
                    {sortedTasks.filter(t => t.phase_id === phase.id).map(task => {
                      const { left, width } = getTaskPosition(task);
                      const taskTop = rowIndex * 40;
                      taskPositions.set(task.id, { 
                        x: left + width, 
                        y: taskTop + 20, // center of the 40px row
                        startX: left,
                      });
                      rowIndex++;
                      return (
                        <div key={`bar-${task.id}`} className="h-10 relative border-b border-border-default">
                          <div 
                             style={{ left, width, top: 5, height: 30, cursor: 'pointer' }} 
                             onClick={() => setSelectedTask(task)}
                             onMouseEnter={(e) => {
                               setImmediateHoveredTask(task.id);
                               setTooltip({ visible: true, content: task, x: e.pageX, y: e.pageY });
                             }}
                             onMouseLeave={() => {
                               setImmediateHoveredTask(null);
                               setTooltip({ visible: false, content: null, x: 0, y: 0 });
                             }}
                             draggable={!linkingState}
                             onDragStart={(e) => {
                               if (linkingState) {
                                 e.preventDefault();
                                 return;
                               }
                               e.dataTransfer.effectAllowed = 'move';
                               e.dataTransfer.setData('text/plain', task.id);
                               setDraggedTask(task);
                             }}
                             onDragEnd={() => {
                               setDraggedTask(null);
                             }}
                             onDragEnter={() => linkingState && setDropTargetId(task.id)}
                             onDragLeave={() => linkingState && setDropTargetId(null)}
                             onDrop={async (e) => {
                               e.preventDefault();
                               e.stopPropagation();
                               const fromTaskId = e.dataTransfer.getData('dependency/from');
                               const toTaskId = task.id;
                               if (fromTaskId && fromTaskId !== toTaskId) {
                                 const fromTask = tasks.find(t => t.id === fromTaskId);
                                 const toTask = tasks.find(t => t.id === toTaskId);
                                 
                                 if (!fromTask || !toTask) return;
                                 
                                 // Format: "ID: Name" to match DB format
                                 const depString = `${fromTaskId}: ${fromTask.name}`;
                                 
                                 // Check if already exists
                                 const existingDeps = toTask.blocking_dependencies || [];
                                 if (existingDeps.some(d => d.startsWith(`${fromTaskId}:`))) {
                                   toast.error('Dependency already exists!');
                                   return;
                                 }
                                 
                                 const newDependencies = [...existingDeps, depString];
                                 
                                 const { error } = await supabase
                                   .from('tasks')
                                   .update({ blocking_dependencies: newDependencies })
                                   .eq('id', toTaskId);

                                 if (error) {
                                   toast.error(`Failed to link: ${error.message}`);
                                 } else {
                                   toast.success(`Linked: ${fromTask.name} → ${toTask.name}`);
                                   loadData(); // Refresh to show new arrow
                                 }
                               }
                             }}
                             className={`absolute rounded-md flex items-center px-2 text-white text-xs shadow-md cursor-pointer transition-all duration-200 ${
                               draggedTask?.id === task.id ? 'opacity-50' :
                               showCriticalPath && criticalPathIds.has(task.id) 
                                 ? 'bg-red-500'
                                 : selectedTask?.id === task.id 
                                   ? 'bg-orange-400 ring-2 ring-orange-200'
                                   : 'bg-brand-primary'
                             } ${
                               linkingState && dropTargetId === task.id ? 'ring-2 ring-green-500 ring-offset-2' : ''
                             } ${
                               hoveredTask && !highlightedIds.has(task.id) ? 'opacity-30' : 'opacity-100'
                             }`}>
                            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-brand-primary rounded-full cursor-pointer"></div>
                            <p className='truncate'>{task.name}</p>
                            <div 
                              draggable 
                              onDragStart={(e) => {
                                e.stopPropagation();
                                e.dataTransfer.setData('dependency/from', task.id);
                                const fromPos = taskPositions.get(task.id);
                                setLinkingState({ from: fromPos, to: {x: fromPos.x, y: fromPos.y} });
                              }}
                              onDrag={(e) => {
                                e.stopPropagation();
                                if (e.clientX === 0 && e.clientY === 0) return; // Ignore final drag event
                                const timelineRect = timelineRef.current.getBoundingClientRect();
                                const scrollLeft = timelineRef.current.scrollLeft;
                                const scrollTop = timelineRef.current.scrollTop;
                                setLinkingState(prev => ({ 
                                  ...prev, 
                                  to: { 
                                    x: e.clientX - timelineRect.left + scrollLeft, 
                                    y: e.clientY - timelineRect.top + scrollTop 
                                  }
                                }));
                              }}
                              onDragEnd={(e) => {
                                e.stopPropagation();
                                setLinkingState(null);
                                setDropTargetId(null);
                              }}
                              className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-brand-primary rounded-full cursor-pointer z-10"></div>
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ));
              })()}
              <DependencyArrows 
                tasks={sortedTasks} 
                taskPositions={taskPositions}
                hoveredTask={hoveredTask}
                highlightedIds={highlightedIds}
                showCriticalPath={showCriticalPath}
                criticalPathIds={criticalPathIds}
              />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DependencyArrows = ({ tasks, taskPositions, hoveredTask, highlightedIds, showCriticalPath, criticalPathIds }) => {
  if (!taskPositions.size) return null;

  const arrows = [];
  tasks.forEach(task => {
    if (task.blocking_dependencies && task.blocking_dependencies.length > 0) {
      const toTaskPos = taskPositions.get(task.id);
      if (!toTaskPos) return;

      task.blocking_dependencies.forEach(depString => {
        // Parse "ID: Name" format to get ID
        const depId = typeof depString === 'string' ? parseInt(depString.split(':')[0]) : depString;
        const fromTaskPos = taskPositions.get(depId);
        if (!fromTaskPos) return;

        const fromX = fromTaskPos.x;
        const fromY = fromTaskPos.y;
        const toX = toTaskPos.startX;
        const toY = toTaskPos.y;

        const isHighlighted = hoveredTask && highlightedIds.has(depId) && highlightedIds.has(task.id);
        const isCritical = showCriticalPath && criticalPathIds.has(depId) && criticalPathIds.has(task.id);
        const path = `M ${fromX} ${fromY} C ${fromX + 20} ${fromY} ${toX - 20} ${toY} ${toX} ${toY}`;
        arrows.push({ 
          id: `${depId}-${task.id}`,
          d: path, 
          isHighlighted,
          isCritical
        });
      });
    }
  });

  return (
    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
      <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#0ea5e9" />
        </marker>
        <marker id="arrowhead-highlight" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#fb923c" />
        </marker>
        <marker id="arrowhead-critical" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
        </marker>
      </defs>
      {arrows.map(arrow => (
        <path key={arrow.id} d={arrow.d} 
              stroke={arrow.isCritical ? '#ef4444' : arrow.isHighlighted ? '#fb923c' : '#0ea5e9'} 
              strokeWidth={arrow.isCritical || arrow.isHighlighted ? 3 : 2} 
              fill="none" 
              markerEnd={arrow.isCritical ? 'url(#arrowhead-critical)' : arrow.isHighlighted ? 'url(#arrowhead-highlight)' : 'url(#arrowhead)'} 
              className={`transition-all duration-300 ${
                hoveredTask && !arrow.isHighlighted ? 'opacity-20' : 'opacity-100'
              }`} />
      ))}
    </svg>
  );
};

const Tooltip = ({ visible, content, x, y }) => {
  if (!visible || !content) return null;
  return (
    <div 
      className="fixed p-3 bg-background-primary border border-border-default rounded-lg shadow-2xl max-w-xs z-50 pointer-events-none"
      style={{ top: y + 15, left: x + 15 }}
    >
      <h4 className="font-bold text-text-primary mb-2">{content.name}</h4>
      <p className="text-sm text-text-secondary mb-1"><strong>Status:</strong> {content.status}</p>
      {content.started_at && <p className="text-sm text-text-secondary mb-1"><strong>Start:</strong> {format(new Date(content.started_at), 'MMM d, yyyy')}</p>}
      {content.completed_at && <p className="text-sm text-text-secondary mb-1"><strong>End:</strong> {format(new Date(content.completed_at), 'MMM d, yyyy')}</p>}
      <p className="text-sm text-text-secondary"><strong>Estimate:</strong> {content.estimated_hours} hours</p>
    </div>
  );
};

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

const LinkingArrow = ({ from, to }) => {
  if (!from || !to) return null;
  
  const path = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  
  return (
    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 25 }}>
      <defs>
        <marker id="arrowhead-linking" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
          <polygon points="0 0, 8 4, 0 8" fill="#fb923c" />
        </marker>
      </defs>
      <path 
        d={path} 
        stroke="#fb923c" 
        strokeWidth="3" 
        fill="none" 
        strokeDasharray="8,4"
        markerEnd="url(#arrowhead-linking)"
      />
    </svg>
  );
};

// TaskModal removed - now using TaskDetailModal imported from ./TaskDetailModal
