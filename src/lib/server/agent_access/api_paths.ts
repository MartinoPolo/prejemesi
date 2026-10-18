/** Where the versioned agent API lives; its routes are under `src/routes/api/v1/`. */
export const AGENT_API_BASE_PATH = '/api/v1';

/**
 * The remote MCP server (`src/routes/mcp/`). It stays outside `/api/` so the edge rule that
 * challenges bursts of API traffic never meets an MCP client, which cannot solve a challenge.
 */
export const AGENT_MCP_PATH = '/mcp';
