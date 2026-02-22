import { WebClient } from '@slack/web-api';
import { decryptToken } from '../utils/encryption';
import { supabaseAdmin } from '../utils/supabaseAdmin'; // Assumes you have your admin client exported

export class SlackIntegrator {
  private async getClient(userId: string): Promise<WebClient> {
    const { data, error } = await supabaseAdmin
      .from('user_integrations')
      .select('slack_access_token')
      .eq('user_id', userId)
      .single();

    if (error || !data?.slack_access_token) throw new Error('Slack not connected.');
    
    const token = decryptToken(data.slack_access_token);
    return new WebClient(token);
  }

  // Extract thread history for the Translation/Visualizer Agents
  public async getThreadHistory(userId: string, channelId: string, threadTs: string) {
    const client = await this.getClient(userId);
    const result = await client.conversations.replies({
      channel: channelId,
      ts: threadTs,
      limit: 50
    });
    return result.messages || [];
  }

  // Dynamically mute notifications during 'Hyperfocus' or 'Overload' states
  public async setCognitiveSnooze(userId: string, minutes: number) {
    const client = await this.getClient(userId);
    await client.dnd.setSnooze({
      num_minutes: minutes
    });
  }

  // End snooze when user returns to a 'Normal' state
  public async endCognitiveSnooze(userId: string) {
    const client = await this.getClient(userId);
    await client.dnd.endSnooze();
  }

  // Deliver batched summaries instead of individual pings
  public async sendBatchNotification(userId: string, targetChannel: string, summaryBlock: string) {
    const client = await this.getClient(userId);
    await client.chat.postMessage({
      channel: targetChannel,
      text: "NeuroAdaptive OS: Batched Updates",
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: `*Cognitive Batch Delivery:*\n\n${summaryBlock}` }
        }
      ]
    });
  }
}

export const slackIntegration = new SlackIntegrator();