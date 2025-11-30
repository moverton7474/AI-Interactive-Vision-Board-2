
import { supabase } from '../lib/supabase';
import { VisionImage, ReferenceImage, Document, ActionTask, UserProfile, ShippingAddress, Habit, HabitCompletion, HabitFrequency } from '../types';

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

export const saveVisionImage = async (image: VisionImage): Promise<void> => {
  try {
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
          prompt: image.prompt,
          image_url: publicUrl,
          created_at: new Date(image.createdAt).toISOString(),
          is_favorite: image.isFavorite || false
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
    const { data, error } = await supabase
      .from('vision_boards')
      .select('*')
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
    await supabase.storage.from('visions').remove([`${id}.png`]);
    await supabase.from('vision_boards').delete().eq('id', id);
  } catch (error) {
    console.error("Failed to delete image", error);
  }
};

/* --- REFERENCE IMAGES --- */

export const saveReferenceImage = async (base64Url: string, tags: string[]): Promise<ReferenceImage> => {
  try {
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
        image_url: publicUrl,
        tags: tags,
        created_at: new Date().toISOString()
      }]);

    if (dbError) throw dbError;

    return {
      id,
      url: publicUrl,
      tags,
      createdAt: Date.now()
    };
  } catch (error) {
    console.error("Failed to save reference image", error);
    throw error;
  }
};

export const getReferenceLibrary = async (): Promise<ReferenceImage[]> => {
  try {
    const { data, error } = await supabase
      .from('reference_images')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      url: row.image_url,
      tags: row.tags || [],
      createdAt: new Date(row.created_at).getTime()
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
    const { data, error } = await supabase
      .from('documents')
      .select('*')
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
    const { data, error } = await supabase
      .from('action_tasks')
      .select('*')
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
