import { MicroTask } from '../../agents/taskAgent';

/**
 * Local NLP Fallback Engine
 * Parses tasks and integrations into structured formats without using the LLM.
 */

const STOPWORDS = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will', 'with']);

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOPWORDS.has(word));
}

/**
 * Lexical Anchor Formatting
 * Wraps the first half of words in <strong> tags for visual anchoring.
 * Exported for use in ReadingMode component.
 */
export function applyLexicalAnchorFormatting(text: string): string {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
    const segments = segmenter.segment(text);
    let result = '';
    for (const segment of segments) {
      if (segment.isWordLike && segment.segment.length > 1 && !segment.segment.includes('```')) {
        const part = segment.segment;
        const mid = Math.ceil(part.length / 2);
        const start = part.substring(0, mid);
        const end = part.substring(mid);
        result += `<strong>${start}</strong>${end}`;
      } else {
        result += segment.segment;
      }
    }
    return result;
  }

  // Fallback for older environments
  return text.split(/(\s+)/).map(part => {
    if (part.length <= 1 || part.match(/^\s+$/) || part.includes('```')) return part;
    const mid = Math.ceil(part.length / 2);
    const start = part.substring(0, mid);
    const end = part.substring(mid);
    return `<strong>${start}</strong>${end}`;
  }).join('');
}

export type NLPResult = {
  content: string | string[];
  type: 'summary' | 'lexical_anchor';
};

export function summarizeTextLocally(text: string, sentenceCount: number = 3): NLPResult {
  if (!text) return { content: [], type: 'summary' };
  
  const wordCount = text.split(/\s+/).length;
  
  // ── Ambiguity 1: Micro-Text Bionic Fallback ─────────────────────────────
  if (wordCount < 30) {
    return {
      content: applyLexicalAnchorFormatting(text),
      type: 'lexical_anchor'
    };
  }

  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  if (sentences.length <= sentenceCount) {
    return { 
      content: sentences.map(s => s.trim()), 
      type: 'summary' 
    };
  }

  // 1. Calculate Term Frequency (TF)
  const tf: Record<string, number> = {};
  const tokens = tokenize(text);
  tokens.forEach(t => tf[t] = (tf[t] || 0) + 1);

  // 2. Score sentences
  const sentenceScores = sentences.map(sentence => {
    const sTokens = tokenize(sentence);
    const score = sTokens.reduce((acc, token) => acc + (tf[token] || 0), 0);
    return { sentence: sentence.trim(), score };
  });

  // 3. Extract top sentences
  const result = sentenceScores
    .sort((a, b) => b.score - a.score)
    .slice(0, sentenceCount)
    .sort((a, b) => text.indexOf(a.sentence) - text.indexOf(b.sentence))
    .map(s => `• ${s.sentence}`);

  return { content: result, type: 'summary' };
}

export function chunkTaskLocally(description: string, estimatedTimeMinutes: number): MicroTask[] {
  const result = summarizeTextLocally(description, 5);
  const chunks = Array.isArray(result.content) ? result.content : [result.content];
  
  return chunks.map((line, i) => ({
    id: `local-${Date.now()}-${i}`,
    step: line.startsWith('• ') ? line.replace('• ', '⚡ ') : `📖 [Ocular Centering] ${line.substring(0, 50)}...`,
    estimated_minutes: Math.max(1, Math.floor(estimatedTimeMinutes / chunks.length)),
    friction_point: result.type === 'lexical_anchor' ? 'Short Task Rendering' : 'Summarized Task',
  }));
}

export function simplifyNotificationLocally(message: string): string {
  const result = summarizeTextLocally(message, 1);
  if (result.type === 'lexical_anchor') {
    // Strip tags for simple text notifications
    return (result.content as string).replace(/<\/?strong>/g, '');
  }
  const content = result.content as string[];
  return content.length > 0 ? content[0].replace('• ', '⚡ ') : message;
}
