import { NextResponse } from 'next/server';
import { getOrCreateSessionFromCookie, createSession, getSession } from '@/lib/sessions';

export async function GET(request: Request) {
  try {
    const sessionId = await getOrCreateSessionFromCookie();
    
    // Get session info
    const session = getSession(sessionId);
    const expiresAt = session ? new Date(session.expiresAt).toISOString() : null;
    const createdAt = session ? new Date(session.createdAt).toISOString() : new Date().toISOString();
    
    // Build MCP URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const mcpUrl = `${baseUrl}/api/mcp/sse?sessionId=${sessionId}`;
    
    return NextResponse.json({
      sessionId: sessionId,
      expiresAt: expiresAt,
      createdAt: createdAt,
      mcpUrl: mcpUrl,
      mcpConfig: {
        mcpServers: {
          'clio-agent-bridge': {
            url: mcpUrl,
            transport: 'sse',
          },
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create session',
        hint: `Please authenticate via ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'} first`
      },
      { status: 401 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Force create a new session
    const sessionId = await createSession();
    const session = getSession(sessionId);
    const expiresAt = session ? new Date(session.expiresAt).toISOString() : null;
    const createdAt = new Date().toISOString();
    
    // Build MCP URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const mcpUrl = `${baseUrl}/api/mcp/sse?sessionId=${sessionId}`;
    
    return NextResponse.json({
      sessionId: sessionId,
      message: 'New session created.',
      expiresAt: expiresAt,
      createdAt: createdAt,
      mcpUrl: mcpUrl,
      mcpConfig: {
        mcpServers: {
          'clio-agent-bridge': {
            url: mcpUrl,
            transport: 'sse',
          },
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to create session',
        hint: `Please authenticate via ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'} first`
      },
      { status: 401 }
    );
  }
}

