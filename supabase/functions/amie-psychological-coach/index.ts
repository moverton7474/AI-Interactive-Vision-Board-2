import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";

declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Risk levels for different actions
const ACTION_RISK_LEVELS: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
    'get_user_data': 'low',
    'get_todays_habits': 'low',
    'create_task': 'low',
    'mark_habit_complete': 'low',
    'update_goal_progress': 'medium',
    'schedule_reminder': 'medium',
    'schedule_goal_checkin': 'medium',
    'send_habit_reminder': 'medium',
    'send_email': 'high',
    'send_sms': 'high',
    'make_voice_call': 'high',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
        if (!GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY');

        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

        // 1. Parse Request
        const { user_id, message, context, session_id } = await req.json();

        if (!message) throw new Error('Message is required');

        // 2. Get user's agent settings for permissions
        const { data: agentSettings } = await supabase
            .from('user_agent_settings')
            .select('*')
            .eq('user_id', user_id)
            .single();

        // Get team AI settings for guardrails
        const { data: teamMember } = await supabase
            .from('team_members')
            .select('team_id')
            .eq('user_id', user_id)
            .eq('is_active', true)
            .single();

        let teamSettings = null;
        if (teamMember?.team_id) {
            const { data } = await supabase
                .from('team_ai_settings')
                .select('*')
                .eq('team_id', teamMember.team_id)
                .single();
            teamSettings = data;
        }

        // 3. Generate Embedding for Retrieval (Google text-embedding-004 is 768 dims)
        const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const embeddingResult = await embeddingModel.embedContent(message);
        const embedding = embeddingResult.embedding.values;

        // 4. Retrieve Psychological Frameworks (RAG)
        const { data: frameworks, error: searchError } = await supabase.rpc('match_psychological_frameworks', {
            query_embedding: embedding,
            match_threshold: 0.5,
            match_count: 3
        });

        let contextString = "";
        if (frameworks && frameworks.length > 0) {
            contextString = frameworks.map((f: any) =>
                `Framework: ${f.concept_name} by ${f.author}\nPrinciple: ${f.content_chunk}`
            ).join('\n\n');
        } else {
            contextString = "Framework: Stoic Dichotomy of Control\nPrinciple: Focus only on what is in your power (your actions, thoughts) and accept what is not (outcomes, others' opinions).";
        }

        // 5. Retrieve User Identity & Theme Context
        const { data: amieContext, error: contextError } = await supabase.rpc('get_amie_context', {
            p_user_id: user_id
        });

        if (contextError) {
            console.error("Error fetching AMIE context:", contextError);
        }

        // 6. Build system prompt with agentic capabilities
        let baseSystemPrompt = `You are AMIE, an Identity Architect and Psychological Coach.`;

        if (amieContext?.theme?.system_prompt) {
            baseSystemPrompt = amieContext.theme.system_prompt;
        }

        const systemPrompt = `
${baseSystemPrompt}

YOUR GOAL:
The user is struggling or asking for guidance. Do NOT give tactical financial advice or simple to-do lists.
Instead, use the provided PSYCHOLOGICAL FRAMEWORKS to reframe their mindset.

METHODOLOGY:
1. Identify the underlying identity block (fear, scarcity, procrastination).
2. Apply a specific mental model (from the context below) to shift their perspective.
3. Challenge them to adopt a new identity trait (e.g., "What would a disciplined investor do?").

AGENTIC CAPABILITIES:
You can take actions on behalf of the user when they ask. Available actions:
- Create tasks and reminders
- Mark habits as complete
- Update goal progress
- Send motivational SMS or emails (requires confirmation)
- Schedule check-in calls (requires confirmation)

When the user asks you to do something actionable, use the appropriate function.
Always explain what you're doing and confirm the results.

CONTEXT (Psychological Frameworks):
${contextString}

USER IDENTITY PROFILE:
${JSON.stringify(amieContext?.identity || {})}

USER PREFERENCES:
${JSON.stringify(amieContext?.preferences || {})}

USER CONTEXT (Session):
${JSON.stringify(context || {})}
`;

        // 7. Generate Response using Gemini with function calling
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            tools: getAgentTools()
        });

        const chat = model.startChat({
            history: [],
            generationConfig: {
                maxOutputTokens: 1000,
                temperature: 0.7
            }
        });

        // Send message with system context
        const result = await chat.sendMessage(`${systemPrompt}\n\nUSER MESSAGE:\n"${message}"`);
        const response = result.response;

        let responseText = '';
        let actionsPerformed: any[] = [];
        let pendingActions: any[] = [];

        // Check for function calls
        const functionCalls = response.functionCalls();

        if (functionCalls && functionCalls.length > 0) {
            for (const functionCall of functionCalls) {
                const toolName = functionCall.name;
                const args = functionCall.args;

                console.log(`Function call detected: ${toolName}`, args);

                // Execute the tool
                const toolResult = await executeAgentTool(
                    supabase,
                    user_id,
                    toolName,
                    args,
                    agentSettings,
                    teamSettings,
                    session_id
                );

                if (toolResult.requiresConfirmation) {
                    pendingActions.push({
                        actionId: toolResult.pendingActionId,
                        type: toolName,
                        message: toolResult.message,
                        proposedAction: toolResult.proposedAction
                    });
                } else {
                    actionsPerformed.push({
                        tool: toolName,
                        args,
                        result: toolResult
                    });
                }

                // Send function response back to Gemini for follow-up
                const followUpResult = await chat.sendMessage([{
                    functionResponse: {
                        name: toolName,
                        response: toolResult
                    }
                }]);

                responseText = followUpResult.response.text();
            }
        } else {
            responseText = response.text();
        }

        // Log the interaction
        if (user_id) {
            await supabase.from('agent_execution_traces').insert({
                user_id,
                session_id: session_id || null,
                trace_type: 'chat_interaction',
                function_name: 'amie-psychological-coach',
                input_data: { message, context },
                output_data: { response: responseText, actions: actionsPerformed },
                duration_ms: 0, // Would need timing
                created_at: new Date().toISOString()
            }).catch(err => console.log('Trace logging failed:', err));
        }

        return new Response(JSON.stringify({
            success: true,
            response: responseText,
            used_frameworks: frameworks?.map((f: any) => f.concept_name) || ['Default Stoicism'],
            actions_performed: actionsPerformed,
            pending_actions: pendingActions
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error("Coach Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
});

/**
 * Get agent tools for Gemini function calling
 */
function getAgentTools() {
    return [{
        functionDeclarations: [
            {
                name: 'get_user_data',
                description: "Get information about the user's goals, habits, tasks, or progress",
                parameters: {
                    type: 'object',
                    properties: {
                        data_type: {
                            type: 'string',
                            enum: ['goals', 'habits', 'tasks', 'progress', 'vision'],
                            description: 'Type of data to retrieve'
                        }
                    },
                    required: ['data_type']
                }
            },
            {
                name: 'get_todays_habits',
                description: "Get the user's habits scheduled for today with completion status",
                parameters: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            },
            {
                name: 'create_task',
                description: 'Create a new task or action item for the user',
                parameters: {
                    type: 'object',
                    properties: {
                        title: { type: 'string', description: 'Task title' },
                        description: { type: 'string', description: 'Task description' },
                        due_date: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
                        priority: { type: 'string', enum: ['low', 'medium', 'high'] }
                    },
                    required: ['title']
                }
            },
            {
                name: 'mark_habit_complete',
                description: 'Mark a specific habit as completed for today',
                parameters: {
                    type: 'object',
                    properties: {
                        habit_id: { type: 'string', description: 'The ID of the habit' },
                        habit_name: { type: 'string', description: 'The name of the habit (if ID unknown)' },
                        notes: { type: 'string', description: 'Optional completion notes' }
                    },
                    required: []
                }
            },
            {
                name: 'update_goal_progress',
                description: "Update the progress percentage on a user's goal",
                parameters: {
                    type: 'object',
                    properties: {
                        goal_id: { type: 'string', description: 'The ID of the goal' },
                        goal_name: { type: 'string', description: 'The name of the goal (if ID unknown)' },
                        progress: { type: 'number', description: 'New progress percentage (0-100)' },
                        notes: { type: 'string', description: 'Optional progress notes' }
                    },
                    required: ['progress']
                }
            },
            {
                name: 'schedule_reminder',
                description: 'Schedule a reminder notification for the user',
                parameters: {
                    type: 'object',
                    properties: {
                        message: { type: 'string', description: 'Reminder message' },
                        when: { type: 'string', description: 'When to send (e.g., "tomorrow at 9am")' }
                    },
                    required: ['message', 'when']
                }
            },
            {
                name: 'send_sms',
                description: "Send an SMS message to the user's phone (requires confirmation)",
                parameters: {
                    type: 'object',
                    properties: {
                        message: { type: 'string', description: 'The SMS message to send' }
                    },
                    required: ['message']
                }
            },
            {
                name: 'send_email',
                description: 'Send an email on behalf of the user (requires confirmation)',
                parameters: {
                    type: 'object',
                    properties: {
                        to: { type: 'string', description: 'Email recipient' },
                        subject: { type: 'string', description: 'Email subject' },
                        body: { type: 'string', description: 'Email body' }
                    },
                    required: ['to', 'subject', 'body']
                }
            },
            {
                name: 'make_voice_call',
                description: 'Initiate a voice call to the user (requires confirmation)',
                parameters: {
                    type: 'object',
                    properties: {
                        call_type: {
                            type: 'string',
                            enum: ['habit_reminder', 'goal_checkin', 'accountability', 'celebration', 'custom']
                        },
                        message: { type: 'string', description: 'What to say on the call' }
                    },
                    required: ['call_type']
                }
            }
        ]
    }];
}

/**
 * Execute an agent tool with permission checks and HITL flow
 */
async function executeAgentTool(
    supabase: any,
    userId: string,
    toolName: string,
    args: any,
    agentSettings: any,
    teamSettings: any,
    sessionId?: string
): Promise<any> {
    console.log(`Executing tool: ${toolName}`, args);

    const riskLevel = ACTION_RISK_LEVELS[toolName] || 'medium';

    // Check team policy restrictions
    if (teamSettings) {
        if (toolName === 'send_email' && teamSettings.allow_send_email === false) {
            return { success: false, error: 'Email sending disabled by team policy.' };
        }
        if (toolName === 'send_sms' && teamSettings.allow_send_sms === false) {
            return { success: false, error: 'SMS sending disabled by team policy.' };
        }
        if (toolName === 'make_voice_call' && teamSettings.allow_voice_calls === false) {
            return { success: false, error: 'Voice calls disabled by team policy.' };
        }
    }

    // Check if confirmation required for high-risk actions
    const requiresConfirmation = (riskLevel === 'high' || riskLevel === 'critical') &&
        (agentSettings?.auto_approve_low_risk_only !== false);

    if (requiresConfirmation) {
        // Create pending action for user confirmation
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 30);

        const { data: pendingAction, error: pendingError } = await supabase
            .from('pending_agent_actions')
            .insert({
                user_id: userId,
                session_id: sessionId,
                action_type: toolName,
                action_payload: args,
                status: 'pending',
                risk_level: riskLevel,
                expires_at: expiresAt.toISOString(),
                proposed_at: new Date().toISOString()
            })
            .select()
            .single();

        if (pendingError) {
            console.error('Failed to create pending action:', pendingError);
            // Continue with execution if table doesn't exist
        } else {
            return {
                success: true,
                requiresConfirmation: true,
                pendingActionId: pendingAction.id,
                message: `This action requires your confirmation. I'd like to ${toolName.replace(/_/g, ' ')}. Please confirm or cancel.`,
                proposedAction: { type: toolName, args }
            };
        }
    }

    // Execute the tool based on type
    switch (toolName) {
        case 'get_user_data':
            return await getUserData(supabase, userId, args.data_type);

        case 'get_todays_habits':
            return await getTodaysHabits(supabase, userId);

        case 'create_task':
            return await createTask(supabase, userId, args);

        case 'mark_habit_complete':
            return await markHabitComplete(supabase, userId, args);

        case 'update_goal_progress':
            return await updateGoalProgress(supabase, userId, args);

        case 'schedule_reminder':
            return await scheduleReminder(supabase, userId, args);

        case 'send_sms':
            return await sendSMS(supabase, userId, args);

        case 'send_email':
            return await sendEmail(supabase, userId, args);

        case 'make_voice_call':
            return await makeVoiceCall(supabase, userId, args);

        default:
            return { success: false, error: `Unknown tool: ${toolName}` };
    }
}

// Tool implementation functions
async function getUserData(supabase: any, userId: string, dataType: string): Promise<any> {
    switch (dataType) {
        case 'goals': {
            const { data: goals } = await supabase
                .from('milestones')
                .select('id, title, target_date, completion_percentage')
                .eq('user_id', userId)
                .order('target_date', { ascending: true })
                .limit(5);
            return {
                success: true,
                data: goals || [],
                summary: goals?.length
                    ? `Found ${goals.length} goals: ${goals.map((g: any) => g.title).join(', ')}`
                    : 'No goals found'
            };
        }
        case 'habits': {
            const { data: habits } = await supabase
                .from('habits')
                .select('id, title, current_streak, is_active')
                .eq('user_id', userId)
                .eq('is_active', true);
            return {
                success: true,
                data: habits || [],
                summary: habits?.length
                    ? `Found ${habits.length} active habits: ${habits.map((h: any) => `${h.title} (${h.current_streak} day streak)`).join(', ')}`
                    : 'No active habits'
            };
        }
        case 'tasks': {
            const { data: tasks } = await supabase
                .from('action_steps')
                .select('id, title, status, due_date')
                .eq('user_id', userId)
                .in('status', ['pending', 'in_progress'])
                .order('due_date', { ascending: true })
                .limit(10);
            return {
                success: true,
                data: tasks || [],
                summary: tasks?.length
                    ? `Found ${tasks.length} pending tasks: ${tasks.map((t: any) => t.title).join(', ')}`
                    : 'No pending tasks'
            };
        }
        case 'vision': {
            const { data: vision } = await supabase
                .from('visions')
                .select('id, title, description, dream_location')
                .eq('user_id', userId)
                .eq('is_primary', true)
                .single();
            return {
                success: true,
                data: vision || null,
                summary: vision
                    ? `Your vision: "${vision.title}" - ${vision.description || vision.dream_location || 'Your dream'}`
                    : 'No vision set yet'
            };
        }
        case 'progress': {
            const { data: habits } = await supabase
                .from('habits')
                .select('current_streak')
                .eq('user_id', userId)
                .eq('is_active', true);
            const { data: tasks } = await supabase
                .from('action_steps')
                .select('status')
                .eq('user_id', userId);
            const completed = tasks?.filter((t: any) => t.status === 'completed').length || 0;
            const total = tasks?.length || 0;
            const avgStreak = habits?.length
                ? Math.round(habits.reduce((sum: number, h: any) => sum + (h.current_streak || 0), 0) / habits.length)
                : 0;
            return {
                success: true,
                data: { completed, total, avgStreak },
                summary: `${completed} of ${total} tasks completed (${total ? Math.round((completed / total) * 100) : 0}%). Average habit streak: ${avgStreak} days.`
            };
        }
        default:
            return { success: false, error: `Unknown data type: ${dataType}` };
    }
}

async function getTodaysHabits(supabase: any, userId: string): Promise<any> {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const dayOfWeek = today.getDay();

    const { data: habits } = await supabase
        .from('habits')
        .select('id, title, description, frequency, custom_days, current_streak')
        .eq('user_id', userId)
        .eq('is_active', true);

    const todaysHabits = (habits || []).filter((h: any) => {
        if (h.frequency === 'daily') return true;
        if (h.frequency === 'weekly') return h.custom_days?.includes(dayOfWeek);
        return true;
    });

    const habitIds = todaysHabits.map((h: any) => h.id);
    const { data: completions } = await supabase
        .from('habit_completions')
        .select('habit_id')
        .in('habit_id', habitIds)
        .gte('completed_at', todayStr);

    const completedIds = new Set((completions || []).map((c: any) => c.habit_id));
    const habitsWithStatus = todaysHabits.map((h: any) => ({
        ...h,
        completed_today: completedIds.has(h.id)
    }));

    const completedCount = habitsWithStatus.filter((h: any) => h.completed_today).length;
    const pendingCount = habitsWithStatus.length - completedCount;

    return {
        success: true,
        data: habitsWithStatus,
        summary: habitsWithStatus.length > 0
            ? `${habitsWithStatus.length} habits for today: ${completedCount} done, ${pendingCount} remaining. Pending: ${habitsWithStatus.filter((h: any) => !h.completed_today).map((h: any) => h.title).join(', ')}`
            : 'No habits scheduled for today'
    };
}

async function createTask(supabase: any, userId: string, args: any): Promise<any> {
    const { title, description, due_date, priority } = args;

    if (!title) {
        return { success: false, error: 'Task title is required' };
    }

    const { data: vision } = await supabase
        .from('visions')
        .select('id')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .single();

    const { data: task, error } = await supabase
        .from('action_steps')
        .insert({
            user_id: userId,
            vision_id: vision?.id,
            title,
            description: description || '',
            due_date: due_date || null,
            priority: priority || 'medium',
            status: 'pending'
        })
        .select()
        .single();

    if (error) return { success: false, error: error.message };

    // Log action
    await supabase.from('agent_action_history').insert({
        user_id: userId,
        action_type: 'create_task',
        action_status: 'executed',
        action_payload: args,
        trigger_context: 'chat',
        executed_at: new Date().toISOString()
    });

    return {
        success: true,
        message: `Task created: "${title}"${due_date ? ` due ${due_date}` : ''}`,
        taskId: task.id
    };
}

async function markHabitComplete(supabase: any, userId: string, args: any): Promise<any> {
    const { habit_id, habit_name, notes } = args;

    let habit: any;
    if (habit_id) {
        const { data } = await supabase
            .from('habits')
            .select('id, title, current_streak')
            .eq('id', habit_id)
            .eq('user_id', userId)
            .single();
        habit = data;
    } else if (habit_name) {
        const { data } = await supabase
            .from('habits')
            .select('id, title, current_streak')
            .eq('user_id', userId)
            .ilike('title', `%${habit_name}%`)
            .single();
        habit = data;
    }

    if (!habit) {
        return { success: false, error: 'Habit not found. Please specify the habit name or ID.' };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase
        .from('habit_completions')
        .select('id')
        .eq('habit_id', habit.id)
        .gte('completed_at', todayStr)
        .single();

    if (existing) {
        return {
            success: true,
            message: `"${habit.title}" was already completed today! Current streak: ${habit.current_streak} days.`,
            alreadyCompleted: true
        };
    }

    await supabase.from('habit_completions').insert({
        habit_id: habit.id,
        completed_at: new Date().toISOString(),
        notes: notes || null
    });

    const newStreak = (habit.current_streak || 0) + 1;
    await supabase
        .from('habits')
        .update({ current_streak: newStreak })
        .eq('id', habit.id);

    await supabase.from('agent_action_history').insert({
        user_id: userId,
        action_type: 'mark_habit_complete',
        action_status: 'executed',
        action_payload: { habit_id: habit.id, habit_name: habit.title, notes },
        trigger_context: 'chat',
        related_habit_id: habit.id,
        executed_at: new Date().toISOString()
    });

    return {
        success: true,
        message: `"${habit.title}" marked complete! Streak: ${newStreak} days!`,
        habitId: habit.id,
        newStreak
    };
}

async function updateGoalProgress(supabase: any, userId: string, args: any): Promise<any> {
    const { goal_id, goal_name, progress, notes } = args;

    if (progress === undefined) {
        return { success: false, error: 'Progress percentage is required.' };
    }

    let goal: any;
    if (goal_id) {
        const { data } = await supabase
            .from('milestones')
            .select('id, title, completion_percentage')
            .eq('id', goal_id)
            .eq('user_id', userId)
            .single();
        goal = data;
    } else if (goal_name) {
        const { data } = await supabase
            .from('milestones')
            .select('id, title, completion_percentage')
            .eq('user_id', userId)
            .ilike('title', `%${goal_name}%`)
            .single();
        goal = data;
    } else {
        const { data } = await supabase
            .from('milestones')
            .select('id, title, completion_percentage')
            .eq('user_id', userId)
            .lt('completion_percentage', 100)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        goal = data;
    }

    if (!goal) {
        return { success: false, error: 'Goal not found.' };
    }

    const oldProgress = goal.completion_percentage || 0;
    const newProgress = Math.min(100, Math.max(0, progress));

    await supabase
        .from('milestones')
        .update({ completion_percentage: newProgress, updated_at: new Date().toISOString() })
        .eq('id', goal.id);

    await supabase.from('agent_action_history').insert({
        user_id: userId,
        action_type: 'update_goal_progress',
        action_status: 'executed',
        action_payload: { goal_id: goal.id, old_progress: oldProgress, new_progress: newProgress, notes },
        trigger_context: 'chat',
        related_goal_id: goal.id,
        executed_at: new Date().toISOString()
    });

    const diff = newProgress - oldProgress;
    return {
        success: true,
        message: newProgress === 100
            ? `Congratulations! "${goal.title}" is now complete!`
            : `Updated "${goal.title}" from ${oldProgress}% to ${newProgress}% (${diff > 0 ? '+' : ''}${diff}%)`,
        goalId: goal.id,
        oldProgress,
        newProgress
    };
}

async function scheduleReminder(supabase: any, userId: string, args: any): Promise<any> {
    const { message, when } = args;

    if (!message || !when) {
        return { success: false, error: 'Message and time are required.' };
    }

    const scheduledFor = parseReminderTime(when);

    const { data: task, error } = await supabase
        .from('action_steps')
        .insert({
            user_id: userId,
            title: `Reminder: ${message}`,
            description: `Scheduled for ${scheduledFor.toLocaleString()}`,
            due_date: scheduledFor.toISOString().split('T')[0],
            priority: 'medium',
            status: 'pending'
        })
        .select()
        .single();

    if (error) return { success: false, error: error.message };

    return {
        success: true,
        message: `Reminder set for ${scheduledFor.toLocaleString()}: "${message}"`,
        taskId: task.id
    };
}

async function sendSMS(supabase: any, userId: string, args: any): Promise<any> {
    const { message } = args;

    const { data: commPrefs } = await supabase
        .from('user_comm_preferences')
        .select('phone_number')
        .eq('user_id', userId)
        .single();

    if (!commPrefs?.phone_number) {
        return { success: false, error: 'No phone number found. Add your number in Settings.' };
    }

    try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        const response = await fetch(`${SUPABASE_URL}/functions/v1/agent-send-sms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ user_id: userId, phone_number: commPrefs.phone_number, message })
        });

        const result = await response.json();
        if (!result.success) return { success: false, error: result.error };

        await supabase.from('agent_action_history').insert({
            user_id: userId,
            action_type: 'send_sms',
            action_status: 'executed',
            action_payload: { message },
            trigger_context: 'chat',
            executed_at: new Date().toISOString()
        });

        return { success: true, message: `SMS sent: "${message}"` };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

async function sendEmail(supabase: any, userId: string, args: any): Promise<any> {
    const { to, subject, body } = args;

    try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({
                to,
                subject,
                template: 'generic',
                data: { subject, html: `<p>${body}</p>`, content: body }
            })
        });

        const result = await response.json();

        await supabase.from('agent_action_history').insert({
            user_id: userId,
            action_type: 'send_email',
            action_status: 'executed',
            action_payload: { to, subject },
            trigger_context: 'chat',
            executed_at: new Date().toISOString()
        });

        return { success: true, message: `Email sent to ${to}: "${subject}"` };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

async function makeVoiceCall(supabase: any, userId: string, args: any): Promise<any> {
    const { call_type, message } = args;

    const { data: commPrefs } = await supabase
        .from('user_comm_preferences')
        .select('phone_number')
        .eq('user_id', userId)
        .single();

    if (!commPrefs?.phone_number) {
        return { success: false, error: 'No phone number found.' };
    }

    let callMessage = message;
    if (!callMessage) {
        const messages: Record<string, string> = {
            'habit_reminder': 'Hi! This is AMIE. Just a friendly reminder about your habit!',
            'goal_checkin': 'Hi! This is AMIE. Checking in on your goal progress.',
            'accountability': 'Hi! This is AMIE. Let\'s keep that momentum going!',
            'celebration': 'Hi! This is AMIE. I wanted to celebrate your progress!',
            'custom': 'Hi! This is AMIE, your AI coach.'
        };
        callMessage = messages[call_type] || messages['custom'];
    }

    try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        const response = await fetch(`${SUPABASE_URL}/functions/v1/agent-voice-call`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({
                user_id: userId,
                phone_number: commPrefs.phone_number,
                call_type,
                message: callMessage
            })
        });

        const result = await response.json();
        if (!result.success) return { success: false, error: result.error };

        await supabase.from('agent_action_history').insert({
            user_id: userId,
            action_type: 'make_voice_call',
            action_status: 'executed',
            action_payload: { call_type, message: callMessage },
            trigger_context: 'chat',
            executed_at: new Date().toISOString()
        });

        return { success: true, message: `Voice call initiated: ${call_type.replace(/_/g, ' ')}` };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

function parseReminderTime(when: string): Date {
    const now = new Date();
    const lowerWhen = when.toLowerCase();

    if (lowerWhen.includes('hour')) {
        const hours = parseInt(lowerWhen.match(/(\d+)/)?.[1] || '1');
        return new Date(now.getTime() + hours * 60 * 60 * 1000);
    }
    if (lowerWhen.includes('minute')) {
        const minutes = parseInt(lowerWhen.match(/(\d+)/)?.[1] || '30');
        return new Date(now.getTime() + minutes * 60 * 1000);
    }
    if (lowerWhen.includes('tomorrow')) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (lowerWhen.includes('9am') || lowerWhen.includes('9 am')) {
            tomorrow.setHours(9, 0, 0, 0);
        } else {
            tomorrow.setHours(9, 0, 0, 0);
        }
        return tomorrow;
    }

    const parsed = new Date(when);
    if (!isNaN(parsed.getTime())) return parsed;

    return new Date(now.getTime() + 60 * 60 * 1000);
}
