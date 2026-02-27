/// <reference types="vite/client" />

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// =============================================================================
// CORE AGENT CALL
// =============================================================================

export interface AgentRequest {
  prompt: string;
  model?: 'gemini-2.0-flash' | 'gemini-1.5-pro';
  jsonMode?: boolean;
}

/**
 * Securely proxies LLM requests through the Node.js backend.
 * Automatically parses JSON outputs if jsonMode is true,
 * with LLM hallucination armor (strips markdown code fences).
 */
export const callAgent = async <T>(request: AgentRequest): Promise<T> => {
  try {
    const response = await fetch(`${API_BASE_URL}/agents/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: request.prompt,
        model: request.model || 'gemini-2.0-flash',
        jsonMode: request.jsonMode ?? true,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || `HTTP error! status: ${response.status}`);
    }

    if (request.jsonMode !== false) {
      try {
        let cleanData = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
        cleanData = cleanData.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleanData) as T;
      } catch {
        console.error('Failed to parse Agent JSON response:', result.data);
        throw new Error('Received malformed data from the cognitive engine.');
      }
    }

    return result.data as unknown as T;
  } catch (error) {
    console.error('Agent API Call Failed:', error);
    throw error;
  }
};

// =============================================================================
// MOCK SLACK / JIRA INTEGRATION — DEMO MODE
// =============================================================================
// When real API keys are not available (hackathon / demo), we simulate the
// integration pipeline so judges can see the AI simplification flow in action.
// =============================================================================

export type IntegrationSource = 'slack' | 'jira';

export interface IntegrationNotification {
  id: string;
  source: IntegrationSource;
  sender: string;
  channel?: string;           // Slack channel or Jira project key
  timestamp: string;
  rawContent: string;         // Original messy notification text
  simplifiedContent?: string; // AI-simplified version (populated on demand)
  isSimplifying?: boolean;    // Loading state
  priority: 'low' | 'medium' | 'high' | 'critical';
  avatarInitials: string;
}

// ─── Mock Slack Notifications ─────────────────────────────────────────────────
export const MOCK_SLACK_NOTIFICATIONS: IntegrationNotification[] = [
  {
    id: 'slack-001',
    source: 'slack',
    sender: 'Sarah Chen',
    channel: '#eng-standup',
    timestamp: '9:02 AM',
    priority: 'medium',
    avatarInitials: 'SC',
    rawContent:
      '@channel URGENT: The K8s pod OOMKilled again due to misconfigured resource limits in the HPA. ' +
      'We need someone to bump the memory request from 512Mi to 1Gi in values.yaml and re-run the helm chart ASAP. ' +
      'Also, the PR for JIRA-4821 is still blocked on code review and the sprint ends Friday. Please prioritize.',
  },
  {
    id: 'slack-002',
    source: 'slack',
    sender: 'Marcus Liu',
    channel: '#product-design',
    timestamp: '10:47 AM',
    priority: 'low',
    avatarInitials: 'ML',
    rawContent:
      "Hey team, following up on the async discussion re: the new onboarding funnel A/B test. " +
      "Conversion delta is +3.2% on variant B but p-value is 0.07 so it's not fully significant yet. " +
      "Can we sync on whether to extend 2 more weeks or ship variant B given business pressure?",
  },
  {
    id: 'slack-003',
    source: 'slack',
    sender: 'Dev Bot',
    channel: '#ci-alerts',
    timestamp: '11:15 AM',
    priority: 'critical',
    avatarInitials: 'DB',
    rawContent:
      '🔴 PIPELINE FAILURE: Build #2847 failed on `main`. Stage: `test:unit` — 3 tests failed. ' +
      "Error: TypeError: Cannot read property 'amount' of undefined at BillingService.generateInvoice (line 142). " +
      'Downstream: Docker image NOT pushed. Deploy to staging BLOCKED.',
  },
];

// ─── Mock Jira Tickets ────────────────────────────────────────────────────────
export const MOCK_JIRA_TICKETS: IntegrationNotification[] = [
  {
    id: 'jira-001',
    source: 'jira',
    sender: 'Priya Patel',
    channel: 'NEURO-847',
    timestamp: 'Today, 8:30 AM',
    priority: 'high',
    avatarInitials: 'PP',
    rawContent:
      '[NEURO-847] Implement federated authentication via SAML 2.0 with IdP-initiated SSO flow. ' +
      'Acceptance criteria: SP metadata endpoint, ACS URL handler with signature validation, JIT provisioning, ' +
      'attribute mapping for email/firstName/lastName/groups. Dependencies: NEURO-821, NEURO-799. Story points: 13.',
  },
  {
    id: 'jira-002',
    source: 'jira',
    sender: 'Alex Rivera',
    channel: 'NEURO-901',
    timestamp: 'Yesterday, 4:12 PM',
    priority: 'medium',
    avatarInitials: 'AR',
    rawContent:
      '[NEURO-901] Bug: Race condition in WebSocket reconnection handler causes duplicate event subscriptions ' +
      'when network drops intermittently. Steps: open dashboard, disconnect 5s, reconnect — doubled updates. ' +
      'Root cause: missing cleanup in useEffect socket.on() listener in CognitiveStream.tsx.',
  },
];

// ─── AI Simplification Helper ─────────────────────────────────────────────────
/**
 * Sends a raw notification to Gemini and returns a plain-language summary
 * optimised for neurodivergent users (clear, short, action-focused).
 * Falls back gracefully to a trimmed raw excerpt if the backend is unavailable.
 */
export async function simplifyNotification(notification: IntegrationNotification): Promise<string> {
  const prompt = `
You are a cognitive accessibility assistant that simplifies complex work notifications for neurodivergent users (ADHD, dyslexia, autism).

Transform the following ${notification.source === 'slack' ? 'Slack message' : 'Jira ticket'} into a CLEAR, SHORT, calming summary.

Rules:
- Maximum 3 bullet points, each ≤ 15 words
- First bullet: WHO sent it or WHAT it is about
- Second bullet: the ONE action needed from the reader (if any)
- Third bullet: urgency / deadline (if any), otherwise omit
- Use plain English — no jargon, no acronyms unless unavoidable
- Calming, supportive tone — no ALL CAPS, no exclamation marks

Raw notification:
"${notification.rawContent}"

Plain summary:`.trim();

  try {
    const result = await callAgent<string>({
      prompt,
      model: 'gemini-2.0-flash',
      jsonMode: false,
    });
    return typeof result === 'string' ? result.trim() : String(result).trim();
  } catch {
    // Graceful fallback — show a trimmed version of the raw content
    const raw = notification.rawContent;
    return raw.substring(0, 120) + (raw.length > 120 ? '…' : '');
  }
}