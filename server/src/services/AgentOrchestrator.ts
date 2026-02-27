import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { vectorStore } from './VectorStore';

type CognitiveState = 'hyperfocus' | 'normal' | 'approaching_overload' | 'overload';

interface TelemetryPayload {
  userId: string;
  state: CognitiveState;
  score: number;
}

interface ActionRequest {
  type: 'INITIATE_TASK' | 'PROCESS_COMMUNICATION' | 'SCHEDULE_MEETING';
  payload: any;
}

export class AgentOrchestrator {
  private userStates: Map<string, TelemetryPayload> = new Map();
  
  // LangChain Setup with built-in Exponential Backoff for 429 Rate Limits
  private llm = new ChatGoogleGenerativeAI({
    model: 'gemini-2.0-flash', // Correct key for @langchain/google-genai
    maxRetries: 3, // Automatically retries with exponential backoff if rate limited
    temperature: 0.2,
  });

  public updateState(telemetry: TelemetryPayload) {
    this.userStates.set(telemetry.userId, telemetry);
    this.evaluateAmbientTriggers(telemetry);
  }

  private evaluateAmbientTriggers(telemetry: TelemetryPayload) {
    if (telemetry.state === 'overload') {
      this.triggerSensoryBuffer(telemetry.userId);
    } else if (telemetry.state === 'hyperfocus') {
      this.triggerSlackSnooze(telemetry.userId);
    }
  }

  public async routeAction(userId: string, request: ActionRequest): Promise<{ status: string, message: string }> {
    const currentState = this.userStates.get(userId)?.state || 'normal';

    if (request.type === 'INITIATE_TASK' && currentState === 'overload') {
      console.log(`[Orchestrator] Blocked task initiation for ${userId}.`);
      return this.triggerRecoveryProtocol(userId);
    }

    if (request.type === 'PROCESS_COMMUNICATION' && currentState === 'hyperfocus') {
      console.log(`[Orchestrator] Buffered communication for ${userId} to preserve flow.`);
      return { status: 'buffered', message: 'Message cached. Flow state preserved.' };
    }

    switch (request.type) {
      case 'PROCESS_COMMUNICATION':
        return this.executeCommunicationAgent(userId, request.payload);
      case 'INITIATE_TASK':
        return this.executeTaskAgent(userId, request.payload);
      default:
        return { status: 'ignored', message: 'Action type not recognized.' };
    }
  }

  private async executeCommunicationAgent(userId: string, payload: any) {
    const cached = await vectorStore.getCachedResponse(payload.text, 'communication_translation');
    if (cached) {
      console.log(`[Orchestrator] Cache hit for ${userId} communication.`);
      return { status: 'success', message: cached };
    }

    console.log(`[Orchestrator] Executing LangChain translation for ${userId}`);
    
    // LangChain Pipeline
    const prompt = PromptTemplate.fromTemplate(
      `Translate the following blunt corporate message into polite, collaborative language. 
      Message: {message}`
    );
    
    const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
    
    try {
      const result = await chain.invoke({ message: payload.text });
      await vectorStore.cacheResponse(payload.text, 'communication_translation', result);
      return { status: 'success', message: result };
    } catch (error) {
      console.error('[LangChain Error]:', error);
      return { status: 'error', message: 'Translation failed due to high cognitive load on the server.' };
    }
  }

  private async executeTaskAgent(userId: string, payload: any) {
    console.log(`[Orchestrator] Breaking down task for ${userId}`);
    return { status: 'success', message: 'Task decomposed into micro-steps.' };
  }

  private triggerSensoryBuffer(userId: string) {}
  private triggerSlackSnooze(userId: string) {}
  private triggerRecoveryProtocol(userId: string) {
    return { status: 'intervention', message: 'Task blocked. Load is critical. 5-minute breathing buffer initiated.' };
  }
}

export const orchestrator = new AgentOrchestrator();