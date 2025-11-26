
import { supabase } from '../lib/supabase';
import { VisionImage, ReferenceImage } from '../types';

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

    if (error) return [];

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
    const fileName = `ref_${id}.png`; // Use prefix for organization if needed

    // Upload to 'visions' bucket (using same bucket for simplicity, or could use subfolder)
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

    if (error) return [];

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
