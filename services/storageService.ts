
import { supabase } from '../lib/supabase';
import { VisionImage, ReferenceImage, Document, ActionTask, UserProfile, ShippingAddress, Habit, HabitCompletion, HabitFrequency, WorkbookTemplate, WorkbookOrder, GoalPlan, GoalPlanStatus, GoalPlanSource } from '../types';

/**
 * Service to handle persistence of Vision Board and Reference data using Supabase.
 */

// Helper to convert Base64 Data URL to Blob for upload
const base64ToBlob = (base64: string): Blob => {
  const arr = base64.split(',');
  const match = arr[0].match(/:(.*?);/);
  const mime = match ? match[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    const { count, error } = await supabase
      .from('vision_boards')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.warn('DB Connection Check Failed:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
};

/* --- USER PROFILES (Monetization) --- */

export const getUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('credits, subscription_tier')
      .eq('id', user.id)
      .single();

    if (error) return null;

    // Merge auth data with profile data
    return {
      names: user.email?.split('@')[0] || 'User',
      targetRetirementYear: 2030, // Default
      dreamLocation: '',
      credits: data.credits ?? 3,
      subscription_tier: data.subscription_tier || 'FREE'
    };
  } catch (e) {
    return null;
  }
};

export const decrementCredits = async (): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Check current credits
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits, subscription_tier')
      .eq('id', user.id)
      .single();

    if (!profile) return false;

    // PRO/ELITE have unlimited (effectively)
    if (profile.subscription_tier !== 'FREE') return true;

    if (profile.credits <= 0) return false;

    // Decrement
    const { error } = await supabase
      .from('profiles')
      .update({ credits: profile.credits - 1 })
      .eq('id', user.id);

    return !error;
  } catch (e) {
    return false;
  }
};

export const updateSubscription = async (tier: 'PRO' | 'ELITE'): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Upgrade tier and give unlimited credits (9999)
    await supabase
      .from('profiles')
      .update({
        subscription_tier: tier,
        credits: 9999
      })
      .eq('id', user.id);
  } catch (e) {
    console.error("Failed to update subscription", e);
  }
};

/* --- PAYMENTS (Stripe Integration) --- */

export const createStripeCheckoutSession = async (
  mode: 'subscription' | 'payment',
  itemId: string, // priceId or orderId
  tier?: 'PRO' | 'ELITE' // Only for subscriptions
): Promise<string | null> => {
  try {
    // Get current user's email for webhook matching
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        mode,
        [mode === 'subscription' ? 'priceId' : 'orderId']: itemId,
        successUrl: window.location.origin + '?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: window.location.origin,
        customerEmail: user?.email,
        tier: tier, // Pass tier for reliable webhook processing
      }
    });

    if (error) throw error;
    return data.url;
  } catch (error: any) {
    console.warn("Stripe Backend unavailable or error. Falling back to simulation.", error);
    // Robust Fallback: Always return SIMULATION if the backend fails for ANY reason
    // This ensures the demo flow never blocks the user.
    return "SIMULATION";
  }
};

export const getLastShippingAddress = async (): Promise<ShippingAddress | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from('poster_orders')
      .select('shipping_address')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return data?.shipping_address || null;
  } catch {
    return null;
  }
};

/* --- VISION BOARDS --- */

/**
 * Extended VisionImage interface for saving with likeness metadata
 */
export interface VisionImageWithMetadata extends VisionImage {
  modelUsed?: string;
  referenceImageIds?: string[];
  likenessOptimized?: boolean;
  likenessMetadata?: {
    likeness_score?: number;
    face_match?: boolean;
    body_type_match?: boolean;
    explanation?: string;
  };
}

export const saveVisionImage = async (image: VisionImageWithMetadata): Promise<void> => {
  try {
    // Get current user - CRITICAL: Must set user_id for security
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Must be authenticated to save vision images');
    }

    const blob = base64ToBlob(image.url);
    const fileName = `${image.id}.png`;

    const { error: uploadError } = await supabase
      .storage
      .from('visions')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase
      .storage
      .from('visions')
      .getPublicUrl(fileName);

    const { error: dbError } = await supabase
      .from('vision_boards')
      .insert([
        {
          id: image.id,
          user_id: user.id,  // SECURITY: Explicitly set user_id
          prompt: image.prompt,
          image_url: publicUrl,
          created_at: new Date(image.createdAt).toISOString(),
          is_favorite: image.isFavorite || false,
          // New likeness tracking columns
          model_used: image.modelUsed || null,
          reference_image_ids: image.referenceImageIds || null,
          likeness_optimized: image.likenessOptimized || false,
          likeness_metadata: image.likenessMetadata || {}
        }
      ]);

    if (dbError) throw dbError;

  } catch (error) {
    console.error("Failed to save vision image", error);
    throw error;
  }
};

export const getVisionGallery = async (): Promise<VisionImage[]> => {
  try {
    // Get current user - CRITICAL: Must filter by user_id for security
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('getVisionGallery: No authenticated user');
      return [];
    }

    const { data, error } = await supabase
      .from('vision_boards')
      .select('*')
      .eq('user_id', user.id)  // SECURITY: Explicit user filtering (defense-in-depth with RLS)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      url: row.image_url,
      prompt: row.prompt,
      createdAt: new Date(row.created_at).getTime(),
      isFavorite: row.is_favorite
    }));
  } catch (error) {
    return [];
  }
};

export const deleteVisionImage = async (id: string): Promise<void> => {
  try {
    // SECURITY: Verify user owns this image before deleting (defense-in-depth with RLS)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Must be authenticated to delete images');
    }

    // Only delete if user owns this vision board
    await supabase.storage.from('visions').remove([`${id}.png`]);
    await supabase.from('vision_boards').delete().eq('id', id).eq('user_id', user.id);
  } catch (error) {
    console.error("Failed to delete image", error);
  }
};

/* --- REFERENCE IMAGES --- */

export const saveReferenceImage = async (
  base64Url: string,
  tags: string[],
  identityDescription?: string
): Promise<ReferenceImage> => {
  try {
    // Get current user - CRITICAL: Must set user_id for security
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Must be authenticated to save reference images');
    }

    const id = crypto.randomUUID();
    const blob = base64ToBlob(base64Url);
    const fileName = `ref_${id}.png`;

    const { error: uploadError } = await supabase
      .storage
      .from('visions')
      .upload(fileName, blob, { contentType: 'image/png', upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase
      .storage
      .from('visions')
      .getPublicUrl(fileName);

    const { error: dbError } = await supabase
      .from('reference_images')
      .insert([{
        id: id,
        user_id: user.id,  // SECURITY: Explicitly set user_id
        image_url: publicUrl,
        tags: tags,
        created_at: new Date().toISOString(),
        identity_description: identityDescription || null
      }]);

    if (dbError) throw dbError;

    return {
      id,
      url: publicUrl,
      tags,
      createdAt: Date.now(),
      identityDescription
    };
  } catch (error) {
    console.error("Failed to save reference image", error);
    throw error;
  }
};

export const getReferenceLibrary = async (): Promise<ReferenceImage[]> => {
  try {
    // Get current user - CRITICAL: Must filter by user_id for security
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('getReferenceLibrary: No authenticated user');
      return [];
    }

    const { data, error } = await supabase
      .from('reference_images')
      .select('*')
      .eq('user_id', user.id)  // SECURITY: Explicit user filtering
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      url: row.image_url,
      tags: row.tags || [],
      createdAt: new Date(row.created_at).getTime(),
      identityDescription: row.identity_description || undefined
    }));
  } catch (error) {
    return [];
  }
};

export const deleteReferenceImage = async (id: string): Promise<void> => {
  try {
    await supabase.storage.from('visions').remove([`ref_${id}.png`]);
    await supabase.from('reference_images').delete().eq('id', id);
  } catch (error) {
    console.error("Failed to delete reference", error);
  }
};

/* --- FINANCIAL DOCUMENTS --- */

export const saveDocument = async (doc: Omit<Document, 'id' | 'createdAt'>, file?: File): Promise<Document> => {
  try {
    // Get current user - CRITICAL: Must set user_id for security
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Must be authenticated to save documents');
    }

    const id = crypto.randomUUID();
    let publicUrl = '';

    if (file) {
      const fileName = `${id}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('documents').getPublicUrl(fileName);
      publicUrl = data.publicUrl;
    }

    const { error: dbError } = await supabase.from('documents').insert([{
      id,
      user_id: user.id,  // SECURITY: Explicitly set user_id
      name: doc.name,
      url: publicUrl,
      type: doc.type,
      structured_data: doc.structuredData || {},
      created_at: new Date().toISOString()
    }]);

    if (dbError) throw dbError;

    return {
      ...doc,
      id,
      url: publicUrl,
      createdAt: Date.now()
    };
  } catch (error) {
    console.error("Failed to save document", error);
    throw error;
  }
};

export const getDocuments = async (): Promise<Document[]> => {
  try {
    // Get current user - CRITICAL: Must filter by user_id for security
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('getDocuments: No authenticated user');
      return [];
    }

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)  // SECURITY: Explicit user filtering
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      url: row.url,
      type: row.type,
      structuredData: row.structured_data,
      createdAt: new Date(row.created_at).getTime()
    }));
  } catch (error) {
    return [];
  }
};

export const deleteDocument = async (id: string): Promise<void> => {
  try {
    await supabase.from('documents').delete().eq('id', id);
  } catch (error) {
    console.error("Failed to delete document", error);
  }
};

/* --- ACTION TASKS (AGENT EXECUTION) --- */

export const saveActionTasks = async (tasks: ActionTask[], milestoneYear: number): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const rows = tasks.map(t => ({
      id: t.id,
      user_id: user?.id,
      title: t.title,
      description: t.description,
      due_date: t.dueDate,
      type: t.type,
      is_completed: t.isCompleted,
      milestone_year: milestoneYear,
      ai_metadata: t.aiMetadata || {},
      created_at: new Date().toISOString()
    }));

    const { error } = await supabase.from('action_tasks').insert(rows);
    if (error) throw error;
  } catch (error) {
    console.error("Failed to save tasks", error);
  }
};

export const getActionTasks = async (): Promise<ActionTask[]> => {
  try {
    // Get current user - CRITICAL: Must filter by user_id for security
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('getActionTasks: No authenticated user');
      return [];
    }

    const { data, error } = await supabase
      .from('action_tasks')
      .select('*')
      .eq('user_id', user.id)  // SECURITY: Explicit user filtering
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      dueDate: row.due_date,
      type: row.type,
      isCompleted: row.is_completed,
      milestoneYear: row.milestone_year,
      aiMetadata: row.ai_metadata
    }));
  } catch (error) {
    return [];
  }
};

export const updateTaskStatus = async (id: string, isCompleted: boolean): Promise<void> => {
  try {
    await supabase.from('action_tasks').update({ is_completed: isCompleted }).eq('id', id);
  } catch (error) {
    console.error("Failed to update task", error);
  }
};

/* --- GOAL PLANS (v1.7 Draft Plan Review) --- */

/**
 * Create a new draft goal plan for the user
 */
export const createDraftPlan = async (data: {
  visionText?: string;
  financialTarget?: number;
  themeId?: string;
  source?: GoalPlanSource;
  aiInsights?: GoalPlan['aiInsights'];
}): Promise<GoalPlan | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get next version number for this user
    const { data: existingPlans } = await supabase
      .from('goal_plans')
      .select('version')
      .eq('user_id', user.id)
      .order('version', { ascending: false })
      .limit(1);

    const nextVersion = (existingPlans?.[0]?.version || 0) + 1;

    const { data: plan, error } = await supabase
      .from('goal_plans')
      .insert([{
        user_id: user.id,
        status: 'draft',
        version: nextVersion,
        source: data.source || 'onboarding',
        vision_text: data.visionText,
        financial_target: data.financialTarget,
        theme_id: data.themeId,
        ai_insights: data.aiInsights || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    return mapGoalPlanFromDb(plan);
  } catch (error) {
    console.error("Failed to create draft plan", error);
    return null;
  }
};

/**
 * Get user's current draft plan (if exists)
 */
export const getDraftPlan = async (): Promise<GoalPlan | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: plan, error } = await supabase
      .from('goal_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    if (!plan) return null;

    // Get associated tasks
    const { data: tasks } = await supabase
      .from('action_tasks')
      .select('*')
      .eq('plan_id', plan.id)
      .order('display_order', { ascending: true });

    return mapGoalPlanFromDb(plan, tasks);
  } catch (error) {
    console.error("Failed to get draft plan", error);
    return null;
  }
};

/**
 * Get user's active (approved) plan
 */
export const getActivePlan = async (): Promise<GoalPlan | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: plan, error } = await supabase
      .from('goal_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!plan) return null;

    // Get associated tasks
    const { data: tasks } = await supabase
      .from('action_tasks')
      .select('*')
      .eq('plan_id', plan.id)
      .order('display_order', { ascending: true });

    return mapGoalPlanFromDb(plan, tasks);
  } catch (error) {
    console.error("Failed to get active plan", error);
    return null;
  }
};

/**
 * Save or update a task in a draft plan
 */
export const saveDraftTask = async (
  planId: string,
  task: Partial<ActionTask> & { id?: string }
): Promise<ActionTask | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Verify plan belongs to user and is a draft
    const { data: plan } = await supabase
      .from('goal_plans')
      .select('id, status')
      .eq('id', planId)
      .eq('user_id', user.id)
      .eq('status', 'draft')
      .single();

    if (!plan) {
      console.error("Plan not found or not a draft");
      return null;
    }

    const taskData = {
      plan_id: planId,
      user_id: user.id,
      title: task.title || '',
      description: task.description || '',
      due_date: task.dueDate,
      type: task.type || 'ADMIN',
      is_completed: task.isCompleted || false,
      priority: task.priority || 'medium',
      display_order: task.displayOrder || 0,
      source: task.source || 'manual',
      ai_metadata: task.aiMetadata || {},
      updated_at: new Date().toISOString()
    };

    let result;
    if (task.id) {
      // Update existing task
      const { data, error } = await supabase
        .from('action_tasks')
        .update(taskData)
        .eq('id', task.id)
        .eq('plan_id', planId)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      // Insert new task
      const { data, error } = await supabase
        .from('action_tasks')
        .insert([{
          ...taskData,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    return mapActionTaskFromDb(result);
  } catch (error) {
    console.error("Failed to save draft task", error);
    return null;
  }
};

/**
 * Delete a task from a draft plan
 */
export const deleteDraftTask = async (planId: string, taskId: string): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Verify plan belongs to user and is a draft
    const { data: plan } = await supabase
      .from('goal_plans')
      .select('id')
      .eq('id', planId)
      .eq('user_id', user.id)
      .eq('status', 'draft')
      .single();

    if (!plan) return false;

    const { error } = await supabase
      .from('action_tasks')
      .delete()
      .eq('id', taskId)
      .eq('plan_id', planId);

    return !error;
  } catch (error) {
    console.error("Failed to delete draft task", error);
    return false;
  }
};

/**
 * Approve a draft plan (makes it active, archives previous active plan)
 */
export const approvePlan = async (planId: string): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Use the database function for atomic operation
    const { data, error } = await supabase.rpc('approve_goal_plan', {
      p_plan_id: planId,
      p_user_id: user.id
    });

    if (error) throw error;
    return data === true;
  } catch (error) {
    console.error("Failed to approve plan", error);
    return false;
  }
};

/**
 * Get plan history for the user (all versions)
 */
export const getPlanHistory = async (): Promise<GoalPlan[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: plans, error } = await supabase
      .from('goal_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('version', { ascending: false });

    if (error) throw error;

    return (plans || []).map(plan => mapGoalPlanFromDb(plan));
  } catch (error) {
    console.error("Failed to get plan history", error);
    return [];
  }
};

/**
 * Update a draft plan's metadata
 */
export const updateDraftPlan = async (
  planId: string,
  updates: {
    visionText?: string;
    financialTarget?: number;
    themeId?: string;
    aiInsights?: GoalPlan['aiInsights'];
  }
): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('goal_plans')
      .update({
        vision_text: updates.visionText,
        financial_target: updates.financialTarget,
        theme_id: updates.themeId,
        ai_insights: updates.aiInsights,
        updated_at: new Date().toISOString()
      })
      .eq('id', planId)
      .eq('user_id', user.id)
      .eq('status', 'draft');

    return !error;
  } catch (error) {
    console.error("Failed to update draft plan", error);
    return false;
  }
};

/**
 * Bulk save tasks to a draft plan (for initial generation or regeneration)
 */
export const saveDraftTasks = async (
  planId: string,
  tasks: Omit<ActionTask, 'planId'>[]
): Promise<ActionTask[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Verify plan belongs to user and is a draft
    const { data: plan } = await supabase
      .from('goal_plans')
      .select('id')
      .eq('id', planId)
      .eq('user_id', user.id)
      .eq('status', 'draft')
      .single();

    if (!plan) return [];

    // Build task rows with proper UUIDs
    const taskRows = tasks.map((task, index) => ({
      id: task.id || crypto.randomUUID(),
      plan_id: planId,
      user_id: user.id,
      title: task.title,
      description: task.description,
      due_date: task.dueDate,
      type: task.type,
      is_completed: task.isCompleted || false,
      priority: task.priority || 'medium',
      display_order: task.displayOrder ?? index,
      source: task.source || 'onboarding',
      ai_metadata: task.aiMetadata || {},
      updated_at: new Date().toISOString()
    }));

    // Get IDs of tasks being saved
    const taskIdsToKeep = taskRows.map(t => t.id);

    // Delete tasks that are no longer in the list (removed by user)
    await supabase
      .from('action_tasks')
      .delete()
      .eq('plan_id', planId)
      .not('id', 'in', `(${taskIdsToKeep.join(',')})`);

    // Use UPSERT to handle both new and existing tasks (prevents race conditions)
    const { data, error } = await supabase
      .from('action_tasks')
      .upsert(taskRows, {
        onConflict: 'id',
        ignoreDuplicates: false
      })
      .select();

    if (error) throw error;

    return (data || []).map(mapActionTaskFromDb);
  } catch (error) {
    console.error("Failed to save draft tasks", error);
    return [];
  }
};

// Helper function to map database row to GoalPlan
const mapGoalPlanFromDb = (row: any, tasks?: any[]): GoalPlan => ({
  id: row.id,
  userId: row.user_id,
  status: row.status as GoalPlanStatus,
  version: row.version,
  source: row.source as GoalPlanSource,
  aiInsights: row.ai_insights,
  visionText: row.vision_text,
  financialTarget: row.financial_target ? parseFloat(row.financial_target) : undefined,
  themeId: row.theme_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  approvedAt: row.approved_at,
  archivedAt: row.archived_at,
  tasks: tasks ? tasks.map(mapActionTaskFromDb) : undefined
});

// Helper function to map database row to ActionTask
const mapActionTaskFromDb = (row: any): ActionTask => ({
  id: row.id,
  title: row.title,
  description: row.description,
  dueDate: row.due_date,
  type: row.type,
  isCompleted: row.is_completed,
  milestoneYear: row.milestone_year,
  aiMetadata: row.ai_metadata,
  planId: row.plan_id,
  planVersion: row.plan_version,
  displayOrder: row.display_order,
  priority: row.priority,
  source: row.source
});

/* --- HABIT TRACKING --- */

export const getHabits = async (): Promise<Habit[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      task_id: row.task_id,
      title: row.title,
      description: row.description,
      frequency: row.frequency as HabitFrequency,
      custom_days: row.custom_days || [],
      reminder_time: row.reminder_time,
      is_active: row.is_active,
      created_at: row.created_at,
      current_streak: row.current_streak || 0,
      last_completed: row.last_completed
    }));
  } catch (error) {
    console.error("Failed to get habits", error);
    return [];
  }
};

export const createHabit = async (habit: Omit<Habit, 'id' | 'user_id' | 'created_at' | 'current_streak' | 'last_completed'>): Promise<Habit | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('habits')
      .insert([{
        user_id: user.id,
        task_id: habit.task_id,
        title: habit.title,
        description: habit.description,
        frequency: habit.frequency,
        custom_days: habit.custom_days,
        reminder_time: habit.reminder_time,
        is_active: habit.is_active ?? true,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      user_id: data.user_id,
      task_id: data.task_id,
      title: data.title,
      description: data.description,
      frequency: data.frequency,
      custom_days: data.custom_days || [],
      reminder_time: data.reminder_time,
      is_active: data.is_active,
      created_at: data.created_at,
      current_streak: 0,
      last_completed: undefined
    };
  } catch (error) {
    console.error("Failed to create habit", error);
    return null;
  }
};

export const updateHabit = async (id: string, updates: Partial<Habit>): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('habits')
      .update({
        title: updates.title,
        description: updates.description,
        frequency: updates.frequency,
        custom_days: updates.custom_days,
        reminder_time: updates.reminder_time,
        is_active: updates.is_active
      })
      .eq('id', id);

    return !error;
  } catch (error) {
    console.error("Failed to update habit", error);
    return false;
  }
};

export const deleteHabit = async (id: string): Promise<boolean> => {
  try {
    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('habits')
      .update({ is_active: false })
      .eq('id', id);

    return !error;
  } catch (error) {
    console.error("Failed to delete habit", error);
    return false;
  }
};

export const completeHabit = async (habitId: string, notes?: string, moodRating?: number): Promise<HabitCompletion | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Record the completion
    const { data, error } = await supabase
      .from('habit_completions')
      .insert([{
        habit_id: habitId,
        completed_at: new Date().toISOString(),
        notes: notes,
        mood_rating: moodRating,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    // Update streak via edge function or compute locally
    await updateHabitStreak(habitId);

    return {
      id: data.id,
      habit_id: data.habit_id,
      completed_at: data.completed_at,
      notes: data.notes,
      mood_rating: data.mood_rating,
      created_at: data.created_at
    };
  } catch (error) {
    console.error("Failed to complete habit", error);
    return null;
  }
};

export const getHabitCompletions = async (habitId: string, days: number = 30): Promise<HabitCompletion[]> => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('habit_completions')
      .select('*')
      .eq('habit_id', habitId)
      .gte('completed_at', startDate.toISOString())
      .order('completed_at', { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      habit_id: row.habit_id,
      completed_at: row.completed_at,
      notes: row.notes,
      mood_rating: row.mood_rating,
      created_at: row.created_at
    }));
  } catch (error) {
    console.error("Failed to get habit completions", error);
    return [];
  }
};

export const getTodayCompletions = async (): Promise<string[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('habit_completions')
      .select('habit_id, habits!inner(user_id)')
      .eq('habits.user_id', user.id)
      .gte('completed_at', today.toISOString());

    if (error || !data) return [];

    return data.map((row: any) => row.habit_id);
  } catch (error) {
    console.error("Failed to get today's completions", error);
    return [];
  }
};

const updateHabitStreak = async (habitId: string): Promise<void> => {
  try {
    // Get completions in descending order
    const { data: completions } = await supabase
      .from('habit_completions')
      .select('completed_at')
      .eq('habit_id', habitId)
      .order('completed_at', { ascending: false });

    if (!completions || completions.length === 0) return;

    // Calculate streak
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentDate = today;

    for (const completion of completions) {
      const completedDate = new Date(completion.completed_at);
      completedDate.setHours(0, 0, 0, 0);

      const diffDays = Math.floor((currentDate.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0 || diffDays === 1) {
        streak++;
        currentDate = completedDate;
      } else {
        break;
      }
    }

    // Update habit with new streak
    await supabase
      .from('habits')
      .update({
        current_streak: streak,
        last_completed: completions[0].completed_at
      })
      .eq('id', habitId);

  } catch (error) {
    console.error("Failed to update streak", error);
  }
};

export const getHabitStats = async (): Promise<{
  totalHabits: number;
  totalCompletions: number;
  longestStreak: number;
  currentStreakTotal: number;
  weeklyCompletionRate: number;
}> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { totalHabits: 0, totalCompletions: 0, longestStreak: 0, currentStreakTotal: 0, weeklyCompletionRate: 0 };

    // Get habits
    const habits = await getHabits();

    // Get all completions for the past 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { count: weeklyCount } = await supabase
      .from('habit_completions')
      .select('*, habits!inner(user_id)', { count: 'exact', head: true })
      .eq('habits.user_id', user.id)
      .gte('completed_at', weekAgo.toISOString());

    // Get total completions
    const { count: totalCount } = await supabase
      .from('habit_completions')
      .select('*, habits!inner(user_id)', { count: 'exact', head: true })
      .eq('habits.user_id', user.id);

    const totalHabits = habits.length;
    const currentStreakTotal = habits.reduce((sum, h) => sum + (h.current_streak || 0), 0);
    const longestStreak = Math.max(...habits.map(h => h.current_streak || 0), 0);

    // Calculate weekly completion rate (completions / expected)
    const expectedWeekly = totalHabits * 7; // Simplified calculation
    const weeklyCompletionRate = expectedWeekly > 0 ? Math.round(((weeklyCount || 0) / expectedWeekly) * 100) : 0;

    return {
      totalHabits,
      totalCompletions: totalCount || 0,
      longestStreak,
      currentStreakTotal,
      weeklyCompletionRate: Math.min(weeklyCompletionRate, 100)
    };
  } catch (error) {
    console.error("Failed to get habit stats", error);
    return { totalHabits: 0, totalCompletions: 0, longestStreak: 0, currentStreakTotal: 0, weeklyCompletionRate: 0 };
  }
};

/* --- VISION WORKBOOK --- */

export const getWorkbookTemplates = async (): Promise<WorkbookTemplate[]> => {
  try {
    // Query templates directly from database (they're publicly readable via RLS)
    const { data: templates, error: dbError } = await supabase
      .from('workbook_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (dbError) throw dbError;

    return templates?.map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      sku: t.sku,
      page_count: t.page_count,
      size: t.size,
      binding: t.binding,
      base_price: parseFloat(t.base_price),
      shipping_estimate: parseFloat(t.shipping_estimate),
      preview_image_url: t.preview_image_url,
      features: typeof t.features === 'string' ? JSON.parse(t.features) : t.features || [],
      is_active: t.is_active,
      sort_order: t.sort_order,
      created_at: t.created_at
    })) || [];
  } catch (error) {
    console.error("Failed to get workbook templates", error);
    return [];
  }
};

export const createWorkbookOrder = async (orderData: {
  template_id: string;
  title?: string;
  subtitle?: string;
  dedication_text?: string;
  cover_style?: string;
  include_weekly_journal?: boolean;
  include_habit_tracker?: boolean;
  vision_board_ids?: string[];
  included_habits?: string[];
  shipping_address?: ShippingAddress;
  include_foreword?: boolean;
  included_sections?: string[];
}): Promise<WorkbookOrder | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('generate-workbook-pdf?action=create_order', {
      body: orderData
    });

    if (error) throw error;
    return data.order;
  } catch (error) {
    console.error("Failed to create workbook order", error);
    return null;
  }
};

export const generateWorkbookPdf = async (orderId: string): Promise<boolean> => {
  try {
    const { error } = await supabase.functions.invoke('generate-workbook-pdf?action=generate_pdf', {
      body: { orderId }
    });

    return !error;
  } catch (error) {
    console.error("Failed to generate PDF", error);
    return false;
  }
};

/* --- ANALYTICS --- */

export const logEvent = async (eventName: string, metadata: any = {}): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    // Fire and forget - don't await completion to avoid blocking UI
    supabase
      .from('analytics_events')
      .insert([{
        user_id: user?.id,
        event_name: eventName,
        metadata,
        created_at: new Date().toISOString()
      }])
      .then(({ error }) => {
        if (error) console.warn("Failed to log event:", error.message);
      });

  } catch (error) {
    // Silently fail for analytics
    console.warn("Analytics error:", error);
  }
};


export const getWorkbookOrder = async (orderId: string): Promise<WorkbookOrder | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Query order directly from database with template and sections
    const { data: order, error } = await supabase
      .from('workbook_orders')
      .select('*, template:workbook_templates(*), sections:workbook_sections(*)')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;

    return order ? {
      ...order,
      subtotal: parseFloat(order.subtotal),
      discount_amount: parseFloat(order.discount_amount),
      shipping_cost: parseFloat(order.shipping_cost),
      total_price: parseFloat(order.total_price)
    } : null;
  } catch (error) {
    console.error("Failed to get workbook order", error);
    return null;
  }
};

export const getWorkbookOrders = async (): Promise<WorkbookOrder[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('workbook_orders')
      .select('*, template:workbook_templates(name, sku, size, binding)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data?.map((o: any) => ({
      ...o,
      subtotal: parseFloat(o.subtotal),
      discount_amount: parseFloat(o.discount_amount),
      shipping_cost: parseFloat(o.shipping_cost),
      total_price: parseFloat(o.total_price)
    })) || [];
  } catch (error) {
    console.error("Failed to get workbook orders", error);
    return [];
  }
};

export const updateWorkbookOrderStatus = async (orderId: string, status: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('workbook_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    return !error;
  } catch (error) {
    console.error("Failed to update workbook order status", error);
    return false;
  }
};

export const submitWorkbookToProdigi = async (orderId: string): Promise<{ success: boolean; prodigiOrderId?: string; error?: string }> => {
  try {
    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('workbook_orders')
      .select('*, template:workbook_templates(*)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    if (!order.shipping_address) {
      throw new Error('Shipping address is required');
    }

    // Prepare Prodigi payload
    const prodigiPayload = {
      orderId: orderId,
      recipient: {
        name: order.shipping_address.name,
        address: {
          line1: order.shipping_address.line1,
          line2: order.shipping_address.line2,
          townOrCity: order.shipping_address.city,
          stateOrCounty: order.shipping_address.state,
          postalOrZipCode: order.shipping_address.postalCode,
          countryCode: order.shipping_address.country
        }
      },
      items: [{
        sku: order.template?.sku || 'GLOBAL-NTB-A5-SC-100',
        copies: 1,
        sizing: 'fillPrintArea',
        assets: [{
          printArea: 'default',
          url: order.merged_pdf_url || order.interior_pdf_url || 'https://visionary.app/placeholder-workbook.pdf'
        }]
      }]
    };

    // Submit to Prodigi
    const { data, error } = await supabase.functions.invoke('submit-to-prodigi', {
      body: prodigiPayload
    });

    if (error) throw error;

    // Update order with Prodigi info
    await supabase
      .from('workbook_orders')
      .update({
        status: 'submitted',
        prodigi_order_id: data.orderId,
        prodigi_status: data.status,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    return { success: true, prodigiOrderId: data.orderId };
  } catch (error: any) {
    console.error("Failed to submit to Prodigi", error);
    return { success: false, error: error.message };
  }
};
