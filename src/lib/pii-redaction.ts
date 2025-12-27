/**
 * PII (Personally Identifiable Information) redaction utilities
 * Used for safe logging of sensitive data
 */

/**
 * Redact PII from a string
 */
export function redactPII(text: string): string {
  if (!text) return text;
  
  let redacted = text;
  
  // Redact email addresses
  redacted = redacted.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi, '[EMAIL_REDACTED]');
  
  // Redact phone numbers (various formats)
  redacted = redacted.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]');
  redacted = redacted.replace(/\b\(\d{3}\)\s?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]');
  redacted = redacted.replace(/\b\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE_REDACTED]');
  
  // Redact SSN patterns
  redacted = redacted.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_REDACTED]');
  redacted = redacted.replace(/\b\d{9}\b/g, (match) => {
    // Only redact if it looks like an SSN (starts with valid SSN prefix)
    if (/^(?!000|666|9)\d{3}/.test(match)) {
      return '[SSN_REDACTED]';
    }
    return match;
  });
  
  // Redact credit card patterns
  redacted = redacted.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD_REDACTED]');
  redacted = redacted.replace(/\b\d{13,19}\b/g, (match) => {
    // Only redact if it's a valid credit card length
    if (match.length >= 13 && match.length <= 19) {
      return '[CARD_REDACTED]';
    }
    return match;
  });
  
  // Redact common name patterns in structured data (e.g., "firstName": "John")
  redacted = redacted.replace(/"(?:first|last|full|given|family|middle)?name"\s*:\s*"[^"]+"/gi, '"$1name": "[NAME_REDACTED]"');
  
  // Redact addresses (basic pattern)
  redacted = redacted.replace(/\b\d+\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Place|Pl)[^"]*/gi, '[ADDRESS_REDACTED]');
  
  return redacted;
}

/**
 * Redact PII from an object recursively
 */
export function redactPIIFromObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return redactPII(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactPIIFromObject(item));
  }
  
  if (typeof obj === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip redacting certain keys that are safe to log
      const safeKeys = ['id', 'type', 'status', 'created_at', 'updated_at', 'meta', 'paging'];
      if (safeKeys.includes(key.toLowerCase())) {
        redacted[key] = value;
      } else {
        redacted[key] = redactPIIFromObject(value);
      }
    }
    return redacted;
  }
  
  return obj;
}

/**
 * Safe logger that automatically redacts PII
 */
export function safeLog(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const redactedData = data ? redactPIIFromObject(data) : undefined;
  
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${redactPII(message)}`;
  
  if (redactedData) {
    console[level](logMessage, JSON.stringify(redactedData, null, 2));
  } else {
    console[level](logMessage);
  }
}

