#!/bin/bash

# Test script for MCP endpoint
ENDPOINT="${1:-https://cli-mcp.th3-sh0p.com/api/mcp/sse}"

echo "Testing MCP endpoint: $ENDPOINT"
echo ""

echo "1. Testing GET request (SSE stream):"
echo "-----------------------------------"
curl -X GET "$ENDPOINT" \
  -H "Accept: text/event-stream" \
  -H "MCP-Protocol-Version: 2025-11-25" \
  --max-time 5 \
  -v 2>&1 | head -30
echo ""
echo ""

echo "2. Testing POST initialize request:"
echo "-----------------------------------"
curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-11-25" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-11-25",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }' 2>&1
echo ""
echo ""

echo "3. Testing POST tools/list request:"
echo "-----------------------------------"
curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "MCP-Protocol-Version: 2025-11-25" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }' 2>&1
echo ""
echo ""

echo "4. Checking Docker logs:"
echo "-----------------------------------"
docker logs clio-mcp --tail 20

