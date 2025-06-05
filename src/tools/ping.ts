import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
// import axios from "axios"; // Removed axios
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
          const toolResponse: McpToolErrorResponse = {
            isError: true,
            errorCode: "STORYBLOK_API_ERROR",
            errorMessage: "Storyblok API returned an error.",
            errorDetails: errorDetails,
            content: [
              {
                type: "text",
                text: `Error: STORYBLOK_API_ERROR - Storyblok API returned an error. Details: ${errorDetails}`,
              },
            ],
          };
          return toolResponse;
        }
      } catch (error: any) {
        console.error("Error in ping tool:", error); // Keep server-side log

        let toolResponse: McpToolErrorResponse;

        // Differentiate between network errors and other types of errors
        if (error instanceof TypeError && error.message === "fetch failed") { // Common message for network errors with fetch
          toolResponse = {
            isError: true,
            errorCode: "NETWORK_ERROR", // More specific than just STORYBLOK_API_ERROR for fetch failures
            errorMessage: "Network error when trying to reach Storyblok API.",
            errorDetails: error.message, // Original error message
            content: [
              {
                type: "text",
                text: `Error: NETWORK_ERROR - Network error when trying to reach Storyblok API. Details: ${error.message}`,
              },
            ],
          };
        } else if (error.message.includes('STORYBLOK_SPACE_ID') || error.message.includes('STORYBLOK_DEFAULT_PUBLIC_TOKEN') || error.message.includes('environment variable')) {
          // Configuration errors
          toolResponse = {
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
          toolResponse = {
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
        return toolResponse;
      }
    }
  );
}
