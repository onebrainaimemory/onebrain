/**
 * Prompt injection detection for memory write-back content.
 *
 * Detects patterns commonly used in prompt injection attacks
 * when AI agents write memories. Suspicious content gets flagged
 * with reduced confidence and candidate status.
 */

interface InjectionResult {
  isSuspicious: boolean;
  patterns: string[];
  suggestedConfidence: number;
}

/**
 * Patterns that indicate potential prompt injection in memory content.
 * Grouped by severity — high-confidence injection indicators.
 */
const INJECTION_PATTERNS: Array<{ name: string; regex: RegExp; weight: number }> = [
  // Direct system prompt overrides
  {
    name: 'system_prompt_override',
    regex:
      /(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+(?:instructions|prompts|rules|context)/i,
    weight: 0.9,
  },
  {
    name: 'new_instructions',
    regex: /(?:new|updated|revised)\s+(?:system\s+)?instructions?\s*:/i,
    weight: 0.8,
  },
  {
    name: 'you_are_now',
    regex: /you\s+are\s+now\s+(?:a|an|the)\s+/i,
    weight: 0.7,
  },
  {
    name: 'act_as',
    regex: /(?:act|behave|respond)\s+as\s+(?:if\s+)?(?:you\s+(?:are|were)\s+)?/i,
    weight: 0.6,
  },

  // Prompt delimiters / boundary attacks
  {
    name: 'prompt_delimiter',
    regex: /(?:```system|<\|system\|>|<<SYS>>|\[INST\]|\[SYSTEM\]|<system>)/i,
    weight: 0.9,
  },
  {
    name: 'role_injection',
    regex: /(?:^|\n)\s*(?:system|assistant|user)\s*:\s*/im,
    weight: 0.5,
  },

  // Data exfiltration attempts
  {
    name: 'exfiltration',
    regex: /(?:send|post|fetch|curl|http)\s+.*(?:webhook|ngrok|requestbin|pipedream|burp)/i,
    weight: 0.9,
  },

  // Instruction to modify behavior
  {
    name: 'behavior_override',
    regex: /(?:do\s+not|don't|never)\s+(?:filter|check|validate|verify|sanitize|redact)/i,
    weight: 0.8,
  },
  {
    name: 'disable_safety',
    regex: /(?:disable|bypass|skip|ignore)\s+(?:safety|security|filter|guard|check|protection)/i,
    weight: 0.9,
  },

  // Hidden instruction patterns
  {
    name: 'hidden_text',
    regex: /(?:invisible|hidden)\s+(?:instruction|text|message)/i,
    weight: 0.7,
  },
  {
    name: 'base64_payload',
    regex: /(?:decode|eval)\s*\(\s*(?:atob|base64)/i,
    weight: 0.8,
  },

  // Memory manipulation
  {
    name: 'memory_manipulation',
    regex: /(?:overwrite|replace|delete)\s+(?:all\s+)?(?:memories|context|data|profile)/i,
    weight: 0.7,
  },
];

/**
 * Analyzes text for prompt injection patterns.
 * Returns whether the content is suspicious and which patterns matched.
 */
export function detectPromptInjection(text: string): InjectionResult {
  const patterns: string[] = [];
  let maxWeight = 0;

  for (const { name, regex, weight } of INJECTION_PATTERNS) {
    regex.lastIndex = 0;
    if (regex.test(text)) {
      patterns.push(name);
      maxWeight = Math.max(maxWeight, weight);
    }
  }

  if (patterns.length === 0) {
    return { isSuspicious: false, patterns: [], suggestedConfidence: -1 };
  }

  // More patterns = more suspicious → lower confidence
  const patternPenalty = Math.min(patterns.length * 0.1, 0.3);
  const suggestedConfidence = Math.max(0.1, 0.3 - patternPenalty);

  return {
    isSuspicious: true,
    patterns,
    suggestedConfidence,
  };
}

/**
 * Quick check — returns true if text contains any injection patterns.
 */
export function containsInjection(text: string): boolean {
  for (const { regex } of INJECTION_PATTERNS) {
    regex.lastIndex = 0;
    if (regex.test(text)) {
      return true;
    }
  }
  return false;
}
