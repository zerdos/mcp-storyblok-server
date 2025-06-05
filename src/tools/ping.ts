import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
// import axios from "axios"; // Removed axios
import { config, API_ENDPOINTS } from "../config/index.js";

/**
 * Registers the ping tool with the MCP server.
 * This tool checks server health and Storyblok API connectivity.
 *
 * @param {McpServer} server - The MCP server instance.
 */
export function registerPingTool(server: McpServer) {
  server.tool(
    "ping",
    "Checks server health and Storyblok API connectivity.",
    {}, // No input schema
    async () => {
      try {
        const fetchResponse = await fetch(
          `${API_ENDPOINTS.CONTENT}/spaces/${config.spaceId}/?token=${config.publicToken}`
        );

        if (fetchResponse.ok) { // Check response.ok for success (status 200-299)
          // Optionally, you might want to parse the JSON if you need data from it
          // const data = await fetchResponse.json();
          return {
            content: [
              {
                type: "text",
                text: "Server is running and Storyblok API is reachable.",
              },
            ],
          };
        } else {
          // Handle HTTP errors (4xx, 5xx)
          const errorBody = await fetchResponse.text(); // Get error body as text
          const errorDetails = `Status: ${fetchResponse.status} ${fetchResponse.statusText}, Body: ${errorBody}`;
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: STORYBLOK_API_ERROR - Storyblok API returned an error. Details: ${errorDetails}`,
              },
            ],
          };
        }
      } catch (error: unknown) {
        console.error("Error in ping tool:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );
}
