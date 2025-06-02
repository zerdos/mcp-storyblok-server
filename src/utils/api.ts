import { config, API_ENDPOINTS } from '../config/index.js';

// Helper function to handle API responses
export async function handleApiResponse(response: Response) {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }
  return response.json();
}

// Helper function to create management API headers
export function getManagementHeaders() {
  return {
    'Authorization': config.managementToken,
    'Content-Type': 'application/json'
  };
}

// Helper function to create content API headers
export function getContentHeaders() {
  return {
    'Content-Type': 'application/json'
  };
}

// Helper function to build management API URL
export function buildManagementUrl(endpoint: string): string {
  return `${API_ENDPOINTS.MANAGEMENT}/spaces/${config.spaceId}${endpoint}`;
}

// Helper function to build content API URL
export function buildContentUrl(endpoint: string): string {
  return `${API_ENDPOINTS.CONTENT}/cdn${endpoint}`;
}

// Helper function to create URL search params with pagination
export function createPaginationParams(page = 1, per_page = 25): URLSearchParams {
  return new URLSearchParams({
    page: page.toString(),
    per_page: Math.min(per_page, 100).toString()
  });
}

// Helper function to add optional parameters to URLSearchParams
export function addOptionalParams(
  params: URLSearchParams,
  options: Record<string, string | number | boolean | undefined>
): void {
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      params.append(key, String(value));
    }
  });
}
