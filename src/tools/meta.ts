import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * @file src/tools/meta.ts
 * @description Defines meta-tools, such as a tool to list all available tools.
 */

export interface ToolInfo {
  name: string;
  description: string;
}

/**
 * Registers meta-tools with the MCP server.
 *
 * @param {McpServer} server - The MCP server instance.
 * @param {ToolInfo[]} allToolsInfo - An array containing information about all other registered tools.
 */
export function registerMetaTools(server: McpServer, allToolsInfo: ToolInfo[]) {
  server.tool(
    "list_tools",
    "Lists all available tools with their names and descriptions.",
    {}, // Schema for a tool with no input arguments
    async () => {
      try {
        if (!allToolsInfo || allToolsInfo.length === 0) {
          return {
            content: [
              { type: "text", text: "Available tools: No tool information was provided to list_tools." },
            ],
          };
        }

        const formattedTools = allToolsInfo.map(tool => `${tool.name}:${tool.description ? ' ' + tool.description : ''}`);

        return {
          content: [
            { type: "text", text: "Available tools:\n" + formattedTools.join("\n") },
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
