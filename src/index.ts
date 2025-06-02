import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from './tools/index.js';

/**
 * MCP Storyblok Server
 * 
 * A comprehensive Model Context Protocol server for Storyblok CMS integration.
 * Provides tools for managing stories, assets, components, releases, and more.
 * 
 * Environment Variables Required:
 * - STORYBLOK_SPACE_ID: Your Storyblok space ID
 * - STORYBLOK_MANAGEMENT_TOKEN: Management API token for write operations
 * - STORYBLOK_DEFAULT_PUBLIC_TOKEN: Public token for content delivery API
 * 
 * Features:
 * - Story management (CRUD operations, publishing, versioning)
 * - Asset management (upload, organize, folders)
 * - Component/block schema management
 * - Tag organization and management
 * - Scheduled release workflows
 * - Content search and filtering
 * - Space-level operations
 */

// Create the MCP server instance
const server = new McpServer({
  name: "storyblok-server",
  version: "1.0.0",
});

// Register all tools from modular files
registerAllTools(server);

/**
 * Main server startup function
 * Initializes the MCP server with stdio transport
 */
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Storyblok server is running");
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

// Start the server
main();
