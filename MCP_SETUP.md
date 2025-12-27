# MCP Setup Instructions

## Quick Setup (Recommended)

1. **Authenticate via Web Interface:**
   - Visit `https://clio-mcp.th3-sh0p.com`
   - Click "Connect Clio" and complete the OAuth flow
   - You'll be redirected to the dashboard with your session information

2. **Get Your MCP Configuration:**
   - After authentication, visit the dashboard at `/dashboard`
   - Your session ID and MCP configuration will be displayed
   - Copy the configuration JSON shown on the dashboard

3. **Configure Your AI Client:**
   
   **For Cursor:**
   - Open the file: `~/.cursor/mcp.json` (or `%APPDATA%\Cursor\User\mcp.json` on Windows)
   - Copy the `mcpConfig` from the dashboard
   - Add it to the `mcpServers` object in your `mcp.json` file
   - If the file doesn't exist, create it with: `{}`
   - Save and restart Cursor
   
   **For Claude Desktop:**
   - Open the file: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - (On Windows: `%APPDATA%\Claude\claude_desktop_config.json`)
   - (On Linux: `~/.config/Claude/claude_desktop_config.json`)
   - Copy the `mcpConfig` from the dashboard
   - Add it to the `mcpServers` object in your config file
   - If the file doesn't exist, create it with: `{}`
   - Save and restart Claude Desktop
   
   **For Continue.dev:**
   - Open Continue Settings → MCP Servers
   - Copy the configuration from the dashboard
   - Add it to your Continue config
   - Save and restart Continue
   
   **For Other Clients:**
   - Copy the `mcpConfig` from the dashboard
   - Add to your client's MCP configuration file
   - Refer to your client's documentation for exact file location

4. **Restart Your AI Client:**
   - Quit and restart to load the new MCP configuration
   - The tools should now load successfully

## Session Management

- **Session ID**: Each authentication creates a unique session ID that's used in the MCP configuration URL
- **Auto-Refresh**: Sessions automatically extend their expiration when used (sliding expiration). As long as you're actively using the MCP tools, your session will stay valid without needing to update your config.
- **Session Expiration**: Sessions expire after 30 days of inactivity. If you use your MCP tools regularly, you won't need to update your configuration.
- **Creating New Sessions**: Use the "Create New Session" button on the dashboard to generate a fresh session
- **MCP URL Format**: `https://clio-mcp.th3-sh0p.com/api/mcp/sse?sessionId=YOUR_SESSION_ID`

## Available Tools

- **list_matters**: Fetches a list of legal matters from Clio
- **get_matter_details**: Retrieves full details for a specific matter by ID
- **Contactss**: Searches Clio contacts by name

## Troubleshooting

- If tools show "Loading tools", check that:
  - You've authenticated via the web interface
  - Your session ID is correct in the MCP config
  - The URL includes the `?sessionId=` parameter
  - Your AI client has been restarted after updating the config

- To get a new session:
  - Visit the dashboard and click "Create New Session"
  - Or visit `https://clio-mcp.th3-sh0p.com/api/auth/session` with POST method

- If your session expires (after 30 days of inactivity):
  - Re-authenticate via the web interface
  - Or create a new session from the dashboard
  - Note: Active sessions auto-refresh, so you typically won't need to do this if you use the tools regularly
