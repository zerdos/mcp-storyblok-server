// src/tools/meta.test.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerMetaTools, ToolInfo } from './meta';

// Mock the McpServer
jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  return {
    McpServer: jest.fn().mockImplementation(() => {
      return {
        tool: jest.fn(), // Mock the .tool() method
      };
    }),
  };
});

describe('Meta Tools', () => {
  describe('registerMetaTools', () => {
    let mockServerInstance: McpServer;
    let mockToolMethod: jest.Mock;

    beforeEach(() => {
      // Create a new mock server instance for each test
      mockServerInstance = new McpServer({ name: 'test-server', version: '1.0.0' });
      mockToolMethod = mockServerInstance.tool as jest.Mock;
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should register the "list_tools" tool correctly', () => {
      const sampleToolsInfo: ToolInfo[] = [
        { name: 'tool1', description: 'Description for tool1' },
        { name: 'tool2', description: 'Description for tool2' },
      ];

      registerMetaTools(mockServerInstance, sampleToolsInfo);

      expect(mockToolMethod).toHaveBeenCalledTimes(1);
      expect(mockToolMethod).toHaveBeenCalledWith(
        'list_tools',
        'Lists all available tools with their names and descriptions.',
        {}, // Expecting an empty object for no arguments
        expect.any(Function) // Expecting a function (the handler)
      );
    });

    it('handler for "list_tools" should return formatted tool list', async () => {
      const sampleToolsInfo: ToolInfo[] = [
        { name: 'tool1', description: 'Description for tool1' },
        { name: 'tool2', description: 'Another desc' },
      ];

      registerMetaTools(mockServerInstance, sampleToolsInfo);

      // Get the handler function passed to server.tool
      const handler = mockToolMethod.mock.calls[0][3];
      const result = await handler();

      expect(result.isError).toBeUndefined();
      expect(result.content).toEqual([
        { type: 'text', text: "Available tools:\ntool1: Description for tool1\ntool2: Another desc" },
      ]);
    });

    it('handler for "list_tools" should return specific message if no tool info provided', async () => {
      registerMetaTools(mockServerInstance, []); // Empty array

      const handler = mockToolMethod.mock.calls[0][3];
      const result = await handler();

      expect(result.isError).toBeUndefined();
      expect(result.content).toEqual([
        { type: 'text', text: "Available tools: No tool information was provided to list_tools." },
      ]);
    });
  });
});
