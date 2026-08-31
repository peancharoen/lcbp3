#!/usr/bin/env bash
# File: .codex/mcp/redis.sh
# Start the Redis MCP server without storing credentials in the repository.

set -euo pipefail
: "${REDIS_URL:?REDIS_URL must be set before starting the Redis MCP server}"
exec npx -y @modelcontextprotocol/server-redis "$REDIS_URL"
