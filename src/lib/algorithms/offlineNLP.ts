import { MicroTask } from '../../agents/taskAgent';

/**
 * Local NLP Fallback Engine
 * Parses tasks and integrations into structured formats without using the LLM.
 */

export function chunkTaskLocally(taskDescription: string, estimatedTimeMinutes: number): MicroTask[] {
  // Regex to split on newlines or sentence boundaries (periods followed by space)
  const lines = taskDescription
    .split(/\n|(?:\.\s+)/)
    .map(t => t.trim().replace(/^[-*•\d.)]+\s*/, '')) // Strip bullets/numbers
    .filter(t => t.length > 5);

  if (lines.length > 0 && lines.length <= 10) {
    return lines.slice(0, 7).map((line, i) => ({
      id: `local-${Date.now()}-${i}`,
      step: `⚡ [Offline] ${line.substring(0, 100)}`,
      estimated_minutes: Math.max(1, Math.floor(estimatedTimeMinutes / lines.length)),
      friction_point: 'Basic Formatting',
    }));
  }

  // Fallback: If it's a giant wall of text with no clear sentences
  return [
    {
      id: `local-${Date.now()}-0`,
      step: `⚡ [Offline Mode] Basic Formatting: Read the first paragraph.`,
      estimated_minutes: 5,
      friction_point: 'Text Wall',
    },
    {
      id: `local-${Date.now()}-1`,
      step: `⚡ [Offline Mode] Try chunking the rest manually.`,
      estimated_minutes: estimatedTimeMinutes > 5 ? estimatedTimeMinutes - 5 : 5,
      friction_point: 'Network Offline',
    }
  ];
}

export function simplifyNotificationLocally(rawContent: string): string {
  // Simple heuristic: extract the first sentence, and any sentence indicating action.
  const sentences = rawContent.split(/(?<=[.!?])\s+/);
  if (sentences.length === 0 || !rawContent) return "⚡ [Offline Mode] No content.";

  const bullets: string[] = [];
  
  // Who/What (First sentence usually is the context)
  bullets.push(`⚡ [Offline Mode] ${sentences[0]}`);

  // Need/Action (Look for urgency keywords in subsequent sentences)
  const actionObj = sentences.slice(1).find(s => /(urgent|need|please|asap|deadline|block|fail|action|fix)/i.test(s));
  
  if (actionObj) {
    bullets.push(`- Action: ${actionObj}`);
  }

  return bullets.join('\n');
}
