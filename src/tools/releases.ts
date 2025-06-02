import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { 
  handleApiResponse, 
  getManagementHeaders, 
  buildManagementUrl,
  createPaginationParams
} from '../utils/api.js';
import type { PaginationParams } from '../types/index.js';

export function registerReleaseTools(server: McpServer) {
  // Fetch releases
  server.tool(
    "fetch-releases",
    "Fetches all releases from Storyblok space",
    {
      page: z.number().optional().describe("Page number for pagination (default: 1)"),
      per_page: z.number().optional().describe("Number of releases per page (default: 25, max: 100)")
    },
    async ({ page = 1, per_page = 25 }: PaginationParams) => {
      try {
        const params = createPaginationParams(page, per_page);

        const response = await fetch(
          `${buildManagementUrl('/releases')}?${params}`,
          { headers: getManagementHeaders() }
        );

        const data = await handleApiResponse(response);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error("Error in fetch-releases tool:", error);
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

  // Create release
  server.tool(
    "create-release",
    "Creates a new release in Storyblok",
    {
      name: z.string().describe("Release name"),
      publish_at: z.string().optional().describe("ISO date string for scheduled publishing")
    },
    async ({ name, publish_at }) => {
      try {
        const releaseData: Record<string, unknown> = { name };
        if (publish_at) releaseData.publish_at = publish_at;

        const response = await fetch(
          buildManagementUrl('/releases'),
          {
            method: 'POST',
            headers: getManagementHeaders(),
            body: JSON.stringify({ release: releaseData })
          }
        );

        const data = await handleApiResponse(response);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error("Error in create-release tool:", error);
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

  // Add story to release
  server.tool(
    "add-story-to-release",
    "Adds a story to an existing release",
    {
      release_id: z.string().describe("Release ID"),
      story_id: z.string().describe("Story ID")
    },
    async ({ release_id, story_id }) => {
      try {
        const response = await fetch(
          buildManagementUrl(`/releases/${release_id}/stories`),
          {
            method: 'POST',
            headers: getManagementHeaders(),
            body: JSON.stringify({ story_id })
          }
        );

        const data = await handleApiResponse(response);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error("Error in add-story-to-release tool:", error);
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

  // Publish release
  server.tool(
    "publish-release",
    "Publishes a release",
    {
      release_id: z.string().describe("Release ID")
    },
    async ({ release_id }) => {
      try {
        const response = await fetch(
          buildManagementUrl(`/releases/${release_id}/publish`),
          {
            method: 'POST',
            headers: getManagementHeaders()
          }
        );

        const data = await handleApiResponse(response);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error("Error in publish-release tool:", error);
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

  // Delete release
  server.tool(
    "delete-release",
    "Deletes a release",
    {
      release_id: z.string().describe("Release ID")
    },
    async ({ release_id }) => {
      try {
        const response = await fetch(
          buildManagementUrl(`/releases/${release_id}`),
          {
            method: 'DELETE',
            headers: getManagementHeaders()
          }
        );

        await handleApiResponse(response);
        return {
          content: [
            {
              type: "text",
              text: `Release ${release_id} has been successfully deleted.`
            }
          ]
        };
      } catch (error) {
        console.error("Error in delete-release tool:", error);
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
