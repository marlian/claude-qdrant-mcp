import { QdrantClient } from "@qdrant/js-client-rest";
import crypto from "crypto";
import {
  QDRANT_URL,
  QDRANT_API_KEY,
  ragConfig,
  LM_STUDIO_URL,
  EMBEDDING_MODEL,
  EMBEDDING_DIM
} from "../config.js";
import { 
  CatalogEntry, 
  DocumentChunk, 
  SearchResult, 
  CollectionConfig 
} from "../types.js";

// LM Studio Embeddings Class (from lance-mcp pattern)
class LMStudioEmbeddings {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = LM_STUDIO_URL, model: string = EMBEDDING_MODEL) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
      }),
    });

    if (!response.ok) {
      throw new Error(`LM Studio embeddings failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.map((item: any) => item.embedding);
  }

  async embedQuery(text: string): Promise<number[]> {
    const [embedding] = await this.embedDocuments([text]);
    return embedding;
  }
}

// Enhanced Qdrant client for multi-collection RAG
export class QdrantPersistence {
  public client: QdrantClient;  // Made public for hash optimization access
  private embeddings: LMStudioEmbeddings;
  private initialized: boolean = false;
  private collections: Map<string, CollectionConfig> = new Map();

  constructor() {
    if (!QDRANT_URL) {
      throw new Error("QDRANT_URL environment variable is required");
    }

    // Validate QDRANT_URL format
    if (!QDRANT_URL.startsWith("http://") && !QDRANT_URL.startsWith("https://")) {
      throw new Error("QDRANT_URL must start with http:// or https://");
    }

    const parsed = new URL(QDRANT_URL);
    this.client = new QdrantClient({
      url: `${parsed.protocol}//${parsed.hostname}`,
      port: parsed.port ? parseInt(parsed.port) : 6333,
      https: parsed.protocol === 'https:',
      apiKey: QDRANT_API_KEY,
      timeout: 60000,
    });

    this.embeddings = new LMStudioEmbeddings();
    
    // Register all collections from config
    for (const collection of ragConfig.collections) {
      this.collections.set(collection.name, collection);
    }
  }

  async connect() {
    if (this.initialized) return;

    // Connection retry logic with exponential backoff
    let retries = 3;
    let delay = 2000;

    while (retries > 0) {
      try {
        await this.client.getCollections();
        this.initialized = true;
        if (ragConfig.debug) {
          console.error("✅ Connected to Qdrant");
        }
        break;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`❌ Qdrant connection failed: ${message}`);
        
        retries--;
        if (retries === 0) {
          throw new Error(`Failed to connect to Qdrant: ${message}`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }

  async initialize() {
    await this.connect();

    // Create all collections if they don't exist
    const existingCollections = await this.client.getCollections();
    const existingNames = new Set(existingCollections.collections.map(c => c.name));

    for (const collection of ragConfig.collections) {
      if (!existingNames.has(collection.name)) {
        await this.createCollection(collection.name);
        if (ragConfig.debug) {
          console.error(`✅ Created collection: ${collection.name}`);
        }
      } else {
        // Collection exists, ensure indexes are present
        await this.ensureIndexes(collection.name);
      }
    }
  }

  private async ensureIndexes(collectionName: string) {
    try {
      // Try to create source index if it doesn't exist
      await this.client.createPayloadIndex(collectionName, {
        field_name: "source",
        field_schema: "keyword"
      });
      if (ragConfig.debug) {
        console.error(`✅ Added source index to ${collectionName}`);
      }
    } catch (error: any) {
      // Index might already exist, that's OK
      if (!error.message?.includes('already exists')) {
        if (ragConfig.debug) {
          console.error(`⚠️ Failed to add source index to ${collectionName}:`, error.message);
        }
      }
    }
  }

  private async createCollection(name: string) {
    await this.client.createCollection(name, {
      vectors: {
        size: EMBEDDING_DIM, // BGE-M3: 1024 dimensions
        distance: "Cosine",
      },
    });
    
    // Create indexes for filtering
    await this.client.createPayloadIndex(name, {
      field_name: "hash",
      field_schema: "keyword"
    });
    
    await this.client.createPayloadIndex(name, {
      field_name: "source",
      field_schema: "keyword"
    });
    
    console.error(`✅ Created collection ${name} with hash and source indexes`);
  }

  private async hashString(str: string): Promise<number> {
    const hash = crypto.createHash("sha256");
    hash.update(str);
    const buffer = hash.digest();
    return buffer.readUInt32BE(0);
  }

  // Store catalog entry (document summary)
  async storeCatalogEntry(entry: CatalogEntry, client: string) {
    await this.connect();
    
    const collectionName = `${client}_catalog`;
    if (!this.collections.has(collectionName)) {
      throw new Error(`Collection not found: ${collectionName}`);
    }

    const vector = await this.embeddings.embedQuery(entry.overview);
    const id = await this.hashString(entry.source);

    await this.client.upsert(collectionName, {
      points: [{
        id,
        vector,
        payload: {
          source: entry.source,
          hash: entry.hash,
          content: entry.content,
          overview: entry.overview,
          created_at: entry.created_at || new Date().toISOString(),
          type: "catalog"
        }
      }]
    });
  }

  // Store document chunk
  async storeDocumentChunk(chunk: DocumentChunk, client: string) {
    await this.connect();
    
    const collectionName = `${client}_chunks`;
    if (!this.collections.has(collectionName)) {
      throw new Error(`Collection not found: ${collectionName}`);
    }

    const vector = await this.embeddings.embedQuery(chunk.chunk_content);
    const id = await this.hashString(`${chunk.source}-${chunk.chunk_index}`);

    await this.client.upsert(collectionName, {
      points: [{
        id,
        vector,
        payload: {
          source: chunk.source,
          hash: chunk.hash,
          content: chunk.content,
          chunk_content: chunk.chunk_content,
          chunk_index: chunk.chunk_index,
          chunk_total: chunk.chunk_total,
          created_at: chunk.created_at || new Date().toISOString(),
          type: "chunk"
        }
      }]
    });
  }

  // Search catalog (document summaries)
  async searchCatalog(query: string, client: string, limit: number = 10): Promise<SearchResult[]> {
    // Fresh instance pattern
    const urlString = QDRANT_URL ?? "http://localhost:6333";
    const parsed = new URL(urlString);
    const freshClient = new QdrantClient({
      url: `${parsed.protocol}//${parsed.hostname}`,
      port: parsed.port ? parseInt(parsed.port) : 6333,
      https: parsed.protocol === 'https:',
      apiKey: QDRANT_API_KEY,
      timeout: 60000,
    });
    const freshEmbeddings = new LMStudioEmbeddings();

    const collectionName = `${client}_catalog`;
    const queryVector = await freshEmbeddings.embedQuery(query);

    const results = await freshClient.search(collectionName, {
      vector: queryVector,
      limit,
      with_payload: true,
    });

    if (!results || !Array.isArray(results)) {
      return [];
    }
    return results.map(result => ({
      type: 'catalog' as const,
      score: result.score || 0,
      source: result.payload?.source as string,
      content: result.payload?.overview as string,
      metadata: {
        collection: collectionName,
        overview: result.payload?.overview as string
      }
    }));
  }

  // Search chunks (with optional source filter)
  async searchChunks(query: string, client: string, source?: string, limit: number = 10): Promise<SearchResult[]> {
    // Fresh instance pattern
    const urlString = QDRANT_URL ?? "http://localhost:6333";
    const parsed = new URL(urlString);
    const freshClient = new QdrantClient({
      url: `${parsed.protocol}//${parsed.hostname}`,
      port: parsed.port ? parseInt(parsed.port) : 6333,
      https: parsed.protocol === 'https:',
      apiKey: QDRANT_API_KEY,
      timeout: 60000,
    });
    const freshEmbeddings = new LMStudioEmbeddings();

    const collectionName = `${client}_chunks`;
    const queryVector = await freshEmbeddings.embedQuery(query);

    const searchParams: any = {
      vector: queryVector,
      limit,
      with_payload: true,
    };

    // Add source filter if specified
    if (source) {
      searchParams.filter = {
        must: [{
          key: "source",
          match: { value: source }
        }]
      };
    }

    const results = await freshClient.search(collectionName, searchParams);

    if (!results || !Array.isArray(results)) {
      return [];
    }
    return results.map(result => ({
      type: 'chunk' as const,
      score: result.score || 0,
      source: result.payload?.source as string,
      content: result.payload?.chunk_content as string,
      metadata: {
        collection: collectionName,
        chunk_index: result.payload?.chunk_index as number,
        chunk_total: result.payload?.chunk_total as number
      }
    }));
  }

  // Search all chunks across clients
  async searchAllChunks(query: string, limit: number = 10): Promise<SearchResult[]> {
    // Fresh instance pattern
    const urlString = QDRANT_URL ?? "http://localhost:6333";
    const parsed = new URL(urlString);
    const freshClient = new QdrantClient({
      url: `${parsed.protocol}//${parsed.hostname}`,
      port: parsed.port ? parseInt(parsed.port) : 6333,
      https: parsed.protocol === 'https:',
      apiKey: QDRANT_API_KEY,
      timeout: 60000,
    });
    const freshEmbeddings = new LMStudioEmbeddings();
    try {
      const results: SearchResult[] = [];
      const queryVector = await freshEmbeddings.embedQuery(query);

      // Search across all chunk collections
      const chunkCollections = Array.from(this.collections.values())
        .filter(c => c.type === 'chunks');

      if (!chunkCollections || chunkCollections.length === 0) {
        return [];
      }

      for (const collection of chunkCollections) {
        try {
          const collectionResults = await freshClient.search(collection.name, {
            vector: queryVector,
            limit: Math.ceil(limit / chunkCollections.length),
            with_payload: true,
          });

          if (!collectionResults || !Array.isArray(collectionResults)) {
            continue;
          }
          results.push(...collectionResults.map(result => ({
            type: 'chunk' as const,
            score: result.score || 0,
            source: result.payload?.source as string,
            content: result.payload?.chunk_content as string,
            metadata: {
              collection: collection.name,
              chunk_index: result.payload?.chunk_index as number,
              chunk_total: result.payload?.chunk_total as number
            }
          })));
        } catch (error) {
          if (ragConfig.debug) {
            console.error(`Search failed for collection ${collection.name}:`, error);
          }
        }
      }

      // Sort by score and limit results
      return results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      if (ragConfig.debug) {
        console.error("searchAllChunks failed:", error);
      }
      return [];
    }
  }

  // Delete entry by source (improved implementation)
  async deleteBySource(source: string, client: string) {
    await this.connect();
    
    // Delete from catalog
    try {
      const catalogCollection = `${client}_catalog`;
      await this.client.delete(catalogCollection, {
        filter: {
          must: [{ key: "source", match: { value: source } }]
        }
      });
      
      if (ragConfig.debug) {
        console.error(`✅ Deleted catalog entry for: ${source}`);
      }
    } catch (error) {
      if (ragConfig.debug) {
        console.error(`❌ Failed to delete catalog entry for ${source}:`, error);
      }
    }

    // Delete all chunks for this source
    try {
      const chunksCollection = `${client}_chunks`;
      await this.client.delete(chunksCollection, {
        filter: {
          must: [{ key: "source", match: { value: source } }]
        }
      });
      
      if (ragConfig.debug) {
        console.error(`✅ Deleted chunks for: ${source}`);
      }
    } catch (error) {
      if (ragConfig.debug) {
        console.error(`❌ Failed to delete chunks for ${source}:`, error);
      }
    }
  }

  // Get all sources from database for cleanup detection
  async getAllSourcesFromDB(client: string): Promise<string[]> {
    await this.connect();
    
    const catalogCollection = `${client}_catalog`;
    const sources = new Set<string>();

    try {
      let offset: string | undefined = undefined;
      let hasMore = true;
      
      while (hasMore) {
        const result = await this.client.scroll(catalogCollection, {
          filter: {},
          with_payload: true,
          with_vector: false,
          limit: 100,
          offset: offset,
        });
        
        result.points.forEach(point => {
          if (point.payload?.source) {
            sources.add(point.payload.source as string);
          }
        });
        
        if (result.points.length < 100) {
          hasMore = false;
        } else {
          offset = result.points[result.points.length - 1].id as string;
        }
      }
    } catch (error) {
      if (ragConfig.debug) {
        console.error(`❌ Failed to get sources from DB:`, error);
      }
    }

    return Array.from(sources);
  }

  // Get DB entry for a specific source
  async getDBEntry(source: string, client: string): Promise<{hash: string} | null> {
    await this.connect();
    
    const catalogCollection = `${client}_catalog`;
    
    try {
      const result = await this.client.scroll(catalogCollection, {
        filter: {
          must: [{ key: "source", match: { value: source } }]
        },
        with_payload: true,
        with_vector: false,
        limit: 1,
      });
      
      if (result.points.length > 0) {
        const point = result.points[0];
        return {
          hash: point.payload?.hash as string
        };
      }
      
      return null;
    } catch (error) {
      if (ragConfig.debug) {
        console.error(`❌ Failed to get DB entry for ${source}:`, error);
      }
      return null;
    }
  }

  // Get collection info
  async getCollectionInfo(collectionName: string) {
    await this.connect();
    return await this.client.getCollection(collectionName);
  }

  // List all collections
  async listCollections() {
    await this.connect();
    try {
      const result = await this.client.getCollections();
      if (!result || !result.collections) {
        return {
          collections: [],
          total: 0,
          status: "empty_or_failed"
        };
      }
      return result;
    } catch (error) {
      console.error("Failed to list collections:", error);
      return {
        collections: [],
        total: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
