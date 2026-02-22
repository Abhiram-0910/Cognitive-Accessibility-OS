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

  /**
   * Updates the internal registry with the latest socket.io telemetry.
   */
  public updateState(telemetry: TelemetryPayload) {
    this.userStates.set(telemetry.userId, telemetry);
    this.evaluateAmbientTriggers(telemetry);
  }

  /**
   * Ambient orchestration: Triggers background agents automatically when state crosses thresholds.
   */
  private evaluateAmbientTriggers(telemetry: TelemetryPayload) {
    if (telemetry.state === 'overload') {
      this.triggerSensoryBuffer(telemetry.userId);
    } else if (telemetry.state === 'hyperfocus') {
      this.triggerSlackSnooze(telemetry.userId);
    }
  }

  /**
   * Conflict Resolution: Validates explicit user or system requests against their current capacity.
   */
  public async routeAction(userId: string, request: ActionRequest): Promise<{ status: string, message: string }> {
    const currentState = this.userStates.get(userId)?.state || 'normal';

    // Conflict Resolution Rule 1: Burnout protection overrides Task Initiation
    if (request.type === 'INITIATE_TASK' && currentState === 'overload') {
      console.log(`[Orchestrator] Blocked task initiation for ${userId}. Routing to Recovery Agent.`);
      return this.triggerRecoveryProtocol(userId);
    }

    // Conflict Resolution Rule 2: Defer communications during Hyperfocus
    if (request.type === 'PROCESS_COMMUNICATION' && currentState === 'hyperfocus') {
      console.log(`[Orchestrator] Buffered communication for ${userId} to preserve flow state.`);
      return { status: 'buffered', message: 'Message cached. Flow state preserved.' };
    }

    // Default Routing
    switch (request.type) {
      case 'PROCESS_COMMUNICATION':
        return this.executeCommunicationAgent(userId, request.payload);
      case 'INITIATE_TASK':
        return this.executeTaskAgent(userId, request.payload);
      default:
        return { status: 'ignored', message: 'Action type not recognized.' };
    }
  }

  // --- Sub-Agent Execution Wrappers ---

  private async executeCommunicationAgent(userId: string, payload: any) {
    // Check Redis cache first before burning an API call
    const cached = await vectorStore.getCachedResponse(payload.text, 'communication_translation');
    if (cached) {
      console.log(`[Orchestrator] Cache hit for ${userId} communication.`);
      return { status: 'success', message: cached };
    }

    // Simulated Agent Call...
    console.log(`[Orchestrator] Executing translation for ${userId}`);
    const result = "Translated corporate context."; 
    await vectorStore.cacheResponse(payload.text, 'communication_translation', result);
    
    return { status: 'success', message: result };
  }

  private async executeTaskAgent(userId: string, payload: any) {
    console.log(`[Orchestrator] Breaking down task for ${userId}`);
    return { status: 'success', message: 'Task decomposed into micro-steps.' };
  }

  private triggerSensoryBuffer(userId: string) {
    console.log(`[Orchestrator] Alerting extension to activate Digital Noise Canceling for ${userId}`);
    // Emit WebSocket event to specific user room
  }

  private triggerSlackSnooze(userId: string) {
    console.log(`[Orchestrator] Setting Slack DND to preserve Hyperfocus for ${userId}`);
    // Call Slack Integrator
  }

  private triggerRecoveryProtocol(userId: string) {
    return { 
      status: 'intervention', 
      message: 'Task blocked. Your cognitive load is critical. A 5-minute breathing buffer has been initiated.' 
    };
  }
}

export const orchestrator = new AgentOrchestrator();