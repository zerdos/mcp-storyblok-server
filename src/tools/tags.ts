import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { 
  handleApiResponse, 
  getManagementHeaders, 
  buildManagementUrl
} from '../utils/api.js';

export function registerTagTools(server: McpServer) {
  // Fetch tags
  server.tool(
    "fetch-tags",
    "Fetches all tags from Storyblok space",
    {},
    async () => {
      try {
        const endpoint = buildManagementUrl('/tags');
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

  // Create tag
  server.tool(
    "create-tag",
    "Creates a new tag in Storyblok",
    {
      name: z.string().describe("Tag name")
    },
    async ({ name }) => {
      try {
        const endpoint = buildManagementUrl('/tags');
        const response = await fetch(
          endpoint,
          {
            method: 'POST',
            headers: getManagementHeaders(),
            body: JSON.stringify({ name })
          }
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

  // Create tag and add to story
  server.tool(
    "create-tag-and-add-to-story",
    "Create a new tag in your Storyblok space and add it to a story",
    {
      name: z.string().describe("The name of the tag to create"),
      story_id: z.string().describe("The story id to add the tag to")
    },
    async ({ name, story_id }) => {
      try {
        const endpoint = buildManagementUrl('/tags');
        const response = await fetch(
          endpoint,
          {
            method: 'POST',
            headers: getManagementHeaders(),
            body: JSON.stringify({ name, story_id })
          }
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

  // Delete tag
  server.tool(
    "delete-tag",
    "Deletes a tag from Storyblok",
    {
      id: z.string().describe("Tag ID")
    },
    async ({ id }) => {
      try {
        const endpoint = buildManagementUrl(`/tags/${id}`);
        const response = await fetch(
          endpoint,
          {
            method: 'DELETE',
            headers: getManagementHeaders()
          }
        );

        await handleApiResponse(response, endpoint);
        return {
          content: [
            {
              type: "text",
              text: `Tag ${id} has been successfully deleted.`
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
