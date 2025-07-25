#!/usr/bin/env node

import fs from "fs";
import path from "path";
import crypto from "crypto";
import minimist from "minimist";
import pLimit from "p-limit";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { Document } from "@langchain/core/documents";

import { ragConfig, clients, LM_STUDIO_URL, LLM_MODEL } from "./config.js";
import { QdrantPersistence } from "./persistence/qdrant.js";
import { 
  ProcessedDocument, 
  CatalogEntry, 
  DocumentChunk,
  RagConfig,
  FileAction,
  FileActionType
} from "./types.js";

// Enhanced Seed Configuration
interface SeedConfig extends RagConfig {
  clientName: string;      // Target client (dal_ben, wintrade, etc.)
  filesDir: string;        // Source documents directory
  overwrite: boolean;      // Force recreation of collections
  validateOnly: boolean;   // Only validate, don't seed
}

// LM Studio LLM for Summary Generation (from lance-mcp pattern)
class LMStudioLLM {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = LM_STUDIO_URL, model: string = LLM_MODEL) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async generateSummary(content: string): Promise<string> {
    const prompt = `Write a one sentence content overview based on the text below. If the text is empty or contains no meaningful content, respond with "Empty file - no content to summarize".

Text:
"${content.slice(0, 4000)}"

CONTENT OVERVIEW (one sentence only):`;

    try {
      console.error(`📝 Generating summary for ${content.slice(0, 50)}...`);

      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 200,
        }),
      });

      if (!response.ok) {
        throw new Error(`LM Studio API failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.choices?.[0]?.message?.content) {
        throw new Error(`Invalid LM Studio response: ${JSON.stringify(data)}`);
      }

      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error("❌ Summary generation failed:", error);
      return "Summary generation failed - using fallback";
    }
  }
}

// Document Processing Engine
class DocumentProcessor {
  private config: SeedConfig;
  private qdrant: QdrantPersistence;
  private llm: LMStudioLLM;
  private limiter: ReturnType<typeof pLimit>;
  private splitter: RecursiveCharacterTextSplitter;

  constructor(config: SeedConfig) {
    this.config = config;
    this.qdrant = new QdrantPersistence();
    this.llm = new LMStudioLLM();
    this.limiter = pLimit(config.concurrency);
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
    });
  }

  async initialize(): Promise<void> {
    await this.qdrant.initialize();
    console.error(`✅ Connected to Qdrant - Client: ${this.config.clientName}`);
  }

  // Load documents from directory (from lance-mcp pattern)
  async loadDocuments(): Promise<Document[]> {
    const loader = new DirectoryLoader(this.config.filesDir, {
    ".pdf": (path: string) => new PDFLoader(path),
    ".md": (path: string) => new TextLoader(path),
    ".txt": (path: string) => new TextLoader(path),
    ".docx": (path: string) => new DocxLoader(path),
    }, true); // recursive = true

    console.error(`📂 Loading documents from ${this.config.filesDir}...`);
    const allDocs = await loader.load();
    
    // Filter out system files like .DS_Store
    const docs = allDocs.filter(doc => 
      !doc.metadata.source.includes('.DS_Store') &&
      !doc.metadata.source.includes('Thumbs.db')
    );
    
    // Clean metadata (from lance-mcp)
    for (const doc of docs) {
      doc.metadata = { 
        loc: doc.metadata.loc, 
        source: doc.metadata.source 
      };
    }

    console.error(`📄 Loaded ${docs.length} documents`);
    return docs;
  }

  // Business Logic Layer: Determine what actions to take for each file
  async determineFileActions(rawDocs: Document[]): Promise<FileAction[]> {
    console.error("🧠 Analyzing file changes...");
    
    const actions: FileAction[] = [];
    const dbSources = await this.qdrant.getAllSourcesFromDB(this.config.clientName);
    const processedSources = new Set<string>();

    // Group documents by source for processing
    const docsBySource = rawDocs.reduce((acc: Record<string, Document[]>, doc) => {
      const source = doc.metadata.source;
      if (!acc[source]) acc[source] = [];
      acc[source].push(doc);
      return acc;
    }, {});

    // Analyze each file found in filesystem
    for (const [source, docs] of Object.entries(docsBySource)) {
      try {
        // Calculate current content hash
        const content = docs.map(d => d.pageContent).join('\n');
        const currentHash = crypto.createHash("sha256").update(content).digest("hex");
        
        // Check what exists in DB
        const dbEntry = await this.qdrant.getDBEntry(source, this.config.clientName);
        
        if (!dbEntry) {
          // New file
          actions.push({ 
            type: 'ADD', 
            source,
            file: await this.createProcessedDocument(source, docs, content, currentHash)
          });
          
          if (this.config.debug) {
            console.error(`📄 NEW: ${source}`);
          }
        } else if (dbEntry.hash !== currentHash) {
          // Modified file
          actions.push({ 
            type: 'UPDATE', 
            source,
            file: await this.createProcessedDocument(source, docs, content, currentHash),
            oldHash: dbEntry.hash
          });
          
          if (this.config.debug) {
            console.error(`📝 MODIFIED: ${source}`);
          }
        } else {
          // Unchanged file
          actions.push({ type: 'SKIP', source });
          
          if (this.config.debug) {
            console.error(`⏭️ SKIP: ${source}`);
          }
        }
        
        processedSources.add(source);
      } catch (error) {
        console.error(`❌ Failed to analyze ${source}:`, error);
      }
    }

    // Check for deleted files (in DB but not in filesystem)
    for (const dbSource of dbSources) {
      if (!processedSources.has(dbSource)) {
        actions.push({ type: 'DELETE', source: dbSource });
        
        if (this.config.debug) {
          console.error(`🗑️ DELETED: ${dbSource}`);
        }
      }
    }

    // Summary
    const summary = actions.reduce((acc, action) => {
      acc[action.type] = (acc[action.type] || 0) + 1;
      return acc;
    }, {} as Record<FileActionType, number>);
    
    console.error(`📊 File Analysis: ${JSON.stringify(summary)}`);
    
    return actions;
  }

  // Helper: Create ProcessedDocument from raw documents
  private async createProcessedDocument(
    source: string, 
    docs: Document[], 
    content: string, 
    hash: string
  ): Promise<ProcessedDocument> {
    // Generate overview with LM Studio
    let overview: string | undefined;
    if (content.length > 100) {
      overview = await this.limiter(() => 
        this.llm.generateSummary(content)
      );
    }

    // Split into chunks
    const chunks = await this.splitter.splitDocuments(docs);
    
    return {
      source,
      hash,
      content,
      overview,
      chunks: chunks.map((chunk: any, index: number) => ({
        content: chunk.pageContent,
        index,
        total: chunks.length,
      })),
    };
  }

  // Execute the determined actions
  async executeFileActions(actions: FileAction[]): Promise<void> {
    console.error("⚡ Executing file actions...");
    
    const documentsToProcess: ProcessedDocument[] = [];

    for (const action of actions) {
      switch (action.type) {
        case 'SKIP':
          // Do nothing - skip optimization maintained
          break;
          
        case 'DELETE':
          await this.qdrant.deleteBySource(action.source, this.config.clientName);
          console.error(`🗑️ Deleted: ${action.source}`);
          break;
          
        case 'ADD':
        case 'UPDATE':
          if (action.type === 'UPDATE') {
            // Clean up old version first (removes all chunks + catalog)
            await this.qdrant.deleteBySource(action.source, this.config.clientName);
            if (this.config.debug) {
              console.error(`🧹 Cleaned old version: ${action.source}`);
            }
          }
          
          // Queue for batch processing
          if (action.file) {
            documentsToProcess.push(action.file);
          }
          break;
      }
    }

    // Batch process ADD/UPDATE actions (maintains existing efficient pipeline)
    if (documentsToProcess.length > 0) {
      const { catalogEmbeddings, chunkEmbeddings } = await this.generateAllEmbeddings(documentsToProcess);
      await this.seedDocuments(documentsToProcess, catalogEmbeddings, chunkEmbeddings);
    }

    console.error(`✅ Actions completed: ${actions.length} total`);
  }

  // Batch generate embeddings (from sqlite-vss optimizations)
  async generateAllEmbeddings(documents: ProcessedDocument[]): Promise<{
    catalogEmbeddings: Map<string, number[]>;
    chunkEmbeddings: Map<string, number[][]>;
  }> {
    console.error("🧠 Generating embeddings...");
    
    const catalogEmbeddings = new Map<string, number[]>();
    const chunkEmbeddings = new Map<string, number[][]>();

    // Generate catalog embeddings (for overviews)
    const catalogPromises = documents
      .filter(doc => doc.overview && doc.overview.trim().length > 0)
      .map(doc => 
        this.limiter(async () => {
          try {
            const embedding = await this.qdrant['embeddings'].embedQuery(doc.overview!);
            catalogEmbeddings.set(doc.source, embedding);
          } catch (error) {
            console.error(`❌ Failed to embed overview for ${doc.source}:`, error);
          }
        })
      );

    await Promise.all(catalogPromises);

    // Generate chunk embeddings in batches (from sqlite-vss)
    for (const doc of documents) {
      if (doc.chunks.length === 0) continue;

      const texts = doc.chunks.map(c => c.content);
      const embeddingsForDoc: number[][] = [];

      // Process in batches
      for (let i = 0; i < texts.length; i += this.config.batchSize) {
        const batch = texts.slice(i, i + this.config.batchSize);
        
        try {
          const batchEmbeds = await this.limiter(() =>
            this.qdrant['embeddings'].embedDocuments(batch)
          );
          embeddingsForDoc.push(...batchEmbeds);
        } catch (error) {
          console.error(`❌ Failed to embed chunks for ${doc.source}:`, error);
          // Add empty embeddings as fallback
          embeddingsForDoc.push(...Array(batch.length).fill([]));
        }
      }

      chunkEmbeddings.set(doc.source, embeddingsForDoc);
    }

    return { catalogEmbeddings, chunkEmbeddings };
  }

  // Seed into Qdrant collections (smart transaction pattern from sqlite-vss)
  async seedDocuments(
    documents: ProcessedDocument[],
    catalogEmbeddings: Map<string, number[]>,
    chunkEmbeddings: Map<string, number[][]>
  ): Promise<void> {
    console.error("💾 Seeding to Qdrant collections...");

    let catalogCount = 0;
    let chunkCount = 0;

    // Process catalog entries
    for (const doc of documents) {
      if (!doc.overview) continue;

      const embedding = catalogEmbeddings.get(doc.source);
      if (!embedding) continue;

      try {
        const catalogEntry: CatalogEntry = {
          source: doc.source,
          hash: doc.hash,
          content: doc.content,
          overview: doc.overview,
          created_at: new Date().toISOString(),
        };

        await this.qdrant.storeCatalogEntry(catalogEntry, this.config.clientName);
        catalogCount++;

        if (this.config.debug) {
          console.error(`✅ Catalog: ${doc.source}`);
        }
      } catch (error) {
        console.error(`❌ Failed to store catalog entry for ${doc.source}:`, error);
      }
    }

    // Process document chunks
    for (const doc of documents) {
      const embeddings = chunkEmbeddings.get(doc.source);
      if (!embeddings) continue;

      for (let i = 0; i < doc.chunks.length; i++) {
        const chunk = doc.chunks[i];
        const embedding = embeddings[i];
        
        if (!embedding || embedding.length === 0) continue;

        try {
          const documentChunk: DocumentChunk = {
            source: doc.source,
            hash: doc.hash,
            content: doc.content,
            chunk_index: chunk.index,
            chunk_total: chunk.total,
            chunk_content: chunk.content,
            created_at: new Date().toISOString(),
          };

          await this.qdrant.storeDocumentChunk(documentChunk, this.config.clientName);
          chunkCount++;
        } catch (error) {
          console.error(`❌ Failed to store chunk ${i} for ${doc.source}:`, error);
        }
      }

      if (this.config.debug) {
        console.error(`✅ Chunks: ${doc.source} (${doc.chunks.length} chunks)`);
      }
    }

    console.error(`🎉 Seeding complete!`);
    console.error(`📊 Results: ${catalogCount} catalog entries, ${chunkCount} chunks`);
  }

  // Main processing pipeline
  async process(): Promise<void> {
    try {
      // Initialize
      await this.initialize();

      // Load documents
      const rawDocs = await this.loadDocuments();
      if (rawDocs.length === 0) {
        console.error("⚠️  No documents found!");
        return;
      }

      // NEW: Business Logic Layer - Determine what actions to take
      const actions = await this.determineFileActions(rawDocs);
      if (actions.length === 0) {
        console.error("⚠️  No actions to perform!");
        return;
      }

      if (this.config.validateOnly) {
        const processableActions = actions.filter(a => a.type === 'ADD' || a.type === 'UPDATE');
        console.error(`✅ Validation complete: ${processableActions.length} documents ready for processing`);
        return;
      }

      // NEW: Execute the determined actions (replaces old processDocuments + seedDocuments)
      await this.executeFileActions(actions);

    } catch (error) {
      console.error("💥 Processing failed:", error);
      throw error;
    }
  }
}

// CLI Interface
function validateArgs() {
  const argv = minimist(process.argv.slice(2), {
    boolean: ["overwrite", "validate-only", "debug"],
  });

  if (!argv.client || !argv.filesdir) {
    console.error(`
❌ Missing required arguments!

Usage: npm run seed -- --client <client_name> --filesdir <path> [options]

Required:
  --client      Client name (${clients.join(', ')})
  --filesdir    Path to documents directory

Options:
  --overwrite     Force overwrite existing data
  --validate-only Only validate documents, don't seed
  --debug         Enable debug logging

Examples:
  npm run seed -- --client dal_ben --filesdir /path/to/docs
  npm run seed -- --client wintrade --filesdir /path/to/docs --overwrite
  npm run seed -- --client personale --filesdir /path/to/docs --validate-only
`);
    process.exit(1);
  }

  if (!clients.includes(argv.client)) {
    console.error(`❌ Invalid client: ${argv.client}`);
    console.error(`✅ Valid clients: ${clients.join(', ')}`);
    process.exit(1);
  }

  if (!fs.existsSync(argv.filesdir)) {
    console.error(`❌ Directory not found: ${argv.filesdir}`);
    process.exit(1);
  }

  const config: SeedConfig = {
    ...ragConfig,
    clientName: argv.client,
    filesDir: path.resolve(argv.filesdir),
    overwrite: argv.overwrite || false,
    validateOnly: argv['validate-only'] || false,
    debug: argv.debug || ragConfig.debug,
  };

  return config;
}

// Main execution
async function main() {
  console.error("🚀 Qdrant RAG Seeder v2.0");
  console.error("=".repeat(50));

  try {
    const config = validateArgs();
    
    console.error(`📋 Configuration:`);
    console.error(`   Client: ${config.clientName}`);
    console.error(`   Files: ${config.filesDir}`);
    console.error(`   Overwrite: ${config.overwrite}`);
    console.error(`   Validate Only: ${config.validateOnly}`);
    console.error(`   Debug: ${config.debug}`);
    console.error(`   Concurrency: ${config.concurrency}`);
    console.error(`   Batch Size: ${config.batchSize}`);
    console.error("");

    const processor = new DocumentProcessor(config);
    await processor.process();

    console.error("🎉 Success!");
  } catch (error) {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("💥 Unhandled error:", error);
    process.exit(1);
  });
}

export { DocumentProcessor, SeedConfig };
