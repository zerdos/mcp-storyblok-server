import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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
    {}, // No specific inputs needed
    async () => {
      try {
        // Since we can't directly access server.tools, we'll provide a static list
        // or implement a different approach to list tools
        const toolsInfo = [
          "ping: Checks server health and Storyblok API connectivity.",
          "list_tools: Lists all available tools with their names and descriptions.",
          "fetch-stories: Fetches stories from Storyblok space with optional filtering",
          "get-story: Gets a specific story by ID or slug",
          "create-story: Creates a new story in Storyblok",
          "update-story: Updates an existing story in Storyblok",
          "delete-story: Deletes a story from Storyblok",
          "publish-story: Publishes a story in Storyblok",
          "unpublish-story: Unpublishes a story in Storyblok",
          "get-story-versions: Gets all versions of a story",
          "restore-story: Restores a story to a specific version",
          "fetch-tags: Fetches all tags from Storyblok space",
          "create-tag: Creates a new tag in Storyblok",
          "create-tag-and-add-to-story: Create a new tag in your Storyblok space and add it to a story",
          "delete-tag: Deletes a tag from Storyblok",
          "fetch-releases: Fetches all releases from Storyblok space",
          "create-release: Creates a new release in Storyblok",
          "add-story-to-release: Adds a story to an existing release",
          "publish-release: Publishes a release",
          "delete-release: Deletes a release",
          "fetch-assets: Fetches assets from Storyblok space with optional filtering",
          "get-asset: Gets a specific asset by ID",
          "delete-asset: Deletes an asset from Storyblok",
          "init-asset-upload: Initializes asset upload and returns signed S3 upload URL",
          "complete-asset-upload: Completes the asset upload process after S3 upload",
          "fetch-asset-folders: Fetches asset folders from Storyblok space",
          "create-asset-folder: Creates a new asset folder in Storyblok",
          "update-asset-folder: Updates an existing asset folder in Storyblok",
          "delete-asset-folder: Deletes an asset folder from Storyblok",
          "fetch-components: Fetches all components (blocks) from Storyblok space",
          "get-component: Gets a specific component by ID",
          "create-component: Creates a new component (block) in Storyblok",
          "update-component: Updates an existing component in Storyblok",
          "delete-component: Deletes a component from Storyblok",
          "search-stories: Search stories using the Content Delivery API with advanced filtering",
          "get-story-by-slug: Gets a story by its slug using the Content Delivery API",
          "get-space: Gets information about the current Storyblok space",
          "fetch-folders: Fetches folders from Storyblok space",
          "fetch-datasources: Fetches datasources from Storyblok space"
        ];

        return {
          content: [
            { type: "text", text: "Available tools:\n" + toolsInfo.join("\n") },
          ],
        };
      } catch (error: unknown) {
        console.error("Error in list_tools tool:", error);
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
