import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import axios from "axios";
import { config, API_ENDPOINTS } from "../../config/index.js";
import type { McpToolErrorResponse } from "../../types/index.js";

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
        const response = await axios.get(
          `${API_ENDPOINTS.CONTENT}/spaces/${config.spaceId}/?token=${config.publicToken}`
        );

        if (response.status === 200) {
          return {
            content: [
              {
                type: "text",
                text: "Server is running and Storyblok API is reachable.",
              },
            ],
          };
        } else {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Server is running, but Storyblok API returned status: ${response.status}.`,
              },
            ],
          };
        }
      } catch (error: any) {
        console.error("Error in ping tool:", error); // Keep server-side log

        let response: McpToolErrorResponse;

        if (axios.isAxiosError(error)) {
          // Storyblok API or network error
          const details = error.response ?
            `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}, Message: ${error.message}` :
            error.message;
          response = {
            isError: true,
            errorCode: "STORYBLOK_API_ERROR",
            errorMessage: "Storyblok API is unreachable or returned an error.",
            errorDetails: details,
            content: [
              {
                type: "text",
                text: `Error: STORYBLOK_API_ERROR - Storyblok API is unreachable or returned an error. Details: ${details}`,
              },
            ],
          };
        } else if (error.message.includes('STORYBLOK_SPACE_ID') || error.message.includes('STORYBLOK_DEFAULT_PUBLIC_TOKEN') || error.message.includes('environment variable')) {
          // Configuration errors (often caught during config import, but also possible here if config is somehow bypassed or rechecked)
           response = {
            isError: true,
            errorCode: "CONFIGURATION_ERROR",
            errorMessage: "There is a configuration problem with Storyblok credentials.",
            errorDetails: error.message,
            content: [
              {
                type: "text",
                text: `Error: CONFIGURATION_ERROR - There is a configuration problem with Storyblok credentials. Details: ${error.message}`,
              },
            ],
          };
        } else {
          // Other unexpected errors
          const details = error instanceof Error ? error.message : String(error);
          response = {
            isError: true,
            errorCode: "PING_TOOL_ERROR",
            errorMessage: "An unexpected error occurred in the ping tool.",
            errorDetails: details,
            content: [
              {
                type: "text",
                text: `Error: PING_TOOL_ERROR - An unexpected error occurred in the ping tool. Details: ${details}`,
              },
            ],
          };
        }
        return response;
      }
    }
  );
}
