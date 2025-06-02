import type { StoryblokConfig } from '../types/index.js';

// Environment variables validation
function validateConfig(): StoryblokConfig {
  const spaceId = process.env.STORYBLOK_SPACE_ID;
  const managementToken = process.env.STORYBLOK_MANAGEMENT_TOKEN;
  const publicToken = process.env.STORYBLOK_DEFAULT_PUBLIC_TOKEN;

  if (!spaceId) {
    throw new Error('STORYBLOK_SPACE_ID environment variable is required');
  }
  if (!managementToken) {
    throw new Error('STORYBLOK_MANAGEMENT_TOKEN environment variable is required');
  }
  if (!publicToken) {
    throw new Error('STORYBLOK_DEFAULT_PUBLIC_TOKEN environment variable is required');
  }

  return {
    spaceId,
    managementToken,
    publicToken
  };
}

export const config = validateConfig();

// Base URLs for Storyblok APIs
export const API_ENDPOINTS = {
  MANAGEMENT: 'https://mapi.storyblok.com/v1',
  CONTENT: 'https://api.storyblok.com/v2'
} as const;
