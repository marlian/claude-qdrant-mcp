import { validateCatalogSearchRequest, validateChunksSearchRequest, validateAllChunksSearchRequest } from './index.js';
import { RagManager } from './index.js';

const ragManager = new RagManager();
let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    await ragManager.initialize();
    initialized = true;
  }
}

export async function catalogSearchHandler(args: Record<string, unknown>) {
  await ensureInitialized();
  const validated = validateCatalogSearchRequest(args);
  return await ragManager.searchCatalog(
    validated.query,
    validated.client,
    validated.limit || 10
  );
}

export async function chunksSearchHandler(args: Record<string, unknown>) {
  await ensureInitialized();
  const validated = validateChunksSearchRequest(args);
  return await ragManager.searchChunks(
    validated.query,
    validated.client,
    validated.source,
    validated.limit || 10
  );
}

export async function allChunksSearchHandler(args: Record<string, unknown>) {
  await ensureInitialized();
  const validated = validateAllChunksSearchRequest(args);
  return await ragManager.searchAllChunks(
    validated.query,
    validated.limit || 10
  );
}

export async function collectionInfoHandler(args: Record<string, unknown>) {
  await ensureInitialized();
  return await ragManager.getCollectionInfo();
}