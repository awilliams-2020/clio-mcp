# Production Deployment Guide

This guide provides step-by-step instructions for deploying the Clio MCP server to Vercel and configuring Clio OAuth.

## Prerequisites

- Vercel account
- Clio Developer account
- Clio OAuth application credentials

## Step 1: Deploy to Vercel

### 1.1 Connect Your Repository

1. Push your code to GitHub, GitLab, or Bitbucket
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "Add New Project"
4. Import your repository
5. Configure project settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (or leave default)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next` (default)

### 1.2 Configure Environment Variables

In Vercel project settings, add the following environment variables:

```
CLIO_CLIENT_ID=your_clio_client_id
CLIO_CLIENT_SECRET=your_clio_client_secret
CLIO_BASE_URL=https://app.clio.com/api/v4
COOKIE_SECRET=your_secure_random_string_min_32_chars
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

**Important**: 
- Generate a secure `COOKIE_SECRET` using: `openssl rand -base64 32`
- `NEXT_PUBLIC_APP_URL` should be your Vercel deployment URL (e.g., `https://clio-mcp.vercel.app`)

### 1.3 Deploy

Click "Deploy" and wait for the build to complete. Note your deployment URL.

## Step 2: Configure Clio OAuth Redirect URI

### 2.1 Get Your Production URL

After deployment, your production URL will be:
- **Vercel default**: `https://your-project-name.vercel.app`
- **Custom domain**: `https://your-custom-domain.com` (if configured)

### 2.2 Add Redirect URI in Clio Developer Portal

1. Log in to [Clio Developer Portal](https://app.clio.com/oauth/applications)
2. Navigate to your OAuth application
3. Click "Edit" on your application
4. In the **Redirect URIs** section, add:
   ```
   https://your-production-url.vercel.app/api/auth/callback/clio
   ```
   Replace `your-production-url.vercel.app` with your actual Vercel deployment URL.

5. **Important**: If you're using a custom domain, add both:
   ```
   https://your-production-url.vercel.app/api/auth/callback/clio
   https://your-custom-domain.com/api/auth/callback/clio
   ```

6. Click "Save" to update your application

### 2.3 Verify Redirect URI Format

The redirect URI must match **exactly**:
- Protocol: `https://` (required)
- Domain: Your Vercel deployment domain
- Path: `/api/auth/callback/clio` (exact match, case-sensitive)
- No trailing slash

**Correct Examples**:
- ✅ `https://clio-mcp.vercel.app/api/auth/callback/clio`
- ✅ `https://clio-mcp.example.com/api/auth/callback/clio`

**Incorrect Examples**:
- ❌ `http://clio-mcp.vercel.app/api/auth/callback/clio` (http instead of https)
- ❌ `https://clio-mcp.vercel.app/api/auth/callback/clio/` (trailing slash)
- ❌ `https://clio-mcp.vercel.app/auth/callback/clio` (missing /api)

## Step 3: Update Environment Variables

After adding the redirect URI in Clio, update your Vercel environment variables:

1. Go to Vercel Project Settings → Environment Variables
2. Update `NEXT_PUBLIC_APP_URL` to match your production URL:
   ```
   NEXT_PUBLIC_APP_URL=https://your-production-url.vercel.app
   ```
3. Redeploy if needed (Vercel will auto-redeploy on environment variable changes)

## Step 4: Test OAuth Flow

1. Visit your production URL: `https://your-production-url.vercel.app`
2. Click "Connect Clio"
3. You should be redirected to Clio's authorization page
4. After authorizing, you should be redirected back to your dashboard
5. Verify the session is created and MCP configuration is displayed

## Step 5: Configure Custom Domain (Optional)

### 5.1 Add Domain in Vercel

1. Go to Project Settings → Domains
2. Add your custom domain (e.g., `clio-mcp.example.com`)
3. Follow DNS configuration instructions
4. Wait for SSL certificate provisioning

### 5.2 Update Clio Redirect URI

1. Add the custom domain redirect URI in Clio Developer Portal:
   ```
   https://clio-mcp.example.com/api/auth/callback/clio
   ```
2. Update `NEXT_PUBLIC_APP_URL` in Vercel to your custom domain

## Troubleshooting

### OAuth Redirect URI Mismatch Error

**Error**: `redirect_uri_mismatch`

**Solution**:
1. Verify the redirect URI in Clio matches exactly (including protocol, domain, and path)
2. Check for trailing slashes or typos
3. Ensure you're using `https://` not `http://`
4. Wait a few minutes after updating Clio settings (caching)

### Rate Limiting

The API enforces rate limiting:
- **Limit**: 10 requests per minute per user
- **Headers**: Check `X-RateLimit-Remaining` and `X-RateLimit-Reset`
- **429 Response**: Returns `Retry-After` header with seconds to wait

### Environment Variables Not Working

1. Verify variables are set in Vercel project settings
2. Ensure `NEXT_PUBLIC_*` variables are set correctly (required for client-side)
3. Redeploy after adding/updating environment variables
4. Check Vercel build logs for errors

### Session Issues

- Sessions auto-refresh when used (sliding expiration)
- Sessions expire after 30 days of inactivity
- Users can create new sessions from the dashboard

## Production Checklist

- [ ] Code deployed to Vercel
- [ ] All environment variables configured
- [ ] Clio redirect URI added and verified
- [ ] OAuth flow tested end-to-end
- [ ] Custom domain configured (if applicable)
- [ ] Rate limiting verified (10 req/min)
- [ ] SSL certificate active (automatic with Vercel)
- [ ] Monitoring/logging configured (optional)

## Security Notes

1. **Cookie Secret**: Use a strong, random secret (minimum 32 characters)
2. **HTTPS Only**: Vercel provides SSL automatically
3. **Rate Limiting**: Enabled by default (10 req/min)
4. **PII Redaction**: All logs automatically redact sensitive data
5. **Session Management**: Sessions expire after 30 days of inactivity

## Support

For issues or questions:
- Check Vercel deployment logs
- Review Clio API documentation
- Verify environment variables are set correctly
- Test OAuth flow in development first

