// ✅ Comprehensive Error Handling Utility
// Wraps all async operations with toast notifications and retry logic

import toast from 'react-hot-toast';

/**
 * Execute an async function with error handling and toast notifications
 * @param {Function} asyncFn - The async function to execute
 * @param {Object} options - Configuration options
 * @param {string} options.successMessage - Message to show on success
 * @param {string} options.errorMessage - Custom error message
 * @param {boolean} options.showSuccess - Whether to show success toast (default: true)
 * @param {boolean} options.showError - Whether to show error toast (default: true)
 * @param {number} options.retries - Number of retries on failure (default: 0)
 * @param {number} options.retryDelay - Delay between retries in ms (default: 1000)
 * @returns {Promise} Result of the async function or throws error
 */
export const withErrorHandling = async (asyncFn, options = {}) => {
  const {
    successMessage = '',
    errorMessage = 'An error occurred',
    showSuccess = true,
    showError = true,
    retries = 0,
    retryDelay = 1000,
  } = options;

  let lastError = null;
  let attempt = 0;

  while (attempt <= retries) {
    try {
      const result = await asyncFn();

      // Show success toast if configured
      if (showSuccess && successMessage) {
        toast.success(successMessage);
      }

      return result;
    } catch (error) {
      lastError = error;
      attempt++;

      // If we have retries left, wait and retry
      if (attempt <= retries) {
        toast.loading(`Retrying... (${attempt}/${retries})`, {
          id: 'retry-toast',
          duration: retryDelay,
        });
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      // All retries exhausted, show error
      if (showError) {
        const message = error.message || errorMessage;
        toast.error(`❌ ${message}`);
      }

      throw error;
    }
  }

  throw lastError;
};

/**
 * Specific wrapper for Supabase queries with better error messages
 * @param {Function} queryFn - Function that returns a Supabase query
 * @param {string} operation - Operation name (e.g., 'loading tasks', 'updating status')
 * @param {Object} options - Additional options
 */
export const withSupabaseError = async (queryFn, operation, options = {}) => {
  return withErrorHandling(
    async () => {
      const { data, error } = await queryFn();

      if (error) {
        // Enhanced error message for Supabase errors
        const message = getSupabaseErrorMessage(error, operation);
        throw new Error(message);
      }

      return data;
    },
    {
      errorMessage: `Failed ${operation}`,
      ...options,
    }
  );
};

/**
 * Parse Supabase errors into user-friendly messages
 * @param {Error} error - Supabase error object
 * @param {string} operation - Operation being performed
 * @returns {string} User-friendly error message
 */
const getSupabaseErrorMessage = (error, operation) => {
  const { code, message, hint } = error;

  // Common Supabase error codes
  switch (code) {
    case 'PGRST116':
      return `No data found while ${operation}`;

    case '23503':
      return `Cannot ${operation}: Referenced data doesn't exist`;

    case '23505':
      return `Cannot ${operation}: Duplicate entry`;

    case '23514':
      return `Invalid data while ${operation}. Please check your input.`;

    case '42P01':
      return `Database table not found while ${operation}. Please check your setup.`;

    case '42501':
      return `Permission denied while ${operation}`;

    case 'PGRST301':
      return `Connection error while ${operation}. Please check your network.`;

    default:
      // Return the original message with hint if available
      return hint ? `${message} (${hint})` : message;
  }
};

/**
 * Validate required fields before submitting
 * @param {Object} data - Data to validate
 * @param {Array<string>} requiredFields - List of required field names
 * @throws {Error} If validation fails
 */
export const validateRequired = (data, requiredFields) => {
  const missing = requiredFields.filter(field => !data[field]);

  if (missing.length > 0) {
    const message = `Missing required fields: ${missing.join(', ')}`;
    toast.error(message);
    throw new Error(message);
  }
};

/**
 * Validate enum values
 * @param {string} value - Value to validate
 * @param {Array<string>} allowedValues - Allowed enum values
 * @param {string} fieldName - Field name for error message
 * @throws {Error} If validation fails
 */
export const validateEnum = (value, allowedValues, fieldName) => {
  if (!allowedValues.includes(value)) {
    const message = `Invalid ${fieldName}: Must be one of ${allowedValues.join(', ')}`;
    toast.error(message);
    throw new Error(message);
  }
};

/**
 * Offline detection utility
 * @returns {boolean} True if online, false if offline
 */
export const isOnline = () => {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
};

/**
 * Check if online before executing operation
 * @param {Function} fn - Function to execute
 * @throws {Error} If offline
 */
export const requireOnline = async (fn) => {
  if (!isOnline()) {
    toast.error('⚠️ No internet connection. Please check your network.');
    throw new Error('Offline');
  }
  return fn();
};

/**
 * Exponential backoff retry with better UX
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {number} baseDelay - Base delay in ms (default: 1000)
 * @returns {Promise}
 */
export const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      toast.loading(`Retrying in ${delay / 1000}s... (${attempt}/${maxRetries})`, {
        id: 'backoff-toast',
        duration: delay,
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Setup global offline/online listeners
 */
export const setupOfflineDetection = () => {
  if (typeof window === 'undefined') return;

  let wasOffline = false;

  window.addEventListener('offline', () => {
    wasOffline = true;
    toast.error('⚠️ You are offline', {
      id: 'offline-toast',
      duration: Infinity,
    });
  });

  window.addEventListener('online', () => {
    if (wasOffline) {
      toast.success('✅ Back online', {
        id: 'offline-toast',
        duration: 3000,
      });
      wasOffline = false;
    }
  });
};

// Initialize offline detection
setupOfflineDetection();
