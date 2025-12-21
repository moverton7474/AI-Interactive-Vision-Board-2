/**
 * Agent Execution Tracing Utilities
 *
 * Provides observability for agentic AI operations.
 * Logs execution traces to agent_execution_traces table for analytics and debugging.
 */

// Trace types supported by the system
export type TraceType =
  | 'llm_call'
  | 'tool_call'
  | 'tool_result'
  | 'decision_point'
  | 'confirmation_request'
  | 'user_response'
  | 'action_cancelled'
  | 'action_executed'
  | 'error';

// Trace entry structure
export interface TraceEntry {
  session_id?: string;
  user_id: string;
  team_id?: string;
  trace_type: TraceType;
  step_number?: number;
  input_tokens?: number;
  output_tokens?: number;
  latency_ms?: number;
  duration_ms?: number;
  model_used?: string;
  tool_name?: string;
  function_name?: string;
  input_payload?: Record<string, any>;
  input_data?: Record<string, any>;
  output_payload?: Record<string, any>;
  output_data?: Record<string, any>;
  confidence_score?: number;
  error?: string;
}

/**
 * Execution Tracer class for structured tracing
 */
export class ExecutionTracer {
  private supabase: any;
  private sessionId: string | undefined;
  private userId: string;
  private teamId: string | undefined;
  private stepCounter: number = 0;
  private traces: TraceEntry[] = [];
  private startTime: number;

  constructor(options: {
    supabase: any;
    userId: string;
    sessionId?: string;
    teamId?: string;
  }) {
    this.supabase = options.supabase;
    this.userId = options.userId;
    this.sessionId = options.sessionId;
    this.teamId = options.teamId;
    this.startTime = Date.now();
  }

  /**
   * Record a trace entry
   */
  async trace(entry: Omit<TraceEntry, 'user_id' | 'session_id' | 'team_id' | 'step_number'>): Promise<void> {
    this.stepCounter++;

    const fullEntry: TraceEntry = {
      ...entry,
      user_id: this.userId,
      session_id: this.sessionId,
      team_id: this.teamId,
      step_number: this.stepCounter,
    };

    this.traces.push(fullEntry);

    // Async write to database (non-blocking)
    this.writeTrace(fullEntry).catch(err =>
      console.error('Failed to write trace:', err)
    );
  }

  /**
   * Write trace to database
   */
  private async writeTrace(entry: TraceEntry): Promise<void> {
    try {
      await this.supabase
        .from('agent_execution_traces')
        .insert({
          session_id: entry.session_id,
          user_id: entry.user_id,
          team_id: entry.team_id,
          trace_type: entry.trace_type,
          step_number: entry.step_number,
          input_tokens: entry.input_tokens,
          output_tokens: entry.output_tokens,
          latency_ms: entry.latency_ms,
          duration_ms: entry.duration_ms,
          model_used: entry.model_used,
          tool_name: entry.tool_name,
          function_name: entry.function_name,
          input_payload: entry.input_payload,
          input_data: entry.input_data,
          output_payload: entry.output_payload,
          output_data: entry.output_data,
          confidence_score: entry.confidence_score,
          error: entry.error,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Trace write error:', error);
    }
  }

  /**
   * Trace an LLM call
   */
  async traceLLMCall(options: {
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs: number;
    inputPayload?: Record<string, any>;
    outputPayload?: Record<string, any>;
    confidenceScore?: number;
    error?: string;
  }): Promise<void> {
    await this.trace({
      trace_type: 'llm_call',
      model_used: options.model,
      input_tokens: options.inputTokens,
      output_tokens: options.outputTokens,
      latency_ms: options.latencyMs,
      input_payload: options.inputPayload,
      output_payload: options.outputPayload,
      confidence_score: options.confidenceScore,
      error: options.error,
    });
  }

  /**
   * Trace a tool call
   */
  async traceToolCall(options: {
    toolName: string;
    functionName?: string;
    inputData: Record<string, any>;
    durationMs?: number;
    confidenceScore?: number;
  }): Promise<void> {
    await this.trace({
      trace_type: 'tool_call',
      tool_name: options.toolName,
      function_name: options.functionName,
      input_data: options.inputData,
      duration_ms: options.durationMs,
      confidence_score: options.confidenceScore,
    });
  }

  /**
   * Trace a tool result
   */
  async traceToolResult(options: {
    toolName: string;
    functionName?: string;
    outputData: Record<string, any>;
    durationMs: number;
    error?: string;
  }): Promise<void> {
    await this.trace({
      trace_type: 'tool_result',
      tool_name: options.toolName,
      function_name: options.functionName,
      output_data: options.outputData,
      duration_ms: options.durationMs,
      error: options.error,
    });
  }

  /**
   * Trace a confirmation request
   */
  async traceConfirmationRequest(options: {
    actionType: string;
    actionPayload: Record<string, any>;
    riskLevel: string;
    confidenceScore?: number;
  }): Promise<void> {
    await this.trace({
      trace_type: 'confirmation_request',
      function_name: options.actionType,
      input_data: options.actionPayload,
      output_data: { risk_level: options.riskLevel },
      confidence_score: options.confidenceScore,
    });
  }

  /**
   * Trace user response to confirmation
   */
  async traceUserResponse(options: {
    actionType: string;
    response: 'confirmed' | 'cancelled';
    feedback?: Record<string, any>;
    timeToDecisionMs?: number;
  }): Promise<void> {
    await this.trace({
      trace_type: 'user_response',
      function_name: options.actionType,
      output_data: {
        response: options.response,
        feedback: options.feedback
      },
      duration_ms: options.timeToDecisionMs,
    });
  }

  /**
   * Trace action execution
   */
  async traceActionExecuted(options: {
    actionType: string;
    inputData: Record<string, any>;
    outputData: Record<string, any>;
    durationMs: number;
    success: boolean;
    error?: string;
  }): Promise<void> {
    await this.trace({
      trace_type: 'action_executed',
      function_name: options.actionType,
      input_data: options.inputData,
      output_data: options.outputData,
      duration_ms: options.durationMs,
      error: options.error,
    });
  }

  /**
   * Trace a decision point
   */
  async traceDecisionPoint(options: {
    decision: string;
    factors: Record<string, any>;
    outcome: string;
    confidenceScore?: number;
  }): Promise<void> {
    await this.trace({
      trace_type: 'decision_point',
      input_data: { decision: options.decision, factors: options.factors },
      output_data: { outcome: options.outcome },
      confidence_score: options.confidenceScore,
    });
  }

  /**
   * Trace an error
   */
  async traceError(options: {
    errorCode: string;
    errorMessage: string;
    context?: Record<string, any>;
    functionName?: string;
  }): Promise<void> {
    await this.trace({
      trace_type: 'error',
      function_name: options.functionName,
      input_data: options.context,
      error: `${options.errorCode}: ${options.errorMessage}`,
    });
  }

  /**
   * Get all traces from this session
   */
  getTraces(): TraceEntry[] {
    return [...this.traces];
  }

  /**
   * Get total execution time
   */
  getTotalDuration(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get summary metrics for this session
   */
  getSummary(): {
    totalSteps: number;
    totalDurationMs: number;
    llmCalls: number;
    toolCalls: number;
    errors: number;
    totalInputTokens: number;
    totalOutputTokens: number;
  } {
    let llmCalls = 0;
    let toolCalls = 0;
    let errors = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const trace of this.traces) {
      if (trace.trace_type === 'llm_call') llmCalls++;
      if (trace.trace_type === 'tool_call') toolCalls++;
      if (trace.trace_type === 'error' || trace.error) errors++;
      if (trace.input_tokens) totalInputTokens += trace.input_tokens;
      if (trace.output_tokens) totalOutputTokens += trace.output_tokens;
    }

    return {
      totalSteps: this.stepCounter,
      totalDurationMs: this.getTotalDuration(),
      llmCalls,
      toolCalls,
      errors,
      totalInputTokens,
      totalOutputTokens,
    };
  }
}

/**
 * Helper to measure async function execution time
 */
export async function withTiming<T>(
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, durationMs: Date.now() - start };
}

/**
 * Create a tracer instance from request context
 */
export function createTracer(
  supabase: any,
  userId: string,
  sessionId?: string,
  teamId?: string
): ExecutionTracer {
  return new ExecutionTracer({
    supabase,
    userId,
    sessionId,
    teamId,
  });
}
