Thank you for reaching out. 

I built a Model Context Protocol (MCP) server integration with Clio's API v4. The project is a Next.js application deployed on Vercel that acts as a bridge between AI assistants (like ChatGPT) and Clio's legal practice management system.

**What it does:**
- Provides OAuth authentication with Clio
- Exposes three MCP tools for AI agents:
  1. **Matter Intelligence Brief** - Aggregates matter details, recent file notes, and upcoming calendar entries into structured briefs
  2. **Ethical Conflict Check** - Searches contacts and matters simultaneously to identify potential conflicts, including matches in custom fields (e.g., opposing counsel)
  3. **Audit Unbilled Activities** - Reviews unbilled time entries and flags vague descriptions that might be rejected by insurance

**Technical details:**
- Built with Next.js, TypeScript, and the Model Context Protocol SDK
- Uses session-based authentication with automatic token refresh
- Includes production features like rate limiting (10 req/min), PII redaction in logs, and comprehensive error handling
- Provides a web interface for OAuth flow and session management

**Current status:**
This was a personal project I created on a whim to experiment with MCP and Clio's API. I don't have plans to continue active development on it at this time. The codebase is available if you'd like to review it, but it's essentially a proof-of-concept rather than a production-ready integration.

If you have any questions about the implementation or would like to discuss Clio's integration policies, I'm happy to help.

