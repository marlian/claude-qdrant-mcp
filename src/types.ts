// RAG Document Types - Inspired by lance-mcp architecture
export interface Document {
  source: string;           // Full path to source file
  hash: string;            // SHA256 hash for duplicate detection
  content: string;         // Full document content
  created_at?: string;     // ISO timestamp
}

export interface CatalogEntry extends Document {
  overview: string;        // LLM-generated summary of document
}

export interface DocumentChunk extends Document {
  chunk_index: number;     // Position in document (0-based)
  chunk_total: number;     // Total chunks for this document
  chunk_content: string;   // The actual chunk text content
}

// Multi-collection support for client isolation
export interface CollectionConfig {
  name: string;           // Collection name (e.g., "dal_ben_catalog")
  type: 'catalog' | 'chunks';
  client: string;         // Client identifier (e.g., "dal_ben")
  description?: string;   // Human-readable description
}

// Search results for RAG queries
export interface SearchResult {
  type: 'catalog' | 'chunk';
  score: number;
  source: string;
  content: string;
  metadata: {
    chunk_index?: number;
    chunk_total?: number;
    overview?: string;
    collection: string;
  };
}

// Batch processing for efficient seeding
export interface ProcessedDocument {
  source: string;
  hash: string;
  content: string;
  overview?: string;
  chunks: {
    content: string;
    index: number;
    total: number;
  }[];
}

// Enhanced config for multi-client RAG
export interface RagConfig {
  collections: CollectionConfig[];
  embeddingModel: string;
  embeddingDim: number;
  llmModel: string;
  lmStudioUrl: string;
  concurrency: number;
  batchSize: number;
  chunkSize: number;
  chunkOverlap: number;
  debug: boolean;
}

// File action types for business logic layer
export type FileActionType = 'ADD' | 'UPDATE' | 'SKIP' | 'DELETE';

export interface FileAction {
  type: FileActionType;
  source: string;
  file?: ProcessedDocument;  // Present for ADD/UPDATE actions
  oldHash?: string;          // Present for UPDATE actions
}

// LEGACY TYPES - Remove after transformation complete
export interface Entity extends Record<string, unknown> {
  name: string;
  entityType: string;
  observations: string[];
}

export interface Relation extends Record<string, unknown> {
  from: string;
  to: string;
  relationType: string;
}

export interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}