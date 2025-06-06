import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { 
  handleApiResponse, 
  getManagementHeaders, 
  buildManagementUrl,
  createPaginationParams,
  addOptionalParams
} from '../utils/api';

export function registerAssetTools(server: McpServer) {
  // Fetch assets
  server.tool(
    "fetch-assets",
    "Fetches assets from Storyblok space with optional filtering",
    {
      page: z.number().optional().describe("Page number for pagination (default: 1)"),
      per_page: z.number().optional().describe("Number of assets per page (default: 25, max: 100)"),
      search: z.string().optional().describe("Search term to filter assets by filename"),
      folder_id: z.number().optional().describe("Filter by folder ID")
    },
    async ({ page = 1, per_page = 25, search, folder_id }) => {
      try {
        const params = createPaginationParams(page, per_page);
        addOptionalParams(params, {
          search,
          folder_id
        });

        const endpoint = `${buildManagementUrl('/assets')}?${params}`;
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

  // Get specific asset
  server.tool(
    "get-asset",
    "Gets a specific asset by ID",
    {
      id: z.string().describe("Asset ID")
    },
    async ({ id }) => {
      try {
        const endpoint = buildManagementUrl(`/assets/${id}`);
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

  // Delete asset
  server.tool(
    "delete-asset",
    "Deletes an asset from Storyblok",
    {
      id: z.string().describe("Asset ID")
    },
    async ({ id }) => {
      try {
        const endpoint = buildManagementUrl(`/assets/${id}`);
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
              text: `Asset ${id} has been successfully deleted.`
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

  // Initialize asset upload
  server.tool(
    "init-asset-upload",
    "Initializes asset upload and returns signed S3 upload URL",
    {
      filename: z.string().describe("Asset filename"),
      size: z.number().describe("File size in bytes"),
      content_type: z.string().describe("MIME type of the file")
    },
    async ({ filename, size, content_type }) => {
      try {
        const endpoint = buildManagementUrl('/assets');
        const response = await fetch(
          endpoint,
          {
            method: 'POST',
            headers: getManagementHeaders(),
            body: JSON.stringify({
              filename,
              size,
              content_type
            })
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

  // Complete asset upload
  server.tool(
    "complete-asset-upload",
    "Completes the asset upload process after S3 upload",
    {
      asset_id: z.string().describe("Asset ID from init-asset-upload response")
    },
    async ({ asset_id }) => {
      try {
        const endpoint = buildManagementUrl(`/assets/${asset_id}/finish_upload`);
        const response = await fetch(
          endpoint,
          {
            method: 'POST',
            headers: getManagementHeaders()
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

  // Fetch asset folders
  server.tool(
    "fetch-asset-folders",
    "Fetches asset folders from Storyblok space",
    {},
    async () => {
      try {
        const endpoint = buildManagementUrl('/asset_folders');
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

  // Create asset folder
  server.tool(
    "create-asset-folder",
    "Creates a new asset folder in Storyblok",
    {
      name: z.string().describe("Folder name"),
      parent_id: z.number().optional().describe("Parent folder ID")
    },
    async ({ name, parent_id }) => {
      try {
        const folderData: Record<string, unknown> = { name };
        if (parent_id) folderData.parent_id = parent_id;

        const endpoint = buildManagementUrl('/asset_folders');
        const response = await fetch(
          endpoint,
          {
            method: 'POST',
            headers: getManagementHeaders(),
            body: JSON.stringify({ asset_folder: folderData })
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

  // Update asset folder
  server.tool(
    "update-asset-folder",
    "Updates an existing asset folder in Storyblok",
    {
      id: z.string().describe("Asset folder ID"),
      name: z.string().describe("New folder name")
    },
    async ({ id, name }) => {
      try {
        const endpoint = buildManagementUrl(`/asset_folders/${id}`);
        const response = await fetch(
          endpoint,
          {
            method: 'PUT',
            headers: getManagementHeaders(),
            body: JSON.stringify({ asset_folder: { name } })
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

  // Delete asset folder
  server.tool(
    "delete-asset-folder",
    "Deletes an asset folder from Storyblok",
    {
      id: z.string().describe("Asset folder ID")
    },
    async ({ id }) => {
      try {
        const endpoint = buildManagementUrl(`/asset_folders/${id}`);
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
              text: `Asset folder ${id} has been successfully deleted.`
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
