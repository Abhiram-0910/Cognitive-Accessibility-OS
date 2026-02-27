import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Authorization check
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    console.log('[StorageCleaner] Running daily physical wipe...');

    // 2. Query for files in the 'kids-captures' bucket
    const { data: files, error: listError } = await supabaseAdmin
      .storage
      .from('kids-captures')
      .list('', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'asc' },
      });

    if (listError) throw listError;

    if (!files || files.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No files to clean.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Filter files older than 24 hours
    const now = new Date();
    const threshold = 24 * 60 * 60 * 1000;
    const filesToDelete = files
      .filter(f => {
        const createdAt = new Date(f.created_at);
        return now.getTime() - createdAt.getTime() > threshold;
      })
      .map(f => f.name);

    if (filesToDelete.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No expired files found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Execute deletion
    const { error: deleteError } = await supabaseAdmin
      .storage
      .from('kids-captures')
      .remove(filesToDelete);

    if (deleteError) throw deleteError;

    console.log(`[StorageCleaner] ✅ Successfully deleted ${filesToDelete.length} expired captures.`);

    return new Response(JSON.stringify({ 
      success: true, 
      count: filesToDelete.length,
      files: filesToDelete 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[StorageCleaner] CRITICAL FAILURE:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
