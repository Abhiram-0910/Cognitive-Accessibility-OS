import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 🛑 Strict Fail-Fast Environment Check
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ FATAL ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend environment.');
  process.exit(1); // Crash the Node process immediately
}

// Bypasses RLS - NEVER expose this key to the frontend
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});