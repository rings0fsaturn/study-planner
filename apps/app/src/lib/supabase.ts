import { createClient } from '@supabase/supabase-js';

const _supabaseUrl = import.meta.env.SUPABASE_URL;
const supabasePublishableKey = import.meta.env.SUPABASE_PUBLISHABLE_KEY;

if (!_supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.');
}

export const supabase = createClient(_supabaseUrl, supabasePublishableKey);
export const supabaseUrl = _supabaseUrl;