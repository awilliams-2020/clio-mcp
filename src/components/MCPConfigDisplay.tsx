'use client';

import { useState } from 'react';

interface MCPConfigDisplayProps {
  sessionId: string;
  mcpConfig: {
    mcpServers: {
      'clio-agent-bridge': {
        url: string;
        transport: 'sse';
      };
    };
  };
}

const CLIENT_INSTRUCTIONS = {
  cursor: {
    name: 'Cursor',
    steps: [
      'Open the file: ~/.cursor/mcp.json',
      '(On Windows: %APPDATA%\\Cursor\\User\\mcp.json)',
      'Copy the configuration shown below',
      'Add it to the mcpServers object',
      'Save the file and restart Cursor',
    ],
    icon: '🎯',
  },
  claude: {
    name: 'Claude Desktop',
    steps: [
      'Open the file: ~/Library/Application Support/Claude/claude_desktop_config.json',
      '(On Windows: %APPDATA%\\Claude\\claude_desktop_config.json)',
      'Copy the configuration shown below',
      'Add it to the mcpServers object',
      'Save the file and restart Claude Desktop',
    ],
    icon: '🤖',
  },
  chatgpt: {
    name: 'ChatGPT',
    steps: [
      'Note: ChatGPT MCP support may vary',
      'Check ChatGPT settings for MCP configuration',
      'If supported, use the configuration below',
      'Add to your ChatGPT MCP settings',
      'Restart if needed',
    ],
    icon: '💬',
  },
  continue: {
    name: 'Continue.dev',
    steps: [
      'Open Continue Settings',
      'Go to MCP Servers configuration',
      'Copy the configuration shown below',
      'Add it to your Continue config',
      'Save and restart Continue',
    ],
    icon: '⚡',
  },
  generic: {
    name: 'Other MCP Client',
    steps: [
      'Open your MCP client settings',
      'Add new MCP server',
      'Use the configuration below',
      'Save and restart your client',
    ],
    icon: '🔧',
  },
};

export default function MCPConfigDisplay({ sessionId, mcpConfig }: MCPConfigDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>('cursor');
  const [showConfig, setShowConfig] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Client-side error, safe to log (no PII in clipboard operations)
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to copy:', err);
      }
    }
  };

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* Session ID */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
        <h2 className="text-lg font-semibold mb-2 text-black dark:text-zinc-50">
          Your Session ID
        </h2>
        <div className="flex items-center gap-3">
          <code className="flex-1 bg-white dark:bg-zinc-900 px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm font-mono text-black dark:text-zinc-50 break-all">
            {sessionId}
          </code>
          <button
            onClick={() => copyToClipboard(sessionId)}
            className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
          >
            {copied ? '✓ Copied!' : 'Copy ID'}
          </button>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-3">
          Use this session ID in your MCP configuration. Sessions auto-refresh when used, so you won't need to update your config as long as you're actively using it.
        </p>
      </div>

      {/* Client Selection */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-black dark:text-zinc-50">
          Choose Your AI Client
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(CLIENT_INSTRUCTIONS).map(([key, client]) => (
            <button
              key={key}
              onClick={() => setSelectedClient(key)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                selectedClient === key
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600'
              }`}
            >
              <div className="text-2xl mb-2">{client.icon}</div>
              <div className="font-medium text-black dark:text-zinc-50">{client.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-6 border border-zinc-200 dark:border-zinc-800">
        <h3 className="text-lg font-semibold mb-4 text-black dark:text-zinc-50">
          Setup Instructions for {CLIENT_INSTRUCTIONS[selectedClient as keyof typeof CLIENT_INSTRUCTIONS].name}
        </h3>
        <ol className="space-y-2">
          {CLIENT_INSTRUCTIONS[selectedClient as keyof typeof CLIENT_INSTRUCTIONS].steps.map((step, index) => (
            <li key={index} className="flex items-start gap-3 text-zinc-700 dark:text-zinc-300">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {(selectedClient === 'cursor' || selectedClient === 'claude') && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
              <strong>File Location:</strong>
            </p>
            {selectedClient === 'cursor' && (
              <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1 ml-4 list-disc">
                <li>macOS/Linux: <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">~/.cursor/mcp.json</code></li>
                <li>Windows: <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">%APPDATA%\Cursor\User\mcp.json</code></li>
              </ul>
            )}
            {selectedClient === 'claude' && (
              <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1 ml-4 list-disc">
                <li>macOS: <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code></li>
                <li>Windows: <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">%APPDATA%\Claude\claude_desktop_config.json</code></li>
                <li>Linux: <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">~/.config/Claude/claude_desktop_config.json</code></li>
              </ul>
            )}
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">
              If the file doesn't exist, create it with: <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">{"{}"}</code>
            </p>
          </div>
        )}
      </div>

      {/* MCP Configuration */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-black dark:text-zinc-50">
            MCP Configuration
          </h3>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showConfig ? 'Hide' : 'Show'} Full Config
          </button>
        </div>
        
        {/* Show config prominently for clients that need manual file editing */}
        {(selectedClient === 'cursor' || selectedClient === 'claude' || selectedClient === 'continue') && !showConfig && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
              <strong>Copy the configuration below</strong> and add it to your configuration file:
            </p>
            <div className="bg-zinc-900 rounded p-3 overflow-x-auto mb-3">
              <pre className="text-xs text-zinc-100">
                <code>{JSON.stringify(mcpConfig, null, 2)}</code>
              </pre>
            </div>
            <button
              onClick={() => copyToClipboard(JSON.stringify(mcpConfig, null, 2))}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded font-medium"
            >
              Copy Configuration
            </button>
          </div>
        )}
        
        {showConfig && (
          <div className="bg-zinc-900 rounded-lg p-4 overflow-x-auto">
            <pre className="text-xs text-zinc-100">
              <code>{JSON.stringify(mcpConfig, null, 2)}</code>
            </pre>
            <button
              onClick={() => copyToClipboard(JSON.stringify(mcpConfig, null, 2))}
              className="mt-3 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded"
            >
              Copy Config
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

