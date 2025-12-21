/**
 * Error Tracking Utilities
 *
 * Provides production error tracking with Sentry-style functionality.
 * Captures, categorizes, and reports errors for observability.
 */

// Error severity levels
export type ErrorSeverity = 'debug' | 'info' | 'warning' | 'error' | 'fatal';

// Error context structure
export interface ErrorContext {
  userId?: string;
  teamId?: string;
  sessionId?: string;
  component?: string;
  action?: string;
  tags?: Record<string, string>;
  extra?: Record<string, any>;
}

// Breadcrumb for error trails
export interface Breadcrumb {
  timestamp: string;
  category: string;
  message: string;
  level: ErrorSeverity;
  data?: Record<string, any>;
}

// Error report structure
export interface ErrorReport {
  id: string;
  timestamp: string;
  message: string;
  stack?: string;
  severity: ErrorSeverity;
  context: ErrorContext;
  breadcrumbs: Breadcrumb[];
  fingerprint: string;
  environment: string;
  release?: string;
}

// Global state for error tracking
let globalContext: ErrorContext = {};
let breadcrumbs: Breadcrumb[] = [];
let errorReports: ErrorReport[] = [];
let onErrorCallback: ((report: ErrorReport) => void) | null = null;

const MAX_BREADCRUMBS = 50;
const MAX_LOCAL_REPORTS = 100;

/**
 * Initialize error tracking
 */
export function initErrorTracking(options?: {
  environment?: string;
  release?: string;
  onError?: (report: ErrorReport) => void;
}) {
  if (options?.onError) {
    onErrorCallback = options.onError;
  }

  // Set up global error handler
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      captureException(event.error || new Error(event.message), {
        component: 'window',
        extra: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      captureException(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        { component: 'promise' }
      );
    });
  }
}

/**
 * Set global context for all error reports
 */
export function setGlobalContext(context: ErrorContext) {
  globalContext = { ...globalContext, ...context };
}

/**
 * Set user context
 */
export function setUser(user: { id: string; email?: string; username?: string }) {
  globalContext.userId = user.id;
  if (user.email || user.username) {
    globalContext.tags = {
      ...globalContext.tags,
      ...(user.email && { userEmail: user.email }),
      ...(user.username && { username: user.username })
    };
  }
}

/**
 * Clear user context (on logout)
 */
export function clearUser() {
  delete globalContext.userId;
  if (globalContext.tags) {
    delete globalContext.tags.userEmail;
    delete globalContext.tags.username;
  }
}

/**
 * Add a breadcrumb to the trail
 */
export function addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>) {
  breadcrumbs.push({
    ...breadcrumb,
    timestamp: new Date().toISOString()
  });

  // Keep only last N breadcrumbs
  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs = breadcrumbs.slice(-MAX_BREADCRUMBS);
  }
}

/**
 * Generate a fingerprint for error deduplication
 */
function generateFingerprint(error: Error, context?: ErrorContext): string {
  const parts = [
    error.name,
    error.message.replace(/\d+/g, 'N'), // Normalize numbers
    context?.component || 'unknown',
    context?.action || 'unknown'
  ];
  return parts.join(':');
}

/**
 * Generate a unique error ID
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Capture an exception
 */
export function captureException(
  error: Error,
  context?: ErrorContext
): string {
  const mergedContext = { ...globalContext, ...context };

  const report: ErrorReport = {
    id: generateErrorId(),
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    severity: 'error',
    context: mergedContext,
    breadcrumbs: [...breadcrumbs],
    fingerprint: generateFingerprint(error, mergedContext),
    environment: process.env.NODE_ENV || 'development'
  };

  // Store locally
  errorReports.push(report);
  if (errorReports.length > MAX_LOCAL_REPORTS) {
    errorReports = errorReports.slice(-MAX_LOCAL_REPORTS);
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('[ErrorTracking]', report);
  }

  // Call callback if registered
  if (onErrorCallback) {
    try {
      onErrorCallback(report);
    } catch (callbackError) {
      console.error('Error in error callback:', callbackError);
    }
  }

  return report.id;
}

/**
 * Capture a message (non-exception)
 */
export function captureMessage(
  message: string,
  severity: ErrorSeverity = 'info',
  context?: ErrorContext
): string {
  const mergedContext = { ...globalContext, ...context };

  const report: ErrorReport = {
    id: generateErrorId(),
    timestamp: new Date().toISOString(),
    message,
    severity,
    context: mergedContext,
    breadcrumbs: [...breadcrumbs],
    fingerprint: `msg:${message.substring(0, 50)}`,
    environment: process.env.NODE_ENV || 'development'
  };

  errorReports.push(report);
  if (errorReports.length > MAX_LOCAL_REPORTS) {
    errorReports = errorReports.slice(-MAX_LOCAL_REPORTS);
  }

  if (onErrorCallback && severity !== 'debug' && severity !== 'info') {
    try {
      onErrorCallback(report);
    } catch (callbackError) {
      console.error('Error in error callback:', callbackError);
    }
  }

  return report.id;
}

/**
 * Create a scoped context for a specific operation
 */
export function withScope<T>(
  context: ErrorContext,
  fn: () => T
): T {
  const previousContext = { ...globalContext };
  setGlobalContext(context);

  try {
    return fn();
  } finally {
    globalContext = previousContext;
  }
}

/**
 * Async version of withScope
 */
export async function withScopeAsync<T>(
  context: ErrorContext,
  fn: () => Promise<T>
): Promise<T> {
  const previousContext = { ...globalContext };
  setGlobalContext(context);

  try {
    return await fn();
  } finally {
    globalContext = previousContext;
  }
}

/**
 * Wrap a function with automatic error capture
 */
export function wrapWithErrorTracking<T extends (...args: any[]) => any>(
  fn: T,
  context?: ErrorContext
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args);

      // Handle async functions
      if (result instanceof Promise) {
        return result.catch((error) => {
          captureException(error, context);
          throw error;
        });
      }

      return result;
    } catch (error) {
      captureException(error as Error, context);
      throw error;
    }
  }) as T;
}

/**
 * Get recent error reports
 */
export function getRecentErrors(limit = 10): ErrorReport[] {
  return errorReports.slice(-limit);
}

/**
 * Get errors by fingerprint for deduplication
 */
export function getErrorsByFingerprint(fingerprint: string): ErrorReport[] {
  return errorReports.filter((r) => r.fingerprint === fingerprint);
}

/**
 * Get error count by severity
 */
export function getErrorCountBySeverity(): Record<ErrorSeverity, number> {
  const counts: Record<ErrorSeverity, number> = {
    debug: 0,
    info: 0,
    warning: 0,
    error: 0,
    fatal: 0
  };

  errorReports.forEach((report) => {
    counts[report.severity]++;
  });

  return counts;
}

/**
 * Clear all stored errors
 */
export function clearErrors() {
  errorReports = [];
}

/**
 * Clear breadcrumbs
 */
export function clearBreadcrumbs() {
  breadcrumbs = [];
}

/**
 * Export errors for external reporting
 */
export function exportErrors(): ErrorReport[] {
  return [...errorReports];
}

/**
 * React Error Boundary helper
 */
export function captureReactError(
  error: Error,
  errorInfo: { componentStack: string }
) {
  captureException(error, {
    component: 'ReactErrorBoundary',
    extra: {
      componentStack: errorInfo.componentStack
    }
  });
}

/**
 * Agent-specific error tracking
 */
export function captureAgentError(
  error: Error,
  agentContext: {
    actionType?: string;
    riskLevel?: string;
    confidenceScore?: number;
    sessionId?: string;
    pendingActionId?: string;
  }
) {
  addBreadcrumb({
    category: 'agent',
    message: `Agent error: ${agentContext.actionType || 'unknown'}`,
    level: 'error',
    data: agentContext
  });

  return captureException(error, {
    component: 'agent',
    action: agentContext.actionType,
    tags: {
      riskLevel: agentContext.riskLevel || 'unknown',
      ...(agentContext.confidenceScore && {
        confidenceScore: String(agentContext.confidenceScore)
      })
    },
    extra: {
      sessionId: agentContext.sessionId,
      pendingActionId: agentContext.pendingActionId
    }
  });
}

/**
 * Performance monitoring helper
 */
export function trackPerformance(
  name: string,
  startTime: number,
  context?: ErrorContext
) {
  const duration = Date.now() - startTime;

  addBreadcrumb({
    category: 'performance',
    message: `${name} completed in ${duration}ms`,
    level: 'info',
    data: { duration, name }
  });

  // Report slow operations as warnings
  if (duration > 5000) {
    captureMessage(
      `Slow operation: ${name} took ${duration}ms`,
      'warning',
      {
        ...context,
        extra: {
          ...context?.extra,
          duration,
          operationName: name
        }
      }
    );
  }
}

/**
 * Network error tracking
 */
export function captureNetworkError(
  url: string,
  status: number,
  error?: Error
) {
  addBreadcrumb({
    category: 'network',
    message: `HTTP ${status} ${url}`,
    level: status >= 500 ? 'error' : 'warning',
    data: { url, status }
  });

  if (status >= 500) {
    captureMessage(
      `Server error: ${status} at ${url}`,
      'error',
      {
        component: 'network',
        extra: { url, status, errorMessage: error?.message }
      }
    );
  }
}

export default {
  init: initErrorTracking,
  setGlobalContext,
  setUser,
  clearUser,
  addBreadcrumb,
  captureException,
  captureMessage,
  captureReactError,
  captureAgentError,
  captureNetworkError,
  trackPerformance,
  withScope,
  withScopeAsync,
  wrapWithErrorTracking,
  getRecentErrors,
  getErrorsByFingerprint,
  getErrorCountBySeverity,
  clearErrors,
  clearBreadcrumbs,
  exportErrors
};
