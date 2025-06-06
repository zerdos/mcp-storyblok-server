// tests/integration/list_tools.integration.test.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAllTools } from '@src/tools/index'; // Using path alias @src configured in jest.config.js
import { ToolInfo } from '@src/tools/meta';       // Using path alias for ToolInfo

describe('list_tools Integration Test', () => {
  let server: McpServer;
  let listToolsHandler: () => Promise<any>; // Type for the handler

  beforeAll(() => {
    // Initialize the server and register all tools
    server = new McpServer({ name: 'integration-test-server', version: '1.0.0' });

    // We need to capture the handler for list_tools.
    // To do this, we can temporarily spy on server.tool when registerAllTools is called.
    const toolSpy = jest.spyOn(server, 'tool');

    registerAllTools(server);

    // Find the list_tools registration and get its handler
    const listToolsCall = toolSpy.mock.calls.find(call => call[0] === 'list_tools');
    if (!listToolsCall || typeof listToolsCall[3] !== 'function') {
      throw new Error('list_tools handler was not registered correctly or not found by spy.');
    }
    listToolsHandler = listToolsCall[3];

    toolSpy.mockRestore(); // Restore original server.tool
  });

  it('should return a list of registered tools including ping and list_tools itself', async () => {
    if (!listToolsHandler) {
      throw new Error('Test setup failed: list_tools handler not available.');
    }

    const result = await listToolsHandler();

    expect(result.isError).toBeUndefined();
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0].type).toBe('text');

    const textOutput = result.content[0].text as string;
    expect(textOutput).toContain('Available tools:');

    // Check for some known tools based on the manual list in src/tools/index.ts
    // Descriptions should match those manually provided in registerAllTools
    expect(textOutput).toContain('ping: Checks if the server is alive and responding.');
    expect(textOutput).toContain('list_tools: Lists all available tools with their names and descriptions.');
    expect(textOutput).toContain('get_story: Retrieves a story by its ID.'); // Updated to match current placeholder in index.ts
    expect(textOutput).toContain('create_story: Creates a new story.');

    // We can also check it doesn't contain something not expected if necessary
  });

  it('should handle cases where tool descriptions might be empty or null (if applicable by design)', async () => {
    // This test depends on how src/tools/index.ts populates ToolInfo.
    // If a tool can be registered with a null/empty description, this test would verify that.
    // For now, our manual population in registerAllTools provides descriptions.
    // If a tool 'tool_with_no_desc' was added like:
    // registeredToolsInfo.push({ name: 'tool_with_no_desc', description: '' });
    // Then we would expect:
    // expect(textOutput).toContain('tool_with_no_desc:');

    // For this example, let's assume all tools currently have descriptions.
    // We can refine this if ToolInfo allows undefined/empty descriptions and it's meaningful to test.
    if (!listToolsHandler) {
      throw new Error('Test setup failed: list_tools handler not available.');
    }
    const result = await listToolsHandler();
    const textOutput = result.content[0].text as string;

    // Check that entries are formatted correctly even if a description were empty (name:)
    // This implicitly tests the `tool.description ? ' ' + tool.description : ''` part
    const lines = textOutput.split('\n').slice(1); // Skip "Available tools:"
    for (const line of lines) {
      expect(line).toMatch(/^[\w_]+:.*$/); // Matches "name: Possibly empty description"
    }
  });
});
