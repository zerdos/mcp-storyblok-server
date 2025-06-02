import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPingTool } from './ping.js';
import { registerStoryTools } from './stories.js';
import { registerReleaseTools } from './releases.js';
import { registerTagTools } from './tags.js';
import { registerAssetTools } from './assets.js';
import { registerComponentTools } from './components.js';
import { registerSearchTools } from './search.js';
import { registerSpaceTools } from './space.js';

/**
 * Register all available tools with the MCP server
 * 
 * This function organizes tools by category:
 * - Ping: Basic server health check
 * - Stories: Story management (CRUD operations, publishing)
 * - Releases: Scheduled publishing workflows
 * - Tags: Tag management and organization
 * - Assets: File and media management
 * - Components: Block/component schema management
 * - Search: Content discovery and filtering
 * - Space: Space-level operations and metadata
 */
export function registerAllTools(server: McpServer) {
  // Basic tools
  registerPingTool(server);
  
  // Content management
  registerStoryTools(server);
  registerTagTools(server);
  
  // Publishing workflows
  registerReleaseTools(server);
  
  // Media management
  registerAssetTools(server);
  
  // Schema management
  registerComponentTools(server);
  
  // Content discovery
  registerSearchTools(server);
  
  // Space management
  registerSpaceTools(server);
}
