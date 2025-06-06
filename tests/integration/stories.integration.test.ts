// tests/integration/stories.integration.test.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerStoryTools } from '@src/tools/stories';
// Import config and API_ENDPOINTS for verifying URL construction AFTER mocking them.

// Mock fetch globally for this test file
global.fetch = jest.fn();

// Mock the config module
jest.mock('@src/config/index', () => ({
  config: {
    spaceId: 'mock-space-id',
    managementToken: 'mock-management-token',
    publicToken: 'mock-public-token', // Include publicToken for completeness if any part of stories.ts might use it
  },
  API_ENDPOINTS: {
    MANAGEMENT: 'https://mock-mapi.storyblok.com/v1', // Use a distinct mock URL
    CONTENT: 'https://mock-api.storyblok.com/v2',
  },
  getConfig: () => ({ // Mock getConfig as well
    spaceId: 'mock-space-id',
    managementToken: 'mock-management-token',
    publicToken: 'mock-public-token',
  }),
}));

// Import mocked versions for assertions
import { config as mockedConfig, API_ENDPOINTS as mockedApiEndpoints } from '@src/config/index';

describe('Story Tools Integration Tests', () => {
  let server: McpServer;

  beforeEach(() => {
    server = new McpServer({ name: 'story-integration-test-server', version: '1.0.0' });
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get-story tool', () => {
    let getStoryHandler: (args: { id: string }) => Promise<any>;

    beforeEach(() => {
      const toolSpy = jest.spyOn(server, 'tool');
      registerStoryTools(server); // Register all story tools

      const getStoryCall = toolSpy.mock.calls.find(call => call[0] === 'get-story');
      if (!getStoryCall || typeof getStoryCall[3] !== 'function') {
        throw new Error('get-story handler was not registered correctly or not found by spy.');
      }
      getStoryHandler = getStoryCall[3];
      toolSpy.mockRestore();
    });

    it('should fetch and return a story successfully', async () => {
      const mockStoryId = '12345';
      const mockStoryData = {
        story: {
          id: mockStoryId,
          name: 'Test Story',
          slug: 'test-story',
          content: { component: 'page', body: 'Hello world' }
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockStoryData,
        text: async () => JSON.stringify(mockStoryData)
      });

      const result = await getStoryHandler({ id: mockStoryId });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const expectedUrl = `${mockedApiEndpoints.MANAGEMENT}/spaces/${mockedConfig.spaceId}/stories/${mockStoryId}`;
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(expectedUrl);

      expect(result.isError).toBeUndefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text)).toEqual(mockStoryData);
    });

    it('should return an error if fetch fails (e.g., 404 Not Found)', async () => {
      const mockStoryId = '67890';
      const apiErrorPayload = { // This is the 'details' part of our enhancedError
        // These fields would typically come from Storyblok's actual error response
        slug: mockStoryId,
        message: "The requested story was not found.",
        code: "story_not_found"
      };
      const fullExpectedUrl = `${mockedApiEndpoints.MANAGEMENT}/spaces/${mockedConfig.spaceId}/stories/${mockStoryId}`;
      const enhancedErrorString = JSON.stringify({
        error: "404 Not Found", // This is constructed by handleApiResponse
        details: apiErrorPayload,
        context: {
          endpoint: fullExpectedUrl, // Use the full URL here
          spaceId: mockedConfig.spaceId,
          tokenPermissions: "unknown",
          requiredPermissions: "unknown",
          suggestedFix: "The requested resource was not found. Please check the endpoint and resource ID."
        }
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        // handleApiResponse calls .text() first when !ok, then tries to parse it.
        text: async () => JSON.stringify(apiErrorPayload)
      });

      const result = await getStoryHandler({ id: mockStoryId });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.content).toBeDefined();
      // The error message from handleApiResponse is a stringified JSON of the enhancedError object
      expect(result.content[0].text).toBe(`Error: ${enhancedErrorString}`);
    });

    it('should return an error if fetch throws an exception (network error)', async () => {
        const mockStoryId = 'exception-id';
        const networkError = new Error('Network connection failed');
        (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

        const result = await getStoryHandler({ id: mockStoryId });

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toBe(`Error: ${networkError.message}`); // Direct error message
    });
  });
});
