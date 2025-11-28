
import { supabase } from '../lib/supabase';
import { VisionImage, ReferenceImage, Document, ActionTask, UserProfile, ShippingAddress } from '../types';

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
  itemId: string // priceId or orderId
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        mode,
        [mode === 'subscription' ? 'priceId' : 'orderId']: itemId,
        successUrl: window.location.origin + '?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: window.location.origin,
      }
    });

    if (error) throw error;
    return data.url;
  } catch (error: any) {
    console.error("Stripe Session Error:", error);
    // Fallback for demo if backend not present
    if (error.message && error.message.includes('FunctionsHttpError')) {
       console.warn("Backend unavailable. Simulating success.");
       return "SIMULATION";
    }
    throw error;
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
