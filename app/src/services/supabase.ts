import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const extractReelContent = async (url: string): Promise<{ transcript?: string; ocr?: string; error?: string }> => {
  try {
    const { data, error } = await supabase.functions.invoke('extract-reel', {
      body: { url },
    });

    if (error) {
      console.error('Supabase function error:', error);
      return { error: error.message };
    }

    return data;
  } catch (err: any) {
    console.error('Extract reel error:', err);
    return { error: err.message || 'Failed to extract reel content' };
  }
};
