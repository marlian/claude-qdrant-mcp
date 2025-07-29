[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/Built%20with-TypeScript-3178c6.svg)](https://www.typescriptlang.org/)
[![Qdrant](https://img.shields.io/badge/Vector%20Search-Qdrant-6f42c1.svg)](https://qdrant.tech/)
[![Local-First](https://img.shields.io/badge/Privacy-Local--First-blueviolet.svg)](#)
[![LM Studio](https://img.shields.io/badge/LLM-LM%20Studio-ff69b4.svg)](https://lmstudio.ai/)
[![smithery badge](https://smithery.ai/badge/@marlian/claude-qdrant-mcp)](https://smithery.ai/server/@marlian/claude-qdrant-mcp)

# 🚀 Qdrant MCP Hybrid - Ultimate RAG System

> **The most advanced TypeScript MCP server for Qdrant with multi-client isolation, LM Studio integration, and enterprise-grade document processing**

## 🌟 What is This?

This is the **ultimate evolution** of RAG (Retrieval-Augmented Generation) systems, combining the best practices from:

- **lance-mcp** architecture & document processing
- **sqlite-vss-mcp** performance optimizations & concurrency  
- **delorenj/mcp-qdrant-memory** TypeScript foundation & MCP integration

**Result:** A production-ready, multi-tenant RAG system with client isolation, advanced seeding, and LM Studio integration.

## ⚡ Key Features

### 🏢 **Multi-Client Architecture**
- **Complete isolation** between clients - perfect for agencies, consultants, or organizations managing multiple projects
- **Separate collections** for each client: `{client}_catalog` + `{client}_chunks`
- **Privacy-first** design for sensitive documents

### 🧠 **LM Studio Integration** 
- **BGE-M3 embeddings** (1024 dimensions) for semantic search
- **Qwen3-8B summaries** for document overviews
- **Zero cloud dependency** - everything runs locally for maximum privacy

### 🚀 **Advanced Document Processing**
- **SHA256 deduplication** - never process the same document twice (90%+ time savings on updates)
- **Multi-format support** - PDF, Markdown, TXT, DOCX
- **Incremental updates** - only process changed files
- **Batch processing** - efficient API usage with p-limit concurrency control

### 🔍 **Enterprise Search**
- **Semantic catalog search** - find documents by meaning, not just keywords
- **Granular chunk search** - search within specific documents  
- **Cross-client search** - find information across all clients
- **Rich metadata** - source tracking, chunk indexing, similarity scores

## 🚀 Quick Install via NPM

### Global Installation (Recommended)

```bash
# Install globally for easy project setup
npm install -g claude-qdrant-mcp

# Create new project
mkdir my-rag-project
cd my-rag-project
qdrant-setup

# Or use the interactive setup
npm run setup
```

### Local Project Installation

```bash
# Install in existing project
npm install claude-qdrant-mcp

# Run interactive setup
npx qdrant-setup
```

### What the Auto-Setup Does

✅ **Dependency Check** - Verifies Node.js, Qdrant, and LM Studio  
✅ **Environment Config** - Interactive `.env` file creation  
✅ **Claude Desktop Integration** - Automatic MCP server configuration  
✅ **Sample Documents** - Creates test files for immediate use  
✅ **Connection Testing** - Validates all services are working  

### One-Command Install & Test

```bash
# Complete setup and test in one go
npm install -g claude-qdrant-mcp && \
mkdir my-rag && cd my-rag && \
qdrant-setup && \
npm run test-connection
```

### Available Commands

After installation, you have access to:

```bash
# Interactive setup wizard
qdrant-setup

# Test all connections
npm run test-connection

# Seed documents
npm run seed -- --client work --filesdir ./documents

# Start MCP server
npm start

# Development mode
npm run watch
```

---

## � Table of Contents

- [🌟 What is This?](#-what-is-this)
- [⚡ Key Features](#-key-features)
- [🚀 Quick Install via NPM](#-quick-install-via-npm)
- [🛠️ Manual Installation & Setup](#️-manual-installation--setup)
- [🚀 LM Studio Setup](#-lm-studio-setup)
- [📊 Usage Examples](#-usage-examples)
- [🏗️ Architecture Deep Dive](#️-architecture-deep-dive)
- [🎯 Performance & Scalability](#-performance--scalability)
- [🔍 Troubleshooting](#-troubleshooting)
- [🚀 Development](#-development)
- [📈 Migration from Other Systems](#-migration-from-other-systems)
- [🔐 Privacy & Security](#-privacy--security)
- [🛣️ Roadmap](#-roadmap)
- [📚 Documentation](#-Extended-Documentation)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [🙏 Acknowledgments](#-acknowledgments)
- [📞 Support](#-support)

## 🛠️ Manual Installation & Setup

### Prerequisites
- **Node.js 18+**
- **LM Studio** running locally with BGE-M3 + Qwen3 models
- **Qdrant** server (local Docker or Qdrant Cloud)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/marlian/claude-qdrant-mcp.git
cd claude-qdrant-mcp

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Build the project
npm run build

# Test with help
npm run seed -- --help
```

### Environment Configuration

Create a `.env` file with your settings:

```bash
# Qdrant Configuration
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-api-key-if-using-cloud

# LM Studio Configuration  
LM_STUDIO_URL=http://127.0.0.1:1235
EMBEDDING_MODEL=text-embedding-finetuned-bge-m3
EMBEDDING_DIM=1024
LLM_MODEL=qwen/qwen3-8b

# Multi-Client Setup (customize with your client names)
CLIENT_COLLECTIONS=client_a,client_b,personal,work,research

# Performance Tuning
CONCURRENCY=5
BATCH_SIZE=10
CHUNK_SIZE=500
CHUNK_OVERLAP=10
DEBUG=false
```

## 🚀 LM Studio Setup

### Required Models

1. **BGE-M3 Embedding Model**
   - Download from LM Studio model library
   - Model name: `text-embedding-finetuned-bge-m3`
   - Purpose: Generate 1024-dim embeddings for semantic search

2. **Qwen3-8B Chat Model**
   - Download from LM Studio model library  
   - Model name: `qwen/qwen3-8b`
   - Purpose: Generate document summaries

### LM Studio Configuration

1. Start LM Studio
2. Load both models
3. Start the server (default port 1235)
4. Verify connection: `curl http://127.0.0.1:1235/v1/models`

## 📊 Usage Examples

### Document Seeding

```bash
# Seed documents for specific client
npm run seed -- --client work --filesdir /path/to/work/documents

# Force overwrite existing data (full reprocessing)
npm run seed -- --client personal --filesdir /path/to/personal/docs --overwrite

# Validate documents without seeding  
npm run seed -- --client research --filesdir /path/to/research/docs --validate-only

# Debug mode for troubleshooting
npm run seed -- --client client_a --filesdir /path/to/docs --debug
```

### MCP Server Usage

```bash
# Run the MCP server
npm start

# Or in development mode with watch
npm run watch
```

### Claude Desktop Integration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "qdrant-rag": {
      "command": "node",
      "args": ["/absolute/path/to/claude-qdrant-mcp/dist/index.js"],
      "env": {
        "QDRANT_URL": "http://localhost:6333",
        "QDRANT_API_KEY": "your-api-key-if-needed",
        "CLIENT_COLLECTIONS": "work,personal,research"
      }
    }
  }
}
```

## 🔧 Available MCP Tools

### `collection_info`
Get status of all collections and clients.

```typescript
// No parameters needed
collection_info()
// Returns: Collection stats, client list, system status
```

### `catalog_search`
Search document summaries for a specific client.

```typescript
{
  "query": "quarterly business strategy",
  "client": "work", 
  "limit": 10
}
```

### `chunks_search`  
Search document chunks with optional source filtering.

```typescript
{
  "query": "machine learning implementation",
  "client": "research",
  "source": "/path/to/specific/document.md",  // optional
  "limit": 5
}
```

### `all_chunks_search`
Search across all clients and collections.

```typescript
{
  "query": "project management best practices",
  "limit": 20
}
```

## 🏗️ Architecture Deep Dive

### Collection Structure
```
Qdrant Collections:
├── work_catalog           # Document summaries for work
├── work_chunks            # Document chunks for work  
├── personal_catalog       # Document summaries for personal
├── personal_chunks        # Document chunks for personal
├── research_catalog       # Document summaries for research
├── research_chunks        # Document chunks for research
└── ... (per client)
```

### Data Flow Pipeline
```
Documents → Hash Check → Content Extract → LM Summary → 
Chunk Split → BGE-M3 Embed → Batch Process → Qdrant Store → MCP Search
```

### Document Processing Pipeline

1. **Directory Scan** - Find all supported documents (.pdf, .md, .txt, .docx)
2. **Hash Validation** - SHA256 deduplication (skip unchanged files)
3. **Content Processing** - Extract text using appropriate parsers
4. **Summary Generation** - LM Studio Qwen3 creates document overviews
5. **Chunk Creation** - Split documents with configurable overlap
6. **Batch Embedding** - BGE-M3 vectorization in efficient batches
7. **Qdrant Storage** - Dual collection storage (catalog + chunks)

## 🎯 Performance & Scalability

### Optimizations Applied

- **Concurrency Control** - p-limit prevents API overload
- **Batch Processing** - Multiple embeddings per API call
- **Smart Caching** - SHA256 prevents duplicate processing  
- **Memory Efficient** - Streaming document processing
- **Error Recovery** - Graceful handling of failures

### Performance Benchmarks

| Metric | Performance | Notes |
|--------|-------------|-------|
| **Documents/minute** | 50-100 | Depends on document size and LM Studio performance |
| **Memory usage** | 100-500MB | During processing, minimal at rest |
| **Search latency** | <200ms | Average semantic search response time |
| **Concurrency** | 5 parallel | Configurable based on system resources |
| **Hash optimization** | 90%+ savings | On incremental updates |

### Scalability Features

- **Multi-client isolation** - No data leakage between clients
- **Horizontal scaling** - Add more Qdrant nodes as needed
- **Local-first** - No external API dependencies or costs
- **Incremental processing** - Only process changed documents

## 🔍 Troubleshooting

### Common Issues

**❌ "LM Studio connection failed"**
```bash
# Check LM Studio is running
curl http://127.0.0.1:1235/v1/models

# Verify models are loaded
# BGE-M3 for embeddings, Qwen3 for summaries
```

**❌ "Qdrant connection failed"**  
```bash
# Check Qdrant server (local)
curl http://localhost:6333/collections

# Check Qdrant Cloud with API key
curl -H "api-key: YOUR_KEY" https://your-cluster.qdrant.io/collections
```

**❌ "No documents found"**
```bash
# Check file path exists and contains supported formats
ls -la /path/to/documents

# Verify supported file types (.pdf, .md, .txt, .docx)
find /path/to/documents -name "*.md" -o -name "*.pdf" -o -name "*.txt" -o -name "*.docx"
```

### Debug Mode

Enable comprehensive logging:
```bash
export DEBUG=true
npm run seed -- --client test --filesdir ./sample-docs --debug
```

## 🚀 Development

### Project Structure
```
src/
├── config.ts          # Enhanced configuration system
├── types.ts           # RAG document types & interfaces  
├── index.ts           # MCP server & tool handlers
├── seed.ts            # Ultimate document processing engine
├── persistence/
│   └── qdrant.ts      # Multi-collection Qdrant client
└── validation.ts      # Input validation & safety
```

### Building & Testing

```bash
# Development build
npm run build

# Watch mode for development
npm run watch

# Test processing without modifying database
npm run seed -- --validate-only --client test --filesdir ./test-docs
```

### Adding New Clients

1. Update `CLIENT_COLLECTIONS` in `.env`
2. Run seed command with new client name
3. Collections are created automatically

## 📈 Migration from Other Systems

### From lance-mcp
- **Collections** replace single database files
- **Enhanced config** replaces hardcoded settings
- **Multi-client** replaces single-tenant approach
- **Cloud sync** replaces local-only storage

### From sqlite-vss-mcp
- **Qdrant** replaces SQLite + VSS for better performance
- **TypeScript** replaces Python implementation  
- **MCP integration** replaces custom API

### From original mcp-qdrant-memory
- **RAG document model** replaces knowledge graph entities
- **LM Studio** replaces OpenAI for cost-free local processing
- **Multi-collection** replaces single collection architecture

## 🔐 Privacy & Security

- **Local-first processing** - Documents never leave your machine
- **Client isolation** - Complete data separation between clients
- **No external APIs** - LM Studio runs entirely offline
- **Hash-based deduplication** - Secure content fingerprinting
- **Configurable storage** - Use local Qdrant or secure cloud instances

## 🛣️ Roadmap

### Planned Features
- **Web UI** for collection management and search
- **Additional embedding models** (support for other local models)
- **Advanced chunking strategies** (semantic splitting)
- **Hybrid search** (combine vector + keyword search)
- **Export/import** collections for backup and sharing

### Integration Possibilities
- **Obsidian plugin** for direct vault integration
- **API server mode** for external applications
- **Batch processing** for large document sets
- **Real-time file watching** for automatic updates

## 📚 Extended Documentation

Looking for deeper details, integrations or low-level references?  
Check out the full documentation under [`/docs`](./docs):

- [🧠 Claude Project Instructions](./docs/Claude-Project-Instructions.md) — AI agent behavior and search workflows
- [🖥️ Claude Desktop Integration](./docs/Claude-Desktop-Integration.md) — Setup guide for local LM Studio
- [⚙️ Advanced Configuration](./docs/Advanced-Configuration.md) — Power user setup and tuning
- [🛠 MCP Tools Reference](./docs/MCP-Tools-Reference.md) — Tool descriptions, parameters, and examples
  
### Key Resources
- **Setup guides** for LM Studio, Qdrant, and Claude Desktop integration
- **Performance benchmarks** and optimization tips
- **Troubleshooting guides** for common issues
- **API reference** for all MCP tools
- **Best practices** for multi-client setups

## 🤝 Contributing

This project combines the best ideas from multiple RAG implementations. Contributions welcome for:

- **Performance optimizations**
- **Additional document formats**  
- **Enhanced search capabilities**
- **New embedding models support**
- **UI/dashboard development**
- **Documentation improvements**

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request with detailed description

## 📄 License

MIT License - Use freely for personal and commercial projects.

## 🙏 Acknowledgments

Built upon the excellent work of:
- **lance-mcp** - Document processing architecture inspiration
- **sqlite-vss-mcp** - Performance optimization patterns  
- **delorenj/mcp-qdrant-memory** - TypeScript MCP foundation
- **Qdrant** - Vector search engine
- **LM Studio** - Local LLM hosting platform
- **BGE-M3** - Multilingual embedding model
- **Qwen3** - Document summarization model

## 📞 Support

- **[GitHub Issues](https://github.com/marlian/claude-qdrant-mcp/issues)** - Bug reports and feature requests
- **[GitHub Discussions](https://github.com/marlian/claude-qdrant-mcp/discussions)** - Questions and community support
- **[Documentation](docs/)** - Comprehensive guides and references

For detailed API documentation, see [MCP Tools Reference](docs/MCP-Tools-Reference.md).
For advanced setup, see [Advanced Configuration](docs/Advanced-Configuration.md).

---

**🎯 The most advanced TypeScript RAG system with enterprise-grade features, multi-client isolation, and local-first privacy.**
