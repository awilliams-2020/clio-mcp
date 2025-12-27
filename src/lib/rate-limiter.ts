/**
 * Rate limiter for API routes
 * Uses in-memory store (for Vercel serverless, consider Redis for production scale)
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (cleans up expired entries periodically)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Get a unique identifier for the request
 * Uses session ID from query param, Authorization header, or IP address
 */
function getRequestIdentifier(request: Request): string {
  // Try to get session ID from query parameter
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');
  if (sessionId) {
    return `session:${sessionId}`;
  }

  // Try to get session ID from Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    if (authHeader.startsWith('Bearer session:')) {
      const sessionIdFromHeader = authHeader.substring(15);
      return `session:${sessionIdFromHeader}`;
    }
  }

  // Fall back to IP address (for Vercel, check x-forwarded-for header)
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  return `ip:${ip}`;
}

/**
 * Check if request should be rate limited
 * @param request - The incoming request
 * @param maxRequests - Maximum requests allowed (default: 10)
 * @param windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @returns Object with allowed status and rate limit headers
 */
export function checkRateLimit(
  request: Request,
  maxRequests: number = 10,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetAt: number; headers: Record<string, string> } {
  const identifier = getRequestIdentifier(request);
  const now = Date.now();
  
  let entry = rateLimitStore.get(identifier);
  
  // Create new entry or reset if expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + windowMs,
    };
  }
  
  // Increment count
  entry.count++;
  rateLimitStore.set(identifier, entry);
  
  const remaining = Math.max(0, maxRequests - entry.count);
  const allowed = entry.count <= maxRequests;
  
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(maxRequests),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
  };
  
  if (!allowed) {
    headers['Retry-After'] = String(Math.ceil((entry.resetAt - now) / 1000));
  }
  
  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
    headers,
  };
}

