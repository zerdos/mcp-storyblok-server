import { config, API_ENDPOINTS } from '../config/index';

// Helper function to handle API responses
export async function handleApiResponse(response: Response, endpoint: string) { // Added endpoint parameter
  if (!response.ok) {
    const errorText = await response.text();
    // Attempt to parse errorText if it's JSON, otherwise use it as a string
    let errorDetails;
    try {
      errorDetails = JSON.parse(errorText);
    } catch (e) {
      errorDetails = errorText;
    }

    let suggestedFix = "Unknown error, please check the details.";
    switch (response.status) {
      case 401:
        suggestedFix = "Check if the API token is correct and has not expired.";
        break;
      case 403:
        suggestedFix = "Check token permissions. Ensure the token has the necessary access rights for this operation on the specified space.";
        break;
      case 404:
        suggestedFix = "The requested resource was not found. Please check the endpoint and resource ID.";
        break;
      // Add more cases as needed
    }

    const enhancedError = {
      error: `${response.status} ${response.statusText}`,
      details: errorDetails, // This could be the parsed JSON or the raw text
      context: {
        endpoint,
        spaceId: config.spaceId, // Assuming config.spaceId is available
        tokenPermissions: "unknown", // Placeholder
        requiredPermissions: "unknown", // Placeholder
        suggestedFix,
      }
    };
    throw new Error(JSON.stringify(enhancedError)); // Throw the stringified JSON object
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
