import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { 
  handleApiResponse, 
  getManagementHeaders, 
  buildManagementUrl
} from '../utils/api.js';

export function registerComponentTools(server: McpServer) {
  // Fetch components
  server.tool(
    "fetch-components",
    "Fetches all components (blocks) from Storyblok space",
    {},
    async () => {
      try {
        const response = await fetch(
          buildManagementUrl('/components'),
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
        console.error("Error in fetch-components tool:", error);
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

  // Get specific component
  server.tool(
    "get-component",
    "Gets a specific component by ID",
    {
      id: z.string().describe("Component ID")
    },
    async ({ id }) => {
      try {
        const response = await fetch(
          buildManagementUrl(`/components/${id}`),
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
        console.error("Error in get-component tool:", error);
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

  // Create component
  server.tool(
    "create-component",
    "Creates a new component (block) in Storyblok",
    {
      name: z.string().describe("Component name"),
      display_name: z.string().optional().describe("Display name for the component"),
      schema: z.record(z.unknown()).describe("Component schema definition"),
      is_root: z.boolean().optional().describe("Whether this is a root component (default: false)"),
      is_nestable: z.boolean().optional().describe("Whether this component can be nested (default: true)")
    },
    async ({ name, display_name, schema, is_root = false, is_nestable = true }) => {
      try {
        const componentData = {
          component: {
            name,
            display_name: display_name || name,
            schema,
            is_root,
            is_nestable
          }
        };

        const response = await fetch(
          buildManagementUrl('/components'),
          {
            method: 'POST',
            headers: getManagementHeaders(),
            body: JSON.stringify(componentData)
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
        console.error("Error in create-component tool:", error);
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

  // Update component
  server.tool(
    "update-component",
    "Updates an existing component in Storyblok",
    {
      id: z.string().describe("Component ID"),
      name: z.string().optional().describe("Component name"),
      display_name: z.string().optional().describe("Display name for the component"),
      schema: z.record(z.unknown()).optional().describe("Component schema definition"),
      is_root: z.boolean().optional().describe("Whether this is a root component"),
      is_nestable: z.boolean().optional().describe("Whether this component can be nested")
    },
    async ({ id, name, display_name, schema, is_root, is_nestable }) => {
      try {
        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (display_name !== undefined) updateData.display_name = display_name;
        if (schema !== undefined) updateData.schema = schema;
        if (is_root !== undefined) updateData.is_root = is_root;
        if (is_nestable !== undefined) updateData.is_nestable = is_nestable;

        const componentData = { component: updateData };

        const response = await fetch(
          buildManagementUrl(`/components/${id}`),
          {
            method: 'PUT',
            headers: getManagementHeaders(),
            body: JSON.stringify(componentData)
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
        console.error("Error in update-component tool:", error);
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

  // Delete component
  server.tool(
    "delete-component",
    "Deletes a component from Storyblok",
    {
      id: z.string().describe("Component ID")
    },
    async ({ id }) => {
      try {
        const response = await fetch(
          buildManagementUrl(`/components/${id}`),
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
              text: `Component ${id} has been successfully deleted.`
            }
          ]
        };
      } catch (error) {
        console.error("Error in delete-component tool:", error);
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
