import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { 
  handleApiResponse, 
  getManagementHeaders, 
  buildManagementUrl,
  createPaginationParams
} from "../utils/api";
import type { PaginationParams } from '../types/index';

export function registerSpaceTools(server: McpServer) {
  // Get space information
  server.tool(
    "get-space",
    "Gets information about the current Storyblok space",
    {},
    async () => {
      try {
        const endpoint = buildManagementUrl('');
        const response = await fetch(
          endpoint,
          { headers: getManagementHeaders() }
        );

        const data = await handleApiResponse(response, endpoint);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
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

  // Fetch folders
  server.tool(
    "fetch-folders",
    "Fetches folders from Storyblok space",
    {},
    async () => {
      try {
        const endpoint = `${buildManagementUrl('/stories')}?is_folder=true`;
        const response = await fetch(
          endpoint,
          { headers: getManagementHeaders() }
        );

        const data = await handleApiResponse(response, endpoint);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
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

  // Fetch datasources
  server.tool(
    "fetch-datasources",
    "Fetches datasources from Storyblok space",
    {
      page: z.number().optional().describe("Page number for pagination (default: 1)"),
      per_page: z.number().optional().describe("Number of datasources per page (default: 25, max: 100)")
    },
    async ({ page = 1, per_page = 25 }: PaginationParams) => {
      try {
        const params = createPaginationParams(page, per_page);

        const endpoint = `${buildManagementUrl('/datasources')}?${params}`;
        const response = await fetch(
          endpoint,
          { headers: getManagementHeaders() }
        );

        const data = await handleApiResponse(response, endpoint);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
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
