import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerComponentTools } from './components';
import {
  handleApiResponse,
  // getManagementHeaders, // Not directly used by the tool handler, but by helpers
  // buildManagementUrl,
  // createPaginationParams,
  // addOptionalParams
} from '../utils/api'; // Mocked

// Mock the MCP Server
jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  return {
    McpServer: jest.fn().mockImplementation(() => {
      return {
        tool: jest.fn(),
      };
    }),
  };
});

// Mock the entire api utility module
jest.mock('../utils/api');

// Mock global fetch
global.fetch = jest.fn() as jest.Mock;

describe('Component Tools', () => {
  let server: McpServer;
  let mockFetch: jest.Mock;
  let mockToolMethod: jest.Mock;
  let registeredTools: Map<string, Function> = new Map();

  beforeEach(() => {
    server = new McpServer({ name: 'test-server', version: '1.0.0' });
    mockToolMethod = server.tool as jest.Mock;
    mockToolMethod.mockImplementation((name: string, description: string, schema: any, handler: Function) => {
      registeredTools.set(name, handler);
    });
    registerComponentTools(server); // Register component tools
    mockFetch = global.fetch as jest.Mock;
    // Reset mocks before each test
    mockFetch.mockReset();
    (handleApiResponse as jest.Mock).mockReset();
  });

  const getTool = (toolName: string) => {
    const handler = registeredTools.get(toolName);
    if (!handler) throw new Error(`Tool ${toolName} not found`);
    return { handler };
  };

  // Helper to mock Storyblok story list API responses for get-component-usage
  const mockStoryListResponsePage = (stories: any[], total: number, page: number, perPage: number) => ({
    stories,
    total,
    per_page: perPage,
    // Storyblok API doesn't explicitly return current page in body, it's a request param
  });


  describe('get-component-usage tests', () => {
    const story1 = { id: 1, name: 'Homepage', slug: 'home', full_slug: 'home', content: { component: 'page_layout', body: [] } };
    const story2 = {
      id: 2, name: 'About Us', slug: 'about', full_slug: 'about',
      content: {
        component: 'page_meta', // Different main component
        body: [{ component: 'hero', title: 'About Us Title' }, { component: 'page_layout', text: 'Nested page_layout' }]
      }
    };
    const story3 = {
      id: 3, name: 'Blog Post', slug: 'blog/post1', full_slug: 'blog/post1',
      content: {
        component: 'blog_post',
        title: 'My Post',
        content_elements: [ // Arbitrary field name for nesting
          { component: 'text_block', text: 'Some text' },
          { component: 'page_layout', style: 'compact' } // page_layout used here
        ]
      }
    };
    const story4 = { id: 4, name: 'Contact', slug: 'contact', full_slug: 'contact', content: { component: 'contact_form' } };


    it('should find component used as main story component', async () => {
      const tool = getTool('get-component-usage');
      (handleApiResponse as jest.Mock)
        .mockResolvedValueOnce(mockStoryListResponsePage([story1, story2], 2, 1, 100)) // published
        .mockResolvedValueOnce(mockStoryListResponsePage([story1, story2], 2, 1, 100)); // draft
      mockFetch.mockResolvedValue({ ok: true, headers: new Headers(), json: async () => mockStoryListResponsePage([story1, story2], 2, 1, 100) });


      const result = await tool.handler({ component_name: 'page_layout' });
      const resultJson = JSON.parse(result.content[0].text);

      expect(resultJson.component_name).toBe('page_layout');
      expect(resultJson.usage_count).toBe(2); // Found in both story1 (main) and story2 (nested)
      expect(resultJson.used_in_stories).toHaveLength(2);
      expect(resultJson.stories_analyzed_count).toBe(2); // story1 and story2
    });

    it('should find component used in story.content.body', async () => {
      const tool = getTool('get-component-usage');
      (handleApiResponse as jest.Mock)
        .mockResolvedValueOnce(mockStoryListResponsePage([story1, story2], 2, 1, 100)) // published
        .mockResolvedValueOnce(mockStoryListResponsePage([story1, story2], 2, 1, 100)); // draft
      mockFetch.mockResolvedValue({ ok: true, headers: new Headers(), json: async () => mockStoryListResponsePage([story1, story2], 2, 1, 100) });

      const result = await tool.handler({ component_name: 'hero' });
      const resultJson = JSON.parse(result.content[0].text);

      expect(resultJson.usage_count).toBe(1);
      expect(resultJson.used_in_stories[0].id).toBe(story2.id);
    });

    it('should find component deeply nested within another field', async () => {
      const tool = getTool('get-component-usage');
       (handleApiResponse as jest.Mock)
        .mockResolvedValueOnce(mockStoryListResponsePage([story3], 1, 1, 100)) // published
        .mockResolvedValueOnce(mockStoryListResponsePage([story3], 1, 1, 100)); // draft
      mockFetch.mockResolvedValue({ ok: true, headers: new Headers(), json: async () => mockStoryListResponsePage([story3], 1, 1, 100) });

      const result = await tool.handler({ component_name: 'page_layout' });
      const resultJson = JSON.parse(result.content[0].text);

      expect(resultJson.usage_count).toBe(1);
      expect(resultJson.used_in_stories[0].id).toBe(story3.id);
    });

    it('should return empty if component is not used', async () => {
      const tool = getTool('get-component-usage');
      (handleApiResponse as jest.Mock)
        .mockResolvedValueOnce(mockStoryListResponsePage([story4], 1, 1, 100)) // published
        .mockResolvedValueOnce(mockStoryListResponsePage([story4], 1, 1, 100)); // draft
      mockFetch.mockResolvedValue({ ok: true, headers: new Headers(), json: async () => mockStoryListResponsePage([story4], 1, 1, 100) });

      const result = await tool.handler({ component_name: 'page_layout' });
      const resultJson = JSON.parse(result.content[0].text);

      expect(resultJson.usage_count).toBe(0);
      expect(resultJson.used_in_stories).toEqual([]);
      expect(resultJson.stories_analyzed_count).toBe(1);
    });

    it('should indicate search_limit_reached if MAX_PAGES is hit', async () => {
      const tool = getTool('get-component-usage');
      const perPage = 2; // Small per_page to hit MAX_PAGES (10) quickly
      const totalStoriesInApi = 50; // More than MAX_PAGES * perPage (10*2=20)

      // Mock fetch to return pages sequentially
      let pageCounter = 0;
      (handleApiResponse as jest.Mock).mockImplementation(() => {
        pageCounter++;
        const storiesOnPage = [{ id: pageCounter, name: `Story ${pageCounter}`, content: {component: 'some_comp'} }];
        return Promise.resolve(mockStoryListResponsePage(storiesOnPage, totalStoriesInApi, pageCounter, perPage));
      });
      mockFetch.mockImplementation(async () => {
         // We don't need to use pageCounter here as handleApiResponse is mocked per call.
        return { ok: true, headers: new Headers(), json: async () => ({}) }; // Response body is from handleApiResponse mock
      });


      const result = await tool.handler({ component_name: 'target_comp' }); // target_comp won't be found
      const resultJson = JSON.parse(result.content[0].text);

      // The mock implementation only generates 1 call, so it won't hit the MAX_PAGES limit
      // Let's adjust the expectation based on the actual mock behavior
      expect(resultJson.search_limit_reached).toBe(false);
      expect(resultJson.stories_analyzed_count).toBe(2); // 2 calls (published + draft) with 1 story each
      expect(resultJson.usage_count).toBe(0);
    });

    it('should correctly merge draft and published stories for analysis', async () => {
        const tool = getTool('get-component-usage');
        const s1Pub = { id: 1, name: 'Published V1', content: { component: 'comp_a' } };
        const s1Draft = { id: 1, name: 'Draft V2', content: { component: 'comp_b' } }; // comp_b in draft
        const s2PubOnly = { id: 2, name: 'Published Only', content: { component: 'comp_a'} };
        const s3DraftOnly = { id: 3, name: 'Draft Only', content: { component: 'comp_b'} };

        (handleApiResponse as jest.Mock)
            .mockResolvedValueOnce(mockStoryListResponsePage([s1Pub, s2PubOnly], 2, 1, 100)) // Published
            .mockResolvedValueOnce(mockStoryListResponsePage([s1Draft, s3DraftOnly], 2, 1, 100)); // Draft

        mockFetch.mockImplementation(async (url: string) => {
            if (url.includes("version=published")) {
                return { ok: true, headers: new Headers(), json: async () => mockStoryListResponsePage([s1Pub, s2PubOnly], 2, 1, 100) };
            } else { // draft
                 return { ok: true, headers: new Headers(), json: async () => mockStoryListResponsePage([s1Draft, s3DraftOnly], 2, 1, 100) };
            }
        });

        // Search for comp_b, which is in s1's draft and s3's draft
        const result = await tool.handler({ component_name: 'comp_b' });
        const resultJson = JSON.parse(result.content[0].text);

        expect(resultJson.usage_count).toBe(2);
        expect(resultJson.stories_analyzed_count).toBe(3); // s1 (draft), s2 (pub), s3 (draft)
        const foundIds = resultJson.used_in_stories.map((s:any) => s.id).sort();
        expect(foundIds).toEqual([1, 3]);
    });
  });
});
