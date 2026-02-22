// Define the structure of our local model weights/gradients
export interface InteractionWeights {
  layoutSimplificationEfficacy: number;
  colorMutingEfficacy: number;
  dyslexicFontAdoption: number;
  timeBufferAccuracy: number;
}

// Differential Privacy Configuration
const DP_CONFIG = {
  epsilon: 0.5, // Privacy budget (lower = more private, more noisy)
  sensitivity: 1.0, // Maximum change a single user's batch can apply to a weight
  minBatchSize: 10, // K-Anonymity conceptual gate: minimum local events before sending
};

/**
 * Mathematical utility to generate noise from a Laplace distribution.
 * Uses inverse transform sampling.
 */
const generateLaplaceNoise = (scale: number): number => {
  const u = Math.random() - 0.5; // Uniform random variable between -0.5 and 0.5
  return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
};

export class FederatedLearningClient {
  private localWeights: InteractionWeights;
  private eventCount: number;

  constructor() {
    this.localWeights = {
      layoutSimplificationEfficacy: 0,
      colorMutingEfficacy: 0,
      dyslexicFontAdoption: 0,
      timeBufferAccuracy: 0,
    };
    this.eventCount = 0;
  }

  /**
   * Step 1: Accumulate local interaction data securely on the edge.
   */
  public logInteraction(key: keyof InteractionWeights, delta: number) {
    // Clip the delta to enforce the sensitivity bound \Delta f
    const clippedDelta = Math.max(-DP_CONFIG.sensitivity, Math.min(DP_CONFIG.sensitivity, delta));
    this.localWeights[key] += clippedDelta;
    this.eventCount++;

    // Autonomously attempt federated sync if batch size is met
    if (this.eventCount >= DP_CONFIG.minBatchSize) {
      this.transmitFederatedUpdate();
    }
  }

  /**
   * Step 2: Inject Local Differential Privacy (LDP) Noise.
   */
  private applyDifferentialPrivacy(weights: InteractionWeights): InteractionWeights {
    const scale = DP_CONFIG.sensitivity / DP_CONFIG.epsilon;
    const noisyWeights: Partial<InteractionWeights> = {};

    for (const key in weights) {
      const typedKey = key as keyof InteractionWeights;
      // Y_i = w_i + Laplace(\Delta f / \epsilon)
      const noise = generateLaplaceNoise(scale);
      noisyWeights[typedKey] = weights[typedKey] + noise;
    }

    return noisyWeights as InteractionWeights;
  }

  /**
   * Step 3: Transmit the obfuscated gradients to the central aggregator.
   */
  public async transmitFederatedUpdate() {
    if (this.eventCount < DP_CONFIG.minBatchSize) {
      console.warn(`[Federated Client] K-anonymity gate blocked transmission. Events: ${this.eventCount}/${DP_CONFIG.minBatchSize}`);
      return;
    }

    try {
      // Create a snapshot and add noise
      const noisyGradients = this.applyDifferentialPrivacy({ ...this.localWeights });

      // Transmit strictly the noisy gradients, NO user identifiers
      const response = await fetch('/api/ml/federated-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: Deliberately omitting Authorization headers to break linkage to the specific user profile
        },
        body: JSON.stringify({
          gradients: noisyGradients,
          batchSize: this.eventCount,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) throw new Error('Failed to transmit federated gradients');

      console.log('[Federated Client] Successfully transmitted differentially private update.');

      // Reset local state after successful transmission
      this.resetLocalState();

    } catch (error) {
      console.error('[Federated Client] Transmission error:', error);
    }
  }

  private resetLocalState() {
    this.localWeights = {
      layoutSimplificationEfficacy: 0,
      colorMutingEfficacy: 0,
      dyslexicFontAdoption: 0,
      timeBufferAccuracy: 0,
    };
    this.eventCount = 0;
  }
}

// Export a singleton instance to be used across the React app
export const flClient = new FederatedLearningClient();