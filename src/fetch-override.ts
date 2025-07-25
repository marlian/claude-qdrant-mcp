// Configure fetch to always include the api-key header
const originalFetch = globalThis.fetch;
globalThis.fetch = function(input, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('api-key', process.env.QDRANT_API_KEY!);
  return originalFetch(input, { ...init, headers });
};
