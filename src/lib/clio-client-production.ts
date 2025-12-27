import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getClioToken } from './cookies';
import { getSessionToken } from './sessions';
import { redactPII, safeLog } from './pii-redaction';
import { MockClioClient } from './clio-client-mock';

interface RateLimitState {
  remaining: number;
  resetAt: number;
}

/**
 * Production-ready Clio API client with:
 * - Rate limiting awareness
 * - Automatic retries with exponential backoff
 * - 401/429 error handling
 * - Request/response logging (with PII redaction)
 * - Mock mode support for local testing
 */
export class ClioClient {
  private axiosInstance: AxiosInstance;
  private rateLimitState: RateLimitState = {
    remaining: 1000, // Conservative default
    resetAt: Date.now() + 60000, // 1 minute default
  };
  private readonly maxRetries = 3;
  private readonly baseRetryDelay = 1000; // 1 second

  constructor(token: string) {
    const baseUrl = process.env.CLIO_BASE_URL || 'https://app.clio.com/api/v4';

    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor: Log requests (with PII redaction)
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const startTime = Date.now();
        (config as any).__startTime = startTime;
        
        // Log request (redact sensitive data)
        const logData = {
          method: config.method?.toUpperCase(),
          url: redactPII(config.url || ''),
          params: config.params ? redactPII(JSON.stringify(config.params)) : undefined,
        };
        safeLog('info', `[ClioClient] Request: ${logData.method} ${logData.url}`, logData.params ? { params: logData.params } : undefined);
        
        return config;
      },
      (error) => {
        safeLog('error', '[ClioClient] Request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor: Handle rate limits, log responses, track timing
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const config = response.config as InternalAxiosRequestConfig & { __startTime?: number };
        const duration = config.__startTime ? Date.now() - config.__startTime : 0;
        
        // Extract rate limit headers
        const remaining = response.headers['x-ratelimit-remaining'];
        const resetAt = response.headers['x-ratelimit-reset'];
        
        if (remaining !== undefined) {
          this.rateLimitState.remaining = parseInt(remaining, 10);
        }
        if (resetAt !== undefined) {
          this.rateLimitState.resetAt = parseInt(resetAt, 10) * 1000; // Convert to milliseconds
        }

        // Log response (redact PII)
        const logData = {
          status: response.status,
          duration: `${duration}ms`,
          rateLimitRemaining: this.rateLimitState.remaining,
          url: redactPII(response.config.url || ''),
        };
        safeLog('info', `[ClioClient] Response: ${logData.status} ${logData.url}`, {
          duration: logData.duration,
          rateLimitRemaining: logData.rateLimitRemaining,
        });
        
        return response;
      },
      async (error: AxiosError) => {
        const config = error.config as InternalAxiosRequestConfig & { __startTime?: number; __retryCount?: number };
        const duration = config.__startTime ? Date.now() - config.__startTime : 0;
        const retryCount = config.__retryCount || 0;

        // Log error (redact PII)
        const logData = {
          status: error.response?.status,
          statusText: error.response?.statusText,
          duration: `${duration}ms`,
          retryCount,
          url: redactPII(error.config?.url || ''),
        };
        safeLog('error', `[ClioClient] Error: ${logData.status} ${logData.statusText}`, {
          url: logData.url,
          duration: logData.duration,
          retryCount: logData.retryCount,
        });

        // Handle 401 Unauthorized
        if (error.response?.status === 401) {
          safeLog('error', '[ClioClient] 401 Unauthorized - Token may be expired or invalid');
          return Promise.reject(new Error('Authentication failed. Please re-authenticate via the web interface.'));
        }

        // Handle 429 Rate Limit
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : this.calculateBackoffDelay(retryCount);
          
          if (retryCount < this.maxRetries) {
            safeLog('warn', `[ClioClient] Rate limited. Retrying after ${waitTime}ms`, {
              attempt: retryCount + 1,
              maxRetries: this.maxRetries,
            });
            await this.sleep(waitTime);
            
            // Retry the request
            config.__retryCount = retryCount + 1;
            return this.axiosInstance.request(config);
          } else {
            return Promise.reject(new Error('Rate limit exceeded. Please try again later.'));
          }
        }

        // Handle 5xx server errors with retry
        if (error.response?.status && error.response.status >= 500 && retryCount < this.maxRetries) {
          const waitTime = this.calculateBackoffDelay(retryCount);
          safeLog('warn', `[ClioClient] Server error ${error.response.status}. Retrying`, {
            waitTime: `${waitTime}ms`,
            attempt: retryCount + 1,
            maxRetries: this.maxRetries,
          });
          await this.sleep(waitTime);
          
          config.__retryCount = retryCount + 1;
          return this.axiosInstance.request(config);
        }

        return Promise.reject(error);
      }
    );
  }

  private calculateBackoffDelay(retryCount: number): number {
    // Exponential backoff: 1s, 2s, 4s
    return this.baseRetryDelay * Math.pow(2, retryCount);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  /**
   * Get the underlying axios instance
   */
  getInstance(): AxiosInstance {
    return this.axiosInstance;
  }

  /**
   * Get current rate limit state
   */
  getRateLimitState(): RateLimitState {
    return { ...this.rateLimitState };
  }
}

/**
 * Factory function to create a ClioClient instance
 * Handles token retrieval from various sources (session, cookie, etc.)
 * Supports mock mode via USE_MOCK_DATA environment variable
 */
export async function createClioClient(request?: Request): Promise<ClioClient | MockClioClient> {
  // Check if mock mode is enabled
  if (process.env.USE_MOCK_DATA === 'true') {
    safeLog('info', '[ClioClient] Using mock data mode');
    const mockDataDir = process.env.MOCK_DATA_DIR;
    const delayMs = process.env.MOCK_DELAY_MS ? parseInt(process.env.MOCK_DELAY_MS, 10) : 200;
    return new MockClioClient(mockDataDir, delayMs);
  }

  let token: string | null = null;
  
  // Priority 1: Try to get token from session ID (for MCP clients)
  if (request) {
    const url = new URL(request.url);
    const sessionIdFromQuery = url.searchParams.get('sessionId');
    if (sessionIdFromQuery) {
      token = getSessionToken(sessionIdFromQuery);
    }
    
    if (!token) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader) {
        if (authHeader.startsWith('Bearer session:')) {
          const sessionId = authHeader.substring(15);
          token = getSessionToken(sessionId);
        } else if (authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }
    }
    
    if (!token) {
      const sessionId = request.headers.get('X-MCP-Session-ID');
      if (sessionId) {
        token = getSessionToken(sessionId);
      }
    }
  }
  
  // Priority 2: Fall back to cookie-based token (for web interface)
  if (!token) {
    token = await getClioToken();
  }
  
  if (!token) {
    throw new Error('Clio token not found. Please authenticate first via https://clio-mcp.th3-sh0p.com and get a session ID from /api/auth/session');
  }

  return new ClioClient(token);
}

