import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin Client (Requires SUPABASE_SERVICE_ROLE_KEY)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export const setupApiRoutes = () => {
  const router = Router();

  /**
   * POST /api/auth/anonymous
   * Generates a frictionless, zero-auth session using Supabase Admin.
   * Perfect for hackathon demos to get judges straight into the app.
   */
  router.post('/auth/anonymous', async (req: Request, res: Response) => {
    try {
      // We generate a deterministic but unique mock email for the anon session
      const anonId = `anon_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const mockEmail = `${anonId}@neuroadaptive.local`;
      const mockPassword = `secure_${anonId}_password`;

      // Use Admin API to force-create the user and auto-confirm them
      const { data: user, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: mockEmail,
        password: mockPassword,
        email_confirm: true,
        user_metadata: { role: 'anonymous_trial' }
      });

      if (createError) throw createError;

      // Return the credentials so the client can immediately signInWithPassword()
      res.status(201).json({
        success: true,
        credentials: { email: mockEmail, password: mockPassword },
        userId: user.user.id
      });
    } catch (error: any) {
      console.error('[API] Anonymous Auth Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/agents/status
   * Health check and status monitoring for the Gemini Agentic layer.
   */
  router.get('/agents/status', (req: Request, res: Response) => {
    // In a real scenario, this might ping the Gemini API or check queue depth
    res.status(200).json({
      success: true,
      agents: {
        sensorySynthesizer: 'online',
        prostheticMemory: 'online',
        communicationProxy: 'online',
      },
      systemLoad: 'nominal',
      timestamp: new Date().toISOString()
    });
  });

  /**
   * POST /api/agents/:id/action
   * Centralized webhook receiver for triggering specific agent behaviors off-client.
   */
  router.post('/agents/:id/action', async (req: Request, res: Response) => {
    const agentId = req.params.id;
    const { payload, action } = req.body;

    if (!payload || !action) {
      return res.status(400).json({ success: false, error: 'Missing payload or action parameter.' });
    }

    try {
      // Example routing logic for off-client agent execution
      console.log(`[API] Triggering agent ${agentId} for action: ${action}`);
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 800));

      res.status(200).json({
        success: true,
        message: `Agent ${agentId} successfully executed ${action}.`,
        result: {
          processedAt: new Date().toISOString(),
          status: 'completed'
        }
      });
    } catch (error: any) {
      console.error(`[API] Agent Action Error:`, error);
      res.status(500).json({ success: false, error: 'Internal agent execution failure.' });
    }
  });

  return router;
};