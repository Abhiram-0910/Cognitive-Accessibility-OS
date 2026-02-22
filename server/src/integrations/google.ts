import { google } from 'googleapis';
import { Router, Request, Response } from 'express';
import { encryptToken, decryptToken } from '../utils/encryption';
import { supabaseAdmin } from '../utils/supabaseAdmin';

// Initialize OAuth2 client with proper redirect URI
export const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
);

/**
 * Sets up Google OAuth authentication routes
 * 
 * Usage:
 *   app.use('/auth', setupGoogleAuthRoutes());
 */
export const setupGoogleAuthRoutes = () => {
  const router = Router();

  // 1. Redirect user to Google for consent
  router.get('/google/login', (req: Request, res: Response) => {
    // Pass the userId in the state parameter to map the tokens later
    const userId = req.query.userId as string; 
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required in query parameters' });
    }

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Required to get a refresh_token
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/gmail.modify'
      ],
      state: userId, 
    });
    res.redirect(url);
  });

  // 2. Handle the callback from Google
  router.get('/google/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const userId = req.query.state as string;

    if (!code || !userId) {
      console.error('[Google Auth] Missing code or userId in callback');
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard?integration=error`);
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);
      
      if (tokens.refresh_token && userId) {
        // Securely Encrypt the Token At-Rest
        const encryptedToken = encryptToken(tokens.refresh_token);

        // Save to Database using the Admin Client (bypassing RLS)
        const { error } = await supabaseAdmin
          .from('user_integrations')
          .upsert({ 
            user_id: userId, 
            google_refresh_token: encryptedToken,
            updated_at: new Date().toISOString()
          });

        if (error) throw error;
        
        console.log(`[Google Auth] Successfully linked Google Workspace for user ${userId}`);
      }
      
      // Redirect back to the frontend OS Dashboard
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard?integration=success`);
    } catch (error) {
      console.error('[Google Auth] Error during callback:', error);
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard?integration=error`);
    }
  });

  return router;
};

/**
 * Main integration class for Google Workspace APIs
 * 
 * Usage:
 *   await googleIntegration.batchLowPriorityEmails(userId);
 *   await googleIntegration.insertFocusBlocks(userId);
 */
export class GoogleIntegrator {
  /**
   * Sets up OAuth credentials for a specific user
   */
  private async setCredentials(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('user_integrations')
      .select('google_refresh_token')
      .eq('user_id', userId)
      .single();

    if (error || !data?.google_refresh_token) {
      console.error(`[Google] Failed to retrieve credentials for user ${userId}:`, error);
      throw new Error('Google not connected.');
    }

    try {
      const refreshToken = decryptToken(data.google_refresh_token);
      oauth2Client.setCredentials({ refresh_token: refreshToken });
    } catch (decryptError) {
      console.error(`[Google] Failed to decrypt refresh token for user ${userId}:`, decryptError);
      throw new Error('Token decryption failed.');
    }
  }

  /**
   * Batches low-priority emails to reduce visual noise
   * 
   * Algorithm:
   * 1. Finds non-important emails in inbox
   * 2. Moves them to a dedicated "Batched" label
   * 3. Removes them from the inbox view
   */
  public async batchLowPriorityEmails(userId: string) {
    await this.setCredentials(userId);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    try {
      // Find emails that aren't marked important or from VIPs
      const res = await gmail.users.messages.list({
        userId: 'me',
        q: 'is:inbox -is:important -label:vip',
        maxResults: 20
      });

      const messages = res.data.messages || [];
      if (messages.length === 0) {
        console.log(`[Google] No low-priority emails to batch for user ${userId}`);
        return;
      }

      // Ensure the batched label exists
      let batchedLabelId = await this.ensureLabelExists(
        gmail, 
        'NeuroAdaptive/Batched', 
        { 
          messageListVisibility: 'hide', 
          labelListVisibility: 'labelShowIfUnread' 
        }
      );

      // Move them out of the Inbox into the "Batched" label
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: messages.map(m => m.id as string),
          addLabelIds: [batchedLabelId],
          removeLabelIds: ['INBOX']
        }
      });

      console.log(`[Google] Batched ${messages.length} low-priority emails for user ${userId}`);
    } catch (error) {
      console.error(`[Google] Error batching emails for user ${userId}:`, error);
      throw new Error('Failed to batch low-priority emails');
    }
  }

  /**
   * Inserts focus blocks into calendar based on meeting density
   * 
   * Algorithm:
   * 1. Fetches today's calendar events
   * 2. If meeting density exceeds threshold, finds available gap
   * 3. Creates a focus block event with special properties
   */
  public async insertFocusBlocks(userId: string) {
    await this.setCredentials(userId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tonight = new Date(today);
      tonight.setHours(23, 59, 59, 999);

      // Fetch today's events
      const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: today.toISOString(),
        timeMax: tonight.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = res.data.items || [];
      
      // Heuristic: If there are 3+ meetings, find a 2-hour gap for focus block
      if (events.length >= 3) {
        // Find the first available gap of at least 2 hours
        const focusBlockDuration = 2 * 60 * 60 * 1000; // 2 hours in ms
        let focusBlockStart: Date | null = null;
        
        // Check time before first event
        if (events.length > 0) {
          const firstEventStart = new Date(events[0].start?.dateTime || events[0].start?.date || '');
          const timeBeforeFirstEvent = firstEventStart.getTime() - today.getTime();
          
          if (timeBeforeFirstEvent >= focusBlockDuration) {
            focusBlockStart = new Date(today);
          }
        }
        
        // Check gaps between events
        if (!focusBlockStart) {
          for (let i = 0; i < events.length - 1; i++) {
            const currentEnd = new Date(events[i].end?.dateTime || events[i].end?.date || '');
            const nextStart = new Date(events[i+1].start?.dateTime || events[i+1].start?.date || '');
            const gap = nextStart.getTime() - currentEnd.getTime();
            
            if (gap >= focusBlockDuration) {
              focusBlockStart = new Date(currentEnd);
              break;
            }
          }
        }
        
        // Check time after last event
        if (!focusBlockStart && events.length > 0) {
          const lastEventEnd = new Date(events[events.length-1].end?.dateTime || events[events.length-1].end?.date || '');
          const timeAfterLastEvent = tonight.getTime() - lastEventEnd.getTime();
          
          if (timeAfterLastEvent >= focusBlockDuration) {
            focusBlockStart = new Date(lastEventEnd);
          }
        }
        
        // If we found a suitable gap, create the focus block
        if (focusBlockStart) {
          const focusBlockEnd = new Date(focusBlockStart.getTime() + focusBlockDuration);
          
          await calendar.events.insert({
            calendarId: 'primary',
            requestBody: {
              summary: '🛡️ NeuroAdaptive Focus Block',
              description: 'Auto-scheduled by OS due to high cognitive load prediction.\n\nThis time is reserved for deep work and cognitive recovery.',
              start: { dateTime: focusBlockStart.toISOString() },
              end: { dateTime: focusBlockEnd.toISOString() },
              colorId: '2', // Sage/Green color
              transparency: 'transparent', // Mark as busy
              reminders: {
                useDefault: false,
                overrides: [
                  { method: 'popup', minutes: 30 }
                ]
              }
            }
          });
          
          console.log(`[Google] Inserted focus block for user ${userId} from ${focusBlockStart.toLocaleTimeString()} to ${focusBlockEnd.toLocaleTimeString()}`);
        } else {
          console.log(`[Google] No suitable gap found for focus block for user ${userId}`);
        }
      } else {
        console.log(`[Google] Not enough meetings (${events.length}) to warrant focus block for user ${userId}`);
      }
    } catch (error) {
      console.error(`[Google] Error inserting focus blocks for user ${userId}:`, error);
      throw new Error('Failed to insert focus blocks');
    }
  }

  /**
   * Ensures a label exists in Gmail, creating it if necessary
   */
  private async ensureLabelExists(
    gmail: ReturnType<typeof google.gmail>, 
    labelName: string, 
    properties: { messageListVisibility?: string; labelListVisibility?: string } = {}
  ): Promise<string> {
    // Check if label already exists
    const res = await gmail.users.labels.list({ userId: 'me' });
    const existingLabel = res.data.labels?.find(label => 
      label.name?.toLowerCase() === labelName.toLowerCase()
    );
    
    if (existingLabel) {
      return existingLabel.id as string;
    }
    
    // Create label if it doesn't exist
    const newLabel = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: labelName,
        messageListVisibility: properties.messageListVisibility || 'show',
        labelListVisibility: properties.labelListVisibility || 'labelShow',
        type: 'user'
      }
    });
    
    return newLabel.data.id as string;
  }
}

export const googleIntegration = new GoogleIntegrator();