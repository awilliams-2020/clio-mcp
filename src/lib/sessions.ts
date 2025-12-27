import { getClioToken } from './cookies';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { safeLog } from './pii-redaction';

// In-memory session store (in production, use Redis or a database)
const sessionStore = new Map<string, { token: string; expiresAt: number; createdAt: number }>();

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessionStore.entries()) {
    if (session.expiresAt < now) {
      sessionStore.delete(sessionId);
    }
  }
}, 60 * 60 * 1000); // Clean up every hour

export async function createSession(): Promise<string> {
  const token = await getClioToken();
  
  if (!token) {
    throw new Error('Not authenticated. Please authenticate via the web interface first.');
  }

  // Generate a secure session ID
  const sessionId = randomBytes(32).toString('hex');
  
  // Store session with 30-day expiration
  const now = Date.now();
  sessionStore.set(sessionId, {
    token,
    expiresAt: now + 30 * 24 * 60 * 60 * 1000, // 30 days
    createdAt: now,
  });

  return sessionId;
}

export function getSessionToken(sessionId: string, autoRefresh: boolean = true): string | null {
  const session = sessionStore.get(sessionId);
  
  if (!session) {
    return null;
  }

  // Check if session expired
  if (session.expiresAt < Date.now()) {
    sessionStore.delete(sessionId);
    return null;
  }

  // Auto-refresh: extend expiration when session is used (sliding expiration)
  // This ensures active users never have to update their config
  if (autoRefresh) {
    const now = Date.now();
    const timeUntilExpiry = session.expiresAt - now;
    const refreshThreshold = 7 * 24 * 60 * 60 * 1000; // Refresh if less than 7 days left
    
    if (timeUntilExpiry < refreshThreshold) {
      // Extend session by 30 days from now
      session.expiresAt = now + 30 * 24 * 60 * 60 * 1000;
      sessionStore.set(sessionId, session);
      safeLog('info', '[Sessions] Auto-refreshed session', {
        sessionIdPrefix: sessionId.substring(0, 8),
        newExpiry: new Date(session.expiresAt).toISOString(),
      });
    }
  }

  return session.token;
}

export function deleteSession(sessionId: string): void {
  sessionStore.delete(sessionId);
}

export function getSession(sessionId: string): { token: string; expiresAt: number; createdAt: number } | null {
  return sessionStore.get(sessionId) || null;
}

export async function getOrCreateSessionFromCookie(): Promise<string> {
  // Try to get existing session from cookie
  const cookieStore = await cookies();
  const existingSessionId = cookieStore.get('mcp_session_id')?.value;
  
  if (existingSessionId && getSessionToken(existingSessionId)) {
    return existingSessionId;
  }

  // Create new session
  const sessionId = await createSession();
  
  // Store session ID in cookie
  cookieStore.set('mcp_session_id', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });

  return sessionId;
}

