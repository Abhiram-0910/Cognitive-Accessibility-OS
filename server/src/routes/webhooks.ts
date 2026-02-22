import { Router, Request, Response } from 'express';
import { processIncomingWebhook } from '../integrations/backgroundIndexer'; // Previously built

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

    // Acknowledge receipt
    res.status(200).send('OK');

    if (resourceState === 'exists') {
      console.log(`[Webhook] Calendar updated for channel: ${channelId}`);
      // Trigger a sync job to pull the new calendar data and update the user's Burnout Forecast
      // e.g., googleIntegration.syncCalendar(channelId)
    }
  });

  return router;
};