import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { 
  handleApiResponse, 
  getManagementHeaders, 
  buildManagementUrl,
  createPaginationParams,
  addOptionalParams
} from '../utils/api.js';
import type { StoryFilterParams } from '../types/index.js';
import { getComponentSchemaByName } from '../tools/components.js';

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
      validate_schema: z.string().optional().describe("Component name to validate stories against. Results added to each story or a separate metadata field.")
    },
    async (params: StoryFilterParams & {
      include_content?: boolean;
      content_status?: "draft" | "published" | "both";
      deep_filter?: Record<string, string>;
      validate_schema?: string;
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

        const fetchStoriesForVersion = async (version?: "draft" | "published") => {
          const endpointPath = '/stories';
          const urlParams = createPaginationParams(params.page, params.per_page);
          addOptionalParams(urlParams, {
            starts_with: params.starts_with,
            by_slugs: params.by_slugs,
            excluding_slugs: params.excluding_slugs,
            content_type: params.content_type,
            sort_by: params.sort_by,
            search_term: params.search_term,
            version: version,
            ...(params.include_content && { with_content: 1 }) // Assuming 'with_content=1' works, Storyblok uses 'resolve_relations' or similar
          });

          const fullUrl = `${buildManagementUrl(endpointPath)}?${urlParams}`;
          const response = await fetch(fullUrl, { headers: getManagementHeaders() });
          return handleApiResponse(response, fullUrl);
        };

        let fetchedData;
        if (params.content_status === "both") {
          const [draftStoriesResponse, publishedStoriesResponse] = await Promise.all([
            fetchStoriesForVersion("draft"),
            fetchStoriesForVersion("published")
          ]);

          const draftStories = draftStoriesResponse.stories || [];
          const publishedStories = publishedStoriesResponse.stories || [];
          const storiesMap = new Map();
          publishedStories.forEach((story: any) => storiesMap.set(story.id, story));
          draftStories.forEach((story: any) => storiesMap.set(story.id, story));
          fetchedData = { stories: Array.from(storiesMap.values()) };
        } else {
          fetchedData = await fetchStoriesForVersion(params.content_status);
        }

        let stories = fetchedData.stories || [];
        let responseMetadata: Record<string, any> = {};

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

        const finalResponseData = { responseMetadata: responseMetadata, stories_count: stories.length, stories: stories };

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
}
