import axios, { AxiosInstance } from 'axios';
import { getClioToken } from './cookies';
import { getSessionToken } from './sessions';

export async function getClioClient(request?: Request): Promise<AxiosInstance> {
  let token: string | null = null;
  let tokenSource = 'none';
  
  // Priority 1: Try to get token from session ID (for MCP clients)
  if (request) {
    // Check for session ID in query parameter (easiest for MCP config)
    const url = new URL(request.url);
    const sessionIdFromQuery = url.searchParams.get('sessionId');
    if (sessionIdFromQuery) {
      console.log(`[ClioClient] Found sessionId in query: ${sessionIdFromQuery.substring(0, 8)}...`);
      token = getSessionToken(sessionIdFromQuery);
      if (token) {
        tokenSource = 'session_query';
        console.log(`[ClioClient] Token retrieved from session query param`);
      } else {
        console.error(`[ClioClient] Session ID found but token not found in store`);
      }
    }
    
    // Check for session ID in Authorization header: "Bearer session:<sessionId>"
    if (!token) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader) {
        if (authHeader.startsWith('Bearer session:')) {
          const sessionId = authHeader.substring(15); // "Bearer session:".length
          console.log(`[ClioClient] Found sessionId in Authorization header: ${sessionId.substring(0, 8)}...`);
          token = getSessionToken(sessionId);
          if (token) {
            tokenSource = 'session_header';
            console.log(`[ClioClient] Token retrieved from Authorization header`);
          }
        } else if (authHeader.startsWith('Bearer ')) {
          // Direct token
          token = authHeader.substring(7);
          tokenSource = 'direct_token';
          console.log(`[ClioClient] Using direct token from Authorization header`);
        }
      }
    }
    
    // Also check for session ID in X-MCP-Session-ID header
    if (!token) {
      const sessionId = request.headers.get('X-MCP-Session-ID');
      if (sessionId) {
        console.log(`[ClioClient] Found sessionId in X-MCP-Session-ID header: ${sessionId.substring(0, 8)}...`);
        token = getSessionToken(sessionId);
        if (token) {
          tokenSource = 'session_header_x';
          console.log(`[ClioClient] Token retrieved from X-MCP-Session-ID header`);
        }
      }
    }
  }
  
  // Priority 2: Fall back to cookie-based token (for web interface)
  if (!token) {
    token = await getClioToken();
    if (token) {
      tokenSource = 'cookie';
      console.log(`[ClioClient] Token retrieved from cookie`);
    }
  }
  
  if (!token) {
    console.error(`[ClioClient] No token found. Request URL: ${request?.url}`);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    throw new Error(`Clio token not found. Please authenticate first via ${appUrl} and get a session ID from /api/auth/session`);
  }
  
  console.log(`[ClioClient] Using token from source: ${tokenSource}, token length: ${token.length}`);

  const baseUrl = process.env.CLIO_BASE_URL || 'https://app.clio.com/api/v4';

  // Create a new instance for each request in serverless environment
  return axios.create({
    baseURL: baseUrl,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

