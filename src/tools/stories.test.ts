import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { registerStoryTools } from '../stories';
import {
  handleApiResponse,
  getManagementHeaders,
  buildManagementUrl,
  createPaginationParams,
  addOptionalParams
} from '../../utils/api';
import { getComponentSchemaByName } from '../components'; // This will be the mock

// Mock the entire api utility module
jest.mock('../../utils/api');
// Mock the components module for getComponentSchemaByName
jest.mock('../components');

// Mock global fetch
global.fetch = jest.fn() as jest.Mock;

describe('Story Tools - fetch-stories', () => {
  let server: McpServer;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    server = new McpServer({ name: 'test-server', version: '1.0.0' });
    registerStoryTools(server);
    mockFetch = global.fetch as jest.Mock;
    // Reset mocks before each test
    mockFetch.mockReset();
    (handleApiResponse as jest.Mock).mockReset();
    (getComponentSchemaByName as jest.Mock).mockReset();
  });

  const getTool = (toolName: string) => {
    const tool = server.getTool(toolName);
    if (!tool) throw new Error(`Tool ${toolName} not found`);
    return tool;
  };

  const mockStoryListResponse = (stories: any[], total: number, perPage: number = 25) => ({
    stories,
    total,
    per_page: perPage,
  });

  describe('fetch-stories tests', () => {
    it('should fetch stories and return pagination metadata', async () => {
      const tool = getTool('fetch-stories');
      const mockStories = [{ id: 1, name: 'Story 1', content: { component: 'page' } }];
      const apiTotal = 1;
      const apiPerPage = 25;
      (handleApiResponse as jest.Mock).mockResolvedValue(mockStoryListResponse(mockStories, apiTotal, apiPerPage));
      mockFetch.mockResolvedValue({ ok: true, headers: new Headers(), json: async () => mockStoryListResponse(mockStories, apiTotal, apiPerPage) });


      const params = { page: 1, per_page: apiPerPage };
      const result = await tool.handler(params);
      const resultJson = JSON.parse(result.content[0].text);

      expect(mockFetch).toHaveBeenCalledTimes(1); // Once for 'draft' or default
      expect(resultJson.stories).toEqual(mockStories);
      expect(resultJson.total_items_from_api).toBe(apiTotal);
      expect(resultJson.per_page_requested).toBe(apiPerPage);
      expect(resultJson.total_pages_api).toBe(Math.ceil(apiTotal / apiPerPage));
      expect(resultJson.stories_count_current_response).toBe(mockStories.length);
      expect(resultJson.current_page).toBe(1);
    });

    it('should handle "both" content_status and merge results, using draft total for pagination', async () => {
      const tool = getTool('fetch-stories');
      const draftStories = [{ id: 1, name: 'Story 1 Draft', content: { component: 'page' } }];
      const publishedStories = [{ id: 1, name: 'Story 1 Published', content: { component: 'page' } }];

      // Mock first call (draft)
      (handleApiResponse as jest.Mock)
        .mockResolvedValueOnce(mockStoryListResponse(draftStories, 10, 25)) // 10 total draft
      // Mock second call (published)
        .mockResolvedValueOnce(mockStoryListResponse(publishedStories, 8, 25)); // 8 total published

      // fetch is called twice
      mockFetch
        .mockResolvedValueOnce({ ok: true, headers: new Headers(), json: async () => mockStoryListResponse(draftStories, 10, 25) })
        .mockResolvedValueOnce({ ok: true, headers: new Headers(), json: async () => mockStoryListResponse(publishedStories, 8, 25) });

      const params = { content_status: 'both' as const };
      const result = await tool.handler(params);
      const resultJson = JSON.parse(result.content[0].text);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      // Draft version should overwrite published
      expect(resultJson.stories).toEqual(draftStories);
      expect(resultJson.total_items_from_api).toBe(10); // Draft total
      expect(resultJson.stories_count_current_response).toBe(1);
    });

    describe('fields parameter', () => {
      const fullStory = {
        id: 1, name: 'Full Story', slug: 'full-story',
        published_at: '2023-01-01T00:00:00.000Z',
        content: { component: 'page', title: 'Full Title', body: [{ component: 'text', text: 'Hello' }] }
      };

      beforeEach(() => {
        (handleApiResponse as jest.Mock).mockResolvedValue(mockStoryListResponse([fullStory], 1, 25));
        mockFetch.mockResolvedValue({ ok: true, headers: new Headers(), json: async () => mockStoryListResponse([fullStory], 1, 25) });
      });

      it('should return only specified top-level fields', async () => {
        const tool = getTool('fetch-stories');
        const params = { fields: 'id,name' };
        const result = await tool.handler(params);
        const resultJson = JSON.parse(result.content[0].text);
        expect(resultJson.stories[0]).toEqual({ id: 1, name: 'Full Story' });
      });

      it('should return only specified nested fields', async () => {
        const tool = getTool('fetch-stories');
        const params = { fields: 'content.component,content.title' };
        const result = await tool.handler(params);
        const resultJson = JSON.parse(result.content[0].text);
        expect(resultJson.stories[0]).toEqual({ content: { component: 'page', title: 'Full Title' } });
      });

      it('should handle non-existent fields gracefully', async () => {
        const tool = getTool('fetch-stories');
        const params = { fields: 'id,non_existent_field,content.non_existent' };
        const result = await tool.handler(params);
        const resultJson = JSON.parse(result.content[0].text);
        expect(resultJson.stories[0]).toEqual({ id: 1 });
      });

       it('should handle complex paths like content.body.0.component', async () => {
        const tool = getTool('fetch-stories');
        const params = { fields: 'id,content.body.0.component' };
        const result = await tool.handler(params);
        const resultJson = JSON.parse(result.content[0].text);
        expect(resultJson.stories[0]).toEqual({ id: 1, content: { body: [ { component: 'text' } ] } });
      });
    });

    describe('summary_mode parameter', () => {
      const fullStory = {
        id: 1, name: 'Full Story', slug: 'full-story', uuid: 'abc-123',
        published_at: '2023-01-01T00:00:00.000Z', updated_at: '2023-01-02T00:00:00.000Z', created_at: '2023-01-01T00:00:00.000Z',
        parent_id: null, full_slug: 'full-story-slug',
        content: { component: 'page', title: 'Full Title', meta: 'meta info' },
        other_field: 'should be excluded'
      };
       const expectedSummary = {
        id: 1, name: 'Full Story', slug: 'full-story', uuid: 'abc-123',
        published_at: '2023-01-01T00:00:00.000Z', updated_at: '2023-01-02T00:00:00.000Z', created_at: '2023-01-01T00:00:00.000Z',
        parent_id: null, full_slug: 'full-story-slug',
        content: { component: 'page' }
      };

      beforeEach(() => {
        (handleApiResponse as jest.Mock).mockResolvedValue(mockStoryListResponse([fullStory], 1, 25));
         mockFetch.mockResolvedValue({ ok: true, headers: new Headers(), json: async () => mockStoryListResponse([fullStory], 1, 25) });
      });

      it('should return predefined summary fields when summary_mode is true', async () => {
        const tool = getTool('fetch-stories');
        const params = { summary_mode: true };
        const result = await tool.handler(params);
        const resultJson = JSON.parse(result.content[0].text);
        expect(resultJson.stories[0]).toEqual(expectedSummary);
      });

      it('fields parameter should take precedence over summary_mode', async () => {
        const tool = getTool('fetch-stories');
        const params = { summary_mode: true, fields: 'id,slug,content.title' };
        const result = await tool.handler(params);
        const resultJson = JSON.parse(result.content[0].text);
        expect(resultJson.stories[0]).toEqual({ id: 1, slug: 'full-story', content: { title: 'Full Title' } });
      });

      it('should not apply summary if summary_mode is false or undefined', async () => {
        const tool = getTool('fetch-stories');
        // summary_mode: false
        let result = await tool.handler({ summary_mode: false });
        let resultJson = JSON.parse(result.content[0].text);
        expect(resultJson.stories[0]).toEqual(fullStory); // Full story

        // summary_mode: undefined
        result = await tool.handler({});
        resultJson = JSON.parse(result.content[0].text);
        expect(resultJson.stories[0]).toEqual(fullStory); // Full story
      });
    });
  });

  describe('fetch-stories-by-component tests', () => {
    const storyPage = { id: 1, name: 'Page Story', content: { component: 'page', body: [] } };
    const storyPost = {
      id: 2, name: 'Post Story',
      content: {
        component: 'post',
        body: [{ component: 'text_block', text: 'Hello' }, { component: 'featured_image', image_url: 'url' }]
      }
    };
    const storyWithNested = {
      id: 3, name: 'Nested Story',
      content: {
        component: 'page_layout',
        body: [
          { component: 'hero', title: 'Welcome' },
          { component: 'grid', columns: [{ component: 'card', title: 'Card 1' }, { component: 'card', title: 'Card 2' }] }
        ]
      }
    };

    beforeEach(() => {
      // Default mock for fetch/handleApiResponse for these tests
      // Individual tests can override if they need specific multiple calls.
       (handleApiResponse as jest.Mock).mockResolvedValue(mockStoryListResponse([storyPage, storyPost, storyWithNested], 3, 25));
       mockFetch.mockResolvedValue({ ok: true, headers: new Headers(), json: async () => mockStoryListResponse([storyPage, storyPost, storyWithNested], 3, 25) });
    });

    it('should find story by main component name', async () => {
      const tool = getTool('fetch-stories-by-component');
      const params = { component_name: 'page' };
      const result = await tool.handler(params);
      const resultJson = JSON.parse(result.content[0].text);
      expect(resultJson.stories_found_after_filter).toBe(1);
      expect(resultJson.stories[0].id).toBe(storyPage.id);
      expect(resultJson.component_name_filter).toBe('page');
    });

    it('should find story by component name in content.body', async () => {
      const tool = getTool('fetch-stories-by-component');
      const params = { component_name: 'text_block' };
      const result = await tool.handler(params);
      const resultJson = JSON.parse(result.content[0].text);
      expect(resultJson.stories_found_after_filter).toBe(1);
      expect(resultJson.stories[0].id).toBe(storyPost.id);
    });

    it('should find story by component name nested deeper in content.body (e.g. in a grid column)', async () => {
      // Note: The current implementation of fetch-stories-by-component only checks one level deep in `body`.
      // This test assumes that limitation. If it were truly recursive, it might find 'card'.
      // For now, let's test for 'grid' which is one level deep.
      const tool = getTool('fetch-stories-by-component');
      const params = { component_name: 'grid' }; // 'card' would require deeper search not implemented
      const result = await tool.handler(params);
      const resultJson = JSON.parse(result.content[0].text);
      expect(resultJson.stories_found_after_filter).toBe(1);
      expect(resultJson.stories[0].id).toBe(storyWithNested.id);
    });


    it('should return empty if component not found', async () => {
      const tool = getTool('fetch-stories-by-component');
      const params = { component_name: 'non_existent_component' };
      const result = await tool.handler(params);
      const resultJson = JSON.parse(result.content[0].text);
      expect(resultJson.stories_found_after_filter).toBe(0);
      expect(resultJson.stories).toEqual([]);
    });

    it('should handle content_status "draft", "published", "both"', async () => {
      const tool = getTool('fetch-stories-by-component');
      const draftStory = { id: 10, name: 'Draft Comp Story', content: { component: 'my_comp' } };
      const publishedStory = { id: 11, name: 'Published Comp Story', content: { component: 'my_comp' } };

      // Both
      (handleApiResponse as jest.Mock)
        .mockResolvedValueOnce(mockStoryListResponse([draftStory], 1))    // Draft call
        .mockResolvedValueOnce(mockStoryListResponse([publishedStory], 1)); // Published call
      mockFetch
        .mockResolvedValueOnce({ ok: true, headers: new Headers(), json: async () => mockStoryListResponse([draftStory], 1) })
        .mockResolvedValueOnce({ ok: true, headers: new Headers(), json: async () => mockStoryListResponse([publishedStory], 1) });

      let result = await tool.handler({ component_name: 'my_comp', content_status: 'both' as const });
      let resultJson = JSON.parse(result.content[0].text);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(resultJson.stories_found_after_filter).toBe(2); // Both unique stories
      expect(resultJson.api_total_items_before_component_filter).toBe(1); // Draft total

      mockFetch.mockReset();
      (handleApiResponse as jest.Mock).mockReset();

      // Draft
      (handleApiResponse as jest.Mock).mockResolvedValueOnce(mockStoryListResponse([draftStory], 1));
      mockFetch.mockResolvedValueOnce({ ok: true, headers: new Headers(), json: async () => mockStoryListResponse([draftStory], 1) });
      result = await tool.handler({ component_name: 'my_comp', content_status: 'draft' as const });
      resultJson = JSON.parse(result.content[0].text);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(resultJson.stories_found_after_filter).toBe(1);
      expect(resultJson.stories[0].id).toBe(draftStory.id);
      expect(resultJson.api_total_items_before_component_filter).toBe(1);

      mockFetch.mockReset();
      (handleApiResponse as jest.Mock).mockReset();

      // Published
       (handleApiResponse as jest.Mock).mockResolvedValueOnce(mockStoryListResponse([publishedStory], 1));
       mockFetch.mockResolvedValueOnce({ ok: true, headers: new Headers(), json: async () => mockStoryListResponse([publishedStory], 1) });
      result = await tool.handler({ component_name: 'my_comp', content_status: 'published' as const });
      resultJson = JSON.parse(result.content[0].text);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(resultJson.stories_found_after_filter).toBe(1);
      expect(resultJson.stories[0].id).toBe(publishedStory.id);
    });

    it('should include pagination metadata in response', async () => {
      const tool = getTool('fetch-stories-by-component');
      (handleApiResponse as jest.Mock).mockResolvedValue(mockStoryListResponse([storyPage], 10, 5)); // 10 total, 5 per page
      mockFetch.mockResolvedValue({ ok: true, headers: new Headers(), json: async () => mockStoryListResponse([storyPage], 10, 5) });

      const params = { component_name: 'page', page: 1, per_page: 5 };
      const result = await tool.handler(params);
      const resultJson = JSON.parse(result.content[0].text);

      expect(resultJson.api_total_items_before_component_filter).toBe(10);
      expect(resultJson.api_total_pages_before_component_filter).toBe(2);
      expect(resultJson.current_page_requested).toBe(1);
      expect(resultJson.per_page_requested).toBe(5);
      expect(resultJson.stories_found_after_filter).toBe(1);
    });
  });

  describe('search-content tests', () => {
    const story1 = {
      id: 1, name: 'Story One', slug: 'story-one', full_slug: 'folder/story-one',
      content: { component: 'page', title: 'Welcome to Story One', description: 'A basic page.' }
    };
    const story2 = {
      id: 2, name: 'Story Two', slug: 'story-two', full_slug: 'folder/story-two',
      content: {
        component: 'post',
        headline: 'Post Headline About Cats',
        body: [
          { component: 'text', content: 'This post is about cats and their fluffy tails.' },
          { component: 'image', url: 'cat.jpg' }
        ]
      }
    };
    const story3 = {
      id: 3, name: 'Story Three (Tech)', slug: 'story-three', full_slug: 'tech/story-three',
      content: {
        component: 'article',
        title: 'Deep Dive into JavaScript',
        sections: [
          { component: 'section_text', text_content: 'JavaScript is versatile.' },
          { component: 'section_quote', quote: 'To be or not to be, that is JavaScript.'},
          {
            component: 'section_nested',
            elements: [
              { component: 'sub_element', data: 'Find ME here (JavaScript)' }
            ]
          }
        ]
      }
    };
    const story4Empty = {id: 4, name: 'Empty', content: {component: 'empty_page'}};


    const allStoriesMock = [story1, story2, story3, story4Empty];

    beforeEach(() => {
      // Default mock for fetch/handleApiResponse
      (handleApiResponse as jest.Mock).mockResolvedValue(mockStoryListResponse(allStoriesMock, allStoriesMock.length));
      mockFetch.mockResolvedValue({ ok: true, headers: new Headers(), json: async () => mockStoryListResponse(allStoriesMock, allStoriesMock.length) });
    });

    it('should find query in a simple string field', async () => {
      const tool = getTool('search-content');
      const params = { query: 'Welcome', fields_to_search: ['title'] };
      const result = await tool.handler(params);
      const resultJson = JSON.parse(result.content[0].text);
      expect(resultJson.matches_found_count).toBe(1);
      expect(resultJson.matched_stories[0].id).toBe(story1.id);
    });

    it('should perform case-insensitive search', async () => {
      const tool = getTool('search-content');
      const params = { query: 'welcome', fields_to_search: ['title'] };
      const result = await tool.handler(params);
      const resultJson = JSON.parse(result.content[0].text);
      expect(resultJson.matches_found_count).toBe(1);
      expect(resultJson.matched_stories[0].id).toBe(story1.id);
    });

    it('should search in multiple fields_to_search', async () => {
      const tool = getTool('search-content');
      // "page" is in story1.content.description, "headline" is in story2.content.headline
      const params = { query: 'page', fields_to_search: ['description', 'headline'] };
      const result = await tool.handler(params);
      const resultJson = JSON.parse(result.content[0].text);
      expect(resultJson.matches_found_count).toBe(1); // Only story1 has "page" in description
      expect(resultJson.matched_stories[0].id).toBe(story1.id);

      const params2 = { query: 'headline', fields_to_search: ['description', 'headline'] };
      const result2 = await tool.handler(params2);
      const resultJson2 = JSON.parse(result2.content[0].text);
      expect(resultJson2.matches_found_count).toBe(1);
      expect(resultJson2.matched_stories[0].id).toBe(story2.id);
    });

    describe('content_types filter', () => {
      it('should filter by a single content type (API level)', async () => {
        const tool = getTool('search-content');
        const params = { query: 'Welcome', fields_to_search: ['title'], content_types: ['page'] };
        await tool.handler(params);
        // Check if the API call was made with content_type param
        const calledUrl = (buildManagementUrl as jest.Mock).mock.calls[0][0] + "?" + (createPaginationParams as jest.Mock).mock.results[0].value + "&" + (addOptionalParams as jest.Mock).mock.calls[0][0];
        // This is a bit complex to assert directly due to URLSearchParams, let's check the addOptionalParams call
        expect(addOptionalParams).toHaveBeenCalledWith(expect.any(URLSearchParams), expect.objectContaining({ content_type: 'page' }));
      });

      it('should filter by multiple content types (client-side)', async () => {
        const tool = getTool('search-content');
         // story1 (page) has "Welcome", story3 (article) has "JavaScript"
        const params = { query: 'javascript', fields_to_search: ['title', 'sections.0.text_content'], content_types: ['article', 'post'] };
        const result = await tool.handler(params);
        const resultJson = JSON.parse(result.content[0].text);
        expect(resultJson.matches_found_count).toBe(1);
        expect(resultJson.matched_stories[0].id).toBe(story3.id); // story3 is 'article'
        expect(resultJson.stories_analyzed_count).toBe(2); // story2 (post) and story3 (article)
      });
    });

    describe('deep_search_nested_components', () => {
      it('should find query in a nested component in content.body', async () => {
        const tool = getTool('search-content');
        const params = { query: 'fluffy tails', fields_to_search: ['body'], deep_search_nested_components: true };
        const result = await tool.handler(params);
        const resultJson = JSON.parse(result.content[0].text);
        expect(resultJson.matches_found_count).toBe(1);
        expect(resultJson.matched_stories[0].id).toBe(story2.id);
      });

      it('should find query deeply nested in an arbitrary object structure', async () => {
        const tool = getTool('search-content');
        const params = { query: 'Find ME here', fields_to_search: ['sections'], deep_search_nested_components: true };
        const result = await tool.handler(params);
        const resultJson = JSON.parse(result.content[0].text);
        expect(resultJson.matches_found_count).toBe(1);
        expect(resultJson.matched_stories[0].id).toBe(story3.id);
      });

       it('should not find if deep_search is false for nested content', async () => {
        const tool = getTool('search-content');
        const params = { query: 'Find ME here', fields_to_search: ['sections'], deep_search_nested_components: false };
        const result = await tool.handler(params);
        const resultJson = JSON.parse(result.content[0].text);
        expect(resultJson.matches_found_count).toBe(0);
      });
    });

    it('should return no matches if query not found', async () => {
      const tool = getTool('search-content');
      const params = { query: 'ThisDoesNotExistAnywhere', fields_to_search: ['title', 'description', 'body', 'headline', 'sections'] };
      const result = await tool.handler(params);
      const resultJson = JSON.parse(result.content[0].text);
      expect(resultJson.matches_found_count).toBe(0);
      expect(resultJson.matched_stories).toEqual([]);
    });

    it('should return correct metadata and pagination', async () => {
      const tool = getTool('search-content');
      (handleApiResponse as jest.Mock).mockResolvedValue(mockStoryListResponse(allStoriesMock, 20, 5)); // 20 total, 5 per page
      mockFetch.mockResolvedValue({ ok: true, headers: new Headers(), json: async () => mockStoryListResponse(allStoriesMock, 20, 5) });

      const params = { query: 'Welcome', fields_to_search: ['title'], page: 1, per_page: 5 };
      const result = await tool.handler(params);
      const resultJson = JSON.parse(result.content[0].text);

      expect(resultJson.matches_found_count).toBe(1);
      expect(resultJson.stories_analyzed_count).toBe(allStoriesMock.length);
      expect(resultJson.total_items_from_api_before_search).toBe(20);
      expect(resultJson.total_pages_api).toBe(4);
      expect(resultJson.current_page_requested).toBe(1);
      expect(resultJson.per_page_requested).toBe(5);
      expect(resultJson.query).toBe('Welcome');
    });
  });
});
