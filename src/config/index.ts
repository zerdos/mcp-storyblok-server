import type { StoryblokConfig } from '../types/index.js';

/**
 * Validates and retrieves the Storyblok configuration from environment variables.
 *
 * Ensures that all necessary Storyblok credentials and identifiers are set.
 * Throws an error if any required environment variable is missing, detailing its impact.
 * Logs a confirmation message upon successful loading of the configuration.
 *
 * @returns {StoryblokConfig} The validated Storyblok configuration object.
 * @throws {Error} If a required environment variable is not set.
 */
function validateConfig(): StoryblokConfig {
  const spaceId = process.env.STORYBLOK_SPACE_ID;
  const managementToken = process.env.STORYBLOK_MANAGEMENT_TOKEN;
  const publicToken = process.env.STORYBLOK_DEFAULT_PUBLIC_TOKEN;

  if (!spaceId) {
    throw new Error('STORYBLOK_SPACE_ID environment variable is missing. This is crucial for identifying your Storyblok space and without it, no API communication can occur.');
  }
  if (!managementToken) {
    throw new Error('STORYBLOK_MANAGEMENT_TOKEN environment variable is missing. This token is required for all write operations (e.g., creating/updating stories, assets) via the Management API.');
  }
  if (!publicToken) {
    throw new Error('STORYBLOK_DEFAULT_PUBLIC_TOKEN environment variable is missing. This token is necessary for read operations via the Content Delivery API (e.g., fetching stories for display).');
  }


  return {
    spaceId,
    managementToken,
    publicToken
  };
}

/**
 * Cached configuration instance
 */
let _config: StoryblokConfig | null = null;

/**
 * Gets the validated Storyblok configuration.
 * Uses lazy initialization to avoid failing at module load time.
 * 
 * @returns {StoryblokConfig} The validated Storyblok configuration object.
 */
export function getConfig(): StoryblokConfig {
  if (!_config) {
    _config = validateConfig();
  }
  return _config;
}

/**
 * Legacy export for backward compatibility.
 * Note: This will throw an error if environment variables are not set.
 * Consider using getConfig() for better error handling.
 */
export const config = new Proxy({} as StoryblokConfig, {
  get(target, prop) {
    return getConfig()[prop as keyof StoryblokConfig];
  }
});

/**
 * Defines the base URLs for the Storyblok Management and Content Delivery APIs.
 *
 * - `MANAGEMENT`: URL for the Storyblok Management API (v1).
 * - `CONTENT`: URL for the Storyblok Content Delivery API (v2).
 */
export const API_ENDPOINTS = {
  MANAGEMENT: 'https://mapi.storyblok.com/v1',
  CONTENT: 'https://api.storyblok.com/v2'
} as const;
