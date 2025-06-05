export interface StoryblokConfig {
  spaceId: string;
  managementToken: string;
  publicToken: string;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status?: number;
}

export interface StoryData {
  name: string;
  slug: string;
  content: Record<string, unknown>;
  parent_id?: number;
  is_folder?: boolean;
  is_startpage?: boolean;
  tag_list?: string[];
}

export interface ComponentData {
  name: string;
  display_name?: string;
  schema: Record<string, unknown>;
  is_root?: boolean;
  is_nestable?: boolean;
}

export interface AssetData {
  filename: string;
  size: number;
  content_type: string;
}

export interface ReleaseData {
  name: string;
  publish_at?: string;
}

export interface FolderData {
  name: string;
  parent_id?: number;
}

export interface PaginationParams {
  page?: number;
  per_page?: number;
}

export interface StoryFilterParams extends PaginationParams {
  starts_with?: string;
  by_slugs?: string;
  excluding_slugs?: string;
  content_type?: string;
  sort_by?: string;
  search_term?: string;
}

export interface SearchParams extends PaginationParams {
  starts_with?: string;
  by_uuids?: string;
  by_slugs?: string;
  excluding_slugs?: string;
  with_tag?: string;
  is_startpage?: boolean;
  sort_by?: string;
  search_term?: string;
  filter_query?: Record<string, unknown>;
  resolve_links?: string;
  resolve_relations?: string;
}

/**
 * Defines the standard structure for error responses from MCP tools.
 * This ensures consistency in how errors are reported to the client.
 */
export interface McpToolErrorResponse {
  /** Indicates that this is an error response. Always true for this type. */
  isError: true;
  /** A unique code identifying the type of error (e.g., "VALIDATION_ERROR", "API_ERROR"). */
  errorCode: string;
  /** A human-readable message summarizing the error. */
  errorMessage: string;
  /** Optional additional details about the error, can be a string or a structured object. */
  errorDetails?: string | object;
  /** Content to be displayed to the user, usually mirroring the error information. */
  content: Array<{ type: "text"; text: string }>;
}
