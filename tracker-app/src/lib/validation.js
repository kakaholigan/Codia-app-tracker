// ✅ Client-side Validation Layer
// Validates data before sending to Supabase
// Prevents invalid data and provides clear error messages

import toast from 'react-hot-toast';

/**
 * Validate task status
 * @param {string} status - Status to validate
 * @returns {boolean} True if valid
 */
export const validateStatus = (status) => {
  const validStatuses = ['PENDING', 'IN_PROGRESS', 'DONE'];

  if (!status) {
    toast.error('❌ Status is required');
    return false;
  }

  if (!validStatuses.includes(status)) {
    toast.error(`❌ Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    return false;
  }

  return true;
};

/**
 * Validate task priority
 * @param {string} priority - Priority to validate (can be null)
 * @returns {boolean} True if valid
 */
export const validatePriority = (priority) => {
  if (!priority) return true; // Priority is optional

  const validPriorities = ['HIGH', 'MEDIUM', 'LOW'];

  if (!validPriorities.includes(priority)) {
    toast.error(`❌ Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
    return false;
  }

  return true;
};

/**
 * Validate complexity (1-5)
 * @param {number} complexity - Complexity to validate
 * @returns {boolean} True if valid
 */
export const validateComplexity = (complexity) => {
  if (!complexity) return true; // Complexity is optional

  const num = parseInt(complexity);

  if (isNaN(num) || num < 1 || num > 5) {
    toast.error('❌ Complexity must be between 1 and 5');
    return false;
  }

  return true;
};

/**
 * Validate estimated hours
 * @param {number} hours - Hours to validate
 * @returns {boolean} True if valid
 */
export const validateEstimatedHours = (hours) => {
  if (!hours) return true; // Optional

  const num = parseFloat(hours);

  if (isNaN(num) || num <= 0) {
    toast.error('❌ Estimated hours must be a positive number');
    return false;
  }

  if (num > 1000) {
    toast.error('❌ Estimated hours seems too high (max: 1000)');
    return false;
  }

  return true;
};

/**
 * Validate task name
 * @param {string} name - Task name to validate
 * @returns {boolean} True if valid
 */
export const validateTaskName = (name) => {
  if (!name || name.trim().length === 0) {
    toast.error('❌ Task name is required');
    return false;
  }

  if (name.length > 500) {
    toast.error('❌ Task name is too long (max: 500 characters)');
    return false;
  }

  return true;
};

/**
 * Validate description
 * @param {string} description - Description to validate
 * @returns {boolean} True if valid
 */
export const validateDescription = (description) => {
  if (!description) return true; // Optional

  if (description.length > 5000) {
    toast.error('❌ Description is too long (max: 5000 characters)');
    return false;
  }

  return true;
};

/**
 * Validate assigned type
 * @param {string} assignedType - Type to validate
 * @returns {boolean} True if valid
 */
export const validateAssignedType = (assignedType) => {
  if (!assignedType) return true; // Optional

  const validTypes = ['HUMAN', 'AI', 'AGENT'];

  if (!validTypes.includes(assignedType)) {
    toast.error(`❌ Invalid assigned type. Must be one of: ${validTypes.join(', ')}`);
    return false;
  }

  return true;
};

/**
 * Validate task before update
 * @param {Object} updates - Task updates object
 * @returns {boolean} True if all validations pass
 */
export const validateTaskUpdate = (updates) => {
  // Validate status if present
  if (updates.status && !validateStatus(updates.status)) {
    return false;
  }

  // Validate priority if present
  if (updates.priority && !validatePriority(updates.priority)) {
    return false;
  }

  // Validate complexity if present
  if (updates.complexity && !validateComplexity(updates.complexity)) {
    return false;
  }

  // Validate estimated_hours if present
  if (updates.estimated_hours && !validateEstimatedHours(updates.estimated_hours)) {
    return false;
  }

  // Validate name if present
  if (updates.name && !validateTaskName(updates.name)) {
    return false;
  }

  // Validate description if present
  if (updates.description && !validateDescription(updates.description)) {
    return false;
  }

  // Validate assigned_type if present
  if (updates.assigned_type && !validateAssignedType(updates.assigned_type)) {
    return false;
  }

  return true;
};

/**
 * Validate task before creation
 * @param {Object} task - Task object
 * @returns {boolean} True if all validations pass
 */
export const validateTaskCreate = (task) => {
  // Required fields
  if (!validateTaskName(task.name)) return false;
  if (!validateStatus(task.status)) return false;

  // Optional fields
  if (task.priority && !validatePriority(task.priority)) return false;
  if (task.complexity && !validateComplexity(task.complexity)) return false;
  if (task.estimated_hours && !validateEstimatedHours(task.estimated_hours)) return false;
  if (task.description && !validateDescription(task.description)) return false;
  if (task.assigned_type && !validateAssignedType(task.assigned_type)) return false;

  return true;
};

/**
 * Validate dependencies (array of task IDs)
 * @param {Array<number>} dependencies - Array of task IDs
 * @param {number} taskId - Current task ID (to prevent self-dependency)
 * @returns {boolean} True if valid
 */
export const validateDependencies = (dependencies, taskId) => {
  if (!dependencies) return true; // Optional

  if (!Array.isArray(dependencies)) {
    toast.error('❌ Dependencies must be an array');
    return false;
  }

  // Check for self-dependency
  if (taskId && dependencies.includes(taskId)) {
    toast.error('❌ A task cannot depend on itself');
    return false;
  }

  // Check all are numbers
  const allNumbers = dependencies.every(dep => typeof dep === 'number' && !isNaN(dep));
  if (!allNumbers) {
    toast.error('❌ All dependencies must be valid task IDs (numbers)');
    return false;
  }

  return true;
};

/**
 * Validate date (must be valid ISO string or Date object)
 * @param {string|Date} date - Date to validate
 * @param {string} fieldName - Name of the field (for error message)
 * @returns {boolean} True if valid
 */
export const validateDate = (date, fieldName = 'Date') => {
  if (!date) return true; // Optional

  const dateObj = new Date(date);

  if (isNaN(dateObj.getTime())) {
    toast.error(`❌ ${fieldName} is not a valid date`);
    return false;
  }

  return true;
};

/**
 * Validate business rules for task status changes
 * @param {Object} task - Current task
 * @param {string} newStatus - New status
 * @returns {boolean} True if valid
 */
export const validateStatusChange = (task, newStatus) => {
  // Can't mark as IN_PROGRESS or DONE if dependencies not completed
  if ((newStatus === 'IN_PROGRESS' || newStatus === 'DONE') && task.execution_status === 'BLOCKED') {
    toast.error('❌ Cannot change status: Task is blocked by incomplete dependencies');
    return false;
  }

  // Can't go from DONE back to PENDING
  if (task.status === 'DONE' && newStatus === 'PENDING') {
    toast.error('⚠️ Moving task from DONE to PENDING. Are you sure?');
    // Allow but warn
  }

  return true;
};

export default {
  validateStatus,
  validatePriority,
  validateComplexity,
  validateEstimatedHours,
  validateTaskName,
  validateDescription,
  validateAssignedType,
  validateTaskUpdate,
  validateTaskCreate,
  validateDependencies,
  validateDate,
  validateStatusChange,
};
