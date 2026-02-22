import { google } from 'googleapis';
import { decryptToken } from '../utils/encryption';
import { supabaseAdmin } from '../utils/supabaseAdmin';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export class GoogleIntegrator {
  private async setCredentials(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('user_integrations')
      .select('google_refresh_token')
      .eq('user_id', userId)
      .single();

    if (error || !data?.google_refresh_token) throw new Error('Google not connected.');

    const refreshToken = decryptToken(data.google_refresh_token);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
  }

  // GMAIL: Batching emails to reduce visual noise
  public async batchLowPriorityEmails(userId: string) {
    await this.setCredentials(userId);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Find emails that aren't marked important or from VIPs
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:inbox -is:important',
      maxResults: 20
    });

    const messages = res.data.messages || [];
    if (messages.length === 0) return;

    // Move them out of the Inbox into a specific "Batched" label
    const batchedLabelId = 'Label_Batched_NeuroAdaptive'; // Assume we created this label during onboarding
    
    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids: messages.map(m => m.id as string),
        addLabelIds: [batchedLabelId],
        removeLabelIds: ['INBOX']
      }
    });
  }

  // CALENDAR: Calculate meeting density and insert Focus Blocks
  public async insertFocusBlocks(userId: string) {
    await this.setCredentials(userId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

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
    
    // Simple Heuristic: If there are more than 3 meetings, find a 2-hour gap and block it
    if (events.length >= 3) {
      // Logic to find gap omitted for brevity in hackathon snippet
      // Let's assume we found a gap at 1 PM
      const blockStart = new Date(today);
      blockStart.setHours(13, 0, 0, 0);
      const blockEnd = new Date(today);
      blockEnd.setHours(15, 0, 0, 0);

      await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: '🛡️ NeuroAdaptive Focus Block',
          description: 'Auto-scheduled by OS due to high cognitive load prediction.',
          start: { dateTime: blockStart.toISOString() },
          end: { dateTime: blockEnd.toISOString() },
          colorId: '2', // Usually Sage/Green
        }
      });
    }
  }
}

export const googleIntegration = new GoogleIntegrator();