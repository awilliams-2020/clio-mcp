import { NextResponse } from 'next/server';
import { getClioToken } from '@/lib/cookies';

export async function GET() {
  try {
    const token = await getClioToken();
    
    if (!token) {
      return NextResponse.json(
        { error: `Not authenticated. Please visit ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'} to authenticate first.` },
        { status: 401 }
      );
    }

    // Return the token (in production, you might want to return a shorter-lived API key)
    return NextResponse.json({
      token: token,
      message: 'Use this token in the Authorization header: Bearer <token>',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve token' },
      { status: 500 }
    );
  }
}

