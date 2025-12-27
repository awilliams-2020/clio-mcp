'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MCPConfigDisplay from '@/components/MCPConfigDisplay';

interface SessionData {
  sessionId: string;
  expiresAt: string;
  createdAt: string;
  mcpUrl: string;
  mcpConfig: {
    mcpServers: {
      'clio-agent-bridge': {
        url: string;
        transport: 'sse';
      };
    };
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSessionData();
  }, []);

  const fetchSessionData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/session');
      
      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated, redirect to home
          router.push('/?error=not_authenticated');
          return;
        }
        throw new Error('Failed to fetch session data');
      }

      const data = await response.json();
      setSessionData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session data');
    } finally {
      setLoading(false);
    }
  };

  const createNewSession = async () => {
    try {
      const response = await fetch('/api/auth/session', { method: 'POST' });
      
      if (!response.ok) {
        throw new Error('Failed to create new session');
      }

      const data = await response.json();
      setSessionData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create new session');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (error && !sessionData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 mb-4">{error}</div>
          <a
            href="/api/auth/clio"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Connect Clio
          </a>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="text-center">
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            No session found. Please authenticate first.
          </p>
          <a
            href="/api/auth/clio"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Connect Clio
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black dark:text-zinc-50 mb-2">
            Clio MCP Dashboard
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Manage your Clio MCP connection
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
              Connection Status
            </h2>
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-full text-sm font-medium">
              Connected
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-zinc-600 dark:text-zinc-400">Session ID:</span>
              <code className="ml-2 text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                {sessionData.sessionId.substring(0, 16)}...
              </code>
            </div>
            <div>
              <span className="text-zinc-600 dark:text-zinc-400">Created:</span>
              <span className="ml-2 text-black dark:text-zinc-50">
                {new Date(sessionData.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* MCP Configuration Display */}
        <div className="mb-6">
          <MCPConfigDisplay sessionId={sessionData.sessionId} mcpConfig={sessionData.mcpConfig} />
        </div>

        {/* Actions */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-xl font-semibold mb-4 text-black dark:text-zinc-50">
            Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={createNewSession}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Create New Session
            </button>
            <a
              href="/api/auth/clio"
              className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-black dark:text-zinc-50 rounded-lg font-medium transition-colors inline-block"
            >
              Re-authenticate Clio
            </a>
            <a
              href="/"
              className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 rounded-lg font-medium transition-colors inline-block"
            >
              Back to Home
            </a>
          </div>
        </div>

        {/* API Info */}
        <div className="mt-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
          <h3 className="text-sm font-semibold mb-2 text-black dark:text-zinc-50">
            MCP Endpoint
          </h3>
          <div className="space-y-2 text-xs font-mono text-zinc-600 dark:text-zinc-400">
            <div>
              <span className="text-zinc-500">MCP Server URL:</span>{' '}
              <code className="text-blue-600 dark:text-blue-400 break-all">
                {sessionData.mcpUrl}
              </code>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

