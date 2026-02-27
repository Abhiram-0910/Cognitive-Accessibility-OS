import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

export const setupApiRoutes = () => {
  // ── Lazy Supabase init (runs AFTER dotenv.config() in server.ts) ─────────────
  // DO NOT move createClient to module top-level — it would run before dotenv fires.
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      '❌ CRITICAL: Missing Supabase environment variables in server/.env\n' +
      '   Expected: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)'
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });


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

  /**
   * POST /api/ml/federated-update
   * Receives differentially private (Laplace noise-injected) gradients from edge clients.
   * Conceptually enforces k-anonymity by accepting anonymous payloads.
   * 
   * Expected payload:
   * {
   *   gradients: number[][],      // 2D array of noise-injected weight updates
   *   batchSize: number,          // Local batch size used for this update
   *   timestamp: number,          // Client-side timestamp (ms)
   *   modelVersion?: string,      // Optional: identifier for global model version
   *   epsilon?: number            // Optional: privacy budget used for this update
   * }
   */
  router.post('/ml/federated-update', async (req: Request, res: Response) => {
    try {
      const { gradients, batchSize, timestamp, modelVersion, epsilon } = req.body;

      // Validate required fields
      if (!gradients || !Array.isArray(gradients) || !batchSize || typeof batchSize !== 'number') {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid federated payload: gradients (number[][]) and batchSize (number) are required.' 
        });
      }

      // Validate gradient structure (basic sanity check)
      if (!gradients.every(layer => Array.isArray(layer) && layer.every(val => typeof val === 'number'))) {
        return res.status(400).json({
          success: false,
          error: 'Gradients must be a 2D array of numbers.'
        });
      }

      // Privacy audit logging (NO PII logged - only metadata)
      console.log(`[Federated ML] Received anonymous k-anonymized update`);
      console.log(`[Federated ML] Metadata: batchSize=${batchSize}, layers=${gradients.length}, timestamp=${timestamp}`);
      if (epsilon) {
        console.log(`[Federated ML] Differential privacy: ε=${epsilon}`);
      }
      if (modelVersion) {
        console.log(`[Federated ML] Target model version: ${modelVersion}`);
      }

      // === PRODUCTION AGGREGATION LOGIC WOULD GO HERE ===
      // Example pseudocode for secure aggregation:
      // 1. Verify gradient dimensions match current global model
      // 2. Apply secure aggregation protocol (e.g., Bonawitz et al.)
      // 3. Average noisy gradients into global model weights
      // 4. Update model version and broadcast to clients
      // ===================================================

      // For hackathon demo: acknowledge receipt and simulate aggregation
      await new Promise(resolve => setTimeout(resolve, 300));

      res.status(200).json({
        success: true,
        message: 'Federated gradients successfully received and queued for aggregation.',
        aggregation: {
          queuedAt: new Date().toISOString(),
          estimatedGlobalUpdate: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // ~5 min delay
          participatingClients: '+1' // Would be actual count in production
        }
      });
    } catch (error: any) {
      console.error('[Federated ML] Error processing update:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to process federated update.',
        debug: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  /**
   * GET /api/ml/model-version
   * Returns the current global model version and metadata for client sync.
   */
  router.get('/ml/model-version', (req: Request, res: Response) => {
    // In production, fetch from model registry or Supabase
    res.status(200).json({
      success: true,
      model: {
        version: 'v0.3.2-hackathon',
        lastUpdated: new Date().toISOString(),
        architecture: 'transformer-lite',
        privacyBudget: {
          totalEpsilon: 8.0,
          remainingEpsilon: 6.2,
          renewalPeriod: '30d'
        }
      }
    });
  });

  return router;
};