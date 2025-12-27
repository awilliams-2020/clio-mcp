import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.CLIO_CLIENT_ID;
  const baseUrl = process.env.CLIO_BASE_URL || 'https://app.clio.com/api/v4';
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback/clio`;

  if (!clientId) {
    return NextResponse.json(
      { error: 'CLIO_CLIENT_ID is not configured' },
      { status: 500 }
    );
  }

  // Generate a state parameter for CSRF protection
  const state = Buffer.from(crypto.randomUUID()).toString('base64url');
  
  // Store state in a cookie for verification in callback
  const response = NextResponse.redirect(
    `${baseUrl.replace('/api/v4', '')}/oauth/authorize?` +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'all',
      state: state,
    }).toString()
  );

  // Store state in httpOnly cookie
  response.cookies.set('clio_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  return response;
}

