import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPingTool(server: McpServer) {
  server.tool(
    "ping",
    "Ping the skeleton server to check if it is running",
    { message: z.string().describe("Your Message") },
    async ({ message }) => {
      try {
        return {
          content: [
            { type: "text", text: `Server was pinged with the following message => ${message}` },
          ],
        };
      } catch (error) {
        console.error("Error in ping tool:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
