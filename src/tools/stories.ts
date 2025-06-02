import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { 
  handleApiResponse, 
  getManagementHeaders, 
  buildManagementUrl,
  createPaginationParams,
  addOptionalParams
} from '../utils/api.js';
import type { StoryFilterParams } from '../types/index.js';

export function registerStoryTools(server: McpServer) {
  // Fetch stories with filtering
  server.tool(
    "fetch-stories",
    "Fetches stories from Storyblok space with optional filtering",
    {
      page: z.number().optional().describe("Page number for pagination (default: 1)"),
      per_page: z.number().optional().describe("Number of stories per page (default: 25, max: 100)"),
      starts_with: z.string().optional().describe("Filter by story slug starting with this value"),
      by_slugs: z.string().optional().describe("Filter by comma-separated story slugs"),
      excluding_slugs: z.string().optional().describe("Exclude stories with these comma-separated slugs"),
      content_type: z.string().optional().describe("Filter by content type/component name"),
      sort_by: z.string().optional().describe("Sort field (e.g., 'created_at:desc', 'name:asc')"),
      search_term: z.string().optional().describe("Search term to filter stories")
    },
    async (params: StoryFilterParams) => {
      try {
        const urlParams = createPaginationParams(params.page, params.per_page);
        addOptionalParams(urlParams, {
          starts_with: params.starts_with,
          by_slugs: params.by_slugs,
          excluding_slugs: params.excluding_slugs,
          content_type: params.content_type,
          sort_by: params.sort_by,
          search_term: params.search_term
        });

        const response = await fetch(
          `${buildManagementUrl('/stories')}?${urlParams}`,
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
        console.error("Error in fetch-stories tool:", error);
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

  // Get specific story
  server.tool(
    "get-story",
    "Gets a specific story by ID or slug",
    {
      id: z.string().describe("Story ID or slug")
    },
    async ({ id }) => {
      try {
        const response = await fetch(
          buildManagementUrl(`/stories/${id}`),
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
        console.error("Error in get-story tool:", error);
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

  // Create story
  server.tool(
    "create-story",
    "Creates a new story in Storyblok",
    {
      name: z.string().describe("Story name"),
      slug: z.string().describe("Story slug (URL path)"),
      content: z.record(z.unknown()).describe("Story content object"),
      parent_id: z.number().optional().describe("Parent folder ID"),
      is_folder: z.boolean().optional().describe("Whether this is a folder (default: false)"),
      is_startpage: z.boolean().optional().describe("Whether this is the startpage (default: false)"),
      tag_list: z.array(z.string()).optional().describe("Array of tag names")
    },
    async ({ name, slug, content, parent_id, is_folder = false, is_startpage = false, tag_list }) => {
      try {
        const storyData = {
          story: {
            name,
            slug,
            content,
            parent_id,
            is_folder,
            is_startpage,
            tag_list
          }
        };

        const response = await fetch(
          buildManagementUrl('/stories'),
          {
            method: 'POST',
            headers: getManagementHeaders(),
            body: JSON.stringify(storyData)
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
        console.error("Error in create-story tool:", error);
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

  // Update story
  server.tool(
    "update-story",
    "Updates an existing story in Storyblok",
    {
      id: z.string().describe("Story ID"),
      name: z.string().optional().describe("Story name"),
      slug: z.string().optional().describe("Story slug"),
      content: z.record(z.unknown()).optional().describe("Story content object"),
      tag_list: z.array(z.string()).optional().describe("Array of tag names"),
      publish: z.boolean().optional().describe("Whether to publish the story after updating")
    },
    async ({ id, name, slug, content, tag_list, publish = false }) => {
      try {
        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (slug !== undefined) updateData.slug = slug;
        if (content !== undefined) updateData.content = content;
        if (tag_list !== undefined) updateData.tag_list = tag_list;

        const storyData = { story: updateData };

        const response = await fetch(
          buildManagementUrl(`/stories/${id}`),
          {
            method: 'PUT',
            headers: getManagementHeaders(),
            body: JSON.stringify(storyData)
          }
        );

        const data = await handleApiResponse(response);

        // Publish if requested
        if (publish) {
          await fetch(
            buildManagementUrl(`/stories/${id}/publish`),
            {
              method: 'POST',
              headers: getManagementHeaders()
            }
          );
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error("Error in update-story tool:", error);
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

  // Delete story
  server.tool(
    "delete-story",
    "Deletes a story from Storyblok",
    {
      id: z.string().describe("Story ID")
    },
    async ({ id }) => {
      try {
        const response = await fetch(
          buildManagementUrl(`/stories/${id}`),
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
              text: `Story ${id} has been successfully deleted.`
            }
          ]
        };
      } catch (error) {
        console.error("Error in delete-story tool:", error);
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

  // Publish story
  server.tool(
    "publish-story",
    "Publishes a story in Storyblok",
    {
      id: z.string().describe("Story ID")
    },
    async ({ id }) => {
      try {
        const response = await fetch(
          buildManagementUrl(`/stories/${id}/publish`),
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
        console.error("Error in publish-story tool:", error);
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

  // Unpublish story
  server.tool(
    "unpublish-story",
    "Unpublishes a story in Storyblok",
    {
      id: z.string().describe("Story ID")
    },
    async ({ id }) => {
      try {
        const response = await fetch(
          buildManagementUrl(`/stories/${id}/unpublish`),
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
        console.error("Error in unpublish-story tool:", error);
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

  // Get story versions
  server.tool(
    "get-story-versions",
    "Gets all versions of a story",
    {
      id: z.string().describe("Story ID")
    },
    async ({ id }) => {
      try {
        const response = await fetch(
          buildManagementUrl(`/stories/${id}/versions`),
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
        console.error("Error in get-story-versions tool:", error);
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

  // Restore story
  server.tool(
    "restore-story",
    "Restores a story to a specific version",
    {
      id: z.string().describe("Story ID"),
      version_id: z.string().describe("Version ID to restore to")
    },
    async ({ id, version_id }) => {
      try {
        const response = await fetch(
          buildManagementUrl(`/stories/${id}/restore/${version_id}`),
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
        console.error("Error in restore-story tool:", error);
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
