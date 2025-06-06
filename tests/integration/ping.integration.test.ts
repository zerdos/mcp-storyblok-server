// tests/integration/ping.integration.test.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPingTool } from '@src/tools/ping'; // Using path alias
// Do NOT import real config here for the test logic itself, let the mock handle it.

// Mock fetch globally for this test file
global.fetch = jest.fn();

// Mock the config module
jest.mock('@src/config/index', () => ({
  config: {
    spaceId: 'mock-space-id',
    publicToken: 'mock-public-token',
    managementToken: 'mock-management-token',
  },
  API_ENDPOINTS: {
    CONTENT: 'https://mockapi.storyblok.com/v2', // Using a distinct mock URL
    MANAGEMENT: 'https://mockmapi.storyblok.com/v1',
  },
  getConfig: () => ({ // Mock getConfig as well for safety
    spaceId: 'mock-space-id',
    publicToken: 'mock-public-token',
    managementToken: 'mock-management-token',
  }),
}));

// Now, after mocks, we can get the mocked values if needed for assertions
// (but ensure this import happens AFTER jest.mock)
import { config as mockedConfig, API_ENDPOINTS as mockedApiEndpoints } from '@src/config/index';


describe('ping Integration Test', () => {
  let server: McpServer;
  let pingHandler: () => Promise<any>; // Type for the handler

  beforeEach(() => {
    // Initialize the server
    server = new McpServer({ name: 'integration-test-ping-server', version: '1.0.0' });

    // Capture the handler for ping tool.
    // Spy on server.tool, register only pingTool, then get its handler.
    const toolSpy = jest.spyOn(server, 'tool');
    registerPingTool(server); // Register only the ping tool

    const pingCall = toolSpy.mock.calls.find(call => call[0] === 'ping');
    if (!pingCall || typeof pingCall[3] !== 'function') {
      throw new Error('ping handler was not registered correctly or not found by spy.');
    }
    pingHandler = pingCall[3];

    toolSpy.mockRestore(); // Restore original server.tool
    (global.fetch as jest.Mock).mockClear(); // Clear fetch mock for each test
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return success when Storyblok API is reachable', async () => {
    if (!pingHandler) throw new Error('Test setup failed: ping handler not available.');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Success from Storyblok' }), // Mock a minimal successful JSON response
      text: async () => ('Storyblok API OK')
    });

    const result = await pingHandler();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      `${mockedApiEndpoints.CONTENT}/spaces/${mockedConfig.spaceId}/?token=${mockedConfig.publicToken}`
    );
    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([
      { type: 'text', text: "Server is running and Storyblok API is reachable." },
    ]);
  });

  it('should return an error when Storyblok API call is not ok', async () => {
    if (!pingHandler) throw new Error('Test setup failed: ping handler not available.');

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Storyblok API Error: Unauthorized Access',
    });

    const result = await pingHandler();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.isError).toBe(true);
    expect(result.errorCode).toBe('STORYBLOK_API_ERROR');
    expect(result.errorMessage).toContain('Storyblok API returned an error. Details: Status: 401 Unauthorized, Body: Storyblok API Error: Unauthorized Access');
    expect(result.content[0].text).toContain('Error: STORYBLOK_API_ERROR - Storyblok API returned an error. Details: Status: 401 Unauthorized, Body: Storyblok API Error: Unauthorized Access');
  });

  it('should return an error when fetch itself throws an exception', async () => {
    if (!pingHandler) throw new Error('Test setup failed: ping handler not available.');

    const networkError = new Error('Network connection failed');
    (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

    const result = await pingHandler();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.isError).toBe(true);
    // The ping tool's catch block directly uses the error message
    expect(result.content[0].text).toBe(`Error: ${networkError.message}`);
  });
});
