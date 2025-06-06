// src/tools/ping.test.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPingTool } from './ping';

// Mock McpServer as done in meta.test.ts
jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  return {
    McpServer: jest.fn().mockImplementation(() => {
      return {
        tool: jest.fn(),
      };
    }),
  };
});

// Mock fetch globally for this test file as ping tool uses it.
global.fetch = jest.fn();

// Mock config
jest.mock('../config/index', () => ({
  config: {
    spaceId: 'test-space-id',
    publicToken: 'test-public-token',
  },
  API_ENDPOINTS: {
    CONTENT: 'https://api.storyblok.com/v2', // Or your actual test endpoint
  },
}));


describe('Ping Tool', () => {
  describe('registerPingTool', () => {
    let mockServerInstance: McpServer;
    let mockToolMethod: jest.Mock;

    beforeEach(() => {
      mockServerInstance = new McpServer({ name: 'test-server', version: '1.0.0' });
      mockToolMethod = mockServerInstance.tool as jest.Mock;
      (global.fetch as jest.Mock).mockClear(); // Clear fetch mock calls before each test
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should register the "ping" tool correctly', () => {
      registerPingTool(mockServerInstance);

      expect(mockToolMethod).toHaveBeenCalledTimes(1);
      expect(mockToolMethod).toHaveBeenCalledWith(
        'ping',
        'Checks server health and Storyblok API connectivity.',
        {},
        expect.any(Function)
      );
    });

    // Test for the handler's successful response
    it('handler for "ping" should return success if Storyblok API is reachable', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}), // Mock what Storyblok might return if needed
        text: async () => ('Some success text body')
      });

      registerPingTool(mockServerInstance);
      const handler = mockToolMethod.mock.calls[0][3];
      const result = await handler();

      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.storyblok.com/v2/spaces/test-space-id/?token=test-public-token`
      );
      expect(result.isError).toBeUndefined();
      expect(result.content).toEqual([
        { type: 'text', text: "Server is running and Storyblok API is reachable." },
      ]);
    });

    // Test for the handler's error response when Storyblok API call fails
    it('handler for "ping" should return error if Storyblok API call is not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'API Error Details',
      });

      registerPingTool(mockServerInstance);
      const handler = mockToolMethod.mock.calls[0][3];
      const result = await handler();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.errorCode).toBe('STORYBLOK_API_ERROR');
      expect(result.content[0].text).toContain('Error: STORYBLOK_API_ERROR - Storyblok API returned an error. Details: Status: 500 Internal Server Error, Body: API Error Details');
    });

    // Test for the handler's error response when fetch itself throws an error
    it('handler for "ping" should return error if fetch throws an exception', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

      registerPingTool(mockServerInstance);
      const handler = mockToolMethod.mock.calls[0][3];
      const result = await handler();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Error: Network failure');
    });
  });
});
