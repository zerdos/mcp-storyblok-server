import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { 
  handleApiResponse, 
  getContentHeaders, 
  buildContentUrl,
  createPaginationParams,
  addOptionalParams
} from "../utils/api";
import { config } from '../config/index';
import type { SearchParams } from '../types/index';

export function registerSearchTools(server: McpServer) {
  // Search stories using Content Delivery API
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
    async (searchParams: SearchParams) => {
      try {
        const params = createPaginationParams(searchParams.page, searchParams.per_page);
        
        // Add token and version
        params.set('token', config.publicToken);
        params.set('version', 'draft');

        // Add optional parameters
        addOptionalParams(params, {
          starts_with: searchParams.starts_with,
          by_uuids: searchParams.by_uuids,
          by_slugs: searchParams.by_slugs,
          excluding_slugs: searchParams.excluding_slugs,
          with_tag: searchParams.with_tag,
          is_startpage: searchParams.is_startpage,
          sort_by: searchParams.sort_by,
          search_term: searchParams.search_term,
          resolve_links: searchParams.resolve_links,
          resolve_relations: searchParams.resolve_relations
        });

        // Handle filter_query object
        if (searchParams.filter_query) {
          Object.entries(searchParams.filter_query).forEach(([key, value]) => {
            params.append(`filter_query[${key}]`, String(value));
          });
        }

        const url = `${buildContentUrl('/stories')}?${params}`;
        const response = await fetch(
          url,
          { headers: getContentHeaders() }
        );

        const data = await handleApiResponse(response, url);
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

  // Get story by slug using Content Delivery API
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
        const params = new URLSearchParams({
          token: config.publicToken,
          version
        });

        addOptionalParams(params, {
          resolve_links,
          resolve_relations
        });

        const url = `${buildContentUrl(`/stories/${slug}`)}?${params}`;
        const response = await fetch(
          url,
          { headers: getContentHeaders() }
        );

        const data = await handleApiResponse(response, url);
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
