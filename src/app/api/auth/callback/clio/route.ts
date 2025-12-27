import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import { setClioToken } from '@/lib/cookies';
import { createSession } from '@/lib/sessions';
import { safeLog } from '@/lib/pii-redaction';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?error=${encodeURIComponent(error)}`
    );
  }

  // Verify state parameter
  const cookieStore = await cookies();
  const storedState = cookieStore.get('clio_oauth_state')?.value;
  
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?error=invalid_state`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?error=no_code`
    );
  }

  const clientId = process.env.CLIO_CLIENT_ID;
  const clientSecret = process.env.CLIO_CLIENT_SECRET;
  const baseUrl = process.env.CLIO_BASE_URL || 'https://app.clio.com/api/v4';
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback/clio`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?error=missing_credentials`
    );
  }

  try {
    // Exchange authorization code for access token
    // Clio OAuth expects form-encoded data, not JSON
    const tokenUrl = `${baseUrl.replace('/api/v4', '')}/oauth/token`;
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const tokenResponse = await axios.post(
      tokenUrl,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    if (!accessToken) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?error=no_token`
      );
    }

    // Store the encrypted token in cookie
    await setClioToken(accessToken);

    // Create session for MCP
    const sessionId = await createSession();

    // Store session ID in cookie for dashboard access
    const cookieStore = await cookies();
    cookieStore.set('mcp_session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    // Redirect to dashboard
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`
    );
    response.cookies.delete('clio_oauth_state');

    return response;
  } catch (error) {
    safeLog('error', 'Token exchange error', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    // Log more details for debugging (redacted)
    if (axios.isAxiosError(error)) {
      safeLog('error', 'Token exchange error details', {
        status: error.response?.status,
        url: error.config?.url,
        hasResponseData: !!error.response?.data,
      });
    }
    
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?error=token_exchange_failed`
    );
  }
}

