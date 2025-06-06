import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { 
  handleApiResponse, 
  getManagementHeaders, 
  buildManagementUrl
} from "../utils/api";

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

  // New Tool: get-component-usage
  server.tool(
    "get-component-usage",
    "Finds all stories where a specific component is used, checking direct use and nested use within the story content.",
    {
      component_name: z.string().describe("The name of the component to search for.")
    },
    async ({ component_name }: { component_name: string }) => {
      const MAX_PAGES = 10; // Limit to 10 pages (e.g., 1000 stories if per_page is 100) to prevent excessive calls
      const PER_PAGE = 100;
      let allStoriesMap = new Map<number, any>(); // Use story ID as key
      let pagesFetched = 0;
      let totalStoriesFetched = 0;
      let limitReached = false;

      // Helper to fetch a single page of stories for a given version
      const fetchStoriesPage = async (version: "draft" | "published", page: number) => {
        const endpointPath = '/stories';
        const urlParams = new URLSearchParams({
          page: page.toString(),
          per_page: PER_PAGE.toString(),
          with_content: "1", // Crucial for checking component usage
          version: version,
        });
        const fullUrl = `${buildManagementUrl(endpointPath)}?${urlParams.toString()}`;
        const response = await fetch(fullUrl, { headers: getManagementHeaders() });
        return handleApiResponse(response, fullUrl); // Expects { stories: [], total: number }
      };

      // Fetch and merge stories (draft and published)
      for (const version of ["published", "draft"] as ("published" | "draft")[]) {
        let currentPage = 1;
        let hasMore = true;
        pagesFetched = 0; // Reset for each version to adhere to MAX_PAGES per version type if desired, or overall. Let's do overall.

        while (hasMore && pagesFetched < MAX_PAGES) {
          try {
            const data = await fetchStoriesPage(version, currentPage);
            const stories = data.stories || [];
            stories.forEach((story: any) => {
              // If version is draft, it overwrites. If published, it adds only if not already there from draft.
              // For component usage, draft version is usually more up-to-date.
              if (version === "draft" || !allStoriesMap.has(story.id)) {
                 allStoriesMap.set(story.id, story);
              }
            });

            totalStoriesFetched = allStoriesMap.size; // Update based on map size
            pagesFetched++;

            // Storyblok API returns 'total' which is total items, and 'per_page'
            // Check if more stories might exist
            const totalAvailable = Number(data.total) || 0;
            if (totalStoriesFetched >= totalAvailable || stories.length < PER_PAGE) {
              hasMore = false;
            } else {
              currentPage++;
            }
          } catch (error) {
            // Log error for this page and continue if possible, or break.
            // For simplicity, we break. A more robust version might retry or skip.
            console.error(`Error fetching page ${currentPage} for ${version} stories: ${error}`);
            hasMore = false;
          }
        }
        if (pagesFetched >= MAX_PAGES && hasMore) {
            limitReached = true;
        }
      }

      const allStories = Array.from(allStoriesMap.values());
      const used_in_stories: Array<{ id: number; name: string; slug: string; full_slug: string }> = [];

      // Recursive function to find component in content structures
      const findComponentInValue = (value: any): boolean => {
        if (!value) return false;

        if (Array.isArray(value)) {
          return value.some(item => findComponentInValue(item));
        }

        if (typeof value === 'object' && value !== null) {
          if (value.component === component_name) {
            return true;
          }
          // Check all object properties for nested components
          return Object.values(value).some(propValue => findComponentInValue(propValue));
        }
        return false;
      };

      allStories.forEach(story => {
        if (story.content) {
          if (findComponentInValue(story.content)) {
            used_in_stories.push({
              id: story.id,
              name: story.name,
              slug: story.slug,
              full_slug: story.full_slug,
            });
          }
        }
      });

      let message = `Found ${used_in_stories.length} stories using component '${component_name}'.`;
      if (limitReached) {
        message += ` Searched up to ${MAX_PAGES * PER_PAGE * 2} potential story entries (across draft/published versions over ${MAX_PAGES} pages each if available). The actual number of unique stories processed is ${allStories.length}. The search limit was reached, so there might be more instances not listed.`;
      }


      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              component_name,
              usage_count: used_in_stories.length,
              search_limit_reached: limitReached,
              stories_analyzed_count: allStories.length,
              message,
              used_in_stories,
            }, null, 2)
          }
        ]
      };
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
