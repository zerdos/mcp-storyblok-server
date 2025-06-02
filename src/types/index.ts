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
