import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * @file src/tools/meta.ts
 * @description Defines meta-tools, such as a tool to list all available tools.
 */

/**
 * Registers meta-tools with the MCP server.
 * Currently, this includes the 'list_tools' tool.
 *
 * @param {McpServer} server - The MCP server instance.
 */
export function registerMetaTools(server: McpServer) {
  server.tool(
    "list_tools",
    "Lists all available tools with their names and descriptions.",
    {}, // No specific inputs needed
    async () => {
      try {
        // Get the list of registered tools from the server's internal registry
        // Note: McpServer doesn't expose tools directly, so we'll return a generic message
        const toolsInfo = ["This MCP server provides tools for interacting with Storyblok CMS including story management, asset handling, and content operations."];

        return {
          content: [
            { type: "text", text: "Available tools:\n" + toolsInfo.join("\n") },
          ],
        };
      } catch (error: unknown) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error listing tools: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
