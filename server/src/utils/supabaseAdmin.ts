import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Resolve the .env path relative to this file's location so it works regardless
// of the working directory from which `npm run dev` is invoked.
// __dirname = .../server/src/utils  →  ../../.env  = server/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

// 🛑 Strict Fail-Fast — crash immediately with a readable message
if (!supabaseUrl || !supabaseKey) {
  console.error(
    '❌ FATAL ERROR: Missing Supabase environment variables.\n' +
    '   Checked: SUPABASE_URL, VITE_SUPABASE_URL\n' +
    '   Checked: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, VITE_SUPABASE_ANON_KEY\n' +
    `   Resolved .env path: ${path.resolve(__dirname, '../../.env')}`
  );
  process.exit(1);
}

// Bypasses RLS — NEVER expose SUPABASE_SERVICE_ROLE_KEY to the frontend
export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});