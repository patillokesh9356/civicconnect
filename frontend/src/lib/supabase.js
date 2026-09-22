import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Upload image to Supabase Storage
 * @param {File} file - Image file
 * @param {number} userId - User ID (for folder structure)
 * @returns {string|null} Public URL of uploaded image
 */
export async function uploadComplaintImage(file, userId) {
  try {
    // Validate file type
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      throw new Error('Only JPG, PNG, WebP, GIF images allowed');
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image must be under 5MB');
    }

    // Unique filename: userId/timestamp-original.ext
    const ext      = file.name.split('.').pop();
    const filename = `${userId}/${Date.now()}-complaint.${ext}`;

    const { data, error } = await supabase.storage
      .from('complaint-images')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('complaint-images')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (err) {
    console.error('Image upload error:', err);
    throw err;
  }
}
