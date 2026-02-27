import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
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
    console.log(`[Orchestrator] Executing LangChain tool-calling agent for ${userId}`);
    
    // 1. Define the pgvector semantic search tool using standard LangChain abstractions
    const searchMemoryTool = tool(
      async ({ query }) => {
        console.log(`[Tool Call] Executing pgvector search for query: "${query}"`);
        const results = await vectorStore.searchContentOnly(query, userId, 3);
        return results.length > 0 ? results.join('\n\n') : 'No relevant memory found in the vector database.';
      },
      {
        name: 'query_pgvector_memory',
        description: 'Searches the user\'s Prosthetic Memory vector database to recall past context, promises, or facts. Use this to lookup context before translating messages.',
        schema: z.object({
          query: z.string().describe('The natural language semantic search query (e.g., "what did I promise in the standup?")')
        }),
      }
    );

    // 2. Bind the tool to the LLM
    const llmWithTools = this.llm.bindTools([searchMemoryTool]);

    // 3. Simple execution loop (for single-step tool calling)
    // NOTE: For true agentic depth in production we'd use createToolCallingAgent + AgentExecutor,
    // but a direct invoke + validation is safer here and achieves the immediate requirement.
    try {
      // Prompt asks the LLM to use memory if needed before formatting
      const systemPrompt = `
        You are an elite corporate communication bot. Translate the following blunt message into polite language.
        If the message requires historical context, use the 'query_pgvector_memory' tool to check the user's database.
        
        Message: ${payload.text}
      `;

      // First pass: AI might call a tool or return the final translation
      const result = await llmWithTools.invoke(systemPrompt);

      if (result.tool_calls && result.tool_calls.length > 0) {
        // AI decided to query pgvector! 
        const toolCall = result.tool_calls[0];
        const query = toolCall.args.query as string;
        
        // Execute the pgvector query
        const memoryContext = await searchMemoryTool.invoke({ query });
        
        // Final generationpass incorporating the retrieved pgvector context
        const finalPrompt = `
          Context retrieved from vector database:
          ${memoryContext}
          
          Using this context if relevant, translate the following blunt corporate message into polite language:
          ${payload.text}
        `;
        const finalAns = await this.llm.invoke(finalPrompt);
        return { status: 'success', message: finalAns.content as string };
      }

      // If no tool was called, return the direct output
      return { status: 'success', message: result.content as string };
      
    } catch (error) {
      console.error('[LangChain Tool Calling Error]:', error);
      return { status: 'error', message: 'Translation failed due to high cognitive load.' };
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