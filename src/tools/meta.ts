import { McpServer, ToolDefinition } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

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
    z.object({}), // No specific inputs needed
    async () => {
      try {
        const toolList = Array.from(server.tools.values()).map(
          (tool: ToolDefinition<any, any>) => {
            return { name: tool.name, description: tool.description };
          }
        );

        // Format the output as a list of strings for simple text display
        const formattedToolList = toolList.map(
          (tool) => `${tool.name}: ${tool.description}`
        );

        return {
          content: [
            { type: "text", text: "Available tools:\n" + formattedToolList.join("\n") },
          ],
        };
      } catch (error: any) {
        console.error("Error in list_tools tool:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error listing tools: ${error.message}`,
            },
          ],
        };
      }
    }
  );
}
