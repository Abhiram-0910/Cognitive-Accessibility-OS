import * as tf from '@tensorflow/tfjs';

let cognitiveModel: tf.Sequential | null = null;

/**
 * Initializes a lightweight neural network for predicting cognitive load.
 * Runs entirely on the edge (WebGL/WASM).
 */
export const initCognitiveModel = async () => {
  if (cognitiveModel) return;

  // Ensure backend is ready (WebGL is much faster than CPU)
  await tf.ready();

  const model = tf.sequential();
  
  // Input features: [KPM, ErrorRate, PauseFrequency, ContextSwitches, FacialTension, VocalEnergy]
  model.add(tf.layers.dense({ units: 16, inputShape: [6], activation: 'relu' }));
  model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
  
  // Output layer: Sigmoid squashes the prediction between 0.0 and 1.0
  model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

  model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
  
  cognitiveModel = model;
  console.log('[NeuroAdaptive] Local TF.js Cognitive Model Initialized.');
};

/**
 * Predicts the cognitive load score (0-100) using the initialized TF.js model.
 */
export const predictLoadScore = (features: number[]): number => {
  if (!cognitiveModel) {
    console.warn("TF.js model not initialized. Returning baseline.");
    return 50; 
  }

  // tf.tidy automatically cleans up intermediate tensors to prevent memory leaks
  return tf.tidy(() => {
    // Normalize features roughly to 0-1 range to prevent exploding gradients
    const normalizedFeatures = [
      Math.min(features[0] / 150, 1), // KPM (assuming 150 is max)
      Math.min(features[1], 1),       // Error Rate (already a ratio)
      Math.min(features[2] / 10, 1),  // Pauses
      Math.min(features[3] / 5, 1),   // Context Switches
      Math.min(features[4] / 100, 1), // Facial Tension
      Math.min(features[5] / 100, 1)  // Vocal Energy
    ];

    const inputTensor = tf.tensor2d([normalizedFeatures]);
    const prediction = cognitiveModel!.predict(inputTensor) as tf.Tensor;
    const score = prediction.dataSync()[0];
    
    // Convert 0.0-1.0 to 0-100 score
    return Math.min(100, Math.max(0, Math.round(score * 100)));
  });
};