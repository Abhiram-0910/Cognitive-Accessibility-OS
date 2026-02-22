import { ingestMemory } from '../../agents/memoryAgent';

// Mock types for external webhook payloads
type WebhookSource = 'google_meet' | 'slack' | 'zoom';

interface WebhookPayload {
  source: WebhookSource;
  eventId: string;
  userId: string; // Mapped to your Supabase Auth ID
  timestamp: string;
  rawContent: string; // The transcript or thread history
  metadata: {
    title: string;
    participants?: string[];
  };
}

/**
 * MOCK SERVERLESS FUNCTION / WEBHOOK HANDLER
 * In production, this runs on a Supabase Edge Function or Node.js backend.
 */
export const processIncomingWebhook = async (payload: WebhookPayload): Promise<{ success: boolean; message: string }> => {
  console.log(`[Indexer] Received ${payload.source} payload for event: ${payload.metadata.title}`);

  try {
    // 1. Format the raw text for optimal LLM context
    const contextualizedText = `
      Source: ${payload.source.toUpperCase()}
      Title: ${payload.metadata.title}
      Date: ${new Date(payload.timestamp).toLocaleString()}
      Participants: ${payload.metadata.participants?.join(', ') || 'Unknown'}
      
      Content/Transcript:
      ${payload.rawContent}
    `;

    // 2. Pass to the existing memory RAG agent (summarizes, embeds, and stores in pgvector)
    const result = await ingestMemory(contextualizedText, payload.userId);

    if (result.success) {
      console.log(`[Indexer] Successfully indexed and vectorized: ${payload.metadata.title}`);
      return { success: true, message: `Vectorized and stored: ${result.summary}` };
    } else {
      throw new Error("Ingestion agent returned failure state.");
    }
  } catch (error) {
    console.error(`[Indexer] Failed to process webhook ${payload.eventId}:`, error);
    return { success: false, message: 'Background indexing failed.' };
  }
};

// --- HACKATHON DEMO UTILITY ---
// Bind this to a hidden button in your UI or run it on a timer to simulate a meeting ending during your pitch.
export const triggerMockMeetingEndEvent = async (userId: string) => {
  const mockMeetingTranscript = `
    Alex: So we are aligned on the Q3 roadmap?
    Sarah: Yes. Alex, you need to finalize the database schema by Tuesday. 
    Alex: Got it. I will send the schema draft to the engineering channel on Monday afternoon.
    Sarah: Perfect. Meeting adjourned.
  `;

  return await processIncomingWebhook({
    source: 'google_meet',
    eventId: `meet_${Date.now()}`,
    userId: userId,
    timestamp: new Date().toISOString(),
    rawContent: mockMeetingTranscript,
    metadata: {
      title: 'Q3 Architecture Sync',
      participants: ['Alex', 'Sarah']
    }
  });
};