// src/tools/index.ts

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPingTool } from './ping';
import { registerStoryTools } from './stories';
import { registerReleaseTools } from './releases';
import { registerTagTools } from './tags';
import { registerAssetTools } from './assets';
import { registerComponentTools } from './components';
import { registerSearchTools } from './search';
import { registerSpaceTools } from './space';
import { registerMetaTools, ToolInfo } from './meta'; // Import ToolInfo

/**
 * Register all available tools with the MCP server
 */
export function registerAllTools(server: McpServer) {
  const registeredToolsInfo: ToolInfo[] = [];

  // Manually gather tool info.
  // For ping tool
  registeredToolsInfo.push({ name: 'ping', description: 'Checks if the server is alive and responding.' });
  registerPingTool(server);
  
  // For list_tools itself - it's part of the meta tools.
  // Its definition will be added to the list before calling registerMetaTools.
  // The description for list_tools is defined in meta.ts, so we use that.
  const listToolsInfo: ToolInfo = { name: 'list_tools', description: 'Lists all available tools with their names and descriptions.' };
  // Add it to the list so it can describe itself.
  registeredToolsInfo.push(listToolsInfo);

  // Content management
  registerStoryTools(server);
  // Assuming registerStoryTools registers 'get_story' and 'create_story'
  // We need to manually add their info here.
  registeredToolsInfo.push({ name: 'get_story', description: 'Retrieves a story by its ID.' }); // Placeholder description
  registeredToolsInfo.push({ name: 'create_story', description: 'Creates a new story.' }); // Placeholder description
  
  registerTagTools(server);
  // Assuming registerTagTools registers 'get_tag', 'list_tags'
  registeredToolsInfo.push({ name: 'get_tag', description: 'Retrieves a tag by its ID.' }); // Placeholder
  registeredToolsInfo.push({ name: 'list_tags', description: 'Lists all tags.' }); // Placeholder

  // Publishing workflows
  registerReleaseTools(server);
  // Assuming 'create_release', 'get_release'
  registeredToolsInfo.push({ name: 'create_release', description: 'Creates a new release.' }); // Placeholder
  registeredToolsInfo.push({ name: 'get_release', description: 'Retrieves a release by its ID.' }); // Placeholder
  
  // Media management
  registerAssetTools(server);
  // Assuming 'upload_asset', 'get_asset'
  registeredToolsInfo.push({ name: 'upload_asset', description: 'Uploads a new asset.' }); // Placeholder
  registeredToolsInfo.push({ name: 'get_asset', description: 'Retrieves an asset by its ID.' }); // Placeholder
  
  // Schema management
  registerComponentTools(server);
  // Assuming 'get_component_definition', 'list_component_definitions'
  registeredToolsInfo.push({ name: 'get_component_definition', description: 'Retrieves a component definition.' }); // Placeholder
  registeredToolsInfo.push({ name: 'list_component_definitions', description: 'Lists all component definitions.' }); // Placeholder
  
  // Content discovery
  registerSearchTools(server);
  // Assuming 'search_content'
  registeredToolsInfo.push({ name: 'search_content', description: 'Searches content across the platform.' }); // Placeholder
  
  // Space management
  registerSpaceTools(server);
  // Assuming 'get_space', 'list_spaces'
  registeredToolsInfo.push({ name: 'get_space', description: 'Retrieves a space by its ID.' }); // Placeholder
  registeredToolsInfo.push({ name: 'list_spaces', description: 'Lists all spaces.' }); // Placeholder

  // Register Meta Tools LAST, and pass the collected info
  // This ensures list_tools itself and all previously registered tools are in the list.
  registerMetaTools(server, registeredToolsInfo);
}
