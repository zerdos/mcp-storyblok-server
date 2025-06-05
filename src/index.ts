/**
 * @file src/index.ts
 * @description Main entry point for the MCP Storyblok Server.
 * This file initializes the server, registers tools, and sets up global error handlers.
 */

/**
 * Handles uncaught exceptions.
 * Logs the error and exits the process.
 * @param {Error} error - The uncaught exception encountered.
 */
process.on('uncaughtException', (error: Error) => {
  process.exit(1);
});

/**
 * Handles unhandled promise rejections.
 * Logs the error and exits the process.
 * @param {any} reason - The reason for the promise rejection.
 * @param {Promise<any>} promise - The promise that was rejected.
 */
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  process.exit(1);
});

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

/**
 * The primary MCP (Model Context Protocol) server instance.
 * Configured with a name and version for identification.
 */
const server = new McpServer({
  name: "storyblok-server",
  version: "1.0.0",
});

// Register all tools from modular files
registerAllTools(server);

/**
 * Main server startup function.
 * Initializes the MCP server and connects it using STDIN/STDOUT transport.
 */
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    process.exit(1);
  }
}

// Start the server
main();
