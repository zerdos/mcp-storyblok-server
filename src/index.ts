import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Environment variables for Storyblok API
const STORYBLOK_SPACE_ID = process.env.STORYBLOK_SPACE_ID;
const STORYBLOK_MANAGEMENT_TOKEN = process.env.STORYBLOK_MANAGEMENT_TOKEN;
const STORYBLOK_PUBLIC_TOKEN = process.env.STORYBLOK_DEFAULT_PUBLIC_TOKEN;

// Base URLs for Storyblok APIs
const MANAGEMENT_API_BASE = 'https://mapi.storyblok.com/v1';
const CONTENT_API_BASE = 'https://api.storyblok.com/v2';

// Helper function to handle API responses
async function handleApiResponse(response: Response) {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }
  return response.json();
}

// Helper function to create management API headers
function getManagementHeaders() {
  if (!STORYBLOK_MANAGEMENT_TOKEN) {
    throw new Error('STORYBLOK_MANAGEMENT_TOKEN environment variable is required');
  }
  return {
    'Authorization': STORYBLOK_MANAGEMENT_TOKEN,
    'Content-Type': 'application/json'
  };
}

// Helper function to create content API headers
function getContentHeaders() {
  return {
    'Content-Type': 'application/json'
  };
}

/**
 *  from mcp servers config
     "env": {
        "STORYBLOK_SPACE_ID": "xxx",
        "STORYBLOK_DEFAULT_PUBLIC_TOKEN": "xxxx",
        "STORYBLOK_MANAGEMENT_TOKEN": "xxx"
      },
*/

// Create the MCP server
const server = new McpServer({
  name: "storyblok-server",
  version: "1.0.0",
});

// PING TOOL
server.tool(
  "ping",
  "Ping the skeleton server to check if it is running",
  { message: z.string().describe("Your Message") },
  async ({ message }) => {
    try {
      return {
        content: [
          { type: "text", text: `Server was pinged with the following message => ${message}` },
        ],
      };
    } catch (error) {
      console.error("Error in ping tool:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
);

// STORIES MANAGEMENT TOOLS

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
  async ({ page = 1, per_page = 25, starts_with, by_slugs, excluding_slugs, content_type, sort_by, search_term }) => {
    try {
      if (!STORYBLOK_SPACE_ID) {
        throw new Error('STORYBLOK_SPACE_ID environment variable is required');
      }

      const params = new URLSearchParams({
        page: page.toString(),
        per_page: Math.min(per_page, 100).toString()
      });

      if (starts_with) params.append('starts_with', starts_with);
      if (by_slugs) params.append('by_slugs', by_slugs);
      if (excluding_slugs) params.append('excluding_slugs', excluding_slugs);
      if (content_type) params.append('content_type', content_type);
      if (sort_by) params.append('sort_by', sort_by);
      if (search_term) params.append('search_term', search_term);

      const response = await fetch(
        `${MANAGEMENT_API_BASE}/spaces/${STORYBLOK_SPACE_ID}/stories?${params}`,
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

server.tool(
  "get-story",
  "Gets a specific story by ID or slug",
  {
    id: z.string().describe("Story ID or slug")
  },
  async ({ id }) => {
    try {
      if (!STORYBLOK_SPACE_ID) {
        throw new Error('STORYBLOK_SPACE_ID environment variable is required');
      }

      const response = await fetch(
        `${MANAGEMENT_API_BASE}/spaces/${STORYBLOK_SPACE_ID}/stories/${id}`,
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
      if (!STORYBLOK_SPACE_ID) {
        throw new Error('STORYBLOK_SPACE_ID environment variable is required');
      }

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
        `${MANAGEMENT_API_BASE}/spaces/${STORYBLOK_SPACE_ID}/stories`,
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
      if (!STORYBLOK_SPACE_ID) {
        throw new Error('STORYBLOK_SPACE_ID environment variable is required');
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (slug !== undefined) updateData.slug = slug;
      if (content !== undefined) updateData.content = content;
      if (tag_list !== undefined) updateData.tag_list = tag_list;

      const storyData = { story: updateData };

      const response = await fetch(
        `${MANAGEMENT_API_BASE}/spaces/${STORYBLOK_SPACE_ID}/stories/${id}`,
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
          `${MANAGEMENT_API_BASE}/spaces/${STORYBLOK_SPACE_ID}/stories/${id}/publish`,
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

server.tool(
  "delete-story",
  "Deletes a story from Storyblok",
  {
    id: z.string().describe("Story ID")
  },
  async ({ id }) => {
    try {
      if (!STORYBLOK_SPACE_ID) {
        throw new Error('STORYBLOK_SPACE_ID environment variable is required');
      }

      const response = await fetch(
        `${MANAGEMENT_API_BASE}/spaces/${STORYBLOK_SPACE_ID}/stories/${id}`,
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

server.tool(
  "publish-story",
  "Publishes a story in Storyblok",
  {
    id: z.string().describe("Story ID")
  },
  async ({ id }) => {
    try {
      if (!STORYBLOK_SPACE_ID) {
        throw new Error('STORYBLOK_SPACE_ID environment variable is required');
      }

      const response = await fetch(
        `${MANAGEMENT_API_BASE}/spaces/${STORYBLOK_SPACE_ID}/stories/${id}/publish`,
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

// TAGS MANAGEMENT TOOLS

server.tool(
  "fetch-tags",
  "Fetches all tags from Storyblok space",
  {},
  async ({}) => {
    try {
      if (!STORYBLOK_SPACE_ID) {
        throw new Error('STORYBLOK_SPACE_ID environment variable is required');
      }

      const response = await fetch(
        `${MANAGEMENT_API_BASE}/spaces/${STORYBLOK_SPACE_ID}/tags`,
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
      console.error("Error in fetch-tags tool:", error);
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

server.tool(
  "create-tag",
  "Creates a new tag in Storyblok",
  {
    name: z.string().describe("Tag name")
  },
  async ({ name }) => {
    try {
      if (!STORYBLOK_SPACE_ID) {
        throw new Error('STORYBLOK_SPACE_ID environment variable is required');
      }

      const response = await fetch(
        `${MANAGEMENT_API_BASE}/spaces/${STORYBLOK_SPACE_ID}/tags`,
        {
          method: 'POST',
          headers: getManagementHeaders(),
          body: JSON.stringify({ name })
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
      console.error("Error in create-tag tool:", error);
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

server.tool(
  "create-tag-and-add-to-story",
  "Create a new tag in your Storyblok space and add it to a story",
  {
    name: z.string().describe("The name of the tag to create"),
    story_id: z.string().describe("The story id to add the tag to")
  },
  async ({ name, story_id }) => {
    try {
      if (!STORYBLOK_SPACE_ID) {
        throw new Error('STORYBLOK_SPACE_ID environment variable is required');
      }

      const response = await fetch(
        `${MANAGEMENT_API_BASE}/spaces/${STORYBLOK_SPACE_ID}/tags`,
        {
          method: 'POST',
          headers: getManagementHeaders(),
          body: JSON.stringify({ name, story_id })
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
      console.error("Error in create-tag-and-add-to-story tool:", error);
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

server.tool(
  "delete-tag",
  "Deletes a tag from Storyblok",
  {
    id: z.string().describe("Tag ID")
  },
  async ({ id }) => {
    try {
      if (!STORYBLOK_SPACE_ID) {
        throw new Error('STORYBLOK_SPACE_ID environment variable is required');
      }

      const response = await fetch(
        `${MANAGEMENT_API_BASE}/spaces/${STORYBLOK_SPACE_ID}/tags/${id}`,
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
            text: `Tag ${id} has been successfully deleted.`
          }
        ]
      };
    } catch (error) {
      console.error("Error in delete-tag tool:", error);
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

// ASSETS MANAGEMENT TOOLS

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
      if (!STORYBLOK_SPACE_ID) {
        throw new Error('STORYBLOK_SPACE_ID environment variable is required');
      }

      const params = new URLSearchParams({
        page: page.toString(),
        per_page: Math.min(per_page, 100).toString()
      });

      if (search) params.append('search', search);
      if (folder_id) params.append('folder_id', folder_id.toString());

      const response = await fetch(
        `${MANAGEMENT_API_BASE}/spaces/${STORYBLOK_SPACE_ID}/assets?${params}`,
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
      console.error("Error in fetch-assets tool:", error);
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

server.tool(
  "get-asset",
  "Gets a specific asset by ID",
  {
    id: z.string().describe("Asset ID")
  },
  async ({ id }) => {
    try {
      if (!STORYBLOK_SPACE_ID) {
        throw new Error('STORYBLOK_SPACE_ID environment variable is required');
      }

      const response = await fetch(
        `${MANAGEMENT_API_BASE}/spaces/${STORYBLOK_SPACE_ID}/assets/${id}`,
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
      console.error("Error in get-asset tool:", error);
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

server.tool(
  "delete-asset",
  "Deletes an asset from Storyblok",
  {
    id: z.string().describe("Asset ID")
  },
  async ({ id }) => {
    try {
      if (!STORYBLOK_SPACE_ID) {
        throw new Error('STORYBLOK_SPACE_ID environment variable is required');
      }

      const response = await fetch(
        `${MANAGEMENT_API_BASE}/spaces/${STORYBLOK_SPACE_ID}/assets/${id}`,
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
            text: `Asset ${id} has been successfully deleted.`
          }
        ]
      };
    } catch (error) {
      console.error("Error in delete-asset tool:", error);
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

// COMPONENTS/BLOCKS MANAGEMENT TOOLS

server.tool(
  "fetch-components",
  "Fetches all components (blocks) from Storyblok space",
  {},
  async ({}) => {
    try {
      if (!STORYBLOK_SPACE_ID) {
        throw new Error('STORYBLOK_SPACE_ID environment variable is required');
      }

      const response = await fetch(
        `${MANAGEMENT_API_BASE}/spaces/${STORYBLOK_SPACE_ID}/components`,
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

server.tool(
  "get-component",
  "Gets a specific component by ID",
  {
    id: z.string().describe("Component ID")
  },
  async ({ id }) => {
    try {
      if (!STORYBLOK_SPACE_ID) {
        throw new Error('STORYBLOK_SPACE_ID environment variable is required');
      }

      const response = await fetch(
        `${MANAGEMENT_API_BASE}/spaces/${STORYBLOK_SPACE_ID}/components/${id}`,
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
      if (!STORYBLOK_SPACE_ID) {
        throw new Error('STORYBLOK_SPACE_ID environment variable is required');
      }

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
        `${MANAGEMENT_API_BASE}/spaces/${STORYBLOK_SPACE_ID}/components`,
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
      if (!STORYBLOK_SPACE_ID) {
        throw new Error('STORYBLOK_SPACE_ID environment variable is required');
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (display_name !== undefined) updateData.display_name = display_name;
      if (schema !== undefined) updateData.schema = schema;
      if (is_root !== undefined) updateData.is_root = is_root;
      if (is_nestable !== undefined) updateData.is_nestable = is_nestable;

      const componentData = { component: updateData };

      const response = await fetch(
        `${MANAGEMENT_API_BASE}/spaces/${STORYBLOK_SPACE_ID}/components/${id}`,
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

server.tool(
  "delete-component",
  "Deletes a component from Storyblok",
  {
    id: z.string().describe("Component ID")
  },
  async ({ id }) => {
    try {
      if (!STORYBLOK_SPACE_ID) {
        throw new Error('STORYBLOK_SPACE_ID environment variable is required');
      }

      const response = await fetch(
        `${MANAGEMENT_API_BASE}/spaces/${STORYBLOK_SPACE_ID}/components/${id}`,
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

// SEARCH AND CONTENT DELIVERY TOOLS

server.tool(
  "search-stories",
  "Search stories using the Content Delivery API with advanced filtering",
  {
    starts_with: z.string().optional().describe("Filter by story slug starting with this value"),
    by_uuids: z.string().optional().describe("Filter by comma-separated story UUIDs"),
    by_slugs: z.string().optional().describe("Filter by comma-separated story slugs"),
    excluding_slugs: z.string().optional().describe("Exclude stories with these comma-separated slugs"),
    with_tag: z.string().optional().describe("Filter by tag"),
    is_startpage: z.boolean().optional().describe("Filter for startpage stories"),
    sort_by: z.string().optional().describe("Sort field (e.g., 'created_at:desc', 'name:asc')"),
    search_term: z.string().optional().describe("Search term to filter stories"),
    filter_query: z.record(z.unknown()).optional().describe("Advanced filter query object"),
    page: z.number().optional().describe("Page number for pagination (default: 1)"),
    per_page: z.number().optional().describe("Number of stories per page (default: 25, max: 100)"),
    resolve_links: z.string().optional().describe("Resolve links ('story' or 'url')"),
    resolve_relations: z.string().optional().describe("Comma-separated list of component fields to resolve")
  },
  async ({ starts_with, by_uuids, by_slugs, excluding_slugs, with_tag, is_startpage, sort_by, search_term, filter_query, page = 1, per_page = 25, resolve_links, resolve_relations }) => {
    try {
      if (!STORYBLOK_PUBLIC_TOKEN) {
        throw new Error('STORYBLOK_DEFAULT_PUBLIC_TOKEN environment variable is required');
      }

      const params = new URLSearchParams({
        token: STORYBLOK_PUBLIC_TOKEN,
        version: 'draft',
        page: page.toString(),
        per_page: Math.min(per_page, 100).toString()
      });

      if (starts_with) params.append('starts_with', starts_with);
      if (by_uuids) params.append('by_uuids', by_uuids);
      if (by_slugs) params.append('by_slugs', by_slugs);
      if (excluding_slugs) params.append('excluding_slugs', excluding_slugs);
      if (with_tag) params.append('with_tag', with_tag);
      if (is_startpage !== undefined) params.append('is_startpage', is_startpage.toString());
      if (sort_by) params.append('sort_by', sort_by);
      if (search_term) params.append('search_term', search_term);
      if (resolve_links) params.append('resolve_links', resolve_links);
      if (resolve_relations) params.append('resolve_relations', resolve_relations);
      if (filter_query) {
        Object.entries(filter_query).forEach(([key, value]) => {
          params.append(`filter_query[${key}]`, String(value));
        });
      }

      const response = await fetch(
        `${CONTENT_API_BASE}/cdn/stories?${params}`,
        { headers: getContentHeaders() }
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
      console.error("Error in search-stories tool:", error);
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

server.tool(
  "get-story-by-slug",
  "Gets a story by its slug using the Content Delivery API",
  {
    slug: z.string().describe("Story slug (full path)"),
    resolve_links: z.string().optional().describe("Resolve links ('story' or 'url')"),
    resolve_relations: z.string().optional().describe("Comma-separated list of component fields to resolve"),
    version: z.enum(['draft', 'published']).optional().describe("Content version (default: draft)")
  },
  async ({ slug, resolve_links, resolve_relations, version = 'draft' }) => {
    try {
      if (!STORYBLOK_PUBLIC_TOKEN) {
        throw new Error('STORYBLOK_DEFAULT_PUBLIC_TOKEN environment variable is required');
      }

      const params = new URLSearchParams({
        token: STORYBLOK_PUBLIC_TOKEN,
        version
      });

      if (resolve_links) params.append('resolve_links', resolve_links);
      if (resolve_relations) params.append('resolve_relations', resolve_relations);

      const response = await fetch(
        `${CONTENT_API_BASE}/cdn/stories/${slug}?${params}`,
        { headers: getContentHeaders() }
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
      console.error("Error in get-story-by-slug tool:", error);
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

// SPACE MANAGEMENT TOOLS

server.tool(
  "get-space",
  "Gets information about the current Storyblok space",
  {},
  async ({}) => {
    try {
      if (!STORYBLOK_SPACE_ID) {
        throw new Error('STORYBLOK_SPACE_ID environment variable is required');
      }

      const response = await fetch(
        `${MANAGEMENT_API_BASE}/spaces/${STORYBLOK_SPACE_ID}`,
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
      console.error("Error in get-space tool:", error);
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

server.tool(
  "fetch-folders",
  "Fetches folders from Storyblok space",
  {},
  async ({}) => {
    try {
      if (!STORYBLOK_SPACE_ID) {
        throw new Error('STORYBLOK_SPACE_ID environment variable is required');
      }

      const response = await fetch(
        `${MANAGEMENT_API_BASE}/spaces/${STORYBLOK_SPACE_ID}/stories?is_folder=true`,
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
      console.error("Error in fetch-folders tool:", error);
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

async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP server is running");
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

main();
