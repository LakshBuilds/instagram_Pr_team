// API Provider management - switch between Internal and External (Apify) APIs

export type ApiProvider = 'internal' | 'external';

const API_PROVIDER_KEY = 'instagram_api_provider';

/**
 * Get the currently selected API provider
 */
export function getApiProvider(): ApiProvider {
  const stored = localStorage.getItem(API_PROVIDER_KEY);
  return (stored as ApiProvider) || 'external'; // Default to external (Apify)
}

/**
 * Set the API provider
 */
export function setApiProvider(provider: ApiProvider): void {
  localStorage.setItem(API_PROVIDER_KEY, provider);
  console.log(`🔄 API Provider switched to: ${provider}`);
}

/**
 * Get API provider display name
 */
export function getApiProviderName(provider: ApiProvider): string {
  return provider === 'internal' ? 'Internal API' : 'External API (Apify)';
}

