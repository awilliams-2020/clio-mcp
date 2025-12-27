'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function HomeContent() {
  const searchParams = useSearchParams();
  
  const success = searchParams.get('success');
  const error = searchParams.get('error');
  
  const status = (() => {
    if (success === 'true') {
      return { type: 'success' as const, message: 'Successfully connected to Clio!' };
    }
    if (error) {
      const errorMessages: Record<string, string> = {
        invalid_state: 'Invalid state parameter. Please try again.',
        no_code: 'No authorization code received.',
        missing_credentials: 'Missing Clio credentials. Please check your configuration.',
        no_token: 'Failed to retrieve access token.',
        token_exchange_failed: 'Token exchange failed. Please try again.',
      };
      return {
        type: 'error' as const,
        message: errorMessages[error] || 'An error occurred during authentication.',
      };
    }
    return null;
  })();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black">
        <div className="flex flex-col items-center gap-8 text-center">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50">
            Clio MCP Integration
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Connect your Clio account to get started with the Model Context Protocol integration.
          </p>

          {status && (
            <div
              className={`w-full max-w-md rounded-lg px-4 py-3 ${
                status.type === 'success'
                  ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              }`}
            >
              {status.message}
            </div>
          )}

          {!success && (
            <a
              href="/api/auth/clio"
              className="flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-full bg-blue-600 px-6 text-white font-medium transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Connect Clio
            </a>
          )}

          {/* Show dashboard link if authenticated */}
          {success === 'true' && (
            <div className="mt-8 w-full max-w-md">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                View your session and MCP configuration:
              </p>
              <a
                href="/dashboard"
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Go to Dashboard
              </a>
            </div>
          )}

          {/* Dashboard link for authenticated users */}
          {success !== 'true' && (
            <div className="mt-4">
              <a
                href="/dashboard"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Already connected? View Dashboard →
              </a>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
