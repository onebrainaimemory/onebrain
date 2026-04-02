/**
 * Sensitive data filter for API response content.
 *
 * Detects and redacts secrets, API keys, tokens, and PII patterns
 * in text that will be returned to AI agents or external clients.
 * Prevents accidental credential leakage via context prompts.
 */

interface FilterMatch {
  pattern: string;
  index: number;
  length: number;
}

interface FilterResult {
  text: string;
  filtered: boolean;
  matches: FilterMatch[];
}

/**
 * Patterns that indicate sensitive data in text content.
 * Each pattern has a name and regex.
 */
const SENSITIVE_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  // OneBrain API keys: ob_<prefix>_<secret>
  { name: 'onebrain_api_key', regex: /\bob_[a-f0-9]{10,}_[a-f0-9]{20,}\b/gi },

  // Generic API keys / tokens (common formats)
  {
    name: 'api_key_param',
    regex: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[=:]\s*["']?[A-Za-z0-9_\-/.]{20,}["']?/gi,
  },

  // Bearer / JWT tokens
  { name: 'bearer_token', regex: /Bearer\s+[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
  {
    name: 'jwt_token',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },

  // AWS keys
  { name: 'aws_access_key', regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  {
    name: 'aws_secret_key',
    regex: /(?:aws[_-]?secret[_-]?access[_-]?key)\s*[=:]\s*["']?[A-Za-z0-9/+=]{40}["']?/gi,
  },

  // Private keys (PEM format)
  {
    name: 'private_key',
    regex:
      /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
  },

  // Stripe keys
  { name: 'stripe_key', regex: /\b(?:sk|pk|rk)_(?:test|live)_[A-Za-z0-9]{20,}\b/g },

  // GitHub tokens
  { name: 'github_token', regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g },

  // OpenAI keys
  { name: 'openai_key', regex: /\bsk-[A-Za-z0-9]{20,}\b/g },

  // Credit card numbers (basic Luhn-like patterns)
  {
    name: 'credit_card',
    regex:
      /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
  },

  // Passwords in assignments
  { name: 'password_assignment', regex: /(?:password|passwd|pwd)\s*[=:]\s*["'][^"'\s]{4,}["']/gi },

  // Connection strings with credentials
  {
    name: 'connection_string',
    regex: /(?:postgres|mysql|mongodb|redis):\/\/[^@\s]+:[^@\s]+@[^\s]+/gi,
  },

  // Generic secret assignments
  {
    name: 'secret_assignment',
    regex: /(?:secret|token|credential)\s*[=:]\s*["'][A-Za-z0-9_\-/.+=]{16,}["']/gi,
  },
];

/**
 * Scans text for sensitive data patterns.
 * Returns matches found without modifying the text.
 */
export function detectSensitiveData(text: string): FilterMatch[] {
  const matches: FilterMatch[] = [];

  for (const { name, regex } of SENSITIVE_PATTERNS) {
    // Reset lastIndex for global regexes
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        pattern: name,
        index: match.index,
        length: match[0].length,
      });
    }
  }

  return matches;
}

/**
 * Redacts sensitive data from text, replacing matches with [REDACTED].
 * Returns the filtered text and metadata about what was found.
 */
export function filterSensitiveData(text: string): FilterResult {
  const matches = detectSensitiveData(text);

  if (matches.length === 0) {
    return { text, filtered: false, matches: [] };
  }

  // Sort matches by index descending so replacements don't shift positions
  const sorted = [...matches].sort((a, b) => b.index - a.index);

  let filtered = text;
  for (const match of sorted) {
    const before = filtered.slice(0, match.index);
    const after = filtered.slice(match.index + match.length);
    filtered = `${before}[REDACTED]${after}`;
  }

  return { text: filtered, filtered: true, matches };
}

/**
 * Checks if a single string value contains sensitive data.
 * Lightweight check — returns true/false without redaction.
 */
export function containsSensitiveData(text: string): boolean {
  for (const { regex } of SENSITIVE_PATTERNS) {
    regex.lastIndex = 0;
    if (regex.test(text)) {
      return true;
    }
  }
  return false;
}
