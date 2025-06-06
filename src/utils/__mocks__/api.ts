export const handleApiResponse = jest.fn();
export const getManagementHeaders = jest.fn(() => ({ 'Authorization': 'test-token' }));
export const buildManagementUrl = jest.fn((path) => `https://api.storyblok.com/v1/spaces/00000${path}`);
export const createPaginationParams = jest.fn((page = 1, per_page = 25) => {
  const params = new URLSearchParams();
  if (page) params.append('page', page.toString());
  if (per_page) params.append('per_page', per_page.toString());
  return params;
});
export const addOptionalParams = jest.fn((urlParams, options) => {
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      urlParams.append(key, String(value));
    }
  });
});
