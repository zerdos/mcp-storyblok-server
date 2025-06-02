# MCP Storyblok Server

A comprehensive Model Context Protocol (MCP) server for Storyblok CMS integration. This server provides tools for managing stories, assets, components, releases, and more through a well-organized, modular architecture.

## Features

- **Story Management**: CRUD operations, publishing, versioning, and lifecycle management
- **Asset Management**: Upload workflows, organization, and folder management
- **Component Management**: Block/component schema management and updates
- **Tag Management**: Organization and categorization of content
- **Release Management**: Scheduled publishing workflows
- **Content Search**: Advanced filtering and content discovery
- **Space Management**: Space-level operations and metadata

## Architecture

The server follows a modular architecture with clear separation of concerns:

```
src/
├── config/           # Configuration and environment setup
├── types/            # TypeScript type definitions
├── utils/            # Shared utilities and API helpers
├── tools/            # Tool implementations organized by feature
│   ├── ping.ts       # Health check
│   ├── stories.ts    # Story management
│   ├── releases.ts   # Release workflows
│   ├── tags.ts       # Tag management
│   ├── assets.ts     # Asset management
│   ├── components.ts # Component management
│   ├── search.ts     # Content discovery
│   ├── space.ts      # Space operations
│   └── index.ts      # Tool registration
└── index.ts          # Main server entry point
```

## Environment Variables

The following environment variables are required:

```bash
STORYBLOK_SPACE_ID=your_space_id
STORYBLOK_MANAGEMENT_TOKEN=your_management_token
STORYBLOK_DEFAULT_PUBLIC_TOKEN=your_public_token
```

## Installation & Setup

1. Install dependencies:
```bash
yarn install
```

2. Build the project:
```bash
yarn build
```

3. Configure environment variables in your MCP client configuration.

## Development

### Building
```bash
yarn build
```

### Type Checking
```bash
yarn tsc --noEmit
```

## Tool Categories

### Basic Tools
- `ping`: Server health check

### Content Management
- `fetch-stories`: List stories with filtering
- `get-story`: Get specific story by ID/slug
- `create-story`: Create new stories
- `update-story`: Update existing stories
- `delete-story`: Delete stories
- `publish-story` / `unpublish-story`: Publishing controls
- `get-story-versions` / `restore-story`: Version management

### Tag Management
- `fetch-tags`: List all tags
- `create-tag`: Create new tags
- `create-tag-and-add-to-story`: Create and assign tags
- `delete-tag`: Remove tags

### Release Management
- `fetch-releases`: List releases
- `create-release`: Create scheduled releases
- `add-story-to-release`: Add content to releases
- `publish-release`: Publish releases
- `delete-release`: Remove releases

### Asset Management
- `fetch-assets`: List assets with filtering
- `get-asset`: Get specific asset details
- `delete-asset`: Remove assets
- `init-asset-upload` / `complete-asset-upload`: Upload workflow
- `fetch-asset-folders`: List asset folders
- `create-asset-folder` / `update-asset-folder` / `delete-asset-folder`: Folder management

### Component Management
- `fetch-components`: List all components
- `get-component`: Get specific component
- `create-component`: Create new components
- `update-component`: Update component schemas
- `delete-component`: Remove components

### Content Discovery
- `search-stories`: Advanced content search
- `get-story-by-slug`: Get content by slug

### Space Management
- `get-space`: Get space information
- `fetch-folders`: List content folders
- `fetch-datasources`: List datasources

## Best Practices Implemented

- **Modular Architecture**: Each tool category is in its own file
- **Type Safety**: Comprehensive TypeScript types for all interfaces
- **Error Handling**: Consistent error handling across all tools
- **Code Reuse**: Shared utilities for common operations
- **Documentation**: Comprehensive inline documentation
- **Configuration Management**: Centralized environment variable handling

## API Coverage

This server provides comprehensive coverage of the Storyblok Management API and Content Delivery API, including:

- Stories API (Management & Delivery)
- Assets API
- Components API
- Releases API
- Tags API
- Space API
- Datasources API

Each tool includes proper error handling, parameter validation, and consistent response formatting.
