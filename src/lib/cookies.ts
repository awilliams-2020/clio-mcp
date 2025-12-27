import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secretKey = process.env.COOKIE_SECRET || 'default-secret-key-change-in-production';
const encodedKey = new TextEncoder().encode(secretKey);

export async function encryptToken(token: string): Promise<string> {
  return await new SignJWT({ token })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(encodedKey);
}

export async function decryptToken(encryptedToken: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(encryptedToken, encodedKey);
    return (payload.token as string) || null;
  } catch {
    return null;
  }
}

export async function setClioToken(token: string): Promise<void> {
  const encryptedToken = await encryptToken(token);
  const cookieStore = await cookies();
  cookieStore.set('clio_token', encryptedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
}

export async function getClioToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const encryptedToken = cookieStore.get('clio_token')?.value;
  if (!encryptedToken) return null;
  return await decryptToken(encryptedToken);
}

export async function deleteClioToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('clio_token');
}

