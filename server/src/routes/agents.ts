import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();
const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

// Helper to configure the model dynamically
const getModel = (modelName: string, jsonMode: boolean) => {
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: jsonMode 
      ? { responseMimeType: 'application/json', temperature: 0.2 } 
      : { temperature: 0.2 },
  });
};

/**
 * POST /api/agents/generate
 * Generates a complete response from the Gemini API.
 * 
 * Request body:
 * {
 *   prompt: string,       // Required: The prompt to send to the model
 *   model?: string,       // Optional: Model name (default: 'gemini-1.5-flash')
 *   jsonMode?: boolean    // Optional: Whether to request JSON response (default: true)
 * }
 */
router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, model = 'gemini-1.5-flash', jsonMode = true } = req.body;

    if (!prompt) {
      res.status(400).json({ success: false, error: 'Prompt is required.' });
      return;
    }

    const aiModel = getModel(model, jsonMode);
    const result = await aiModel.generateContent(prompt);
    const text = result.response.text();

    res.status(200).json({ 
      success: true, 
      data: text,
      model: model,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Agents API Error]:', error);
    res.status(500).json({ 
      success: false, 
      error: 'The neural network is experiencing high latency. Please take a deep breath and try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/agents/stream
 * Streams LLM responses to the client using Server-Sent Events (SSE).
 * Ideal for RAG (Retrieval-Augmented Generation) where users need immediate feedback.
 * 
 * Request body:
 * {
 *   prompt: string,       // Required: The prompt to send to the model
 *   model?: string        // Optional: Model name (default: 'gemini-1.5-flash')
 * }
 * 
 * Response format (SSE):
 * data: {"text": "chunk of text"}
 * 
 * data: [DONE]
 */
router.post('/stream', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  try {
    const { prompt, model = 'gemini-1.5-flash' } = req.body;
    
    if (!prompt) {
      res.write(`data: ${JSON.stringify({ 
        error: 'Prompt is required' 
      })}\n\n`);
      res.end();
      return;
    }

    // Standard text model, no JSON enforcement for streaming
    const aiModel = genAI.getGenerativeModel({ 
      model: model,
      generationConfig: { temperature: 0.2 }
    });
    
    const result = await aiModel.generateContentStream(prompt);
    let fullResponse = '';

    // Process the stream
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;
      
      // Send SSE formatted payload
      res.write(`data: ${JSON.stringify({ 
        text: chunkText,
        partial: fullResponse 
      })}\n\n`);
      
      // Ensure data is sent immediately
      res.flushHeaders();
    }

    // Send completion message
    res.write(`data: ${JSON.stringify({ 
      status: 'complete',
      fullResponse: fullResponse 
    })}\n\n`);
    
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('[Stream Error]:', error);
    res.write(`data: ${JSON.stringify({ 
      error: 'Stream failed',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

export const agentRoutes = router;