#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { QdrantPersistence } from './persistence/qdrant.js';
import { SearchResult } from './types.js';
import { ragConfig, clients } from './config.js';

// RAG Query Validation
interface CatalogSearchRequest {
  query: string;
  client?: string;
  limit?: number;
}

interface ChunksSearchRequest {
  query: string;
  client?: string;
  source?: string;
  limit?: number;
}

interface AllChunksSearchRequest {
  query: string;
  limit?: number;
}

export function validateCatalogSearchRequest(args: Record<string, unknown>): CatalogSearchRequest {
  if (typeof args.query !== 'string') {
    throw new Error('Query must be a string');
  }
  
  const request: CatalogSearchRequest = { query: args.query };
  
  if (args.client !== undefined) {
    if (typeof args.client !== 'string') {
      throw new Error('Client must be a string');
    }
    if (!clients.includes(args.client)) {
      throw new Error(`Invalid client. Must be one of: ${clients.join(', ')}`);
    }
    request.client = args.client;
  }
  
  if (args.limit !== undefined) {
    if (typeof args.limit !== 'number' || args.limit < 1 || args.limit > 100) {
      throw new Error('Limit must be a number between 1 and 100');
    }
    request.limit = args.limit;
  }
  
  return request;
}

export function validateChunksSearchRequest(args: Record<string, unknown>): ChunksSearchRequest {
  if (typeof args.query !== 'string') {
    throw new Error('Query must be a string');
  }
  
  const request: ChunksSearchRequest = { query: args.query };
  
  if (args.client !== undefined) {
    if (typeof args.client !== 'string') {
      throw new Error('Client must be a string');
    }
    if (!clients.includes(args.client)) {
      throw new Error(`Invalid client. Must be one of: ${clients.join(', ')}`);
    }
    request.client = args.client;
  }
  
  if (args.source !== undefined) {
    if (typeof args.source !== 'string') {
      throw new Error('Source must be a string');
    }
    request.source = args.source;
  }
  
  if (args.limit !== undefined) {
    if (typeof args.limit !== 'number' || args.limit < 1 || args.limit > 100) {
      throw new Error('Limit must be a number between 1 and 100');
    }
    request.limit = args.limit;
  }
  
  return request;
}

export function validateAllChunksSearchRequest(args: Record<string, unknown>): AllChunksSearchRequest {
  if (typeof args.query !== 'string') {
    throw new Error('Query must be a string');
  }
  
  const request: AllChunksSearchRequest = { query: args.query };
  
  if (args.limit !== undefined) {
    if (typeof args.limit !== 'number' || args.limit < 1 || args.limit > 100) {
      throw new Error('Limit must be a number between 1 and 100');
    }
    request.limit = args.limit;
  }
  
  return request;
}

// RAG Manager for document search operations
// (handler exports rimossi, ora sono in handlers.ts)
export class RagManager {
  private qdrant: QdrantPersistence;

  async searchCatalog(query: string, client?: string, limit: number = 10): Promise<SearchResult[]> {
    if (client) {
      return await this.qdrant.searchCatalog(query, client, limit);
    }
    // Search across all clients if none specified
    const results: SearchResult[] = [];
    for (const clientName of clients) {
      try {
        const clientResults = await this.qdrant.searchCatalog(
          query,
          clientName,
          Math.ceil(limit / clients.length)
        );
        results.push(...clientResults);
      } catch (error) {
        if (ragConfig.debug) {
          console.error(`Search failed for client ${clientName}:`, error);
        }
      }
    }
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  constructor() {
    this.qdrant = new QdrantPersistence();
  }

  async initialize(): Promise<void> {
    await this.qdrant.initialize();
    if (ragConfig.debug) {
      console.error("✅ RAG Manager initialized");
      console.error(`📚 Available clients: ${clients.join(', ')}`);
      console.error(`🗃️ Collections: ${ragConfig.collections.map(c => c.name).join(', ')}`);
    }
  }

  async searchChunks(query: string, client?: string, source?: string, limit: number = 10): Promise<SearchResult[]> {
    if (client) {
      return await this.qdrant.searchChunks(query, client, source, limit);
    }
    
    // Search across all clients if none specified
    const results: SearchResult[] = [];
    for (const clientName of clients) {
      try {
        const clientResults = await this.qdrant.searchChunks(
          query, 
          clientName, 
          source, 
          Math.ceil(limit / clients.length)
        );
        results.push(...clientResults);
      } catch (error) {
        if (ragConfig.debug) {
          console.error(`Search failed for client ${clientName}:`, error);
        }
      }
    }
    
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  async searchAllChunks(query: string, limit: number = 10): Promise<SearchResult[]> {
    try {
      const results = await this.qdrant.searchAllChunks(query, limit);
      if (!results || !Array.isArray(results)) {
        return [];
      }
      return results;
    } catch (error) {
      if (ragConfig.debug) {
        console.error("searchAllChunks failed in RagManager:", error);
      }
      return [];
    }
  }

  async getCollectionInfo() {
    try {
      const info = await this.qdrant.listCollections();
      return {
        total_collections: info.collections?.length || 0,
        available_clients: clients,
        collections: ragConfig.collections.map(c => ({
          name: c.name,
          type: c.type,
          client: c.client,
          description: c.description
        })),
        status: 'error' in info ? "error" : "ok",
        error: 'error' in info ? info.error : null
      };
    } catch (error) {
      return {
        total_collections: 0,
        available_clients: clients,
        collections: [],
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

class RagServer {
  private server: Server;
  private ragManager: RagManager;

  constructor() {
    this.server = new Server(
      {
        name: "qdrant-mcp-hybrid",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    this.ragManager = new RagManager();

    // MCP tool registration
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "catalog_search",
          description: "Search for relevant documents in the catalog (document summaries). Optionally specify a client for focused search.",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query to find relevant documents" },
              client: { type: "string", description: `Optional client name to search within. Available: ${clients.join(', ')}`, enum: clients },
              limit: { type: "number", description: "Maximum number of results (1-100)", default: 10, minimum: 1, maximum: 100 }
            },
            required: ["query"]
          }
        },
        {
          name: "chunks_search",
          description: "Search for relevant document chunks. Supports client and source filtering for precise results.",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query to find relevant content chunks" },
              client: { type: "string", description: `Optional client name to search within. Available: ${clients.join(', ')}`, enum: clients },
              source: { type: "string", description: "Optional source file path to search within specific document" },
              limit: { type: "number", description: "Maximum number of results (1-100)", default: 10, minimum: 1, maximum: 100 }
            },
            required: ["query"]
          }
        },
        {
          name: "all_chunks_search",
          description: "Search across all document chunks from all clients. Best for broad knowledge discovery.",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query to find relevant content across all collections" },
              limit: { type: "number", description: "Maximum number of results (1-100)", default: 10, minimum: 1, maximum: 100 }
            },
            required: ["query"]
          }
        },
        {
          name: "collection_info",
          description: "Get information about available collections and clients",
          inputSchema: {
            type: "object",
            properties: {}
          }
        }
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request: { params: { name: string; arguments?: Record<string, unknown>; }; }) => {
      const args = request.params.arguments || {};
      if (Object.keys(args).length === 0 && ["catalog_search", "chunks_search", "all_chunks_search"].includes(request.params.name)) {
        console.error(`[MCP] Tool '${request.params.name}' called without arguments. Request:`, JSON.stringify(request, null, 2));
        throw new McpError(
          ErrorCode.InvalidParams,
          `Tool '${request.params.name}' requires arguments (e.g. { query: "..." }). Received: ${JSON.stringify(request)}`
        );
      }

      try {
        switch (request.params.name) {
          case "catalog_search": {
            const validated = validateCatalogSearchRequest(args);
            const results = await this.ragManager.searchCatalog(
              validated.query,
              validated.client,
              validated.limit || 10
            );
            return {
              content: [{ type: "text", text: JSON.stringify({ query: validated.query, client: validated.client || "all", total_results: results.length, results }, null, 2) }],
            };
          }
          case "chunks_search": {
            const validated = validateChunksSearchRequest(args);
            const results = await this.ragManager.searchChunks(
              validated.query,
              validated.client,
              validated.source,
              validated.limit || 10
            );
            return {
              content: [{ type: "text", text: JSON.stringify({ query: validated.query, client: validated.client || "all", source: validated.source, total_results: results.length, results }, null, 2) }],
            };
          }
          case "all_chunks_search": {
            const validated = validateAllChunksSearchRequest(args);
            const results = await this.ragManager.searchAllChunks(
              validated.query,
              validated.limit || 10
            );
            return {
              content: [{ type: "text", text: JSON.stringify({ query: validated.query, scope: "all_clients", total_results: results.length, results }, null, 2) }],
            };
          }
          case "collection_info": {
            const info = await this.ragManager.getCollectionInfo();
            return {
              content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
            };
          }
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          error instanceof Error ? error.message : String(error)
        );
      }
    });
  }

  async run() {
    try {
      await this.ragManager.initialize();
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error("🚀 Qdrant MCP Hybrid server running on stdio");
      console.error(`📚 Serving ${clients.length} clients with ${ragConfig.collections.length} collections`);
    } catch (error) {
      console.error("💥 Fatal error running server:", error);
      process.exit(1);
    }
  }
}

// Server startup

// Server startup
const server = new RagServer();
server.run().catch((error) => {
  console.error("💥 Fatal error running server:", error);
  process.exit(1);
});