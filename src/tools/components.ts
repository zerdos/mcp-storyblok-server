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
    "Fetches components from Storyblok space, with optional filtering and response shaping.",
    {
      component_summary: z.boolean().optional().describe("If true, return only component names, IDs, and display_names."),
      include_schema_details: z.boolean().optional().default(true).describe("If false, exclude the detailed 'schema' field (used if component_summary is false)."),
      filter_by_name: z.string().optional().describe("Filter components by name (case-insensitive substring match on 'name' or 'display_name').")
    },
    async (params) => {
      const { component_summary, include_schema_details, filter_by_name } = params;
      try {
        const endpointUrl = buildManagementUrl('/components');
        const response = await fetch(endpointUrl, { headers: getManagementHeaders() });
        const data = await handleApiResponse(response, endpointUrl); // Expects { components: [] }

        let components = data.components || [];

        // Apply filter_by_name
        if (filter_by_name) {
          const filterLower = filter_by_name.toLowerCase();
          components = components.filter((comp: any) =>
            (comp.name && comp.name.toLowerCase().includes(filterLower)) ||
            (comp.display_name && comp.display_name.toLowerCase().includes(filterLower))
          );
        }

        // Apply response shaping
        if (component_summary) {
          components = components.map((comp: any) => ({
            id: comp.id,
            name: comp.name,
            display_name: comp.display_name,
          }));
        } else if (!include_schema_details) {
          components = components.map((comp: any) => {
            const { schema, ...rest } = comp; // Destructure to omit schema
            return rest;
          });
        }

        // The original API call for all components returns an object like { components: [...] }
        // To maintain consistency or if the user expects that shape, we can return { components: components }
        // Or, if just the array is fine (more common for a "fetch list" type tool after processing):
        const finalResponseData = { components_count: components.length, components: components };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(finalResponseData, null, 2)
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

        const data = await handleApiResponse(response, buildManagementUrl(`/components/${id}`));
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

        const data = await handleApiResponse(response, buildManagementUrl('/components'));
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

        const data = await handleApiResponse(response, buildManagementUrl(`/components/${id}`));
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

        await handleApiResponse(response, buildManagementUrl(`/components/${id}`));
        return {
          content: [
            {
              type: "text",
              text: `Component ${id} has been successfully deleted.`
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

// Helper function to get a component's schema by its name
export async function getComponentSchemaByName(componentName: string, spaceId?: string): Promise<Record<string, unknown> | null> {
  // If spaceId is provided, it implies a more complex setup, possibly different credentials.
  // For now, this example assumes it uses the primary configured space.
  // A real implementation might need to handle different Storyblok clients if spaceId implies different tokens.
  if (spaceId) {
  }

  const endpoint = buildManagementUrl('/components');
  const response = await fetch(endpoint, { headers: getManagementHeaders() });
  const data = await handleApiResponse(response, endpoint); // Assuming data is { components: [] }

  if (data && data.components && Array.isArray(data.components)) {
    const foundComponent = data.components.find((comp: any) => comp.name === componentName);
    if (foundComponent) {
      return foundComponent.schema || null; // Return the schema object
    }
  }
  return null;
}
