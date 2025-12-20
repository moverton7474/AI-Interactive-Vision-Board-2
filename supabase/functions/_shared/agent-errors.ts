/**
 * Agent Error Handling Utilities
 *
 * Provides structured error handling for agentic AI operations.
 * Implements the error taxonomy from the AI Coach Agentic Execution Plan.
 */

// Error code constants
export const AGENT_ERROR_CODES = {
  // Permission errors
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  FEATURE_DISABLED: 'FEATURE_DISABLED',
  TEAM_POLICY_BLOCKED: 'TEAM_POLICY_BLOCKED',
  USER_SETTINGS_BLOCKED: 'USER_SETTINGS_BLOCKED',

  // Confirmation flow errors
  CONFIRMATION_REQUIRED: 'CONFIRMATION_REQUIRED',
  ACTION_EXPIRED: 'ACTION_EXPIRED',
  ACTION_ALREADY_PROCESSED: 'ACTION_ALREADY_PROCESSED',

  // Confidence errors
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  AMBIGUOUS_REQUEST: 'AMBIGUOUS_REQUEST',

  // Execution errors
  EXECUTION_FAILED: 'EXECUTION_FAILED',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  TIMEOUT: 'TIMEOUT',

  // Validation errors
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_ACTION_TYPE: 'INVALID_ACTION_TYPE',

  // Resource errors
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  INSUFFICIENT_RESOURCES: 'INSUFFICIENT_RESOURCES',

  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
} as const;

export type AgentErrorCode = typeof AGENT_ERROR_CODES[keyof typeof AGENT_ERROR_CODES];

// Error severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Error recovery actions
export type RecoveryAction =
  | 'retry'
  | 'ask_user'
  | 'request_confirmation'
  | 'fallback'
  | 'escalate'
  | 'abort';

/**
 * Agent Error class for structured error handling
 */
export class AgentError extends Error {
  public readonly code: AgentErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly recoveryAction: RecoveryAction;
  public readonly context: Record<string, any>;
  public readonly userMessage: string;
  public readonly retryable: boolean;
  public readonly timestamp: string;

  constructor(options: {
    code: AgentErrorCode;
    message: string;
    userMessage?: string;
    severity?: ErrorSeverity;
    recoveryAction?: RecoveryAction;
    context?: Record<string, any>;
    retryable?: boolean;
    cause?: Error;
  }) {
    super(options.message);
    this.name = 'AgentError';
    this.code = options.code;
    this.severity = options.severity || getSeverityForCode(options.code);
    this.recoveryAction = options.recoveryAction || getRecoveryActionForCode(options.code);
    this.context = options.context || {};
    this.userMessage = options.userMessage || getDefaultUserMessage(options.code);
    this.retryable = options.retryable ?? isRetryable(options.code);
    this.timestamp = new Date().toISOString();

    if (options.cause) {
      this.cause = options.cause;
    }

    // Capture stack trace
    Error.captureStackTrace?.(this, AgentError);
  }

  /**
   * Convert to JSON for logging/API responses
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      severity: this.severity,
      recoveryAction: this.recoveryAction,
      context: this.context,
      retryable: this.retryable,
      timestamp: this.timestamp,
    };
  }

  /**
   * Create a safe response object for API returns
   */
  toResponse() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.userMessage,
        retryable: this.retryable,
        recoveryAction: this.recoveryAction,
      },
    };
  }
}

/**
 * Get default severity for error code
 */
function getSeverityForCode(code: AgentErrorCode): ErrorSeverity {
  switch (code) {
    case AGENT_ERROR_CODES.INTERNAL_ERROR:
    case AGENT_ERROR_CODES.DATABASE_ERROR:
    case AGENT_ERROR_CODES.CONFIGURATION_ERROR:
      return 'critical';

    case AGENT_ERROR_CODES.PERMISSION_DENIED:
    case AGENT_ERROR_CODES.TEAM_POLICY_BLOCKED:
    case AGENT_ERROR_CODES.EXECUTION_FAILED:
      return 'high';

    case AGENT_ERROR_CODES.EXTERNAL_SERVICE_ERROR:
    case AGENT_ERROR_CODES.RATE_LIMITED:
    case AGENT_ERROR_CODES.TIMEOUT:
      return 'medium';

    default:
      return 'low';
  }
}

/**
 * Get default recovery action for error code
 */
function getRecoveryActionForCode(code: AgentErrorCode): RecoveryAction {
  switch (code) {
    case AGENT_ERROR_CODES.CONFIRMATION_REQUIRED:
      return 'request_confirmation';

    case AGENT_ERROR_CODES.LOW_CONFIDENCE:
    case AGENT_ERROR_CODES.AMBIGUOUS_REQUEST:
      return 'ask_user';

    case AGENT_ERROR_CODES.RATE_LIMITED:
    case AGENT_ERROR_CODES.TIMEOUT:
    case AGENT_ERROR_CODES.EXTERNAL_SERVICE_ERROR:
      return 'retry';

    case AGENT_ERROR_CODES.PERMISSION_DENIED:
    case AGENT_ERROR_CODES.TEAM_POLICY_BLOCKED:
    case AGENT_ERROR_CODES.USER_SETTINGS_BLOCKED:
      return 'abort';

    case AGENT_ERROR_CODES.INTERNAL_ERROR:
    case AGENT_ERROR_CODES.DATABASE_ERROR:
      return 'escalate';

    default:
      return 'fallback';
  }
}

/**
 * Check if error code is retryable
 */
function isRetryable(code: AgentErrorCode): boolean {
  return [
    AGENT_ERROR_CODES.RATE_LIMITED,
    AGENT_ERROR_CODES.TIMEOUT,
    AGENT_ERROR_CODES.EXTERNAL_SERVICE_ERROR,
  ].includes(code);
}

/**
 * Get user-friendly message for error code
 */
function getDefaultUserMessage(code: AgentErrorCode): string {
  const messages: Record<AgentErrorCode, string> = {
    [AGENT_ERROR_CODES.PERMISSION_DENIED]:
      "You don't have permission to perform this action.",
    [AGENT_ERROR_CODES.FEATURE_DISABLED]:
      'This feature is currently disabled.',
    [AGENT_ERROR_CODES.TEAM_POLICY_BLOCKED]:
      'This action is restricted by your team policy.',
    [AGENT_ERROR_CODES.USER_SETTINGS_BLOCKED]:
      'This action is disabled in your settings.',
    [AGENT_ERROR_CODES.CONFIRMATION_REQUIRED]:
      'This action requires your confirmation before proceeding.',
    [AGENT_ERROR_CODES.ACTION_EXPIRED]:
      'This action has expired. Please request it again.',
    [AGENT_ERROR_CODES.ACTION_ALREADY_PROCESSED]:
      'This action has already been processed.',
    [AGENT_ERROR_CODES.LOW_CONFIDENCE]:
      "I'm not confident about this action. Could you clarify?",
    [AGENT_ERROR_CODES.AMBIGUOUS_REQUEST]:
      'Your request is ambiguous. Could you be more specific?',
    [AGENT_ERROR_CODES.EXECUTION_FAILED]:
      'The action could not be completed. Please try again.',
    [AGENT_ERROR_CODES.EXTERNAL_SERVICE_ERROR]:
      'An external service is temporarily unavailable.',
    [AGENT_ERROR_CODES.RATE_LIMITED]:
      "You've made too many requests. Please wait a moment.",
    [AGENT_ERROR_CODES.TIMEOUT]:
      'The request took too long. Please try again.',
    [AGENT_ERROR_CODES.INVALID_PARAMETERS]:
      'The provided parameters are invalid.',
    [AGENT_ERROR_CODES.MISSING_REQUIRED_FIELD]:
      'Some required information is missing.',
    [AGENT_ERROR_CODES.INVALID_ACTION_TYPE]:
      'This action type is not recognized.',
    [AGENT_ERROR_CODES.RESOURCE_NOT_FOUND]:
      'The requested resource was not found.',
    [AGENT_ERROR_CODES.INSUFFICIENT_RESOURCES]:
      'Insufficient resources to complete this action.',
    [AGENT_ERROR_CODES.INTERNAL_ERROR]:
      'An internal error occurred. Please try again later.',
    [AGENT_ERROR_CODES.DATABASE_ERROR]:
      'A database error occurred. Please try again.',
    [AGENT_ERROR_CODES.CONFIGURATION_ERROR]:
      'A configuration issue was detected.',
  };

  return messages[code] || 'An unexpected error occurred.';
}

// Factory functions for common errors
export const AgentErrors = {
  permissionDenied: (context?: Record<string, any>) =>
    new AgentError({
      code: AGENT_ERROR_CODES.PERMISSION_DENIED,
      message: 'Permission denied for action',
      context,
    }),

  featureDisabled: (feature: string) =>
    new AgentError({
      code: AGENT_ERROR_CODES.FEATURE_DISABLED,
      message: `Feature disabled: ${feature}`,
      userMessage: `The ${feature} feature is currently disabled.`,
      context: { feature },
    }),

  teamPolicyBlocked: (action: string, teamId?: string) =>
    new AgentError({
      code: AGENT_ERROR_CODES.TEAM_POLICY_BLOCKED,
      message: `Team policy blocks action: ${action}`,
      context: { action, teamId },
    }),

  confirmationRequired: (actionId: string, actionType: string, proposedAction: any) =>
    new AgentError({
      code: AGENT_ERROR_CODES.CONFIRMATION_REQUIRED,
      message: 'User confirmation required',
      context: { actionId, actionType, proposedAction },
    }),

  actionExpired: (actionId: string) =>
    new AgentError({
      code: AGENT_ERROR_CODES.ACTION_EXPIRED,
      message: `Action expired: ${actionId}`,
      context: { actionId },
    }),

  lowConfidence: (score: number, threshold: number) =>
    new AgentError({
      code: AGENT_ERROR_CODES.LOW_CONFIDENCE,
      message: `Confidence score ${score} below threshold ${threshold}`,
      context: { score, threshold },
    }),

  executionFailed: (action: string, reason: string) =>
    new AgentError({
      code: AGENT_ERROR_CODES.EXECUTION_FAILED,
      message: `Action execution failed: ${action} - ${reason}`,
      context: { action, reason },
    }),

  externalServiceError: (service: string, error: any) =>
    new AgentError({
      code: AGENT_ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      message: `External service error: ${service}`,
      context: { service, error: error?.message || error },
      retryable: true,
    }),

  rateLimited: (limit: number, windowMs: number) =>
    new AgentError({
      code: AGENT_ERROR_CODES.RATE_LIMITED,
      message: 'Rate limit exceeded',
      context: { limit, windowMs },
      retryable: true,
    }),

  invalidParameters: (params: Record<string, any>, issues: string[]) =>
    new AgentError({
      code: AGENT_ERROR_CODES.INVALID_PARAMETERS,
      message: `Invalid parameters: ${issues.join(', ')}`,
      context: { params, issues },
    }),

  resourceNotFound: (resourceType: string, resourceId: string) =>
    new AgentError({
      code: AGENT_ERROR_CODES.RESOURCE_NOT_FOUND,
      message: `${resourceType} not found: ${resourceId}`,
      userMessage: `The ${resourceType} you're looking for couldn't be found.`,
      context: { resourceType, resourceId },
    }),

  internalError: (message: string, cause?: Error) =>
    new AgentError({
      code: AGENT_ERROR_CODES.INTERNAL_ERROR,
      message,
      cause,
    }),

  databaseError: (operation: string, error: any) =>
    new AgentError({
      code: AGENT_ERROR_CODES.DATABASE_ERROR,
      message: `Database error during ${operation}`,
      context: { operation, error: error?.message || error },
    }),
};

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: {
    fallback?: any;
    logErrors?: boolean;
    rethrow?: boolean;
  }
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (options?.logErrors !== false) {
        console.error('Agent error:', error);
      }

      if (error instanceof AgentError) {
        if (options?.rethrow) throw error;
        return options?.fallback ?? error.toResponse();
      }

      const wrappedError = AgentErrors.internalError(
        error instanceof Error ? error.message : 'Unknown error',
        error instanceof Error ? error : undefined
      );

      if (options?.rethrow) throw wrappedError;
      return options?.fallback ?? wrappedError.toResponse();
    }
  }) as T;
}

/**
 * Create HTTP response from AgentError
 */
export function agentErrorResponse(error: AgentError, corsHeaders: Record<string, string>) {
  const statusCode = getStatusCodeForError(error.code);

  return new Response(
    JSON.stringify(error.toResponse()),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: statusCode,
    }
  );
}

/**
 * Get appropriate HTTP status code for error
 */
function getStatusCodeForError(code: AgentErrorCode): number {
  switch (code) {
    case AGENT_ERROR_CODES.PERMISSION_DENIED:
    case AGENT_ERROR_CODES.TEAM_POLICY_BLOCKED:
    case AGENT_ERROR_CODES.USER_SETTINGS_BLOCKED:
      return 403;

    case AGENT_ERROR_CODES.RESOURCE_NOT_FOUND:
      return 404;

    case AGENT_ERROR_CODES.RATE_LIMITED:
      return 429;

    case AGENT_ERROR_CODES.INVALID_PARAMETERS:
    case AGENT_ERROR_CODES.MISSING_REQUIRED_FIELD:
    case AGENT_ERROR_CODES.INVALID_ACTION_TYPE:
    case AGENT_ERROR_CODES.CONFIRMATION_REQUIRED:
      return 400;

    case AGENT_ERROR_CODES.TIMEOUT:
      return 504;

    case AGENT_ERROR_CODES.EXTERNAL_SERVICE_ERROR:
      return 502;

    case AGENT_ERROR_CODES.INTERNAL_ERROR:
    case AGENT_ERROR_CODES.DATABASE_ERROR:
    case AGENT_ERROR_CODES.CONFIGURATION_ERROR:
      return 500;

    default:
      return 400;
  }
}
