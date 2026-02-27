import { Router, Request, Response } from 'express';

import { supabaseAdmin } from '../utils/supabaseAdmin';

const processIncomingWebhook = async (payload: any) => {
  // Push the event to Supabase Realtime so the frontend (IntegrationDemoPanel) can instantly react to it
  const { error } = await supabaseAdmin.from('telemetry_events').insert({
    user_id: payload.userId,
    event_type: 'webhook_incoming',
    event_data: payload,
    created_at: new Date().toISOString()
  });
  
  if (error) console.error('[Webhook] Failed to log event:', error);
  return true;
};

export const setupWebhookRoutes = () => {
  const router = Router();

  // SLACK EVENT SUBSCRIPTIONS
  router.post('/slack', async (req: Request, res: Response) => {
    const { type, challenge, event } = req.body;

    // Slack URL Verification Challenge
    if (type === 'url_verification') {
      return res.status(200).send(challenge);
    }

    // Handle real events (e.g., message posted in a channel we are listening to)
    if (event && event.type === 'message' && !event.bot_id) {
      // Instantly return 200 to acknowledge receipt to Slack
      res.status(200).send('OK');

      // Process asynchronously
      await processIncomingWebhook({
        source: 'slack',
        eventId: event.ts,
        userId: 'system_mapped_user_id', // Map Slack User ID to Supabase ID via DB lookup
        timestamp: new Date(parseFloat(event.ts) * 1000).toISOString(),
        rawContent: event.text,
        metadata: {
          title: `Slack Thread in ${event.channel}`,
        }
      });
    } else {
      res.status(200).send('OK');
    }
  });

  // GOOGLE CALENDAR PUSH NOTIFICATIONS
  router.post('/calendar', async (req: Request, res: Response) => {
    const channelId = req.headers['x-goog-channel-id'] as string;
    const resourceState = req.headers['x-goog-resource-state'] as string;

    res.status(200).send('OK');

    if (resourceState === 'exists') {
      console.log(`[Webhook] Calendar updated for channel: ${channelId}`);
    }
  });

  // JIRA WEBHOOK
  router.post('/jira', async (req: Request, res: Response) => {
    const event = req.body;
    
    // Acknowledge receipt
    res.status(200).send('OK');

    if (event && event.issue) {
      // Note: This relies on Jira webhook payload structure
      processIncomingWebhook({
        source: 'jira',
        eventId: event.issue.id,
        userId: 'system_mapped_user_id', // Would map to actual Supabase ID in production
        timestamp: new Date().toISOString(),
        rawContent: event.issue.fields?.description ?? 'No description provided.',
        metadata: {
          title: event.issue.fields?.summary ?? 'New Jira Issue',
          key: event.issue.key
        }
      });
    }
  });

  return router;
};