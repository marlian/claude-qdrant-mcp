import { RagConfig, CollectionConfig } from './types.js';

// Enhanced RAG Configuration for LM Studio + Multi-Collection Qdrant
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || "http://127.0.0.1:1235";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-finetuned-bge-m3";
const EMBEDDING_DIM = parseInt(process.env.EMBEDDING_DIM || "1024", 10);
const LLM_MODEL = process.env.LLM_MODEL || "google/gemma-3n-e4b";

// Qdrant Configuration
const QDRANT_URL = process.env.QDRANT_URL;
if (!QDRANT_URL) {
  console.error("Error: QDRANT_URL environment variable is required");
  process.exit(1);
}

const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
// Note: QDRANT_API_KEY is optional for local instances

// Multi-collection setup for client isolation
const CLIENT_COLLECTIONS = process.env.CLIENT_COLLECTIONS || "work,personal,research,projects";
const clients = CLIENT_COLLECTIONS.split(',').map(name => name.trim());

// Generate collection configurations
const collections: CollectionConfig[] = [];
for (const client of clients) {
  collections.push(
    {
      name: `${client}_catalog`,
      type: 'catalog',
      client,
      description: `Document catalog for ${client}`,
    },
    {
      name: `${client}_chunks`,
      type: 'chunks',
      client,
      description: `Document chunks for ${client}`,
    }
  );
}

// Performance and processing configuration
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "5", 10);
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "10", 10);
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || "1000", 10);
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || "80", 10);
const DEBUG = process.env.DEBUG === "true";

// Complete RAG configuration
export const ragConfig: RagConfig = {
  collections,
  embeddingModel: EMBEDDING_MODEL,
  embeddingDim: EMBEDDING_DIM,
  llmModel: LLM_MODEL,
  lmStudioUrl: LM_STUDIO_URL,
  concurrency: CONCURRENCY,
  batchSize: BATCH_SIZE,
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
  debug: DEBUG,
};

// Legacy exports for backward compatibility (temporary)
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ""; // Stub for old code
export const COLLECTION_NAME = collections[0]?.name || "default"; // Use first collection as default
export { QDRANT_URL, QDRANT_API_KEY };

// New enhanced exports
export {
  LM_STUDIO_URL,
  EMBEDDING_MODEL,
  EMBEDDING_DIM,
  LLM_MODEL,
  collections,
  clients,
};