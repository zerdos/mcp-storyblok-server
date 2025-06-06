import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { 
  handleApiResponse, 
  getManagementHeaders, 
  buildManagementUrl,
  createPaginationParams,
  addOptionalParams
} from '../utils/api';
import type { StoryFilterParams } from '../types/index';
import { getComponentSchemaByName } from '../tools/components';

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
      search_term: z.string().optional().describe("Search term to filter stories"),
      include_content: z.boolean().optional().describe("Force content inclusion in results (Storyblok's 'resolve_relations' and 'resolve_links' might be relevant if 'content' is not directly returned for list views without it, or if it means fetching full story objects)."),
      content_status: z.enum(["draft", "published", "both"]).optional().describe("Fetch draft, published, or both versions of stories (maps to Storyblok's 'version' parameter: 'draft' or 'published'. 'both' will require two API calls)."),
      deep_filter: z.record(z.string()).optional().describe("Client-side filter on story content. Provide key-value pairs. Supports dot notation for nested fields, e.g., {'content.field_name': 'value'}."),
      validate_schema: z.string().optional().describe("Component name to validate stories against. Results added to each story or a separate metadata field."),
      fields: z.string().optional().describe("Comma-separated list of story fields to return (e.g., 'id,name,slug,content.component,published_at'). If provided, only these fields will be included for each story."),
      summary_mode: z.boolean().optional().describe("If true, returns a predefined condensed summary of each story. Overridden by the 'fields' parameter if 'fields' is also provided.")
    },
    async (params: StoryFilterParams & {
      include_content?: boolean;
      content_status?: "draft" | "published" | "both";
      deep_filter?: Record<string, string>;
      validate_schema?: string;
      fields?: string;
      summary_mode?: boolean;
    }) => {
      try {
        // Helper function to access nested properties
        const getValueByPath = (obj: any, path: string): any => {
          if (obj === null || obj === undefined || typeof path !== 'string' || path === '') {
            return undefined;
          }
          const parts = path.split('.');
          let current = obj;

          for (const part of parts) {
            if (current === null || current === undefined) {
              return undefined;
            }

            const isArrayIndex = /^\d+$/.test(part);
            if (isArrayIndex && Array.isArray(current)) {
              const index = parseInt(part, 10);
              if (index >= current.length || index < 0) { // Out of bounds (negative index check too)
                return undefined;
              }
              current = current[index];
            } else if (typeof current === 'object' && current !== null && Object.prototype.hasOwnProperty.call(current, part)) {
              // Ensures 'part' is an own property of 'current' for objects
              current = (current as any)[part];
            } else {
              // Path segment not found, or trying to access property on non-object (e.g. string, number)
              // or part not an own property
              return undefined;
            }
          }
          return current;
        };

        // Helper function to set nested properties (needed for summary_mode/fields)
        const setByPath = (obj: any, path: string, value: any): void => {
          const parts = path.split('.');
          let current = obj;
          for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            const isNextPartArrayIndex = /^\d+$/.test(parts[i+1]);
            if (!current[part] || typeof current[part] !== 'object') {
              current[part] = isNextPartArrayIndex ? [] : {};
            }
            current = current[part];
          }
          const lastPart = parts[parts.length - 1];
          if (Array.isArray(current) && /^\d+$/.test(lastPart)) {
            current[parseInt(lastPart, 10)] = value;
          } else {
            current[lastPart] = value;
          }
        };

        const fetchStoriesForVersion = async (version?: "draft" | "published") => {
          const endpointPath = '/stories';
          const urlParams = createPaginationParams(params.page, params.per_page);
          addOptionalParams(urlParams, {
            starts_with: params.starts_with,
            by_slugs: params.by_slugs,
            excluding_slugs: params.excluding_slugs,
            content_type: params.content_type, // This is pre-existing, for single content_type
            sort_by: params.sort_by,
            search_term: params.search_term,
            version: version,
            ...(params.include_content && { with_content: 1 })
          });

          const fullUrl = `${buildManagementUrl(endpointPath)}?${urlParams}`;
          const apiResponse = await fetch(fullUrl, { headers: getManagementHeaders() });
          const responseJson = await handleApiResponse(apiResponse, fullUrl);
          return {
            stories_data: responseJson.stories || [],
            total_from_api: responseJson.total || 0,
          };
        };

        let stories: any[] = [];
        let total_items_from_api: number | null = null;
        const per_page_for_calc = params.per_page || 25;


        if (params.content_status === "both") {
          const [draftData, publishedData] = await Promise.all([
            fetchStoriesForVersion("draft"),
            fetchStoriesForVersion("published")
          ]);

          const storiesMap = new Map();
          (publishedData.stories_data || []).forEach((story: any) => storiesMap.set(story.id, story));
          (draftData.stories_data || []).forEach((story: any) => storiesMap.set(story.id, story));
          stories = Array.from(storiesMap.values());
          total_items_from_api = draftData.total_from_api;
        } else {
          const singleVersionData = await fetchStoriesForVersion(params.content_status);
          stories = singleVersionData.stories_data || [];
          total_items_from_api = singleVersionData.total_from_api;
        }

        let responseMetadata: Record<string, any> = {};
        if (total_items_from_api !== null) {
          responseMetadata.total_items_from_api = total_items_from_api;
          responseMetadata.total_pages_api = Math.ceil(total_items_from_api / per_page_for_calc);
        }
         if (params.page) {
          responseMetadata.current_page = params.page;
        }
        responseMetadata.per_page_requested = per_page_for_calc;

        // Apply deep_filter
        if (params.deep_filter && Object.keys(params.deep_filter).length > 0) {
          stories = stories.filter((story: any) => {
            return Object.entries(params.deep_filter!).every(([path, expectedValue]) => {
              // Adjust path to be relative to story object if it starts with 'content.'
              const actualPath = path.startsWith('content.') ? path : `content.${path}`;
              const value = getValueByPath(story, actualPath);
              return String(value) === expectedValue;
            });
          });
        }

        // Apply validate_schema
        if (params.validate_schema) {
          const componentNameToValidate = params.validate_schema;
          responseMetadata.validated_schema_component_name = componentNameToValidate; // Renamed for clarity
          const componentSchema = await getComponentSchemaByName(componentNameToValidate);

          if (!componentSchema) {
            responseMetadata.validation_schema_error = `Component schema for '${componentNameToValidate}' not found.`; // Renamed for consistency
          } else {
            stories = stories.map((story: any) => {
              if (story.content?.component === componentNameToValidate) {
                const validationResult: {
                  isValid: boolean;
                  errors: Array<{ field: string; type: string; message: string }>;
                  missingFields: string[];
                  extraneousFields: string[];
                } = { isValid: true, errors: [], missingFields: [], extraneousFields: [] };

                const schemaFields = componentSchema;
                const contentFieldsToValidate = story.content || {};

                for (const fieldName in schemaFields) {
                  const fieldDef = schemaFields[fieldName] as any;
                  if (fieldDef.required && contentFieldsToValidate[fieldName] === undefined) {
                    validationResult.missingFields.push(fieldName);
                    validationResult.errors.push({ field: fieldName, type: "missing_required", message: `Field '${fieldName}' is required.` });
                  }
                }
                for (const contentFieldName in contentFieldsToValidate) {
                  if (!schemaFields.hasOwnProperty(contentFieldName)) {
                    validationResult.extraneousFields.push(contentFieldName);
                    validationResult.errors.push({ field: contentFieldName, type: "extraneous_field", message: `Field '${contentFieldName}' not in schema.` });
                  }
                }
                if (validationResult.errors.length > 0) validationResult.isValid = false;
                return { ...story, validation: validationResult };
              }
              return story; // No validation object if component doesn't match
            });
          }
        }

        // Apply summary_mode if true AND fields is not provided
        if (params.summary_mode && (!params.fields || params.fields.trim() === "")) {
          const PREDEFINED_SUMMARY_FIELDS = ['id', 'name', 'slug', 'uuid', 'content.component', 'published_at', 'updated_at', 'created_at', 'parent_id', 'full_slug'];
          stories = stories.map(story => {
            const summaryStory: Record<string, any> = {};
            for (const path of PREDEFINED_SUMMARY_FIELDS) {
              const value = getValueByPath(story, path);
              if (value !== undefined) { // Only set if value exists
                setByPath(summaryStory, path, value);
              }
            }
            return summaryStory;
          });
        }
        // Apply fields projection if params.fields is provided (this will run if summary_mode was false or if fields were also provided)
        else if (params.fields && params.fields.trim() !== "") {
          const requestedPaths = params.fields.split(',').map(p => p.trim()).filter(p => p);
          if (requestedPaths.length > 0) {
            stories = stories.map(story => {
              const newStory: Record<string, any> = {};
              for (const path of requestedPaths) {
                const value = getValueByPath(story, path);
                if (value !== undefined) { // Only set if value exists
                  setByPath(newStory, path, value);
                }
              }
              return newStory;
            });
          }
        }

        const stories_count_current_response = stories.length;
        responseMetadata.stories_count_current_response = stories_count_current_response;

        const finalResponseData = { ...responseMetadata, stories: stories };

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

  // Get specific story
  server.tool(
    "get-story",
    "Gets a specific story by ID or slug",
    {
      id: z.string().describe("Story ID or slug")
    },
    async ({ id }) => {
      try {
        const endpointPath = `/stories/${id}`;
        const fullUrl = buildManagementUrl(endpointPath);
        const response = await fetch(fullUrl, { headers: getManagementHeaders() });
        const data = await handleApiResponse(response, fullUrl);
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

  // Create story
  server.tool(
    "create-story",
    "Creates a new story in Storyblok",
    {
      name: z.string().describe("Story name"),
      slug: z.string().describe("Story slug (URL path)"),
      content: z.record(z.unknown()).describe("Story content object (must include a 'component' property for validation)."),
      parent_id: z.number().optional().describe("Parent folder ID"),
      is_folder: z.boolean().optional().default(false).describe("Whether this is a folder"),
      is_startpage: z.boolean().optional().default(false).describe("Whether this is the startpage"),
      tag_list: z.array(z.string()).optional().describe("Array of tag names"),
      validate_before_create: z.boolean().optional().describe("Validate content against component schema before creation."),
      auto_publish: z.boolean().optional().default(false).describe("Publish the story immediately after successful creation."),
      return_full_story: z.boolean().optional().default(false).describe("Return the full story object after creation (requires an additional fetch).")
    },
    async (params) => {
      const {
        name, slug, content, parent_id,
        is_folder = false, is_startpage = false, tag_list,
        validate_before_create, auto_publish = false, return_full_story = false
      } = params;

      try {
        // 1. Validate Before Create (if requested)
        if (validate_before_create) {
          if (!content || !content.component || typeof content.component !== 'string') {
            return { isError: true, content: [{ type: "text", text: "Error: 'content.component' is required for validation." }] };
          }
          const componentName = content.component as string;
          const componentSchema = await getComponentSchemaByName(componentName);

          if (!componentSchema) {
            return { isError: true, content: [{ type: "text", text: `Error: Component schema for '${componentName}' not found for validation.` }] };
          }

          const validationErrors: Array<{ field: string; type: "missing_required" | "extraneous_field"; message: string }> = [];
          const validationMissingFields: string[] = [];
          const validationExtraneousFields: string[] = [];

          const schemaFields = componentSchema; // schema from getComponentSchemaByName is the actual schema definition
          const contentFieldsToValidate = content; // The story content itself

          for (const fieldName in schemaFields) {
            const fieldDef = schemaFields[fieldName] as any;
            if (fieldDef.required && contentFieldsToValidate[fieldName] === undefined) {
              validationMissingFields.push(fieldName);
              validationErrors.push({ field: fieldName, type: "missing_required", message: `Field '${fieldName}' is required.` });
            }
          }
          for (const contentFieldName in contentFieldsToValidate) {
            if (!schemaFields.hasOwnProperty(contentFieldName)) {
              validationExtraneousFields.push(contentFieldName);
              validationErrors.push({ field: contentFieldName, type: "extraneous_field", message: `Field '${contentFieldName}' not in schema.` });
            }
          }

          if (validationErrors.length > 0) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  validationFailed: true,
                  isValid: false,
                  errors: validationErrors,
                  missingFields: validationMissingFields,
                  extraneousFields: validationExtraneousFields,
                  message: "Pre-creation validation failed."
                }, null, 2)
              }]
            };
          }
        }

        // 2. Main Story Creation Logic
        const storyPayload = {
          story: { name, slug, content, parent_id, is_folder, is_startpage, tag_list }
        };

        const createEndpointPath = '/stories';
        const createFullUrl = buildManagementUrl(createEndpointPath);
        const createResponse = await fetch(createFullUrl, {
          method: 'POST',
          headers: getManagementHeaders(),
          body: JSON.stringify(storyPayload)
        });

        let creationData = await handleApiResponse(createResponse, createFullUrl);
        const storyId = creationData?.story?.id;
        let publishStatus: any = null;

        // 3. Auto Publish (if requested and story created successfully)
        if (auto_publish && storyId) {
          try {
            const publishEndpointPath = `/stories/${storyId}/publish`;
            const publishFullUrl = buildManagementUrl(publishEndpointPath);
            const publishResponse = await fetch(publishFullUrl, {
              method: 'POST',
              headers: getManagementHeaders(),
            });
            await handleApiResponse(publishResponse, publishFullUrl); // Throws on error
            publishStatus = { success: true, message: "Story published successfully." };
          } catch (publishError) {
            publishStatus = { success: false, message: `Story created, but publishing failed: ${publishError instanceof Error ? publishError.message : String(publishError)}` };
          }
        }

        // 4. Return Full Story (if requested and story created successfully)
        let finalData = creationData;
        if (return_full_story && storyId) {
          try {
            const getEndpointPath = `/stories/${storyId}`;
            const getFullUrl = buildManagementUrl(getEndpointPath);
            const getResponse = await fetch(getFullUrl, { headers: getManagementHeaders() });
            finalData = await handleApiResponse(getResponse, getFullUrl);
          } catch (fetchError) {
            // If fetching the full story fails, we can still return the creation data, but add a note.
            finalData = creationData; // Fallback to creation data
            if (publishStatus) {
              finalData.publish_status_note = publishStatus.message + " | Additionally, fetching full story failed: " + (fetchError instanceof Error ? fetchError.message : String(fetchError));
            } else {
               finalData.fetch_full_story_error = `Fetching full story failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`;
            }
          }
        }

        // Augment final data with publish status if it exists
        if (publishStatus) {
          finalData.publish_status = publishStatus;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(finalData, null, 2)
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

        const endpointPath = `/stories/${id}`;
        const fullUrl = buildManagementUrl(endpointPath);
        const response = await fetch(fullUrl, {
            method: 'PUT',
            headers: getManagementHeaders(),
            body: JSON.stringify(storyData)
          }
        );

        const data = await handleApiResponse(response, fullUrl);

        // Publish if requested
        if (publish) {
          const publishEndpointPath = `/stories/${id}/publish`;
          const publishFullUrl = buildManagementUrl(publishEndpointPath);
          const publishResponse = await fetch(publishFullUrl, {
              method: 'POST',
              headers: getManagementHeaders()
            }
          );
          await handleApiResponse(publishResponse, publishFullUrl);
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
        const endpointPath = `/stories/${id}`;
        const fullUrl = buildManagementUrl(endpointPath);
        const response = await fetch(fullUrl, {
            method: 'DELETE',
            headers: getManagementHeaders()
          }
        );

        await handleApiResponse(response, fullUrl);
        return {
          content: [
            {
              type: "text",
              text: `Story ${id} has been successfully deleted.`
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

  // Publish story
  server.tool(
    "publish-story",
    "Publishes a story in Storyblok",
    {
      id: z.string().describe("Story ID")
    },
    async ({ id }) => {
      try {
        const endpointPath = `/stories/${id}/publish`;
        const fullUrl = buildManagementUrl(endpointPath);
        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: getManagementHeaders()
          }
        );

        const data = await handleApiResponse(response, fullUrl);
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

  // Unpublish story
  server.tool(
    "unpublish-story",
    "Unpublishes a story in Storyblok",
    {
      id: z.string().describe("Story ID")
    },
    async ({ id }) => {
      try {
        const endpointPath = `/stories/${id}/unpublish`;
        const fullUrl = buildManagementUrl(endpointPath);
        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: getManagementHeaders()
          }
        );

        const data = await handleApiResponse(response, fullUrl);
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

  // Get story versions
  server.tool(
    "get-story-versions",
    "Gets all versions of a story",
    {
      id: z.string().describe("Story ID")
    },
    async ({ id }) => {
      try {
        const endpointPath = `/stories/${id}/versions`;
        const fullUrl = buildManagementUrl(endpointPath);
        const response = await fetch(fullUrl, { headers: getManagementHeaders() });
        const data = await handleApiResponse(response, fullUrl);
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
        const endpointPath = `/stories/${id}/restore/${version_id}`;
        const fullUrl = buildManagementUrl(endpointPath);
        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: getManagementHeaders()
          }
        );

        const data = await handleApiResponse(response, fullUrl);
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

  // New Tool: validate-story-content
  server.tool(
    "validate-story-content",
    "Validates a story's content against a component schema",
    {
      story_id: z.string().optional().describe("Story ID (optional if content is provided directly)."),
      component_name: z.string().describe("The name of the component schema to validate against."),
      story_content: z.record(z.unknown()).optional().describe("Story content object to validate (fetched if not provided and story_id is)."),
      space_id: z.string().optional().describe("Space ID, defaults to configured space. (Currently uses default space)")
    },
    async ({ story_id, component_name, story_content, space_id }: {
      story_id?: string;
      component_name: string;
      story_content?: Record<string, unknown>;
      space_id?: string;
    }) => {
      const errors: Array<{ field: string; type: "missing_required" | "extraneous_field" | "type_mismatch" | "general"; message: string }> = [];
      const missingFields: string[] = [];
      const extraneousFields: string[] = [];
      let isValid = true;

      try {
        // 1. Fetch Component Schema
        // Note: The space_id from input isn't fully utilized yet by getComponentSchemaByName as it defaults to primary config.
        const componentSchema = await getComponentSchemaByName(component_name, space_id);
        if (!componentSchema) {
          return {
            isError: true,
            content: [{ type: "text", text: `Error: Component schema for '${component_name}' not found.` }]
          };
        }

        // 2. Fetch Story Content (if needed)
        let actualStoryContent: Record<string, any> | null = null;
        if (story_content) {
          actualStoryContent = story_content;
        } else if (story_id) {
          const storyEndpointPath = `/stories/${story_id}`;
          const storyFullUrl = buildManagementUrl(storyEndpointPath);
          const storyResponse = await fetch(storyFullUrl, { headers: getManagementHeaders() });
          const storyData = await handleApiResponse(storyResponse, storyFullUrl);
          // Assuming storyData is { story: { content: { ... } } }
          if (storyData && storyData.story && storyData.story.content) {
            actualStoryContent = storyData.story.content;
          } else {
            return {
              isError: true,
              content: [{ type: "text", text: `Error: Could not fetch content for story_id '${story_id}'. Or content is not in expected format.` }]
            };
          }
        } else {
          return {
            isError: true,
            content: [{ type: "text", text: "Validation failed: Either 'story_id' (to fetch the story) or 'story_content' (to validate directly) must be provided." }]
          };
        }

        if (!actualStoryContent) { // Should be caught above, but as a safeguard
           return { isError: true, content: [{ type: "text", text: "Error: Failed to obtain story content." }] };
        }

        // 3. Validate Content
        // Storyblok component schemas have a 'schema' object where keys are field names.
        // Each field definition can have a 'required: true' property.
        const schemaFields = componentSchema; // componentSchema is the schema object itself

        // Check for missing required fields
        for (const fieldName in schemaFields) {
          const fieldDef = schemaFields[fieldName] as any;
          if (fieldDef.required && actualStoryContent[fieldName] === undefined) {
            missingFields.push(fieldName);
            errors.push({
              field: fieldName,
              type: "missing_required",
              message: `Field '${fieldName}' is required but missing.`
            });
          }
        }

        // Check for extraneous fields in the content
        for (const contentFieldName in actualStoryContent) {
          if (!schemaFields.hasOwnProperty(contentFieldName)) {
            extraneousFields.push(contentFieldName);
            errors.push({
              field: contentFieldName,
              type: "extraneous_field",
              message: `Field '${contentFieldName}' is present in content but not defined in component schema.`
            });
          }
        }

        isValid = errors.length === 0;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                isValid,
                errors,
                missingFields,
                extraneousFields,
                validatedComponentName: component_name,
                storyIdProcessed: story_id || "N/A (content provided directly)"
              }, null, 2)
            }
          ]
        };

      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }]
        };
      }
    }
  );

  // Tool: debug-story-access
  server.tool(
    "debug-story-access",
    "Debugs access to a specific story by trying various fetch parameters.",
    {
      story_id: z.string().describe("The ID of the story to debug.")
    },
    async ({ story_id }: { story_id: string }) => {
      const apiCallAttempts: any[] = [];
      const issuesDetected: string[] = [];
      const suggestions: string[] = [];

      let accessibleAsDraftDetails = { accessible: false, contentPresent: false, fromScenario: "" };
      let accessibleAsPublishedDetails = { accessible: false, contentPresent: false, fromScenario: "" };

      const scenarios = [
        { name: "Default (likely draft)", params: {} },
        { name: "Published", params: { version: "published" } },
        { name: "Draft explicit", params: { version: "draft" } },
        { name: "Draft with content", params: { version: "draft", with_content: "1" } },
        { name: "Published with content", params: { version: "published", with_content: "1" } },
      ];

      for (const scenario of scenarios) {
        const attemptResult: any = { scenarioName: scenario.name, paramsUsed: { ...scenario.params, story_id } };
        try {
          const urlParams = new URLSearchParams();
          if ((scenario.params as any).version) urlParams.append("version", (scenario.params as any).version);
          if ((scenario.params as any).with_content) urlParams.append("with_content", (scenario.params as any).with_content);

          const endpointPath = `/stories/${story_id}`;
          const queryString = urlParams.toString();
          const fullUrl = buildManagementUrl(endpointPath) + (queryString ? `?${queryString}` : "");

          attemptResult.requestUrl = fullUrl;

          const response = await fetch(fullUrl, { headers: getManagementHeaders() });
          const data = await handleApiResponse(response, fullUrl); // handleApiResponse throws on !response.ok

          attemptResult.status = response.status;
          attemptResult.responseData = {
            id: data?.story?.id,
            name: data?.story?.name,
            published_at: data?.story?.published_at,
            full_slug: data?.story?.full_slug,
            content_present: !!data?.story?.content,
            content_component: data?.story?.content?.component,
            version: data?.story?.version, // if API returns it
          };

          const story = data?.story;
          const contentPresent = !!story?.content;

          if ((scenario.params as any).version === "published") {
            if (story) {
              if (!accessibleAsPublishedDetails.accessible || (contentPresent && !accessibleAsPublishedDetails.contentPresent)) {
                  accessibleAsPublishedDetails = { accessible: true, contentPresent: contentPresent, fromScenario: scenario.name };
              }
              if (!story.published_at) {
                issuesDetected.push(`Scenario '${scenario.name}': Story fetched as published, but 'published_at' is null/missing.`);
              }
            }
          } else { // Draft or default
            if (story) {
               if (!accessibleAsDraftDetails.accessible || (contentPresent && !accessibleAsDraftDetails.contentPresent)) {
                  accessibleAsDraftDetails = { accessible: true, contentPresent: contentPresent, fromScenario: scenario.name };
              }
            }
          }
          if ((scenario.params as any).with_content && !contentPresent && story) {
              issuesDetected.push(`Scenario '${scenario.name}': Requested 'with_content' but content is missing.`);
          }

        } catch (error) {
          attemptResult.status = "ERROR"; // Placeholder, real status is in parsedError.error
          if (error instanceof Error && error.message.startsWith('{')) {
            try {
              const parsedError = JSON.parse(error.message);
              attemptResult.errorDetails = parsedError;
              if (parsedError.error) { // From our enhanced handler
                   const statusMatch = parsedError.error.match(/^(\d{3})/);
                   if (statusMatch) attemptResult.status = parseInt(statusMatch[1]);
              }
            } catch (parseErr) {
              attemptResult.errorDetails = error.message;
            }
          } else {
            attemptResult.errorDetails = error instanceof Error ? error.message : String(error);
          }
        }
        apiCallAttempts.push(attemptResult);
      }

      // Overall Analysis
      if (accessibleAsDraftDetails.accessible && !accessibleAsPublishedDetails.accessible) {
        suggestions.push("Story is accessible in 'draft' version but not 'published'. It might be unpublished or never published.");
        if (!accessibleAsDraftDetails.contentPresent && accessibleAsPublishedDetails.fromScenario.includes("with content")){
           suggestions.push("Draft version was accessible but content might be missing. Ensure 'with_content=1' (or equivalent) is used if full content is needed for drafts.");
        }
      }
      if (!accessibleAsDraftDetails.accessible && accessibleAsPublishedDetails.accessible) {
        issuesDetected.push("Story is accessible as 'published' but not as 'draft'. This is unusual but could happen if there's a very specific server-side state or error with the draft version.");
      }
      if (accessibleAsDraftDetails.accessible && accessibleAsPublishedDetails.accessible) {
          if(accessibleAsDraftDetails.contentPresent && !accessibleAsPublishedDetails.contentPresent && accessibleAsPublishedDetails.fromScenario && !accessibleAsPublishedDetails.fromScenario.includes("with content")){
              suggestions.push("Published version content was not fetched. If needed, try fetching published version with 'with_content=1'.");
          }
          if(!accessibleAsDraftDetails.contentPresent && accessibleAsPublishedDetails.contentPresent && accessibleAsDraftDetails.fromScenario && !accessibleAsDraftDetails.fromScenario.includes("with content")){
              suggestions.push("Draft version content was not fetched. If needed, try fetching draft version with 'with_content=1'.");
          }
      }
      if (!accessibleAsDraftDetails.accessible && !accessibleAsPublishedDetails.accessible) {
        issuesDetected.push("Story was not accessible with any of the attempted common parameters (draft, published, with/without content).");
        suggestions.push("Verify the story ID is correct and exists in the space. Check token permissions if 403 errors occurred.");
      }

      // Check for consistent 404s
      const all404 = apiCallAttempts.every(att => att.status === 404);
      if(all404){
          issuesDetected.push("All attempts resulted in a 404 Not Found error.");
          suggestions.push("Confirm the story ID is correct and the story has not been deleted.");
      }

      // Check for permission issues
      const any403 = apiCallAttempts.some(att => att.status === 403);
      if(any403){
          issuesDetected.push("At least one attempt resulted in a 403 Forbidden error.");
          suggestions.push("Check the API token's permissions for reading stories. It might lack access to certain story states (e.g., drafts vs published) or the stories endpoint in general.");
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            storyId: story_id,
            accessibleAsDraftDetails,
            accessibleAsPublishedDetails,
            issuesDetected: [...new Set(issuesDetected)], // Deduplicate
            suggestions: [...new Set(suggestions)], // Deduplicate
            apiCallAttempts
          }, null, 2)
        }]
      };
    }
  );

  // Tool: bulk-publish-stories
  server.tool(
    "bulk-publish-stories",
    "Publishes multiple stories in Storyblok",
    {
      story_ids: z.array(z.string()).min(1).describe("Array of Story IDs to publish.")
    },
    async ({ story_ids }: { story_ids: string[] }) => {
      const results: Array<{ id: string, status: "success" | "error", data?: any, error?: string }> = [];
      let successful_operations = 0;
      let failed_operations = 0;

      for (const id of story_ids) {
        try {
          const endpointPath = `/stories/${id}/publish`;
          const fullUrl = buildManagementUrl(endpointPath);

          const response = await fetch(fullUrl, {
            method: 'POST', // Publish is a POST request
            headers: getManagementHeaders(),
          });

          const data = await handleApiResponse(response, fullUrl); // Publish endpoint returns the published story object
          results.push({ id, status: "success", data });
          successful_operations++;
        } catch (error) {
          results.push({ id, status: "error", error: error instanceof Error ? error.message : String(error) });
          failed_operations++;
        }
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            total_processed: story_ids.length,
            successful_operations,
            failed_operations,
            results
          }, null, 2)
        }]
      };
    }
  );

  // Tool: bulk-delete-stories
  server.tool(
    "bulk-delete-stories",
    "Deletes multiple stories in Storyblok",
    {
      story_ids: z.array(z.string()).min(1).describe("Array of Story IDs to delete.")
    },
    async ({ story_ids }: { story_ids: string[] }) => {
      const results: Array<{ id: string, status: "success" | "error", error?: string }> = [];
      let successful_operations = 0;
      let failed_operations = 0;

      for (const id of story_ids) {
        try {
          const endpointPath = `/stories/${id}`;
          const fullUrl = buildManagementUrl(endpointPath);

          const response = await fetch(fullUrl, {
            method: 'DELETE',
            headers: getManagementHeaders(),
          });

          await handleApiResponse(response, fullUrl); // delete doesn't typically return content, but handleApiResponse checks response.ok
          results.push({ id, status: "success" });
          successful_operations++;
        } catch (error) {
          results.push({ id, status: "error", error: error instanceof Error ? error.message : String(error) });
          failed_operations++;
        }
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            total_processed: story_ids.length,
            successful_operations,
            failed_operations,
            results
          }, null, 2)
        }]
      };
    }
  );

  // Tool: bulk-update-stories
  server.tool(
    "bulk-update-stories",
    "Updates multiple stories in Storyblok",
    {
      stories: z.array(
        z.object({
          id: z.string().describe("Story ID"),
          name: z.string().optional().describe("Story name"),
          slug: z.string().optional().describe("Story slug"),
          content: z.record(z.unknown()).optional().describe("Story content object"),
          parent_id: z.number().optional().describe("Parent folder ID (cannot be used to move to root, use 0 or null for root)"),
          is_folder: z.boolean().optional().describe("Whether this is a folder"),
          is_startpage: z.boolean().optional().describe("Whether this is the startpage"),
          tag_list: z.array(z.string()).optional().describe("Array of tag names"),
          publish: z.boolean().optional().default(false).describe("Whether to publish the story after updating")
        })
      ).min(1).describe("Array of story objects to update. Each object must have an 'id'.")
    },
    async ({ stories }: { stories: Array<any> }) => {
      const results: Array<{ id: string, status: "success" | "error", data?: any, error?: string, published?: boolean }> = [];
      let successful_operations = 0;
      let failed_operations = 0;

      for (const storyUpdate of stories) {
        const { id, publish, ...updateFields } = storyUpdate;
        try {
          const storyPayload: Record<string, unknown> = {};
          // Filter out undefined values explicitly, as Storyblok API might interpret them
          Object.keys(updateFields).forEach(key => {
            if ((updateFields as any)[key] !== undefined) {
              storyPayload[key] = (updateFields as any)[key];
            }
          });

          const endpointPath = `/stories/${id}`;
          const fullUrl = buildManagementUrl(endpointPath);

          const response = await fetch(fullUrl, {
            method: 'PUT',
            headers: getManagementHeaders(),
            body: JSON.stringify({ story: storyPayload }), // Storyblok expects { story: { ... } }
          });

          const data = await handleApiResponse(response, fullUrl);
          let published = false;

          if (publish) {
            try {
              const publishEndpointPath = `/stories/${id}/publish`;
              const publishFullUrl = buildManagementUrl(publishEndpointPath);
              const publishResponse = await fetch(publishFullUrl, {
                method: 'POST',
                headers: getManagementHeaders(),
              });
              await handleApiResponse(publishResponse, publishFullUrl);
              published = true;
            } catch (publishError) {
              // Log publish error but don't fail the update operation itself
              // Optionally add this info to the result for this story
            }
          }
          results.push({ id, status: "success", data, published });
          successful_operations++;
        } catch (error) {
          results.push({ id, status: "error", error: error instanceof Error ? error.message : String(error) });
          failed_operations++;
        }
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            total_processed: stories.length,
            successful_operations,
            failed_operations,
            results
          }, null, 2)
        }]
      };
    }
  );

  // Tool: bulk-create-stories
  server.tool(
    "bulk-create-stories",
    "Creates multiple stories in Storyblok",
    {
      stories: z.array(
        z.object({
          name: z.string().describe("Story name"),
          slug: z.string().describe("Story slug (URL path)"),
          content: z.record(z.unknown()).describe("Story content object"),
          parent_id: z.number().optional().describe("Parent folder ID"),
          is_folder: z.boolean().optional().default(false).describe("Whether this is a folder"),
          is_startpage: z.boolean().optional().default(false).describe("Whether this is the startpage"),
          tag_list: z.array(z.string()).optional().describe("Array of tag names")
        })
      ).min(1).describe("Array of story objects to create")
    },
    async ({ stories }: { stories: Array<any> }) => {
      const results: Array<{ input: any, id?: number, slug?: string, status: "success" | "error", data?: any, error?: string }> = [];
      let successful_operations = 0;
      let failed_operations = 0;

      for (const storyInput of stories) {
        try {
          const storyPayload = { story: storyInput };
          const endpointPath = '/stories';
          const fullUrl = buildManagementUrl(endpointPath);

          const response = await fetch(fullUrl, {
            method: 'POST',
            headers: getManagementHeaders(),
            body: JSON.stringify(storyPayload),
          });

          const data = await handleApiResponse(response, fullUrl); // data.story contains the created story
          results.push({ input: storyInput, id: data?.story?.id, slug: data?.story?.slug, status: "success", data });
          successful_operations++;
        } catch (error) {
          results.push({ input: storyInput, slug: storyInput.slug, status: "error", error: error instanceof Error ? error.message : String(error) });
          failed_operations++;
        }
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            total_processed: stories.length,
            successful_operations,
            failed_operations,
            results
          }, null, 2)
        }]
      };
    }
  );

  // New Tool: fetch-stories-by-component (re-adding with pagination)
  server.tool(
    "fetch-stories-by-component",
    "Fetches stories from Storyblok space filtering by a specific component name in story content or body.",
    {
      component_name: z.string().describe("The name of the component to filter by."),
      content_status: z.enum(["draft", "published", "both"]).optional().default("both").describe("Fetch draft, published, or both versions of stories (default: 'both')."),
      page: z.number().optional().describe("Page number for pagination (default: 1)"),
      per_page: z.number().optional().describe("Number of stories per page (default: 25, max: 100)"),
      starts_with: z.string().optional().describe("Filter by story slug starting with this value (applied before component filtering)."),
      by_slugs: z.string().optional().describe("Filter by comma-separated story slugs (applied before component filtering)."),
      excluding_slugs: z.string().optional().describe("Exclude stories with these comma-separated slugs (applied before component filtering)."),
      sort_by: z.string().optional().describe("Sort field (e.g., 'created_at:desc', 'name:asc'). Applied by Storyblok API."),
    },
    async (params: {
      component_name: string;
      content_status?: "draft" | "published" | "both";
      page?: number;
      per_page?: number;
      starts_with?: string;
      by_slugs?: string;
      excluding_slugs?: string;
      sort_by?: string;
    }) => {
      try {
        const { component_name, content_status = "both", ...otherApiParams } = params;

        // fetchStoriesForVersion for this tool
        const fetchStoriesForVersion = async (version?: "draft" | "published") => {
          const endpointPath = '/stories';
          const urlParams = createPaginationParams(otherApiParams.page, otherApiParams.per_page);
          addOptionalParams(urlParams, {
            starts_with: otherApiParams.starts_with,
            by_slugs: otherApiParams.by_slugs,
            excluding_slugs: otherApiParams.excluding_slugs,
            sort_by: otherApiParams.sort_by,
            version: version,
            with_content: 1 // Always fetch content for component filtering
          });

          const fullUrl = `${buildManagementUrl(endpointPath)}?${urlParams}`;
          const apiResponse = await fetch(fullUrl, { headers: getManagementHeaders() });
          const responseJson = await handleApiResponse(apiResponse, fullUrl);
          return {
            stories_data: responseJson.stories || [],
            total_from_api: responseJson.total || 0
          };
        };

        let fetchedStoriesData: any[] = [];
        let api_total_items: number | null = null;
        const per_page_for_calc = otherApiParams.per_page || 25;

        if (content_status === "both") {
          const [draftResult, publishedResult] = await Promise.all([
            fetchStoriesForVersion("draft"),
            fetchStoriesForVersion("published")
          ]);

          const storiesMap = new Map();
          (publishedResult.stories_data || []).forEach((story: any) => storiesMap.set(story.id, story));
          (draftResult.stories_data || []).forEach((story: any) => storiesMap.set(story.id, story));
          fetchedStoriesData = Array.from(storiesMap.values());
          api_total_items = draftResult.total_from_api;
        } else {
          const result = await fetchStoriesForVersion(content_status);
          fetchedStoriesData = result.stories_data || [];
          api_total_items = result.total_from_api;
        }

        const filteredStories = fetchedStoriesData.filter(story => {
          if (!story.content) return false;
          if (story.content.component === component_name) return true;
          if (Array.isArray(story.content.body)) {
            return story.content.body.some((bodyComponent: any) =>
              bodyComponent && bodyComponent.component === component_name
            );
          }
          return false;
        });

        let responseMetadata: Record<string, any> = {
            component_name_filter: component_name,
            stories_found_after_filter: filteredStories.length,
        };

        if (api_total_items !== null) {
            responseMetadata.api_total_items_before_component_filter = api_total_items;
            responseMetadata.api_total_pages_before_component_filter = Math.ceil(api_total_items / per_page_for_calc);
        }
        if (otherApiParams.page) {
            responseMetadata.current_page_requested = otherApiParams.page;
        }
        responseMetadata.per_page_requested = per_page_for_calc;

        const finalResponseData = { ...responseMetadata, stories: filteredStories };

        return {
          content: [ { type: "text", text: JSON.stringify(finalResponseData, null, 2) } ]
        };
      } catch (error) {
        return {
          isError: true,
          content: [ { type: "text", text: `Error in fetch-stories-by-component: ${error instanceof Error ? error.message : String(error)}` } ]
        };
      }
    }
  );

  // New Tool: search-content
  server.tool(
    "search-content",
    "Searches for a query string within specified fields of story content, with options for content type filtering and deep searching in nested components.",
    {
      query: z.string().describe("The text/value to search for within story content fields."),
      fields_to_search: z.array(z.string()).min(1).describe("Array of field paths within story.content to search the query in (e.g., ['title', 'description', 'body.0.text']). Paths are relative to the 'content' object."),
      content_types: z.array(z.string()).optional().describe("Array of content type names (component names) to filter stories by. If empty or undefined, all content types are searched."),
      content_status: z.enum(["draft", "published", "both"]).optional().default("both").describe("Fetch draft, published, or both versions of stories."),
      deep_search_nested_components: z.boolean().optional().default(false).describe("If true, recursively search within nested components in arrays like 'body' or any field specified in 'fields_to_search' that resolves to an array/object of components."),
      page: z.number().optional().describe("Page number for pagination (default: 1)."),
      per_page: z.number().optional().describe("Number of stories per page (default: 25, max: 100).")
    },
    async (params: {
      query: string;
      fields_to_search: string[];
      content_types?: string[];
      content_status?: "draft" | "published" | "both";
      deep_search_nested_components?: boolean;
      page?: number;
      per_page?: number;
    }) => {
      const {
        query,
        fields_to_search,
        content_types,
        content_status = "both",
        deep_search_nested_components = false,
        page,
        per_page
      } = params;

      // getValueByPath is defined in fetch-stories, ensure it's accessible
      // (It is, as it's in the same file scope, outside the fetch-stories handler)
      // If this tool were in a different file, getValueByPath would need to be imported or passed.
      const getValueByPath = (obj: any, path: string): any => {
        if (obj === null || obj === undefined || typeof path !== 'string' || path === '') {
          return undefined;
        }
        const parts = path.split('.');
        let current = obj;
        for (const part of parts) {
          if (current === null || current === undefined) return undefined;
          const isArrayIndex = /^\d+$/.test(part);
          if (isArrayIndex && Array.isArray(current)) {
            const index = parseInt(part, 10);
            if (index >= current.length || index < 0) return undefined;
            current = current[index];
          } else if (typeof current === 'object' && current !== null && Object.prototype.hasOwnProperty.call(current, part)) {
            current = (current as any)[part];
          } else {
            return undefined;
          }
        }
        return current;
      };

      const fetchStoriesForSearch = async (version?: "draft" | "published", apiContentType?: string) => {
        const endpointPath = '/stories';
        const urlParams = createPaginationParams(page, per_page);
        addOptionalParams(urlParams, {
          version: version,
          content_type: apiContentType, // Use single content_type for API if applicable
          with_content: 1 // Always fetch content
        });
        const fullUrl = `${buildManagementUrl(endpointPath)}?${urlParams}`;
        const apiResponse = await fetch(fullUrl, { headers: getManagementHeaders() });
        const responseJson = await handleApiResponse(apiResponse, fullUrl);
        return {
          stories_data: responseJson.stories || [],
          total_from_api: responseJson.total || 0
        };
      };

      let storiesToAnalyze: any[] = [];
      let total_items_from_api: number | null = null;
      const per_page_for_calc = per_page || 25;

      // Content Type Handling for API call
      let apiContentTypeFilter: string | undefined = undefined;
      if (content_types && content_types.length === 1) {
        apiContentTypeFilter = content_types[0];
      }

      if (content_status === "both") {
        const [draftData, publishedData] = await Promise.all([
          fetchStoriesForSearch("draft", apiContentTypeFilter),
          fetchStoriesForSearch("published", apiContentTypeFilter)
        ]);
        const storiesMap = new Map();
        (publishedData.stories_data || []).forEach(story => storiesMap.set(story.id, story));
        (draftData.stories_data || []).forEach(story => storiesMap.set(story.id, story));
        storiesToAnalyze = Array.from(storiesMap.values());
        total_items_from_api = draftData.total_from_api;
      } else {
        const result = await fetchStoriesForSearch(content_status, apiContentTypeFilter);
        storiesToAnalyze = result.stories_data;
        total_items_from_api = result.total_from_api;
      }

      // Client-side content_types filter if multiple were given
      if (content_types && content_types.length > 1) {
        storiesToAnalyze = storiesToAnalyze.filter(story =>
          story.content?.component && content_types.includes(story.content.component)
        );
        // Note: total_items_from_api would reflect pre-filtering count if this happens.
      }

      const stories_analyzed_count = storiesToAnalyze.length;
      const matched_stories: any[] = [];
      const lowerCaseQuery = query.toLowerCase();

      const recursiveDeepSearch = (currentValue: any, visited: Set<any>): boolean => {
        if (currentValue === null || currentValue === undefined) return false;
        if (typeof currentValue === 'string') {
          return currentValue.toLowerCase().includes(lowerCaseQuery);
        }
        if (typeof currentValue !== 'object' || visited.has(currentValue)) {
            return false; // Primitive (non-string) or already visited
        }
        visited.add(currentValue);

        if (Array.isArray(currentValue)) {
          for (const item of currentValue) {
            if (recursiveDeepSearch(item, visited)) {
              visited.delete(currentValue); return true;
            }
          }
        } else { // Object
          for (const key in currentValue) {
            if (Object.prototype.hasOwnProperty.call(currentValue, key)) {
              if (recursiveDeepSearch(currentValue[key], visited)) {
                visited.delete(currentValue); return true;
              }
            }
          }
        }
        visited.delete(currentValue);
        return false;
      };

      for (const story of storiesToAnalyze) {
        if (!story.content) continue;
        let storyMatched = false;
        for (const fieldPath of fields_to_search) {
          const value = getValueByPath(story.content, fieldPath);
          if (value === undefined) continue;

          if (typeof value === 'string' && value.toLowerCase().includes(lowerCaseQuery)) {
            storyMatched = true;
            break;
          }
          if (deep_search_nested_components && (Array.isArray(value) || typeof value === 'object')) {
            if (recursiveDeepSearch(value, new Set())) {
              storyMatched = true;
              break;
            }
          }
        }
        if (storyMatched) {
          matched_stories.push(story);
        }
      }

      let responseMetadata: Record<string, any> = {
        query: query,
        fields_searched: fields_to_search,
        content_types_filter: content_types || "all",
        deep_search_enabled: deep_search_nested_components,
        stories_analyzed_count: stories_analyzed_count,
        matches_found_count: matched_stories.length,
      };
      if (total_items_from_api !== null) {
        responseMetadata.total_items_from_api_before_search = total_items_from_api;
        responseMetadata.total_pages_api = Math.ceil(total_items_from_api / per_page_for_calc);
      }
      if (page) responseMetadata.current_page_requested = page;
      responseMetadata.per_page_requested = per_page_for_calc;

      return {
        content: [{ type: "text", text: JSON.stringify({ ...responseMetadata, matched_stories }, null, 2) }]
      };
    }
  );
}
