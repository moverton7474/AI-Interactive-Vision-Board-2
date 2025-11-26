import { supabase } from '../lib/supabase';
import { VisionImage } from '../types';

/**
 * Service to handle persistence of Vision Board data using Supabase.
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

export const saveVisionImage = async (image: VisionImage): Promise<void> => {
  try {
    // 1. Upload the image binary to Supabase Storage
    // We use the ID as the filename
    const blob = base64ToBlob(image.url);
    const fileName = `${image.id}.png`;

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('visions')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.error('Supabase Storage Upload Error:', uploadError);
      throw uploadError;
    }

    // 2. Get the Public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('visions')
      .getPublicUrl(fileName);

    // 3. Insert metadata into the Database
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

    if (dbError) {
      console.error('Supabase DB Insert Error:', dbError);
      throw dbError;
    }

  } catch (error) {
    console.error("Failed to save image to Supabase", error);
    throw error;
  }
};

export const getVisionGallery = async (): Promise<VisionImage[]> => {
  try {
    const { data, error } = await supabase
      .from('vision_boards')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase Select Error:', error);
      return [];
    }

    // Map Supabase result to our App type
    return data.map((row: any) => ({
      id: row.id,
      url: row.image_url,
      prompt: row.prompt,
      createdAt: new Date(row.created_at).getTime(),
      isFavorite: row.is_favorite
    }));
  } catch (error) {
    console.error("Failed to load gallery from Supabase", error);
    return [];
  }
};

export const deleteVisionImage = async (id: string): Promise<void> => {
  try {
    // 1. Delete from Storage
    // Assuming filename matches ID + .png based on save logic
    const { error: storageError } = await supabase
      .storage
      .from('visions')
      .remove([`${id}.png`]);

    if (storageError) {
      console.warn('Supabase Storage Delete Warning:', storageError);
    }

    // 2. Delete from Database
    const { error: dbError } = await supabase
      .from('vision_boards')
      .delete()
      .eq('id', id);

    if (dbError) {
      console.error('Supabase DB Delete Error:', dbError);
    }
  } catch (error) {
    console.error("Failed to delete image", error);
  }
};
